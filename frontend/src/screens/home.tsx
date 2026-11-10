import { ArrowRight, BookOpen, Boxes, CircleQuestionMark, Hash, Layers, ListChecks, Radar, ScanEye } from "lucide-react";
import { Button, Chip, Hint, Panel, ProvenanceChip, Stat, TechDetails } from "../components/ui";
import { PageTitle } from "../components/shell";
import { hhmmss, tms, useIncident, val } from "../lib/data";
import { usePrefs } from "../lib/prefs";
import { tx } from "../lib/dyn";
import type { RouteName } from "../lib/router";
import { MiniStrip } from "../viz/HypothesisMap";
import { renderFor, type Shot } from "../themes/renders";
import { RealCapturePanel } from "./real";
import { NoData } from "../components/nodata";
import { FirstSteps } from "../components/onboarding";

/** Official action keys, shown inspection first, then action, then resume (the table gives no order; this is display only). */
const ORDER = ["check_path_obstruction", "check_cable", "check_dock", "unload_filament", "clean", "load_filament", "maintenance", "home_axes", "power_cycle",
  "update_firmware", "restore_factory_settings", "resume_from_screen", "retry", "reslice_with_orca", "export_logs", "contact_support", "see_article"];
/** Which render illustrates an action: the toolheads for hands-on gestures, the screen for what is done on it. */
const SHOT: Partial<Record<string, Shot>> = {
  check_path_obstruction: "tetes", clean: "tetes", unload_filament: "tetes", load_filament: "tetes", check_dock: "tetes",
  resume_from_screen: "ecran", retry: "ecran", home_axes: "ecran", power_cycle: "ecran", update_firmware: "ecran", restore_factory_settings: "ecran", export_logs: "ecran",
};

/**
 * UI V2 home (Simple mode): the mockups' layout, filled only from the data the app holds. The verdict sentence follows the decoded
 * code's severity and the findings; the steps are the official table's actions for that code; nothing is estimated or invented.
 */
