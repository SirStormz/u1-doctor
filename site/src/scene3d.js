// The owner's own U1 model (u1-jay.glb, the same file the app uses). Loaded only when the story section is near view.
// Looks per theme come from the app (frontend/src/viz/looks.ts): shaded and warm for A, flat fills with black edges for B.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Box3, Vector3, MathUtils, PMREMGenerator, MeshBasicMaterial,
  EdgesGeometry, LineSegments, LineBasicMaterial, DirectionalLight, ACESFilmicToneMapping, SRGBColorSpace,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import glbUrl from "../../frontend/public/models/u1-jay.glb?url";

const MODEL_SCALE = 100; // the model is in metres, the scenes were laid out in millimetres
const LOOK_A = { exposure: 0.95, env: 0.35, lights: [["#ffdba8", 2.4], ["#ff3b2f", 1.6], ["#ffcc99", 0.4]] };
const NOTICE_FILL = {
  Ceramic_White_Powdercoat: "#ffffff", Graphite_Polymer: "#4a4f57", Smoked_Glass: "#5a6068", Anodized_Aluminium: "#d9dce0",
  Brushed_Stainless: "#cfd3d8", Rubber: "#3a3d42", Harness_Black_Rubber: "#3a3d42", PTFE_Black_Clips: "#3a3d42",
  PTFE_Natural_Translucent: "#f2f0ec", PTFE_Fitting_Nickel: "#c9ccd1", Reel_Kraft: "#e2d2b8", Filament_Orange: "#f2a65a",
  Filament_Green: "#9cc98a", Filament_Purple: "#c49ae0", Filament_Red: "#f07c7c", Nozzle_Brass: "#d8b26a",
  Timing_Belt: "#3a3d42", Textured_PEI: "#6b6f75", Chamber_LED: "#ffffff",
};

const chain = (o) => { const out = []; for (let p = o; p; p = p.parent) if (p.name) out.push(p.name); return out; };

export async function createScene(canvas, { theme, onReady }) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.5, 4000);
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new DirectionalLight(), rim = new DirectionalLight(), back = new DirectionalLight();
  key.position.set(260, 380, 520); rim.position.set(-420, 120, -200); back.position.set(0, -200, -500);
  scene.add(key, rim, back);

  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(glbUrl);
  const model = gltf.scene;
  model.scale.setScalar(MODEL_SCALE);
  scene.add(model);
  model.updateMatrixWorld(true);

  /* regions the story flies to */
  const boxes = { all: new Box3().setFromObject(model), heads: new Box3(), screen: new Box3() };
  const meshes = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    o.userData.orig = o.material;
    const names = chain(o);
    if (names.some((n) => /^PTFE_CHANNEL_\d$/.test(n))) boxes.heads.expandByObject(o);
    if (/^LCD_Display/i.test(o.name)) boxes.screen.expandByObject(o);
  });
  if (boxes.heads.isEmpty()) boxes.heads.copy(boxes.all);
  if (boxes.screen.isEmpty()) boxes.screen.copy(boxes.all);

  const flatMats = new Map();
  const flat = (m) => {
    const name = Array.isArray(m) ? m[0].name : m.name;
    if (!flatMats.has(name)) flatMats.set(name, new MeshBasicMaterial({ color: NOTICE_FILL[name] ?? "#e9e9e9" }));
    return flatMats.get(name);
  };
  const edgeMat = new LineBasicMaterial({ color: "#141414" });
  let edgesBuilt = false;
  const buildEdges = () => {
    if (edgesBuilt) return; edgesBuilt = true;
    for (const m of meshes) { const e = new LineSegments(new EdgesGeometry(m.geometry, 32), edgeMat); e.name = "__edge"; m.add(e); }
  };

  const setTheme = (next) => {
    const isB = next === "b";
    if (isB) buildEdges();
    for (const m of meshes) {
      m.material = isB ? flat(m.userData.orig) : m.userData.orig;
      for (const c of m.children) if (c.name === "__edge") c.visible = isB;
    }
    renderer.toneMapping = isB ? 0 : ACESFilmicToneMapping; // NoToneMapping keeps the flat fills true to the drawing
    renderer.toneMappingExposure = isB ? 1 : LOOK_A.exposure;
    scene.environmentIntensity = isB ? 0 : LOOK_A.env;
    [key, rim, back].forEach((l, i) => { l.color = new Color(LOOK_A.lights[i][0]); l.intensity = isB ? 0 : LOOK_A.lights[i][1]; });
  };
  setTheme(theme);

  /* three framings, front view (the façade faces +Z): overview, the four toolheads, the screen */
  const frame = (box, dist, h = 0.18) => {
    const c = box.getCenter(new Vector3()), s = box.getSize(new Vector3());
    const d = Math.max(s.x, s.y, 60) * dist;
    return { target: c, pos: new Vector3(c.x + d * 0.42, c.y + d * h, c.z + d) };
  };
  const keys = [frame(boxes.all, 2.35, 0.22), frame(boxes.heads, 3.0, 0.14), frame(boxes.screen, 3.8, 0.1)];

  let progress = 0, px = 0, py = 0, running = false, raf = 0;
  const tmp = new Vector3(), look = new Vector3();
  const place = (t) => {
    const f = MathUtils.clamp(t, 0, 1) * (keys.length - 1), i = Math.min(Math.floor(f), keys.length - 2), k = MathUtils.smootherstep(f - i, 0, 1);
    tmp.lerpVectors(keys[i].pos, keys[i + 1].pos, k); look.lerpVectors(keys[i].target, keys[i + 1].target, k);
    const sway = performance.now() / 5200;
    camera.position.set(tmp.x + Math.sin(sway) * 14 + px * 22, tmp.y + py * 12, tmp.z);
    camera.lookAt(look);
  };
  const draw = () => { place(progress); renderer.render(scene, camera); };
  const loop = () => { if (!running) return; draw(); raf = requestAnimationFrame(loop); };

  const resize = () => {
    const r = canvas.parentElement.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
    if (!running) draw();
  };
  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();

  canvas.parentElement.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width - 0.5) * 2; py = -((e.clientY - r.top) / r.height - 0.5) * 2;
  }, { passive: true });

  draw();
  onReady?.();
  return {
    setProgress: (p) => { progress = p; },
    setTheme,
    start: () => { if (!running) { running = true; loop(); } },
    stop: () => { running = false; cancelAnimationFrame(raf); },
  };
}
