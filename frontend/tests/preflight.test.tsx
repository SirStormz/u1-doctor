import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";
import { PF_FR_KEYS, pfKey, pfLimit, pfView, type PfCheck } from "../src/lib/preflight-text";

const check = (o: Partial<PfCheck>): PfCheck => ({ id: "x", status: "PASS", title: "T", detail: "D", evidence: { lines: [], count: 0 }, code: null, code_title: null, reference: { title: "R", url: "https://wiki.snapmaker.com/en/x" }, params: {}, ...o });

const CASES: PfCheck[] = [
  check({ id: "decimal_comma", status: "FAIL", params: { old_orca: true } }), check({ id: "decimal_comma", status: "PASS" }),
  check({ id: "m28_m30", status: "FAIL" }), check({ id: "m28_m30", status: "PASS" }),
  check({ id: "unknown_toolhead", status: "FAIL", params: { tools: [4] } }), check({ id: "unknown_toolhead", status: "PASS", params: { tools: [0, 1] } }), check({ id: "unknown_toolhead", status: "PASS", params: { tools: [] } }),
  check({ id: "nozzle_temp_range", status: "FAIL" }), check({ id: "nozzle_temp_range", status: "PASS" }),
  check({ id: "bed_temp_range", status: "FAIL" }), check({ id: "bed_temp_range", status: "WARN" }), check({ id: "bed_temp_range", status: "PASS" }),
  check({ id: "bed_zero", status: "WARN" }), check({ id: "bed_zero", status: "PASS" }),
  check({ id: "homing_first", status: "UNKNOWN" }), check({ id: "homing_first", status: "WARN" }), check({ id: "homing_first", status: "PASS" }), check({ id: "homing_first", status: "INFO" }),
  check({ id: "nozzle_diameters", status: "WARN", params: { v: "mixed", diameters: [0.4, 0.6] } }), check({ id: "nozzle_diameters", status: "WARN", params: { v: "unsupported", diameter: 1 } }),
  check({ id: "nozzle_diameters", status: "INFO", params: { v: "declared", diameter: 0.4 } }), check({ id: "nozzle_diameters", status: "UNKNOWN" }),
  check({ id: "filament_x", status: "PASS" }).id ? check({ id: "filename_hash", status: "WARN" }) : check({}), check({ id: "filename_hash", status: "PASS" }), check({ id: "filename_hash", status: "UNKNOWN" }),
  check({ id: "slicer", status: "INFO", params: { orca: true, name: "SnapmakerOrca", version: "2.2.1" } }), check({ id: "slicer", status: "INFO", params: { orca: false, name: "Cura", version: "5.0.0" } }), check({ id: "slicer", status: "UNKNOWN" }),
  // checks 11-20 (#58)
  check({ id: "m191_chamber_wait", status: "WARN" }), check({ id: "m191_chamber_wait", status: "PASS" }),
  check({ id: "start_line_y_edge", status: "WARN", params: { n: 2 } }), check({ id: "start_line_y_edge", status: "PASS" }),
  check({ id: "probe_temperature", status: "INFO", params: { v: "lower", probe: 130, print: 220 } }), check({ id: "probe_temperature", status: "INFO", params: { v: "single", print: 220 } }), check({ id: "probe_temperature", status: "UNKNOWN" }),
  check({ id: "tool_mapping", status: "WARN", params: { tools: [3], filaments: 2 } }), check({ id: "tool_mapping", status: "INFO", params: { order: ["T0", "T1"], more: false, selections: 2, tools: [0, 1] } }), check({ id: "tool_mapping", status: "PASS" }),
  check({ id: "foreign_profile", status: "WARN", params: { dwells: 2, dwell_max: 9, commands: ["M620"], model: "Bambu Lab X1", bambu: true } }), check({ id: "foreign_profile", status: "PASS" }),
  check({ id: "prime_tower_bounds", status: "WARN", params: { v: "outside", reach: { x_max: 272 }, bed: [0, 270, 0, 270] } }), check({ id: "prime_tower_bounds", status: "PASS", params: { v: "inside", bed: [0, 270, 0, 270] } }), check({ id: "prime_tower_bounds", status: "PASS", params: { v: "none", bed: [0, 270, 0, 270] } }),
  check({ id: "colour_block", status: "WARN" }), check({ id: "colour_block", status: "PASS", params: { v: "declared" } }), check({ id: "colour_block", status: "PASS", params: { v: "single" } }),
  check({ id: "tpu_profile", status: "INFO", params: { slots: [2], retraction: [3], retraction_speed: [40], mvs: [3.6] } }), check({ id: "tpu_profile", status: "UNKNOWN", params: { slots: [1] } }), check({ id: "tpu_profile", status: "PASS" }),
  check({ id: "purge_summary", status: "INFO", params: { v: "no_change" } }), check({ id: "purge_summary", status: "INFO", params: { v: "derived", changes: 2, blocks: 2, mm: 14, mm3: 34, per_block: 17 } }), check({ id: "purge_summary", status: "INFO", params: { v: "not_derivable", changes: 2 } }),
  check({ id: "last_move_scar", status: "INFO", params: { v: "low", z: 0.4, part_z: 0.4 } }), check({ id: "last_move_scar", status: "PASS", params: { v: "lifted", z: 3.65, part_z: 3.05 } }), check({ id: "last_move_scar", status: "PASS", params: { v: "none" } }),
];

