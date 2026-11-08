import fs from "node:fs";
import path from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";
import type { CommunityCause, Finding, MessageMatch, Observation } from "../src/api";
import { buildTicket, LOG_EXPORT_URL, type TicketFields } from "../src/lib/ticket-text";

/** #55 community causes / near-match / message matcher, #56 ticket summary and evidence notice, in English and French. */
const ROOT = path.resolve(__dirname, "../..");
const CC = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge/u1_community_causes.json"), "utf8")) as { checked_at: string; causes: CommunityCause[] };
const MSG = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge/u1_messages.json"), "utf8")) as { messages: MessageMatch[] };

// same rule as tests/i18n-render.test.tsx
const ENGLISH = /\b(the|and|of|with|from|not|is|are|toolhead|toolheads|observed|official|synthetic|untested|unknown|warning|check|printer|data|declared|reported|code reported|state|print|gap|fact|hypothesis|evidence|findings?|replay|settings|overview|timeline|read-only|connection|feeder|request|blocked|incomplete|limits|references?|integrity|samples?)\b/i;
const ALLOWED = /(U1-[A-Z0-9-]+|\/printer\/[\w/]+|printer\.[\w.*]+|SHA-256|UTC|Moonraker|WebSocket|G-code|U1 Doctor|Snapmaker|Ctrl K|DEMO|MCU|API|SSID|IP|TESTED|JSON|README|manifest|observations|privacy-report|findings\.json)/g;
const english = (s: string) => [...new Set(s.replace(ALLOWED, " ").match(new RegExp(ENGLISH.source, "gi")) ?? [])];

const BED = "0003-0526-0000-0000";
const base = { official_reference: "https://wiki.snapmaker.com/", catalog_version: "0.3.0", catalog_verified_at: "2026-11-06", limits: [] as string[] };
const known = { ...base, decoding: { status: "KNOWN", classification: "OBSERVED", severity: "error", module: "heated bed", code: BED, entry: { title: "Heated Bed Temperature Exceeded", summary: "The heated bed temperature exceeded its limit." } },
  community: { kind: "COMMUNITY_REPORT", checked_at: CC.checked_at, causes: CC.causes.filter((c) => c.codes.includes(BED)) }, input: { normalized: null, suggestions: [] }, messages: [] };
const typo = { ...base, decoding: { status: "MALFORMED", classification: "INCONCLUSIVE", reason: "code must match dddd-dddd-dddd-dddd (digits only, no spaces)" },
  community: { kind: "COMMUNITY_REPORT", checked_at: CC.checked_at, causes: [] }, input: { normalized: "0003-0522-0000-0000", suggestions: [{ code: "0003-0522-0000-0000", title: "The MCU: System Anomaly" }] }, messages: [] };
const msg = { ...base, decoding: { status: "MALFORMED", classification: "INCONCLUSIVE", reason: "code must be ASCII text like dddd-dddd-dddd-dddd" },
  community: { kind: "COMMUNITY_REPORT", checked_at: CC.checked_at, causes: [] }, input: { normalized: null, suggestions: [] }, messages: MSG.messages.filter((m) => m.id === "MSG-SELECT-FILAMENT-TYPE") };

let calls: string[] = [];
beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    let body: unknown = {};
    if (String(url).endsWith("/errors/interpret")) {
      const code = JSON.parse(String(init?.body)).code as string;
      calls.push(code);
      body = code === BED ? known : code.startsWith("003-") ? typo : code.includes("Filament") ? msg : { ...known, community: { ...known.community, causes: [] }, decoding: { ...known.decoding, code } };
    } else if (String(url).includes("/known-issues")) body = { issues: [], source_url: "https://wiki.snapmaker.com/", checked_at: "2026-11-06" };
    else if (String(url).includes("/support/")) body = { code: BED, status: "KNOWN", items: [], notes: [], ticket: { title: "t", url: "https://x.y/" } };
    else if (String(url).endsWith("/api/v1/history")) body = { sessions: [], totals: { sessions: 0, observations: 0 }, limits: { max_sessions: 50 } };
    else if (String(url).includes("/demo/scenarios/")) body = { observations: [] };
    else if (String(url).endsWith("/demo/scenarios")) body = { banner: "x", scenarios: [] };
    else if (String(url).endsWith("/replays")) body = { mode: "REPLAY", matches_golden: true, findings: [], ruleset_hash: "h", findings_sha256: "f", input_sha256: "i" };
    else if (String(url).endsWith("/compatibility")) body = { verified_on_hardware: false, rows: [], capabilities: [] };
    else if (String(url).endsWith("/health")) body = { status: "ok", api_version: "1", app_version: "0.1.7-g1", mode: "DEMO", machine_access: "READ_ONLY_ON_CONSENT", db_schema: 1 };
    return { ok: true, status: 200, json: async () => body };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

