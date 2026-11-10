/**
 * Scène 3D partagée des quatre thèmes UI V2 : la U1 du propriétaire (u1-jay.glb), rendue selon le thème.
 *
 *   const stage = await mount(canvas, { theme: "obsidienne", model: "/models/u1-jay.glb", view: "hero" });
 *   stage.focus("head3"); stage.setSplit(0.5); stage.onFrame((p) => { ... p("head3") -> {x, y} ... });
 *   stage.dispose();
 *
 * La caméra « hero » reprend exactement la caméra orthographique du rendu U1_Jay_Apercu.png (Blender), donc le
 * rendu Blender du thème sert d'affiche (poster) au pixel près pendant le chargement et sans WebGL.
 * Les mouvements sont illustratifs : aucune donnée d'imprimante ne pilote la géométrie.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// --- repères de la machine, en mètres, repère glTF (Y en haut, façade vers +Z) ---
// blocs des têtes garées, mesurés sur la géométrie (îlots de FRAME__Graphite_Polymer, voir render_u1.py)
const HEADS = {
  2: [[-0.06, 0.3355, -0.2179], [-0.005, 0.463, -0.1779]],
  3: [[0.005, 0.3355, -0.2179], [0.06, 0.463, -0.1779]],
  4: [[0.07, 0.3355, -0.2179], [0.125, 0.463, -0.1779]],
};
const mid = (b) => b[0].map((v, i) => (v + b[1][i]) / 2);
export const ANCHORS = {
  head1: [0.0025, 0.4025, 0.016], // tête montée sur le chariot (face blanche)
  head2: mid(HEADS[2]),
  head3: mid(HEADS[3]),
  head4: mid(HEADS[4]),
  gear3: [0.0325, 0.462, -0.198], // entrée du filament au sommet de la tête 3
  head3top: [0.0325, 0.452, -0.184], // haut de la face avant de la tête 3 : reste visible quand on tourne (le centre passe derrière la tête montée)
  screen: [0.11, 0.398, 0.246],
  wordmark: [-0.12, 0.392, 0.246],
  bed: [-0.02, 0.118, 0.12], // avant du plateau, derrière la porte
  nozzle: [0.0025, 0.326, -0.04],
  door: [0, 0.19, 0.25],
};

// --- vues : mêmes caméras que render_u1.py (position = cible + direction * distance, échelle ortho) ---
const n3 = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const HERO_POS = new THREE.Vector3(1.04, 0.95, 1.55);
const HERO_DIR = n3(-0.530, -0.306, -0.791);
export const VIEWS = {
  hero: { target: HERO_POS.clone().addScaledVector(HERO_DIR, 1.86), dir: HERO_DIR.clone().negate(), scale: 1.12 },
  tetes: { target: new THREE.Vector3(0.03, 0.418, -0.125), dir: n3(0.22, 0.42, 0.88), scale: 0.27 },
  ecran: { target: new THREE.Vector3(0.0, 0.395, 0.246), dir: n3(0.18, 0.2, 0.95), scale: 0.42 },
  head3: { target: new THREE.Vector3(...ANCHORS.head3), dir: n3(0.42, 0.5, 0.76), scale: 0.2 },
  gear3: { target: new THREE.Vector3(0.0325, 0.44, -0.19), dir: n3(0.3, 0.78, 0.55), scale: 0.13 },
  screen: { target: new THREE.Vector3(0.09, 0.398, 0.246), dir: n3(0.22, 0.12, 0.97), scale: 0.2 },
  overview: null, // = hero
};
VIEWS.overview = VIEWS.hero;

const AMBER = new THREE.Color("#FFB547");
const GOLD = new THREE.Color("#FFD99A");

// palette « notice » : matière du pack -> aplat (identique au rendu au trait Blender)
const NOTICE = {
  Ceramic_White_Powdercoat: "#FFFFFF", Graphite_Polymer: "#4A4F57", Smoked_Glass: "#5A6068", Anodized_Aluminium: "#D9DCE0",
  Brushed_Stainless: "#CFD3D8", Rubber: "#3A3D42", Harness_Black_Rubber: "#3A3D42", PTFE_Black_Clips: "#3A3D42",
  PTFE_Natural_Translucent: "#F2F0EC", PTFE_Fitting_Nickel: "#C9CCD1", Reel_Kraft: "#E2D2B8", Filament_Orange: "#F2A65A",
  Filament_Green: "#9CC98A", Filament_Purple: "#C49AE0", Filament_Red: "#F07C7C", Nozzle_Brass: "#D8B26A",
  Timing_Belt: "#3A3D42", Textured_PEI: "#6B6F75", Chamber_LED: "#FFFFFF",
};

const THEMES = {
  obsidienne: { tone: THREE.AgXToneMapping, exposure: 1.18, env: 1.05, lights: [["#FFFFFF", 2.8, [0.8, 1.6, 1.2]], ["#DCE6FF", 0.9, [-1.0, 0.8, 0.6]], ["#FFFFFF", 2.0, [0.6, 1.25, -0.85]]], shadow: 0.55, hi: "glow" },
  pupitre: { tone: THREE.AgXToneMapping, exposure: 1.15, env: 1.0, lights: [["#FFF4E6", 2.7, [0.8, 1.6, 1.2]], ["#FFE9D2", 0.7, [-1.0, 0.8, 0.6]], ["#FFFFFF", 1.6, [0.6, 1.25, -0.85]]], shadow: 0.6, hi: "glow" },
  visiere: { tone: THREE.AgXToneMapping, exposure: 0.95, env: 0.35, lights: [["#FFDBA8", 2.6, [0.8, 1.6, 1.2]], ["#FFCC99", 0.35, [-1.0, 0.8, 0.6]], ["#FF3B2F", 1.3, [0.6, 1.25, -0.85]]], shadow: 0.7, hi: "holo" },
  notice: { tone: THREE.NoToneMapping, exposure: 1.0, env: 0, lights: [], shadow: 0, hi: "flat" },
};

let gltfCache = new Map();
function loadModel(url) {
  if (!gltfCache.has(url)) gltfCache.set(url, new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url));
  return gltfCache.get(url);
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** injecte une zone de mise en valeur (boîte de la tête 3) dans une matière, sans toucher la géométrie */
function addHighlight(mat, U, mode) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = "varying vec3 vWp;\n" + sh.vertexShader.replace("#include <worldpos_vertex>",
      "#include <worldpos_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    const head = "varying vec3 vWp; uniform vec3 uBMin; uniform vec3 uBMax; uniform float uHi; uniform float uTime; uniform vec3 uHiCol;\n" +
      "float inBox(){ vec3 a = step(uBMin - 0.0015, vWp) * step(vWp, uBMax + 0.0015); return a.x * a.y * a.z; }\n";
    const glow = mode === "flat"
      ? "gl_FragColor.rgb = mix(gl_FragColor.rgb, uHiCol, inBox() * uHi);"
      : "float k = inBox() * uHi * (0.68 + 0.14 * sin(uTime * 2.4));\n gl_FragColor.rgb = mix(gl_FragColor.rgb, uHiCol, k);";
    sh.fragmentShader = head + sh.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>\n" + glow);
  };
  mat.customProgramCacheKey = () => "hi-" + mode;
}

