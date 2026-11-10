import { hhmmss } from "../lib/data";

/**
 * Session radar (Visor theme): one turn is 6 minutes (1° = 1 s) from the first reading; the sweep is the replay position, the
 * marks are the session events, the hatched arc is the capture gap. Decorative (aria-hidden): the event list says the same.
 */
export function Radar({ t0, cursor, events, gaps, note }: { t0: number; cursor: number; events: { t: number; alert: boolean }[]; gaps: { start: number; end: number }[]; note: string }) {
  const S = 240, c = S / 2, R = 104;
  const deg = (t: number) => (((t - t0) / 1000) % 360 + 360) % 360;
  const pt = (a: number, r: number) => [c + r * Math.sin((a * Math.PI) / 180), c - r * Math.cos((a * Math.PI) / 180)] as const;
  const arc = (a0: number, a1: number, r0: number, r1: number) => {
    const large = a1 - a0 > 180 ? 1 : 0;
    const [x0, y0] = pt(a0, r1), [x1, y1] = pt(a1, r1), [x2, y2] = pt(a1, r0), [x3, y3] = pt(a0, r0);
    return `M${x0} ${y0} A${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
  };
  const a = deg(cursor);
  return (
    <svg className="radar" viewBox={`0 0 ${S} ${S}`} aria-hidden>
      <defs>
        <pattern id="radar-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" className="radar-hatch" /></pattern>
      </defs>
      {[1, 0.66, 0.33].map((k) => <circle key={k} cx={c} cy={c} r={R * k} className="radar-ring" />)}
      {Array.from({ length: 72 }, (_, i) => i * 5).map((d) => { const [x1, y1] = pt(d, R), [x2, y2] = pt(d, d % 60 === 0 ? R - 10 : R - 4); return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} className={d % 60 === 0 ? "radar-tick-major" : "radar-tick"} />; })}
      {gaps.map((g) => <path key={g.start} d={arc(deg(g.start), deg(g.end), R * 0.46, R * 0.94)} fill="url(#radar-hatch)" className="radar-gap" />)}
      <path d={arc(Math.max(0, a - 28), a, 0, R)} className="radar-trail" />
      {(() => { const [x, y] = pt(a, R); return <line x1={c} y1={c} x2={x} y2={y} className="radar-sweep" />; })()}
      {events.map((e, i) => { const [x, y] = pt(deg(e.t), R * (e.alert ? 0.82 : 0.66)); return <rect key={i} x={x - 4} y={y - 4} width="8" height="8" transform={`rotate(45 ${x} ${y})`} className={e.alert ? "radar-ev radar-ev-alert" : "radar-ev"} data-past={e.t <= cursor ? "true" : undefined} />; })}
      <circle cx={c} cy={c} r={R * 0.42} className="radar-core" />
      <text x={c} y={c + 2} textAnchor="middle" className="radar-time">{hhmmss(cursor)}</text>
      <text x={c} y={c + 18} textAnchor="middle" className="radar-note">{note}</text>
    </svg>
  );
}
