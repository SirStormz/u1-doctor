/** UI V2 themes. The token values live in design/tokens.css under [data-theme="<id>"]. */
export type ThemeId = "pupitre" | "notice" | "obsidienne" | "visiere";

export interface ThemeMeta {
  id: ThemeId;
  /** Settings preview: page background, card surface, accent. */
  swatch: [string, string, string];
}

export const THEMES: readonly ThemeMeta[] = [
  { id: "pupitre", swatch: ["#dedad1", "#f2efe8", "#ffb547"] },
  { id: "notice", swatch: ["#ffffff", "#f4f3ef", "#ffb547"] },
  { id: "obsidienne", swatch: ["#0e1013", "#14171c", "#ffb547"] },
  { id: "visiere", swatch: ["#0b090b", "#100c0c", "#ffb547"] },
];
export const THEME_IDS: readonly ThemeId[] = THEMES.map((x) => x.id);
export const DEFAULT_THEME: ThemeId = "obsidienne";

/** Theme names saved before UI V2, mapped to the closest new theme (owner's decision, 2026-11-10). */
const LEGACY: Readonly<Record<string, ThemeId>> = { light: "notice", graphite: "pupitre", night: "obsidienne" };

/** The theme to use for a saved value: a known id, a legacy name, or the default for anything else. */
export function resolveTheme(saved: string | null | undefined): ThemeId {
  if (!saved) return DEFAULT_THEME;
  if ((THEME_IDS as readonly string[]).includes(saved)) return saved as ThemeId;
  return Object.hasOwn(LEGACY, saved) ? LEGACY[saved]! : DEFAULT_THEME;
}
