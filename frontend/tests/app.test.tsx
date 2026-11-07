import fs from "node:fs";
import path from "node:path";
import axe from "axe-core";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { App } from "../src/App";
import { messages } from "../src/lib/i18n";

const FIX = path.resolve(__dirname, "../../fixtures/synthetic");
const NAME = "demo_extrusion_blockage";
const observations = fs.readFileSync(path.join(FIX, `synthetic_${NAME}.observations.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const findings = JSON.parse(fs.readFileSync(path.join(FIX, `synthetic_${NAME}.findings.json`), "utf8"));

const RFIX = path.resolve(__dirname, "../../fixtures/real");
const realObs = fs.readFileSync(path.join(RFIX, "real_h02_normal_print.observations.jsonl"), "utf8").trim().split(String.fromCharCode(10)).map((l) => JSON.parse(l));
const realFindings = JSON.parse(fs.readFileSync(path.join(RFIX, "real_h02_normal_print.findings.json"), "utf8"));
const realProv = JSON.parse(fs.readFileSync(path.join(RFIX, "real_h02_normal_print.provenance.json"), "utf8"));
const realCapture = { source_status: "REAL", provenance: realProv, observations: realObs, findings: realFindings, matches_golden: true, input_sha256: "d".repeat(64), findings_sha256: "e".repeat(64) };
const ENTRY = { code: "0002-0525-0002-0004", title: "Extrusion blockage at toolhead 3 drive gear", summary: "Filament extrusion blocked at the drive gear of toolhead 3. Official guidance: check and clean, then retry.", toolhead: 3 };
const interpret = (code: string) => ({
  source: "USER_REPORTED", catalog_version: "0.1.0", catalog_verified_at: "2026-11-05", official_reference: "https://wiki.snapmaker.com/en/snapmaker_u1/troubleshooting/u1_error_codes",
  limits: ["The displayed code may not represent the actual fault source (official wiki note)."],
  decoding: code === "0002-0525-0002-0004"
    ? { code, level: "0002", severity: "warning", module_code: "0525", module: "filament feeder", status: "KNOWN", classification: "OBSERVED", entry: ENTRY }
    : code === "0003-0522-0002-0008"
      ? { code, level: "0003", severity: "error", module: "motion control", status: "KNOWN", classification: "OBSERVED", entry: { ...ENTRY, title: "Toolhead 1 MCU connection interrupted", toolhead: 1 } }
      : { status: "MALFORMED", classification: "INCONCLUSIVE", reason: "code must match dddd-dddd-dddd-dddd" },
});

function mockApi() {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    let body: unknown = {};
    if (url.endsWith("/demo/scenarios")) body = { banner: "x", scenarios: [NAME, "timeout"] };
    else if (url.includes("/demo/scenarios/")) body = { observations, golden_findings: findings };
    else if (url.includes("/real/captures/")) body = realCapture;
    else if (url.endsWith("/replays")) body = { mode: "REPLAY", matches_golden: true, findings, ruleset_hash: "sha256:" + "a".repeat(64), findings_sha256: "b".repeat(64), input_sha256: "c".repeat(64) };
    else if (url.endsWith("/bundles/preview")) body = { manifest: { files: [{ name: "observations.jsonl", sha256: "a".repeat(64), bytes: 10 }, { name: "findings.json", sha256: "b".repeat(64), bytes: 20 }], source_mix: ["SYNTHETIC"] }, privacy: { automatic_redaction_is_best_effort: true } };
    else if (url.endsWith("/bundles/import")) return { ok: false, status: 422, json: async () => ({ detail: { code: "HASH_MISMATCH", message: "x" } }) };
    else if (url.includes("/timeline?source=")) body = { source_status: url.includes("real") ? "REAL" : "SYNTHETIC", observation_count: 3, integrity: "NO_GAP_RECORDED", observed_window: { start_utc: "2026-01-01T10:00:00Z", end_utc: "2026-01-01T10:10:00Z", duration_s: 600 }, sessions: [{ session_id: "s", observations: 3 }], gaps: [], phases: [{ state: "printing", start_utc: "2026-01-01T10:00:00Z", end_utc: "2026-01-01T10:10:00Z", duration_s: 600, ended_by_transition: false }], incident: null, entries: [{ t_utc: "2026-01-01T10:00:00Z", last_utc: "2026-01-01T10:00:00Z", ids: ["a"], event_type: "state_transition", entity_id: "printer", mapping_quality: "VERIFIED", timestamp_quality: "RECEIPT_ONLY", source_status: "SYNTHETIC", validity: "FRESH", summary: { state: "printing" }, repeat: 1 }] };
    else if (url.endsWith("/live/capture")) body = { captured_utc: "2026-11-07T10:00:00Z", duration_s: 15, inbound_frames: 12, source_status: "REAL", printer: { moonraker_version: "v0.9", api_version: "1.5", klippy_state: "ready", klipper_software_version: "v1", printer_state: "ready", object_count: 40 }, audit: { http: [], websocket_frames_sent: 1, read_operations: 4, non_read_operations: 0 }, observations: [], findings: [], session: null };
    else if (url.endsWith("/api/v1/history")) body = { sessions: [{ id: "h0123456789ab", label: "Live capture", origin: "real_capture", saved_at: "2026-11-07T10:00:00Z", observation_count: 3, first_utc: "2026-11-07T10:00:00Z", last_utc: "2026-11-07T10:00:10Z", status_mix: ["REAL"], content_sha256: "f".repeat(64) }], totals: { sessions: 1, observations: 3 }, limits: { max_sessions: 50, max_observations: 5000 } };
    else if (url.endsWith("/history/h0123456789ab/observations")) body = { session: {}, observations: realObs.slice(0, 3) };
    else if (url.endsWith("/history/h0123456789ab/findings")) body = { findings: realFindings, ruleset: { id: "u1-starter", version: "x", hash: "sha256:" + "a".repeat(64) } };
    else if (url.endsWith("/errors/interpret")) body = interpret(JSON.parse(String(init?.body)).code);
    else if (url.endsWith("/compatibility")) body = { verified_on_hardware: false, firmware_target: "V2.1.0", rows: [], capabilities: [{ name: "Moonraker HTTP :7125", status: "UNTESTED" }, { name: "Offline code decoder", status: "TESTED_SYNTHETIC" }] };
    else if (url.endsWith("/health")) body = { status: "ok", api_version: "1", app_version: "0.1.0-g1", mode: "DEMO", machine_access: "READ_ONLY_ON_CONSENT", db_schema: 1 };
    return { ok: true, status: 200, json: async () => body };
  }));
  return calls;
}

let calls: string[];
beforeEach(() => { calls = mockApi(); location.hash = "#/overview"; localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const go = async (hash: string) => { await act(async () => { location.hash = hash; window.dispatchEvent(new HashChangeEvent("hashchange")); }); };

test("DEMO is unmistakable and no machine/connection action exists", async () => {
  render(<App />);
  expect((await screen.findAllByText("DEMO")).length).toBeGreaterThan(0);
  expect(screen.getByText(/synthetic data · not from a printer|données synthétiques/i)).toBeInTheDocument();
  expect(screen.getByText(/0 commands sent|0 commande/i)).toBeInTheDocument();
  expect(screen.queryByText(/^CONNECTED$/i)).toBeNull();
  await go("#/connect");
  const btn = await screen.findByRole("button", { name: /capture \(read-only\)|capturer/i });
  expect(btn).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/printer address|adresse/i), { target: { value: "192.168.50.20" } });
  expect(btn).toBeDisabled(); // an address alone is not enough: the owner must tick the approval box
  expect(calls.every((c) => !/live|printer|gcode/i.test(c.replace("/api/v1/compatibility", "")))).toBe(true);
});

test("live capture needs the approval box, then posts consent and shows 0 writes", async () => {
  render(<App />);
  await go("#/connect");
  const btn = await screen.findByRole("button", { name: /capture \(read-only\)|capturer/i });
  fireEvent.change(screen.getByLabelText(/printer address|adresse/i), { target: { value: "192.168.50.20" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /I own this printer|Cette imprimante est la mienne/i }));
  expect(btn).toBeEnabled();
  await act(async () => { fireEvent.click(btn); });
  const post = await waitFor(() => { const i = calls.findIndex((c) => c === "POST /api/v1/live/capture"); expect(i).toBeGreaterThan(-1); return i; });
  expect(post).toBeGreaterThan(-1);
  expect(await screen.findByText(/Capture finished|Capture terminée/i)).toBeInTheDocument();
  expect(screen.getByText(/Write operations: 0|Opérations d'écriture : 0/i)).toBeInTheDocument();
  expect(document.body.textContent).not.toContain("192.168.50.20");
});

test("navigation has the 10 mandatory screens plus the print-quality assistant, and marks the current one", async () => {
  render(<App />);
  const nav = await screen.findByRole("navigation", { name: /main navigation|navigation principale/i });
  const items = within(nav).getAllByRole("button");
  expect(items).toHaveLength(11);
  expect(items.map((b) => b.textContent)).toEqual(expect.arrayContaining([expect.stringMatching(/Print quality|Qualité d'impression/)]));
  expect(items.filter((b) => b.getAttribute("aria-current") === "page")).toHaveLength(1);
});

test("i18n: FR and EN dictionaries have identical shape", () => {
  const shape = (o: unknown): unknown => (Array.isArray(o) ? o.length : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).sort().map(([k, v]) => [k, shape(v)])) : typeof o);
  expect(shape(messages.fr)).toEqual(shape(messages.en));
});

test("keyboard: Ctrl+K opens the palette, a pasted code is decoded, Esc closes", async () => {
  render(<App />);
  await screen.findByRole("navigation");
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  const dlg = await screen.findByRole("dialog");
  const input = dlg.querySelector("input")!;
  await waitFor(() => expect(document.activeElement).toBe(input));
  fireEvent.change(input, { target: { value: "0002-0525-0002-0004" } });
  expect(await within(dlg).findByText(/Extrusion blockage at toolhead 3/)).toBeInTheDocument();
  fireEvent.keyDown(dlg, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("palette: Enter on a code opens the Error codes screen with the result", async () => {
  render(<App />);
  await screen.findByRole("navigation");
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  const dlg = await screen.findByRole("dialog");
  fireEvent.change(dlg.querySelector("input")!, { target: { value: "0003-0522-0002-0008" } });
  await within(dlg).findByText(/Toolhead 1 MCU/);
  fireEvent.keyDown(dlg, { key: "Enter" });
  expect(await screen.findByRole("alert")).toHaveTextContent(/stopped|arrêtée/i);
  expect(await screen.findAllByText("USER_REPORTED")).not.toHaveLength(0);
});

test("timeline: slider is keyboard operable and values are never shown across a gap", async () => {
  render(<App />);
  await go("#/timeline");
  const slider = await screen.findByRole("slider");
  const before = Number(slider.getAttribute("aria-valuenow"));
  fireEvent.keyDown(slider, { key: "Home" });
  expect(slider.getAttribute("aria-valuenow")).toBe("0");
  fireEvent.keyDown(slider, { key: "ArrowRight" });
  expect(slider.getAttribute("aria-valuenow")).toBe("1");
  fireEvent.keyDown(slider, { key: "End" });
  expect(Number(slider.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(before);
  expect(screen.getAllByText(/DATA GAP|TROU DE DONNÉES/i).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: /table view|vue tableau/i }));
  expect((await screen.findAllByRole("table")).length).toBeGreaterThan(0);
});

test("evidence: every conclusion shows for / against / missing, limits and hashes", async () => {
  render(<App />);
  await go("#/evidence");
  await screen.findAllByText(/Evidence detail|Détail des preuves/);
  for (const re of [/^(For|Pour) · \d+$/, /^(Against|Contre) · \d+$/, /^(Missing|Manquant) · \d+$/]) expect((await screen.findAllByText(re)).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/sha256:/).length).toBeGreaterThanOrEqual(2);
  expect(screen.queryByText(/%/)).toBeNull(); // no invented percentages anywhere
});

test("no screen shows a percentage, health score or confidence value", async () => {
  render(<App />);
  for (const h of ["#/overview", "#/timeline", "#/findings", "#/evidence", "#/replay", "#/report", "#/settings", "#/connect", "#/explorer", "#/welcome"]) {
    await go(h);
    await waitFor(() => expect(screen.getByRole("main")).toBeInTheDocument());
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    const text = screen.getByRole("main").textContent ?? "";
    expect(text, h).not.toMatch(/\d\s?%/);
    expect(text, h).not.toMatch(/\b(health|confidence|santé|confiance)\b/i);
  }
});

test("report: privacy scan runs on the real export files and the export button is enabled when clean", async () => {
  render(<App />);
  await go("#/report");
  const btn = await screen.findByRole("button", { name: /export bundle|exporter le dossier/i });
  await waitFor(() => expect(btn).toBeEnabled(), { timeout: 3000 });
  expect(screen.getAllByText("manifest.json").length).toBeGreaterThan(0);
});

test("replay: two runs of the same scenario are reported identical", async () => {
  render(<App />);
  await go("#/replay");
  const run = await screen.findByRole("button", { name: /run replay|lancer le rejeu/i });
  await waitFor(() => expect(run).toBeEnabled());
  fireEvent.click(run);
  await screen.findByText(/Same result|Même résultat/);
  fireEvent.click(run);
  expect(await screen.findByText(/Identical to the previous run|Identique à l'exécution précédente/)).toBeInTheDocument();
});

test("empty and error states: findings filter without result and API failure", async () => {
  render(<App />);
  await go("#/findings");
  await screen.findByRole("table");
  fireEvent.change(screen.getByLabelText(/filter|filtre/i), { target: { value: "OBSERVED" } });
  expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
  cleanup();
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("boom"); }));
  render(<App />);
  await go("#/overview");
  expect(await screen.findByRole("alert")).toBeInTheDocument();
});

const ROUTES = ["welcome", "connect", "overview", "explorer", "timeline", "findings", "evidence", "replay", "report", "settings"];
for (const r of ROUTES) {
  test(`a11y (axe, structure/ARIA rules): ${r}`, async () => {
    const { container } = render(<App />);
    await go(`#/${r}`);
    await screen.findByRole("main");
    await act(async () => { await new Promise((x) => setTimeout(x, 60)); });
    const res = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(" | ")}`)).toEqual([]);
  });
}

test("report: importing a bundle shows a plain refusal with its reason code (nothing trusted)", async () => {
  render(<App />);
  await go("#/report");
  const input = await screen.findByLabelText(/choose a bundle|choisir un dossier/i);
  await act(async () => { fireEvent.change(input, { target: { files: [new File([new Uint8Array([80, 75])], "x.zip", { type: "application/zip" })] } }); });
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(/HASH_MISMATCH/);
  expect(alert).toHaveTextContent(/modified|modifié/i);
  expect(calls.some((c) => c.startsWith("POST") && c.endsWith("/bundles/import"))).toBe(true);
});

test("timeline: real source shows the reconstruction without incident, labelled REAL", async () => {
  render(<App />);
  await go("#/timeline");
  fireEvent.click(await screen.findByRole("button", { name: /real capture|capture réelle/i }));
  expect(await screen.findByText(/no pause or error state|aucune pause ni erreur/i)).toBeInTheDocument();
  expect(calls.some((c) => c.includes("/timeline?source=real%3Ah02_normal_print"))).toBe(true);
  expect(screen.queryByRole("heading", { name: /^hypothes|^hypothèses/i })).toBeNull(); // demo-only hypothesis map is not shown for the real capture
});

test("report: a saved capture can be chosen and exported through the same privacy scan", async () => {
  render(<App />);
  await go("#/report");
  const pick = await screen.findByLabelText(/report source|source du rapport/i);
  await act(async () => { fireEvent.change(pick, { target: { value: "h0123456789ab" } }); });
  await waitFor(() => expect(calls.some((c) => c.includes("/history/h0123456789ab/observations"))).toBe(true));
  await waitFor(() => expect(calls.some((c) => c.startsWith("POST") && c.endsWith("/bundles/preview"))).toBe(true));
  expect((await screen.findAllByText("Live capture")).length).toBeGreaterThan(0);
});
