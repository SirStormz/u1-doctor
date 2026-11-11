/** Static sample report for GitHub Pages (docs/sample-report/index.html), built from the SYNTHETIC demo incident with the same
 * Report-composer code the app runs (buildTicket). Pure: strings in, one self-contained HTML string out (inline CSS, no script,
 * no external request; only documentation links). Regenerate with `npm run sample-report` (cwd frontend). */
import type { Finding, Observation } from "../api";
import { tok, tx } from "./dyn";
import type { Lang } from "./i18n";
import { buildTicket, type TicketFields } from "./ticket-text";

export const SAMPLE_SCENARIO = "demo_extrusion_blockage";
export const REPO_URL = "https://github.com/SirStormz/u1-doctor";

export interface SampleInput { appVersion: string; observations: Observation[]; findings: Finding[]; code: string; title: string | null }

/** Reads the frozen demo files exactly as the app gets them (the replay of this scenario must match these golden findings). */
export function sampleInputs(src: { observationsJsonl: string; findingsJson: string; catalogJson: string; apiPy: string }): SampleInput {
  const observations = src.observationsJsonl.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l) as Observation);
  const findings = JSON.parse(src.findingsJson) as Finding[];
  const v = /^APP_VERSION = "([^"]+)"/m.exec(src.apiPy);
  if (!v) throw new Error("APP_VERSION not found in backend/app/api.py");
  const coded = observations.find((o) => o.event_type === "user_reported_error_code")?.value as { code?: unknown } | undefined;
  const code = typeof coded?.code === "string" ? coded.code : "";
  const cat = JSON.parse(src.catalogJson) as { entries: { code: string; title: string }[] };
  return { appVersion: v[1]!, observations, findings, code, title: cat.entries.find((e) => e.code === code)?.title ?? null };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const link = (s: string) => esc(s).replace(/https:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`);

/** The composer's Markdown is a small fixed shape: bold head line, one quote line, "- " and "  - " bullets, plain lines. */
function mdToHtml(md: string): string {
  const out: string[] = [];
  let open = 0;
  const close = (to: number) => { while (open > to) { out.push(open === 2 ? "</ul></li>" : "</ul>"); open--; } };
  for (const line of md.split("\n")) {
    const sub = /^ {2}- (.*)$/.exec(line);
    const top = /^- (.*)$/.exec(line);
    if (sub) { if (open === 1) { out[out.length - 1] = out[out.length - 1]!.replace(/<\/li>$/, ""); out.push("<ul>"); open = 2; } out.push(`<li>${link(sub[1]!)}</li>`); continue; }
    if (top) { close(1); if (open === 0) { out.push("<ul>"); open = 1; } out.push(`<li>${link(top[1]!)}</li>`); continue; }
    close(0);
    if (!line.trim()) continue;
    const bold = /^\*\*(.*)\*\*$/.exec(line);
    if (bold) out.push(`<p class="head"><strong>${esc(bold[1]!)}</strong></p>`);
    else if (line.startsWith("> ")) out.push(`<p class="synth">${esc(line.slice(2))}</p>`);
    else out.push(`<p>${link(line)}</p>`);
  }
  close(0);
  return out.join("\n");
}

const L = {
  en: {
    banner: "DEMO · SYNTHETIC DATA · not captured from a printer", h1: "U1 Doctor · sample report", version: "App version", scenario: "Scenario",
    note: "This is a sample generated from synthetic data: the frozen demo incident that ships with the app. It is not a real fault and no printer was contacted. The summary below is produced by the app's Report composer code (ticket-ready summary) with only the declared error code filled in.",
    summary: "Ticket-ready summary", raw: "Text as copied by the app", findings: "Findings", rule: "Rule", what: "Finding", cls: "Classification", prov: "Provenance",
    findNote: "Classifications come from fixed rules; there is no score and no probability. SUSPECTED means a hypothesis, never a fact.",
    more: "Project, source code and documentation", regen: "Regenerate it with npm run sample-report in the frontend folder.",
  },
  fr: {
    banner: "DÉMO · DONNÉES SYNTHÉTIQUES · pas issues d'une machine", h1: "U1 Doctor · exemple de rapport", version: "Version de l'application", scenario: "Scénario",
    note: "Ceci est un exemple produit à partir de données synthétiques : l'incident de démonstration figé livré avec l'application. Ce n'est pas une vraie panne et aucune imprimante n'a été contactée. Le résumé ci-dessous est produit par le code du compositeur de rapport de l'application (résumé prêt pour un ticket), avec seulement le code d'erreur déclaré rempli.",
    summary: "Résumé prêt pour un ticket", raw: "Texte tel que copié par l'application", findings: "Constats", rule: "Règle", what: "Constat", cls: "Classement", prov: "Provenance",
    findNote: "Les classements viennent de règles fixes ; il n'y a ni score ni probabilité. SUPPOSÉ signifie une hypothèse, jamais un fait.",
    more: "Projet, code source et documentation", regen: "Pour le régénérer : npm run sample-report dans le dossier frontend.",
  },
} as const;

function section(lang: Lang, i: SampleInput): string {
  const s = L[lang];
  const fields: TicketFields = { firmware: "", slicer: "", toolhead: "", code: i.code, network: "", filaments: ["", "", "", ""], tried: "" };
  const md = buildTicket(lang, { appVersion: i.appVersion, fields, title: i.title, source: { kind: "demo" }, obs: i.observations, findings: i.findings });
  const rows = i.findings.map((f) => `<tr><td class="mono">${esc(f.rule_id)}</td><td>${esc(tx(lang, f.human_title.replace(/^SYNTHETIC: /, "")))}</td><td>${esc(tok(lang, "classification", f.classification))}</td><td>${esc(f.source_mix.map((m) => tok(lang, "provenance", m)).join(", "))}</td></tr>`).join("\n");
  return `<section lang="${lang}" aria-labelledby="h-${lang}">
<p class="banner" role="note">${esc(s.banner)}</p>
<h1 id="h-${lang}">${esc(s.h1)}</h1>
<dl><dt>${esc(s.version)}</dt><dd class="mono">${esc(i.appVersion)}</dd><dt>${esc(s.scenario)}</dt><dd class="mono">${SAMPLE_SCENARIO} (SYNTHETIC)</dd></dl>
<p class="note">${esc(s.note)}</p>
<h2>${esc(s.summary)}</h2>
<div class="paper">
${mdToHtml(md)}
</div>
<details><summary>${esc(s.raw)}</summary><pre>${esc(md)}</pre></details>
<h2>${esc(s.findings)}</h2>
<table><thead><tr><th>${esc(s.rule)}</th><th>${esc(s.what)}</th><th>${esc(s.cls)}</th><th>${esc(s.prov)}</th></tr></thead><tbody>
${rows}
</tbody></table>
<p class="small">${esc(s.findNote)}</p>
<p class="small">${esc(s.more)}: <a href="${REPO_URL}">${REPO_URL}</a> · ${esc(s.regen)}</p>
</section>`;
}

export function renderSampleReport(i: SampleInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="description" content="A sample U1 Doctor incident report built from a synthetic demo incident. Nothing in it comes from a real printer.">
<title>U1 Doctor sample report (SYNTHETIC)</title>
<style>
:root{--bg:#f4f4f0;--paper:#fafaf7;--ink:#161614;--ink2:#4a4a44;--line:#c9c9c0;--demo:#7a3fd1;--demo-bg:#efe6fb;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#10100e;--paper:#161614;--ink:#f1f1ea;--ink2:#b8b8ae;--line:#3a3a34;--demo:#c9a6ff;--demo-bg:#2a1f3d}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:920px;margin:0 auto;padding:24px 16px 48px}
section+section{margin-top:48px;padding-top:32px;border-top:2px solid var(--ink)}
.banner{margin:0 0 16px;padding:10px 14px;border:2px solid var(--demo);background:var(--demo-bg);color:var(--demo);font-weight:800;letter-spacing:.04em}
.synth{margin:0 0 8px;padding:6px 10px;border-left:4px solid var(--demo);background:var(--demo-bg);font-weight:700}
h1{margin:0 0 8px;font-size:clamp(26px,5vw,38px);letter-spacing:-.02em}
h2{margin:28px 0 8px;font-size:20px}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;margin:8px 0}
dt{color:var(--ink2)}dd{margin:0}
.mono,pre{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace}
.note{color:var(--ink2)}
.paper{padding:16px;border:1px solid var(--line);background:var(--paper);overflow-wrap:anywhere}
.paper ul{margin:4px 0;padding-left:20px}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;padding:12px;border:1px solid var(--line);background:var(--paper)}
details{margin-top:12px}summary{cursor:pointer;color:var(--ink2)}
table{width:100%;border-collapse:collapse;font-size:14px;display:block;overflow-x:auto}
th,td{text-align:left;padding:6px 8px;border-top:1px solid var(--line);vertical-align:top}
.small{font-size:13px;color:var(--ink2)}
a{color:inherit}
</style>
</head>
<body>
<main>
${section("en", i)}
${section("fr", i)}
</main>
</body>
</html>
`;
}
