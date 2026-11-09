import { useCallback, useEffect, useState } from "react";
import { History as HistoryIcon, Trash2 } from "lucide-react";
import { historyApi, HistoryRefused, type Finding, type HistoryList, type HistorySession, type LogImportInfo } from "../api";
import { Button, Chip, Panel, ProvenanceChip, StateBlock } from "../components/ui";
import { tok, tx } from "../lib/dyn";
import { usePrefs } from "../lib/prefs";
import { errText } from "../lib/errors";
import { ReconPanel } from "./recon";
import { EvidenceNotice } from "../components/evidence-notice";

function SessionFindings({ id }: { id: string }) {
  const { t, lang } = usePrefs();
  const [rows, setRows] = useState<Finding[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    setRows(null); setErr(false);
    historyApi.findings(id).then((r) => { if (live) setRows(r.findings); }).catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [id]);
  return (
    <Panel title={t.histFindings} icon={<HistoryIcon size={17} />} demo={false}>
      {err && <StateBlock kind="unavailable" title={t.histUnavailable} />}
      {!err && !rows && <p className="text-ink3">{t.loading}</p>}
      {rows && rows.length === 0 && <p className="text-ink2" data-testid="hist-no-findings">{t.histNoFindings}</p>}
      {rows && rows.length > 0 && (
        <ul className="grid gap-2" data-testid="hist-findings">
          {rows.map((f) => (
            <li key={f.finding_id} className="border border-line bg-surface2 px-3 py-2">
              <div className="mb-1 flex flex-wrap items-center gap-2"><Chip tone="warn">{tok(lang, "classification", f.classification)}</Chip><span className="mono text-xs text-ink3">{f.rule_id}</span>{f.source_mix.map((m) => <ProvenanceChip key={m} status={m} />)}</div>
              <p className="font-bold">{tx(lang, f.human_title)}</p>
              {f.limits[0] && <p className="mt-1 text-xs text-ink3">{tx(lang, f.limits[0])}</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 flex gap-2 text-xs text-ink3"><span className="text-warn" aria-hidden>▲</span>{t.histFindingsNote}</p>
    </Panel>
  );
}

const utc = (s: string) => s.replace("T", " ").replace("Z", "").slice(0, 16);

/** Saved sessions live in the local database only. They are listed one by one, never merged: the time between two sessions is not observed. */
export function HistoryView() {
  const { t, lang } = usePrefs();
  const [list, setList] = useState<HistoryList | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState<LogImportInfo | null>(null);

  const load = useCallback(() => { historyApi.list().then(setList).catch(() => setErr(t.histUnavailable)); }, [t.histUnavailable]);
  useEffect(() => { load(); }, [load]);

  async function run(job: () => Promise<{ session: HistorySession; already_saved: boolean; import?: LogImportInfo }>) {
    setErr(null); setNote(null); setBusy(true); setRead(null);
    try {
      const r = await job();
      setNote(r.already_saved ? t.histAlready : t.histSaved);
      setSel(r.session.id);
      setRead(r.import ?? null);
      load();
    } catch (e) {
      setErr(e instanceof HistoryRefused ? ((t.histRefusal as Record<string, string>)[e.code] ?? t.histRefusal.UNKNOWN) : errText(t, e, t.histUnavailable));
    } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (armed !== id) { setArmed(id); return; }
    setArmed(null);
    try { await historyApi.remove(id); if (sel === id) setSel(null); load(); } catch { setErr(t.histUnavailable); }
  }
  const origin = (o: string) => (t.histOrigin as Record<string, string>)[o] ?? o;
  const files = (e: React.ChangeEvent<HTMLInputElement>, job: (f: File) => Promise<{ session: HistorySession; already_saved: boolean; import?: LogImportInfo }>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (f) void run(() => job(f));
  };

  return (
    <>
      <Panel title={t.histTitle} icon={<HistoryIcon size={17} />} i={0} active>
        <p className="text-ink2">{t.histSub}</p>
        <EvidenceNotice />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => void run(() => historyApi.saveSource("synthetic:demo_extrusion_blockage", `${t.histOrigin.synthetic} · demo_extrusion_blockage`))}>{t.histSaveDemo}</Button>
          <Button onClick={() => void run(() => historyApi.saveSource("real:h02_normal_print", `${t.histOrigin.real_capture} · H-02`))}>{t.histSaveReal}</Button>
          <label className="btn btn-secondary cursor-pointer">{t.histImportBundle}<input type="file" accept=".zip,application/zip" className="sr-only" onChange={(e) => files(e, historyApi.saveBundle)} /></label>
          <label className="btn btn-secondary cursor-pointer" data-testid="hist-import-logs">{t.histImportLogs}<input type="file" accept=".log,.txt,.csv,.gz,.tgz,.zip,.tar,text/plain" className="sr-only" onChange={(e) => files(e, historyApi.saveLogs)} /></label>
          <label className="btn btn-secondary cursor-pointer">{t.histImportDryrun}<input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => files(e, historyApi.saveDryrun)} /></label>
        </div>
        <p className="mt-2 text-xs text-ink3">{t.histLogsHelp}</p>
        <div aria-live="polite" className="mt-3">
          {busy && <p className="text-ink3" data-testid="hist-busy">{t.histLogsBusy}</p>}
          {note && <Chip tone="ok">{note}</Chip>}
          {read && (
            <div className="mt-2 rounded-lg border border-control p-3 text-sm" data-testid="logs-read">
              <p className="micro mb-1">{t.histLogsRead} · {read.summary.recognized} / {read.summary.files}</p>
              <ul className="grid gap-1">
                {read.files.map((f, i) => (
                  <li key={i} className="text-ink2">
                    <strong>{(t.histLogKind as Record<string, string>)[f.kind] ?? f.kind}</strong>
                    {f.lines > 0 && <> · {f.lines.toLocaleString(lang === "fr" ? "fr-CH" : "en-GB")} {t.histLogLines}</>}
                    {f.from && f.to && <> · {f.from.slice(0, 10)} → {f.to.slice(0, 10)}</>}
                    {typeof f.exceptions === "number" && f.exceptions > 0 && <> · {f.exceptions} {t.histLogExceptions}</>}
                    {f.kind === "encrypted" && <> · {t.histLogEncrypted}</>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink3">{read.summary.dropped_observations > 0 ? `${t.histLogDropped} ` : ""}{t.histLogsPrivacy}</p>
            </div>
          )}
          {err && <StateBlock kind="error" title={t.histRefused} body={err} />}
        </div>
        {!list && !err && <p className="mt-4 text-ink3">{t.loading}</p>}
        {list && list.sessions.length === 0 && <p className="mt-4 text-ink3" data-testid="hist-empty">{t.histEmpty}</p>}
        {list && list.sessions.length > 0 && (
          <>
            <p className="micro mt-5 mb-2">{t.histSessions} · {list.totals.sessions} / {list.limits.max_sessions} · {list.totals.observations.toLocaleString(lang === "fr" ? "fr-CH" : "en-GB")} {t.histObs}</p>
            <ul className="grid gap-2" aria-label={t.histSessions}>
              {list.sessions.map((s) => (
                <li key={s.id} data-session={s.id} className="rounded-lg border border-control p-3" style={{ background: sel === s.id ? "var(--surface-2)" : "transparent" }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{s.label}</strong>
                    <Chip>{origin(s.origin)}</Chip>
                    <ProvenanceChip status={s.status_mix.length === 1 ? s.status_mix[0]! : "IMPORTED"} />
                    <span className="mono text-xs text-ink3">{s.observation_count.toLocaleString(lang === "fr" ? "fr-CH" : "en-GB")} {t.histObs}</span>
                  </div>
                  <p className="mono mt-1 text-xs text-ink3">{utc(s.first_utc)} → {utc(s.last_utc).slice(11)} UTC · {t.histSavedAt} {utc(s.saved_at)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant={sel === s.id ? "primary" : "secondary"} aria-pressed={sel === s.id} onClick={() => setSel(sel === s.id ? null : s.id)}>{t.histView}</Button>
                    <Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => void remove(s.id)}>{armed === s.id ? t.histConfirmDelete : t.histDelete}</Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-4 flex gap-2 text-xs text-ink3"><span className="text-warn" aria-hidden>▲</span>{t.histNote}</p>
      </Panel>
      {sel && <div className="mt-4 grid gap-4"><SessionFindings id={sel} /><ReconPanel source={`history:${sel}`} /></div>}
    </>
  );
}
