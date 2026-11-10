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
    else if (url.endsWith("/health")) body = { status: "ok", api_version: "1", app_version: "0.1.6-g1", mode: "DEMO", machine_access: "READ_ONLY_ON_CONSENT", db_schema: 1 };
    return { ok: true, status: 200, json: async () => body };
  }));
  return calls;
}

let calls: string[];
beforeEach(() => { calls = mockApi(); location.hash = "#/overview"; localStorage.clear(); localStorage.setItem("u1d.onboarded", "1"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const demoOn = async () => { fireEvent.click(await screen.findByRole("button", { name: /^(demo mode|mode démo)$/i })); };
const go = async (hash: string) => { await act(async () => { location.hash = hash; window.dispatchEvent(new HashChangeEvent("hashchange")); }); };

test("DEMO is unmistakable and no machine/connection action exists", async () => {
  render(<App />);
  expect(await screen.findByText(/No data loaded|Aucune donnée chargée/i)).toBeInTheDocument(); // empty at start: the demo is opt-in
  expect(screen.queryByText("DEMO")).toBeNull();
  await demoOn();
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

test("the dock has the five places of UI V2 and marks the current one, also on the screens reached from it", async () => {
  render(<App />);
  const nav = await screen.findByRole("navigation", { name: /main navigation|navigation principale/i });
  const items = within(nav).getAllByRole("button");
  expect(items.map((b) => b.textContent)).toEqual(["Home", "Diagnose", "I have a problem", "History", "Share"]);
  expect(items.filter((b) => b.getAttribute("aria-current") === "page").map((b) => b.textContent)).toEqual(["Home"]);
  fireEvent.click(within(nav).getByRole("button", { name: "I have a problem" }));
  await waitFor(() => expect(location.hash).toBe("#/symptoms"));
  expect(within(nav).getByRole("button", { name: "I have a problem" })).toHaveAttribute("aria-current", "page");
  location.hash = "#/findings"; // reached from Home: Home stays lit
  await waitFor(() => expect(within(nav).getByRole("button", { name: "Home" })).toHaveAttribute("aria-current", "page"));
  fireEvent.click(screen.getByRole("button", { name: /^(settings|réglages)$/i }));
  await waitFor(() => expect(location.hash).toBe("#/settings"));
  expect(within(nav).queryAllByRole("button").filter((b) => b.getAttribute("aria-current") === "page")).toHaveLength(0);
});

test("the dock is the same in Simple and Expert mode; the Expert switch still toggles and is remembered", async () => {
  render(<App />);
  const nav = await screen.findByRole("navigation", { name: /main navigation|navigation principale/i });
  expect(within(nav).getAllByRole("button")).toHaveLength(5);
  const toggle = screen.getByRole("button", { name: /^(expert mode|mode expert)$/i });
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(within(nav).getAllByRole("button")).toHaveLength(5);
  expect(localStorage.getItem("u1d.mode")).toBe("expert");
});

test("an expert screen stays reachable by direct link in Simple mode", async () => {
  render(<App />);
  await go("#/evidence");
  await demoOn();
  expect((await screen.findAllByText(/Evidence detail|Détail des preuves/)).length).toBeGreaterThan(0);
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
  await demoOn();
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
  await demoOn();
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
  await demoOn();
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
  fireEvent.click((await screen.findAllByRole("button", { name: /real capture|capture réelle/i }))[0]!); // the source selector comes first; the history view below has its own real-capture button
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

test("onboarding: first run shows the 3-step assistant; choices set the mode and start the demo", async () => {
  localStorage.removeItem("u1d.onboarded");
  render(<App />);
  const dlg = await screen.findByRole("dialog");
  expect(within(dlg).getByText(/Step 1 of 3|Étape 1 sur 3/)).toBeInTheDocument();
  fireEvent.click(within(dlg).getByRole("radio", { name: /^Expert/ }));
  fireEvent.click(within(dlg).getByRole("button", { name: /^(Next|Suivant)$/ }));
  expect(within(dlg).getByText(/Step 2 of 3|Étape 2 sur 3/)).toBeInTheDocument();
  fireEvent.click(within(dlg).getByRole("button", { name: /^(Back|Retour)$/ }));
  expect(within(dlg).getByRole("radio", { name: /^Expert/ })).toHaveAttribute("aria-checked", "true");
  fireEvent.click(within(dlg).getByRole("button", { name: /^(Next|Suivant)$/ }));
  fireEvent.click(within(dlg).getByRole("button", { name: /^(Next|Suivant)$/ }));
  expect(within(dlg).getAllByText(/Observed|Observé/).length).toBeGreaterThan(0);
  fireEvent.click(within(dlg).getByRole("button", { name: /^(Start|Commencer)$/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(localStorage.getItem("u1d.onboarded")).toBe("1");
  expect(localStorage.getItem("u1d.mode")).toBe("expert");
  expect(await screen.findAllByText("DEMO")).not.toHaveLength(0);
});

test("onboarding: Escape skips (the default Simple level is kept), and the checklist ticks itself from real use", async () => {
  localStorage.removeItem("u1d.onboarded");
  render(<App />);
  const dlg = await screen.findByRole("dialog");
  fireEvent.keyDown(dlg, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(localStorage.getItem("u1d.mode") ?? "simple").toBe("simple");
  const list = await screen.findByRole("region", { name: /Getting started|Premiers pas/ });
  expect(within(list).getAllByRole("button").filter((b) => b.textContent?.includes("✓"))).toHaveLength(0);
  await demoOn();
  await waitFor(() => expect(within(list).getAllByRole("button").filter((b) => b.textContent?.includes("✓"))).toHaveLength(1));
  fireEvent.click(within(list).getByRole("button", { name: /Hide this list|Masquer cette liste/ }));
  await waitFor(() => expect(screen.queryByRole("region", { name: /Getting started|Premiers pas/ })).toBeNull());
  expect(localStorage.getItem("u1d.checklistHidden")).toBe("1");
});

test("onboarding: Settings can replay it", async () => {
  render(<App />);
  await go("#/settings");
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(await screen.findByRole("button", { name: /Replay the guided start|Rejouer le démarrage guidé/ }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
});

test("Settings shows the app version and a plain link to the releases page, with no request made for it", async () => {
  render(<App />);
  await go("#/settings");
  const link = await screen.findByRole("link", { name: /All releases on GitHub|Toutes les versions sur GitHub/ });
  expect(link).toHaveAttribute("href", "https://github.com/SirStormz/u1-doctor/releases");
  expect(calls.some((c) => /github/i.test(c))).toBe(false);
});

const firstRun = async () => { localStorage.removeItem("u1d.onboarded"); };
const flush = () => act(async () => { await new Promise((x) => setTimeout(x, 40)); });

for (const lang of ["en", "fr"]) {
  test(`a11y (axe, structure/ARIA rules): onboarding dialog, ${lang}`, async () => {
    await firstRun();
    localStorage.setItem("u1d.lang", lang);
    const { container } = render(<App />);
    const dlg = await screen.findByRole("dialog");
    await flush();
    for (let step = 1; step <= 3; step++) {
      const res = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
      expect(res.violations.map((v) => `step ${step} ${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(" | ")}`)).toEqual([]);
      if (step < 3) fireEvent.click(within(dlg).getByRole("button", { name: /^(Next|Suivant)$/ }));
      await flush();
    }
  });
}

test("onboarding: focus starts on the heading, Tab is trapped, the background is inert, focus comes back on close", async () => {
  render(<App />);
  await go("#/settings");
  const replay = await screen.findByRole("button", { name: /Replay the guided start|Rejouer le démarrage guidé/ });
  replay.focus();
  fireEvent.click(replay);
  const dlg = await screen.findByRole("dialog");
  await waitFor(() => expect(document.activeElement).toBe(within(dlg).getByRole("heading", { level: 2 })));
  const overlay = dlg.parentElement!;
  const others = [...overlay.parentElement!.children].filter((el) => el !== overlay);
  expect(others.length).toBeGreaterThan(0);
  for (const el of others) { expect(el).toHaveAttribute("aria-hidden", "true"); expect(el).toHaveAttribute("inert"); }
  const tabbable = [...dlg.querySelectorAll<HTMLElement>("button")].filter((b) => b.tabIndex >= 0);
  const first = tabbable[0]!, last = tabbable[tabbable.length - 1]!;
  last.focus();
  fireEvent.keyDown(last, { key: "Tab" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  for (const el of others) { expect(el).not.toHaveAttribute("aria-hidden", "true"); expect(el).not.toHaveAttribute("inert"); }
  expect(document.activeElement).toBe(replay);
});

test("onboarding: the level radios have one tab stop and follow the arrow keys, Home and End", async () => {
  await firstRun();
  render(<App />);
  const dlg = await screen.findByRole("dialog");
  const simple = within(dlg).getByRole("radio", { name: /^Simple/ });
  const expert = within(dlg).getByRole("radio", { name: /^Expert/ });
  expect([simple.tabIndex, expert.tabIndex]).toEqual([0, -1]);
  simple.focus();
  fireEvent.keyDown(simple, { key: "ArrowDown" });
  expect(expert).toHaveAttribute("aria-checked", "true");
  expect(document.activeElement).toBe(expert);
  expect([simple.tabIndex, expert.tabIndex]).toEqual([-1, 0]);
  fireEvent.keyDown(expert, { key: "ArrowRight" }); // wraps around
  expect(simple).toHaveAttribute("aria-checked", "true");
  fireEvent.keyDown(simple, { key: "End" });
  expect(expert).toHaveAttribute("aria-checked", "true");
  fireEvent.keyDown(expert, { key: "Home" });
  expect(simple).toHaveAttribute("aria-checked", "true");
  fireEvent.keyDown(simple, { key: "ArrowUp" });
  expect(expert).toHaveAttribute("aria-checked", "true");
  fireEvent.keyDown(expert, { key: "ArrowLeft" });
  expect(document.activeElement).toBe(simple);
});

test("onboarding: Escape and Skip keep the level already chosen", async () => {
  await firstRun();
  render(<App />);
  let dlg = await screen.findByRole("dialog");
  fireEvent.click(within(dlg).getByRole("radio", { name: /^Expert/ }));
  fireEvent.keyDown(dlg, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(localStorage.getItem("u1d.mode")).toBe("expert");
  expect(screen.getByRole("button", { name: /^(expert mode|mode expert)$/i })).toHaveAttribute("aria-pressed", "true");
  await go("#/settings");
  fireEvent.click(await screen.findByRole("button", { name: /Replay the guided start|Rejouer le démarrage guidé/ }));
  dlg = await screen.findByRole("dialog");
  fireEvent.click(within(dlg).getByRole("radio", { name: /^Simple/ }));
  fireEvent.click(within(dlg).getByRole("button", { name: /^(Skip|Passer)$/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(localStorage.getItem("u1d.mode")).toBe("simple");
});

test("onboarding: Ctrl+K and Alt+G are off while the dialog is open, back on after", async () => {
  await firstRun();
  render(<App />);
  const dlg = await screen.findByRole("dialog");
  // the overlay is a motion element: "on" shows as soon as its opacity starts rising
  const spiral = () => { const st = (document.querySelector(`svg[aria-label="${messages.en.landing.spiral}"], svg[aria-label="${messages.fr.landing.spiral}"]`) as SVGElement).style; return st.visibility === "visible" || Number(st.opacity || 0) > 0 ? "visible" : "hidden"; };
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  fireEvent.keyDown(window, { key: "g", code: "KeyG", altKey: true });
  await flush();
  expect(screen.getAllByRole("dialog")).toEqual([dlg]);
  expect(spiral()).toBe("hidden");
  fireEvent.keyDown(dlg, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.keyDown(window, { key: "g", code: "KeyG" }); // a bare G is not a shortcut (WCAG 2.1.4)
  await flush();
  expect(spiral()).toBe("hidden");
  fireEvent.keyDown(window, { key: "g", code: "KeyG", altKey: true });
  await flush();
  expect(spiral()).toBe("visible");
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  expect(await screen.findByRole("dialog", { name: /search|recherche|palette/i })).toBeInTheDocument();
});

test("overview: provenance chips of the incident code stay visible in Simple mode (only identifiers fold)", async () => {
  render(<App />);
  await demoOn();
  const prov = await screen.findByTestId("incident-provenance");
  expect(prov.closest("details")).toBeNull();
  expect(within(prov).getByText("USER_REPORTED")).toBeInTheDocument(); // not inside a folded <details> (the page fade-in makes toBeVisible moot in jsdom)
  expect(within(prov).getByText(/SYNTHETIC|SYNTHÉTIQUE/)).toBeInTheDocument();
  const folded = document.querySelector("details")!;
  expect(folded.open).toBe(false);
  expect(within(folded).getByText("0002-0525-0002-0004")).toBeInTheDocument();
});

for (const [label, raw, expected] of [["not JSON", "{oops", "[]"], ["not a list", JSON.stringify({ demo: true }), "[]"], ["a string", JSON.stringify("demo"), "[]"], ["unknown ids", JSON.stringify([42, null, "demo", "nope"]), JSON.stringify(["demo"])]] as const) {
  test(`a corrupted u1d.steps (${label}) does not crash and is reset`, async () => {
    localStorage.setItem("u1d.steps", raw);
    render(<App />);
    expect(await screen.findByRole("region", { name: /Getting started|Premiers pas/ })).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem("u1d.steps")).toBe(expected));
  });
}
