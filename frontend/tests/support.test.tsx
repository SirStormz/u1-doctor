import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";
import { SUPPORT_FR_IDS, buildRequest, supText, type SupportOut } from "../src/lib/support-text";

const BACKEND_IDS = ["error_code", "video_error", "logs", "gcode_file", "serial_number", "photo_runout_cable", "order_number", "photos_per_toolhead", "error_count", "swap_video", "troubleshooting_results", "firmware_version", "u1_deb"];

const SUP: SupportOut = {
  code: "0002-0528-0000-0000", status: "KNOWN", title: "Homing Anomaly", firmware: "1.5.2",
  items: [
    { id: "error_code", text: "The exact error code shown on the printer screen.", source: "wiki" },
    { id: "video_error", text: "A video showing the error.", source: "wiki" },
    { id: "logs", text: "The exported machine log files (they are encrypted: only support can read them).", source: "wiki" },
    { id: "firmware_version", text: "Your firmware version (Settings > About), so release-note facts can be compared.", source: "suggested" },
  ],
  article: null, ticket: { title: "Official support request form", url: "https://snapmaker.formcrafts.com/u1-troubleshooting-request" },
  notes: ["Serial numbers, order numbers and logs are for official support only: do not post them publicly."],
};
const INTERPRET = { decoding: { status: "KNOWN", classification: "OBSERVED", severity: "warning", module: "homing", code: SUP.code, entry: { title: "Homing Anomaly", summary: "s" } }, official_reference: "https://wiki.snapmaker.com/", catalog_verified_at: "2026-11-06", limits: [] };

test("every backend ask id has a French text", () => {
  expect([...SUPPORT_FR_IDS].sort()).toEqual([...BACKEND_IDS].sort());
  for (const id of BACKEND_IDS) expect(supText("fr", { id, text: "EN", source: "wiki" })).not.toBe("EN");
});

test("request text lists only what was ticked and never the firmware item twice", () => {
  const txt = buildRequest("en", SUP, new Set(["video_error", "firmware_version", "error_code"]), "Homing Anomaly");
  expect(txt).toBe("Error code : 0002-0528-0000-0000 (Homing Anomaly)\nFirmware : 1.5.2\nI am attaching:\n- A video showing the error.");
  expect(buildRequest("fr", { ...SUP, firmware: null }, new Set(), null)).toBe("Code d'erreur : 0002-0528-0000-0000");
});

beforeEach(() => {
  location.hash = "#/explorer/0002-0528-0000-0000";
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => (String(url).includes("/support/checklist") ? SUP : INTERPRET) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("checklist renders with wiki/suggested labels, ticking works and copy sends the request text", async () => {
  const write = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText: write }, configurable: true });
  render(<App />);
  const box = await screen.findByTestId("support-list");
  expect(box.textContent).toMatch(/Asked by the wiki/);
  expect(box.textContent).toMatch(/Suggested/);
  const video = screen.getByLabelText(/A video showing the error/) as HTMLInputElement;
  expect(video.checked).toBe(false);
  fireEvent.click(video);
  expect(video.checked).toBe(true);
  fireEvent.click(screen.getByText("Copy request text"));
  await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
  expect((write.mock.calls[0] as unknown as [string])[0]).toContain("- A video showing the error.");
  const form = screen.getByText("Open the official support form").closest("a") as HTMLAnchorElement;
  expect(form.href).toBe("https://snapmaker.formcrafts.com/u1-troubleshooting-request");
});
