import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { messages, type Lang, type Messages } from "./i18n";
import { resolveTheme, type ThemeId } from "../themes/registry";

export type Theme = ThemeId;
export type Density = "comfortable" | "compact";
export type Mode = "simple" | "expert";
export type StepId = "demo" | "code" | "timeline" | "evidence" | "report";
const STEP_IDS: unknown[] = ["demo", "code", "timeline", "evidence", "report"] satisfies StepId[];
/** The only contextual hints that exist (at most 3, each shown once in Simple mode). */
export type HintId = "marks" | "timeline" | "palette";
export const HINT_IDS: HintId[] = ["marks", "timeline", "palette"];
interface Prefs { lang: Lang; theme: Theme; density: Density; mode: Mode; alerts: boolean; setAlerts: (on: boolean) => void; onboarded: boolean; steps: StepId[]; checklistHidden: boolean; hints: HintId[]; dismissHint: (h: HintId) => void; finishOnboarding: () => void; markStep: (s: StepId) => void; hideChecklist: () => void; restartOnboarding: () => void; setLang: (l: Lang) => void; setTheme: (t: Theme) => void; setDensity: (d: Density) => void; setMode: (m: Mode) => void; t: Messages }

const read = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable: preferences stay in memory */ } };
const Ctx = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (read("u1d.lang", navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en") === "fr" ? "fr" : "en"));
  // themes saved before UI V2 (light, graphite, night) are migrated once: the effect below writes the new id back
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(read("u1d.theme", "")));
  const [density, setDensity] = useState<Density>(() => (read("u1d.density", "comfortable") === "compact" ? "compact" : "comfortable"));
  const [mode, setMode] = useState<Mode>(() => (read("u1d.mode", "simple") === "expert" ? "expert" : "simple"));
  useEffect(() => { write("u1d.mode", mode); }, [mode]);
  // on-screen alert after a capture or replay (in-page only); on unless the owner turned it off
  const [alerts, setAlerts] = useState(() => read("u1d.alerts", "1") !== "0");
  useEffect(() => { write("u1d.alerts", alerts ? "1" : "0"); }, [alerts]);
  const [onboarded, setOnboarded] = useState(() => read("u1d.onboarded", "") === "1");
  // a corrupted value (not JSON, not a list, unknown ids) resets to an empty list instead of breaking the Overview
  const [steps, setSteps] = useState<StepId[]>(() => { try { const v: unknown = JSON.parse(read("u1d.steps", "[]")); return Array.isArray(v) ? v.filter((x): x is StepId => STEP_IDS.includes(x)) : []; } catch { return []; } });
  const [checklistHidden, setChecklistHidden] = useState(() => read("u1d.checklistHidden", "") === "1");
  // hints already dismissed; same reset rule as u1d.steps (known ids only, no duplicates, so never more than 3)
  const [hints, setHints] = useState<HintId[]>(() => { try { const v: unknown = JSON.parse(read("u1d.hints", "[]")); return Array.isArray(v) ? HINT_IDS.filter((h) => v.includes(h)) : []; } catch { return []; } });
  useEffect(() => { write("u1d.onboarded", onboarded ? "1" : ""); }, [onboarded]);
  useEffect(() => { write("u1d.steps", JSON.stringify(steps)); }, [steps]);
  useEffect(() => { write("u1d.checklistHidden", checklistHidden ? "1" : ""); }, [checklistHidden]);
  useEffect(() => { write("u1d.hints", JSON.stringify(hints)); }, [hints]);
  const finishOnboarding = useCallback(() => setOnboarded(true), []);
  const markStep = useCallback((id: StepId) => setSteps((x) => (x.includes(id) ? x : [...x, id])), []);
  const hideChecklist = useCallback(() => setChecklistHidden(true), []);
  const dismissHint = useCallback((h: HintId) => setHints((x) => (x.includes(h) || !HINT_IDS.includes(h) ? x : [...x, h])), []);
  const restartOnboarding = useCallback(() => { setSteps([]); setChecklistHidden(false); setHints([]); setOnboarded(false); }, []);
  useEffect(() => { document.documentElement.lang = lang; write("u1d.lang", lang); }, [lang]);
  useEffect(() => { document.documentElement.dataset.theme = theme; write("u1d.theme", theme); }, [theme]);
  useEffect(() => { document.documentElement.dataset.density = density; write("u1d.density", density); }, [density]);
  const value = useMemo(() => ({ lang, theme, density, mode, alerts, setAlerts, onboarded, steps, checklistHidden, hints, dismissHint, finishOnboarding, markStep, hideChecklist, restartOnboarding, setLang, setTheme, setDensity, setMode, t: messages[lang] }), [lang, theme, density, mode, alerts, onboarded, steps, checklistHidden, hints, dismissHint, finishOnboarding, markStep, hideChecklist, restartOnboarding]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error("PrefsProvider missing");
  return v;
}
