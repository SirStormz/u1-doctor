import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { TechDetails } from "../src/components/ui";
import { PrefsProvider, usePrefs } from "../src/lib/prefs";

function Harness() {
  const { mode, setMode } = usePrefs();
  return (
    <>
      <button type="button" onClick={() => setMode(mode === "expert" ? "simple" : "expert")}>switch</button>
      <TechDetails><p>rule U1-X v1</p></TechDetails>
    </>
  );
}
const details = () => document.querySelector("details")!;
afterEach(() => { cleanup(); localStorage.clear(); });

test("TechDetails: closed in Simple mode", () => {
  localStorage.setItem("u1d.mode", "simple");
  render(<PrefsProvider><Harness /></PrefsProvider>);
  expect(details().open).toBe(false);
  expect(screen.getByText(/Technical details|Détails techniques/)).toBeInTheDocument();
});

test("TechDetails: open in Expert mode", () => {
  localStorage.setItem("u1d.mode", "expert");
  render(<PrefsProvider><Harness /></PrefsProvider>);
  expect(details().open).toBe(true);
});

test("TechDetails: re-keyed on a mode change, so the default wins over a manual toggle", async () => {
  localStorage.setItem("u1d.mode", "simple");
  render(<PrefsProvider><Harness /></PrefsProvider>);
  const first = details();
  first.open = true; // the reader unfolds it by hand in Simple mode
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "switch" })); });
  expect(details()).not.toBe(first); // a fresh element: no stale open/closed state survives
  expect(details().open).toBe(true);
  details().open = false; // folded by hand in Expert mode
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "switch" })); });
  expect(details().open).toBe(false);
});
