import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";

const issue = (o: Record<string, unknown>) => ({
  type: "bug", fixed_in: null, origin: "COMMUNITY_REPORT", staff_confirmed: false, codes: [],
  symptom: { en: "Symptom EN", fr: "Symptôme FR" }, scope: { en: "Scope EN", fr: "Portée FR" },
  sources: [{ url: "https://forum.snapmaker.com/t/1", title: "Topic", posted: "2026-11-04" }], ...o,
});
const ALL = {
  version: "0.1.0", checked_at: "2026-11-08", note: "n", versions: [{ version: "1.5.1", date: "2026-07-03" }, { version: "2.1.0", date: "2026-11-04" }],
  issues: [
    issue({ id: "FW-A", affected: { min: "1.5.0", max: "1.5.1" }, fixed_in: "1.5.2", origin: "OFFICIAL_RELEASE_NOTE", staff_confirmed: true, symptom: { en: "First layer squished", fr: "Première couche écrasée" } }),
    issue({ id: "FW-B", affected: { min: "2.1.0", max: "2.1.0" }, symptom: { en: "Black screen", fr: "Écran noir" } }),
  ],
};

beforeEach(() => {
  location.hash = "#/explorer";
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/firmware-issues?version=2.1.0")) return { ok: true, status: 200, json: async () => ({ ...ALL, issues: [ALL.issues[1]], filter: "2.1.0" }) };
    if (u.includes("/firmware-issues?version=1.5.1")) return { ok: true, status: 200, json: async () => ({ ...ALL, issues: [], filter: "1.5.1" }) };
    if (u.includes("/firmware-issues")) return { ok: true, status: 200, json: async () => ALL };
    return { ok: true, status: 200, json: async () => ({}) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("lists every entry with its date notice, origin and fixed-in, then filters by version", async () => {
  render(<App />);
  const list = await screen.findByTestId("fw-issues");
  expect(list.querySelectorAll("li")).toHaveLength(2);
  expect(screen.getByTestId("fwi-stale").textContent).toBe("May be out of date: checked 2026-11-08.");
  const first = list.querySelectorAll("li")[0] as HTMLElement;
  expect(first.dataset.origin).toBe("OFFICIAL_RELEASE_NOTE");
  expect(within(first).getByText("Fixed in 1.5.2")).toBeTruthy();
  expect(within(first).getByText("Affected 1.5.0 – 1.5.1")).toBeTruthy();
  expect(within(list.querySelectorAll("li")[1] as HTMLElement).getByText("Reported by the community")).toBeTruthy();
  fireEvent.change(screen.getByTestId("fwi-filter"), { target: { value: "2.1.0" } });
  await waitFor(() => expect(screen.getByTestId("fw-issues").querySelectorAll("li")).toHaveLength(1));
  expect(screen.getByText("Black screen")).toBeTruthy();
  fireEvent.change(screen.getByTestId("fwi-filter"), { target: { value: "1.5.1" } });
  await waitFor(() => expect(screen.getByText(/No entry for this version/)).toBeTruthy());
});
