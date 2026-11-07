import type { Finding, Observation } from "../api";
import { tms, val } from "../lib/data";
import { tok, tx } from "../lib/dyn";
import { usePrefs } from "../lib/prefs";

interface Node { id: string; kind: "fact" | "hyp" | "gap"; text: string; sub: string; col: 0 | 1; row: number }
interface Edge { a: string; b: string; label: string; style: "dotted" | "dashed" }

const wrap = (s: string, n: number, max = 3): string[] => {
  const lines: string[] = [];
  let cur = "";
  for (const w of s.split(" ")) {
    if ((cur + " " + w).trim().length > n) { lines.push(cur.trim()); cur = w; } else cur += " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  const out = lines.slice(0, max);
  if (lines.length > max) out[max - 1] = out[max - 1]!.replace(/.{0,2}$/, "…");
  return out;
};
const clean = (s: string) => s.replace(/^SYNTHETIC: /, "");

export function HypothesisMap({ findings, labels }: { findings: Finding[]; labels: { fact: string; hyp: string; gap: string; gapText: string; prox: string; ref: string; may: string; aria: string } }) {
  const { lang } = usePrefs();
  const s03 = findings.find((f) => f.rule_id === "U1-S03-STATE-TRANSITION");
  const s01 = findings.find((f) => f.rule_id === "U1-S01-CODE-DECODE");
  const s10 = findings.find((f) => f.rule_id === "U1-S10-OBSERVATION-GAPS");
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  if (s10) nodes.push({ id: "s10", kind: "gap", text: labels.gapText, sub: labels.gap.toUpperCase(), col: 0, row: 0 });
  if (s03) nodes.push({ id: "s03", kind: "fact", text: tx(lang, clean(s03.human_title)), sub: labels.fact, col: 0, row: 0 });
  if (s01) nodes.push({ id: "s01", kind: "fact", text: tx(lang, clean(s01.human_title)), sub: labels.fact, col: 0, row: 0 });
  const h = s01?.hypotheses[0];
  if (s01 && h) nodes.push({ id: "h1", kind: "hyp", text: tx(lang, h.text), sub: `${labels.hyp} · ${tok(lang, "label", h.label)}`, col: 0, row: 0 });
  if (s03 && s01 && s03.evidence_for.some((e) => e.note.includes("correlation only"))) edges.push({ a: "s03", b: "s01", label: labels.prox, style: "dotted" });
  if (s01 && h) edges.push({ a: "s01", b: "h1", label: labels.ref, style: "dashed" });
  if (s10 && s03) edges.push({ a: "s10", b: "s03", label: labels.may, style: "dashed" });

  const W = 330, NW = 306, NH = 76, GAPY = 40;
  nodes.forEach((n, i) => { n.row = i; });
  const pos = (n: Node) => ({ x: 12, y: 14 + n.row * (NH + GAPY) });
  const H = 14 + nodes.length * NH + Math.max(0, nodes.length - 1) * GAPY + 14;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={labels.aria} className="w-full">
      {edges.map((e, i) => {
        const a = byId.get(e.a), b = byId.get(e.b);
        if (!a || !b) return null;
        const pa = pos(a), pb = pos(b);
        const same = a.col === b.col;
        const x1 = same ? pa.x + NW / 2 : pa.x + NW, y1 = same ? (pa.y < pb.y ? pa.y + NH : pa.y) : pa.y + NH / 2;
        const x2 = same ? pb.x + NW / 2 : pb.x, y2 = same ? (pa.y < pb.y ? pb.y : pb.y + NH) : pb.y + NH / 2;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent)" strokeWidth="1.6" strokeDasharray={e.style === "dotted" ? "1.5 5" : "6 4"} strokeLinecap="round" />
            <rect x={(x1 + x2) / 2 - 62} y={(y1 + y2) / 2 - 9} width="124" height="18" rx="9" fill="var(--surface-1)" stroke="var(--line-strong)" />
            <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 4} textAnchor="middle" fontSize="10" fill="var(--ink-2)" letterSpacing="0.4">{e.label}</text>
          </g>
        );
      })}
      {nodes.map((n, nodeIdx) => {
        const p = pos(n);
        const stroke = n.kind === "fact" ? "var(--accent)" : "var(--ink-3)";
        return (
          <g key={n.id} transform={`translate(${p.x} ${p.y})`} className="node-in" style={{ "--i": nodeIdx } as React.CSSProperties}>
            <rect width={NW} height={NH} rx="12" fill={n.kind === "gap" ? "var(--surface-2)" : "var(--surface-2)"} stroke={stroke} strokeWidth={n.kind === "fact" ? 1.8 : 1.4} strokeDasharray={n.kind === "fact" ? undefined : "6 4"} />
            <text x="12" y="17" fontSize="9.5" fontWeight="700" letterSpacing="1.2" fill={n.kind === "fact" ? "var(--accent)" : "var(--ink-3)"}>{n.sub.toUpperCase()}</text>
            {wrap(n.text, 44).map((l, i) => (<text key={i} x="12" y={36 + i * 15} fontSize="12" fill="var(--ink)">{l}</text>))}
          </g>
        );
      })}
    </svg>
  );
}

/** Compact timeline strip: events as dots, gaps hatched. */
export function MiniStrip({ obs, gapLabel }: { obs: Observation[]; gapLabel: string }) {
  const times = obs.map(tms);
  const gaps = obs.filter((o) => o.event_type === "capture_gap").map((o) => [Date.parse(String(val(o).start)), Date.parse(String(val(o).end))] as const);
  const t0 = Math.min(...times, ...gaps.map((g) => g[0])), t1 = Math.max(...times, ...gaps.map((g) => g[1]));
  const X = (t: number) => 8 + ((t - t0) / Math.max(1, t1 - t0)) * 484;
  const ev = obs.filter((o) => ["state_transition", "user_reported_error_code"].includes(o.event_type));
  return (
    <svg viewBox="0 0 500 44" className="w-full" role="img" aria-label={gapLabel}>
      <line x1="8" x2="492" y1="24" y2="24" stroke="var(--line-strong)" strokeWidth="2" />
      {gaps.map(([a, b], i) => (<g key={i}><rect x={X(a)} y="14" width={Math.max(3, X(b) - X(a))} height="20" rx="3" className="hatch" fill="color-mix(in srgb, var(--ink-3) 10%, transparent)" stroke="var(--ink-3)" strokeDasharray="3 2" /><text x={(X(a) + X(b)) / 2} y="9" fontSize="8.5" textAnchor="middle" fill="var(--ink-3)" letterSpacing="1">{gapLabel}</text></g>))}
      {ev.map((e) => (<circle key={e.observation_id} cx={X(tms(e))} cy="24" r="5" fill={e.event_type === "user_reported_error_code" ? "var(--warn)" : "var(--accent)"} stroke="var(--surface-1)" strokeWidth="2" />))}
    </svg>
  );
}
