import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";
import { messages } from "../src/lib/i18n";
import {
  PRESETS, currentFrom, dueTasks, loadCurrent, loadTasks, markDone, parseTasks, saveCurrent, saveTasks, taskStatus,
  type Current, type MaintenanceInputs, type Task,
} from "../src/lib/maintenance";

/** BACKLOG #65: local maintenance reminders (UNTESTED on a real U1). Network mocked; nothing contacts a printer. */
const ENGLISH = /\b(the|and|of|with|from|not|is|are|due|task|tasks|print|prints|hours|jobs|changes|tool|reminders?|baseline|interval|done|remove|official|read|totals|left|since|untested|settings)\b/i;
const ALLOWED = /(\{\w+\}|U1 Doctor|U1|Snapmaker|Moonraker|switch_count|REAL|UTC|PEI|firmware)/g;

const INPUTS: MaintenanceInputs = {
  history_totals: { total_jobs: 42, total_print_time: 324000, total_filament_used: 987654.3, total_time: 360000 },
  history_status: 200, switch_count: { per_object: { extruder: 10, extruder1: 6 }, total: 16 },
};
const CUR: Current = { print_hours: 90, jobs: 42, tool_changes: 16, filament_m: 987.7, captured_utc: "2026-11-08T10:00:00Z" };
const task = (o: Partial<Task>): Task => ({ id: "t", name: "Task", preset: null, every: {}, baseline: {}, ...o });

let inputs: MaintenanceInputs | undefined = INPUTS;
function mock() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    let body: unknown = {};
    if (url.endsWith("/live/capture")) body = {
      captured_utc: "2026-11-08T10:00:00Z", duration_s: 15, inbound_frames: 40, source_status: "REAL",
      printer: { moonraker_version: "v0.9", api_version: "1.5", klippy_state: "ready", klipper_software_version: "v1", printer_state: "ready", object_count: 40 },
      audit: { http: [], websocket_frames_sent: 1, read_operations: 6, non_read_operations: 0 }, budget: { max_get: 11, max_ws_sent: 1 },
      maintenance_inputs: inputs, observations: [], findings: [], session: null };
    else if (url.endsWith("/api/v1/history")) body = { sessions: [], totals: { sessions: 0, observations: 0 }, limits: { max_sessions: 200, max_observations: 1 } };
    else if (url.endsWith("/compatibility")) body = { verified_on_hardware: true, firmware_target: "V2.1.0", rows: [], capabilities: [{ name: "Job history totals read", status: "UNTESTED" }, { name: "Maintenance reminders", status: "UNTESTED" }] };
    else if (url.includes("/demo/scenarios/")) body = { observations: [], golden_findings: [] };
    else if (url.endsWith("/health")) body = { status: "ok", api_version: "1", app_version: "0.1.7-g1", mode: "DEMO", machine_access: "READ_ONLY_ON_CONSENT", db_schema: 2 };
    return { ok: true, status: 200, json: async () => body } as Response;
  }));
}
beforeEach(() => { inputs = INPUTS; mock(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); location.hash = ""; });
const go = async (hash: string) => { await act(async () => { location.hash = hash; window.dispatchEvent(new HashChangeEvent("hashchange")); }); };

async function capture() {
  render(<App />);
  await go("#/connect");
  const btn = await screen.findByRole("button", { name: /capture \(read-only\)|capturer/i });
  fireEvent.change(screen.getByLabelText(/printer address|adresse/i), { target: { value: "192.168.50.20" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /I own this printer|Cette imprimante est la mienne/i }));
  await act(async () => { fireEvent.click(btn); });
}

// ---- pure computation ---------------------------------------------------------------------------------------------
test("units come from the capture: print hours = seconds / 3600, tool changes = sum of switch_count, missing = not observable", () => {
  expect(currentFrom(INPUTS, "2026-11-08T10:00:00Z")).toEqual(CUR);
  const none = currentFrom({ history_totals: null, history_status: 404, switch_count: null }, "x");
  expect([none.print_hours, none.jobs, none.tool_changes]).toEqual([null, null, null]);
});

