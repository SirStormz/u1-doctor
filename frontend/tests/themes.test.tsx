import fs from "node:fs";
import path from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { messages } from "../src/lib/i18n";
import { PrefsProvider } from "../src/lib/prefs";
import { DEFAULT_THEME, THEMES, THEME_IDS, resolveTheme } from "../src/themes/registry";

/** UI V2 step 1: theme registry, one-time migration of saved themes, complete token set per theme. */
const css = fs.readFileSync(path.resolve(__dirname, "../src/design/tokens.css"), "utf8");
const tokenNames = (id: string) => {
  const body = new RegExp(`\\[data-theme="${id}"\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
  return [...body.matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1]!).sort();
};
const REQUIRED = ["bg-0", "bg-1", "surface-1", "surface-2", "surface-3", "line", "line-strong", "control-line", "ink", "ink-2", "ink-3",
  "accent", "accent-ink", "yellow", "ok", "warn", "danger", "demo", "replay", "shadow-1", "shadow-2", "glow",
  "font-display", "font-ui", "font-mono"].sort();

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); delete document.documentElement.dataset.theme; });

test("registry: four unique themes, the default is one of them", () => {
  expect(THEME_IDS).toEqual(["pupitre", "notice", "obsidienne", "visiere"]);
  expect(new Set(THEME_IDS).size).toBe(THEMES.length);
  expect(THEME_IDS).toContain(DEFAULT_THEME);
  expect(DEFAULT_THEME).toBe("obsidienne");
});

test("resolveTheme: known ids kept, legacy names migrated, anything else falls back to the default", () => {
  for (const id of THEME_IDS) expect(resolveTheme(id)).toBe(id);
  expect(resolveTheme("light")).toBe("notice");
  expect(resolveTheme("graphite")).toBe("pupitre");
  expect(resolveTheme("night")).toBe("obsidienne");
  for (const v of [null, undefined, "", "dark", "Notice", "constructor", "__proto__", "toString"]) expect(resolveTheme(v)).toBe(DEFAULT_THEME);
});

test("every theme declares the full token set, and only it", () => {
  for (const id of THEME_IDS) expect(tokenNames(id), id).toEqual(REQUIRED);
  // the first block also serves :root, so the page has tokens before the theme attribute is set
  expect(css).toMatch(new RegExp(`:root,\\s*\\[data-theme="${DEFAULT_THEME}"\\]`));
});

test("every theme has a name in both languages, and no legacy theme is left in the stylesheet or the labels", () => {
  for (const lang of ["en", "fr"] as const) expect(Object.keys(messages[lang].themes).sort()).toEqual([...THEME_IDS].sort());
  expect(css).not.toMatch(/data-theme="(light|graphite|night)"/);
});

test.each([["light", "notice"], ["graphite", "pupitre"], ["night", "obsidienne"], ["visiere", "visiere"], ["bogus", "obsidienne"]])(
  "saved theme %s opens as %s and the new id is written back once",
  (saved, expected) => {
    localStorage.setItem("u1d.theme", saved);
    render(<PrefsProvider><span /></PrefsProvider>);
    expect(document.documentElement.dataset.theme).toBe(expected);
    expect(localStorage.getItem("u1d.theme")).toBe(expected);
  },
);

test("a first launch (nothing saved) opens on the default theme", () => {
  render(<PrefsProvider><span /></PrefsProvider>);
  expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME);
});
