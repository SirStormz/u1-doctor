import { useEffect, useId, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { Ban, Check, CircleHelp, Clock, Download, FileText, FlaskConical, Hourglass, Info, Lightbulb, TriangleAlert, User } from "lucide-react";
import { animate, useReducedMotion } from "motion/react";
import { usePrefs, type HintId } from "../lib/prefs";
import { tok } from "../lib/dyn";

export type Tone = "neutral" | "ok" | "warn" | "danger" | "demo" | "replay" | "accent";

export function Chip({ tone = "neutral", icon, children, title }: { tone?: Tone; icon?: ReactNode; children: ReactNode; title?: string }) {
  return <span className="chip" data-tone={tone} title={title}>{icon}{children}</span>;
}

export function Button({ variant = "secondary", icon, children, ...p }: { variant?: "primary" | "secondary" | "ghost"; icon?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...p} className={`btn btn-${variant} ${p.className ?? ""}`}>{icon}{children}</button>;
}

const PROV: Record<string, { tone: Tone; icon: ReactNode }> = {
  REAL: { tone: "ok", icon: <Check size={12} aria-hidden /> },
  SYNTHETIC: { tone: "demo", icon: <FlaskConical size={12} aria-hidden /> },
  USER_REPORTED: { tone: "warn", icon: <User size={12} aria-hidden /> },
  IMPORTED: { tone: "replay", icon: <Download size={12} aria-hidden /> },
};
export function ProvenanceChip({ status }: { status: string }) {
  const { lang } = usePrefs();
  const p = PROV[status] ?? { tone: "neutral" as Tone, icon: <CircleHelp size={12} aria-hidden /> };
  return <Chip tone={p.tone} icon={p.icon}>{tok(lang, "provenance", status)}</Chip>;
}
export function TimeChip({ q }: { q: string }) {
  const { t } = usePrefs();
  return <Chip icon={<Clock size={12} aria-hidden />} title={t.tsQuality}>{q === "RECEIPT_ONLY" ? t.receiptTime : q}</Chip>;
}
export function SeverityChip({ level }: { level: string | null | undefined }) {
  const { t } = usePrefs();
  if (level === "warning") return <Chip tone="warn" icon={<TriangleAlert size={12} aria-hidden />}>{t.sevWarning}</Chip>;
  if (level === "error") return <Chip tone="danger" icon={<Ban size={12} aria-hidden />}>{t.sevError}</Chip>;
  if (level === "notice") return <Chip tone="accent" icon={<Info size={12} aria-hidden />}>{t.sevNotice}</Chip>;
  return <Chip icon={<CircleHelp size={12} aria-hidden />}>{t.unknown}</Chip>;
}
export function ClassChip({ c }: { c: string }) {
  const { lang } = usePrefs();
  const tone: Tone = c === "OBSERVED" ? "ok" : c === "INCONCLUSIVE" ? "warn" : c === "REFUTED" ? "danger" : "neutral";
  const icon = c === "OBSERVED" ? <Check size={12} aria-hidden /> : c === "INCONCLUSIVE" ? <CircleHelp size={12} aria-hidden /> : <Info size={12} aria-hidden />;
  return <Chip tone={tone} icon={icon}>{tok(lang, "classification", c)}</Chip>;
}

/** Folds the technical part of a block. Closed in Simple mode, open in Expert mode; the reader can always toggle it. */
export function TechDetails({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { t, mode } = usePrefs();
  return (
    <details key={mode} open={mode === "expert"} className={className}>
      <summary className="cursor-pointer text-xs font-semibold text-ink2">{t.techDetails} <span className="font-normal text-ink3">· {t.techDetailsHint}</span></summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

/**
 * One-time contextual note, placed right next to what it explains. Simple mode only, after the first-run assistant,
 * gone for good once dismissed ("Got it" or Esc while focused). Non-modal: it never takes focus and covers nothing.
 */
export function Hint({ id, className = "" }: { id: HintId; className?: string }) {
  const { t, mode, onboarded, hints, dismissHint } = usePrefs();
  const uid = useId();
  if (mode !== "simple" || !onboarded || hints.includes(id)) return null;
  const close = (el: HTMLElement) => {
    // the note disappears: if focus was inside it, hand it to the page instead of dropping it on <body>
    if (el.contains(document.activeElement)) document.getElementById("main")?.focus({ preventScroll: true });
    dismissHint(id);
  };
  return (
    <div role="note" aria-labelledby={`${uid}-h`} data-hint={id} className={`hint flex max-w-[72ch] flex-wrap items-start gap-x-3 gap-y-2 border-2 border-dashed border-accent bg-surface2 px-3 py-2 text-sm text-ink ${className}`}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(e.currentTarget); } }}>
      <Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
      <p className="min-w-0 flex-1 basis-[24ch]"><strong id={`${uid}-h`}>{t.hint.title}</strong> <span id={`${uid}-b`}>{t.hint[id]}</span></p>
      <button type="button" className="btn btn-secondary !py-1 text-xs" aria-describedby={`${uid}-b`} onClick={(e) => close(e.currentTarget.parentElement!)}>{t.hint.gotIt}</button>
    </div>
  );
}

export function Panel({ title, icon, actions, active, demo = true, brackets, i = 0, className = "", children, label, bodyClass = "pad" }: {
  title?: ReactNode; icon?: ReactNode; actions?: ReactNode; active?: boolean; demo?: boolean; brackets?: boolean; i?: number; className?: string; children: ReactNode; label?: string; bodyClass?: string;
}) {
  const id = useId();
  return (
    <section className={`panel reveal ${brackets ? "brackets" : ""} ${className}`} data-active={active ? "true" : undefined} data-demo={demo ? "true" : undefined} style={{ "--i": i } as CSSProperties} aria-labelledby={title ? id : undefined} aria-label={!title ? label : undefined}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 id={id} className="flex items-center gap-2 text-[15px] font-semibold">{icon && <span className="text-accent" aria-hidden>{icon}</span>}{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

/** Integers count up once on mount (cosmetic; the final value is always the true one). */
export function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setV(value); return; }
    const c = animate(0, value, { duration: 0.848, ease: [0.618, 0, 0.382, 1], onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [value, reduce]);
  return <>{v}</>;
}

export function Stat({ value, label, tone }: { value: ReactNode; label: string; tone?: Tone }) {
  return (
    <div>
      <div className="num-hero" style={{ color: tone === "warn" ? "var(--warn)" : tone === "ok" ? "var(--ok)" : "var(--ink)" }}>{typeof value === "number" ? <CountUp value={value} /> : value}</div>
      <div className="micro mt-2">{label}</div>
    </div>
  );
}

export function Skeleton({ h = 16, w = "100%" }: { h?: number; w?: number | string }) {
  return <div className="skeleton" style={{ height: h, width: w }} aria-hidden />;
}

export function StateBlock({ kind, title, body, action }: { kind: "loading" | "empty" | "error" | "unavailable"; title: string; body?: string; action?: ReactNode }) {
  const { t } = usePrefs();
  if (kind === "error" && body && /HTTP (0|5\d\d)|fetch|network/i.test(body)) body = t.backendDown;
  const icon = kind === "loading" ? <Hourglass size={22} /> : kind === "error" ? <TriangleAlert size={22} /> : kind === "empty" ? <FileText size={22} /> : <Ban size={22} />;
  const tone = kind === "error" ? "var(--danger)" : kind === "unavailable" ? "var(--ink-3)" : "var(--accent)";
  return (
    <div role={kind === "error" ? "alert" : "status"} className="grid place-items-center gap-2 rounded-lg border border-dashed border-control px-6 py-10 text-center">
      <span style={{ color: tone }} aria-hidden>{icon}</span>
      <p className="font-semibold">{title}</p>
      {kind === "loading" && <div className="mt-1 grid w-64 gap-2"><Skeleton /><Skeleton w="70%" /></div>}
      {body && <p className="max-w-md text-ink2">{body}</p>}
      {action}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) { return <kbd className="kbd">{children}</kbd>; }

/** Evidence ledger: counts (never percentages) for / against / missing. */
export function LedgerBars({ forN, againstN, missingN }: { forN: number; againstN: number; missingN: number }) {
  const { t } = usePrefs();
  const max = Math.max(1, forN, againstN, missingN);
  const rows: [string, number, string][] = [[t.evFor, forN, "var(--ok)"], [t.evAgainst, againstN, "var(--danger)"], [t.evMissing, missingN, "var(--warn)"]];
  return (
    <ul className="grid gap-3" aria-label={t.ledger}>
      {rows.map(([label, n, c]) => (
        <li key={label} className="grid grid-cols-[88px_1fr_28px] items-center gap-3">
          <span className="text-ink2">{label}</span>
          <span className="h-2 overflow-hidden bg-surface3" aria-hidden><span className="block h-full" style={{ width: `${(n / max) * 100}%`, background: c, transformOrigin: "left", animation: "rise 0.6s var(--ease) both" }} /></span>
          <span className="mono text-right font-semibold">{n}</span>
        </li>
      ))}
    </ul>
  );
}

export function Seal({ ok, hash, label, sub }: { ok: boolean; hash: string; label: string; sub: string }) {
  const c = ok ? "var(--ok)" : "var(--danger)";
  return (
    <div className="flex items-center gap-4 rounded-xl border p-3" style={{ borderColor: `color-mix(in srgb, ${c} 50%, var(--line))`, background: `color-mix(in srgb, ${c} 8%, var(--surface-1))` }}>
      <span className="seal-pop grid h-12 w-12 shrink-0 place-items-center border-2" style={{ borderColor: c, color: c }} aria-hidden>{ok ? <Check size={26} /> : <TriangleAlert size={24} />}</span>
      <div className="min-w-0"><p className="font-semibold">{label}</p><p className="micro">{sub}</p><p className="mono truncate text-xs text-ink2" title={hash}>{hash.slice(0, 23)}…</p></div>
    </div>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M5 5v13a8 8 0 0 0 16 0v-3h2.5l2-5 3 10 2-5" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="30" cy="20" r="1.5" fill="var(--accent)" />
    </svg>
  );
}
