import fs from "node:fs";
import path from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";
import { keyCode } from "../src/components/keypad";

/** UI V2 signature pieces: they show the session's own data and keep the rules of the controls they dress. */

const FIX = path.resolve(__dirname, "../../fixtures/synthetic");
const NAME = "demo_extrusion_blockage";
const observations = fs.readFileSync(path.join(FIX, `synthetic_${NAME}.observations.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const findings = JSON.parse(fs.readFileSync(path.join(FIX, `synthetic_${NAME}.findings.json`), "utf8"));
const ENTRY = { code: "0002-0525-0002-0004", title: "Extrusion blockage at toolhead 3 drive gear", summary: "x", toolhead: 3, actions: ["clean"] };

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    let body: unknown = {};
    if (url.endsWith("/demo/scenarios")) body = { banner: "x", scenarios: [NAME] };
    else if (url.includes("/demo/scenarios/")) body = { observations, golden_findings: findings };
    else if (url.endsWith("/replays")) body = { matches_golden: true, findings, ruleset_hash: "x", findings_sha256: "y" };
    else if (url.endsWith("/errors/interpret")) body = { catalog_verified_at: "2026-11-05", official_reference: "https://wiki.snapmaker.com/", limits: [], decoding: { status: "KNOWN", classification: "OBSERVED", severity: "warning", entry: ENTRY } };
    else if (url.endsWith("/compatibility")) body = { capabilities: [] };
    else if (url.endsWith("/health")) body = { status: "ok", api_version: "1", app_version: "0.2.0-g1", mode: "DEMO", machine_access: "READ_ONLY_ON_CONSENT", db_schema: 1 };
    else if (url.includes("/real/captures/")) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => body };
  }));
  localStorage.clear();
  localStorage.setItem("u1d.onboarded", "1");
  localStorage.setItem("u1d.lang", "en");
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

test("keypad: digits grouped by four with dashes, at most 16, erase and clear", () => {
  let v = "";
  for (const k of "00020525000200049") v = keyCode(v, k);
  expect(v).toBe("0002-0525-0002-0004");
  expect(keyCode(v, "back")).toBe("0002-0525-0002-000");
  expect(keyCode("0002-05", "back")).toBe("0002-0");
  expect(keyCode(v, "clear")).toBe("");
  expect(keyCode("ab12", "3")).toBe("123");
});

test("keypad types the code into the error-code field", async () => {
  localStorage.setItem("u1d.theme", "pupitre");
  location.hash = "#/explorer";
  render(<App />);
  const keypad = await screen.findByRole("group", { name: "Keypad" });
  for (const k of "00020525") fireEvent.click(keypad.querySelector(`[data-k="${k}"]`)!);
  expect(screen.getByRole("textbox", { name: /error code/i })).toHaveValue("0002-0525");
  fireEvent.click(screen.getByRole("button", { name: "Erase a digit" }));
  expect(screen.getByRole("textbox", { name: /error code/i })).toHaveValue("0002-052");
});

test("Console theme: the approval lever stays locked under its cover until the cover is lifted", async () => {
  localStorage.setItem("u1d.theme", "pupitre");
  location.hash = "#/connect";
  render(<App />);
  const box = await screen.findByRole("checkbox", { name: /I own this printer/ });
  expect(box).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Lift the cover" }));
  expect(box).toBeEnabled();
  expect(screen.getByRole("button", { name: "Close the cover" })).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(box);
  expect(box).toBeChecked();
});

test("other themes: no cover, the approval box is usable at once", async () => {
  localStorage.setItem("u1d.theme", "notice");
  location.hash = "#/connect";
  render(<App />);
  expect(await screen.findByRole("checkbox", { name: /I own this printer/ })).toBeEnabled();
});

test("Expert home: the meters read the replay position, the camera follows the replayed event and rests when paused", async () => {
  localStorage.setItem("u1d.mode", "expert");
  location.hash = "#/overview";
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /^demo mode$/i }));
  await screen.findByRole("table", { name: "Findings" });
  const meters = document.querySelectorAll(".ex-meters .meter");
  expect([...meters].map((m) => m.querySelector(".meter-label")?.textContent)).toEqual(["Nozzle · toolhead 3 · °C", "Bed · °C"]);
  const needle = () => (document.querySelector(".ex-meters .meter-needle") as SVGGElement).style.transform;
  expect(needle()).toBe(`rotate(${-50 + (214.7 / 300) * 100}deg)`);
  expect(document.querySelector(".ex-stage")).not.toHaveAttribute("data-cam");
  vi.useFakeTimers();
  fireEvent.click(screen.getAllByRole("button", { name: "Replay the session" })[0]!);
  expect(document.querySelector(".ex-stage")).toHaveAttribute("data-cam", "screen"); // 14:09:12, the print starts: the screen
  expect(needle()).toBe("rotate(-54deg)"); // no nozzle reading yet: the needle rests below zero
  act(() => { vi.advanceTimersByTime(700); });
  expect(document.querySelector(".ex-stage")).toHaveAttribute("data-cam", "head3"); // 14:09:30, first nozzle reading of toolhead 3
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  expect(document.querySelector(".ex-stage")).not.toHaveAttribute("data-cam");
  expect(document.querySelector(".radar .radar-time")?.textContent).toBe("14:09:30");
});
