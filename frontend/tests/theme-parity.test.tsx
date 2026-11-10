import fs from "node:fs";
import path from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";
import { THEME_IDS } from "../src/themes/registry";

/** A theme changes the look, never the content: every screen shows exactly the same text in the four themes. */

const FIX = path.resolve(__dirname, "../../fixtures/synthetic");
const NAME = "demo_extrusion_blockage";
const observations = fs.readFileSync(path.join(FIX, `synthetic_${NAME}.observations.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const findings = JSON.parse(fs.readFileSync(path.join(FIX, `synthetic_${NAME}.findings.json`), "utf8"));
const RFIX = path.resolve(__dirname, "../../fixtures/real");
const realCapture = {
  source_status: "REAL", provenance: JSON.parse(fs.readFileSync(path.join(RFIX, "real_h02_normal_print.provenance.json"), "utf8")),
  observations: fs.readFileSync(path.join(RFIX, "real_h02_normal_print.observations.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)),
  findings: JSON.parse(fs.readFileSync(path.join(RFIX, "real_h02_normal_print.findings.json"), "utf8")), matches_golden: true, input_sha256: "d".repeat(64), findings_sha256: "e".repeat(64),
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    let body: unknown = {};
    if (url.endsWith("/demo/scenarios")) body = { banner: "x", scenarios: [NAME] };
    else if (url.includes("/demo/scenarios/")) body = { observations, golden_findings: findings };
    else if (url.includes("/real/captures/")) body = realCapture;
    else if (url.includes("/timeline?source=")) body = { source_status: "SYNTHETIC", observation_count: 1, integrity: "NO_GAP_RECORDED", observed_window: { start_utc: "2026-01-01T10:00:00Z", end_utc: "2026-01-01T10:10:00Z", duration_s: 600 }, sessions: [{ session_id: "s", observations: 1 }], gaps: [], phases: [], incident: null, entries: [] };
    else if (url.endsWith("/replays")) body = { mode: "REPLAY", matches_golden: true, findings, ruleset_hash: "sha256:" + "a".repeat(64), findings_sha256: "b".repeat(64), input_sha256: "c".repeat(64) };
    else if (url.endsWith("/errors/interpret")) body = { source: "USER_REPORTED", catalog_verified_at: "2026-11-05", official_reference: "https://wiki.snapmaker.com/", limits: [], decoding: { status: "MALFORMED", classification: "INCONCLUSIVE", reason: "x" } };
    else if (url.endsWith("/compatibility")) body = { capabilities: [] };
    else if (url.endsWith("/health")) body = { status: "ok", api_version: "1", app_version: "0.1.7-g1", mode: "DEMO", machine_access: "READ_ONLY_ON_CONSENT", db_schema: 1 };
    else if (url.endsWith("/api/v1/history")) body = { sessions: [], totals: { sessions: 0, observations: 0 }, limits: { max_sessions: 1, max_observations: 1 } };
    return { ok: true, status: 200, json: async () => body };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function visibleText(route: string, theme: string, lang: string, mode = "simple", demo = false): Promise<string> {
  localStorage.clear();
  localStorage.setItem("u1d.onboarded", "1");
  localStorage.setItem("u1d.mode", mode);
  localStorage.setItem("u1d.theme", theme);
  localStorage.setItem("u1d.lang", lang);
  location.hash = `#/${route}`;
  render(<App />);
  await waitFor(() => expect(screen.getByRole("main").querySelector("h1, h2")).not.toBeNull(), { timeout: 5000 }); // screens load lazily
  if (demo) { fireEvent.click(await screen.findByRole("button", { name: /^(demo mode|mode démo)$/i })); await waitFor(() => expect(screen.getByRole("main").querySelector("table")).not.toBeNull(), { timeout: 5000 }); }
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  expect(document.documentElement.dataset.theme).toBe(theme);
  const text = document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  cleanup();
  return text;
}

test.each([["overview", "fr"], ["settings", "fr"], ["findings", "fr"], ["overview", "en"], ["settings", "en"], ["findings", "en"]])("#/%s (%s): same visible text in every theme", async (route, lang) => {
  const texts: string[] = [];
  for (const id of THEME_IDS) texts.push(await visibleText(route, id, lang)); // one App at a time: they share the document
  const [first, ...rest] = texts;
  expect(first!.length).toBeGreaterThan(200);
  for (const t of rest) expect(t).toBe(first);
}, 40_000);

test.each([["overview", "fr"], ["overview", "en"], ["connect", "fr"], ["connect", "en"]])("#/%s (%s, Expert): same visible text in every theme", async (route, lang) => {
  const texts: string[] = [];
  for (const id of THEME_IDS) texts.push(await visibleText(route, id, lang, "expert", route === "overview"));
  const [first, ...rest] = texts;
  expect(first!.length).toBeGreaterThan(200);
  for (const t of rest) expect(t).toBe(first);
}, 40_000);
