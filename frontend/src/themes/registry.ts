/** UI V2 themes. Tokens live in design/tokens.css, skins in themes/<id>/theme.css, both under [data-theme="<id>"]. */
import pupitreThumb from "../assets/themes/pupitre.webp";
import noticeThumb from "../assets/themes/notice.webp";
import obsidienneThumb from "../assets/themes/obsidienne.webp";
import visiereThumb from "../assets/themes/visiere.webp";

export type ThemeId = "pupitre" | "notice" | "obsidienne" | "visiere";

export interface ThemeMeta {
  id: ThemeId;
  /** Settings preview: a real capture of the Overview in this theme (480 x 300). */
  thumb: string;
}

export const THEMES: readonly ThemeMeta[] = [
  { id: "pupitre", thumb: pupitreThumb },
  { id: "notice", thumb: noticeThumb },
  { id: "obsidienne", thumb: obsidienneThumb },
  { id: "visiere", thumb: visiereThumb },
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
