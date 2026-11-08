import { Activity, ArrowRight, Boxes, FileSearch, Gauge, Layers, Radar } from "lucide-react";
import hero from "../assets/keyart.webp";
import { MODEL_URL } from "../viz/u1model";
import { Button, Chip, LedgerBars, Panel, ProvenanceChip, SeverityChip, Stat, StateBlock, TechDetails } from "../components/ui";
import { PageTitle } from "../components/shell";
import { hhmmss, tms, useIncident, val } from "../lib/data";
import { usePrefs } from "../lib/prefs";
import { errText } from "../lib/errors";
import { tok, tx } from "../lib/dyn";
import type { RouteName } from "../lib/router";
import { MiniStrip } from "../viz/HypothesisMap";
import { U1Viewer } from "../viz/U1Viewer";
import { RealCapturePanel } from "./real";
import { NoData } from "../components/nodata";
import { FirstSteps } from "../components/onboarding";

export function Overview({ go }: { go: (n: RouteName, p?: string) => void }) {
  const { t, lang } = usePrefs();
  const inc = useIncident();
  if (inc.status === "loading") return <StateBlock kind="loading" title={t.loading} />;
  if (inc.status === "error") return <StateBlock kind="error" title={t.error} body={errText(t, inc.error)} action={<Button onClick={inc.reload}>{t.retry}</Button>} />;

  const demo = inc.demo;
  const findings = demo ? inc.findings : [];
  const obs = demo ? inc.obs : [];
  const code = demo ? inc.code : null;
  const observed = findings.filter((f) => f.classification === "OBSERVED").length;
  const inconclusive = findings.filter((f) => f.classification === "INCONCLUSIVE").length;
  const forN = findings.reduce((a, f) => a + f.evidence_for.length, 0);
  const againstN = findings.reduce((a, f) => a + f.evidence_against.length, 0);
  const missingN = findings.reduce((a, f) => a + f.missing_data.length, 0);
  const dec = demo ? inc.decoding?.decoding : undefined;
  const paused = [...obs].reverse().find((o) => o.event_type === "state_transition" && val(o).state === "paused");
  const codeObs = obs.find((o) => o.event_type === "user_reported_error_code");

  return (
    <>
      <PageTitle title={t.nav.overview} sub={t.overviewSub} icon={<Radar size={26} />} />
      <div className="mb-d empty:hidden"><FirstSteps go={go} /></div>
      {!demo && <div className="mb-d"><NoData /></div>}
      <div className="grid gap-d xl:grid-cols-[minmax(0,1.618fr)_minmax(380px,1fr)]">
        <Panel title={t.machine} icon={<Boxes size={17} />} active brackets i={0} bodyClass="p-0" actions={<Chip tone="demo">{t.illustration}</Chip>} className="blueprint grain">
          <div className="scan-host relative h-[520px]"><div className="scan-sweep" aria-hidden />
          <U1Viewer className="h-full" src={MODEL_URL} fallbackSrc={hero} hotspotLabel={(n) => `${t.toolhead} ${n} · ${t.unmapped}`}
            text={{ autoRotate: t.viewer.autoRotate, explode: t.viewer.explode, reset: t.viewer.reset, loading: t.viewer.loading, unavailable: t.viewer.unavailable, hint: t.viewer.hint, partNote: t.viewer.partNote, door: t.viewer.door, bed: t.viewer.bed, head: t.viewer.head, illustrative: t.viewer.illustrative }} /></div>
          <p className="border-t border-line px-4 py-2 text-xs text-ink3">{t.viewer.disclaimer}</p>
        </Panel>

        <div className="grid grid-rows-[auto_1fr] gap-d">
          <Panel title={t.latestIncident} icon={<Activity size={17} />} i={1} actions={<SeverityChip level={dec?.severity} />}>
            {dec?.entry ? (
              <>
                <p className="text-xl font-semibold leading-7">{tx(lang, dec.entry.title)}</p>
                <p className="mt-1 text-ink2">{tx(lang, dec.entry.summary)}</p>
              </>
            ) : <p className="text-ink2">{t.noIncident}</p>}
            {/* provenance stays visible in every mode; only identifiers are folded */}
            {codeObs && <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="incident-provenance"><ProvenanceChip status="USER_REPORTED" /><ProvenanceChip status={codeObs.source_status} /></div>}
            <TechDetails className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono text-xs text-ink2">{code}</span>
                {paused && <span className="text-xs text-ink3">· {t.pausedAt} {hhmmss(tms(paused))} UTC</span>}
              </div>
            </TechDetails>
            <div className="mt-3"><MiniStrip obs={obs} gapLabel={t.gap} /></div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => go("timeline")}>{t.openTimeline}</Button>
              <Button icon={<FileSearch size={16} />} onClick={() => go("evidence")}>{t.openEvidence}</Button>
            </div>
          </Panel>

          <div className="grid gap-d sm:grid-cols-2 [&>section]:h-full">
            <Panel title={t.ledger} icon={<Layers size={17} />} i={2}>
              <LedgerBars forN={forN} againstN={againstN} missingN={missingN} />
              <p className="mt-3 text-xs text-ink3">{t.ledgerNote.replace("{n}", String(findings.length))}</p>
            </Panel>
            <Panel title={t.findings} icon={<Gauge size={17} />} i={3}>
              <div className="grid grid-cols-[1fr_auto] gap-4">
                <Stat value={observed} label={t.observedFacts} tone="ok" />
                <Stat value={inconclusive} label={t.inconclusive} tone="warn" />
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <div className="mt-[var(--gap)]"><RealCapturePanel /></div>

      <div className="mt-[var(--gap)]">
        <Panel title={t.dataAvail} i={4}>
          <ul className="grid gap-2 sm:grid-cols-2 min-[1500px]:grid-cols-4">
            {inc.compat?.capabilities.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface2 px-3 py-2">
                <span>{tx(lang, c.name)}</span>
                <Chip tone={c.status === "TESTED_REAL" ? "ok" : c.status === "TESTED_SYNTHETIC" ? "demo" : "neutral"}>{tok(lang, "status", c.status)}</Chip>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink3">{t.availNote}</p>
        </Panel>
      </div>
    </>
  );
}
