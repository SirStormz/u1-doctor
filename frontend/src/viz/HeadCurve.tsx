import { useEffect, useRef, useState } from "react";
import { hhmmss } from "../lib/data";
import { segments } from "./SignalChart";

export interface CurvePoint { t: number; v: number }
interface Props {
  points: CurvePoint[];
  gaps: { start: number; end: number }[];
  /** session window (all observations), so the curve lines up with the replay */
  t0: number; t1: number;
  cursor: number;
  code?: number | null;
  stops: number[];
  onPick: (i: number) => void;
  labels: { gap: string; code: string; aria: string };
}

/**
 * One toolhead's temperature over the session (UI V2 Expert home): the readings as received, never joined across a capture
 * gap (the gap is drawn as a hatched band: nothing is known inside), the declared code as a mark, the replay position as a line.
 */
export function HeadCurve({ points, gaps, t0, t1, cursor, code, stops, onPick, labels }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(820);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(300, el.clientWidth || 820)));
    ro.observe(el);
    setW(Math.max(300, el.clientWidth || 820));
    return () => ro.disconnect();
  }, []);

  const H = 196, L = 10, R = 10, T = 34, B = 30;
  const span = Math.max(1, t1 - t0), pad = span * 0.02;
  const d0 = t0 - pad, d1 = t1 + pad;
  const x = (t: number) => L + ((t - d0) / (d1 - d0)) * (w - L - R);
  const vs = points.map((p) => p.v);
  const lo = Math.floor(Math.min(...vs)) - 1, hi = Math.ceil(Math.max(...vs)) + 1;
  const base = H - B;
  const y = (v: number) => base - ((v - lo) / (hi - lo || 1)) * (base - T);
  const step = [30, 60, 120, 300, 600, 900].find((s) => (d1 - d0) / 1000 / s <= 8) ?? 1800;
  const ticks: number[] = [];
  for (let t = Math.ceil(d0 / 1000 / step) * step * 1000; t <= d1; t += step * 1000) ticks.push(t);
  const segs = segments(points, gaps);
  const pick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = d0 + ((e.clientX - r.left - L) / (w - L - R)) * (d1 - d0);
    let best = 0;
    stops.forEach((s, i) => { if (Math.abs(s - t) < Math.abs((stops[best] ?? 0) - t)) best = i; });
    onPick(best);
  };
  const tagW = 104;
  const codeX = code != null ? x(code) : null;

  return (
    <div ref={wrap} className="hc relative w-full">
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={labels.aria} onClick={pick} style={{ display: "block", cursor: "crosshair" }}>
        <defs>
          <pattern id="hc-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" className="hc-hatch-line" /></pattern>
          <linearGradient id="hc-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="hc-fill-top" /><stop offset="1" className="hc-fill-bottom" /></linearGradient>
        </defs>
        <line x1={L} x2={w - R} y1={base} y2={base} className="hc-axis" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={base} y2={base + 5} className="hc-axis" />
            <text x={x(t)} y={H - 8} textAnchor="middle" className="hc-tick">{hhmmss(t).slice(0, step >= 60 ? 5 : 8)}</text>
          </g>
        ))}
        {gaps.map((g) => (
          <g key={g.start}>
            <rect x={x(g.start)} y={T - 8} width={Math.max(2, x(g.end) - x(g.start))} height={base - T + 8} fill="url(#hc-hatch)" className="hc-gap" />
            {x(g.end) - x(g.start) > 96 && <text x={(x(g.start) + x(g.end)) / 2} y={(T + base) / 2 + 4} textAnchor="middle" className="hc-gap-label">{labels.gap}</text>}
          </g>
        ))}
        {segs.map((seg, i) => {
          const pts = seg.map((k) => points[k]!);
          const line = pts.map((p, k) => `${k ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
          const area = `${line} L${x(pts[pts.length - 1]!.t).toFixed(1)} ${base} L${x(pts[0]!.t).toFixed(1)} ${base} Z`;
          return <g key={i}><path d={area} fill="url(#hc-fill)" className="hc-area" /><path d={line} className="hc-line" /></g>;
        })}
        {points.map((p) => <circle key={p.t} cx={x(p.t)} cy={y(p.v)} r="3.4" className="hc-dot" />)}
        {codeX != null && (
          <g className="hc-code">
            <line x1={codeX} x2={codeX} y1={T - 8} y2={base} />
            <rect x={Math.min(codeX + 6, w - R - tagW)} y={4} width={tagW} height={22} rx="11" />
            <text x={Math.min(codeX + 6, w - R - tagW) + tagW / 2} y={19} textAnchor="middle">{labels.code}</text>
          </g>
        )}
        <line x1={x(cursor)} x2={x(cursor)} y1={T - 8} y2={base} className="hc-cursor" />
        <circle cx={x(cursor)} cy={T - 8} r="3.5" className="hc-cursor-head" />
      </svg>
    </div>
  );
}
