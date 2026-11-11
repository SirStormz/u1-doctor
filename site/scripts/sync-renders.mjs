// The site's U1 images are the app's own Blender renders (frontend/src/assets/renders, made by docs/design/ui-v2/sources/render_u1.py).
// They are shown at most ~560 CSS px wide, so they are re-encoded at 1000 px (about 1.8x) instead of the 1452 px originals.
// Run from site/ after the renders change: node scripts/sync-renders.mjs
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const path = (rel) => fileURLToPath(new URL(rel, import.meta.url));
for (const n of ["hud-hero", "hud-tetes", "hud-ecran", "line-hero", "line-tetes", "line-ecran", "holo-hero"]) {
  await sharp(path(`../../frontend/src/assets/renders/${n}.webp`))
    .resize({ width: 1000, withoutEnlargement: true })
    .webp({ quality: 80, effort: 6 })
    .toFile(path(`../src/img/${n}.webp`));
}
console.log("renders synced");
