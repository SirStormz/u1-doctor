import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { messages, type Lang, type Messages } from "./i18n";

export type Theme = "night" | "graphite" | "light";
export type Density = "comfortable" | "compact";
interface Prefs { lang: Lang; theme: Theme; density: Density; setLang: (l: Lang) => void; setTheme: (t: Theme) => void; setDensity: (d: Density) => void; t: Messages }

const read = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable: preferences stay in memory */ } };
const Ctx = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (read("u1d.lang", navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en") === "fr" ? "fr" : "en"));
  const [theme, setTheme] = useState<Theme>(() => { const v = read("u1d.theme", "light"); return v === "graphite" || v === "night" ? v : "light"; });
  const [density, setDensity] = useState<Density>(() => (read("u1d.density", "comfortable") === "compact" ? "compact" : "comfortable"));
  useEffect(() => { document.documentElement.lang = lang; write("u1d.lang", lang); }, [lang]);
  useEffect(() => { document.documentElement.dataset.theme = theme; write("u1d.theme", theme); }, [theme]);
  useEffect(() => { document.documentElement.dataset.density = density; write("u1d.density", density); }, [density]);
  const value = useMemo(() => ({ lang, theme, density, setLang, setTheme, setDensity, t: messages[lang] }), [lang, theme, density]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error("PrefsProvider missing");
  return v;
}
