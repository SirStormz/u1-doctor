import fs from "node:fs";
import path from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";
import { tx } from "../src/lib/dyn";
import { messages } from "../src/lib/i18n";
import { loadGcodeNozzle, nozzleFromPreflight, saveGcodeNozzle } from "../src/lib/gcode-nozzle";

/** BACKLOG #57/#59: live rules (UNTESTED), connectivity self-check, consent text, compatibility rows. Network mocked. */
const FIX = path.resolve(__dirname, "../../fixtures/synthetic");
const live = (n: string) => JSON.parse(fs.readFileSync(path.join(FIX, `synthetic_live_rules_${n}.findings.json`), "utf8")) as { human_title: string }[];
const ENGLISH = /\b(the|and|of|with|from|not|is|are|toolhead|toolheads|observed|official|synthetic|untested|unknown|warning|check|printer|data|declared|reported|state|print|gap|fact|hypothesis|evidence|findings?|replay|settings|read-only|connection|request|blocked|limits|references?|samples?|stream|drops?|changed|advice|router|cloud|account|wired)\b/i;
const ALLOWED = /(U1-[A-Z0-9-]+|\/printer\/[\w/]+|\/server\/[\w/?=]+|printer\.[\w.*]+|server\.[\w.*]+|SHA-256|UTC|Moonraker|WebSocket|G-code|U1 Doctor|Snapmaker|Ctrl K|DEMO|MCU|API|IP|DHCP|Wi-Fi|TESTED|JSON)/g;

let calls: { url: string; body?: unknown }[] = [];
let ipChanged: boolean | null = true;
let maxMs = 1210.5;
function mock() {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    let body: unknown = {};
    if (url.endsWith("/live/capture")) body = {
      captured_utc: "2026-11-08T10:00:00Z", duration_s: 15, inbound_frames: 40, source_status: "REAL",
      printer: { moonraker_version: "v0.9", api_version: "1.5", klippy_state: "ready", klipper_software_version: "v1", printer_state: "ready", object_count: 40 },
      audit: { http: [], websocket_frames_sent: 1, read_operations: 5, non_read_operations: 0 }, budget: { max_get: 10, max_ws_sent: 1 },
      connectivity: { requests: [{ op: "server.info", ms: 12.5, status: 200 }, { op: "server.files.directory", ms: maxMs, status: 200 }], ws_drops: 1, ws_reconnects: 0, ws_frames_received: 40, ip_changed: ipChanged, max_ms: maxMs, median_ms: 12.5 },
      observations: [], findings: [], session: null };
    else if (url.endsWith("/api/v1/history")) body = { sessions: [], totals: { sessions: 0, observations: 0 }, limits: { max_sessions: 200, max_observations: 1 } };
    else if (url.endsWith("/compatibility")) body = { verified_on_hardware: true, firmware_target: "V2.1.0", rows: [], capabilities: [
      { name: "Log partition usage read", status: "UNTESTED" }, { name: "Cavity sensor and bed mesh subscription", status: "UNTESTED" },
      { name: "Live rules S17-S24", status: "UNTESTED" }, { name: "Connectivity self-check", status: "UNTESTED" }, { name: "Objects list", status: "TESTED_REAL" }] };
    else if (url.includes("/demo/scenarios/")) body = { observations: [], golden_findings: [] };
    else if (url.endsWith("/replays")) body = { mode: "REPLAY", matches_golden: true, findings: [], ruleset_hash: "sha256:" + "a".repeat(64), findings_sha256: "b".repeat(64), input_sha256: "c".repeat(64) };
    else if (url.endsWith("/health")) body = { status: "ok", api_version: "1", app_version: "0.1.7-g1", mode: "DEMO", machine_access: "READ_ONLY_ON_CONSENT", db_schema: 2 };
    return { ok: true, status: 200, json: async () => body } as Response;
  }));
}
beforeEach(() => { mock(); ipChanged = true; maxMs = 1210.5; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); location.hash = ""; });
const go = async (hash: string) => { await act(async () => { location.hash = hash; window.dispatchEvent(new HashChangeEvent("hashchange")); }); };

async function capture() {
  render(<App />);
  await go("#/connect");
  const btn = await screen.findByRole("button", { name: /capture \(read-only\)|capturer/i });
  fireEvent.change(screen.getByLabelText(/printer address|adresse/i), { target: { value: "192.168.50.20" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /I own this printer|Cette imprimante est la mienne/i }));
  await act(async () => { fireEvent.click(btn); });
  await screen.findByText(/Connectivity self-check|Autodiagnostic de la connexion/);
}