/** matière hologramme : contour de Fresnel or + lignes de balayage, bande de révélation verticale */
function holoMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, clipping: true,
    vertexShader: `#include <common>
      #include <clipping_planes_pars_vertex>
      varying vec3 vN; varying vec3 vV; varying vec3 vWp;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWp = wp.xyz; vec4 mvPosition = viewMatrix * wp;
        vN = normalize(normalMatrix * normal); vV = normalize(-mvPosition.xyz);
        #include <clipping_planes_vertex>
        gl_Position = projectionMatrix * mvPosition; }`,
    fragmentShader: `#include <common>
      #include <clipping_planes_pars_fragment>
      uniform vec3 uGold; uniform float uScan; uniform float uBand; uniform float uBase; uniform float uTime; uniform vec2 uRes;
      varying vec3 vN; varying vec3 vV; varying vec3 vWp;
      void main(){
        #include <clipping_planes_fragment>
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float lines = 0.75 + 0.25 * step(0.5, fract(gl_FragCoord.y / 3.0));
        float d = (vWp.y - uScan) / max(uBand, 1e-4);
        float band = exp(-d * d * 4.0);
        float a = (f * 0.5 + 0.035) * lines * (uBase * 0.8 + band);
        gl_FragColor = vec4(uGold * a, 1.0);
      }`,
  });
}

