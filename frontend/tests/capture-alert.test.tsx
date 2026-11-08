import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";
import { alertCause, TITLE_MARK } from "../src/components/capture-alert";
import type { Finding, Observation } from "../src/api";

/** On-screen alert after a one-shot capture or replay: in-page banner + "(!) " title prefix, no OS notification, nothing sent. */
const ENGLISH = /\b(the|and|of|with|from|not|is|are|observed|finding|findings|event|events|error|shutdown|alert|dismiss|view|result|replay|window|sent|system)\b/i;
const ALLOWED = /(U1-[A-Z0-9-]+|\/printer\/[\w/]+|\/server\/[\w/?=]+|printer\.[\w.*]+|server\.[\w.*]+|SHA-256|UTC|Moonraker|WebSocket|G-code|U1 Doctor|Snapmaker|Ctrl K|DEMO|MCU|API|IP|GET|WS|Klippy|Klipper|REAL|JSON)/g;

const finding = (id: string, classification: string) => ({ finding_id: id, rule_id: "U1-S03-STATE-TRANSITION", classification, human_title: "Print state changed", source_mix: ["REAL"] }) as unknown as Finding;
const obs = (id: string, value: unknown) => ({ observation_id: id, event_type: "link_probe", value }) as unknown as Observation;

let findings: Finding[] = [];
let klippy = "ready";
let calls: string[] = [];
let base = "";
function mock() {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(String(url));
    let body: unknown = {};
    if (url.endsWith("/live/capture")) body = {
      captured_utc: "2026-11-08T10:00:00Z", duration_s: 15, inbound_frames: 40, source_status: "REAL",
      printer: { moonraker_version: "v0.9", api_version: "1.5", klippy_state: klippy, klipper_software_version: "v1", printer_state: "ready", object_count: 40 },
      audit: { http: [], websocket_frames_sent: 1, read_operations: 5, non_read_operations: 0 },
      observations: [], findings, session: null };
    else if (url.endsWith("/demo/scenarios")) body = { scenarios: ["demo_extrusion_blockage"] };
    else if (url.endsWith("/replays")) body = { mode: "REPLAY", matches_golden: true, findings: [finding("f-demo-1", "OBSERVED"), finding("f-demo-2", "INCONCLUSIVE")], ruleset_hash: "sha256:" + "a".repeat(64), findings_sha256: "b".repeat(64), input_sha256: "c".repeat(64) };
    else if (url.endsWith("/api/v1/history")) body = { sessions: [], totals: { sessions: 0, observations: 0 }, limits: { max_sessions: 200, max_observations: 1 } };
    else if (url.endsWith("/compatibility")) body = { verified_on_hardware: true, firmware_target: "V2.1.0", rows: [], capabilities: [] };
    else if (url.includes("/demo/scenarios/")) body = { observations: [], golden_findings: [] };
    else if (url.endsWith("/health")) body = { status: "ok", api_version: "1", app_version: "0.1.7-g1", mode: "DEMO", machine_access: "READ_ONLY_ON_CONSENT", db_schema: 2 };
    return { ok: true, status: 200, json: async () => body } as Response;
  }));
}
const notify = vi.fn();
beforeEach(() => {
  findings = [finding("f-live-1", "OBSERVED"), finding("f-live-2", "INCONCLUSIVE")]; klippy = "ready";
  document.title = "U1 Doctor";
  mock();
  notify.mockReset();
  vi.stubGlobal("Notification", Object.assign(notify, { requestPermission: notify, permission: "default" }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); location.hash = ""; });
const go = async (hash: string) => { await act(async () => { location.hash = hash; window.dispatchEvent(new HashChangeEvent("hashchange")); }); };

async function capture() {
  render(<App />);
  await go("#/connect");
  const btn = await screen.findByRole("button", { name: /capture \(read-only\)|capturer/i });
  fireEvent.change(screen.getByLabelText(/printer address|adresse/i), { target: { value: "192.168.50.20" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /I own this printer|Cette imprimante est la mienne/i }));
  base = document.title;
  await act(async () => { fireEvent.click(btn); });
}

test("alertCause counts new OBSERVED findings and error/shutdown states, and never the same id twice", () => {
  const seen = new Set<string>();
  const f = [finding("a", "OBSERVED"), finding("b", "SUSPECTED"), finding("c", "OBSERVED")];
  const o = [obs("o1", { klippy_state: "shutdown" }), obs("o2", { state: "printing" }), obs("o3", { state: "Error" })];
  expect(alertCause(f, o, ["ready", "shutdown"], seen)).toEqual({ observed: 2, events: 3 });
  expect(alertCause(f, o, [], seen)).toBeNull();
  expect(alertCause([finding("z", "INCONCLUSIVE")], [obs("o4", { state: "paused" })], ["ready", null], new Set())).toBeNull();
});

test("EN: a new observed finding and a shutdown state raise a banner and prefix the title until the result is viewed", async () => {
  localStorage.setItem("u1d.lang", "en");
  klippy = "shutdown";
  await capture();
  const banner = await screen.findByTestId("capture-alert");
  expect(banner.getAttribute("role")).toBe("alert");
  expect(banner.textContent).toContain("New in this capture");
  expect(banner.textContent).toContain("1 observed finding · 1 error or shutdown event");
  expect(banner.textContent).toContain("no system notification");
  expect(base.startsWith(TITLE_MARK)).toBe(false);
  expect(document.title).toBe(`${TITLE_MARK}${base}`);
  fireEvent.click(screen.getByRole("button", { name: "View the result" }));
  expect(screen.queryByTestId("capture-alert")).toBeNull();
  expect(document.title).toBe(base);
  expect(document.activeElement?.id).toBe("live-result");
  expect(notify).not.toHaveBeenCalled();
  expect(calls.every((u) => u.startsWith("/api/"))).toBe(true);
});

test("EN: the alert can be dismissed, and a clean capture raises none", async () => {
  localStorage.setItem("u1d.lang", "en");
  await capture();
  await screen.findByTestId("capture-alert");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss the alert" }));
  expect(screen.queryByTestId("capture-alert")).toBeNull();
  expect(document.title).toBe(base);
  cleanup();
  findings = [finding("f-x", "INCONCLUSIVE")];
  await capture();
  await screen.findByText("Capture finished");
  expect(screen.queryByTestId("capture-alert")).toBeNull();
  expect(document.title).toBe(base);
});

test("EN: the Settings toggle (default on) turns the alert off and is remembered", async () => {
  localStorage.setItem("u1d.lang", "en");
  render(<App />);
  await go("#/settings");
  const on = await screen.findByRole("button", { name: "On" });
  expect(on.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Off" }));
  expect(localStorage.getItem("u1d.alerts")).toBe("0");
  cleanup();
  await capture();
  await screen.findByText("Capture finished");
  expect(screen.queryByTestId("capture-alert")).toBeNull();
  expect(document.title).toBe(base);
});

test("EN: a replay alerts once; replaying the same findings again does not", async () => {
  localStorage.setItem("u1d.lang", "en");
  localStorage.setItem("u1d.mode", "expert");
  render(<App />);
  await go("#/replay");
  const run = await screen.findByRole("button", { name: "Run replay" });
  await waitFor(() => expect((run as HTMLButtonElement).disabled).toBe(false));
  await act(async () => { fireEvent.click(run); });
  const banner = await screen.findByTestId("capture-alert");
  expect(banner.textContent).toContain("New in this replay");
  expect(banner.textContent).toContain("1 observed finding");
  await act(async () => { fireEvent.click(run); });
  expect(screen.queryByTestId("capture-alert")).toBeNull();
});

test("FR: banner and setting are French, with no English words", async () => {
  localStorage.setItem("u1d.lang", "fr");
  findings = [finding("f1", "OBSERVED"), finding("f2", "OBSERVED")];
  klippy = "error";
  await capture();
  const banner = await screen.findByTestId("capture-alert");
  expect(banner.textContent).toContain("Nouveau dans cette capture");
  expect(banner.textContent).toContain("2 constats observés · 1 événement d'erreur ou d'arrêt");
  const words = () => { const w = document.createTreeWalker(banner, NodeFilter.SHOW_TEXT); const out: string[] = []; while (w.nextNode()) out.push(w.currentNode.textContent ?? ""); return out.join(" "); };
  expect([...new Set(words().replace(ALLOWED, " ").match(new RegExp(ENGLISH.source, "gi")) ?? [])]).toEqual([]);
  expect(screen.getByRole("button", { name: "Masquer l'alerte" })).toBeTruthy();
  cleanup();
  render(<App />);
  await go("#/settings");
  expect(await screen.findByText("Alerte à l'écran")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Activée" }).getAttribute("aria-pressed")).toBe("true");
});
