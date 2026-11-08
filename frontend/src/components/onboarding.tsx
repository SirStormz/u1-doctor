import { useEffect, useRef, useState } from "react";
import { Check, FlaskConical, ListChecks, Plug } from "lucide-react";
import { useIncident } from "../lib/data";
import { usePrefs, type Mode, type StepId } from "../lib/prefs";
import type { RouteName } from "../lib/router";
import { Button, Chip, Panel } from "./ui";

const TOTAL = 3;
type Path = "demo" | "connect";

/** First-run assistant: three short steps, skippable at any time (Esc or "Skip", both keep the level chosen), replayable from Settings. */
export function Onboarding({ go }: { go: (n: RouteName, p?: string) => void }) {
  const { t, lang, setLang, mode, setMode, onboarded, finishOnboarding } = usePrefs();
  const { setDemo } = useIncident();
  const o = t.onb;
  const [step, setStep] = useState(1);
  const [level, setLevel] = useState<Mode>(mode);
  const [path, setPath] = useState<Path>("demo");
  const box = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { if (!onboarded) { setStep(1); setLevel(mode); setPath("demo"); } }, [onboarded]); // eslint-disable-line react-hooks/exhaustive-deps
  // while open: the rest of the app is inert and hidden from assistive tech; on close, focus goes back where it was
  useEffect(() => {
    if (onboarded) return;
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const me = wrap.current;
    const others = me?.parentElement ? [...me.parentElement.children].filter((el) => el !== me) : [];
    const saved = others.map((el) => [el, el.getAttribute("aria-hidden"), el.hasAttribute("inert")] as const);
    for (const el of others) { el.setAttribute("aria-hidden", "true"); el.setAttribute("inert", ""); }
    return () => {
      for (const [el, hidden, inert] of saved) {
        if (hidden === null) el.removeAttribute("aria-hidden"); else el.setAttribute("aria-hidden", hidden);
        if (!inert) el.removeAttribute("inert");
      }
      const back = prev && prev !== document.body && prev.isConnected ? prev : document.getElementById("main");
      back?.focus({ preventScroll: true });
    };
  }, [onboarded]);
  // the heading takes focus on open and at each step, so a screen reader announces the new step (after the shell has focused <main>)
  useEffect(() => { if (onboarded) return; const id = requestAnimationFrame(() => heading.current?.focus()); return () => cancelAnimationFrame(id); }, [step, onboarded]);
  // Esc anywhere skips, keeping the level already chosen (the language is applied as soon as it is picked)
  useEffect(() => {
    if (onboarded) return;
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setMode(level); finishOnboarding(); } };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onboarded, level, setMode, finishOnboarding]);
  if (onboarded) return null;

  const skip = () => { setMode(level); finishOnboarding(); };
  const finish = () => {
    setMode(level);
    if (path === "demo") { setDemo(true); go("overview"); } else go("connect");
    finishOnboarding();
  };
  // focus trap: Tab and Shift+Tab cycle inside the dialog
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !box.current) return;
    const f = [...box.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]")].filter((el) => el.tabIndex >= 0 && !el.hasAttribute("disabled"));
    if (!f.length) return;
    const i = f.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1]!.focus(); }
    else if (!e.shiftKey && (i === f.length - 1 || !box.current.contains(document.activeElement))) { e.preventDefault(); f[0]!.focus(); }
  };
  // radio groups: one tab stop (the checked option), arrows / Home / End move and select
  const onRadioKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const r = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
    const i = r.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const n = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % r.length : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + r.length) % r.length : e.key === "Home" ? 0 : e.key === "End" ? r.length - 1 : -1;
    if (n < 0) return;
    e.preventDefault();
    r[n]!.focus();
    r[n]!.click();
  };
  const title = step === 1 ? o.s1Title : step === 2 ? o.s2Title : o.s3Title;
  const body = step === 1 ? o.s1Body : step === 2 ? o.s2Body : o.s3Body;

  const choice = <T extends string>(value: T, current: T, set: (v: T) => void, name: string, text: string, icon?: React.ReactNode) => (
    <button key={value} type="button" role="radio" aria-checked={current === value} tabIndex={current === value ? 0 : -1} onClick={() => set(value)} className="flex items-start gap-3 border-2 p-3 text-left"
      style={{ borderColor: current === value ? "var(--accent)" : "var(--line)", background: "var(--surface-2)", boxShadow: current === value ? "var(--glow)" : "none" }}>
      <span className="mt-0.5 text-accent" aria-hidden>{current === value ? <Check size={18} /> : icon ?? <span className="block h-[18px] w-[18px] border-2 border-line" />}</span>
      <span><span className="block font-bold">{name}</span><span className="block text-sm text-ink2">{text}</span></span>
    </button>
  );

  return (
    <div ref={wrap} className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(14,14,14,0.72)] p-4" onKeyDown={onKey}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="onb-title" className="panel w-[min(560px,94vw)]" data-active="true">
        <div className="border-b border-line px-5 py-3"><p className="micro">{o.stepOf.replace("{n}", String(step)).replace("{total}", String(TOTAL))}</p></div>
        <div className="grid gap-4 px-5 py-5">
          <div><h2 id="onb-title" ref={heading} tabIndex={-1} className="text-xl font-extrabold tracking-[-0.03em] outline-none">{title}</h2><p className="mt-1 text-ink2">{body}</p></div>

          {step === 1 && (
            <>
              <div role="group" aria-label={t.language} className="flex gap-2">
                {(["en", "fr"] as const).map((l) => <Button key={l} aria-pressed={lang === l} variant={lang === l ? "primary" : "secondary"} onClick={() => setLang(l)}>{l === "en" ? "English" : "Français"}</Button>)}
              </div>
              <div role="radiogroup" aria-label={o.level} className="grid gap-2" onKeyDown={onRadioKey}>
                <p className="micro">{o.level}</p>
                {choice<Mode>("simple", level, setLevel, o.simpleName, o.simpleBody)}
                {choice<Mode>("expert", level, setLevel, o.expertName, o.expertBody)}
              </div>
            </>
          )}

          {step === 2 && (
            <div role="radiogroup" aria-label={o.s2Title} className="grid gap-2" onKeyDown={onRadioKey}>
              {choice<Path>("demo", path, setPath, o.demoName, o.demoBody, <FlaskConical size={18} />)}
              {choice<Path>("connect", path, setPath, o.connectName, o.connectBody, <Plug size={18} />)}
            </div>
          )}

          {step === 3 && (
            <>
              <ul className="grid gap-2">
                <li className="flex flex-wrap items-center gap-2"><Chip tone="ok">{o.k1}</Chip><span className="text-ink2">{o.k1b}</span></li>
                <li className="flex flex-wrap items-center gap-2"><Chip tone="warn">{o.k2}</Chip><span className="text-ink2">{o.k2b}</span></li>
                <li className="flex flex-wrap items-center gap-2"><Chip>{o.k3}</Chip><span className="text-ink2">{o.k3b}</span></li>
              </ul>
              <p className="text-sm text-ink2">{o.s3Safe}</p>
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={skip}>{o.skip}</Button>
          <div className="flex gap-2">
            {step > 1 && <Button onClick={() => setStep(step - 1)}>{o.back}</Button>}
            {step < TOTAL ? <Button variant="primary" onClick={() => setStep(step + 1)}>{o.next}</Button> : <Button variant="primary" onClick={finish}>{o.start}</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

const ITEMS: { id: StepId; route: RouteName }[] = [
  { id: "demo", route: "overview" }, { id: "code", route: "explorer" }, { id: "timeline", route: "timeline" }, { id: "evidence", route: "evidence" }, { id: "report", route: "report" },
];

/** "Getting started" list on the Overview: ticks itself from real use, can be hidden, comes back with the replay in Settings. */
export function FirstSteps({ go }: { go: (n: RouteName, p?: string) => void }) {
  const { t, steps, checklistHidden, hideChecklist, onboarded } = usePrefs();
  const { setDemo } = useIncident();
  const o = t.onb;
  if (checklistHidden || !onboarded) return null;
  const done = ITEMS.every((i) => steps.includes(i.id));
  return (
    <Panel title={o.listTitle} icon={<ListChecks size={17} />} i={0} actions={<Button variant="ghost" onClick={hideChecklist}>{o.hide}</Button>}>
      <p className="mb-2 text-sm text-ink2">{done ? o.done : o.listSub}</p>
      <ul className="grid gap-2 sm:grid-cols-2 min-[1500px]:grid-cols-5">
        {ITEMS.map((i) => {
          const ok = steps.includes(i.id);
          return (
            <li key={i.id}>
              <button type="button" onClick={() => (i.id === "demo" ? setDemo(true) : go(i.route))} className="flex w-full items-center gap-2 border border-line bg-surface2 px-3 py-2 text-left">
                <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center border-2" style={{ borderColor: ok ? "var(--ok)" : "var(--line)", color: "var(--ok)" }}>{ok && <Check size={14} />}</span>
                <span className={ok ? "text-ink3 line-through" : ""}>{o.items[i.id]}</span>
                {ok && <span className="sr-only">✓</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
