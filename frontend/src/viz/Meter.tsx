/**
 * Moving-coil meter (Console theme): the needle shows a reading of the replay position and swings to it with a small
 * overshoot. Decorative (aria-hidden): the same value is in the readings list next to it.
 */
export function Meter({ min, max, major, minor, value, label }: { min: number; max: number; major: number; minor: number; value: number | null; label: string }) {
  const W = 260, cx = 130, cy = 156, R = 112, A = 50; // the scale spans -50° to +50° from vertical
  const ang = (v: number) => -A + ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 2 * A;
  const pt = (a: number, r: number) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)] as const;
  const ticks: { v: number; big: boolean }[] = [];
  for (let v = min; v <= max + 1e-9; v += minor) ticks.push({ v, big: Math.abs((v - min) % major) < 1e-9 || Math.abs(((v - min) % major) - major) < 1e-9 });
  const [ax, ay] = pt(-A, R), [bx, by] = pt(A, R);
  return (
    <svg className="meter" viewBox={`0 0 ${W} 204`} aria-hidden>
      <rect x="4" y="4" width={W - 8} height="196" rx="14" className="meter-face" />
      <path d={`M${ax} ${ay} A${R} ${R} 0 0 1 ${bx} ${by}`} className="meter-arc" />
      {ticks.map(({ v, big }) => {
        const [x1, y1] = pt(ang(v), R), [x2, y2] = pt(ang(v), big ? R - 13 : R - 7);
        const [tx, ty] = pt(ang(v), R - 26);
        return (
          <g key={v}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} className={big ? "meter-major" : "meter-minor"} />
            {big && <text x={tx} y={ty + 4} textAnchor="middle" className="meter-num">{v}</text>}
          </g>
        );
      })}
      <text x={cx} y={cy + 34} textAnchor="middle" className="meter-label">{label}</text>
      <g className="meter-needle" style={{ transform: `rotate(${value == null ? -A - 4 : ang(value)}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
        <line x1={cx} y1={cy + 10} x2={cx} y2={cy - R + 4} />
      </g>
      <circle cx={cx} cy={cy} r="11" className="meter-hub" />
    </svg>
  );
}
