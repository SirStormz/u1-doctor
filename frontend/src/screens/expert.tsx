import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, FileText, ListChecks, Pause, Play, Radar, Share, Thermometer } from "lucide-react";
import { useReducedMotion } from "motion/react";
import type { Finding, Observation } from "../api";
import { Button, Chip, Panel } from "../components/ui";
import { PageTitle } from "../components/shell";
import { NoData } from "../components/nodata";
import { FirstSteps } from "../components/onboarding";
import { hhmmss, tms, useIncident, val } from "../lib/data";
import { usePrefs } from "../lib/prefs";
import { entityLabel, eventLabel, stateLabel, tok, tx } from "../lib/dyn";
import { ALLOW } from "../lib/allowlist";
import type { RouteName } from "../lib/router";
import { renderFor, type Spot } from "../themes/renders";
import { HeadCurve } from "../viz/HeadCurve";
import { LiquidDefs } from "../viz/LiquidDefs";
import { Meter } from "../viz/Meter";
import { Radar as SessionRadar } from "../viz/Radar";
import { RealCapturePanel } from "./real";

type Go = (n: RouteName, p?: string) => void;
const CLS = ["OBSERVED", "SUSPECTED", "INCONCLUSIVE", "REFUTED"] as const;
type Cls = (typeof CLS)[number];
const ORDER: Record<string, number> = { OBSERVED: 0, SUSPECTED: 1, INCONCLUSIVE: 2, REFUTED: 3 };
const clean = (s: string) => s.replace(/^SYNTHETIC: /, "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
/** last observation at or before t */
const lastAt = (list: Observation[], t: number) => { let hit: Observation | undefined; for (const o of list) { if (tms(o) <= t) hit = o; else break; } return hit; };
/** short rule label: "U1-S01-CODE-DECODE" -> "S01" */
export const ruleShort = (id: string) => /-(S\d+)-/.exec(id)?.[1] ?? id;

/** Stage of the machine figure: wider than the render, so the reading labels sit beside the printer, not on it. */
const STAGE_AR = 1.2;

/**
 * UI V2 Expert home: the layers the Simple home folds, unfolded in one page. Everything shown is computed from the loaded
 * session (demo, labelled) and the decoded code: the incident title, the readings at the replay position on the owner's render,
 * the temperature of the toolhead the code names (with the capture gap), the findings, the replay and the way to share.
 */
export function ExpertHome({ go }: { go: Go }) {
  const { t, lang, theme } = usePrefs();
  const inc = useIncident();
  const X = t.ex;
  const reduce = useReducedMotion();
  const demo = inc.demo;
  const obs = useMemo(() => (demo ? [...inc.obs].sort((a, b) => tms(a) - tms(b)) : []), [demo, inc.obs]);
  const stops = useMemo(() => [...new Set(obs.map(tms))].sort((a, b) => a - b), [obs]);
  const [idx, setIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const replayRef = useRef<HTMLDivElement>(null);
  const index = Math.min(idx ?? stops.length - 1, stops.length - 1);
  const cursor = stops[index] ?? 0;

  useEffect(() => {
    if (!playing) return;
    if (index >= stops.length - 1) { setPlaying(false); return; }
    const h = window.setTimeout(() => setIdx(index + 1), 700);
    return () => window.clearTimeout(h);
  }, [playing, index, stops.length]);

  if (!demo) {
    return (
      <>
        <PageTitle title={t.home.empty} sub={t.home.emptyBody} icon={<Radar size={26} />} />
        <div className="mb-d empty:hidden"><FirstSteps go={go} /></div>
        <div className="mb-d"><NoData /></div>
        <RealCapturePanel />
      </>
    );
  }

  const findings = [...inc.findings].sort((a, b) => (ORDER[a.classification] ?? 9) - (ORDER[b.classification] ?? 9));
  const d = inc.decoding?.decoding;
  const entry = d?.entry ?? null;
  const head = entry?.toolhead && entry.toolhead >= 1 && entry.toolhead <= 4 ? entry.toolhead : null;
  const codeObs = obs.find((o) => o.event_type === "user_reported_error_code");
  const codeFinding = codeObs ? findings.find((f) => f.evidence_for.some((e) => e.observation_id === codeObs.observation_id)) : undefined;
  const t0 = tms(obs[0]!), t1 = tms(obs[obs.length - 1]!);
  const dur = Math.round((t1 - t0) / 1000);
  const day = new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(t0));
  const counts = CLS.map((c) => [c, findings.filter((f) => f.classification === c).length] as const).filter(([, n]) => n > 0);
  const forN = findings.reduce((a, f) => a + f.evidence_for.length, 0);
  const againstN = findings.reduce((a, f) => a + f.evidence_against.length, 0);
  const missingN = findings.reduce((a, f) => a + f.missing_data.length, 0);
  const num = (v: number, k = 1) => (lang === "fr" ? v.toFixed(k).replace(".", ",") : v.toFixed(k));

  const nozzleObs = head ? obs.filter((o) => o.event_type === "temperature_sample" && o.entity_id === `toolhead_${head}`) : [];
  const bedObs = obs.filter((o) => o.event_type === "bed_temperature_sample");
  const stateObs = obs.filter((o) => o.event_type === "state_transition");
  const gaps = obs.filter((o) => o.event_type === "capture_gap").map((o) => ({ start: Date.parse(String(val(o).start)), end: Date.parse(String(val(o).end)) })).filter((g) => Number.isFinite(g.start) && Number.isFinite(g.end));
  const points = nozzleObs.map((o) => ({ t: tms(o), v: Number(val(o).celsius) })).filter((p) => Number.isFinite(p.v));
  const lo = points.length ? Math.floor(Math.min(...points.map((p) => p.v))) : 0;
  const hi = points.length ? Math.ceil(Math.max(...points.map((p) => p.v))) : 0;

  interface Reading { id: string; spot: Spot; label: string; value: string | null; at: number | null; tag: string | null; alert?: boolean; num?: number | null }
  const reading = (id: string, spot: Spot, label: string, list: Observation[], show: (o: Observation) => string): Reading => {
    const o = lastAt(list, cursor);
    const n = o ? Number(val(o).celsius) : NaN;
    return { id, spot, label, value: o ? show(o) : null, at: o ? tms(o) : null, num: Number.isFinite(n) ? n : null, tag: o ? `${entityLabel(lang, o.entity_id)} · ${tok(lang, "mapping", o.mapping_quality).toLowerCase()}` : null };
  };
  const readings: Reading[] = [
    ...(head ? [reading("nozzle", `head${head}` as Spot, fill(X.nozzle, { n: head }), nozzleObs, (o) => `${num(Number(val(o).celsius))} °C`)] : []),
    { ...reading("state", "screen", X.state, stateObs, (o) => cap(stateLabel(lang, String(val(o).state)).toLowerCase())), alert: ["paused", "error"].includes(String(val(lastAt(stateObs, cursor) ?? ({} as Observation)).state)) },
    reading("bed", "bed", X.bed, bedObs, (o) => `${num(Number(val(o).celsius))} °C`),
  ];

  const here = obs.filter((o) => tms(o) === cursor);
  const camSpot: Spot | null = !playing ? null
    : here.some((o) => o.event_type === "user_reported_error_code") && head ? (`head${head}` as Spot)
    : here.some((o) => o.event_type === "state_transition") ? "screen"
    : here.some((o) => nozzleObs.includes(o)) && head ? (`head${head}` as Spot)
    : here.some((o) => o.event_type === "bed_temperature_sample") ? "bed" : null;
  const replayFromStart = () => {
    setIdx(0); setPlaying(true);
    replayRef.current?.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "center" });
  };
  const events = obs.filter((o) => ["state_transition", "user_reported_error_code", "capture_gap"].includes(o.event_type));
  const eventText = (o: Observation) => o.event_type === "state_transition" ? `${t.stateChange} : ${stateLabel(lang, String(val(o).state)).toLowerCase()}` : o.event_type === "user_reported_error_code" ? `${t.codeReported} : ${String(val(o).code)}` : t.gap;
  const basis = (f: Finding) => [...new Set(f.evidence_for.map((e) => obs.find((o) => o.observation_id === e.observation_id)?.event_type).filter((x): x is string => !!x))].map((e) => eventLabel(lang, e)).join(", ");

  return (
    <div className="ex">
      <div className="ex-hero grid gap-d xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="ex-head grid content-start gap-4">
          <p className="ex-kicker reveal"><Chip tone="demo">{X.session}</Chip> <span className="mono">{fill(X.span, { d: day, a: hhmmss(t0), b: hhmmss(t1) })}</span></p>
          <PageTitle title={entry ? tx(lang, entry.title) : t.nav.overview} icon={<Radar size={26} />} />
          {inc.code && <p className="ex-code mono reveal" data-testid="ex-code">{inc.code}</p>}
          <p className="ex-summary reveal text-ink2">
            {fill(X.summary, { n: findings.length, parts: counts.map(([c, n]) => `${n} ${X.cls[c as Cls]}`).join(" · ") })}<br />
            {fill(X.evidence, { f: forN, a: againstN, m: missingN })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Play size={16} />} onClick={replayFromStart}>{X.replay}</Button>
            <Button variant="primary" icon={<FileText size={16} />} onClick={() => go("report")}>{X.export}</Button>
          </div>
          <Panel title={X.facts} i={1} className="ex-facts">
            <dl className="ex-dl">
              {codeFinding && <><dt>{X.rule}</dt><dd className="mono">{codeFinding.rule_id}</dd></>}
              {inc.decoding && <><dt>{X.source}</dt><dd><a href={inc.decoding.official_reference} target="_blank" rel="noreferrer noopener">{fill(X.sourceVal, { d: inc.decoding.catalog_verified_at })}</a></dd></>}
              {codeObs && <><dt>{X.headLink}</dt><dd>{cap(tok(lang, "mapping", codeObs.mapping_quality).toLowerCase())}</dd></>}
              <dt>{X.duration}</dt><dd className="mono">{Math.floor(dur / 60)} min {String(dur % 60).padStart(2, "0")} s</dd>
              <dt>{X.access}</dt><dd>{fill(X.accessVal, { r: ALLOW.filter(([m]) => m === "GET").length, s: ALLOW.filter(([m]) => m === "WS").length })}</dd>
            </dl>
          </Panel>
        </div>
        <ExpertFigure readings={readings} head={head} theme={theme} label={X.readings} atLabel={X.at} none={X.none} focus={camSpot} />
      </div>

      {points.length > 0 && head && (
        <Panel title={fill(X.curve, { n: head })} icon={<Thermometer size={17} />} i={2} className="ex-curve mt-[var(--gap)]" actions={<span className="mono text-xs text-ink3">{fill(X.range, { lo, hi })}</span>}>
          <HeadCurve points={points} gaps={gaps} t0={t0} t1={t1} cursor={cursor} code={codeObs ? tms(codeObs) : null} stops={stops} onPick={(i) => { setPlaying(false); setIdx(i); }}
            labels={{ gap: X.gap, code: codeObs ? fill(X.code, { t: hhmmss(tms(codeObs)) }) : "", aria: fill(X.curveAria, { n: head, lo, hi, a: hhmmss(points[0]!.t), b: hhmmss(points[points.length - 1]!.t) }) + gaps.map((g) => " " + fill(X.curveGap, { a: hhmmss(g.start), b: hhmmss(g.end) })).join("") }} />
        </Panel>
      )}

      <Panel title={t.findings} icon={<ListChecks size={17} />} i={3} bodyClass="p-0" className="ex-findings mt-[var(--gap)]">
        <div className="overflow-x-auto">
          <table className="ex-table w-full text-left">
            <caption className="sr-only">{t.findings}</caption>
            <thead><tr><th>{X.thRule}</th><th>{X.thFinding}</th><th>{X.thStatus}</th><th>{X.thBasis}</th><th><span className="sr-only">{t.open}</span></th></tr></thead>
            <tbody>
              {findings.map((f, k) => (
                <tr key={f.finding_id} className="rowin rowhover" style={{ "--i": k } as CSSProperties}>
                  <td className="mono" title={f.rule_id}>{ruleShort(f.rule_id)}</td>
                  <td>{tx(lang, clean(f.human_title))}</td>
                  <td><span className="ex-status" data-cls={f.classification}>{X.status[f.classification as Cls] ?? tok(lang, "classification", f.classification)}</span></td>
                  <td className="text-ink2">{basis(f)}</td>
                  <td className="text-right"><button type="button" className="btn btn-ghost !py-1" onClick={() => go("evidence", f.finding_id)} aria-label={`${t.open} · ${ruleShort(f.rule_id)}`}>{t.open}<ArrowRight size={15} aria-hidden /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-[var(--gap)] grid gap-d lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)]">
        <div ref={replayRef} className="min-w-0">
          <Panel title={X.replay} icon={<Play size={17} />} i={4} className="ex-replay" actions={<span className="text-xs text-ink3">{X.replayNote}</span>}>
            <div className="ex-replay-body">
            <SessionRadar t0={t0} cursor={cursor} note={t.sig.radarTurn} gaps={gaps}
              events={events.filter((o) => o.event_type !== "capture_gap").map((o) => ({ t: tms(o), alert: o.event_type === "user_reported_error_code" || (o.event_type === "state_transition" && ["paused", "error"].includes(String(val(o).state))) }))} />
            <div className="min-w-0">
            <div className="ex-transport flex items-center gap-3">
              <Button variant="primary" className="ex-play" aria-label={playing ? X.pause : X.play} icon={playing ? <Pause size={18} /> : <Play size={18} />}
                onClick={() => { if (playing) setPlaying(false); else { if (index >= stops.length - 1) setIdx(0); setPlaying(true); } }} />
              <input type="range" className="ex-range min-w-0 flex-1" min={0} max={Math.max(0, stops.length - 1)} step={1} value={index} aria-label={X.position} aria-valuetext={`${hhmmss(cursor)} UTC`}
                onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }} style={{ "--p": `${(index / Math.max(1, stops.length - 1)) * 100}%` } as CSSProperties} />
              <output className="ex-time mono" aria-live="off">{hhmmss(cursor)}</output>
            </div>
            <ul className="ex-events mt-4 grid gap-1.5 sm:grid-cols-2" aria-label={X.events}>
              {events.map((o) => {
                const i = stops.indexOf(tms(o));
                return (
                  <li key={o.observation_id}>
                    <button type="button" className="ex-event" data-kind={o.event_type} aria-current={i === index ? "true" : undefined} onClick={() => { setPlaying(false); setIdx(i); }}>
                      <span className="mono">{hhmmss(tms(o))}</span><span>{eventText(o)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            </div>
            </div>
          </Panel>
        </div>
        <Panel title={X.share} icon={<Share size={17} />} i={5} className="ex-share">
          <p className="text-ink2">{t.reportSub}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" icon={<FileText size={16} />} onClick={() => go("report")}>{X.export}</Button>
          </div>
        </Panel>
      </div>

      <div className="mt-[var(--gap)]"><RealCapturePanel /></div>
    </div>
  );
}

/** The owner's render with the readings at the replay position: labels with a leader line on wide screens, a list everywhere (the list is what assistive tech reads). */
function ExpertFigure({ readings, head, theme, label, atLabel, none, focus }: {
  readings: { id: string; spot: Spot; label: string; value: string | null; at: number | null; tag: string | null; alert?: boolean; num?: number | null }[];
  head: number | null; theme: Parameters<typeof renderFor>[0]; label: string; atLabel: string; none: string; focus: Spot | null;
}) {
  const { t } = usePrefs();
  const hero = renderFor(theme, "hero");
  const ar = hero.width / hero.height;
  const sx = (x: number) => 50 + (x - 50) * (ar / STAGE_AR); // image % -> stage %
  const cam = focus ? hero.at(focus) : null;
  const headAt = head ? hero.at(`head${head}` as Spot) : null;
  const LENS = 150, ZOOM = 3.8; // lens diameter (px) and magnification of the render inside it
  const nozzle = readings.find((r) => r.id === "nozzle"), bed = readings.find((r) => r.id === "bed");
  const place = (id: string, a: { x: number; y: number }) => id === "nozzle" ? { side: "r" as const, x: 72, y: Math.max(4, a.y - 30) } : { side: "l" as const, x: 30, y: id === "state" ? a.y - 9 : a.y + 1 };
  return (
    <figure className="ex-figure m-0" aria-label={label}>
      <LiquidDefs />
      <div className="ex-stage" data-cam={focus ?? undefined} style={{ "--ar": STAGE_AR, "--iar": ar } as CSSProperties}>
        <div className="ex-cam"><div className="ex-cam-in" style={cam ? { transformOrigin: `${sx(cam.x)}% ${cam.y}%` } : undefined}>
          <img src={hero.src} alt={head ? t.home.imgAlt.replace("{n}", String(head)) : t.home.imgAltNone} width={hero.width} height={hero.height} className="ex-img" />
        </div></div>
        <div className="ex-overlay" aria-hidden>
          {headAt && (
            <span className="ex-lens" style={{ left: `${sx(headAt.x)}%`, top: `${headAt.y}%`, width: LENS, height: LENS, backgroundImage: `url(${hero.src})`,
              backgroundSize: `${LENS * ZOOM}px auto`, backgroundPosition: `${LENS / 2 - (headAt.x / 100) * LENS * ZOOM}px ${LENS / 2 - (headAt.y / 100) * ((LENS * ZOOM) / ar)}px` } as CSSProperties} />
          )}
          <svg className="ex-leaders" viewBox="0 0 100 100" preserveAspectRatio="none">
            {readings.map((r) => {
              const a = hero.at(r.spot); if (!a) return null;
              const p = place(r.id, a), ax = sx(a.x);
              return <line key={r.id} x1={p.x} y1={p.y + 4} x2={ax} y2={a.y} vectorEffect="non-scaling-stroke" />;
            })}
          </svg>
          {readings.map((r, k) => {
            const a = hero.at(r.spot); if (!a) return null;
            const p = place(r.id, a);
            return (
              <span key={r.id}>
                <span className="ex-pin" data-id={r.id} data-on={focus === r.spot ? "true" : undefined} style={{ left: `${sx(a.x)}%`, top: `${a.y}%` }}><span>{k + 1}</span></span>
                <span className="ex-callout" data-id={r.id} data-side={p.side} data-alert={r.alert ? "true" : undefined} style={{ [p.side === "l" ? "right" : "left"]: `${p.side === "l" ? 100 - p.x : p.x}%`, top: `${p.y}%` } as CSSProperties}>
                  <span className="ex-callout-k">{r.label}</span>
                  <span className="ex-callout-v">{r.value ?? none}</span>
                  {r.tag && <span className="ex-callout-t mono">{r.tag}</span>}
                </span>
              </span>
            );
          })}
        </div>
      </div>
      <div className="ex-meters" aria-hidden>
        {nozzle && head && <Meter min={0} max={300} major={100} minor={20} value={nozzle.num ?? null} label={t.sig.meterNozzle.replace("{n}", String(head))} />}
        {bed && <Meter min={0} max={120} major={20} minor={5} value={bed.num ?? null} label={t.sig.meterBed} />}
      </div>
      <ol className="ex-readings">
        {readings.map((r, k) => (
          <li key={r.id} data-id={r.id}>
            <span className="ex-readings-n" aria-hidden>{k + 1}</span>
            <span className="min-w-0 flex-1"><strong>{r.label}</strong> · {r.value ?? none}{r.at != null && <span className="text-ink3"> · {atLabel.replace("{t}", hhmmss(r.at))}</span>}</span>
            {r.tag && <span className="ex-readings-t mono">{r.tag}</span>}
          </li>
        ))}
      </ol>
      <figcaption className="ex-caption">{t.home.illustration}</figcaption>
    </figure>
  );
}
