import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Activity, Check, Command, Eye, FileSearch, FileText, FlaskConical, History, LayoutDashboard, ListChecks, Lock, Plug, Search, Settings, ShieldCheck, Wrench } from "lucide-react";
import { api, type InterpretOut } from "../api";
import { useIncident } from "../lib/data";
import { usePrefs, type StepId, type Theme } from "../lib/prefs";
import { THEME_IDS } from "../themes/registry";
import { withThemeFade } from "../themes/transition";
import { useDecode } from "../themes/useDecode";
import { Onboarding } from "./onboarding";
import { parseHash, ROUTES, visibleRoutes, type RouteName } from "../lib/router";
import { Chip, Hint, Kbd, Logo, SeverityChip } from "./ui";
import { tok, tx } from "../lib/dyn";

const ICONS: Record<RouteName, ReactNode> = {
  welcome: <ShieldCheck size={18} />, connect: <Plug size={18} />, overview: <LayoutDashboard size={18} />, explorer: <Search size={18} />, symptoms: <Eye size={18} />, timeline: <Activity size={18} />,
  findings: <ListChecks size={18} />, evidence: <FileSearch size={18} />, replay: <History size={18} />, report: <FileText size={18} />, settings: <Settings size={18} />,
};

/** Screens that tick a "Getting started" step when they are opened. */
const ROUTE_STEP: Partial<Record<RouteName, StepId>> = { explorer: "code", timeline: "timeline", evidence: "evidence", report: "report" };

/* ---------- toasts ---------- */
interface Toast { id: number; text: string }
const ToastCtx = createContext<(text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
function ToastHost({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-12 right-4 z-50 grid gap-2" role="status" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className="pointer-events-auto flex items-center gap-2 rounded-lg border border-control bg-surface2 px-3 py-2 shadow-lg" style={{ animation: "toast-in 0.25s var(--ease) both" }}>
          <Check size={16} className="text-ok" aria-hidden /> {x.text}
        </div>
      ))}
    </div>
  );
}

