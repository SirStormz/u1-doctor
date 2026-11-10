import { useEffect, useRef } from "react";
import type { Color, Material, Mesh, Vector3 } from "three";
import { MODEL_SCALE, partInfo } from "./u1model";
import { LOOKS, NOTICE_FILL } from "./looks";
import type { ThemeId } from "../themes/registry";

/**
 * Cinematic landing scene (three.js). One fixed canvas, driven by the scroll position through
 * "chapters" (elements with data-chapter inside `rootRef`). Everything shown is the owner's own 3D model
 * of the U1 (see docs/design/3D_MODEL.md) — an illustration, never telemetry.
 *
 * Chapter coordinate t: 0 hero · 1 scan · 2 dissect · 3 prove · 4 replay · 5 closing.
 * Golden ratio is used for: the off-centre framing (1/phi^2 / 2 of the width), the explosion spacing and the camera path.
 */
const PHI = 1.618034;
const SHIFT = 0.235; // (1/phi^2)/2 : puts the machine at the centre of the 61.8% column

export interface SceneCtl { head: number; incident: "printing" | "paused" | "gap" | "code" | null; explode: number }
interface Props {
  ctl: React.MutableRefObject<SceneCtl>;
  onPick: (group: string | null) => void;
  src: string;
  rootRef: React.RefObject<HTMLElement | null>;
  onReady: () => void;
  onFail: () => void;
  /** UI V2 theme: light and drawing style of the machine (see looks.ts) */
  look?: ThemeId;
}

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => { const c = clamp(x); return c * c * (3 - 2 * c); };
/** piecewise curve through [t, value] keys with smoothstep easing between keys */
function curve(t: number, keys: [number, number][]): number {
  if (t <= keys[0]![0]) return keys[0]![1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i]!;
    const [t0, v0] = keys[i - 1]!;
    if (t <= t1) return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
  }
  return keys[keys.length - 1]![1];
}

