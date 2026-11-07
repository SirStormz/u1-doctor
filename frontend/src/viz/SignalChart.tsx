import { useEffect, useMemo, useRef, useState } from "react";
import type { Observation } from "../api";
import { hhmmss, tms, val } from "../lib/data";
import { stateLabel, tx } from "../lib/dyn";
import { usePrefs } from "../lib/prefs";

export interface Lane { id: string; label: string; unit?: string; kind: "line" | "state"; points: { t: number; v: number | string; o: Observation }[] }
export interface Gap { start: number; end: number; o: Observation }

/** Derive lanes/gaps/events from observations. Pure and unit-testable. */
export function deriveSeries(obs: Observation[]) {
  const num = (o: Observation) => Number(val(o).celsius);
  const nozzle = obs.filter((o) => o.event_type === "temperature_sample" && o.entity_id === "toolhead_3").sort((a, b) => tms(a) - tms(b));
  const bed = obs.filter((o) => o.event_type === "bed_temperature_sample").sort((a, b) => tms(a) - tms(b));
  const states = obs.filter((o) => o.event_type === "state_transition").sort((a, b) => tms(a) - tms(b));
  const lanes: Lane[] = [];
  if (nozzle.length) lanes.push({ id: "nozzle", label: "Toolhead 3 · nozzle", unit: "°C", kind: "line", points: nozzle.map((o) => ({ t: tms(o), v: num(o), o })) });
  if (bed.length) lanes.push({ id: "bed", label: "Bed", unit: "°C", kind: "line", points: bed.map((o) => ({ t: tms(o), v: num(o), o })) });
  if (states.length) lanes.push({ id: "state", label: "Print state", kind: "state", points: states.map((o) => ({ t: tms(o), v: String(val(o).state), o })) });
  const gaps: Gap[] = obs.filter((o) => o.event_type === "capture_gap").map((o) => ({ start: Date.parse(String(val(o).start)), end: Date.parse(String(val(o).end)), o })).filter((g) => Number.isFinite(g.start) && Number.isFinite(g.end));
  const events = obs.filter((o) => ["state_transition", "user_reported_error_code"].includes(o.event_type));
  const all = obs.map(tms);
  const t0 = Math.min(...all, ...gaps.map((g) => g.start));
  const t1 = Math.max(...all, ...gaps.map((g) => g.end));
  return { lanes, gaps, events, t0, t1 };
}

