// Compacts knowledge/u1_codes.json (413 official codes, paraphrased, each with its wiki link) for the site decoder.
// Run from site/: node scripts/build-codes.mjs   (the output is committed: the site build does not need the knowledge folder)
import { readFileSync, writeFileSync } from "node:fs";
const src = JSON.parse(readFileSync(new URL("../../knowledge/u1_codes.json", import.meta.url), "utf8"));
const rows = src.entries.map((e) => [e.code, e.title, e.summary, e.toolhead ?? 0, e.article?.url ?? src.source_url]);
writeFileSync(new URL("../src/data/codes.json", import.meta.url), JSON.stringify({ v: src.catalog_version, verified: src.last_verified_at, rows }));
console.log(rows.length, "codes");
