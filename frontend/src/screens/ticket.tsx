import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy, ExternalLink, MessageSquareText } from "lucide-react";
import { api, type Finding, type Observation } from "../api";
import { Button, Panel } from "../components/ui";
import { usePrefs } from "../lib/prefs";
import { buildTicket, LOG_EXPORT_URL, type Network, type TicketFields, type TicketSource } from "../lib/ticket-text";

const CODE = /^\d{4}-\d{4}-\d{4}-\d{4}$/;
const field = "mono rounded-lg border border-control bg-surface2 px-3 py-2 text-ink";

/** The code the owner declared in the loaded data, if any (never read from the machine here). */
export function declaredCode(obs: Observation[]): string {
  const o = obs.find((x) => x.event_type === "user_reported_error_code");
  const v = o?.value as { code?: unknown } | undefined;
  return typeof v?.code === "string" ? v.code : "";
}

/** #56 Ticket-ready summary: optional owner fields + facts of the loaded source, copied as text. Nothing is sent. */
export function TicketPanel({ appVersion, source, obs, findings, initialCode }: { appVersion: string | null; source: TicketSource; obs: Observation[]; findings: Finding[]; initialCode: string }) {
  const { t, lang } = usePrefs();
  const [f, setF] = useState<TicketFields>({ firmware: "", slicer: "", toolhead: "", code: initialCode, network: "", filaments: ["", "", "", ""], tried: "" });
  const [title, setTitle] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setF((x) => ({ ...x, code: initialCode })); }, [initialCode]);
  useEffect(() => {
    let live = true;
    setTitle(null);
    const c = f.code.trim();
    if (CODE.test(c)) api.interpret(c).then((r) => { if (live) setTitle(r.decoding.entry?.title ?? null); }).catch(() => {});
    return () => { live = false; };
  }, [f.code]);
  const text = useMemo(() => buildTicket(lang, { appVersion, fields: f, title, source, obs, findings }), [lang, appVersion, f, title, source, obs, findings]);
  const set = <K extends keyof TicketFields>(k: K, v: TicketFields[K]) => setF((x) => ({ ...x, [k]: v }));
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable: the preview stays selectable */ }
  }
  return (
    <Panel title={t.tk.title} icon={<MessageSquareText size={17} />} i={3} demo={source.kind === "demo"}>
      <p className="text-ink2">{t.tk.sub}</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="grid content-start gap-3 text-sm">
          <label className="grid gap-1">{t.tk.fw}<input value={f.firmware} maxLength={32} onChange={(e) => set("firmware", e.target.value)} placeholder="2.1.0" className={field} /></label>
          <label className="grid gap-1">{t.tk.slicer}<input value={f.slicer} maxLength={64} onChange={(e) => set("slicer", e.target.value)} placeholder="Snapmaker Orca 2.3.5" className={field} /></label>
          <label className="grid gap-1">{t.tk.code}<input value={f.code} maxLength={32} onChange={(e) => set("code", e.target.value)} placeholder="0002-0525-0002-0002" className={field} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1">{t.tk.toolhead}
              <select value={f.toolhead} onChange={(e) => set("toolhead", e.target.value)} className={field}><option value="">{t.tk.thNone}</option>{["1", "2", "3", "4"].map((n) => <option key={n} value={n}>{n}</option>)}</select>
            </label>
            <label className="grid gap-1">{t.tk.network}
              <select value={f.network} onChange={(e) => set("network", e.target.value as Network)} className={field}>{(["", "lan", "cloud"] as Network[]).map((n) => <option key={n} value={n}>{t.tk.net[n]}</option>)}</select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {f.filaments.map((v, k) => (
              <label key={k} className="grid gap-1">{t.tk.filament.replace("{n}", String(k + 1))}
                <input value={v} maxLength={40} onChange={(e) => { const n = [...f.filaments] as TicketFields["filaments"]; n[k] = e.target.value; set("filaments", n); }} placeholder="PLA" className={field} />
              </label>
            ))}
          </div>
          <label className="grid gap-1">{t.tk.tried}<textarea value={f.tried} maxLength={1000} rows={3} onChange={(e) => set("tried", e.target.value)} className={field} /></label>
        </div>
        <div className="grid content-start gap-2">
          <p className="micro">{t.tk.preview}</p>
          <pre data-testid="ticket-text" className="mono max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-control bg-surface2 p-3 text-xs text-ink2">{text}</pre>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon={<ClipboardCopy size={16} />} onClick={() => void copy()}>{copied ? t.tk.copied : t.tk.copy}</Button>
            <a href={LOG_EXPORT_URL} target="_blank" rel="noreferrer noopener" className="btn btn-secondary">{t.tk.logLink}<ExternalLink size={15} aria-hidden /></a>
          </div>
          <p className="text-xs text-ink3">{t.tk.logNote}</p>
        </div>
      </div>
    </Panel>
  );
}
