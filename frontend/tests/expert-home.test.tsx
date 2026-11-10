import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";

/** UI V2 Expert home: every value comes from the loaded session and the decoded code, nothing from the mockups. */

const FIX = path.resolve(__dirname, "../../fixtures/synthetic");
const NAME = "demo_extrusion_blockage";
const observations = fs.readFileSync(path.join(FIX, `synthetic_${NAME}.observations.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const findings = JSON.parse(fs.readFileSync(path.join(FIX, `synthetic_${NAME}.findings.json`), "utf8"));
const ENTRY = { code: "0002-0525-0002-0004", title: "Extrusion blockage at toolhead 3 drive gear", summary: "Filament extrusion blocked at the drive gear of toolhead 3. Official guidance: check and clean, then retry.", toolhead: 3, actions: ["check_path_obstruction", "clean", "resume_from_screen", "retry"] };

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    let body: unknown = {};
    if (url.endsWith("/demo/scenarios")) body = { banner: "x", scenarios: [NAME] };
    else if (url.includes("/demo/scenarios/")) body = { observations, golden_findings: findings };
    else if (url.endsWith("/replays")) body = { mode: "REPLAY", matches_golden: true, findings, ruleset_hash: "sha256:" + "a".repeat(64), findings_sha256: "b".repeat(64), input_sha256: "c".repeat(64) };
    else if (url.endsWith("/errors/interpret")) body = { source: "USER_REPORTED", catalog_verified_at: "2026-11-05", official_reference: "https://wiki.snapmaker.com/en/snapmaker_u1/troubleshooting/u1_error_codes", limits: [], decoding: { code: ENTRY.code, severity: "warning", module: "filament feeder", status: "KNOWN", classification: "OBSERVED", entry: ENTRY } };
    else if (url.endsWith("/compatibility")) body = { capabilities: [] };
    else if (url.endsWith("/health")) body = { status: "ok", api_version: "1", app_version: "0.2.0-g1", mode: "DEMO", machine_access: "READ_ONLY_ON_CONSENT", db_schema: 1 };
    else if (url.includes("/real/captures/")) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => body };
  }));
  localStorage.clear();
  localStorage.setItem("u1d.onboarded", "1");
  localStorage.setItem("u1d.mode", "expert");
  location.hash = "#/overview";
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const demoOn = async () => { fireEvent.click(await screen.findByRole("button", { name: /^(demo mode|mode démo)$/i })); };

test("Expert home (EN): incident, facts, readings, curve and findings all come from the session", async () => {
  localStorage.setItem("u1d.lang", "en");
  render(<App />);
  await demoOn();
  expect(await screen.findByRole("heading", { level: 1, name: "Extrusion blockage at toolhead 3 drive gear" })).toBeInTheDocument();
  expect(screen.getByTestId("ex-code")).toHaveTextContent("0002-0525-0002-0004");
  expect(screen.getByText(/4 findings: 2 observed · 2 not enough data\./)).toBeInTheDocument();
  expect(screen.getByText(/Evidence: 6 for · 0 against · 4 missing\./)).toBeInTheDocument();
  expect(screen.getByText("U1-S01-CODE-DECODE")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Official code table, checked 2026-11-05" })).toHaveAttribute("href", expect.stringContaining("wiki.snapmaker.com"));
  expect(screen.getByText("5 min 08 s")).toBeInTheDocument();
  expect(screen.getByText("5 reads + 1 subscription · 0 writes")).toBeInTheDocument();

  // readings at the replay position: the last one by default, then the first moment of the session
  const list = () => document.querySelector(".ex-readings") as HTMLElement;
  expect(within(list()).getByText(/214\.7 °C/)).toBeInTheDocument();
  expect(within(list()).getByText(/Paused/)).toBeInTheDocument();
  expect(within(list()).getByText(/59\.9 °C/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole("slider", { name: "Replay position" }), { target: { value: "0" } });
  await waitFor(() => expect(within(list()).getByText(/Printing/)).toBeInTheDocument());
  expect(within(list()).getAllByText(/no reading yet/)).toHaveLength(2); // no nozzle nor bed sample at 14:09:12

  expect(screen.getByRole("img", { name: /Nozzle temperature of toolhead 3, 214 to 221 °C, readings from 14:09:30 to 14:14:00 UTC\. No data from 14:12:00 to 14:13:30 UTC\./ })).toBeInTheDocument();
  const rows = within(screen.getByRole("table", { name: "Findings" })).getAllByRole("row").slice(1);
  expect(rows.map((r) => r.querySelector("td")?.textContent)).toEqual(["S01", "S03", "S09", "S10"]);
  expect(rows.map((r) => r.querySelector(".ex-status")?.textContent)).toEqual(["Observed", "Observed", "Not enough data", "Not enough data"]);
});

test("Expert home (FR): the same page in French, without English words", async () => {
  localStorage.setItem("u1d.lang", "fr");
  render(<App />);
  await demoOn();
  await screen.findByRole("table", { name: "Conclusions" });
  expect(screen.getByText(/4 constats : 2 constatés · 2 pas assez d'infos\./)).toBeInTheDocument();
  expect(within(document.querySelector(".ex-readings") as HTMLElement).getByText(/214,7 °C/)).toBeInTheDocument();
  const text = (document.querySelector(".ex") as HTMLElement).textContent!.replace(/(U1-[A-Z0-9-]+|UTC|U1 Doctor|U1-DEB|SHA-256)/g, " ");
  expect(text).not.toMatch(/\b(the|and|of|with|from|toolhead|observed|official|reads|subscription|writes|findings?|replay|evidence|gap|nozzle|bed|state)\b/i);
});

test("Expert home without data says so and invents nothing", async () => {
  localStorage.setItem("u1d.lang", "en");
  render(<App />);
  expect(await screen.findByRole("heading", { level: 1, name: "Nothing to show yet." })).toBeInTheDocument();
  expect(document.querySelector(".ex")).toBeNull();
  expect(screen.queryByText("0002-0525-0002-0004")).toBeNull();
});