/** traits de l'hologramme : même bande de révélation que les surfaces */
function holoLineMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, clipping: true,
    vertexShader: `#include <common>
      #include <clipping_planes_pars_vertex>
      varying vec3 vWp;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWp = wp.xyz; vec4 mvPosition = viewMatrix * wp;
        #include <clipping_planes_vertex>
        gl_Position = projectionMatrix * mvPosition; }`,
    fragmentShader: `#include <common>
      #include <clipping_planes_pars_fragment>
      uniform vec3 uGold; uniform float uScan; uniform float uBand; uniform float uBase; varying vec3 vWp;
      void main(){
        #include <clipping_planes_fragment>
        float d = (vWp.y - uScan) / max(uBand, 1e-4);
        float a = 0.85 * (uBase * 0.75 + exp(-d * d * 2.5));
        gl_FragColor = vec4(uGold * a, 1.0);
      }`,
  });
}

/** contour de silhouette : faces arrière poussées le long de la normale, largeur fixe en pixels */
function hullMaterial(px) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uPx: { value: px }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: `uniform float uPx; uniform vec2 uRes;
      void main(){ vec4 c = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        vec3 n = normalize(mat3(projectionMatrix) * normalMatrix * normal);
        c.xy += normalize(n.xy + 1e-5) * uPx * 2.0 / uRes * c.w;
        gl_Position = c; }`,
    fragmentShader: `void main(){ gl_FragColor = vec4(0.078, 0.078, 0.078, 1.0); }`,
  });
}

