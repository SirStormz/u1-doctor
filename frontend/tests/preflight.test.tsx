import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";
import { PF_FR_KEYS, pfKey, pfView, type PfCheck } from "../src/lib/preflight-text";

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