test("every French text of the community and message data has no English word", () => {
  for (const c of CC.causes) for (const p of [c.cause, c.scope, ...c.check]) expect(english(p.fr), `${c.id}: ${p.fr}`).toEqual([]);
  for (const m of MSG.messages) for (const p of [m.title, m.explanation]) expect(english(p.fr), `${m.id}: ${p.fr}`).toEqual([]);
});

test("the community block is separate, labelled as not official and cites the forum topic with its date", async () => {
  location.hash = `#/explorer/${BED}`;
  render(<App />);
  const list = await screen.findByTestId("community-causes");
  const panel = list.closest("section") as HTMLElement;
  expect(within(panel).getByText("Reported by the community (not official)")).toBeTruthy();
  expect(within(list).getByText("Community report")).toBeTruthy();
  const link = within(list).getByRole("link", { name: /Forum topic 44067 · posted 2026-11-04/ });
  expect(link.getAttribute("href")).toBe("https://forum.snapmaker.com/t/44067");
  expect(panel.textContent).toMatch(/-1035\.8 °C/);
  expect(panel.textContent).toMatch(/Forum topics read on 2026-11-08/);
});

test("French community block has no English text", async () => {
  localStorage.setItem("u1d.lang", "fr");
  location.hash = `#/explorer/${BED}`;
  render(<App />);
  const list = await screen.findByTestId("community-causes");
  const panel = list.closest("section") as HTMLElement;
  expect(panel.textContent).toMatch(/Signalé par la communauté \(non officiel\)/);
  expect(english(panel.textContent ?? "")).toEqual([]);
});

test("a mistyped code offers suggestions and decodes only the one the owner picks", async () => {
  location.hash = "#/explorer/003-0522-0000-0000";
  render(<App />);
  const box = await screen.findByTestId("code-suggestions");
  expect(box.textContent).toMatch(/Read as 0003-0522-0000-0000/);
  expect(calls).toEqual(["003-0522-0000-0000"]);
  fireEvent.click(within(box).getByRole("button", { name: /0003-0522-0000-0000/ }));
  await waitFor(() => expect(calls).toContain("0003-0522-0000-0000"));
});

test("a message without a code is explained, in English and in French without English words", async () => {
  location.hash = `#/explorer/${encodeURIComponent("Please Select Filament Type")}`;
  render(<App />);
  const box = await screen.findByTestId("message-matches");
  expect(box.textContent).toMatch(/No official article for this exact text was found/);
  expect(within(box).getByRole("link", { name: /Community report · Forum topic 43754/ }).getAttribute("href")).toBe("https://forum.snapmaker.com/t/43754");
  cleanup();
  localStorage.setItem("u1d.lang", "fr");
  render(<App />);
  const fr = await screen.findByTestId("message-matches");
  expect(fr.textContent).toMatch(/Aucun article officiel/);
  expect(english((fr.closest("section") as HTMLElement).textContent ?? "")).toEqual([]);
});

const obs = (event_type: string, value: unknown, source_status = "SYNTHETIC"): Observation => ({ observation_id: `o-${event_type}-${Math.random()}`, capture_utc: "2026-01-13T14:09:12Z", source_status, timestamp_quality: "RECEIPT_ONLY", entity_id: "printer", mapping_quality: "VERIFIED", event_type, validity: "FRESH", value } as unknown as Observation);
const finding = (title: string, mix: string[]): Finding => ({ finding_id: "f1", rule_id: "R-1", rule_version: "1", classification: "SUSPECTED", human_title: title, evidence_for: [], evidence_against: [], missing_data: [], safe_actions: [], limits: [], references: [], evidence_quality: "LOW", source_mix: mix, hypotheses: [], ruleset_id: "x", ruleset_hash: "h", replay_hash: "r" } as Finding);
const fields: TicketFields = { firmware: "2.1.0", slicer: "Snapmaker Orca 2.3.5", toolhead: "3", code: "0002-0525-0002-0002", network: "lan", filaments: ["PLA", "", "PETG", ""], tried: "Reloaded filament\nCleaned the nozzle" };

