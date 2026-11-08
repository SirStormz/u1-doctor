import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { renderSampleReport, SAMPLE_SCENARIO, sampleInputs } from "../src/lib/sample-report";

/** docs/sample-report/index.html (GitHub Pages): SYNTHETIC label, app version, self-contained, up to date with the generator. */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const PAGE = read("docs/sample-report/index.html").replace(/\r\n/g, "\n");
const fx = `fixtures/synthetic/synthetic_${SAMPLE_SCENARIO}`;
const input = () => sampleInputs({ observationsJsonl: read(`${fx}.observations.jsonl`), findingsJson: read(`${fx}.findings.json`), catalogJson: read("knowledge/u1_codes.json"), apiPy: read("backend/app/api.py") });
/** Only documentation links: the project repository and the official wiki article on log export. */
const DOC_LINKS = /^https:\/\/(github\.com\/SirStormz\/u1-doctor(\/.*)?|wiki\.snapmaker\.com\/en\/snapmaker_u1\/.+)$/;

test("the committed page is what the generator produces today (run npm run sample-report after a change)", () => {
  expect(PAGE).toBe(renderSampleReport(input()));
});

test("carries the DEMO / SYNTHETIC banner in both languages, the app version and the sample note", () => {
  const version = /^APP_VERSION = "([^"]+)"/m.exec(read("backend/app/api.py"))![1]!;
  expect(PAGE).toContain("DEMO · SYNTHETIC DATA · not captured from a printer");
  expect(PAGE).toContain("DÉMO · DONNÉES SYNTHÉTIQUES · pas issues d'une machine");
  expect(PAGE).toContain("SYNTHETIC DEMO DATA, not from a printer");
  expect(PAGE).toContain(`U1 Doctor ${version}`);
  expect(PAGE).toContain("sample generated from synthetic data");
  expect(PAGE).toContain("exemple produit à partir de données synthétiques");
  expect(PAGE).toMatch(/<title>[^<]*SYNTHETIC[^<]*<\/title>/);
});

test("no script, no external resource and no URL other than documentation links", () => {
  expect(PAGE).not.toMatch(/<script|<iframe|<img|<link|@import|url\(/i);
  expect(PAGE).not.toMatch(/\son\w+=/i);
  const urls = PAGE.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
  expect(urls.length).toBeGreaterThan(0);
  expect(urls.filter((u) => !DOC_LINKS.test(u))).toEqual([]);
  const hrefs = [...PAGE.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
  expect(hrefs.every((h) => DOC_LINKS.test(h))).toBe(true);
});

test("lists every demo finding with its classification, never a score", () => {
  const { findings } = input();
  for (const f of findings) expect(PAGE).toContain(f.rule_id);
  expect(PAGE.split("</style>")[1]).not.toMatch(/\b\d{1,3}\s?%/);
});
