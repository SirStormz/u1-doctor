import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";
import { messages } from "../src/lib/i18n";

beforeEach(() => {
  location.hash = "";
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("bare URL shows the cinematic landing with the tagline, in EN and FR", async () => {
  render(<App />);
  expect(await screen.findByRole("heading", { level: 1, name: messages.en.landing.title })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "FR" }));
  expect(await screen.findByRole("heading", { level: 1, name: messages.fr.landing.title })).toBeInTheDocument();
});

test("landing: no percentage, no health/confidence claim, DEMO + read-only stated", async () => {
  render(<App />);
  await screen.findByRole("heading", { level: 1 });
  const text = document.body.textContent ?? "";
  expect(text).not.toMatch(/\d\s?%/);
  expect(text).not.toMatch(/\b(health|confidence|santé|confiance)\b/i);
  expect(text).toMatch(/DEMO/);
  expect(text).toMatch(/Read-only/i);
});

test("landing: the call to action opens the app on the Overview screen", async () => {
  render(<App />);
  const [cta] = await screen.findAllByRole("button", { name: new RegExp(messages.en.landing.enter, "i") });
  await act(async () => { fireEvent.click(cta!); });
  expect(location.hash).toBe("#/overview");
});

test("landing: G toggles the golden construction overlay", async () => {
  render(<App />);
  await screen.findByRole("heading", { level: 1 });
  const btn = screen.getByRole("button", { name: new RegExp(messages.en.landing.spiral, "i") });
  expect(btn).toHaveAttribute("aria-pressed", "false");
  await act(async () => { fireEvent.keyDown(window, { key: "g" }); });
  expect(btn).toHaveAttribute("aria-pressed", "true");
});

test("a11y (axe, structure/ARIA rules): landing", async () => {
  const { container } = render(<App />);
  await screen.findByRole("heading", { level: 1 });
  await act(async () => { await new Promise((x) => setTimeout(x, 80)); });
  const res = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
  expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 80)).join(" | ")}`)).toEqual([]);
});

test("interactive landing: guided tour bar, six chapter buttons and the scene controls", async () => {
  render(<App />);
  await screen.findByRole("heading", { level: 1 });
  const bar = screen.getByRole("group", { name: messages.en.landing.ctlTour });
  expect(within(bar).getByRole("button", { name: new RegExp(messages.en.landing.ctlPlay, "i") })).toBeInTheDocument();
  expect(within(screen.getByRole("group", { name: messages.en.landing.ctlChapter })).getAllByRole("button")).toHaveLength(6);
});

test("interactive landing: the incident slider drives the fact card", async () => {
  render(<App />);
  const slider = await screen.findByRole("slider", { name: messages.en.landing.timeLabel });
  expect(screen.getByText(messages.en.landing.factText)).toBeInTheDocument();
  await act(async () => { fireEvent.change(slider, { target: { value: "0" } }); });
  expect(screen.getByText(messages.en.landing.factPrinting)).toBeInTheDocument();
});

test("interactive landing: the code simulator reports a stopped local service instead of failing silently", async () => {
  render(<App />);
  const input = await screen.findByLabelText(messages.en.landing.simTitle);
  await act(async () => { fireEvent.change(input, { target: { value: "0002-0525-0002-0004" } }); fireEvent.submit(input.closest("form")!); });
  expect(await screen.findByRole("alert")).toHaveTextContent(messages.en.landing.simFail);
});