test("every backend check has a French form and English stays untouched", () => {
  for (const c of CASES) {
    expect(PF_FR_KEYS, pfKey(c)).toContain(pfKey(c));
    expect(pfView("en", c)).toEqual({ title: "T", detail: "D" });
    const fr = pfView("fr", c);
    expect(fr.title).not.toBe("T");
    expect(fr.detail).not.toBe("D");
  }
  expect(new Set(CASES.map(pfKey)).size).toBe(PF_FR_KEYS.length);
});

const REPORT = {
  file: { bytes: 99, lines: 7, name_provided: true }, slicer: { name: "SnapmakerOrca", version: "2.1.1" },
  checks: [check({ id: "decimal_comma", status: "FAIL", title: "Decimal commas in motion or temperature commands", evidence: { lines: [4], count: 1 }, code: "0003-0529-0000-0001", params: { old_orca: true } }), check({ id: "m28_m30", status: "PASS" })],
  summary: { FAIL: 1, WARN: 0, PASS: 1, INFO: 0, UNKNOWN: 0 }, limits: ["Static text checks, not a simulation: U1 Dry Run simulates the firmware."],
};

beforeEach(() => {
  location.hash = "#/explorer";
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("/preflight/gcode") ? { ok: true, status: 200, json: async () => REPORT } : { ok: true, status: 200, json: async () => ({}) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("uploading a file shows failures first and a clickable catalog code", async () => {
  render(<App />);
  const input = await screen.findByLabelText(/Choose a G-code file/i);
  fireEvent.change(input, { target: { files: [new File(["G28\n"], "part.gcode", { type: "text/plain" })] } });
  await waitFor(() => expect(screen.getByText("Decimal commas in motion or temperature commands")).toBeTruthy());
  expect(screen.getByText(/0003-0529-0000-0001 · Decode this code/)).toBeTruthy();
  const calls = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls.filter((c) => String(c[0]).includes("preflight"));
  expect(calls).toHaveLength(1);
  expect(calls[0]![0]).toContain("name=part.gcode");
  expect(calls[0]![1].method).toBe("POST");
});

test("firmware notes show BEFORE / INCLUDED chips and send the stated version", async () => {
  const note = { component: "firmware", version: "1.4.0", kind: "mitigated", text: "Firmware 1.4.0 reduced MCU control timeout errors.", source: "https://wiki.snapmaker.com/en/snapmaker_u1/firmware/release_notes/v140", applies: "BEFORE" };
  const out = { decoding: { status: "KNOWN", classification: "OBSERVED", severity: "error", module: "motion control", code: "0003-0522-0001-0016", entry: { title: "Mainboard MCU: System Anomaly", summary: "s" }, firmware: { given: "1.3.0", valid: true, latest: { version: "2.1.0", date: "2026-11-04", source: "x" }, behind_latest: true, notes: [note] } }, official_reference: "https://wiki.snapmaker.com/", catalog_verified_at: "2026-11-06", limits: [] };
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => out })));
  location.hash = "#/explorer/0003-0522-0001-0016";
  render(<App />);
  await waitFor(() => expect(screen.getByTestId("fw-notes")).toBeTruthy());
  expect(screen.getByText(/updating may help/i)).toBeTruthy();
  expect(screen.getByText(/Latest firmware on the wiki: 2.1.0/)).toBeTruthy();
  expect(screen.getByText(/Your version is older than the latest/)).toBeTruthy();
});

