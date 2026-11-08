import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import { ArrowRight, Check, ChevronDown, Lock, Pause, Play, Sparkles, X } from "lucide-react";
import keyart from "../assets/keyart.webp";
import { Chip, Kbd, Logo, SeverityChip } from "../components/ui";
import { api } from "../api";
import { hhmmss, tms, useIncident, val } from "../lib/data";
import { tx } from "../lib/dyn";
import { hasWebGL } from "../lib/webgl";
import { isGoldKey } from "../lib/keys";
import type { SceneCtl } from "../viz/LandingScene";
import { MODEL_URL } from "../viz/u1model";
import { usePrefs } from "../lib/prefs";
import { tok } from "../lib/dyn";
import type { RouteName } from "../lib/router";

const LandingScene = lazy(() => import("../viz/LandingScene").then((m) => ({ default: m.LandingScene })));

const PHI_EASE = [0.618, 0, 0.382, 1] as const;
const PHI = 1.618034;

/** Words rise out of a mask, 62 ms apart (transform only). */
function Words({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.1em] align-bottom" aria-hidden>
          <motion.span className="inline-block" initial={reduce ? false : { y: "108%" }} animate={{ y: 0 }} transition={{ duration: 0.848, ease: PHI_EASE, delay: delay + i * 0.062 }}>
            {w}&nbsp;
          </motion.span>
        </span>
      ))}
    </span>
  );
}

function Rise({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 34 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, margin: "-12% 0px -12% 0px" }} transition={{ duration: 0.524, ease: PHI_EASE, delay }}>
      {children}
    </motion.div>
  );
}

/** Golden construction overlay (Alt+G): phi grid lines + logarithmic golden spiral. */
export function GoldenOverlay({ on, label }: { on: boolean; label: string }) {
  const d = useMemo(() => {
    const pts: string[] = [];
    for (let k = 0; k <= 520; k++) {
      const th = -3.2 * Math.PI + (k / 520) * 5.2 * Math.PI;
      const r = 14 * Math.pow(PHI, (2 * th) / Math.PI);
      pts.push(`${(618 + r * Math.cos(th)).toFixed(1)} ${(382 + r * Math.sin(th)).toFixed(1)}`);
    }
    return "M" + pts.join(" L");
  }, []);
  return (
    <motion.svg className="pointer-events-none fixed inset-0 z-20 h-full w-full" viewBox="0 0 1000 618" preserveAspectRatio="none" role="img" aria-label={label}
      initial={false} animate={{ opacity: on ? 1 : 0 }} transition={{ duration: 0.524, ease: PHI_EASE }} style={{ visibility: on ? "visible" : "hidden" }}>
      <g stroke="#0e0e0e" strokeOpacity="0.4" strokeWidth="1" fill="none">
        {[382, 618].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="618" vectorEffect="non-scaling-stroke" strokeDasharray="4 6" />)}
        {[236, 382].map((y) => <line key={y} x1="0" y1={y} x2="1000" y2={y} vectorEffect="non-scaling-stroke" strokeDasharray="4 6" />)}
      </g>
      <motion.path d={d} fill="none" stroke="#0e0e0e" strokeWidth="5" vectorEffect="non-scaling-stroke" initial={false} animate={{ pathLength: on ? 1 : 0 }} transition={{ duration: 1.372, ease: PHI_EASE }} />
      <motion.path d={d} fill="none" stroke="#ffc400" strokeWidth="2.5" vectorEffect="non-scaling-stroke" initial={false} animate={{ pathLength: on ? 1 : 0 }} transition={{ duration: 1.372, ease: PHI_EASE }} />
    </motion.svg>
  );
}

type EvKind = "printing" | "paused" | "gap" | "code";
const FALLBACK_EVENTS: { kind: EvKind; time: string }[] = [{ kind: "printing", time: "" }, { kind: "gap", time: "" }, { kind: "paused", time: "" }, { kind: "code", time: "" }];
const SAMPLES = ["0002-0525-0002-0004", "0003-0522-0002-0008", "0002-0525-0002-0002"];
const DWELL = [3.5, 5, 8, 9, 5, 3]; // seconds spent on each chapter during the guided tour
const MOVE = 2.6;
const smoothstep = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
type Sim = { kind: "ok"; title: string; summary: string; sev: string | null | undefined; head: number | null } | { kind: "unknown" | "bad" | "down" } | null;

