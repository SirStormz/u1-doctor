import { useCallback, useEffect, useRef, useState } from "react";
import { MODEL_SCALE, partInfo } from "./u1model";

export interface ViewerText {
  autoRotate: string;
  explode: string;
  reset: string;
  loading: string;
  unavailable: string;
  hint: string;
  partNote: string;
  door?: string;
  bed?: string;
  head?: string;
  illustrative?: string;
}

interface Props {
  src: string;
  fallbackSrc?: string;
  text: ViewerText;
  className?: string;
  /** hotspot label builder for the four PTFE paths (PTFE_CHANNEL_1..4) */
  hotspotLabel?: (n: number) => string;
}

type Api = { setExplode: (v: number) => void; setAuto: (v: boolean) => void; setDoor: (v: number) => void; setBed: (v: number) => void; setHead: (v: number) => void; reset: () => void; dispose: () => void };

const REDUCED = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function U1Viewer({ src, fallbackSrc, text, className = "", hotspotLabel }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [explode, setExplode] = useState(0);
  const [auto, setAuto] = useState(!REDUCED());
  const [hover, setHover] = useState<string | null>(null);
  const [hotCount, setHotCount] = useState(0);
  const [door, setDoor] = useState(0);
  const [bed, setBed] = useState(0);
  const [head, setHead] = useState(50);
  const labels = useRef<HTMLDivElement[]>([]);
  const labelHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    if (!hasWebGL()) {
      setState("unavailable");
      return;
    }
    let cancelled = false;
    let teardown: (() => void) | null = null;
    (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js"); // local, offline (EXT_meshopt_compression)
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
        if (cancelled || !host.current) return;
        const el = host.current;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:none";
        el.prepend(renderer.domElement);

        const scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 0.85;

        const camera = new THREE.PerspectiveCamera(28, 1, 1, 600);
        const HOME = new THREE.Vector3(90, 58, 150);
        camera.position.copy(HOME);

        const key = new THREE.DirectionalLight(0xffffff, 2.2);
        key.position.set(-40, 70, 60);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.camera.left = -60; key.shadow.camera.right = 60; key.shadow.camera.top = 60; key.shadow.camera.bottom = -60;
        key.shadow.radius = 6; key.shadow.bias = -0.0004;
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xffffff, 1.5);
        rim.position.set(60, 25, -70);
        scene.add(rim);
        const rim2 = new THREE.DirectionalLight(0xffe7a3, 1.1);
        rim2.position.set(-70, 10, -40);
        scene.add(rim2);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.07;
        controls.enablePan = false;
        controls.minDistance = 70;
        controls.maxDistance = 240;
        controls.maxPolarAngle = Math.PI * 0.56;
        controls.autoRotateSpeed = 0.7;
        controls.autoRotate = auto && !REDUCED();

        const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(src);
        if (cancelled) return;
        const model = gltf.scene;
        model.scale.setScalar(MODEL_SCALE);
        const group = new THREE.Group();
        group.add(model);
        scene.add(group);
        model.updateMatrixWorld(true);
        {
          const b0 = new THREE.Box3().setFromObject(model);
          model.position.sub(b0.getCenter(new THREE.Vector3()));
          model.updateMatrixWorld(true);
        }

        type Part = { obj: import("three").Mesh; base: import("three").Vector3; dir: import("three").Vector3; name: string; delay: number; c0: import("three").Vector3; w: number; hot: number; group: string; unpickable: boolean };
        const parts: Part[] = [];
        const box = new THREE.Box3().setFromObject(model);
        const centre = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // keep the model's own PBR materials and textures; one clone per mesh so a hover never lights its neighbours
        const mats: import("three").Material[] = [];
        const meshes: import("three").Mesh[] = [];
        model.traverse((o) => { if ((o as import("three").Mesh).isMesh) meshes.push(o as import("three").Mesh); });
        for (const mesh of meshes) {
          const info = partInfo(mesh);
          const m = (mesh.material as import("three").Material).clone();
          mats.push(m);
          mesh.material = m;
          mesh.castShadow = !info.glass;
          mesh.receiveShadow = true;
          mesh.userData.partName = info.name;
          mesh.renderOrder = info.glass ? 2 : 0;
          const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
          const d = c.clone().sub(centre);
          // bias the explosion: spread mostly outward on X/Z, lift tops slightly
          d.set(d.x * 1.0, d.y * 0.8, d.z * 1.15);
          const L = d.length();
          if (L < 1e-4) d.set(0, 1, 0);
          d.normalize();
          parts.push({ obj: mesh, base: mesh.position.clone(), dir: d, name: info.name, delay: (c.y - box.min.y) / size.y, c0: c.clone(), w: Math.min(1, L / 16), hot: info.hot, group: info.group, unpickable: info.unpickable });
        }

        // illustrative moves (door pivot, bed lift, gantry/toolhead): visual only, never machine coordinates
        const nodeOf = (n: string) => model.getObjectByName(n) ?? null;
        const doorN = nodeOf("DOOR"), bedN = nodeOf("BED_Z"), gantryN = nodeOf("GANTRY_Y"), headN = nodeOf("TOOLHEAD_X"), tubesN = nodeOf("TUBE_SYSTEM");
        const doorBase = doorN?.rotation.y ?? 0, bedBase = bedN?.position.y ?? 0, gantryBase = gantryN?.position.z ?? 0, headBase = headN?.position.x ?? 0;
        let doorV = 0, bedV = 0, headV = 0.5, doorT = 0, bedT = 0, headT = 0.5;
        const ringCol = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#0e0e0e");
        // turntable ring (ink hairlines)
        const ring = new THREE.Group();
        const mkRing = (r: number, op: number) => {
          const pts = Array.from({ length: 181 }, (_, i) => new THREE.Vector3(Math.cos((i / 180) * Math.PI * 2) * r, 0, Math.sin((i / 180) * Math.PI * 2) * r));
          return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: ringCol, transparent: true, opacity: op }));
        };
        ring.add(mkRing(46, 0.55), mkRing(52, 0.25), mkRing(64, 0.12));
        const tickPts: import("three").Vector3[] = [];
        for (let i = 0; i < 72; i++) {
          const a = (i / 72) * Math.PI * 2, r0 = 52, r1 = i % 6 === 0 ? 57 : 54.5;
          tickPts.push(new THREE.Vector3(Math.cos(a) * r0, 0, Math.sin(a) * r0), new THREE.Vector3(Math.cos(a) * r1, 0, Math.sin(a) * r1));
        }
        ring.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tickPts), new THREE.LineBasicMaterial({ color: ringCol, transparent: true, opacity: 0.4 })));
        ring.position.y = box.min.y - 0.4;
        scene.add(ring);
        const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.ShadowMaterial({ opacity: 0.25 }));
        shadowPlane.rotation.x = -Math.PI / 2;
        shadowPlane.position.y = box.min.y - 0.35;
        shadowPlane.receiveShadow = true;
        scene.add(shadowPlane);

        // hotspots on the four PTFE paths (PTFE_CHANNEL_1..4): one anchor per path, centre of its parts
        const hot = [1, 2, 3, 4].map((n) => ({ n, ps: parts.filter((p) => p.hot === n) })).filter((h) => h.ps.length);

        // pick / hover
        const ray = new THREE.Raycaster();
        const ptr = new THREE.Vector2();
        let hoverMesh: import("three").Mesh | null = null;
        const setHoverMesh = (m: import("three").Mesh | null) => {
          if (hoverMesh === m) return;
          if (hoverMesh) ((hoverMesh.material as import("three").MeshStandardMaterial).emissive ?? new THREE.Color()).setHex((hoverMesh.userData.emissive as number) ?? 0);
          hoverMesh = m;
          if (m) {
            const mat = m.material as import("three").MeshStandardMaterial;
            if (mat.emissive) { m.userData.emissive = mat.emissive.getHex(); mat.emissive.setHex(0x6b5200); }
            setHover(m.userData.partName as string);
          } else setHover(null);
        };
        const onMove = (e: PointerEvent) => {
          const r = renderer.domElement.getBoundingClientRect();
          ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
          ray.setFromCamera(ptr, camera);
          const hit = ray.intersectObjects(parts.filter((p) => !p.unpickable).map((p) => p.obj), false)[0];
          setHoverMesh((hit?.object as import("three").Mesh) ?? null);
        };
        const onLeave = () => setHoverMesh(null);
        renderer.domElement.addEventListener("pointermove", onMove);
        renderer.domElement.addEventListener("pointerleave", onLeave);
        controls.addEventListener("start", () => { controls.autoRotate = false; setAuto(false); });

        // sizing
        const resize = () => {
          const w = el.clientWidth || 1, h = el.clientHeight || 1;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        };
        const ro = new ResizeObserver(resize);
        ro.observe(el);
        resize();

        // animation state
        let explodeV = 0, explodeT = 0;
        const startT = performance.now();
        const intro = { t: REDUCED() ? 1 : 0 };
        const ease = (x: number) => 1 - Math.pow(1 - x, 3);
        const tmp = new THREE.Vector3();
        let raf = 0, last = performance.now(), visible = true, running = true;
        const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; });
        io.observe(el);
        const onVis = () => { running = document.visibilityState === "visible"; if (running) last = performance.now(); };
        document.addEventListener("visibilitychange", onVis);

        // Intro: parts start exploded and assemble bottom-up with a stagger; then the slider controls explosion.
        const apply = () => {
          const e = ease(intro.t);
          for (const p of parts) {
            const stagger = intro.t < 1 ? 1 - Math.min(1, Math.max(0, e * 1.5 - p.delay * 0.5)) : 0;
            p.obj.position.copy(p.base).addScaledVector(p.dir, ((explodeV + stagger) * 34 * p.w) / MODEL_SCALE);
          }
        };

        const frame = (now: number) => {
          raf = requestAnimationFrame(frame);
          if (!running || !visible) return;
          const dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          if (intro.t < 1) intro.t = Math.min(1, (now - startT) / 2600); // wall clock: finishes even if the tab was hidden
          explodeV += (explodeT - explodeV) * Math.min(1, dt * 6);
          const k = Math.min(1, dt * 7);
          doorV += (doorT - doorV) * k; bedV += (bedT - bedV) * k; headV += (headT - headV) * k;
          if (doorN) doorN.rotation.y = doorBase - doorV * (Math.PI * 80) / 180;
          if (bedN) bedN.position.y = bedBase + bedV * 0.19;
          if (headN) headN.position.x = headBase + (headV - 0.5) * 0.24;
          if (gantryN) gantryN.position.z = gantryBase;
          // the static PTFE tubes do not follow the head: hide them once the head leaves its rest position
          if (tubesN) tubesN.visible = Math.abs(headV - 0.5) < 0.02;
          apply();
          group.scale.setScalar(1 / (1 + 0.38 * explodeV));
          ring.rotation.y -= dt * 0.08;
          controls.update();
          renderer.render(scene, camera);
          const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
          hot.forEach((hh, i) => {
            const lab = labels.current[i];
            if (!lab) return;
            tmp.set(0, 0, 0);
            hh.ps.forEach((p) => tmp.add(p.c0).addScaledVector(p.obj.position, MODEL_SCALE).addScaledVector(p.base, -MODEL_SCALE));
            tmp.divideScalar(hh.ps.length); tmp.y += 2; tmp.multiplyScalar(group.scale.x);
            tmp.project(camera);
            const vis = tmp.z < 1 && intro.t >= 1 && tubesN?.visible !== false;
            lab.style.opacity = vis ? "1" : "0";
            lab.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%, ${i % 2 ? -250 : -140}%)`;
          });
        };
        raf = requestAnimationFrame(frame);

        api.current = {
          setExplode: (v) => { explodeT = v; },
          setAuto: (v) => { controls.autoRotate = v && !REDUCED(); },
          setDoor: (v) => { doorT = v; },
          setBed: (v) => { bedT = v; },
          setHead: (v) => { headT = v; },
          reset: () => { camera.position.copy(HOME); controls.target.set(0, 0, 0); controls.update(); explodeT = 0; doorT = 0; bedT = 0; headT = 0.5; },
          dispose: () => {},
        };
        labels.current = labels.current.slice(0, hot.length);
        setHotCount(hot.length);
        setState("ready");

        teardown = () => {
          cancelAnimationFrame(raf);
          ro.disconnect(); io.disconnect();
          document.removeEventListener("visibilitychange", onVis);
          renderer.domElement.removeEventListener("pointermove", onMove);
          renderer.domElement.removeEventListener("pointerleave", onLeave);
          controls.dispose();
          parts.forEach((p) => p.obj.geometry.dispose());
          mats.forEach((m) => m.dispose());
          gltf.scene.traverse((o) => { const mm = (o as import("three").Mesh).material as import("three").MeshStandardMaterial | undefined; if (mm?.isMeshStandardMaterial) for (const t of [mm.map, mm.normalMap, mm.roughnessMap, mm.metalnessMap, mm.emissiveMap, mm.aoMap]) t?.dispose(); });
          scene.environment?.dispose();
          pmrem.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch {
        if (!cancelled) setState("unavailable");
      }
    })();
    return () => {
      cancelled = true;
      teardown?.();
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => { api.current?.setExplode(explode / 100); }, [explode]);
  useEffect(() => { api.current?.setAuto(auto); }, [auto]);
  useEffect(() => { api.current?.setDoor(door / 100); }, [door]);
  useEffect(() => { api.current?.setBed(bed / 100); }, [bed]);
  useEffect(() => { api.current?.setHead(head / 100); }, [head]);
  const reset = useCallback(() => { setExplode(0); setDoor(0); setBed(0); setHead(50); api.current?.reset(); }, []);

  return (
    <div className={`flex flex-col overflow-hidden ${className}`} data-testid="u1-viewer">
      <div className="relative min-h-0 flex-1" ref={host}>
        {state === "loading" && <div className="absolute inset-0 grid place-items-center text-sm text-ink3" role="status">{text.loading}</div>}
        {state === "unavailable" && (
          <div className="absolute inset-0 grid place-items-center" role="status">
            {fallbackSrc && <img src={fallbackSrc} alt="" className="absolute inset-0 h-full w-full object-contain opacity-70" />}
            <p className="relative rounded bg-surface2 px-3 py-1 text-sm text-ink2">{text.unavailable}</p>
          </div>
        )}
        <div ref={labelHost} className="pointer-events-none absolute inset-0" aria-hidden="true">
          {Array.from({ length: hotCount }, (_, i) => (
            <div key={i} ref={(n) => { if (n) labels.current[i] = n; }} title={hotspotLabel ? hotspotLabel(i + 1) : undefined} className="group pointer-events-auto absolute left-0 top-0 flex items-center gap-1 whitespace-nowrap border border-ink bg-yellow px-2 py-0.5 text-xs font-extrabold text-[#0e0e0e] opacity-0 transition-opacity" style={{ willChange: "transform" }}>
              <span>{i + 1}</span>
              <span className="hidden font-semibold group-hover:inline">{hotspotLabel ? hotspotLabel(i + 1) : ""}</span>
            </div>
          ))}
        </div>
        {state === "ready" && <p className="pointer-events-none absolute right-3 top-3 micro">{text.partNote}</p>}
      </div>
      {state === "ready" && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line bg-surface/90 px-3 py-2 text-xs text-ink2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> {text.autoRotate}</label>
          <label className="flex items-center gap-2">{text.explode}
            <input type="range" min={0} max={100} value={explode} onChange={(e) => setExplode(Number(e.target.value))} aria-label={text.explode} className="accent-[var(--accent)]" />
          </label>
          {text.door && <label className="flex items-center gap-2">{text.door}
            <input type="range" min={0} max={100} value={door} onChange={(e) => setDoor(Number(e.target.value))} aria-label={text.door} className="accent-[var(--accent)]" />
          </label>}
          {text.bed && <label className="flex items-center gap-2">{text.bed}
            <input type="range" min={0} max={100} value={bed} onChange={(e) => setBed(Number(e.target.value))} aria-label={text.bed} className="accent-[var(--accent)]" />
          </label>}
          {text.head && <label className="flex items-center gap-2">{text.head}
            <input type="range" min={0} max={100} value={head} onChange={(e) => setHead(Number(e.target.value))} aria-label={text.head} className="accent-[var(--accent)]" />
          </label>}
          <button type="button" onClick={reset} className="rounded border border-control px-2 py-0.5 hover:border-accent">{text.reset}</button>
          <span className="ml-auto text-ink3" aria-live="polite">{hover ? <span className="mono text-ink">{hover}</span> : (door || bed || head !== 50) && text.illustrative ? text.illustrative : text.hint}</span>
        </div>
      )}
    </div>
  );
}