test("consent text states 4 GET, 1 subscription and 10 GET at most, in both languages", () => {
  expect(messages.en.liveConsent).toMatch(/4 GET .*1 live subscription.*up to 6 more.*10 GET at most/);
  expect(messages.fr.liveConsent).toMatch(/4 GET .*1 abonnement en direct.*jusqu'à 6 GET.*10 GET au maximum/);
});

test("EN: connectivity panel shows timings, drops, 0 reconnects, the address flag and only the observed advice", async () => {
  localStorage.setItem("u1d.lang", "en");
  await capture();
  expect(screen.getByText("UNTESTED on a real U1")).toBeInTheDocument();
  expect(screen.getByText("Changed since the last capture")).toBeInTheDocument();
  expect(screen.getByText(/DHCP reservation/)).toBeInTheDocument();
  expect(screen.getByText(/2.4 GHz/)).toBeInTheDocument();
  expect(screen.getByText(/stream closed early/)).toBeInTheDocument();
  expect(screen.getByText(/router settings .* cloud or account problems/)).toBeInTheDocument();
  expect(screen.getByText("/server/files/directory?path=logs")).toBeInTheDocument();
  expect(document.body.textContent).not.toContain("192.168.50.20");
});

test("EN: no advice line when nothing calls for one", async () => {
  localStorage.setItem("u1d.lang", "en");
  ipChanged = false; maxMs = 40;
  mock();
  const orig = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const r = await (orig as (u: string, i?: RequestInit) => Promise<Response>)(url, init);
    if (!url.endsWith("/live/capture")) return r;
    const j = await r.json() as { connectivity: { ws_drops: number } };
    j.connectivity.ws_drops = 0;
    return { ok: true, status: 200, json: async () => j } as Response;
  }));
  await capture();
  expect(screen.getByText("Same as the last capture")).toBeInTheDocument();
  expect(screen.getByText(/Nothing observed calls for network advice/)).toBeInTheDocument();
  expect(screen.queryByText(/DHCP reservation/)).toBeNull();
});

test("FR: the connectivity panel and the Connect screen have no English words", async () => {
  localStorage.setItem("u1d.lang", "fr");
  await capture();
  expect(screen.getByText("NON TESTÉ sur une vraie U1")).toBeInTheDocument();
  expect(screen.getByText(/réservation DHCP/)).toBeInTheDocument();
  expect(screen.getAllByText("1210,5 ms").length).toBeGreaterThan(0);
  const text = (document.body.textContent ?? "").replace(ALLOWED, " ");
  expect([...new Set(text.match(new RegExp(ENGLISH.source, "gi")) ?? [])]).toEqual([]);
});

test("a G-code analysed in the app is sent with the capture (diameters only)", async () => {
  localStorage.setItem("u1d.lang", "en");
  saveGcodeNozzle([0.6]);
  await capture();
  const post = calls.find((c) => c.url.endsWith("/live/capture"));
  expect((post?.body as { gcode_nozzle_mm?: number[] }).gcode_nozzle_mm).toEqual([0.6]);
  expect(screen.getByText(/nozzle diameter \(0.6 mm\) will be compared/)).toBeInTheDocument();
});

test("gcode nozzle helpers read pre-flight checks and refuse bad stored values", () => {
  expect(nozzleFromPreflight([{ id: "nozzle_diameters", params: { diameters: [0.4, 0.6] } }])).toEqual([0.4, 0.6]);
  expect(nozzleFromPreflight([{ id: "nozzle_diameters", params: { diameter: 0.4 } }])).toEqual([0.4]);
  expect(nozzleFromPreflight([{ id: "slicer", params: {} }])).toBeNull();
  sessionStorage.setItem("u1d.gcodeNozzle", JSON.stringify([9]));
  expect(loadGcodeNozzle()).toBeNull();
  saveGcodeNozzle(null);
  expect(loadGcodeNozzle()).toBeNull();
});

for (const lang of ["en", "fr"] as const) {
  test(`${lang.toUpperCase()}: compatibility rows of the new reads and rules carry the UNTESTED label`, async () => {
    localStorage.setItem("u1d.lang", lang);
    render(<App />);
    await go("#/settings");
    const name = lang === "en" ? "Live rules S17-S24" : "Règles en direct S17-S24";
    const cell = await screen.findByText(name);
    const row = cell.closest("tr")!;
    expect(row.textContent).toContain(lang === "en" ? "UNTESTED" : "NON TESTÉ");
    for (const n of lang === "en" ? ["Log partition usage read", "Connectivity self-check"] : ["Lecture de l'occupation de la partition des journaux", "Autodiagnostic de la connexion"]) {
      await waitFor(() => expect(screen.getByText(n).closest("tr")!.textContent).toContain(lang === "en" ? "UNTESTED" : "NON TESTÉ"));
    }
  });
}

test("every live-rule finding title has a French form with its numbers", () => {
  for (const n of ["positive", "normal", "absent"]) for (const f of live(n)) {
    const fr = tx("fr", f.human_title);
    expect(fr).not.toBe(f.human_title);
    expect(fr.startsWith("SYNTHÉTIQUE : ")).toBe(true);
  }
  expect(tx("fr", "Log partition: 5.2 MB free of 104.9 MB (95 % used)")).toBe("Partition des journaux : 5,2 Mo libres sur 104,9 Mo (95 % occupés)");
  expect(tx("fr", "Y offsets of the extruders spread over 2.26 mm (above 2 mm)")).toBe("Les décalages Y des extrudeurs s'étalent sur 2,26 mm (plus de 2 mm)");
  expect(tx("fr", "Controller clock is 4200 s shorter than the host clock during a print")).toContain("4200 s");
  expect(tx("en", "Bed mesh: not observable in this capture")).toBe("Bed mesh: not observable in this capture");
});