/** Split a series into drawable segments: never connect samples across a gap. */
export function segments(points: { t: number }[], gaps: { start: number; end: number }[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  points.forEach((p, i) => {
    const prev = points[i - 1];
    if (prev && gaps.some((g) => g.start < p.t && g.end > prev.t)) { if (cur.length) out.push(cur); cur = []; }
    cur.push(i);
  });
  if (cur.length) out.push(cur);
  return out;
}

const STATE_COLOR: Record<string, string> = { printing: "var(--accent)", paused: "var(--warn)", error: "var(--danger)" };

interface Props { obs: Observation[]; stops: number[]; index: number; onIndex: (i: number) => void; labels: { gap: string; receipt: string; slider: string }; }

export function SignalChart({ obs, stops, index, onIndex, labels }: Props) {
  const { lang } = usePrefs();
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(900);
  const s = useMemo(() => deriveSeries(obs), [obs]);
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(() => setW(Math.max(420, wrap.current?.clientWidth ?? 900)));
    ro.observe(wrap.current);
    setW(Math.max(420, wrap.current.clientWidth || 900));
    return () => ro.disconnect();
  }, []);

  const L = 56, R = 16, RULER = 46, LANE = 84, H = RULER + s.lanes.length * LANE + 10;
  const span = Math.max(1, s.t1 - s.t0);
  const pad = span * 0.02;
  const d0 = s.t0 - pad, d1 = s.t1 + pad;
  const x = (t: number) => L + ((t - d0) / (d1 - d0)) * (w - L - R);
  const step = [15, 30, 60, 120, 300, 600].find((st) => ((d1 - d0) / 1000 / st) <= 9) ?? 900;
  const ticks: number[] = [];
  for (let t = Math.ceil(d0 / 1000 / step) * step * 1000; t <= d1; t += step * 1000) ticks.push(t);
  const cursor = stops[index] ?? s.t0;

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (k === "ArrowRight") onIndex(Math.min(stops.length - 1, index + 1));
    else if (k === "ArrowLeft") onIndex(Math.max(0, index - 1));
    else if (k === "PageDown") onIndex(Math.min(stops.length - 1, index + 3));
    else if (k === "PageUp") onIndex(Math.max(0, index - 3));
    else if (k === "Home") onIndex(0);
    else if (k === "End") onIndex(stops.length - 1);
    else return;
    e.preventDefault();
  };
  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = d0 + ((e.clientX - r.left - L) / (w - L - R)) * (d1 - d0);
    let best = 0;
    stops.forEach((st, i) => { if (Math.abs(st - t) < Math.abs((stops[best] ?? 0) - t)) best = i; });
    onIndex(best);
  };

  return (
    <div ref={wrap} className="relative w-full">
      <div role="slider" tabIndex={0} aria-label={labels.slider} aria-valuemin={0} aria-valuemax={Math.max(0, stops.length - 1)} aria-valuenow={index} aria-valuetext={hhmmss(cursor) + " UTC"} onKeyDown={onKey} className="rounded-lg outline-offset-4">
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={labels.slider} onClick={onClick} style={{ display: "block", cursor: "crosshair" }}>
          <defs>
            <pattern id="gaphatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="color-mix(in srgb, var(--ink-3) 8%, transparent)" /><line x1="0" y1="0" x2="0" y2="8" stroke="var(--ink-3)" strokeWidth="1.4" opacity="0.55" /></pattern>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <g className="chart-in">
          {/* ruler */}
          <line x1={L} x2={w - R} y1={RULER - 6} y2={RULER - 6} stroke="var(--line-strong)" />
          {ticks.map((t) => (<g key={t}><line x1={x(t)} x2={x(t)} y1={RULER - 10} y2={RULER - 2} stroke="var(--ink-3)" /><text x={x(t)} y={RULER - 14} textAnchor="middle" fontSize="10.5" fill="var(--ink-3)" fontFamily="var(--font-mono)">{hhmmss(t)}</text><line x1={x(t)} x2={x(t)} y1={RULER} y2={H - 6} stroke="var(--line)" strokeDasharray="2 5" opacity="0.7" /></g>))}
          <text x={4} y={11} fontSize="9.5" fill="var(--ink-3)" letterSpacing="1.2">{labels.receipt}</text>
          {/* lanes */}
          {s.lanes.map((ln, li) => {
            const y0 = RULER + li * LANE + 8, y1 = y0 + LANE - 22;
            const nums = ln.kind === "line" ? ln.points.map((p) => Number(p.v)) : [];
            const lo = Math.min(...nums) - 2, hi = Math.max(...nums) + 2;
            const y = (v: number) => y1 - ((v - lo) / (hi - lo || 1)) * (y1 - y0 - 14);
            return (
              <g key={ln.id}>
                <line x1={L} x2={w - R} y1={y1 + 6} y2={y1 + 6} stroke="var(--line)" />
                <text x={L + 4} y={y0 + 6} fontSize="10.5" fontWeight="650" fill="var(--ink-2)" letterSpacing="0.6">{tx(lang, ln.label).toUpperCase()}</text>
                {ln.kind === "line" && (<>
                  {Math.max(...nums) - Math.min(...nums) < 1 ? (<text x={L - 6} y={y((hi + lo) / 2) + 3} textAnchor="end" fontSize="9.5" fill="var(--ink-3)" fontFamily="var(--font-mono)">{Number(nums[0]).toFixed(0)}</text>) : (<><text x={L - 6} y={y(hi - 2) + 3} textAnchor="end" fontSize="9.5" fill="var(--ink-3)" fontFamily="var(--font-mono)">{(hi - 2).toFixed(0)}</text><text x={L - 6} y={y(lo + 2) + 3} textAnchor="end" fontSize="9.5" fill="var(--ink-3)" fontFamily="var(--font-mono)">{(lo + 2).toFixed(0)}</text></>)}
                  {segments(ln.points, s.gaps).map((seg, si) => (
                    <path key={si} d={seg.map((pi, k) => `${k ? "L" : "M"}${x(ln.points[pi]!.t).toFixed(1)} ${y(Number(ln.points[pi]!.v)).toFixed(1)}`).join(" ")} fill="none" stroke={ln.id === "bed" ? "var(--warn)" : "var(--accent)"} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" filter="url(#glow)" />
                  ))}
                  {ln.points.map((p) => (<circle key={p.o.observation_id} cx={x(p.t)} cy={y(Number(p.v))} r="3.2" fill="var(--surface-1)" stroke={ln.id === "bed" ? "var(--warn)" : "var(--accent)"} strokeWidth="1.6" />))}
                </>)}
                {ln.kind === "state" && ln.points.map((p, pi) => {
                  const next = ln.points[pi + 1]?.t ?? d1;
                  const c = STATE_COLOR[String(p.v)] ?? "var(--ink-3)";
                  return (<g key={p.o.observation_id}><rect x={x(p.t)} y={y0 + 14} width={Math.max(2, x(next) - x(p.t) - 2)} height={y1 - y0 - 24} rx="5" fill={`color-mix(in srgb, ${c} 22%, var(--surface-1))`} stroke={c} /><text x={x(p.t) + 8} y={y0 + 14 + (y1 - y0 - 24) / 2 + 4} fontSize="11.5" fontWeight="700" fill={c}>{x(next) - x(p.t) > 76 ? stateLabel(lang, String(p.v)) : stateLabel(lang, String(p.v)).slice(0, 1)}</text><title>{stateLabel(lang, String(p.v))}</title></g>);
                })}
              </g>
            );
          })}
          {/* gap bands (drawn over lanes: nothing is known inside) */}
          {s.gaps.map((g) => (
            <g key={g.o.observation_id}>
              <rect x={x(g.start)} y={RULER} width={Math.max(2, x(g.end) - x(g.start))} height={H - RULER - 6} fill="url(#gaphatch)" stroke="var(--ink-3)" strokeDasharray="4 3" opacity="0.95" />
              <text x={(x(g.start) + x(g.end)) / 2} y={RULER + 16} textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="1.5" fill="var(--ink)" paintOrder="stroke" stroke="var(--surface-1)" strokeWidth="4">{labels.gap}</text>
            </g>
          ))}
          {/* event markers on ruler */}
          {s.events.map((e) => (
            <g key={e.observation_id} transform={`translate(${x(tms(e))} ${RULER - 6})`}>
              <title>{`${hhmmss(tms(e))} ${e.event_type}`}</title>
              <path d="M0 0 L-5 -9 L5 -9 Z" fill={e.event_type === "user_reported_error_code" ? "var(--warn)" : "var(--accent)"} />
            </g>
          ))}
          {/* playhead */}
          <g>
            <line x1={x(cursor)} x2={x(cursor)} y1={RULER - 22} y2={H - 6} stroke="var(--accent)" strokeWidth="1.6" filter="url(#glow)" />
            <rect x={x(cursor) - 30} y={0} width="60" height="17" rx="5" fill="var(--surface-3)" stroke="var(--accent)" />
            <text x={x(cursor)} y={12} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)" fontFamily="var(--font-mono)">{hhmmss(cursor)}</text>
          </g>
        </g>
        </svg>
      </div>
    </div>
  );
}
