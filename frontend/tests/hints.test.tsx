import fs from "node:fs";
import path from "node:path";
import axe from "axe-core";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";
import { messages } from "../src/lib/i18n";

/** BACKLOG #51 (a): at most 3 contextual hints, each shown once, Simple mode only, after the first-run assistant. */
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
  location.hash = "#/overview";
  localStorage.clear();
  localStorage.setItem("u1d.onboarded", "1");
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

const notes = () => [...document.querySelectorAll<HTMLElement>('[role="note"][data-hint]')];
const hint = (id: string) => document.querySelector<HTMLElement>(`[role="note"][data-hint="${id}"]`);
const stored = () => JSON.parse(localStorage.getItem("u1d.hints") ?? "null") as unknown;
const go = async (hash: string) => { await act(async () => { location.hash = hash; window.dispatchEvent(new HashChangeEvent("hashchange")); }); };
const demoOn = async () => { fireEvent.click(await screen.findByRole("button", { name: /^(demo mode|mode démo)$/i })); };
const flush = () => act(async () => { await new Promise((x) => setTimeout(x, 40)); });
const gotIt = (el: HTMLElement) => within(el).getByRole("button", { name: /^(Got it|Compris)$/ });

test("a hint shows once, next to its element, and never again after 'Got it'", async () => {
  render(<App />);
  await screen.findByRole("navigation");
  await waitFor(() => expect(hint("marks")).not.toBeNull());
  expect(hint("palette")).not.toBeNull();
  expect(hint("marks")!.closest("section")).toHaveTextContent(/Findings|Conclusions/); // anchored in the Findings block
  expect(hint("marks")!).toHaveTextContent(/Observed.*Suspected.*Missing/);
  fireEvent.click(gotIt(hint("marks")!));
  expect(hint("marks")).toBeNull();
  expect(stored()).toEqual(["marks"]);
  cleanup();
  render(<App />);
  await screen.findByRole("navigation");
  await demoOn();
  await flush();
  expect(hint("marks")).toBeNull();
  await go("#/findings");
  await screen.findByRole("table");
  expect(hint("marks")).toBeNull();
  expect(hint("palette")).not.toBeNull(); // the other hints are independent
});

test("the timeline hint only shows where the timeline is on screen", async () => {
  render(<App />);
  await go("#/timeline");
  await screen.findByRole("main");
  await flush();
  expect(hint("timeline")).toBeNull(); // demo off: no timeline drawn, so no hint
  await demoOn();
  await screen.findByRole("slider");
  expect(hint("timeline")).not.toBeNull();
  expect(hint("timeline")).toHaveTextContent(/data-gap/);
});

test("no hint in Expert mode", async () => {
  localStorage.setItem("u1d.mode", "expert");
  render(<App />);
  await screen.findByRole("navigation");
  await demoOn();
  await flush();
  expect(notes()).toEqual([]);
  await go("#/timeline");
  await screen.findByRole("slider");
  expect(notes()).toEqual([]);
});

test("no hint before the first-run assistant is finished", async () => {
  localStorage.removeItem("u1d.onboarded");
  render(<App />);
  const dlg = await screen.findByRole("dialog");
  await flush();
  expect(notes()).toEqual([]);
  fireEvent.keyDown(dlg, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(hint("palette")).not.toBeNull());
});

test("'Replay the guided start' in Settings also resets the hints", async () => {
  localStorage.setItem("u1d.hints", JSON.stringify(["marks", "timeline", "palette"]));
  render(<App />);
  await go("#/settings");
  await screen.findByRole("button", { name: /Replay the guided start|Rejouer le démarrage guidé/ });
  expect(notes()).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: /Replay the guided start|Rejouer le démarrage guidé/ }));
  const dlg = await screen.findByRole("dialog");
  await waitFor(() => expect(stored()).toEqual([]));
  expect(notes()).toEqual([]); // still hidden while the assistant is open
  fireEvent.keyDown(dlg, { key: "Escape" });
  await waitFor(() => expect(hint("palette")).not.toBeNull());
});

