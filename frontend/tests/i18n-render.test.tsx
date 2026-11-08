import fs from "node:fs";
import path from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";

const FIX = path.resolve(__dirname, "../../fixtures/synthetic");
const NAME = "demo_extrusion_blockage";
const observations = fs.readFileSync(path.join(FIX, `synthetic_${NAME}.observations.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const findings = JSON.parse(fs.readFileSync(path.join(FIX, `synthetic_${NAME}.findings.json`), "utf8"));
const RFIX = path.resolve(__dirname, "../../fixtures/real");
const realObs = fs.readFileSync(path.join(RFIX, "real_h02_normal_print.observations.jsonl"), "utf8").trim().split(String.fromCharCode(10)).map((l) => JSON.parse(l));
const realFindings = JSON.parse(fs.readFileSync(path.join(RFIX, "real_h02_normal_print.findings.json"), "utf8"));
const realProv = JSON.parse(fs.readFileSync(path.join(RFIX, "real_h02_normal_print.provenance.json"), "utf8"));
const realCapture = { source_status: "REAL", provenance: realProv, observations: realObs, findings: realFindings, matches_golden: true, input_sha256: "d".repeat(64), findings_sha256: "e".repeat(64) };
const cat = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../knowledge/u1_codes.json"), "utf8")) as { entries: { code: string; title: string; summary: string; toolhead?: number }[] };

function api() {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    let body: unknown = {};
    if (url.endsWith("/api/v1/history")) body = { sessions: [] };
    else if (url.endsWith("/demo/scenarios")) body = { banner: "x", scenarios: [NAME, "timeout", "offline_gap"] };
    else if (url.includes("/demo/scenarios/")) body = { observations, golden_findings: findings };
    else if (url.includes("/real/captures/")) body = realCapture;
    else if (url.endsWith("/replays")) body = { mode: "REPLAY", matches_golden: true, findings, ruleset_hash: "sha256:" + "a".repeat(64), findings_sha256: "b".repeat(64), input_sha256: "c".repeat(64) };
    else if (url.endsWith("/bundles/preview")) body = { manifest: { files: [{ name: "observations.jsonl", sha256: "a".repeat(64), bytes: 10 }, { name: "findings.json", sha256: "b".repeat(64), bytes: 20 }], source_mix: ["SYNTHETIC"] }, privacy: { automatic_redaction_is_best_effort: true } };
    else if (url.endsWith("/bundles/import")) return { ok: false, status: 422, json: async () => ({ detail: { code: "HASH_MISMATCH", message: "x" } }) };
    else if (url.includes("/timeline?source=")) body = { source_status: url.includes("real") ? "REAL" : "SYNTHETIC", observation_count: 3, integrity: "NO_GAP_RECORDED", observed_window: { start_utc: "2026-01-01T10:00:00Z", end_utc: "2026-01-01T10:10:00Z", duration_s: 600 }, sessions: [{ session_id: "s", observations: 3 }], gaps: [], phases: [{ state: "printing", start_utc: "2026-01-01T10:00:00Z", end_utc: "2026-01-01T10:10:00Z", duration_s: 600, ended_by_transition: false }], incident: null, entries: [{ t_utc: "2026-01-01T10:00:00Z", last_utc: "2026-01-01T10:00:00Z", ids: ["a"], event_type: "state_transition", entity_id: "printer", mapping_quality: "VERIFIED", timestamp_quality: "RECEIPT_ONLY", source_status: "SYNTHETIC", validity: "FRESH", summary: { state: "printing" }, repeat: 1 }] };
    else if (url.endsWith("/errors/interpret")) {
      const code = JSON.parse(String(init?.body)).code as string;
      const e = cat.entries.find((x) => x.code === code);
      body = { source: "USER_REPORTED", catalog_version: "0.1.0", catalog_verified_at: "2026-11-05", official_reference: "https://example.test/", limits: ["The displayed code may not represent the actual fault source (official wiki note).", "Code declared by the user; not verified from the machine."],
        decoding: e ? { code, level: "0002", severity: "warning", module: "filament feeder", status: "KNOWN", classification: "OBSERVED", entry: e } : { status: "MALFORMED", classification: "INCONCLUSIVE", reason: "code must match dddd-dddd-dddd-dddd (digits only, no spaces)" } };
    } else if (url.endsWith("/compatibility")) body = { verified_on_hardware: false, firmware_target: "V2.1.0", rows: [], capabilities: [{ name: "Objects query", status: "UNTESTED" }, { name: "Offline code decoder", status: "TESTED_SYNTHETIC" }] };
    else if (url.endsWith("/health")) body = { status: "ok", api_version: "1", app_version: "0.1.6-g1", mode: "DEMO", machine_access: "READ_ONLY_ON_CONSENT", db_schema: 1 };
    return { ok: true, status: 200, json: async () => body };
  }));
}
beforeEach(() => { api(); localStorage.setItem("u1d.lang", "fr"); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

/** whole words that should never show in French; technical names (Moonraker, SHA-256, rule ids, codes) are not in this list */
const ENGLISH = /\b(the|and|of|with|from|not|is|are|toolhead|toolheads|observed|official|synthetic|untested|unknown|warning|check|printer|data|declared|reported|code reported|state|print|gap|fact|hypothesis|evidence|findings?|replay|settings|overview|timeline|read-only|connection|feeder|request|blocked|incomplete|limits|references?|integrity|samples?)\b/i;
const ALLOWED = /(U1-[A-Z0-9-]+|\/printer\/[\w/]+|printer\.[\w.*]+|SHA-256|UTC|Moonraker|WebSocket|G-code|U1 Doctor|Snapmaker|Ctrl K|DEMO|MCU|API|SSID|IP|TESTED|JSON|README|manifest|observations|privacy-report|findings\.json)/g;

const ROUTES = ["welcome", "connect", "overview", "explorer/0002-0525-0002-0004", "explorer/0002-0525-0002-0004x", "timeline", "findings", "evidence", "replay", "report", "settings"];
for (const r of ROUTES) {
  test(`French UI has no English text: ${r}`, async () => {
    location.hash = `#/${r}`;
    render(<App />);
    await screen.findByRole("main");
    await act(async () => { await new Promise((x) => setTimeout(x, 350)); });
    const text = (document.body.innerText ?? document.body.textContent ?? "").replace(ALLOWED, " ");
    const hits = [...new Set(text.match(new RegExp(ENGLISH.source, "gi")) ?? [])];
    expect(hits, `English words on #/${r}`).toEqual([]);
  });
}

