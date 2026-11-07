# 3D model used by the app (landing + Overview)

**Since 2026-11-06 the app uses only the owner's own model, `U1_Jay` (pack `U1_Jay_Pack_Complet/U1_Jay/`).**

**File served:** `frontend/public/models/u1-jay.glb` = `U1_Jay_WEB.glb` (7.1 MB, 271 260 triangles, 48 meshes, PBR materials and textures embedded, no Draco/Meshopt). Units: metres, Y up, façade towards +Z; the scenes scale it by 100 (`MODEL_SCALE` in `frontend/src/viz/u1model.ts`).

**Provenance (owner statement):** the model was made and modified by the owner, with ChatGPT. It is a visual illustration, not official CAD, and must not be used to design replacement parts. **Owner's decision (2026-11-07, closed):** `frontend/public/models/u1-jay.glb` is committed, so every build (Windows exe, Docker image, CI) contains it. The heavy source pack `U1_Jay_Pack_Complet/` and any 3MF files stay local (git-ignored). The model shows the "snapmaker" wordmark on the front.

**Nodes used:** `DOOR` (pivot Y, 0 to -80°), `BED_Z` (lift 0 to +190 mm), `GANTRY_Y`, `TOOLHEAD_X` (±120 mm), `TUBE_SYSTEM`, `PTFE_CHANNEL_1..4`, `REEL_*`, `LCD_Display`, glass meshes. These moves are **illustrative** (sliders in the Overview viewer): not machine coordinates, never telemetry. The static PTFE tubes are hidden when the head leaves its rest position because they do not bend.

**Four numbered markers = the four PTFE paths**, labelled "UNMAPPED": nothing proves they correspond to T1-T4 (H-04). The model has one visible toolhead only. Clicking a part on the landing opens a short note (`head1-4` = paths, `gantry`, `bed`, `screen`, `spools`, `door`, `body`).

**Rendering choices:** the model's own materials are kept (cloned per mesh so hover/highlight never lights neighbours); no colour overrides, no normal re-creasing. Fallback without WebGL: `frontend/src/assets/keyart.png` (still a render of the old model: to replace, BACKLOG #29).

**Code:** `frontend/src/viz/u1model.ts` (URL, scale, part→group mapping), `U1Viewer.tsx` (Overview), `LandingScene.tsx` (scroll-driven landing). Viewer honours `prefers-reduced-motion`, pauses when hidden or off-screen, disposes geometries, materials and textures.
