import type { ThemeId } from "./registry";
import studioHero from "../assets/renders/studio-hero.webp";
import studioTetes from "../assets/renders/studio-tetes.webp";
import studioEcran from "../assets/renders/studio-ecran.webp";
import hudHero from "../assets/renders/hud-hero.webp";
import hudTetes from "../assets/renders/hud-tetes.webp";
import hudEcran from "../assets/renders/hud-ecran.webp";
import lineHero from "../assets/renders/line-hero.webp";
import lineTetes from "../assets/renders/line-tetes.webp";
import lineEcran from "../assets/renders/line-ecran.webp";
import anchorsJson from "../assets/renders/anchors.json";

/** Renders of the owner's Blender scene (docs/design/ui-v2/sources/render_u1.py): one look per theme, three shots each. */
export type Shot = "hero" | "tetes" | "ecran";
type Look = "studio" | "hud" | "line";
type Pt = [number, number];
interface Anchors { size: Pt; head1_face: Pt; slot2: Pt; slot3: Pt; slot4: Pt; screen: Pt; bed: Pt; [k: string]: unknown }

const URLS: Record<Look, Record<Shot, string>> = {
  studio: { hero: studioHero, tetes: studioTetes, ecran: studioEcran },
  hud: { hero: hudHero, tetes: hudTetes, ecran: hudEcran },
  line: { hero: lineHero, tetes: lineTetes, ecran: lineEcran },
};
const LOOK: Record<ThemeId, Look> = { pupitre: "studio", notice: "line", obsidienne: "studio", visiere: "hud" };
const ANCHORS = anchorsJson as unknown as Record<string, Anchors>;

export type Spot = "head1" | "head2" | "head3" | "head4" | "screen" | "bed";
export interface Render { src: string; width: number; height: number; /** a point of the machine, in % of the image */ at: (p: Spot) => { x: number; y: number } | null }

export function renderFor(theme: ThemeId, shot: Shot): Render {
  const look = LOOK[theme];
  const a = ANCHORS[`${look}-${shot}`]!;
  const [w, h] = a.size;
  const pick = (p: string): Pt | undefined => (p === "head1" ? a.head1_face : p === "screen" ? a.screen : p === "bed" ? a.bed : (a[`slot${p.slice(4)}`] as Pt | undefined));
  return {
    src: URLS[look][shot], width: w, height: h,
    at: (p) => { const q = pick(p); return q ? { x: (q[0] / w) * 100, y: (q[1] / h) * 100 } : null; },
  };
}
