/** Ticket-ready summary (#56): a plain-text / Markdown block the owner pastes into a support ticket or a forum post.
 * Built locally from what the owner typed and from the loaded capture, replay or demo. Nothing is detected or sent. */
import type { Finding, Observation } from "../api";
import type { Lang } from "./i18n";
import { tok, tx } from "./dyn";

/** Official article on exporting the printer's (encrypted) logs, from the wiki index read on 2026-11-06 (docs/wiki-findings.md §2). */
export const LOG_EXPORT_URL = "https://wiki.snapmaker.com/en/snapmaker_u1/troubleshooting/U1_export_log";

export type Network = "" | "lan" | "cloud";
export interface TicketFields {
  firmware: string; slicer: string; toolhead: string; code: string; network: Network; filaments: [string, string, string, string]; tried: string;
}
export interface TicketSource { kind: "demo" | "saved" | "none"; label?: string; statusMix?: string[] }
export interface TicketInput { appVersion: string | null; fields: TicketFields; title: string | null; source: TicketSource; obs: Observation[]; findings: Finding[] }

const L = {
  en: {
    head: "U1 Doctor summary (unofficial tool, not affiliated with Snapmaker)", app: "App", fw: "Firmware", slicer: "Slicer", th: "Toolhead", code: "Error code",
    net: "Connection", netv: { "": "not stated", lan: "LAN only", cloud: "Cloud" }, fil: "Filament per toolhead", tried: "What I tried", none: "not stated",
    src: "Data source", demo: "SYNTHETIC DEMO DATA, not from a printer", saved: "saved session", nosrc: "no capture loaded",
    events: "Events recorded", gaps: "Recorded data gaps", findings: "Findings (classification · provenance)", noFind: "none",
    log: "This summary does not replace the printer's encrypted system log that support asks for; export that log as described in",
    local: "Built locally by U1 Doctor; nothing was sent anywhere.",
  },
  fr: {
    head: "Résumé U1 Doctor (outil non officiel, sans lien avec Snapmaker)", app: "Application", fw: "Firmware", slicer: "Trancheur", th: "Tête", code: "Code d'erreur",
    net: "Liaison", netv: { "": "non précisé", lan: "réseau local uniquement", cloud: "cloud" }, fil: "Filament par tête", tried: "Ce que j'ai essayé", none: "non précisé",
    src: "Source des données", demo: "DONNÉES DE DÉMONSTRATION SYNTHÉTIQUES, pas issues d'une machine", saved: "session enregistrée", nosrc: "aucune capture chargée",
    events: "Événements enregistrés", gaps: "Trous de données enregistrés", findings: "Constats (classement · provenance)", noFind: "aucun",
    log: "Ce résumé ne remplace pas le journal système chiffré de la machine que demande le support ; exportez ce journal comme indiqué dans",
    local: "Construit localement par U1 Doctor ; rien n'a été envoyé nulle part.",
  },
} as const;

/** One line per fact; Markdown-safe bullets. Demo/synthetic data stays labelled on every line that carries it. */
export function buildTicket(lang: Lang, i: TicketInput): string {
  const s = L[lang];
  const v = (x: string) => x.trim() || s.none;
  const f = i.fields;
  const out: string[] = [`**${s.head}**`];
  if (i.source.kind === "demo") out.push(`> ${s.demo}`);
  out.push(`- ${s.app}: U1 Doctor ${i.appVersion ?? s.none}`);
  out.push(`- ${s.fw}: ${v(f.firmware)}`);
  out.push(`- ${s.slicer}: ${v(f.slicer)}`);
  out.push(`- ${s.th}: ${v(f.toolhead)}`);
  out.push(`- ${s.code}: ${v(f.code)}${f.code.trim() && i.title ? ` (${tx(lang, i.title)})` : ""}`);
  out.push(`- ${s.net}: ${s.netv[f.network]}`);
  out.push(`- ${s.fil}: ${f.filaments.map((x, k) => `T${k + 1} ${v(x)}`).join(" · ")}`);
  out.push(`- ${s.tried}: ${v(f.tried).replace(/\s*\n\s*/g, " / ")}`);
  if (i.source.kind === "none") out.push(`- ${s.src}: ${s.nosrc}`);
  else {
    const mix = i.source.kind === "demo" ? ["SYNTHETIC"] : (i.source.statusMix ?? []);
    const prov = mix.map((m) => tok(lang, "provenance", m)).join(", ");
    out.push(`- ${s.src}: ${i.source.kind === "demo" ? s.demo : `${s.saved} "${i.source.label ?? ""}"`}${prov ? ` [${prov}]` : ""}`);
    out.push(`- ${s.events}: ${i.obs.length} · ${s.gaps}: ${i.obs.filter((o) => o.event_type === "capture_gap").length}`);
    out.push(`- ${s.findings}:${i.findings.length ? "" : ` ${s.noFind}`}`);
    for (const x of i.findings) {
      const synth = x.source_mix.includes("SYNTHETIC");
      const title = tx(lang, x.human_title.replace(/^SYNTHETIC: /, ""));
      out.push(`  - ${synth ? `[${tok(lang, "provenance", "SYNTHETIC")}] ` : ""}${title} · ${tok(lang, "classification", x.classification)} · ${x.source_mix.map((m) => tok(lang, "provenance", m)).join(", ")}`);
    }
  }
  out.push("", `${s.log} ${LOG_EXPORT_URL}`, s.local);
  return out.join("\n");
}