test("due exactly when (current - baseline) >= interval, with the numbers left, never a prediction", () => {
  const t = task({ every: { jobs: 5, print_hours: 100 }, baseline: { jobs: 37, print_hours: 20 } });
  const s = taskStatus(t, CUR);
  expect(s.due).toBe(true);
  expect(s.units).toEqual([
    { unit: "print_hours", every: 100, baseline: 20, current: 90, done: 70, left: 30, state: "not_due" },
    { unit: "jobs", every: 5, baseline: 37, current: 42, done: 5, left: 0, state: "due" },
  ]);
  expect(taskStatus(task({ every: { jobs: 5 }, baseline: { jobs: 38 } }), CUR).units[0]!.state).toBe("not_due");
  expect(taskStatus(task({ every: { jobs: 5 } }), CUR).units[0]!.state).toBe("no_baseline");
  expect(taskStatus(task({ every: { jobs: 5 }, baseline: { jobs: 50 } }), CUR).units[0]!.state).toBe("below_baseline");
  expect(taskStatus(task({ every: { tool_changes: 5 }, baseline: { tool_changes: 0 } }), { ...CUR, tool_changes: null }).units[0]!.state).toBe("not_observable");
  expect(taskStatus(t, CUR)).toEqual(taskStatus(t, CUR));
  expect(JSON.stringify(taskStatus(t, CUR))).not.toMatch(/score|probab|predict|rank/i);
});

test("done now moves the baseline of the interval units to the current totals", () => {
  const t = markDone(task({ every: { jobs: 5, tool_changes: 100 }, baseline: { jobs: 1 } }), { ...CUR, tool_changes: null });
  expect(t.baseline).toEqual({ jobs: 42 });
  expect(dueTasks([t], CUR)).toEqual([]);
});

