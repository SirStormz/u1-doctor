import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";

const CODE = "0003-0529-0000-0001";
const KI = {
  version: "0.1.0", source_url: "https://wiki.snapmaker.com/en/snapmaker_u1/troubleshooting/known_issues_and_quick_fixes", checked_at: "2026-11-06",
  issues: [
    { id: "KI-A", component: "Toolhead", applies: {}, title: { en: "Nozzle clog", fr: "Buse bouchée" }, symptom: { en: "s1", fr: "s1" }, cause: { en: "c1", fr: "c1" }, fix: { en: "f1", fr: "f1" } },
    { id: "KI-B", component: "Snapmaker Orca", applies: { code: CODE }, title: { en: "Decimal commas", fr: "Virgules décimales" }, symptom: { en: "s2", fr: "s2" }, cause: { en: "c2", fr: "c2" }, fix: { en: "f2", fr: "f2" } },
  ],
};
const INTERPRET = { decoding: { status: "KNOWN", classification: "OBSERVED", severity: "error", module: "gcode", code: CODE, entry: { title: "G-code parsing failed", summary: "s" } }, official_reference: "https://wiki.snapmaker.com/", catalog_version: "x", catalog_verified_at: "2026-11-06", limits: [] };

beforeEach(() => {
  location.hash = `#/explorer/${CODE}`;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => (String(url).includes("/known-issues") ? KI : String(url).includes("/support/") ? { code: CODE, status: "KNOWN", items: [], notes: [], ticket: { title: "t", url: "https://x.y/" } } : INTERPRET) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("the known issue matching the decoded code is listed first and flagged", async () => {
  render(<App />);
  const list = await screen.findByTestId("known-issues");
  await waitFor(() => expect(list.querySelectorAll("li").length).toBe(2));
  const items = list.querySelectorAll("li");
  expect(items[0]!.getAttribute("data-match")).toBe("true");
  expect(within(items[0] as HTMLElement).getByText("Decimal commas")).toBeTruthy();
  expect(items[1]!.getAttribute("data-match")).toBe("false");
  expect(screen.getByText(/Advice only/)).toBeTruthy();
});
