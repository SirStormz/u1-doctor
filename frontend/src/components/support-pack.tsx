import { useState } from "react";
import { Copy, Download, PackageCheck, ShieldAlert } from "lucide-react";
import { Button, Chip, Panel, StateBlock } from "./ui";
import { useToast } from "./shell";
import { packApi, PackRefused } from "../api";
import type { PackOut } from "../api";
import { usePrefs } from "../lib/prefs";

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** One AES-256 zip for Snapmaker support, built from read-only requests (BACKLOG #70). The password is shown once, never stored. */
export function SupportPackPanel({ initialCode = "" }: { initialCode?: string }) {
  const { t } = usePrefs();
  const toast = useToast();
  const p = t.pack;
  const [host, setHost] = useState("");
  const [code, setCode] = useState(initialCode);
  const [notes, setNotes] = useState("");
  const [serial, setSerial] = useState(true);
  const [network, setNetwork] = useState(true);
  const [names, setNames] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [out, setOut] = useState<PackOut | null>(null);

  const ready = consent && IPV4.test(host.trim()) && !busy;

  async function build() {
    setBusy(true); setErr(null); setOut(null);
    try {
      setOut(await packApi.build({ host: host.trim(), code: code.trim() || undefined, notes: notes.trim() || undefined, include_serial: serial, redact_network: network, include_job_names: names }));
    } catch (e) {
      setErr((e instanceof PackRefused ? p.err[e.code] : undefined) ?? p.err["UNKNOWN"] ?? "");
    } finally { setBusy(false); }
  }

  async function save() {
    if (!out) return;
    try {
      const blob = await packApi.download(out.name);
      // desktop window (pywebview): a blob download has no Save dialog, so hand the bytes to the native one
      const native = (window as unknown as { pywebview?: { api?: { save_file?: (n: string, b64: string) => Promise<boolean> } } }).pywebview?.api?.save_file;
      if (native) {
        const b64 = await new Promise<string>((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] ?? ""); r.onerror = () => ko(r.error); r.readAsDataURL(blob); });
        if (await native(out.name, b64)) toast(t.exported);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = out.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(t.exported);
    } catch { toast(t.error); }
  }

  async function copy() {
    if (!out) return;
    try { await navigator.clipboard.writeText(out.password); toast(p.copied); } catch { toast(t.error); }
  }

  const mcuDiffers = out ? new Set(Object.values(out.mcu_versions)).size > 1 : false;
  return (
    <Panel title={p.title} icon={<PackageCheck size={17} />} i={3} demo={false}>
      <p className="mb-3 text-ink2">{p.sub}</p>
      <ol className="mb-4 grid gap-2">
        {p.steps.map((s, k) => (<li key={s} className="flex items-start gap-3 rounded-lg border border-line bg-surface2 p-3"><span className="grid h-7 w-7 shrink-0 place-items-center border border-control text-sm font-bold text-ink2">{k + 1}</span><span>{s}</span></li>))}
      </ol>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">{p.address}
          <input value={host} onChange={(e) => setHost(e.target.value)} inputMode="decimal" autoComplete="off" spellCheck={false} placeholder="192.168.x.x" className="mono rounded-lg border border-control bg-surface2 px-3 py-2 text-ink" />
        </label>
        <label className="grid gap-1 text-sm">{p.code}
          <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} autoComplete="off" spellCheck={false} placeholder="0003-0001-0001-0001" className="mono rounded-lg border border-control bg-surface2 px-3 py-2 text-ink" />
        </label>
      </div>
      <label className="mt-3 grid gap-1 text-sm">{p.notes}
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3} className="rounded-lg border border-control bg-surface2 px-3 py-2 text-ink" />
      </label>
      <div className="mt-3 grid gap-2 text-sm">
        <label className="flex items-start gap-2"><input type="checkbox" checked={serial} onChange={(e) => setSerial(e.target.checked)} className="mt-1" /><span>{p.serial}</span></label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={network} onChange={(e) => setNetwork(e.target.checked)} className="mt-1" /><span>{p.network}</span></label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} className="mt-1" /><span>{p.names}</span></label>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-surface2 p-3 text-sm" role="note"><ShieldAlert size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden /><span>{p.warn}</span></div>
      <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" /><span>{p.consent}</span></label>
      <div className="mt-4"><Button variant="primary" disabled={!ready} onClick={() => void build()} icon={<PackageCheck size={16} />}>{busy ? p.running : p.build}</Button></div>
      {busy && <StateBlock kind="loading" title={p.running} />}
      {err && <div role="alert" className="mt-3"><StateBlock kind="error" title={t.error} body={err} /></div>}
      {out && (
        <div className="mt-4 grid gap-3" data-testid="pack-result">
          <div className="flex flex-wrap items-center gap-2"><Chip tone="ok">{p.done}</Chip><span className="text-xs text-ink3">{p.size}: {(out.bytes / 1048576).toFixed(1)} MB · {out.files.length}</span></div>
          <div className="rounded-lg border border-control bg-surface2 p-3">
            <p className="micro">{p.password}</p>
            <p className="mono mt-1 select-all break-all text-lg font-bold tracking-wide" data-testid="pack-password">{out.password}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button onClick={() => void copy()} icon={<Copy size={16} />}>{p.copy}</Button>
              <Button variant="primary" onClick={() => void save()} icon={<Download size={16} />}>{p.save}</Button>
            </div>
            <p className="mt-2 text-xs text-ink3">{p.passNote}</p>
          </div>
          {mcuDiffers && <p role="alert" className="text-sm text-warn">{p.mcuDiff}</p>}
          {out.not_collected.length > 0 && <p className="text-sm text-ink2">{p.notCollected}: {out.not_collected.map((e) => e.op).join(", ")}</p>}
          <details><summary className="cursor-pointer text-sm">{p.contents}</summary>
            <ul className="mono mt-2 grid gap-1 text-xs text-ink2">{out.files.map((f) => <li key={f.name} className="flex gap-3"><span className="break-all">{f.name}</span><span className="ml-auto shrink-0 text-ink3">{f.bytes} B</span></li>)}</ul>
          </details>
          <p className="text-sm text-ink2">{p.extra}</p>
        </div>
      )}
    </Panel>
  );
}
