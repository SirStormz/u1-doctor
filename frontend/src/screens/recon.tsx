import { useEffect, useState } from "react";
import { ListTree } from "lucide-react";
import { timelineApi, type Timeline } from "../api";
import { Chip, Panel, ProvenanceChip, StateBlock, TimeChip } from "../components/ui";
import { entityLabel, eventLabel, stateLabel, tok } from "../lib/dyn";
import { usePrefs } from "../lib/prefs";

const utc = (s: string) => s.replace("T", " ").replace("Z", "").slice(0, 19);
const dur = (s: number, min: string, sec: string) => `${Math.floor(s / 60)} ${min} ${Math.round(s % 60)} ${sec}`;
const KEY_FR: Record<string, string> = { state: "état", action_code: "code d'action", code: "code", start: "début", end: "fin" };
function compact(v: unknown, lang: "fr" | "en"): string {
  if (!v || typeof v !== "object") return String(v);
  return Object.entries(v as Record<string, unknown>).map(([k, x]) => {
    if (k === "celsius") return `${lang === "fr" ? Number(x).toFixed(1).replace(".", ",") : Number(x).toFixed(1)} °C`;
    const val = k === "state" ? stateLabel(lang, String(x)).toLowerCase() : String(x);
    return `${lang === "fr" ? KEY_FR[k] ?? k : k}: ${val}`;
  }).join(", ");
}

/** Reconstruction of the observed period from the local service. Shows only what was observed. */
export function ReconPanel({ source }: { source: string }) {
  const { t, lang } = usePrefs();
  const R = t.recon;
  const [tl, setTl] = useState<Timeline | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    setTl(null); setErr(false);
    timelineApi.get(source).then((x) => { if (live) setTl(x); }).catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [source]);

  const ev = (e: string) => (lang === "fr" ? eventLabel(lang, e) : e.replace(/_/g, " "));
  if (err) return <Panel title={R.title} icon={<ListTree size={17} />} demo={false}><StateBlock kind="unavailable" title={R.unavailable} /></Panel>;
  if (!tl) return <Panel title={R.title} icon={<ListTree size={17} />} demo={false}><StateBlock kind="loading" title={R.loading} /></Panel>;

  const integTone = tl.integrity === "NO_GAP_RECORDED" ? "ok" : "warn";
  const fmt = (n: number) => n.toLocaleString(lang === "fr" ? "fr-CH" : "en-GB");
  return (
    <Panel title={R.title} icon={<ListTree size={17} />} demo={false} actions={<><ProvenanceChip status={tl.source_status} /><TimeChip q="RECEIPT_ONLY" /></>}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y-2 border-ink py-3 sm:grid-cols-3 min-[1500px]:grid-cols-5">
        <div><dt className="micro">{R.window}</dt><dd className="m-0 text-[15px] font-extrabold">{utc(tl.observed_window.start_utc)} → {utc(tl.observed_window.end_utc).slice(11)}</dd></div>
        <div><dt className="micro">{R.dur}</dt><dd className="m-0 text-[15px] font-extrabold">{dur(tl.observed_window.duration_s, R.min, R.s)}</dd></div>
        <div><dt className="micro">{R.obs}</dt><dd className="m-0 text-[15px] font-extrabold">{fmt(tl.observation_count)} · {tl.sessions.length} {tl.sessions.length === 1 ? R.sessions.toLowerCase().replace(/s$/, "") : R.sessions.toLowerCase()}</dd></div>
        <div><dt className="micro">{R.gaps}</dt><dd className="m-0 text-[15px] font-extrabold">{tl.gaps.length}</dd></div>
        <div><dt className="micro">{R.integrity}</dt><dd className="m-0"><Chip tone={integTone}>{R.integ[tl.integrity]}</Chip></dd></div>
      </dl>

      <div className="mt-4 grid gap-d lg:grid-cols-2">
        <div>
          <h3 className="micro mb-2">{R.phases}</h3>
          <ol className="grid gap-2">
            {tl.phases.map((p, i) => (
              <li key={`${p.start_utc}-${i}`} className="border border-line bg-surface2 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2"><Chip tone={p.state === "complete" ? "ok" : "accent"}>{stateLabel(lang, p.state)}</Chip><span className="mono text-xs text-ink3">{utc(p.start_utc).slice(11)} → {utc(p.end_utc).slice(11)}</span><span className="text-sm font-bold">{dur(p.duration_s, R.min, R.s)}</span></div>
                <p className="mt-1 text-xs text-ink3">{p.ended_by_transition ? R.byTransition : R.openEnd}</p>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="micro mb-2">{R.incident}</h3>
          {tl.incident ? (
            <p className="border-2 border-warn bg-surface2 px-3 py-2"><span className="font-bold">{R.incidentAt} : {stateLabel(lang, tl.incident.state)}</span> <span className="mono text-xs text-ink3">{utc(tl.incident.t_utc).slice(11)} UTC</span><br /><span className="text-sm text-ink2">{tl.incident.entries_before} {R.before} · {tl.incident.entries_after} {R.after}</span></p>
          ) : <p className="text-ink2">{R.noIncident}</p>}
          <h3 className="micro mb-2 mt-4">{R.gaps}</h3>
          {tl.gaps.length ? (
            <ul className="grid gap-2">{tl.gaps.map((g) => <li key={g.start_utc} className="border border-line bg-surface2 px-3 py-2 mono text-xs">{utc(g.start_utc).slice(11)} → {utc(g.end_utc).slice(11)} · {dur(g.duration_s, R.min, R.s)}</li>)}</ul>
          ) : <p className="text-ink2">{R.noGaps}</p>}
        </div>
      </div>

      <h3 className="micro mb-2 mt-4">{R.entries}</h3>
      <div className="max-h-80 overflow-auto" tabIndex={0} role="region" aria-label={R.entries}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{R.entries}</caption>
          <thead className="sticky top-0 bg-surface text-ink3"><tr><th className="py-1 pr-3">{R.time}</th><th className="pr-3">{R.event}</th><th className="pr-3">{R.entity}</th><th className="pr-3">{R.value}</th><th>{R.source}</th></tr></thead>
          <tbody>
            {tl.entries.map((e) => (
              <tr key={e.ids[0]} className="border-t border-line align-top">
                <td className="mono py-1 pr-3 text-xs">{utc(e.t_utc).slice(11)}</td>
                <td className="pr-3">{ev(e.event_type)}{e.repeat > 1 && <span className="mono ml-1 text-xs text-ink3">×{e.repeat} {R.times}</span>}</td>
                <td className="pr-3">{entityLabel(lang, e.entity_id)} <span className="text-xs text-ink3">({tok(lang, "mapping", e.mapping_quality)})</span></td>
                <td className="mono pr-3 text-xs">{compact(e.summary, lang)}</td>
                <td><ProvenanceChip status={e.source_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 grid gap-1 text-xs text-ink3">{R.lim.map((l) => <li key={l}>{l}</li>)}</ul>
    </Panel>
  );
}