test("dock hint highlights the slots named by the official row", async () => {
  const out = { decoding: { status: "KNOWN", classification: "OBSERVED", severity: "warning", module: "toolhead", code: "0002-0523-0003-0024", entry: { title: "Toolhead 4: Picking Failure", summary: "s", toolhead: 4, inspect_toolheads: [1, 2], inspect_scope: "listed" } }, official_reference: "https://wiki.snapmaker.com/", catalog_verified_at: "2026-11-06", limits: [] };
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => out })));
  location.hash = "#/explorer/0002-0523-0003-0024";
  render(<App />);
  const box = await screen.findByTestId("dock-hint");
  const slot = (n: number) => box.querySelector(`[data-slot="${n}"]`) as HTMLElement;
  expect([1, 2, 3, 4].map((n) => slot(n).dataset.inspect)).toEqual(["true", "true", "false", "false"]);
  expect(slot(4).dataset.reported).toBe("true");
  expect(box.textContent).toMatch(/names these toolheads/);
});

test("French values use a decimal comma and keep the numbers", () => {
  const fr = pfView("fr", check({ id: "tpu_profile", status: "INFO", params: { slots: [2], retraction: [0.8, null], retraction_speed: [40], mvs: [3.6] } }));
  expect(fr.detail).toContain("0,8 ; ?");
  expect(fr.detail).toContain("3,6 mm³/s");
  expect(pfView("fr", check({ id: "prime_tower_bounds", status: "WARN", params: { v: "outside", reach: { x_max: 272.5 }, bed: [0, 270, 0, 270] } })).detail).toContain("X max 272,5");
});

test("new limit lines have a French form", () => {
  for (const l of ["Checks marked as reported by the community come from public forum topics (checked 2026-11-08): they are not official.", "Several checks read the slicer's comment lines; a file without them gives fewer results."]) {
    expect(pfLimit("fr", l)).not.toBe(l);
  }
});

test("a 3MF goes to the 3MF route and community checks show their date and sources", async () => {
  const rep = {
    ...REPORT, source: { kind: "3mf", entry: "Metadata/plate_1.gcode", plates: 2, settings: true },
    checks: [check({ id: "m191_chamber_wait", status: "WARN", title: "M191 (wait for chamber temperature) is used", reference: { title: "Waiting for Chamber Temperature", url: "https://forum.snapmaker.com/t/41689" },
      community: { kind: "COMMUNITY_REPORT", checked: "2026-11-08", sources: [{ url: "https://forum.snapmaker.com/t/41689", title: "Waiting for Chamber Temperature" }, { url: "https://forum.snapmaker.com/t/41736", title: "[Feature Request] Implement G-Code M191" }] } })],
  };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("/preflight/3mf") ? { ok: true, status: 200, json: async () => rep } : { ok: true, status: 200, json: async () => ({}) })));
  render(<App />);
  const input = await screen.findByLabelText(/Choose a G-code file/i);
  fireEvent.change(input, { target: { files: [new File(["PK"], "project.3mf")] } });
  await waitFor(() => expect(screen.getByText("M191 (wait for chamber temperature) is used")).toBeTruthy());
  const calls = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls.filter((c) => String(c[0]).includes("preflight"));
  expect(calls[0]![0]).toContain("/api/v1/preflight/3mf?name=project.3mf");
  expect((calls[0]![1].headers as Record<string, string>)["content-type"]).toBe("application/zip");
  expect(screen.getByTestId("pf-3mf").textContent).toContain("Metadata/plate_1.gcode");
  const com = screen.getByTestId("pf-community");
  expect(com.textContent).toContain("Reported by the community · checked 2026-11-08");
  expect(com.querySelectorAll("a")).toHaveLength(1); // the first source is already the reference link
});

test("a 3MF without sliced G-code is refused with a translated message", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("/preflight/3mf") ? { ok: false, status: 422, json: async () => ({ detail: { code: "NO_GCODE" } }) } : { ok: true, status: 200, json: async () => ({}) })));
  render(<App />);
  const input = await screen.findByLabelText(/Choose a G-code file/i);
  fireEvent.change(input, { target: { files: [new File(["PK"], "model.3mf")] } });
  await waitFor(() => expect(screen.getByText(/U1 Doctor does not slice/)).toBeTruthy());
});