// the same check with the demo switched on: the screens that stay empty at start show the synthetic incident
for (const r of ["overview", "timeline", "findings", "evidence", "report"]) {
  test(`French UI has no English text with demo mode on: ${r}`, async () => {
    location.hash = `#/${r}`;
    render(<App />);
    await screen.findByRole("main");
    fireEvent.click(await screen.findByRole("button", { name: /^mode démo$/i }));
    await act(async () => { await new Promise((x) => setTimeout(x, 350)); });
    const text = (document.body.innerText ?? document.body.textContent ?? "").replace(ALLOWED, " ");
    const hits = [...new Set(text.match(new RegExp(ENGLISH.source, "gi")) ?? [])];
    expect(hits, `English words on #/${r} (demo on)`).toEqual([]);
  });
}

test("French first-run assistant has no English text, on all three steps", async () => {
  localStorage.removeItem("u1d.onboarded");
  location.hash = "#/overview";
  render(<App />);
  const dlg = await screen.findByRole("dialog");
  for (let step = 1; step <= 3; step++) {
    const text = (dlg.textContent ?? "").replace(ALLOWED, " ");
    const hits = [...new Set(text.match(new RegExp(ENGLISH.source, "gi")) ?? [])];
    expect(hits, `English words on onboarding step ${step}`).toEqual([]);
    expect(dlg.textContent).toMatch(new RegExp(`Étape ${step} sur 3`));
    if (step < 3) fireEvent.click(screen.getByRole("button", { name: /^Suivant$/ }));
  }
});