export async function mount(canvas, opts = {}) {
  const theme = THEMES[opts.theme] ? opts.theme : "obsidienne";
  const T = THEMES[theme];
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false; // devient vrai dans dispose()
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    opts.onError?.(e);
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = T.tone;
  renderer.toneMappingExposure = T.exposure;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x000000, 0);
  const maxDpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr ?? 1.75);
  let dpr = maxDpr;

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.01, 10);
  let pmrem;
  if (T.env > 0) {
    pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = T.env;
  }
  for (const [c, k, p] of T.lights) {
    const L = new THREE.DirectionalLight(c, k);
    L.position.set(...p);
    scene.add(L);
  }

  // ombre de contact douce (texture radiale), pas d'ombre portée calculée
  let shadow;
  if (T.shadow > 0) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const g = cv.getContext("2d");
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,1)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: T.shadow, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.001;
    scene.add(shadow);
  }

  const U = {
    uBMin: { value: new THREE.Vector3(...HEADS[3][0]) }, uBMax: { value: new THREE.Vector3(...HEADS[3][1]) },
    uHi: { value: opts.highlight ?? 1 }, uTime: { value: 0 },
    // mélangée après la conversion sRGB du rendu : couleur donnée en composantes sRGB
    uHiCol: { value: (theme === "visiere" ? GOLD : AMBER).clone().convertLinearToSRGB() },
  };
  const HU = {
    uGold: { value: GOLD.clone() }, uScan: { value: -1 }, uBand: { value: 0.07 }, uBase: { value: 0 }, uTime: U.uTime,
    uRes: { value: new THREE.Vector2(1, 1) },
  };
  const splitSolid = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  const splitHolo = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  let split = null; // null = pas de partage hologramme / photo

  let gltf;
  try {
    gltf = await loadModel(opts.model || "/models/u1-jay.glb");
  } catch (e) {
    // modèle introuvable : on libère le contexte WebGL déjà créé, l'affiche reste en place
    pmrem?.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    gltfCache.delete(opts.model || "/models/u1-jay.glb");
    opts.onError?.(e);
    return null;
  }
  const root = gltf.scene.clone(true);
  scene.add(root);
  const holoGroup = new THREE.Group();
  const lineMat = theme === "notice"
    ? new THREE.LineBasicMaterial({ color: 0x141414 })
    : holoLineMaterial(HU);
  // contour de silhouette (Notice) : coque inversée extrudée d'une largeur constante en pixels
  const hullMat = theme === "notice" ? hullMaterial(1.15) : null;
  const owned = [];
  const matCache = new Map();
  const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false, clippingPlanes: [splitHolo] });
  owned.push(depthMat);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const m0 = o.material;
    const name = m0.name;
    let m;
    if (theme === "notice") {
      if (name === "Touchscreen") m = m0.clone();
      else m = matCache.get(name) || new THREE.MeshBasicMaterial({ color: NOTICE[name] || "#FFFFFF" });
      matCache.set(name, m);
      if (/glass/i.test(o.name)) o.visible = /Front_Glass/i.test(o.name);
      if (/Chamber_Light/.test(o.name)) o.visible = false;
    } else {
      m = m0.clone();
      // porte en verre fumé sombre, comme le rendu de référence (U1_Jay_Apercu.png), plutôt que transparente
      if (/Front_Glass/i.test(o.name)) {
        m = new THREE.MeshPhysicalMaterial({ color: "#14171B", roughness: 0.08, metalness: 0, transparent: true, opacity: 0.9, clearcoat: 1, clearcoatRoughness: 0.06 });
      }
    }
    if (o.name === "FRAME__Graphite_Polymer") {
      m = m.clone();
      addHighlight(m, U, T.hi === "flat" ? "flat" : "glow");
    }
    m.clippingPlanes = theme === "visiere" ? [splitSolid] : [];
    o.material = m;
    owned.push(m);
    if (theme === "visiere" || theme === "notice") {
      o.updateWorldMatrix(true, false);
      // l'enroulement des bobines donnerait des centaines de traits : seulement la silhouette pour elles
      if (!/^Filament_/.test(name)) {
        const eg = new THREE.EdgesGeometry(o.geometry, theme === "notice" ? 32 : 28);
        const ls = new THREE.LineSegments(eg, lineMat);
        ls.renderOrder = 3;
        ls.matrixAutoUpdate = false;
        ls.matrix.copy(o.matrixWorld);
        holoGroup.add(ls);
        owned.push(eg);
      }
      if (hullMat && o.visible && !/glass/i.test(o.name) && !/^Filament_/.test(name)) {
        const hs = new THREE.Mesh(o.geometry, hullMat);
        hs.matrixAutoUpdate = false;
        hs.matrix.copy(o.matrixWorld);
        holoGroup.add(hs);
      }
      if (theme === "visiere" && !/^Filament_/.test(name)) {
        // passe de profondeur d'abord : seules les surfaces visibles s'allument (pas d'effet rayon X qui s'additionne)
        const dp = new THREE.Mesh(o.geometry, depthMat);
        dp.matrixAutoUpdate = false;
        dp.matrix.copy(o.matrixWorld);
        dp.renderOrder = 1;
        holoGroup.add(dp);
        const hm = holoMaterial(HU);
        hm.clippingPlanes = [splitHolo];
        const hs = new THREE.Mesh(o.geometry, hm);
        hs.matrixAutoUpdate = false;
        hs.matrix.copy(o.matrixWorld);
        hs.renderOrder = 2;
        holoGroup.add(hs);
        owned.push(hm);
      }
    }
  });
  lineMat.clippingPlanes = theme === "visiere" ? [splitHolo] : [];
  owned.push(lineMat);
  if (hullMat) owned.push(hullMat);
  scene.add(holoGroup);
  if (theme === "visiere") holoGroup.visible = false;

  // --- caméra : vue courante + orbite utilisateur + dérive calme ---
  const cur = { target: new THREE.Vector3(), dir: new THREE.Vector3(), scale: 1, shift: 0 };
  const from = { target: new THREE.Vector3(), dir: new THREE.Vector3(), scale: 1, shift: 0 };
  const viewOf = (v) => (typeof v === "string" ? VIEWS[v] : v && v.base ? { ...VIEWS[v.base], scale: v.scale ?? VIEWS[v.base].scale, shift: v.shift ?? 0 } : v && v.target ? { target: new THREE.Vector3(...[].concat(v.target.toArray ? v.target.toArray() : v.target)), dir: (v.dir.isVector3 ? v.dir.clone() : n3(...v.dir)), scale: v.scale, shift: v.shift || 0 } : null);
  let to = viewOf(opts.view) || VIEWS.hero;
  Object.assign(cur, { target: to.target.clone(), dir: to.dir.clone(), scale: to.scale, shift: to.shift || 0 });
  let tween = null, back = null;
  const orbit = { az: 0, el: 0, zoom: 1, vaz: 0, vel: 0 };
  let drift = !calm.matches && opts.drift !== false;
  const t0 = performance.now();

  function applyCamera(now) {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, a = w / h;
    const d = cur.dir.clone();
    const az = orbit.az + (drift ? Math.sin((now - t0) / 2200) * 0.026 : 0);
    d.applyAxisAngle(new THREE.Vector3(0, 1, 0), az);
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d).normalize();
    d.applyAxisAngle(right, -orbit.el).normalize();
    cam.position.copy(cur.target).addScaledVector(d, 2.2);
    cam.up.set(0, 1, 0);
    cam.lookAt(cur.target);
    const s = cur.scale * orbit.zoom;
    const hh = a < 1 ? s / 2 : s / 2 / a, hw = hh * a, sx = cur.shift * 2 * hw;
    cam.left = -hw - sx; cam.right = hw - sx; cam.top = hh; cam.bottom = -hh;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    if (split !== null) {
      // plan vertical aligné sur l'axe droit de la caméra, à la position écran « split » (0 = gauche, 1 = droite)
      const r = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).normalize();
      const p = cur.target.clone().addScaledVector(r, (split - 0.5) * 2 * hw);
      splitSolid.setFromNormalAndCoplanarPoint(r, p);
      splitHolo.setFromNormalAndCoplanarPoint(r.clone().negate(), p);
    }
  }

  function focus(name, ms = 1100) {
    const v = viewOf(name);
    if (!v) return;
    to = v;
    if (calm.matches || ms <= 0) {
      Object.assign(cur, { target: v.target.clone(), dir: v.dir.clone(), scale: v.scale, shift: v.shift || 0 });
      tween = null;
    } else {
      from.target.copy(cur.target); from.dir.copy(cur.dir); from.scale = cur.scale; from.shift = cur.shift;
      tween = { s: performance.now(), ms };
    }
    orbit.az = orbit.el = 0; orbit.zoom = 1;
    wake();
  }

  // --- interaction : glisser = tourner (borné), molette = zoom (option) ---
  let drag = null, lastInput = 0;
  const onDown = (e) => {
    if (!opts.interactive) return;
    drag = { x: e.clientX, y: e.clientY, az: orbit.az, el: orbit.el };
    canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = "grabbing";
    wake();
  };
  const onMove = (e) => {
    if (opts.parallax && !drag && !calm.matches) {
      const r = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      wake();
    }
    if (!drag) return;
    orbit.az = THREE.MathUtils.clamp(drag.az - (e.clientX - drag.x) * 0.006, -0.42, 0.42);
    orbit.el = THREE.MathUtils.clamp(drag.el + (e.clientY - drag.y) * 0.004, -0.12, 0.3);
    lastInput = performance.now();
    wake();
  };
  const onUp = () => { drag = null; canvas.style.cursor = opts.interactive ? "grab" : ""; lastInput = performance.now(); };
  const onWheel = (e) => {
    if (!opts.zoom) return;
    e.preventDefault();
    orbit.zoom = THREE.MathUtils.clamp(orbit.zoom * Math.exp(e.deltaY * 0.0012), 0.45, 1.25);
    lastInput = performance.now();
    wake();
  };
  const onDbl = () => { if (opts.interactive) { orbit.az = orbit.el = 0; orbit.zoom = 1; wake(); } };
  const onKey = (e) => {
    if (!opts.interactive) return;
    const k = { ArrowLeft: [-0.08, 0], ArrowRight: [0.08, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[e.key];
    if (k) { e.preventDefault(); orbit.az = THREE.MathUtils.clamp(orbit.az + k[0], -0.42, 0.42); orbit.el = THREE.MathUtils.clamp(orbit.el + k[1], -0.12, 0.3); wake(); }
    if (e.key === "+" || e.key === "-") { orbit.zoom = THREE.MathUtils.clamp(orbit.zoom * (e.key === "+" ? 0.9 : 1.1), 0.45, 1.25); wake(); }
    if (e.key === "0") onDbl();
  };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("dblclick", onDbl);
  canvas.addEventListener("keydown", onKey);
  if (opts.interactive) { canvas.style.cursor = "grab"; canvas.style.touchAction = "none"; if (!canvas.hasAttribute("tabindex")) canvas.tabIndex = 0; }

  // --- boucle : seulement quand quelque chose bouge, en pause hors écran ---
  let raf = 0, visible = true, frames = 0, acc = 0, lastT = 0, fps = 0, lastDraw = 0;
  // active = la 3D est réellement montrée ; inactive, plus aucune boucle continue (seulement des rendus à la demande)
  let active = opts.active !== false;
  const minDt = 1000 / (opts.maxFps || 60) - 1;
  const listeners = [];
  const io = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) wake(); });
  io.observe(canvas);
  const onVis = () => { if (!document.hidden) wake(); };
  document.addEventListener("visibilitychange", onVis);
  let scan = opts.scan ? { s: performance.now() + (opts.scanDelay ?? 900), period: opts.scanPeriod ?? 7000 } : null;

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
    if (hullMat) hullMat.uniforms.uRes.value.set(w, h);
  }
  const ro = new ResizeObserver(() => wake());
  ro.observe(canvas);

  function animating(now) {
    if (!active) return !!tween || !!back;
    return !!tween || !!back || drift || !!drag || (scan && !calm.matches) || (U.uHi.value > 0 && T.hi !== "flat" && !calm.matches)
      || Math.abs(pointer.x - pointer.sx) + Math.abs(pointer.y - pointer.sy) > 0.002;
  }

  function project(name) {
    const p = Array.isArray(name) ? name : ANCHORS[name];
    if (!p) return null;
    const v = new THREE.Vector3(...p).project(cam);
    return { x: (v.x + 1) / 2 * canvas.clientWidth, y: (1 - v.y) / 2 * canvas.clientHeight };
  }

  function frame(now) {
    raf = 0;
    if (disposed) return;
    // plafond d'images/s : un écran 144/240 Hz ne doit pas multiplier le travail du GPU
    if (lastDraw && now - lastDraw < minDt && animating(now)) { raf = requestAnimationFrame(frame); return; }
    lastDraw = now;
    const dt = lastT ? now - lastT : 16;
    lastT = now;
    if (tween) {
      const k = Math.min(1, (now - tween.s) / tween.ms), e = ease(k);
      cur.target.lerpVectors(from.target, to.target, e);
      cur.dir.copy(from.dir).lerp(to.dir, e).normalize();
      cur.scale = Math.exp(THREE.MathUtils.lerp(Math.log(from.scale), Math.log(to.scale), e));
      cur.shift = THREE.MathUtils.lerp(from.shift, to.shift || 0, e);
      if (k >= 1) tween = null;
    }
    if (back) {
      const k = Math.min(1, (now - back.s) / back.ms), e = ease(k);
      orbit.az = back.az * (1 - e); orbit.el = back.el * (1 - e); orbit.zoom = back.zoom + (1 - back.zoom) * e;
      if (k >= 1) back = null;
    }
    pointer.sx += (pointer.x - pointer.sx) * 0.08;
    pointer.sy += (pointer.y - pointer.sy) * 0.08;
    if (opts.parallax && !drag && !back) { orbit.az = pointer.sx * 0.05; orbit.el = pointer.sy * 0.025; }
    U.uTime.value = (now - t0) / 1000;
    if (scan) {
      const ph = Math.max(0, now - scan.s) / scan.period;
      const k = ph % 2 < 1 ? ph % 1 : 1 - (ph % 1); // aller-retour, comme la maquette 2D
      HU.uScan.value = calm.matches ? -1 : THREE.MathUtils.lerp(0.82, -0.05, ease(k));
      holoGroup.visible = !calm.matches || split !== null;
    }
    resize();
    applyCamera(now);
    renderer.render(scene, cam);
    for (const fn of listeners) fn(project);
    // qualité adaptative : on baisse la définition si une image dépasse ~22 ms en moyenne
    frames++; acc += dt;
    if (acc > 1000) {
      fps = (frames * 1000) / acc;
      const avg = acc / frames;
      if (avg > 22 && dpr > 1) dpr = Math.max(1, dpr - 0.25);
      else if (avg < 12 && dpr < maxDpr) dpr = Math.min(maxDpr, dpr + 0.25);
      frames = 0; acc = 0;
    }
    if (visible && !document.hidden && animating(now)) raf = requestAnimationFrame(frame);
  }
  function wake() { if (!raf && !disposed) raf = requestAnimationFrame(frame); }

  const api = {
    focus,
    setHighlight(v) { U.uHi.value = v; wake(); },
    setSplit(v) {
      split = v === null ? null : THREE.MathUtils.clamp(v, 0, 1);
      if (theme === "visiere") {
        holoGroup.visible = split !== null || !!scan;
        HU.uBase.value = split !== null ? 1 : 0;
        HU.uScan.value = split !== null ? -1 : HU.uScan.value;
        if (split === null) { splitSolid.set(new THREE.Vector3(1, 0, 0), 10); splitHolo.set(new THREE.Vector3(-1, 0, 0), 10); }
      }
      wake();
    },
    setDrift(on) { drift = on && !calm.matches; wake(); },
    setActive(on) { active = !!on; wake(); },
    /** coût mesuré d'une image (ms), rendu synchrone attendu jusqu'au bout du GPU : indépendant du bridage de requestAnimationFrame */
    bench(n = 60, ratio) {
      const keep = dpr;
      if (ratio) { dpr = ratio; renderer.setPixelRatio(ratio); renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); }
      const gl = renderer.getContext(), px = new Uint8Array(4);
      const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      applyCamera(performance.now()); renderer.render(scene, cam); sync();
      const t = performance.now(), az = orbit.az;
      for (let i = 0; i < n; i++) { orbit.az = az + Math.sin(i / 9) * 0.05; U.uTime.value += 0.016; applyCamera(t); renderer.render(scene, cam); }
      sync();
      const ms = (performance.now() - t) / n;
      orbit.az = az;
      if (ratio) { dpr = keep; renderer.setPixelRatio(keep); renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); }
      wake();
      return { msParImage: Math.round(ms * 100) / 100, imagesParSeconde: Math.round(1000 / ms), largeur: canvas.width, hauteur: canvas.height };
    },
    /** ramène doucement l'orbite et la parallaxe au repos (la vue reste celle choisie) */
    reset(ms = 700) {
      pointer.x = pointer.y = pointer.sx = pointer.sy = 0;
      if (calm.matches || ms <= 0) { orbit.az = orbit.el = 0; orbit.zoom = 1; back = null; }
      else back = { s: performance.now(), ms, az: orbit.az, el: orbit.el, zoom: orbit.zoom };
      wake();
    },
    setParallax(on) { opts.parallax = !!on; if (!on) { pointer.x = pointer.y = 0; } wake(); },
    project,
    onFrame(fn) { listeners.push(fn); wake(); return () => listeners.splice(listeners.indexOf(fn), 1); },
    stats() {
      const i = renderer.info;
      return { fps: Math.round(fps), dpr, calls: i.render.calls, triangles: i.render.triangles, lines: i.render.lines, geometries: i.memory.geometries, textures: i.memory.textures };
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("dblclick", onDbl);
      canvas.removeEventListener("keydown", onKey);
      for (const o of owned) o.dispose?.();
      if (shadow) { shadow.geometry.dispose(); shadow.material.map.dispose(); shadow.material.dispose(); }
      scene.environment?.dispose?.();
      pmrem?.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      delete canvas.__u1stage;
    },
  };
  // partage par défaut : aucun (plans repoussés hors champ)
  api.setSplit(opts.split ?? null);
  canvas.__u1stage = api;
  wake();
  opts.onReady?.(api);
  return api;
}
