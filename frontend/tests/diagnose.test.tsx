import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";

/** UI V2 Diagnose screen: four ways in, one at a time; the capture approval keeps its rules in every theme. */

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    let body: unknown = {};
    if (url.endsWith("/demo/scenarios")) body = { banner: "x", scenarios: [] };
    else if (url.includes("/demo/scenarios/")) body = { observations: [], golden_findings: [] };
    else if (url.endsWith("/replays")) body = { matches_golden: true, findings: [], ruleset_hash: "x", findings_sha256: "y" };
    else if (url.endsWith("/compatibility")) body = { capabilities: [] };
    else if (url.endsWith("/health")) body = { status: "ok", api_version: "1", app_version: "0.2.0-g1", mode: "DEMO", machine_access: "READ_ONLY_ON_CONSENT", db_schema: 1 };
    return { ok: true, status: 200, json: async () => body };
  }));
  localStorage.clear();
  localStorage.setItem("u1d.onboarded", "1");
  localStorage.setItem("u1d.lang", "en");
  location.hash = "#/connect";
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

const hashChange = async () => { await act(async () => { window.dispatchEvent(new HashChangeEvent("hashchange")); }); };

test("the four modes are a radio group; the capture form is the default and each mode shows its own panel", async () => {
  render(<App />);
  expect(await screen.findByRole("heading", { level: 1, name: "How do you want to diagnose?" })).toBeInTheDocument();
  const radios = screen.getAllByRole("radio");
  expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(["capture", "bundle", "logs", "demo"]);
  expect(screen.getByRole("radio", { name: /Connect my U1/ })).toBeChecked();
  expect(screen.getByRole("button", { name: /capture \(read-only\)/i })).toBeDisabled();

  fireEvent.click(screen.getByRole("radio", { name: /Import a bundle/ }));
  await hashChange();
  expect(location.hash).toBe("#/connect/bundle");
  expect(await screen.findByRole("button", { name: "Choose a bundle (.zip)" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /capture \(read-only\)/i })).toBeNull();

  fireEvent.click(screen.getByRole("radio", { name: /Read log files/ }));
  await hashChange();
  expect(await screen.findByTestId("dg-import-logs")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("radio", { name: /See the demo/ }));
  await hashChange();
  fireEvent.click(await screen.findByRole("button", { name: "Turn on demo mode" }));
  expect(await screen.findByText("Demo mode is on")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open the home" })).toBeEnabled();
});

test("Visor theme: a tap does not approve, a 1.2 s hold does; the keyboard approves as usual and a tap withdraws", async () => {
  localStorage.setItem("u1d.theme", "visiere");
  render(<App />);
  const box = await screen.findByRole("checkbox", { name: /I own this printer/ });
  const label = box.closest("label")!;
  expect(box).toHaveAccessibleDescription(/Hold for 1\.2 seconds/);
  fireEvent.click(label, { detail: 1 });
  expect(box).not.toBeChecked();

  vi.useFakeTimers();
  fireEvent.pointerDown(label);
  act(() => { vi.advanceTimersByTime(1199); });
  expect(box).not.toBeChecked();
  act(() => { vi.advanceTimersByTime(2); });
  expect(box).toBeChecked();
  fireEvent.pointerUp(label);
  fireEvent.click(label, { detail: 1 }); // the click that ends the hold does not untick it
  expect(box).toBeChecked();
  vi.useRealTimers();

  fireEvent.click(label, { detail: 1 });
  expect(box).not.toBeChecked();
  fireEvent.click(box, { detail: 0 }); // keyboard (Space) and assistive technologies
  await waitFor(() => expect(box).toBeChecked());
});

test("other themes: one tap on the approval box ticks it", async () => {
  localStorage.setItem("u1d.theme", "obsidienne");
  render(<App />);
  const box = await screen.findByRole("checkbox", { name: /I own this printer/ });
  expect(box).not.toHaveAccessibleDescription(/Hold/);
  fireEvent.click(box, { detail: 1 });
  expect(box).toBeChecked();
});