export function Landing({ go }: { go: (n: RouteName, p?: string) => void }) {
  const { t, lang, setLang } = usePrefs();
  const L = t.landing;
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<"loading" | "ready" | "fallback">(() => (reduce || !hasWebGL() ? "fallback" : "loading"));
  const [spiral, setSpiral] = useState(false);
  const { scrollYProgress } = useScroll();
  const bar = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.4 });
  const inc = useIncident();

  // ---- interactive state shared with the 3D scene (mutable ref: no React render per frame) ----
  const ctl = useRef<SceneCtl>({ head: 0, incident: null, explode: 0 });
  const [pick, setPick] = useState<string | null>(null);
  const [explodeOn, setExplodeOn] = useState(false);
  const [code, setCode] = useState("");
  const [sim, setSim] = useState<Sim>(null);
  const [touched, setTouched] = useState(false);
  const [evIdx, setEvIdx] = useState(2);
  const events = useMemo(() => {
    if (inc.status !== "ready") return FALLBACK_EVENTS;
    const list = inc.obs.filter((o) => ["state_transition", "user_reported_error_code", "capture_gap"].includes(o.event_type)).sort((a, b) => tms(a) - tms(b))
      .map((o) => ({ kind: (o.event_type === "capture_gap" ? "gap" : o.event_type === "user_reported_error_code" ? "code" : ["paused", "error"].includes(String(val(o).state)) ? "paused" : "printing") as EvKind, time: hhmmss(tms(o)) }));
    return list.length ? list : FALLBACK_EVENTS;
  }, [inc.status, inc.obs]);
  const ev = events[Math.min(evIdx, events.length - 1)]!;
  useEffect(() => { ctl.current.incident = touched ? ev.kind : null; }, [touched, ev.kind]);
  useEffect(() => { ctl.current.explode = explodeOn ? 1 : 0; }, [explodeOn]);

  const runSim = useCallback(async (c: string) => {
    setCode(c);
    try {
      const r = await api.interpret(c.trim());
      const d = r.decoding;
      if (d.status === "KNOWN" && d.entry) {
        const head = (d.entry as { toolhead?: number | null }).toolhead ?? null;
        ctl.current.head = head ?? 0;
        setSim({ kind: "ok", title: d.entry.title, summary: d.entry.summary, sev: d.severity, head });
      } else { ctl.current.head = 0; setSim({ kind: d.status === "MALFORMED" ? "bad" : "unknown" }); }
    } catch { ctl.current.head = 0; setSim({ kind: "down" }); }
  }, []);

  // ---- guided tour: scrolls through the chapters by itself; any wheel / touch / key / scrollbar use takes the hand back ----
  const [playing, setPlaying] = useState(false);
  const [chapter, setChapter] = useState(0);
  const tour = useRef({ raf: 0, expected: 0, simDone: false });
  const evCount = useRef(events.length);
  evCount.current = events.length;
  const chapterY = () => Array.from(root.current?.querySelectorAll<HTMLElement>("[data-chapter]") ?? []).map((c) => { const r = c.getBoundingClientRect(); return r.top + window.scrollY + r.height / 2 - window.innerHeight / 2; });
  const stopTour = useCallback(() => { cancelAnimationFrame(tour.current.raf); setPlaying(false); }, []);
  const startTour = useCallback(() => {
    const ys = chapterY();
    if (!ys.length) return;
    let k0 = ys.findIndex((y) => y >= window.scrollY - 8);
    if (k0 < 0 || window.scrollY > ys[ys.length - 1]! - 8) k0 = 0;
    const segs: { y0: number; y1: number; dur: number; k: number }[] = [];
    const from = window.scrollY;
    if (Math.abs(ys[k0]! - from) > 12) segs.push({ y0: from, y1: ys[k0]!, dur: MOVE, k: -1 });
    for (let k = k0; k < ys.length; k++) {
      segs.push({ y0: ys[k]!, y1: ys[k]!, dur: DWELL[k] ?? 4, k });
      if (k < ys.length - 1) segs.push({ y0: ys[k]!, y1: ys[k + 1]!, dur: MOVE, k: -1 });
    }
    const total = segs.reduce((a, g) => a + g.dur, 0);
    tour.current.simDone = false;
    tour.current.expected = window.scrollY;
    setPlaying(true);
    let t = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;
      if (Math.abs(window.scrollY - tour.current.expected) > 10) { stopTour(); return; } // the user moved the page
      if (t >= total) { stopTour(); return; }
      let acc = 0;
      for (const g of segs) {
        if (t <= acc + g.dur) {
          const p = (t - acc) / g.dur;
          const y = g.y0 + (g.y1 - g.y0) * smoothstep(p);
          window.scrollTo(0, y);
          tour.current.expected = window.scrollY;
          if (g.k === 2 && !tour.current.simDone) { tour.current.simDone = true; void runSim(SAMPLES[0]!); }
          if (g.k === 3) { setTouched(true); setEvIdx(Math.min(evCount.current - 1, Math.floor(p * evCount.current))); }
          break;
        }
        acc += g.dur;
      }
      tour.current.raf = requestAnimationFrame(tick);
    };
    tour.current.raf = requestAnimationFrame(tick);
  }, [runSim, stopTour]);
  useEffect(() => {
    if (!playing) return;
    const stop = () => stopTour();
    const key = (e: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.key)) stopTour(); };
    window.addEventListener("wheel", stop, { passive: true }); window.addEventListener("touchstart", stop, { passive: true }); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("wheel", stop); window.removeEventListener("touchstart", stop); window.removeEventListener("keydown", key); };
  }, [playing, stopTour]);
  useEffect(() => () => cancelAnimationFrame(tour.current.raf), []);
  useEffect(() => {
    const on = () => {
      const ys = chapterY();
      let k = 0;
      ys.forEach((y, i) => { if (window.scrollY >= y - window.innerHeight * 0.3) k = i; });
      setChapter(k);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const evLabel = (k: EvKind) => (k === "printing" ? L.evPrinting : k === "paused" ? L.evPaused : k === "gap" ? L.evGapEv : L.evCodeEv);
  const goChapter = (k: number) => { const y = chapterY()[k]; if (y != null) window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" }); };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (isGoldKey(e)) { e.preventDefault(); setSpiral((s) => !s); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  useEffect(() => { document.title = `${t.appName} — ${L.title}`; window.scrollTo(0, 0); }, [t.appName, L.title]);

  const enter = () => go("overview");
  const section = "pointer-events-none relative z-10 px-[max(21px,5vw)] [&>*]:pointer-events-auto";
  const sticky = "tpanel sticky top-[13vh] grid max-h-[calc(87vh-86px)] gap-[16px] overflow-y-auto";
  const meta: [string, string][] = [[L.metaObject, "Snapmaker U1"], [L.metaMode, "DEMO"], [L.metaAccess, L.pill1], [L.metaData, "SYNTHETIC"]];

  return (
    <div ref={root} data-theme="light" className="landing relative min-h-full overflow-x-clip bg-bg text-ink">
      {/* fixed stage */}
      <div className="fixed inset-0 z-0 overflow-hidden" style={{ background: "#f4f4f0" }}>
        {scene !== "fallback" && (
          <Suspense fallback={null}>
            <LandingScene src={MODEL_URL} rootRef={root} ctl={ctl} onPick={setPick} onReady={() => setScene("ready")} onFail={() => setScene("fallback")} />
          </Suspense>
        )}
        {scene === "fallback" && (
          <figure className="absolute inset-y-0 right-0 m-0 flex w-full items-center justify-end md:w-[61.8%]">
            <img src={keyart} alt={L.illustration} className="max-h-[78vh] w-full object-contain" />
            <figcaption className="micro absolute bottom-6 right-6">{L.fallbackNote}</figcaption>
          </figure>
        )}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <g key={n}>
              <path data-lead-path={n} d="" fill="none" stroke="#0e0e0e" strokeWidth="2" style={{ opacity: 0 }} />
              <circle data-lead-dot={n} r="6" fill="#ffc400" stroke="#0e0e0e" strokeWidth="2" style={{ opacity: 0 }} />
            </g>
          ))}
          <path data-proof-path="fact" d="" fill="none" stroke="#0e0e0e" strokeWidth="2.4" style={{ opacity: 0 }} />
          <path data-proof-path="hyp" d="" fill="none" stroke="#a24500" strokeWidth="2.4" strokeDasharray="8 6" style={{ opacity: 0 }} />
          <path data-proof-path="gap" d="" fill="none" stroke="#55554e" strokeWidth="2.2" strokeDasharray="2 6" style={{ opacity: 0 }} />
        </svg>
        {/* giant numerals 01-04 (hero) */}
        <div className="pointer-events-none absolute right-[max(21px,3.4vw)] top-[16vh] grid gap-[1.2vh] max-lg:hidden" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} data-num={n} className="font-extrabold leading-[0.86] tracking-[-0.06em] text-ink" style={{ fontSize: "clamp(44px, 9vh, 96px)", opacity: 0 }}>0{n}</span>
          ))}
        </div>
        {/* toolhead labels (chapters 2-3) */}
        {[1, 2, 3, 4].map((n) => (
          <div key={n} data-hot={n} className="pointer-events-none absolute left-0 top-0 flex items-center gap-1 whitespace-nowrap border border-ink bg-yellow px-2 py-0.5 text-xs font-extrabold text-[#0e0e0e]" style={{ opacity: 0, willChange: "transform" }}>
            {n} · {t.toolhead} {n}
          </div>
        ))}
      </div>

      <GoldenOverlay on={spiral} label={L.spiral} />
      <motion.div className="fixed left-0 top-[46px] z-40 h-[4px] w-full origin-left bg-yellow" style={{ scaleX: bar }} aria-hidden />

      {/* header: the same black bar as the app */}
      <header className="topbar fixed inset-x-0 top-0 z-30 flex items-center gap-3 px-[max(16px,5vw)] py-[8px]">
        <a href="#/" className="flex items-center gap-3 whitespace-nowrap no-underline" style={{ color: "#f4f4f0" }} aria-label={t.appName}><Logo /><span className="text-[17px] font-extrabold uppercase tracking-[0.04em]">{t.appName}</span></a>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden />
        <span className="hidden gap-2 sm:flex"><Chip tone="demo">{t.modeDemo}</Chip><Chip tone="accent" icon={<Lock size={11} aria-hidden />}>{t.readOnly}</Chip></span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setSpiral((s) => !s)} aria-pressed={spiral} title={L.spiralHint} className="btn btn-ghost !px-2.5 !py-1 max-sm:!hidden" style={{ color: "#c9c9c0" }}><Sparkles size={15} aria-hidden /><span className="sr-only">{L.spiral}</span><Kbd>Alt G</Kbd></button>
          <div role="group" aria-label={t.language} className="flex overflow-hidden border border-control">
            {(["en", "fr"] as const).map((l) => (
              <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className="px-2.5 py-1 text-xs font-bold" style={{ background: lang === l ? "#ffc400" : "#1e1e1b", color: lang === l ? "#0e0e0e" : "#c9c9c0" }}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button type="button" onClick={enter} className="btn btn-primary whitespace-nowrap !py-1 max-[460px]:!hidden" style={{ boxShadow: "none" }}>{L.enter}<ArrowRight size={15} aria-hidden /></button>
        </div>
      </header>

      <main id="main" className="pointer-events-none">
        {/* 0 · hero */}
        <section data-chapter className={`${section} grid min-h-screen content-center pt-[56px]`} aria-labelledby="h-hero">
          <div className="tpanel max-w-[min(720px,47vw)] max-md:max-w-full">
            <Rise>
              <dl className="grid max-w-[560px] grid-cols-2 gap-x-6 gap-y-3 border-y-2 border-ink py-3 sm:grid-cols-4">
                {meta.map(([k, v]) => (<div key={k}><dt className="micro">{k}</dt><dd className="m-0 text-[15px] font-extrabold">{v}</dd></div>))}
              </dl>
            </Rise>
            <h1 id="h-hero" className="mt-[34px] text-[clamp(44px,7vw,var(--t-8))] font-extrabold leading-[0.95] tracking-[-0.055em]"><Words text={L.title} delay={0.3} /></h1>
            <Rise delay={0.9}><p className="mt-[21px] max-w-[36ch] text-[length:var(--t-1)] font-medium leading-[1.4] text-ink2">{L.sub}</p></Rise>
            <Rise delay={1.1} className="mt-[34px] flex flex-wrap items-center gap-4">
              <button type="button" onClick={enter} className="btn btn-primary !px-6 !py-3 text-[16px]">{L.enter}<ArrowRight size={18} aria-hidden /></button>
              <button type="button" onClick={() => document.getElementById("story")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" })} className="btn btn-ghost !py-3 text-ink2">{L.scroll}<ChevronDown size={16} aria-hidden /></button>
            </Rise>
            <Rise delay={1.3} className="mt-[34px] flex flex-wrap gap-2">
              <Chip tone="accent" icon={<Lock size={11} aria-hidden />}>{L.pill1}</Chip><Chip>{L.pill2}</Chip><Chip>{L.pill3}</Chip><Chip>{L.pill4}</Chip><Chip tone="demo">{L.demoNote}</Chip>
            </Rise>
          </div>
        </section>

        {/* 1 · scan */}
        <section id="story" data-chapter className={`${section} min-h-[165vh]`} aria-labelledby="h-c1">
          <div className={`${sticky} ml-auto max-w-[min(520px,38vw)] max-md:max-w-full`}>
            <Rise><span className="manual-label">{L.c1k}</span></Rise>
            <Rise delay={0.062}><h2 id="h-c1" className="text-[length:var(--t-5)] font-extrabold leading-[1] tracking-[-0.05em]">{L.c1h}</h2></Rise>
            <Rise delay={0.124}><p className="text-[length:var(--t-1)] font-medium leading-[1.45] text-ink2">{L.c1b}</p></Rise>
          </div>
        </section>

        {/* 2 · dissect */}
        <section data-chapter className={`${section} min-h-[190vh]`} aria-labelledby="h-c2">
          <div className={`${sticky} max-w-[min(430px,30vw)] max-md:max-w-full`}>
            <Rise><span className="manual-label">{L.c2k}</span></Rise>
            <Rise delay={0.062}><h2 id="h-c2" className="text-[length:var(--t-4)] font-extrabold leading-[1.02] tracking-[-0.05em]">{L.c2h}</h2></Rise>
            <Rise delay={0.124}><p className="text-[length:var(--t-0)] font-medium leading-[1.5] text-ink2">{L.c2b}</p></Rise>
            <form className="grid gap-2 border-t-2 border-ink pt-3" onSubmit={(e) => { e.preventDefault(); if (code.trim()) void runSim(code); }}>
              <label htmlFor="sim-code" className="micro">{L.simTitle}</label>
              <div className="flex gap-2">
                <input id="sim-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={32} inputMode="numeric" autoComplete="off" placeholder={L.simPlaceholder} className="mono min-w-0 flex-1 border-2 border-ink bg-surface px-3 py-2 text-ink" />
                <button type="submit" className="btn btn-primary !py-2" style={{ boxShadow: "none" }}>{L.simGo}</button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-ink3">{L.simSamples}</span>{SAMPLES.map((s) => <button key={s} type="button" className="chip" data-tone="accent" onClick={() => void runSim(s)}>{s}</button>)}</div>
              <div aria-live="polite">
                {sim?.kind === "ok" && (
                  <div className="border-2 border-ink bg-surface p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2"><SeverityChip level={sim.sev} />{sim.head != null && <Chip tone="accent">{L.simHead.replace("{n}", String(sim.head))}</Chip>}</div>
                    <p className="font-bold">{tx(lang, sim.title)}</p>
                    <p className="mt-1 text-sm text-ink2">{tx(lang, sim.summary)}</p>
                  </div>
                )}
                {sim && sim.kind !== "ok" && <p className="text-sm text-danger" role="alert">{sim.kind === "bad" ? t.statusMalformed : sim.kind === "unknown" ? t.statusStructure : L.simFail}</p>}
              </div>
            </form>
          </div>
        </section>

        {/* 3 · prove */}
        <section data-chapter className={`${section} min-h-[190vh]`} aria-labelledby="h-c3">
          <div className={`${sticky} ml-auto w-[min(440px,40vw)] max-md:w-full`}>
            <Rise><span className="manual-label">{L.c3k}</span></Rise>
            <Rise delay={0.062}><h2 id="h-c3" className="text-[length:var(--t-2)] font-extrabold leading-[1.05] tracking-[-0.04em]">{L.c3h}</h2></Rise>
            <Rise delay={0.124}><p className="font-medium text-ink2">{L.c3b}</p></Rise>
            <div className="grid gap-2 border-t-2 border-ink pt-3">
              <label htmlFor="ev-range" className="micro">{L.timeTitle}</label>
              <input id="ev-range" type="range" min={0} max={events.length - 1} step={1} value={Math.min(evIdx, events.length - 1)} aria-label={L.timeLabel} aria-valuetext={`${evLabel(ev.kind)} ${ev.time}`}
                onChange={(e) => { setTouched(true); setEvIdx(Number(e.target.value)); }} className="w-full accent-[var(--ink)]" />
              <ol className="flex justify-between gap-1 text-[11px] font-bold" aria-hidden>{events.map((x, i) => <li key={i} className="text-center" style={{ opacity: i === evIdx ? 1 : 0.5 }}>{evLabel(x.kind)}<br /><span className="mono font-normal">{x.time}</span></li>)}</ol>
            </div>
            <div className="grid gap-3">
              <Rise delay={0.18}>
                <article data-proof-card="fact" className="border-2 border-ink bg-surface p-3" style={{ opacity: touched && ev.kind === "gap" ? 0.4 : 1 }}>
                  <div className="flex items-center justify-between"><span className="manual-label">{L.fact}</span><Chip tone="demo">{tok(lang, "provenance", "SYNTHETIC")}</Chip></div>
                  <p className="mt-2 font-bold">{touched && ev.kind === "printing" ? L.factPrinting : L.factText}</p>
                </article>
              </Rise>
              <Rise delay={0.24}>
                <article data-proof-card="hyp" className="border-2 border-dashed border-ink bg-surface p-3" style={{ opacity: touched && ev.kind !== "code" ? 0.4 : 1 }}>
                  <div className="flex items-center justify-between"><Chip tone="warn">{L.hypothesis}</Chip><Chip tone="demo">{tok(lang, "provenance", "SYNTHETIC")}</Chip></div>
                  <p className="mt-2 font-bold">{L.hypText}</p>
                </article>
              </Rise>
              <Rise delay={0.3}>
                <article data-proof-card="gap" className="hatch border-2 border-dotted border-ink bg-surface p-3" style={{ opacity: touched && ev.kind !== "gap" ? 0.4 : 1 }}>
                  <p className="micro">{L.gapCard}</p>
                  <p className="mt-1 font-bold">{L.gapText}</p>
                </article>
              </Rise>
            </div>
          </div>
        </section>

        {/* 4 · replay */}
        <section data-chapter className={`${section} min-h-[165vh]`} aria-labelledby="h-c4">
          <div className={`${sticky} max-w-[min(520px,38vw)] max-md:max-w-full`}>
            <Rise><span className="manual-label">{L.c4k}</span></Rise>
            <Rise delay={0.062}><h2 id="h-c4" className="text-[length:var(--t-4)] font-extrabold leading-[1.02] tracking-[-0.05em]">{L.c4h}</h2></Rise>
            <Rise delay={0.124}><p className="text-[length:var(--t-0)] font-medium leading-[1.5] text-ink2">{L.c4b}</p></Rise>
            <Rise delay={0.18}>
              <div className="flex items-center gap-4 border-2 border-ink bg-surface p-3" style={{ boxShadow: "5px 5px 0 #ffc400, 5px 5px 0 1px #0e0e0e" } as CSSProperties}>
                <span className="grid h-12 w-12 shrink-0 place-items-center bg-yellow text-[#0e0e0e]" aria-hidden><Check size={26} /></span>
                <div className="min-w-0"><p className="font-extrabold">{L.sealOk}</p><p className="micro">{t.replaySeal}</p></div>
              </div>
            </Rise>
          </div>
        </section>

        {/* 5 · closing */}
        <div data-chapter className="pointer-events-none relative z-10 grid min-h-screen content-end [&>*]:pointer-events-auto">
          <div className="grid justify-items-start gap-[21px] bg-[#0e0e0e] px-[max(21px,5vw)] pb-[96px] pt-[55px] text-[#f4f4f0]" style={{ borderTop: "8px solid #ffc400" }}>
            <h2 className="text-[clamp(36px,6vw,var(--t-7))] font-extrabold leading-[0.95] tracking-[-0.055em]"><Words text={L.title} /></h2>
            <button type="button" onClick={enter} className="btn btn-primary !px-6 !py-3.5 text-[16px]">{L.enter}<ArrowRight size={18} aria-hidden /></button>
            <p className="max-w-[60ch] text-xs" style={{ color: "#a1a197" }}>{L.footNote}</p>
          </div>
        </div>
      </main>

      {/* clicked part */}
      {pick && (() => {
        const hm = /^head(\d)$/.exec(pick);
        const part = hm ? L.parts.head : L.parts[pick as keyof typeof L.parts] ?? L.parts.body;
        return (
          <aside className="tpanel fixed bottom-[78px] left-1/2 z-40 w-[min(380px,calc(100vw-28px))] -translate-x-1/2" aria-label={part.n}>
            <div className="flex items-start justify-between gap-3">
              <p className="manual-label">{hm ? `${part.n} ${hm[1]}` : part.n}</p>
              <button type="button" onClick={() => setPick(null)} className="btn btn-ghost !p-1" aria-label={L.partClose}><X size={16} aria-hidden /></button>
            </div>
            <p className="mt-2 font-medium">{part.b}</p>
            <p className="micro mt-2">{L.partNote}</p>
          </aside>
        );
      })()}

      {/* tour + scene controls */}
      <div className="tour-bar" role="group" aria-label={L.ctlTour}>
        {!reduce && (
          <button type="button" onClick={playing ? stopTour : startTour} className="btn btn-primary !px-3 !py-1.5" style={{ boxShadow: "none" }} aria-pressed={playing}>
            {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}<span className="max-sm:sr-only">{playing ? L.ctlPause : L.ctlPlay}</span>
          </button>
        )}
        <div className="flex gap-1" role="group" aria-label={L.ctlChapter}>
          {[0, 1, 2, 3, 4, 5].map((k) => <button key={k} type="button" className="tour-dot" aria-current={chapter === k} aria-label={`${L.ctlChapter} ${k + 1}`} onClick={() => { stopTour(); goChapter(k); }}>{k + 1}</button>)}
        </div>
        {scene !== "fallback" && <button type="button" onClick={() => setExplodeOn((x) => !x)} aria-pressed={explodeOn} className="btn btn-secondary !px-3 !py-1.5" style={{ background: explodeOn ? "#ffc400" : "#1e1e1b", color: explodeOn ? "#0e0e0e" : "#f4f4f0", borderColor: "#8d8d84" }}>{explodeOn ? L.ctlAssemble : L.ctlExplode}</button>}
        {scene !== "fallback" && <span className="hidden text-xs lg:inline" style={{ color: "#c9c9c0" }}>{L.ctlHint}</span>}
      </div>
    </div>
  );
}
