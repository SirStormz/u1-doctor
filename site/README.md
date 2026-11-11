# U1 Doctor website (GitHub Pages)

Source of https://sirstormz.github.io/u1-doctor/ : Vite, vanilla JS, Three.js and GSAP. The build writes into `../docs/`, which GitHub Pages serves from `main`.

```bash
cd site
npm install
npm run dev      # http://127.0.0.1:5180/u1-doctor/
npm run build    # cleans docs/assets, docs/changelog, docs/aider, then builds into ../docs
```

- **Pages**: `index.html` (home), `changelog/`, `aider/` (help). `docs/sample-report/` and `docs/media/` are not produced by this build and stay untouched. `docs/presentation/` is now a one-line redirect to the home (the old URL keeps working). Do not run `scripts/build_presentation.py` any more: it would overwrite that redirect.
- **Two themes**, A "Visière x Obsidienne" (dark, default) and B "Notice x Pupitre" (light). The button in the nav switches and remembers the choice. Colours, fonts and shapes live in `src/css/theme-a.css` and `theme-b.css`; layout in `base.css`.
- **FR / EN**: pages are written in English; `src/i18n.js` holds the French. English is always the default (like GitHub); the button switches to French and the choice is remembered.
- **3D**: the story section loads `frontend/public/models/u1-jay.glb` (the app's own model) only on desktop, with motion allowed and WebGL available. Otherwise the static renders stay. The model, Three.js and GSAP load lazily, so the first screen is about 25 kB of JS and CSS.
- **Decoder demo**: `src/data/codes.json` is made from `knowledge/u1_codes.json` by `npm run codes` (commit the result when the catalog changes).
- **Images**: `src/img/` holds copies of the app's Blender renders; `npm run renders` refreshes them from `frontend/src/assets/renders/`.
- **Changelog**: edit `src/data/changelog.json` (English and French text per release) when a release ships.
- Fonts come from Fontsource packages and ship with the site: no request to a font host.