export function Home({ go }: { go: (n: RouteName, p?: string) => void }) {
  const { t, lang, theme } = usePrefs();
  const inc = useIncident();
  const H = t.home;
  const demo = inc.demo;
  const findings = demo ? inc.findings : [];
  const obs = demo ? inc.obs : [];
  const d = demo ? inc.decoding?.decoding : undefined;
  const entry = d?.entry ?? null;
  const observed = findings.filter((f) => f.classification === "OBSERVED").length;
  const toCheck = findings.filter((f) => f.classification === "INCONCLUSIVE").length;
  const missing = findings.reduce((a, f) => a + f.missing_data.length, 0);
  const head = entry?.toolhead && entry.toolhead >= 1 && entry.toolhead <= 4 ? entry.toolhead : null;
  const verdict = !demo ? H.empty : d?.severity === "error" || d?.severity === "warning" ? H.needsLook : findings.length ? H.toCheck : H.nothing;
  const sub = !demo ? H.emptyBody : entry ? tx(lang, entry.title) : findings.length ? undefined : H.nothingNote;
  const actions = [...(entry?.actions ?? [])].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const general = actions.length ? [] : [...new Set(findings.flatMap((f) => f.safe_actions))].slice(0, 3);
  const codeObs = obs.find((o) => o.event_type === "user_reported_error_code");
  const paused = [...obs].reverse().find((o) => o.event_type === "state_transition" && val(o).state === "paused");
  const hero = renderFor(theme, "hero");
  const mark = head ? hero.at(`head${head}` as "head1") : null;
  const day = obs.length ? new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(tms(obs[0]!))) : null;

  return (
    <>
      <PageTitle title={verdict} sub={sub} icon={<Radar size={26} />} />
      <div className="mb-d empty:hidden"><FirstSteps go={go} /></div>
      {!demo && <div className="mb-d"><NoData /></div>}

      <div className="grid gap-d xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="col-fill">
          {demo && (
            <Panel title={H.todo} icon={<ListChecks size={17} />} active i={0} actions={head ? <Chip tone="accent">{H.head.replace("{n}", String(head))} · {H.headNote}</Chip> : undefined}>
              <p className="micro mb-3">{actions.length ? H.todoSub : H.todoGeneral}</p>
              <ol className="home-steps grid gap-3">
                {(actions.length ? actions.map((a) => ({ k: a, text: t.actions[a as keyof typeof t.actions] ?? a, shot: SHOT[a] })) : general.map((g) => ({ k: g, text: tx(lang, g), shot: undefined }))).map((s, i) => {
                  const r = s.shot ? renderFor(theme, s.shot) : null;
                  const at = r ? (s.shot === "ecran" ? r.at("screen") : head ? r.at(`head${head}` as "head1") : null) : null;
                  return (
                    <li key={s.k} className="home-step">
                      <span className="home-step-n" aria-hidden>{i + 1}</span>
                      <span className="min-w-0 flex-1">{s.text}</span>
                      {r && at && <span className="home-step-img" aria-hidden style={{ backgroundImage: `url(${r.src})`, backgroundPosition: `${at.x}% ${at.y}%`, backgroundSize: s.shot === "ecran" ? "320% auto" : "150% auto" }} />}
                    </li>
                  );
                })}
              </ol>
              {entry?.summary && <p className="mt-3 text-sm text-ink2">{tx(lang, entry.summary)}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {codeObs && <span className="flex flex-wrap gap-2" data-testid="incident-provenance"><ProvenanceChip status="USER_REPORTED" /><ProvenanceChip status={codeObs.source_status} /></span>}
                {entry?.article && <a className="btn btn-secondary ml-auto !py-1.5 text-sm" href={entry.article.url} target="_blank" rel="noreferrer"><BookOpen size={15} aria-hidden />{H.official}</a>}
              </div>
              <TechDetails className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono text-xs text-ink2">{inc.code}</span>
                  {paused && <span className="text-xs text-ink3">· {t.pausedAt} {hhmmss(tms(paused))} UTC</span>}
                </div>
              </TechDetails>
            </Panel>
          )}
          {(
            <Panel title={H.howKnow} icon={<Layers size={17} />} i={2}>
              <div className="grid grid-cols-3 gap-4">
                <Stat value={observed} label={H.facts} tone="ok" />
                <Stat value={toCheck} label={H.check} tone="warn" />
                <Stat value={missing} label={H.missing} />
              </div>
              <Hint id="marks" className="mt-3" />
              {demo && <Button className="mt-4" variant="primary" icon={<ArrowRight size={16} />} onClick={() => go("findings")}>{H.seeEvidence}</Button>}
            </Panel>
          )}
        </div>

        <Panel title={t.machine} icon={<Boxes size={17} />} i={1} bodyClass="p-0" actions={<Chip tone="demo">{t.illustration}</Chip>}>
          <figure className="home-figure m-0" style={{ "--ar": hero.width / hero.height } as React.CSSProperties}>
            <img src={hero.src} alt={head ? H.imgAlt.replace("{n}", String(head)) : H.imgAltNone} width={hero.width} height={hero.height} className="h-full w-full object-contain" />
            {mark && <span className="home-lens" aria-hidden style={{ left: `${mark.x}%`, top: `${mark.y}%`, backgroundImage: `url(${hero.src})`, backgroundPosition: `${mark.x}% ${mark.y}%` }} />}
            {mark && (
              <span className="home-mark" aria-hidden style={{ left: `${mark.x}%`, top: `${mark.y}%` }}>
                <span className="home-ring" /><span className="home-tag">{H.head.replace("{n}", String(head))}</span>
              </span>
            )}
          </figure>
          <p className="border-t border-line px-4 py-2 text-xs text-ink3">{H.illustration}</p>
        </Panel>
      </div>

      <div className="mt-[var(--gap)] grid gap-d lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)]">
        {demo && (
          <Panel title={H.happened} icon={<ScanEye size={17} />} i={3} actions={day ? <Chip tone="demo">{day} · {H.example}</Chip> : undefined}>
            <MiniStrip obs={obs} gapLabel={t.gap} />
            <Button className="mt-4" icon={<ArrowRight size={16} />} onClick={() => go("timeline")}>{t.openTimeline}</Button>
          </Panel>
        )}
        <div className="grid gap-d sm:grid-cols-2 lg:grid-cols-1">
          <button type="button" className="panel home-short pad text-left" onClick={() => go("explorer")}>
            <span className="flex items-center gap-2 font-semibold"><Hash size={17} className="text-accent" aria-hidden />{H.codeQ}</span>
            <span className="mt-1 block text-sm text-ink2">{H.codeB}</span>
          </button>
          <button type="button" className="panel home-short pad text-left" onClick={() => go("symptoms")}>
            <span className="flex items-center gap-2 font-semibold"><CircleQuestionMark size={17} className="text-accent" aria-hidden />{H.partQ}</span>
            <span className="mt-1 block text-sm text-ink2">{H.partB}</span>
          </button>
        </div>
      </div>

      <div className="mt-[var(--gap)]"><RealCapturePanel /></div>
    </>
  );
}
