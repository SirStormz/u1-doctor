import { useState } from "react";
import { Archive, X } from "lucide-react";
import { usePrefs } from "../lib/prefs";

const KEY = "u1d.evidenceNotice.dismissed";
const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

/** #56: the printer rotates its logs quickly, so the owner should save a U1-DEB bundle right after an incident.
 * Static text only: no printer read here. Dismissal is a per-viewer convenience (browser storage, may be lost). */
export function EvidenceNotice() {
  const { t } = usePrefs();
  const [hidden, setHidden] = useState(read);
  if (hidden) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem(KEY, "1"); } catch { /* storage unavailable: hidden for this view only */ } };
  return (
    <div role="note" data-testid="evidence-notice" className="mt-4 flex gap-3 rounded-lg border-2 p-3" style={{ borderColor: "var(--warn)", background: "color-mix(in srgb, var(--warn) 10%, var(--surface-1))" }}>
      <Archive size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
      <div className="grid gap-1.5">
        <strong>{t.ev.title}</strong>
        <p className="text-[15px]">{t.ev.body}</p>
        <a href="#/report" className="btn btn-secondary w-fit">{t.ev.action}</a>
      </div>
      <button type="button" onClick={dismiss} aria-label={t.ev.dismiss} title={t.ev.dismiss} className="ml-auto h-fit shrink-0 text-ink3 hover:text-ink"><X size={16} aria-hidden /></button>
    </div>
  );
}