/* ---------- command palette ---------- */
const CODE = /^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}$/;
function Palette({ open, onClose, go }: { open: boolean; onClose: () => void; go: (n: RouteName, p?: string) => void }) {
  const { t, lang, mode } = usePrefs();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [dec, setDec] = useState<InterpretOut | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const items = useMemo(() => visibleRoutes(mode).map((r) => ({ r, label: t.nav[r] })).filter((x) => x.label.toLowerCase().includes(q.trim().toLowerCase())), [q, t, mode]);
  const isCode = CODE.test(q.trim());

  useEffect(() => { if (open) { setQ(""); setSel(0); setDec(null); requestAnimationFrame(() => input.current?.focus()); } }, [open]);
  useEffect(() => {
    let live = true;
    setDec(null);
    if (isCode) api.interpret(q.trim()).then((d) => { if (live) setDec(d); }).catch(() => {});
    return () => { live = false; };
  }, [q, isCode]);

  if (!open) return null;
  const choose = (i: number) => {
    if (isCode) go("explorer", q.trim());
    else if (items[i]) go(items[i].r);
    onClose();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(sel); }
    else if (e.key === "Tab") { e.preventDefault(); input.current?.focus(); } // minimal focus trap: the input is the only tab stop
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/55 pt-[14vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={t.palette} className="panel w-[min(560px,92vw)] overflow-hidden" data-active="true" style={{ animation: "rise 0.2s var(--ease) both" }} onKeyDown={onKey}>
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Command size={18} className="text-accent" aria-hidden />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} placeholder={t.palettePlaceholder} aria-label={t.palette} aria-controls="palette-list" className="w-full bg-transparent outline-none placeholder:text-ink3" maxLength={64} />
          <Kbd>Esc</Kbd>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-80 overflow-auto p-2">
          {isCode && (
            <li role="option" aria-selected className="rounded-lg bg-surface2 p-3">
              {dec ? (
                <div className="grid gap-1">
                  <div className="flex items-center gap-2"><SeverityChip level={dec.decoding.severity} /><span className="mono text-xs text-ink2">{q.trim()}</span></div>
                  <p className="font-semibold">{(dec.decoding.entry?.title ? tx(lang, dec.decoding.entry.title) : null) ?? (dec.decoding.status === "STRUCTURE_ONLY" ? t.statusStructure : t.statusMalformed)}</p>
                  <p className="text-ink3 text-xs">{t.userDeclared} · {t.palleteOpenExplorer}</p>
                </div>
              ) : <p className="text-ink3">{t.loading}</p>}
            </li>
          )}
          {!isCode && items.length === 0 && <li className="px-3 py-6 text-center text-ink3">{t.noResults}</li>}
          {!isCode && items.map((x, i) => (
            <li key={x.r} role="option" aria-selected={i === sel}>
              <button type="button" tabIndex={-1} onMouseEnter={() => setSel(i)} onClick={() => choose(i)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left" style={{ background: i === sel ? "var(--surface-3)" : "transparent" }}>
                <span className="text-accent" aria-hidden>{ICONS[x.r]}</span>{x.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- shell ---------- */

export function Shell({ route, go, replay, children }: { route: RouteName; go: (n: RouteName, p?: string) => void; replay: boolean; children: ReactNode }) {
  const { t, lang, setLang, theme, setTheme, mode, setMode, markStep, onboarded } = usePrefs();
  const expert = mode === "expert";
  const { health, demo, setDemo } = useIncident();
  useEffect(() => { if (demo) markStep("demo"); }, [demo, markStep]);
  useEffect(() => { const s = ROUTE_STEP[route]; if (s) markStep(s); }, [route, markStep]);
  const [palette, setPalette] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const main = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const push = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { id, text }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 3200);
  }, []);

  useEffect(() => {
    if (!onboarded) return; // the first-run dialog is modal: Ctrl+K stays off until it is closed
    const on = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); } };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [onboarded]);
  useEffect(() => { main.current?.focus({ preventScroll: true }); main.current?.scrollTo?.(0, 0); }, [route]);
  // the page scrolls inside <main>: give the bars the same right edge as the content by adding the scrollbar's width
  useEffect(() => {
    const el = main.current;
    if (!el) return;
    const sync = () => document.documentElement.style.setProperty("--sbw", `${el.offsetWidth - el.clientWidth}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--sbw"); };
  }, [route]);

  const tone = replay ? "var(--replay)" : demo ? "var(--demo)" : "var(--ink-3)";
  const stripStyle = { borderBottom: `1px solid ${tone}`, color: tone, background: `color-mix(in srgb, ${tone} 9%, var(--bg-1))` };

  return (
    <ToastCtx.Provider value={push}>
      <a href="#main" onClick={(e) => { e.preventDefault(); main.current?.focus(); }} className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-1 focus:text-accentink">{t.skip}</a>
      <div className="stage grid h-full grid-rows-[auto_auto_auto_1fr_auto]">
        <header className="topbar topbar-h px-[max(21px,3vw)]">
          <div className="wrap flex flex-wrap items-center gap-3 py-1.5">
          <a href="#/" className="brand flex items-center gap-3 no-underline" aria-label={t.appName}><Logo /><span className="text-[17px] font-extrabold uppercase tracking-[0.04em]">{t.appName}</span></a>
          <span className="flex items-center gap-3 max-sm:hidden"><span className="mx-1 h-5 w-px bg-line" aria-hidden />
          {(replay || demo) && <Chip tone={replay ? "replay" : "demo"}>{replay ? t.modeReplay : t.modeDemo}</Chip>}
          <Chip tone="accent" icon={<Lock size={11} aria-hidden />}>{t.readOnly}</Chip></span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" aria-pressed={demo} onClick={() => setDemo(!demo)} title={demo ? t.demoToggleOn : t.demoToggleOff} className="btn tbtn">
              <FlaskConical size={15} aria-hidden /> <span>{t.demoToggle}</span>
            </button>
            <button type="button" aria-pressed={expert} onClick={() => setMode(expert ? "simple" : "expert")} title={expert ? t.modeToggleOn : t.modeToggleOff} className="btn tbtn">
              <Wrench size={15} aria-hidden /> <span>{t.modeToggle}</span>
            </button>
            <button type="button" onClick={() => setPalette(true)} className="btn tbtn" aria-label={`${t.palette} — ${t.palettePlaceholder.split("…")[0]}… Ctrl K`}>
              <Search size={15} aria-hidden /> <span className="hidden min-[1500px]:inline">{t.palettePlaceholder.split("…")[0]}…</span> <span className="max-sm:hidden"><Kbd>Ctrl K</Kbd></span>
            </button>
            <label className="flex items-center gap-1 text-xs">
              <span className="sr-only">{t.theme}</span>
              <select value={theme} onChange={(e) => { const v = e.target.value as Theme; withThemeFade(() => setTheme(v)); }} className="tsel px-2 py-1.5" aria-label={t.theme}>
                {THEME_IDS.map((x) => <option key={x} value={x}>{t.themes[x]}</option>)}
              </select>
            </label>
            <div role="group" aria-label={t.language} className="langsw flex overflow-hidden">
              {(["en", "fr"] as const).map((l) => (
                <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className="px-2.5 py-1.5 text-xs font-bold">{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <Hint id="palette" className="ml-auto mb-1 basis-full" />
                  </div>
        </header>
        <div role="status" className={`strip-h flex items-center justify-center gap-2 px-4 text-xs font-bold ${replay || !demo ? "" : "hatch-demo"}`} style={stripStyle}>
          {replay ? t.replayStrip : demo ? t.demoStrip : t.idleStrip}
        </div>
        <nav aria-label={t.navLabel} className="indexbar">
          <div className="wrap flex">
          {visibleRoutes(mode).map((r, k) => (
            <button key={r} type="button" className="navitem" aria-current={route === r ? "page" : undefined} onClick={() => go(r)} title={t.nav[r]} aria-label={`${String(k + 1).padStart(2, "0")} ${t.nav[r]}`}>
              {route === r && <motion.span layoutId="nav-ind" className="nav-ind" transition={{ duration: 0.324, ease: [0.618, 0, 0.382, 1] }} aria-hidden />}
              <span className="nn" aria-hidden>{String(k + 1).padStart(2, "0")}</span>{" "}<span className="nl" aria-hidden>{t.nav[r]}</span>
            </button>
          ))}
          </div>
        </nav>
        <main id="main" ref={main} tabIndex={-1} className="min-w-0 overflow-auto px-[max(21px,3vw)] py-[21px] outline-none">
          <motion.div key={route} className="mx-auto max-w-[1520px]" initial={reduce ? false : { opacity: 0, y: 13 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.324, ease: [0.618, 0, 0.382, 1] }}>{children}</motion.div>
        </main>
        <footer className="topbar px-[max(21px,3vw)] py-1.5 text-xs">
          <div className="wrap flex items-center gap-2">
          <Lock size={13} className="text-accent" aria-hidden />
          <span className="mono">{t.safety}</span>
          <span className="mono ml-4 hidden text-ink3 lg:inline">v{health?.app_version ?? "…"} · {t.notAffiliated}</span>
          <span className="ml-auto mono text-ink3 max-sm:hidden">{t.machineAccess}{lang === "fr" ? " : " : ": "}{health ? tok(lang, "access", health.machine_access) : "…"}</span>
          </div>
        </footer>
      </div>
      <Palette open={palette} onClose={() => setPalette(false)} go={go} />
      <Onboarding go={go} />
      <ToastHost toasts={toasts} />
    </ToastCtx.Provider>
  );
}

export function PageTitle({ title, sub, actions, icon }: { title: string; sub?: string; actions?: ReactNode; icon?: ReactNode }) {
  const { mode, theme } = usePrefs();
  const shown = useDecode(title, theme === "visiere");
  const current = parseHash(location.hash).name;
  const list = visibleRoutes(mode).includes(current) ? visibleRoutes(mode) : ROUTES; // an expert screen opened from a link in Simple mode keeps its full-list position
  return (
    <div className="mb-[21px] flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="fig reveal" aria-hidden>FIG. {String(list.indexOf(current) + 1).padStart(2, "0")} / {list.length}</p>
        <div className="title-mask"><h1 className="mt-1 flex items-center gap-3 text-[length:var(--t-5)] font-extrabold leading-[1.02] tracking-[-0.045em]" aria-label={shown !== title ? title : undefined}>{icon && <span aria-hidden className="title-icon grid h-10 w-10 shrink-0 place-items-center">{icon}</span>}<span aria-hidden={shown !== title || undefined}>{shown}</span></h1></div>
        {sub && <p className="reveal mt-1 max-w-3xl text-ink2" style={{ "--i": 2 } as React.CSSProperties}>{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