test("ticket summary lists the owner's fields, the capture facts and the log limit; demo stays labelled", () => {
  const demo = buildTicket("en", { appVersion: "0.1.7-g1", fields, title: "Filament feeder 3 loading anomaly", source: { kind: "demo" }, obs: [obs("state_transition", {}), obs("capture_gap", {}), obs("temperature_sample", {})], findings: [finding("SYNTHETIC: Malformed error code", ["SYNTHETIC"])] });
  for (const s of ["U1 Doctor 0.1.7-g1", "Firmware: 2.1.0", "Slicer: Snapmaker Orca 2.3.5", "Toolhead: 3", "Error code: 0002-0525-0002-0002 (Filament feeder 3 loading anomaly)", "Connection: LAN only",
    "T1 PLA · T2 not stated · T3 PETG · T4 not stated", "What I tried: Reloaded filament / Cleaned the nozzle", "Events recorded: 3 · Recorded data gaps: 1", "[SYNTHETIC] Malformed error code · SUSPECTED · SYNTHETIC"]) expect(demo).toContain(s);
  expect(demo).toContain("> SYNTHETIC DEMO DATA, not from a printer");
  expect(demo).toContain(`does not replace the printer's encrypted system log that support asks for; export that log as described in ${LOG_EXPORT_URL}`);
  const saved = buildTicket("en", { appVersion: null, fields: { ...fields, code: "", network: "" }, title: "x", source: { kind: "saved", label: "H-02", statusMix: ["REAL"] }, obs: [obs("state_transition", {}, "REAL")], findings: [] });
  expect(saved).not.toContain("SYNTHETIC");
  expect(saved).toContain('Data source: saved session "H-02" [REAL]');
  expect(saved).toContain("Error code: not stated\n");
  expect(saved).toContain("Findings (classification · provenance): none");
});

test("French ticket summary has no English word apart from what the owner typed", () => {
  const fr = buildTicket("fr", { appVersion: "0.1.7-g1", fields: { ...fields, tried: "", slicer: "", filaments: ["", "", "", ""] }, title: "Filament feeder 3 loading anomaly", source: { kind: "demo" }, obs: [obs("capture_gap", {})], findings: [finding("SYNTHETIC: Malformed error code", ["SYNTHETIC"])] });
  expect(fr).toContain("DONNÉES DE DÉMONSTRATION SYNTHÉTIQUES");
  expect(fr).toContain("[SYNTHÉTIQUE] Code d'erreur mal formé");
  expect(fr).toContain("ne remplace pas le journal système chiffré");
  expect(english(fr.replace(LOG_EXPORT_URL, " "))).toEqual([]);
});

test("report composer: the ticket summary copies the demo-labelled text and nothing is sent", async () => {
  const write = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText: write }, configurable: true });
  location.hash = "#/report";
  render(<App />);
  await screen.findByRole("main");
  await act(async () => { await new Promise((x) => setTimeout(x, 100)); });
  const pre = await screen.findByTestId("ticket-text");
  expect(pre.textContent).toContain("no capture loaded");
  const before = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Copy summary" }));
  await waitFor(() => expect(write).toHaveBeenCalledWith(pre.textContent));
  expect((fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(before);
  expect(screen.getByRole("link", { name: /How to export the log/ }).getAttribute("href")).toBe(LOG_EXPORT_URL);
});

test("evidence notice links to the export and can be dismissed", async () => {
  location.hash = "#/timeline";
  render(<App />);
  const note = await screen.findByTestId("evidence-notice");
  expect(within(note).getByRole("link", { name: "Go to the bundle export" }).getAttribute("href")).toBe("#/report");
  fireEvent.click(within(note).getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByTestId("evidence-notice")).toBeNull();
  expect(localStorage.getItem("u1d.evidenceNotice.dismissed")).toBe("1");
});