test("presets are official wiki intervals with their page and date, and nothing else", () => {
  expect(PRESETS.map((p) => p.id)).toEqual(["pei_wash", "pogo_clean"]);
  for (const p of PRESETS) {
    expect(p.source.url).toMatch(/^https:\/\/wiki\.snapmaker\.com\/en\//);
    expect(p.source.checked).toBe("2026-11-08");
    expect(Object.keys(p.every).length).toBe(1);
  }
  expect(PRESETS[0]!.every).toEqual({ jobs: 5 });
  expect(PRESETS[1]!.every).toEqual({ tool_changes: 100000 });
  expect(PRESETS[1]!.note.en).toMatch(/not documented officially/);
});

test("stored values are validated and storage failures are survived", () => {
  expect(parseTasks("x")).toEqual([]);
  expect(parseTasks([{ id: "BAD ID", name: "x", every: { jobs: 1 } }, { id: "a", name: " ", every: { jobs: 1 } }, { id: "b", name: "n", every: { jobs: 0 } },
    { id: "c", name: "ok", every: { jobs: 2, print_hours: -1, x: 3 }, baseline: { jobs: "7" }, preset: "nope" }])).toEqual([{ id: "c", name: "ok", preset: null, every: { jobs: 2 }, baseline: {} }]);
  localStorage.setItem("u1d.maint.tasks", "{not json");
  expect(loadTasks()).toEqual([]);
  localStorage.setItem("u1d.maint.current", JSON.stringify({ print_hours: "9", captured_utc: "t" }));
  expect(loadCurrent()).toEqual({ print_hours: null, jobs: null, tool_changes: null, filament_m: null, captured_utc: "t" });
  const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(() => { saveTasks([task({ every: { jobs: 1 } })]); saveCurrent(CUR); }).not.toThrow();
  spy.mockRestore();
});

test("FR and EN texts have the same keys, and the French ones carry no English word", () => {
  expect(Object.keys(messages.fr.mt).sort()).toEqual(Object.keys(messages.en.mt).sort());
  const fr = [...Object.values(messages.fr.mt).flatMap((v) => (typeof v === "string" ? [v] : Object.values(v))), ...PRESETS.flatMap((p) => [p.name.fr, p.note.fr])];
  for (const s of fr) expect([...new Set(s.replace(ALLOWED, " ").match(new RegExp(ENGLISH.source, "gi")) ?? [])], s).toEqual([]);
});

// ---- screens -------------------------------------------------------------------------------------------------------
test("EN: Settings adds a preset, then a capture shows it due in-page and in the on-screen alert", async () => {
  localStorage.setItem("u1d.lang", "en");
  saveTasks([{ ...task({ id: "pei_wash", name: "x", preset: "pei_wash", every: { jobs: 5 }, baseline: { jobs: 30 } }) }]);
  await capture();
  const banner = await screen.findByTestId("capture-alert");
  expect(banner.textContent).toContain("1 maintenance reminder due");
  const due = screen.getByTestId("maintenance-due");
  expect(due.textContent).toContain("Wash the PEI sheet (dish soap)");
  expect(due.textContent).toContain("90 h");
  expect(due.textContent).toMatch(/meaning not documented officially/);
  expect(loadCurrent()).toEqual(CUR);
});

test("EN: a capture without job history says not observable and raises no reminder", async () => {
  localStorage.setItem("u1d.lang", "en");
  inputs = { history_totals: null, history_status: 404, switch_count: null };
  saveTasks([task({ id: "a", name: "Belts", every: { jobs: 1 }, baseline: { jobs: 0 } })]);
  await capture();
  const due = await screen.findByTestId("maintenance-due");
  expect(within(due).getAllByText("not observable").length).toBe(4);
  expect(screen.queryByTestId("capture-alert")).toBeNull();
});

test("EN: Settings panel adds presets and custom tasks, marks one done and removes it", async () => {
  localStorage.setItem("u1d.lang", "en");
  saveCurrent(CUR);
  render(<App />);
  await go("#/settings");
  const panel = await screen.findByTestId("maintenance");
  expect(within(panel).getByTestId("mt-totals").textContent).toContain("42");
  const pei = panel.querySelector('[data-preset="pei_wash"]') as HTMLElement;
  expect(within(pei).getByRole("link").getAttribute("href")).toBe("https://wiki.snapmaker.com/en/snapmaker_u1/PEI_steel_sheet_cleaning");
  fireEvent.click(within(pei).getByRole("button", { name: "Add this task" }));
  expect(within(pei).getByRole("button", { name: "Already in your list" })).toBeDisabled();
  fireEvent.click(within(panel).getByRole("button", { name: "Add the task" }));
  expect(within(panel).getByRole("alert").textContent).toContain("Give a name");
  fireEvent.change(within(panel).getByLabelText("Task name"), { target: { value: "Lubricate the lead screw" } });
  fireEvent.change(panel.querySelector('[data-every="print_hours"]')!, { target: { value: "50" } });
  fireEvent.change(panel.querySelector('[data-baseline="print_hours"]')!, { target: { value: "30,5" } });
  fireEvent.click(within(panel).getByRole("button", { name: "Add the task" }));
  const row = await waitFor(() => panel.querySelector('[data-task="lubricate_the_lead_screw"]') as HTMLElement);
  expect(row.dataset.due).toBe("true");
  expect(row.textContent).toContain("59.5 of 50 since the baseline");
  expect((panel.querySelector('[data-task="pei_wash"] [data-unit="jobs"]') as HTMLElement).dataset.state).toBe("no_baseline");
  fireEvent.click(within(row).getByRole("button", { name: "Done now" }));
  expect((panel.querySelector('[data-task="lubricate_the_lead_screw"]') as HTMLElement).dataset.due).toBe("false");
  expect(loadTasks().find((x) => x.id === "lubricate_the_lead_screw")!.baseline).toEqual({ print_hours: 90 });
  fireEvent.click(within(panel.querySelector('[data-task="lubricate_the_lead_screw"]') as HTMLElement).getByRole("button", { name: "Remove" }));
  expect(loadTasks().map((x) => x.id)).toEqual(["pei_wash"]);
});

test("FR: the Settings panel is French, with no English words", async () => {
  localStorage.setItem("u1d.lang", "fr");
  saveCurrent(CUR);
  saveTasks([task({ id: "pogo_clean", name: "x", preset: "pogo_clean", every: { tool_changes: 100000 }, baseline: { tool_changes: 0 } })]);
  render(<App />);
  await go("#/settings");
  const panel = await screen.findByTestId("maintenance");
  expect(screen.getAllByText("Rappels d'entretien").length).toBeGreaterThan(0);
  expect(panel.textContent).toContain("Nettoyer les contacts dorés des broches pogo");
  const w = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT); const out: string[] = []; while (w.nextNode()) out.push(w.currentNode.textContent ?? "");
  expect([...new Set(out.join(" ").replace(ALLOWED, " ").match(new RegExp(ENGLISH.source, "gi")) ?? [])]).toEqual([]);
  await waitFor(() => expect(screen.getByText("Rappels d'entretien", { selector: "td" }).closest("tr")!.textContent).toContain("NON TESTÉ"));
});