test("at most 3 ids are ever recorded", async () => {
  localStorage.setItem("u1d.hints", JSON.stringify(["palette", "palette", "marks", "marks", "timeline", "timeline", "x", "y"]));
  render(<App />);
  await screen.findByRole("navigation");
  await waitFor(() => expect(stored()).toEqual(["marks", "timeline", "palette"]));
  cleanup();
  localStorage.setItem("u1d.hints", "[]");
  render(<App />);
  await screen.findByRole("navigation");
  await demoOn();
  await waitFor(() => expect(hint("marks")).not.toBeNull());
  fireEvent.click(gotIt(hint("marks")!));
  fireEvent.click(gotIt(hint("palette")!));
  await go("#/timeline");
  await screen.findByRole("slider");
  fireEvent.click(gotIt(hint("timeline")!));
  const list = stored() as string[];
  expect(list).toHaveLength(3);
  expect(new Set(list)).toEqual(new Set(["marks", "timeline", "palette"]));
  expect(notes()).toEqual([]);
});

for (const [label, raw, expected] of [["not JSON", "{oops", []], ["not a list", JSON.stringify({ marks: true }), []], ["unknown ids", JSON.stringify([1, null, "palette", "nope"]), ["palette"]]] as const) {
  test(`a corrupted u1d.hints (${label}) does not crash and is reset`, async () => {
    localStorage.setItem("u1d.hints", raw);
    render(<App />);
    await screen.findByRole("navigation");
    await waitFor(() => expect(stored()).toEqual(expected));
    expect(hint("marks")).not.toBeNull();
  });
}

test("never steals focus; Esc on a focused hint dismisses it and focus goes to the page, not to <body>", async () => {
  render(<App />);
  await screen.findByRole("navigation");
  await waitFor(() => expect(hint("marks")).not.toBeNull());
  await flush();
  for (const n of notes()) expect(n.contains(document.activeElement)).toBe(false);
  const btn = gotIt(hint("marks")!);
  btn.focus();
  expect(document.activeElement).toBe(btn); // keyboard reachable
  expect(btn).toHaveAttribute("aria-describedby");
  expect(document.getElementById(btn.getAttribute("aria-describedby")!)).toHaveTextContent(/Observed/);
  fireEvent.keyDown(btn, { key: "Escape" });
  expect(hint("marks")).toBeNull();
  expect(stored()).toEqual(["marks"]);
  expect(document.activeElement).toBe(document.getElementById("main"));
});

for (const lang of ["en", "fr"]) {
  test(`a11y (axe, structure/ARIA rules): the hints, ${lang}`, async () => {
    localStorage.setItem("u1d.lang", lang);
    const { container } = render(<App />);
    await screen.findByRole("navigation");
    await demoOn();
    await waitFor(() => expect(hint("marks")).not.toBeNull());
    await flush();
    const rules = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };
    let res = await axe.run(container, rules);
    expect(res.violations.map((v) => `overview ${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(" | ")}`)).toEqual([]);
    await go("#/timeline");
    await screen.findByRole("slider");
    expect(hint("timeline")).not.toBeNull();
    await flush();
    res = await axe.run(container, rules);
    expect(res.violations.map((v) => `timeline ${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(" | ")}`)).toEqual([]);
  });
}

const ENGLISH = /\b(the|and|of|with|from|not|is|are|got|it|tip|quick|hint|observed|suspected|missing|data|gap|chip|screen|search|jump|paste|event|timeline|button|real|typed)\b/i;
test("FR: the hints are French, with no English words", async () => {
  for (const s of Object.values(messages.fr.hint)) expect([...new Set(s.replace(/Ctrl K/g, " ").match(new RegExp(ENGLISH.source, "gi")) ?? [])], s).toEqual([]);
  localStorage.setItem("u1d.lang", "fr");
  render(<App />);
  await screen.findByRole("navigation");
  await demoOn();
  await waitFor(() => expect(hint("marks")).not.toBeNull());
  await go("#/timeline");
  await screen.findByRole("slider");
  const text = notes().map((n) => n.textContent ?? "").join(" ");
  expect(text).toMatch(/Astuce/);
  expect([...new Set(text.replace(/Ctrl K/g, " ").match(new RegExp(ENGLISH.source, "gi")) ?? [])]).toEqual([]);
});
