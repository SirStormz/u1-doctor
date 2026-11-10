import fs from "node:fs";
import path from "node:path";
import { THEME_IDS, type ThemeId } from "../src/themes/registry";

/** WCAG 2.x contrast ratios computed straight from tokens.css, for every theme. */
const css = fs.readFileSync(path.resolve(__dirname, "../src/design/tokens.css"), "utf8");

function themeVars(name: ThemeId): Record<string, string> {
  const sel = new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([^}]*)\\}`);
  const body = sel.exec(css)?.[1] ?? "";
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]!] = m[2]!;
  return out;
}
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (h: string) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
const mix = (fg: string, pct: number, bg: string) => "#" + rgb(fg).map((c, i) => Math.round(c * pct + rgb(bg)[i]! * (1 - pct)).toString(16).padStart(2, "0")).join("");

for (const theme of THEME_IDS) {
  const v = themeVars(theme);
  describe(`contrast ${theme}`, () => {
    test("body text on every surface >= 7:1 (AAA) and secondary >= 4.5:1", () => {
      for (const s of ["bg-0", "bg-1", "surface-1", "surface-2", "surface-3"]) {
        expect(ratio(v.ink!, v[s]!), `ink on ${s}`).toBeGreaterThanOrEqual(7);
        expect(ratio(v["ink-2"]!, v[s]!), `ink-2 on ${s}`).toBeGreaterThanOrEqual(4.5);
      }
    });
    test("muted text (ink-3) >= 4.5:1 on surfaces it is used on", () => {
      for (const s of ["bg-1", "surface-1", "surface-2"]) expect(ratio(v["ink-3"]!, v[s]!), `ink-3 on ${s}`).toBeGreaterThanOrEqual(4.5);
    });
    test("accent text and on-accent button text", () => {
      expect(ratio(v.accent!, v["surface-1"]!)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(v["accent-ink"]!, v.accent!)).toBeGreaterThanOrEqual(4.5);
    });
    test("status tones as text on their own tinted chip background >= 4.5:1", () => {
      for (const tone of ["ok", "warn", "danger", "demo", "replay", "accent"]) {
        const bg = mix(v[tone]!, 0.13, v["surface-1"]!);
        expect(ratio(v[tone]!, bg), `${tone} chip`).toBeGreaterThanOrEqual(4.5);
      }
    });
    test("control borders (--control-line) >= 3:1 on every surface (WCAG 1.4.11)", () => {
      for (const s of ["surface-1", "surface-2", "surface-3"]) expect(ratio(v["control-line"]!, v[s]!), `control-line on ${s}`).toBeGreaterThanOrEqual(3);
    });
  });
}

test("reduced motion is honoured in CSS and animations only touch transform/opacity", () => {
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  const keyframes = [...css.matchAll(/^@keyframes [a-z-]+ \{(.*)\}\s*$/gm)].map((m) => m[1]!).join("\n");
  const props = new Set([...keyframes.matchAll(/([a-z-]+):/g)].map((m) => m[1]));
  expect(props.size).toBeGreaterThan(0);
  for (const p of props) expect(["opacity", "transform"]).toContain(p);
});
