import { useEffect, useRef, useState } from "react";
import { Check, FlaskConical, ListChecks, Plug } from "lucide-react";
import { useIncident } from "../lib/data";
import { usePrefs, type Mode, type StepId } from "../lib/prefs";
import type { RouteName } from "../lib/router";
import { Button, Chip, Panel } from "./ui";

const TOTAL = 3;
type Path = "demo" | "connect";

/** First-run assistant: three short steps, skippable at any time (Esc or "Skip"), replayable from Settings. */
export function Onboarding({ go }: { go: (n: RouteName, p?: string) => void }) {
  const { t, lang, setLang, mode, setMode, onboarded, finishOnboarding } = usePrefs();
  const { setDemo } = useIncident();
  const o = t.onb;
  const [step, setStep] = useState(1);
  const [level, setLevel] = useState<Mode>(mode);
  const [path, setPath] = useState<Path>("demo");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!onboarded) { setStep(1); setLevel(mode); setPath("demo"); } }, [onboarded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { box.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(); }, [step, onboarded]);
  if (onboarded) return null;

  const finish = () => {
    setMode(level);
    if (path === "demo") { setDemo(true); go("overview"); } else go("connect");
    finishOnboarding();
  };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); finishOnboarding(); } };
  const title = step === 1 ? o.s1Title : step === 2 ? o.s2Title : o.s3Title;
  const body = step === 1 ? o.s1Body : step === 2 ? o.s2Body : o.s3Body;

  const choice = <T extends string>(value: T, current: T, set: (v: T) => void, name: string, text: string, icon?: React.ReactNode, first?: boolean) => (
    <button key={value} type="button" role="radio" aria-checked={current === value} data-autofocus={first ? "" : undefined} onClick={() => set(value)} className="flex items-start gap-3 border-2 p-3 text-left"
      style={{ borderColor: current === value ? "var(--accent)" : "var(--line)", background: "var(--surface-2)", boxShadow: current === value ? "var(--glow)" : "none" }}>
      <span className="mt-0.5 text-accent" aria-hidden>{current === value ? <Check size={18} /> : icon ?? <span className="block h-[18px] w-[18px] border-2 border-line" />}</span>
      <span><span className="block font-bold">{name}</span><span className="block text-sm text-ink2">{text}</span></span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(14,14,14,0.72)] p-4" onKeyDown={onKey}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="onb-title" className="panel w-[min(560px,94vw)]" data-active="true">
        <div className="border-b border-line px-5 py-3"><p className="micro">{o.stepOf.replace("{n}", String(step)).replace("{total}", String(TOTAL))}</p></div>
        <div className="grid gap-4 px-5 py-5">
          <div><h2 id="onb-title" className="text-xl font-extrabold tracking-[-0.03em]">{title}</h2><p className="mt-1 text-ink2">{body}</p></div>

          {step === 1 && (
            <>
              <div role="group" aria-label={t.language} className="flex gap-2">
                {(["en", "fr"] as const).map((l) => <Button key={l} aria-pressed={lang === l} variant={lang === l ? "primary" : "secondary"} onClick={() => setLang(l)}>{l === "en" ? "English" : "Français"}</Button>)}
              </div>
              <div role="radiogroup" aria-label={o.level} className="grid gap-2">
                <p className="micro">{o.level}</p>
                {choice<Mode>("simple", level, setLevel, o.simpleName, o.simpleBody, undefined, true)}
                {choice<Mode>("expert", level, setLevel, o.expertName, o.expertBody)}
              </div>
            </>
          )}

          {step === 2 && (
            <div role="radiogroup" aria-label={o.s2Title} className="grid gap-2">
              {choice<Path>("demo", path, setPath, o.demoName, o.demoBody, <FlaskConical size={18} />, true)}
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
          <Button variant="ghost" onClick={finishOnboarding}>{o.skip}</Button>
          <div className="flex gap-2">
            {step > 1 && <Button onClick={() => setStep(step - 1)}>{o.back}</Button>}
            {step < TOTAL ? <Button variant="primary" onClick={() => setStep(step + 1)}>{o.next}</Button> : <Button variant="primary" data-autofocus="" onClick={finish}>{o.start}</Button>}
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
