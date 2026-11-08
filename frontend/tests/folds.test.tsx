import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";

const FIX = path.resolve(__dirname, "../../fixtures/synthetic");
const NAME = "demo_extrusion_blockage";
const observations = fs.readFileSync(path.join(FIX, `synthetic_${NAME}.observations.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const findings = JSON.parse(fs.readFileSync(path.join(FIX, `synthetic_${NAME}.findings.json`), "utf8"));

/** BACKLOG #51 (b): technical blocks of Print quality, Error codes and Report fold under "Technical details" in Simple, open in Expert. */
const CAT = {
  version: "0.1.0", checked_at: "2026-11-07", wiki_base: "https://wiki.snapmaker.com/en/", note: "n", materials: {},
  fields: { numeric: { mesh_range: [0, 10] }, choices: {} },
  symptoms: [{ id: "first-layer-gaps", page: "p", title: { en: "Wrinkles or gaps in the first layer", fr: "Plis ou trous dans la première couche" }, eyes: { en: "Look at the first layer.", fr: "Regardez la première couche." }, ask: ["mesh_range"], cause_count: 1 }],
};
const RESULT = {
  symptom: { ...CAT.symptoms[0], url: "https://wiki.snapmaker.com/en/p" }, answers: {}, observed: { bed: null, nozzle: null }, catalog_checked_at: "2026-11-07", notes: [],
  causes: [{ id: "fl-mesh", eyes: true, lean: "FOR", text: { en: "Bed flatness.", fr: "Planéité du plateau." }, evidence: [{ direction: "for", source: "USER_REPORTED", text: { en: "Your mesh RANGE of 0.9 mm is above the wiki's 0.8 mm.", fr: "Votre RANGE de 0,9 mm dépasse les 0,8 mm du wiki." } }] }],
};
const CODE = "0002-0525-0002-0004";
const INTERPRET = {
  source: "USER_REPORTED", catalog_version: "0.2.0", catalog_verified_at: "2026-11-05", official_reference: "https://wiki.snapmaker.com/en/snapmaker_u1/troubleshooting/u1_error_codes", limits: [],
  decoding: { code: CODE, level: "0002", severity: "warning", module_code: "0525", module: "filament feeder", index: "0002", number: "0004", status: "KNOWN", classification: "OBSERVED", entry: { code: CODE, title: "Extrusion blockage at toolhead 3 drive gear", summary: "Filament extrusion blocked at the drive gear of toolhead 3.", toolhead: 3 } },
  community: { checked_at: "2026-11-06", causes: [{ id: "c1", codes: [CODE], reported_as: [CODE], cause: { en: "A worn gear.", fr: "Un engrenage usé." }, check: [{ en: "Look at the gear.", fr: "Regardez l'engrenage." }], scope: { en: "One owner.", fr: "Un propriétaire." }, sources: [{ url: "https://forum.snapmaker.com/t/x/123", posted: "2026-10-01" }] }] },
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("u1d.onboarded", "1");
  localStorage.setItem("u1d.hints", JSON.stringify(["marks", "timeline", "palette"])); // keep the page free of hints here
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const u = String(url);
    let body: unknown = {};
    if (u.endsWith("/demo/scenarios")) body = { banner: "x", scenarios: [NAME] };
    else if (u.includes("/demo/scenarios/")) body = { observations, golden_findings: findings };
    else if (u.endsWith("/replays")) body = { mode: "REPLAY", matches_golden: true, findings, ruleset_hash: "sha256:" + "a".repeat(64), findings_sha256: "b".repeat(64), input_sha256: "c".repeat(64) };
    else if (u.includes("/knowledge/symptoms")) body = CAT;
    else if (u.includes("/symptoms/evaluate")) body = RESULT;
    else if (u.endsWith("/errors/interpret")) body = INTERPRET;
    else if (u.endsWith("/bundles/preview")) body = { manifest: { files: [{ name: "observations.jsonl", sha256: "a".repeat(64), bytes: 10 }], source_mix: ["SYNTHETIC"] }, privacy: {} };
    else if (u.endsWith("/api/v1/history")) body = { sessions: [{ id: "h0123456789ab", label: "Live capture", origin: "real_capture", saved_at: "2026-11-07T10:00:00Z", observation_count: 3, first_utc: "2026-11-07T10:00:00Z", last_utc: "2026-11-07T10:00:10Z", status_mix: ["REAL"], content_sha256: "f".repeat(64) }], totals: { sessions: 1, observations: 3 }, limits: { max_sessions: 50, max_observations: 5000 } };
    else if (u.endsWith("/history/h0123456789ab/observations")) body = { session: {}, observations: [] };
    else if (u.endsWith("/history/h0123456789ab/findings")) body = { findings: [] };
    else if (u.endsWith("/health")) body = { status: "ok", api_version: "1", app_version: "0.1.7-g1", mode: "DEMO", machine_access: "READ_ONLY_ON_CONSENT", db_schema: 1 };
    else if (u.endsWith("/compatibility")) body = { capabilities: [] };
    return { ok: true, status: 200, json: async () => body };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const folded = (el: HTMLElement) => el.closest("details");
/** closed (Simple) or open (Expert), and the toggle is a native <summary>: first child of its <details>, so Tab and Enter reach it */
function expectFold(el: HTMLElement, open: boolean) {
  const d = folded(el);
  expect(d).not.toBeNull();
  expect(d!.open).toBe(open);
  const summary = d!.firstElementChild as HTMLElement;
  expect(summary.tagName).toBe("SUMMARY");
  expect(summary).toHaveTextContent(/Technical details|Détails techniques/);
  expect(summary.closest("[inert]")).toBeNull();
  summary.focus();
  expect(document.activeElement).toBe(summary);
}

async function printQuality() {
  location.hash = "#/symptoms";
  render(<App />);
  fireEvent.click(await screen.findByTestId("symptom-first-layer-gaps"));
  return screen.findByTestId("symptom-notes");
}
async function errorCode() {
  location.hash = `#/explorer/${CODE}`;
  render(<App />);
  return screen.findByTestId("code-parts");
}
async function report() {
  location.hash = "#/report";
  render(<App />);
  return { files: await screen.findByTestId("bundle-files"), table: await screen.findByTestId("redaction-table") };
}

for (const mode of ["simple", "expert"] as const) {
  const open = mode === "expert";
  test(`Print quality (${mode}): the method notes are ${open ? "open" : "folded"}; causes, evidence and its provenance stay visible`, async () => {
    localStorage.setItem("u1d.mode", mode);
    const notes = await printQuality();
    expectFold(notes, open);
    const causes = await screen.findByTestId("symptom-causes");
    expect(folded(causes)).toBeNull();
    expect(causes).toHaveTextContent("Bed flatness.");
    expect(causes).toHaveTextContent(/0\.9 mm/);
    expect(causes).toHaveTextContent("USER_REPORTED");
    expect(folded(screen.getByRole("link", { name: /Open the official page/ }))).toBeNull();
  });

  test(`Error codes (${mode}): raw code parts and catalog metadata are ${open ? "open" : "folded"}; meaning, severity, provenance, link and community block stay visible`, async () => {
    localStorage.setItem("u1d.mode", mode);
    const parts = await errorCode();
    expectFold(parts, open);
    expect(parts).toHaveTextContent(`${CODE} · Level 0002 · Module code 0525 · Sub-code 0002-0004`);
    expectFold(screen.getByTestId("catalog-meta"), open);
    expect(folded(screen.getByText("Filament extrusion blocked at the drive gear of toolhead 3."))).toBeNull();
    expect(folded(screen.getAllByText("USER_REPORTED")[0]!)).toBeNull();
    expect(folded(screen.getAllByText("WARNING")[0]!)).toBeNull();
    expect(folded(screen.getByRole("link", { name: /official/i }))).toBeNull();
    const community = await screen.findByTestId("community-causes");
    expect(folded(community)).toBeNull();
    expect(community).toHaveTextContent(/posted 2026-10-01/);
  });

  test(`Report (${mode}): the bundle file hashes are ${open ? "open" : "folded"}; report text, what is removed, privacy check and export stay visible`, async () => {
    localStorage.setItem("u1d.mode", mode);
    const { files, table } = await report();
    expectFold(files, open);
    expect(files).toHaveTextContent("observations.jsonl");
    expect(folded(table)).toBeNull(); // the list of removed fields is plain language: kept in view in both modes
    expect(folded(screen.getByRole("button", { name: /export bundle|exporter le dossier/i }))).toBeNull();
    expect(folded(screen.getByRole("list", { name: /privacy|confidentialité/i }))).toBeNull();
    expect(folded(screen.getByRole("article"))).toBeNull();
  });
}
