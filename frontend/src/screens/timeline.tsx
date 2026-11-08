import { useEffect, useMemo, useState } from "react";
import { Activity, Clock, Table2, Waypoints } from "lucide-react";
import { Button, Chip, Hint, Panel, ProvenanceChip, Seal, StateBlock, TimeChip } from "../components/ui";
import { PageTitle } from "../components/shell";
import { NoData } from "../components/nodata";
import { hhmmss, tms, useIncident, val } from "../lib/data";
import { usePrefs } from "../lib/prefs";
import { errText } from "../lib/errors";
import { entityLabel, eventLabel, stateLabel, tok, tx } from "../lib/dyn";
import { ReconPanel } from "./recon";
import { HistoryView } from "./history";
import { HypothesisMap } from "../viz/HypothesisMap";
import { deriveSeries, segments, SignalChart } from "../viz/SignalChart";

function DemoTimeline() {
  const { t, lang } = usePrefs();
  const inc = useIncident();
  const stops = useMemo(() => [...new Set(inc.obs.map(tms))].sort((a, b) => a - b), [inc.obs]);
  const [idx, setIdx] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const series = useMemo(() => deriveSeries(inc.obs), [inc.obs]);
  if (inc.status !== "ready") return <StateBlock kind={inc.status === "error" ? "error" : "loading"} title={inc.status === "error" ? t.error : t.loading} body={inc.status === "error" ? errText(t, inc.error) : undefined} />;
  if (!inc.demo) return <><PageTitle title={t.nav.timeline} sub={t.timelineSub} icon={<Activity size={26} />} /><NoData /></>;
  if (!inc.obs.length) return <StateBlock kind="empty" title={t.empty} />;

  const events = inc.obs.filter((o) => ["state_transition", "user_reported_error_code", "capture_gap"].includes(o.event_type)).sort((a, b) => tms(a) - tms(b));
  const pausedIdx = stops.findIndex((s) => events.find((e) => tms(e) === s && e.event_type === "state_transition" && val(e).state === "paused"));
  const index = idx ?? (pausedIdx >= 0 ? pausedIdx : stops.length - 1);
  const cursor = stops[index] ?? 0;
  const label = (o: (typeof events)[number]) => o.event_type === "state_transition" ? `${t.stateChange} : ${stateLabel(lang, String(val(o).state)).toLowerCase()}` : o.event_type === "user_reported_error_code" ? `${t.codeReported} : ${String(val(o).code)}` : t.gap;

  return (
    <>
      <PageTitle title={t.nav.timeline} sub={t.timelineSub} icon={<Activity size={26} />}
        actions={<Button icon={<Table2 size={16} />} aria-pressed={table} onClick={() => setTable((x) => !x)}>{table ? t.chartView : t.tableView}</Button>} />
      <Hint id="timeline" className="mb-d" />
      <div className="grid gap-d xl:grid-cols-[270px_minmax(0,1fr)_350px]">
        <Panel title={t.events} icon={<Clock size={17} />} i={0} bodyClass="p-2">
          <ul className="grid gap-1" aria-label={t.events}>
            {events.map((e) => {
              const i = stops.indexOf(tms(e));
              const on = i === index;
              return (
                <li key={e.observation_id}>
                  <button type="button" onClick={() => setIdx(i)} aria-current={on ? "true" : undefined} className="w-full rounded-lg border px-3 py-2 text-left transition-colors" style={{ borderColor: on ? "var(--accent)" : "transparent", background: on ? "color-mix(in srgb, var(--accent) 10%, var(--surface-1))" : "transparent" }}>
                    <span className="mono text-xs text-ink2">{hhmmss(tms(e))}</span>
                    <span className="mt-0.5 block font-medium">{label(e)}</span>
                    <span className="mt-1 flex flex-wrap gap-1"><ProvenanceChip status={e.source_status} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title={t.reconstruction} icon={<Activity size={17} />} active brackets i={1} className="blueprint" actions={<TimeChip q="RECEIPT_ONLY" />}>
          {table ? (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{t.tableView}</caption>
                <thead className="text-ink3"><tr><th className="py-1 pr-3">{t.th.utc}</th><th className="pr-3">{t.th.event}</th><th className="pr-3">{t.th.entity}</th><th className="pr-3">{t.th.value}</th><th>{t.th.provenance}</th></tr></thead>
                <tbody>{[...inc.obs].sort((a, b) => tms(a) - tms(b)).map((o) => (
                  <tr key={o.observation_id} className="border-t border-line"><td className="mono py-1 pr-3 text-xs">{hhmmss(tms(o))}</td><td className="pr-3">{eventLabel(lang, o.event_type)}</td><td className="pr-3">{entityLabel(lang, o.entity_id)} ({tok(lang, "mapping", o.mapping_quality)})</td><td className="mono pr-3 text-xs">{JSON.stringify(o.value)}</td><td><ProvenanceChip status={o.source_status} /></td></tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <>
              <SignalChart obs={inc.obs} stops={stops} index={index} onIndex={setIdx} labels={{ gap: t.gapLabel, receipt: t.receiptTime, slider: t.sliderLabel }} />
              <p className="mt-2 text-xs text-ink3">{t.chartHelp}</p>
              <h3 className="mt-4 mb-2 flex items-center gap-2 text-sm font-semibold"><Waypoints size={15} aria-hidden />{t.atCursor} <span className="mono text-accent">{hhmmss(cursor)} UTC</span></h3>
              <ul className="grid gap-2">
                {series.lanes.map((ln) => {
                  const prior = ln.points.filter((p) => p.t <= cursor).pop();
                  const gapBetween = prior && series.gaps.some((g) => g.start < cursor && g.end > prior.t);
                  const stale = !prior || gapBetween || (ln.kind === "line" && cursor - prior.t > 120000);
                  return (
                    <li key={ln.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface2 px-3 py-2">
                      <span className="w-40 font-medium">{tx(lang, ln.label)}</span>
                      {prior && !stale ? (<><span className="mono text-base font-semibold">{ln.kind === "line" ? `${lang === "fr" ? Number(prior.v).toFixed(1).replace(".", ",") : Number(prior.v).toFixed(1)} ${ln.unit}` : (ln.id === "state" ? stateLabel(lang, String(prior.v)) : String(prior.v))}</span><ProvenanceChip status={prior.o.source_status} /><Chip>{ln.kind === "line" ? ln.id === "nozzle" ? tok(lang, "mapping", prior.o.mapping_quality) : tok(lang, "mapping", "VERIFIED") : tok(lang, "mapping", prior.o.mapping_quality)}</Chip></>) : (<Chip tone="warn">{t.noData}</Chip>)}
                      {segments(ln.points, series.gaps).length > 1 && <span className="text-xs text-ink3">{t.noInterp}</span>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Panel>

        <div className="col-fill">
          <Panel title={t.hypotheses} icon={<Waypoints size={17} />} i={2}>
            <HypothesisMap findings={inc.findings} labels={{ fact: t.fact, hyp: t.hypothesis, gap: t.gapNode, gapText: t.gapNodeText, prox: t.proximity, ref: t.officialRef, may: t.mayHide, aria: t.hypMapAria }} />
            <p className="mt-2 text-xs text-ink3">{t.hypLegend}</p>
          </Panel>
          {inc.replay && <Seal ok={inc.replay.matches_golden} label={inc.replay.matches_golden ? t.sameResult : t.differs} sub={t.replaySeal} hash={inc.replay.findings_sha256} />}
        </div>
      </div>
    </>
  );
}

/** Timeline screen: the synthetic demo incident, or the real H-02 capture. Never mixed. */
export function Timeline() {
  const { t } = usePrefs();
  const inc = useIncident();
  const [src, setSrc] = useState<"demo" | "real" | "history">(inc.demo ? "demo" : "history");
  useEffect(() => { setSrc((s) => (inc.demo ? "demo" : s === "demo" ? "history" : s)); }, [inc.demo]);
  const opts: ["demo" | "real" | "history", string][] = [["demo", t.recon.demo], ["real", t.recon.real], ["history", t.histName]];
  return (
    <>
      <div role="group" aria-label={t.recon.sel} className="mb-4 flex flex-wrap items-center gap-2">
        <span className="micro">{t.recon.sel}</span>
        {opts.map(([k, label]) => <Button key={k} variant={src === k ? "primary" : "secondary"} aria-pressed={src === k} onClick={() => setSrc(k)}>{label}</Button>)}
      </div>
      {src === "demo" ? (
        <>
          <DemoTimeline />
          {inc.demo && <div className="mt-4"><ReconPanel source="synthetic:demo_extrusion_blockage" /></div>}
        </>
      ) : src === "real" ? (
        <>
          <PageTitle title={t.nav.timeline} sub={t.timelineSub} icon={<Activity size={26} />} />
          <ReconPanel source="real:h02_normal_print" />
        </>
      ) : (
        <>
          <PageTitle title={t.nav.timeline} sub={t.timelineSub} icon={<Activity size={26} />} />
          <HistoryView />
        </>
      )}
    </>
  );
}