export function LandingScene({ src, rootRef, onReady, onFail, ctl, onPick, look = "obsidienne" }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onFail, onPick });
  cb.current = { onReady, onFail, onPick };

  useEffect(() => {
    const el = host.current;
    const root = rootRef.current;
    if (!el || !root) return;
    let cancelled = false;
    let teardown: (() => void) | null = null;

    (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js"); // local, offline (EXT_meshopt_compression)
        const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
        if (cancelled) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
        renderer.setPixelRatio(pixelRatio);
        const LK = LOOKS[look];
        const css = getComputedStyle(document.documentElement);
        const ink = css.getPropertyValue("--ink").trim() || "#0e0e0e";
        const amberHex = css.getPropertyValue("--yellow").trim() || "#ffb547";
        // Notice keeps its palette exactly: no tone mapping, flat light (ambient only), black edges
        renderer.toneMapping = LK.flat ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = LK.exposure;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
        el.prepend(renderer.domElement);

        const scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = LK.env;
        const camera = new THREE.PerspectiveCamera(26, 1, 1, 900);
        if (LK.flat) scene.add(new THREE.AmbientLight(0xffffff, Math.PI)); // Lambert divides by pi: this renders the palette as is

        const key = new THREE.DirectionalLight(LK.lights[0][0], LK.lights[0][1]);
        key.position.set(-50, 80, 70);
        key.castShadow = !LK.flat;
        key.shadow.mapSize.set(1536, 1536);
        Object.assign(key.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60 });
        key.shadow.bias = -0.0004;
        scene.add(key);
        const rim = new THREE.DirectionalLight(LK.lights[1][0], LK.lights[1][1]);
        rim.position.set(70, 30, -80);
        scene.add(rim);
        const rim2 = new THREE.DirectionalLight(LK.lights[2][0], LK.lights[2][1]);
        rim2.position.set(-80, 12, -50);
        scene.add(rim2);


        const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(src);
        if (cancelled) return;
        const model = gltf.scene;
        model.scale.setScalar(MODEL_SCALE);
        const group = new THREE.Group();
        group.add(model);
        scene.add(group);

        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const centre = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        model.position.sub(centre);
        model.updateMatrixWorld(true);
        const origin = new THREE.Vector3(); // the model is now centred on the origin
        const top = size.y / 2 + 4, bottom = -size.y / 2 - 2;

        const mats: Material[] = [];

        type Part = { obj: Mesh; base: Vector3; dir: Vector3; name: string; w: number; c: Vector3; hot: number; group: string; glass: boolean; em0: Color | null };
        const parts: Part[] = [];
        const meshes: Mesh[] = [];
        model.traverse((o) => { if ((o as Mesh).isMesh) meshes.push(o as Mesh); });
        const extras: { dispose: () => void }[] = [];
        const edgeMat = LK.flat ? new THREE.LineBasicMaterial({ color: 0x141414 }) : null;
        if (edgeMat) extras.push(edgeMat);
        meshes.forEach((mesh) => {
          const info = partInfo(mesh);
          const src0 = mesh.material as Material;
          let m: Material;
          if (LK.flat) {
            // Lambert (not Basic) so the scan band and the head highlights can still light parts through emissive
            m = src0.name === "Touchscreen" ? src0.clone() : new THREE.MeshLambertMaterial({ color: NOTICE_FILL[src0.name] ?? "#ffffff" });
            if (/glass/i.test(mesh.name) && !/Front_Glass/i.test(mesh.name)) mesh.visible = false;
            if (/Chamber_Light/.test(mesh.name)) mesh.visible = false;
            if (mesh.visible && !/^Filament_/.test(src0.name)) {
              const eg = new THREE.EdgesGeometry(mesh.geometry, 32);
              extras.push(eg);
              const ls = new THREE.LineSegments(eg, edgeMat!);
              ls.raycast = () => {};
              mesh.add(ls);
            }
          } else m = src0.clone(); // own material per part so a group can be highlighted; the model's textures are kept
          mats.push(m);
          mesh.material = m;
          mesh.castShadow = !info.glass && !LK.flat;
          mesh.receiveShadow = true;
          const em = (m as import("three").MeshStandardMaterial).emissive;
          const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
          const d = c.clone().sub(origin);
          d.set(d.x, d.y * 0.8 * PHI, d.z * 1.15);
          const L = d.length();
          if (L < 1e-4) d.set(0, 1, 0);
          d.normalize();
          parts.push({ obj: mesh, base: mesh.position.clone(), dir: d, name: info.name, w: Math.min(1, L / 16), c: c.clone(), hot: info.hot, group: info.group, glass: info.glass, em0: em ? em.clone() : null });
        });

        // turntable rings, floor shadow, scan plane (colours follow the theme)
        const ringHex = LK.ring ?? ink;
        const rings = new THREE.Group();
        [46, 52, 64].forEach((r, i) => {
          const pts = Array.from({ length: 181 }, (_, k) => new THREE.Vector3(Math.cos((k / 180) * Math.PI * 2) * r, 0, Math.sin((k / 180) * Math.PI * 2) * r));
          rings.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: ringHex, transparent: true, opacity: [0.45, 0.22, 0.1][i] })));
        });
        rings.position.y = bottom + 1.6;
        scene.add(rings);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.ShadowMaterial({ opacity: LK.shadow }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = bottom + 1.5;
        floor.receiveShadow = true;
        scene.add(floor);

        const scan = new THREE.Group();
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(84, 84), new THREE.MeshBasicMaterial({ color: amberHex, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
        sheet.rotation.x = -Math.PI / 2;
        const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-42, -42], [42, -42], [42, 42], [-42, 42]].map(([x, z]) => new THREE.Vector3(x, 0, z))), new THREE.LineBasicMaterial({ color: ringHex }));
        const hair = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-42, 0, 0), new THREE.Vector3(42, 0, 0), new THREE.Vector3(0, 0, -42), new THREE.Vector3(0, 0, 42)]), new THREE.LineBasicMaterial({ color: ringHex, transparent: true, opacity: 0.35 }));
        scan.add(sheet, edge, hair);
        scene.add(scan);

        // ---- DOM hooks (elements live in the React page; no React per frame) ----
        const chapters = Array.from(root.querySelectorAll<HTMLElement>("[data-chapter]"));
        const labels = [1, 2, 3, 4].map((n) => root.querySelector<HTMLElement>(`[data-hot="${n}"]`));
        const proof = (["fact", "hyp", "gap"] as const).map((k) => ({ k, path: root.querySelector<SVGPathElement>(`[data-proof-path="${k}"]`), card: root.querySelector<HTMLElement>(`[data-proof-card="${k}"]`), n: k === "fact" ? 3 : k === "hyp" ? 2 : 0 }));
        const leads = [1, 2, 3, 4].map((n) => ({ path: root.querySelector<SVGPathElement>(`[data-lead-path="${n}"]`), dot: root.querySelector<SVGCircleElement>(`[data-lead-dot="${n}"]`), num: root.querySelector<HTMLElement>(`[data-num="${n}"]`) }));
        const heads = [1, 2, 3, 4].map((n) => parts.filter((p) => p.hot === n));
        const ringMats = rings.children.map((c) => (c as import("three").Line).material as import("three").LineBasicMaterial);

        // ---- pointer: hover/click a part, drag to turn the machine (eases back to the scroll story) ----
        const pickable = parts.filter((p) => !p.glass && !/^Chamber Light/i.test(p.name)).map((p) => p.obj);
        const ray = new THREE.Raycaster();
        const ptr = new THREE.Vector2();
        const cv = renderer.domElement;
        cv.style.touchAction = "pan-y";
        cv.style.cursor = "grab";
        let hoverG: string | null = null, dragging = false, moved = 0, lx = 0, ly = 0, userAz = 0, userEl = 0, manualE = 0;
        const pickAt = (e: PointerEvent): string | null => {
          const r = cv.getBoundingClientRect();
          ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
          ray.setFromCamera(ptr, camera);
          const hit = ray.intersectObjects(pickable, false)[0];
          return hit ? parts.find((p) => p.obj === hit.object)?.group ?? null : null;
        };
        const onDown = (e: PointerEvent) => { if (e.button !== 0) return; dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; cv.setPointerCapture?.(e.pointerId); cv.style.cursor = "grabbing"; };
        const onMove = (e: PointerEvent) => {
          if (dragging) {
            moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
            userAz += (e.clientX - lx) * 0.0065; userEl = clamp(userEl + (e.clientY - ly) * 0.004, -0.45, 0.45);
            lx = e.clientX; ly = e.clientY;
          } else {
            const g = pickAt(e);
            if (g !== hoverG) { hoverG = g; cv.style.cursor = g ? "pointer" : "grab"; }
          }
        };
        const onUp = (e: PointerEvent) => { if (!dragging) return; dragging = false; cv.style.cursor = hoverG ? "pointer" : "grab"; if (moved < 6) cb.current.onPick(pickAt(e)); };
        const onLeave = () => { hoverG = null; };
        cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove); cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onUp); cv.addEventListener("pointerleave", onLeave);

        const resize = () => {
          const w = el.clientWidth || 1, h = el.clientHeight || 1;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
        };
        const ro = new ResizeObserver(resize);
        ro.observe(el);
        resize();

        const getT = (): number => {
          if (!chapters.length) return 0;
          const vc = window.innerHeight / 2;
          const cs = chapters.map((c) => { const r = c.getBoundingClientRect(); return r.top + r.height / 2; });
          if (vc <= cs[0]!) return 0;
          for (let i = 1; i < cs.length; i++) if (vc <= cs[i]!) return i - 1 + (vc - cs[i - 1]!) / (cs[i]! - cs[i - 1]!);
          return cs.length - 1;
        };

        const tmp = new THREE.Vector3();
        const start = performance.now();
        let ts = getT(), last = start, raf = 0, running = document.visibilityState === "visible";
        let frames = 0, acc = 0;
        const onVis = () => { running = document.visibilityState === "visible"; last = performance.now(); };
        document.addEventListener("visibilitychange", onVis);

        const frame = (now: number) => {
          raf = requestAnimationFrame(frame);
          if (!running) return;
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          // adaptive quality: weak GPUs render at 1x pixels
          if (frames < 45) { frames++; acc += dt; if (frames === 45 && acc / 45 > 0.026) { pixelRatio = 1; renderer.setPixelRatio(1); resize(); } }

          ts += (getT() - ts) * Math.min(1, dt * 5.5);
          const intro = 1 - Math.pow(1 - clamp((now - start) / 2600), 3);

          // scan: a yellow band sweeps down the machine and lights each part it crosses (nothing is ever cut or hidden)
          const scanP = ts < 1 ? 0.5 * intro + 0.5 * smooth(ts) : 1;
          const sy = top + (bottom - top) * scanP;
          const scanning = scanP < 0.995;
          scan.visible = scanning;
          scan.position.y = sy;
          (sheet.material as import("three").MeshBasicMaterial).opacity = 0.14 * (1 - smooth((scanP - 0.9) / 0.1));

          // explosion with golden spacing
          const c = ctl.current;
          manualE += (c.explode - manualE) * Math.min(1, dt * 5);
          const e = Math.max(curve(ts, [[0, 0], [1, 0], [2, 1], [3, 0.82], [4, 0], [5, 0]]), manualE);
          for (const p of parts) p.obj.position.copy(p.base).addScaledVector(p.dir, (e * 40 * p.w) / MODEL_SCALE);
          group.scale.setScalar(1 / (1 + 0.38 * e));

          // highlights: chapter hypothesis (head 2), simulator (picked head), incident slider (head 3), hover (any group)
          const amber = smooth((ts - 2.55) / 0.5) * (1 - smooth((ts - 3.6) / 0.5));
          for (const p of parts) {
            const em = (p.obj.material as import("three").MeshStandardMaterial).emissive;
            if (!em || p.glass || !p.em0) continue;
            let a = 0;
            if (p.hot) {
              if (p.hot === 2) a = amber;
              if (c.head === p.hot) a = Math.max(a, 0.85 + 0.15 * Math.sin(now * 0.006));
              if (p.hot === 3 && (c.incident === "paused" || c.incident === "code")) a = Math.max(a, c.incident === "code" ? 0.9 : 0.5);
            }
            if (hoverG && p.group === hoverG) a = Math.max(a, 0.55);
            const band = scanning ? Math.exp(-((p.c.y - sy) ** 2) / 32) : 0;
            em.setRGB(p.em0.r + 0.55 * a + 0.6 * band, p.em0.g + 0.3 * a + 0.46 * band, p.em0.b + 0.02 * band);
          }
          ringMats.forEach((m) => m.color.set(c.incident === "gap" ? amberHex : ringHex));

          // camera path
          if (!dragging) { const k = Math.max(0, 1 - dt * 1.1); userAz *= k; userEl *= k; }
          const az = 0.62 + ts * 0.9 + Math.sin(now * 0.00028) * 0.025 + userAz;
          const r = curve(ts, [[0, 268], [1, 190], [2, 268], [3, 252], [4, 184], [5, 228]]) * (camera.aspect < 0.85 ? 1.5 : 1);
          const el2 = curve(ts, [[0, 0.3], [1, 0.16], [2, 0.36], [3, 0.27], [4, 0.42], [5, 0.3]]) + userEl;
          camera.position.set(r * Math.cos(el2) * Math.sin(az), r * Math.sin(el2), r * Math.cos(el2) * Math.cos(az));
          camera.lookAt(0, 0, 0);
          const w = renderer.domElement.clientWidth || 1, h = renderer.domElement.clientHeight || 1;
          const shift = camera.aspect < 0.85 ? 0 : curve(ts, [[0, SHIFT], [0.8, SHIFT], [1.2, -SHIFT], [1.8, -SHIFT], [2.2, SHIFT * 0.6], [2.6, SHIFT * 0.6], [3, -SHIFT], [3.7, -SHIFT], [4.1, SHIFT], [4.8, SHIFT], [5, 0]]);
          camera.setViewOffset(w, h, -shift * w, 0, w, h);
          camera.updateMatrixWorld();

          rings.rotation.y -= dt * 0.07;
          renderer.render(scene, camera);

          // toolhead labels (chapters 1-3)
          const labelA = smooth((ts - 1.5) / 0.4) * (1 - smooth((ts - 3.6) / 0.4));
          const leadA = 1 - smooth((ts - 0.2) / 0.4); // numerals leave before the first chapter panel (right side) arrives
          const anchor = (n: number) => {
            const ps = heads[n - 1];
            if (!ps?.length) return null;
            tmp.set(0, 0, 0);
            ps.forEach((p) => tmp.add(p.c).addScaledVector(p.obj.position, MODEL_SCALE).addScaledVector(p.base, -MODEL_SCALE));
            tmp.divideScalar(ps.length).multiplyScalar(group.scale.x);
            tmp.y += 3;
            tmp.project(camera);
            return tmp.z < 1 ? { x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h } : null;
          };
          labels.forEach((lab, i) => {
            if (!lab) return;
            const a = anchor(i + 1);
            lab.style.opacity = a ? String(labelA) : "0";
            if (a) lab.style.transform = `translate(${a.x}px, ${a.y}px) translate(-50%, ${i % 2 ? -230 : -130}%)`;
          });

          // hero leaders: head anchor -> giant numeral
          const rr = (el.parentElement ?? el).getBoundingClientRect();
          leads.forEach(({ path, dot, num }, i) => {
            if (!path || !dot || !num) return;
            const a = anchor(i + 1);
            if (!a || leadA < 0.02) { path.style.opacity = "0"; dot.style.opacity = "0"; num.style.opacity = "0"; return; }
            const nr = num.getBoundingClientRect();
            const bx = nr.left - rr.left - 8, by = nr.top - rr.top + nr.height * 0.55;
            path.setAttribute("d", `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${(bx - 40).toFixed(1)} ${by.toFixed(1)} L${bx.toFixed(1)} ${by.toFixed(1)}`);
            dot.setAttribute("cx", a.x.toFixed(1)); dot.setAttribute("cy", a.y.toFixed(1));
            path.style.opacity = String(leadA); dot.style.opacity = String(leadA); num.style.opacity = String(leadA);
          });

          // proof leader lines: 3D head -> evidence card
          const proofA = smooth((ts - 2.55) / 0.45) * (1 - smooth((ts - 3.5) / 0.4));
          const rootRect = (el.parentElement ?? el).getBoundingClientRect();
          proof.forEach(({ path, card, n }) => {
            if (!path || !card) return;
            const a = n ? anchor(n) : { x: w * 0.3, y: h * 0.82 };
            const cr = card.getBoundingClientRect();
            if (!a || proofA < 0.02) { path.style.opacity = "0"; return; }
            const bx = cr.left - rootRect.left, by = cr.top - rootRect.top + cr.height / 2;
            path.setAttribute("d", `M${a.x.toFixed(1)} ${a.y.toFixed(1)} C${(a.x + 90).toFixed(1)} ${a.y.toFixed(1)}, ${(bx - 110).toFixed(1)} ${by.toFixed(1)}, ${bx.toFixed(1)} ${by.toFixed(1)}`);
            path.style.opacity = String(proofA);
          });
        };
        raf = requestAnimationFrame(frame);
        cb.current.onReady();

        teardown = () => {
          cancelAnimationFrame(raf);
          ro.disconnect();
          document.removeEventListener("visibilitychange", onVis);
          cv.removeEventListener("pointerdown", onDown); cv.removeEventListener("pointermove", onMove); cv.removeEventListener("pointerup", onUp); cv.removeEventListener("pointercancel", onUp); cv.removeEventListener("pointerleave", onLeave);
          parts.forEach((p) => p.obj.geometry.dispose());
          mats.forEach((m) => m.dispose());
          extras.forEach((x) => x.dispose());
          gltf.scene.traverse((o) => { const mm = (o as Mesh).material as import("three").MeshStandardMaterial | undefined; if (mm?.isMeshStandardMaterial) for (const t of [mm.map, mm.normalMap, mm.roughnessMap, mm.metalnessMap, mm.emissiveMap, mm.aoMap]) t?.dispose(); });
          scene.environment?.dispose();
          pmrem.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch (err) {
        console.warn("[landing] 3D scene unavailable, using the static illustration", err);
        if (!cancelled) cb.current.onFail();
      }
    })();
    return () => { cancelled = true; teardown?.(); };
  }, [src, rootRef, look]);

  return <div ref={host} className="absolute inset-0" aria-hidden="true" />;
}
