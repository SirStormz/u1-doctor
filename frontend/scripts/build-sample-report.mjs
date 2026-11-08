// Builds docs/sample-report/index.html from the SYNTHETIC demo incident with the app's own Report-composer code.
// Offline: reads repo files, loads src/lib/sample-report.ts through Vite's module runner (no server, no port), writes one file.
// Usage (cwd frontend): npm run sample-report
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const front = path.resolve(here, "..");
const root = path.resolve(front, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const { module: m } = await runnerImport(path.join(front, "src/lib/sample-report.ts"), { configFile: false, root: front, logLevel: "error" });
const fx = `fixtures/synthetic/synthetic_${m.SAMPLE_SCENARIO}`;
const html = m.renderSampleReport(m.sampleInputs({
  observationsJsonl: read(`${fx}.observations.jsonl`), findingsJson: read(`${fx}.findings.json`),
  catalogJson: read("knowledge/u1_codes.json"), apiPy: read("backend/app/api.py"),
}));
const out = path.join(root, "docs/sample-report/index.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html, "utf8");
console.log(`wrote ${path.relative(root, out)} (${html.length} chars)`);
