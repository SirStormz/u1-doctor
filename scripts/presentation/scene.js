// U1 Doctor presentation: a scroll-driven 3D "evidence corridor".
// Everything here is abstract (ticks, gaps, rings, a sealed capsule). It depicts the ideas of the tool,
// not a printer, and invents no data. Bundled with three.js into one inline script by scripts/build_presentation.py.
import {
  WebGLRenderer, Scene, PerspectiveCamera, FogExp2, Color, Group, Vector3, MathUtils,
  InstancedMesh, BoxGeometry, MeshBasicMaterial, MeshStandardMaterial, Object3D,
  BufferGeometry, BufferAttribute, Points, ShaderMaterial, AdditiveBlending, DoubleSide,
  TorusGeometry, IcosahedronGeometry, EdgesGeometry, LineSegments, LineBasicMaterial, Line,
  SphereGeometry, Mesh, CylinderGeometry, CapsuleGeometry, CircleGeometry, RingGeometry,
  AmbientLight, PointLight, CanvasTexture, Sprite, SpriteMaterial
} from "three";

const AMBER = 0xffc400, VIOLET = 0xb4a0ff, RED = 0xff6b78, INK = 0xececee, GREEN = 0x6ee7a8, BG = 0x101113;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const small = innerWidth < 760;
const canvas = document.getElementById("scene");
if (canvas) boot();

function boot() {
  let renderer;
  const dprCap = Math.min(devicePixelRatio, small ? 1.25 : 1.5);
  try { renderer = new WebGLRenderer({ canvas, antialias: dprCap < 1.25 && !small, alpha: false, powerPreference: "high-performance" }); }
  catch (e) { canvas.style.display = "none"; return; }
  renderer.setPixelRatio(dprCap);
  renderer.setClearColor(BG, 1);
  const scene = new Scene();
  scene.fog = new FogExp2(BG, 0.0105);
  const camera = new PerspectiveCamera(48, 1, 0.1, 900);
  camera.position.set(-48, 6, 18);
  scene.add(new AmbientLight(0xffffff, 0.55));
  const key = new PointLight(AMBER, 900, 120, 1.6); key.position.set(0, 12, 10); scene.add(key);
  const rim = new PointLight(VIOLET, 500, 120, 1.6); rim.position.set(0, -4, -14); scene.add(rim);

  /* soft round sprite texture */
  const glowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(.25, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new CanvasTexture(c);
  })();
  const glow = (col, s, x, y, z) => { const sp = new Sprite(new SpriteMaterial({ map: glowTex, color: col, blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: .9 })); sp.scale.set(s, s, 1); sp.position.set(x, y, z); return sp; };

  /* ---------- world layout (x = story position) ---------- */
  const X0 = -60, X1 = 620, L = X1 - X0;
  const GAPS = [[150, 161], [176, 185], [199, 205], [-1, -1]];

  /* ground grid */
  const grid = new Group();
  { const pos = [], n = 120, step = 6;
    for (let i = -n; i <= n; i++) { const z = i * step * .5; pos.push(X0, -7, z, X1, -7, z); }
    for (let x = X0; x <= X1; x += step * 2) pos.push(x, -7, -80, x, -7, 80);
    const g = new BufferGeometry(); g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    grid.add(new LineSegments(g, new LineBasicMaterial({ color: 0x2a2c31, transparent: true, opacity: .55 }))); scene.add(grid); }

  /* timeline ribbon: instanced ticks, gaps removed, planned zone ghosted */
  const inGap = x => GAPS.some(([a, b]) => x > a && x < b);
  const tickGeo = new BoxGeometry(.09, 1, .09);
  const real = new InstancedMesh(tickGeo, new MeshBasicMaterial({ color: AMBER }), 900);
  const synth = new InstancedMesh(tickGeo, new MeshBasicMaterial({ color: VIOLET }), 400);
  const ghost = new InstancedMesh(tickGeo, new MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: .28 }), 400);
  { const o = new Object3D(); let a = 0, b = 0, c = 0;
    for (let x = X0; x < X1; x += .55) {
      if (inGap(x)) continue;
      const big = Math.round((x - X0) / .55) % 8 === 0, h = big ? 2.4 : 1.1 + .5 * Math.abs(Math.sin(x * .7));
      o.position.set(x, h / 2 - .3, 0); o.scale.set(1, h, 1); o.updateMatrix();
      if (x > 330) { if (c < 400) ghost.setMatrixAt(c++, o.matrix); }
      else if (x > 90 && x < 140 || x > 215 && x < 260) { if (b < 400) synth.setMatrixAt(b++, o.matrix); }
      else if (a < 900) real.setMatrixAt(a++, o.matrix);
    }
    real.count = a; synth.count = b; ghost.count = c; }
  scene.add(real, synth, ghost);

  /* phase slabs under the ribbon */
  const slabs = new Group();
  [[-40, 20, AMBER], [24, 90, AMBER], [92, 142, VIOLET], [162, 176, AMBER], [186, 198, AMBER], [206, 258, VIOLET]].forEach(([a, b, col]) => {
    const w = b - a, g = new BoxGeometry(w, .5, 5);
    const m = new Mesh(g, new MeshBasicMaterial({ color: col, transparent: true, opacity: .06, depthWrite: false }));
    m.position.set((a + b) / 2, -1.2, 0); slabs.add(m);
    const e = new LineSegments(new EdgesGeometry(g), new LineBasicMaterial({ color: col, transparent: true, opacity: .45 }));
    e.position.copy(m.position); slabs.add(e);
  });
  scene.add(slabs);

  /* gap markers: dashed rings that pulse */
  const gapRings = [];
  GAPS.forEach(([a, b]) => { if (a < 0) return;
    const r = new Mesh(new TorusGeometry((b - a) / 2.2, .05, 8, 64), new MeshBasicMaterial({ color: INK, transparent: true, opacity: .55 }));
    r.position.set((a + b) / 2, 1, 0); r.rotation.y = Math.PI / 2; scene.add(r); gapRings.push(r);
    const l = new LineSegments(new BufferGeometry().setFromPoints([new Vector3((a + b) / 2, -1, 0), new Vector3((a + b) / 2, 7, 0)]), new LineBasicMaterial({ color: INK, transparent: true, opacity: .25 }));
    scene.add(l);
  });

  /* observation streams (GPU particles) */
  const N = small ? 1800 : 4600;
  const sp = new Float32Array(N * 3), sv = new Float32Array(N), sc = new Float32Array(N * 3), ss = new Float32Array(N);
  const tmp = new Color();
  for (let i = 0; i < N; i++) {
    sp[i * 3] = Math.random() * L; sp[i * 3 + 1] = (Math.random() - .5) * 9 + 1.5; sp[i * 3 + 2] = (Math.random() - .5) * 14;
    sv[i] = 2 + Math.random() * 7; ss[i] = .6 + Math.random() * 1.8;
    const r = Math.random(); tmp.set(r < .62 ? AMBER : r < .86 ? VIOLET : INK);
    sc[i * 3] = tmp.r; sc[i * 3 + 1] = tmp.g; sc[i * 3 + 2] = tmp.b;
  }
  const sg = new BufferGeometry();
  sg.setAttribute("position", new BufferAttribute(sp, 3)); sg.setAttribute("aSpeed", new BufferAttribute(sv, 1));
  sg.setAttribute("aColor", new BufferAttribute(sc, 3)); sg.setAttribute("aSize", new BufferAttribute(ss, 1));
  const gapU = GAPS.map(g => new Vector3(g[0], g[1], 0));
  const stream = new Points(sg, new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uX0: { value: X0 }, uL: { value: L }, uGaps: { value: gapU }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: `
      attribute float aSpeed; attribute vec3 aColor; attribute float aSize;
      uniform float uTime,uX0,uL,uPx; uniform vec3 uGaps[4];
      varying vec3 vC; varying float vA;
      void main(){
        float x = mod(position.x + uTime*aSpeed, uL) + uX0;
        float a = 1.0;
        for(int i=0;i<4;i++){ if(x>uGaps[i].x && x<uGaps[i].y) a = 0.0; }
        vec3 p = vec3(x, position.y + sin(uTime*.6 + position.x)*.4, position.z);
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = aSize*uPx*(220.0/-mv.z);
        vC = aColor; vA = a;
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vA;
      void main(){ float d = length(gl_PointCoord-.5); if(d>.5||vA<.5) discard; float s = smoothstep(.5,.0,d); gl_FragColor = vec4(vC, s*.85); }`
  }));
  stream.frustumCulled = false; scene.add(stream);

  /* ---------- exhibit objects ---------- */
  // engine (x=60): pure function
  const engine = new Group(); engine.position.set(60, 2.4, 0);
  const ringA = new Mesh(new TorusGeometry(4.2, .22, 12, 6), new MeshStandardMaterial({ color: AMBER, emissive: AMBER, emissiveIntensity: .35, roughness: .4 }));
  const ringB = new Mesh(new TorusGeometry(3.1, .14, 10, 24), new MeshBasicMaterial({ color: INK, wireframe: true, transparent: true, opacity: .5 }));
  const core = new Mesh(new IcosahedronGeometry(1.5, 1), new MeshBasicMaterial({ color: AMBER, wireframe: true }));
  engine.add(ringA, ringB, core, glow(AMBER, 9, 0, 0, 0));
  const orb = []; for (let i = 0; i < 6; i++) { const s = new Mesh(new SphereGeometry(.2, 12, 12), new MeshBasicMaterial({ color: i % 2 ? VIOLET : AMBER })); engine.add(s); orb.push(s); }
  scene.add(engine);

  // twin runs (x=100): same input, same result
  const twin = new Group(); twin.position.set(100, 2, 0);
  const lis = []; for (let i = 0; i <= 220; i++) { const t = i / 220 * Math.PI * 2; lis.push(new Vector3(Math.sin(3 * t) * 1.1, Math.sin(2 * t + 1) * 1.1, Math.sin(5 * t) * 1.1)); }
  const cubeGeo = new EdgesGeometry(new BoxGeometry(3.2, 3.2, 3.2));
  const twins = [];
  [-4.2, 4.2].forEach(z => { const g = new Group(); g.position.z = z;
    g.add(new LineSegments(cubeGeo, new LineBasicMaterial({ color: INK, transparent: true, opacity: .8 })));
    g.add(new Line(new BufferGeometry().setFromPoints(lis), new LineBasicMaterial({ color: AMBER })));
    g.add(glow(AMBER, 5, 0, 0, 0)); twin.add(g); twins.push(g); });
  const okRing = new Mesh(new TorusGeometry(1.1, .08, 8, 40), new MeshBasicMaterial({ color: GREEN, transparent: true, opacity: .9 })); okRing.rotation.y = Math.PI / 2; twin.add(okRing);
  scene.add(twin);

  // balance (x=240): evidence for / against / missing
  const bal = new Group(); bal.position.set(240, 0, 0);
  const steel = new MeshStandardMaterial({ color: 0x8e919a, roughness: .35, metalness: .6 });
  const post = new Mesh(new CylinderGeometry(.18, .26, 6, 16), steel); post.position.y = 3; bal.add(post);
  const base = new Mesh(new CylinderGeometry(2, 2.4, .4, 32), steel); base.position.y = -.2; bal.add(base);
  const beam = new Group(); beam.position.y = 6; bal.add(beam);
  const bar = new Mesh(new BoxGeometry(9, .22, .22), new MeshStandardMaterial({ color: INK, roughness: .3, metalness: .5 })); beam.add(bar);
  const mkPan = (x, col, n, ring) => { const p = new Group(); p.position.x = x;
    const dish = new Mesh(new CylinderGeometry(1.5, 1.2, .16, 32), ring ? new MeshBasicMaterial({ color: INK, wireframe: true, transparent: true, opacity: .5 }) : new MeshStandardMaterial({ color: 0x2a2c31, roughness: .5 })); dish.position.y = -2.4; p.add(dish);
    const rope = new LineSegments(new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(-1.4, -2.4, 0), new Vector3(0, 0, 0), new Vector3(1.4, -2.4, 0)]), new LineBasicMaterial({ color: 0x8e919a })); p.add(rope);
    for (let i = 0; i < n; i++) { const s = new Mesh(new SphereGeometry(.38, 16, 16), new MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .45 })); s.position.set((i - (n - 1) / 2) * .8, -1.85, 0); p.add(s); }
    return p; };
  const panL = mkPan(-4.5, AMBER, 4), panR = mkPan(4.5, INK, 2); beam.add(panL, panR);
  const missing = new Mesh(new TorusGeometry(1.3, .03, 6, 32), new MeshBasicMaterial({ color: VIOLET })); missing.rotation.x = Math.PI / 2; missing.position.set(0, 1.6, 5); bal.add(missing);
  bal.add(glow(AMBER, 14, 0, 4, 0)); scene.add(bal);

  // sealed capsule (x=450): the evidence bundle
  const cap = new Group(); cap.position.set(450, 2.6, 0);
  const shell = new Mesh(new CapsuleGeometry(1.7, 3.6, 12, 32), new MeshStandardMaterial({ color: 0x1e2024, roughness: .35, metalness: .7 })); shell.rotation.z = Math.PI / 2; cap.add(shell);
  const seam = new Mesh(new TorusGeometry(1.72, .09, 12, 48), new MeshBasicMaterial({ color: AMBER })); seam.rotation.y = Math.PI / 2; cap.add(seam);
  const seal = new Mesh(new SphereGeometry(.42, 24, 24), new MeshBasicMaterial({ color: AMBER })); seal.position.set(0, 1.78, 0); cap.add(seal);
  const replay = new Mesh(new TorusGeometry(4.2, .04, 6, 96, Math.PI * 1.6), new MeshBasicMaterial({ color: VIOLET })); cap.add(replay);
  cap.add(glow(AMBER, 10, 0, 0, 0)); scene.add(cap);

  // allowlist gate (x=520): reads pass, control commands burst
  const gate = new Group(); gate.position.set(520, 2.4, 0);
  const gr = new Mesh(new TorusGeometry(7, .3, 16, 96), new MeshStandardMaterial({ color: AMBER, emissive: AMBER, emissiveIntensity: .6, roughness: .3 })); gr.rotation.y = Math.PI / 2; gate.add(gr);
  const disc = new Mesh(new CircleGeometry(6.8, 64), new MeshBasicMaterial({ color: AMBER, transparent: true, opacity: .05, side: DoubleSide, depthWrite: false })); disc.rotation.y = Math.PI / 2; gate.add(disc);
  const gate2 = new Mesh(new TorusGeometry(7.6, .05, 6, 96), new MeshBasicMaterial({ color: RED, transparent: true, opacity: 0 })); gate2.rotation.y = Math.PI / 2; gate.add(gate2);
  scene.add(gate);
  const M = 420, gp = new Float32Array(M * 3), gk = new Float32Array(M), gph = new Float32Array(M), gd = new Float32Array(M * 3), gc = new Float32Array(M * 3);
  for (let i = 0; i < M; i++) {
    const blocked = i % 3 === 0; gk[i] = blocked ? 1 : 0; gph[i] = Math.random();
    gp[i * 3 + 1] = (Math.random() - .5) * 9; gp[i * 3 + 2] = (Math.random() - .5) * 9;
    const d = new Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize().multiplyScalar(.5 + Math.random());
    gd[i * 3] = d.x; gd[i * 3 + 1] = d.y; gd[i * 3 + 2] = d.z;
    tmp.set(blocked ? RED : AMBER); gc[i * 3] = tmp.r; gc[i * 3 + 1] = tmp.g; gc[i * 3 + 2] = tmp.b;
  }
  const gg = new BufferGeometry();
  gg.setAttribute("position", new BufferAttribute(gp, 3)); gg.setAttribute("aKind", new BufferAttribute(gk, 1)); gg.setAttribute("aPh", new BufferAttribute(gph, 1));
  gg.setAttribute("aDir", new BufferAttribute(gd, 3)); gg.setAttribute("aColor", new BufferAttribute(gc, 3));
  const gateP = new Points(gg, new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uGx: { value: 520 }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: `
      attribute float aKind; attribute float aPh; attribute vec3 aDir; attribute vec3 aColor;
      uniform float uTime,uGx,uPx; varying vec3 vC; varying float vA;
      void main(){
        float t = fract(uTime*.11 + aPh);
        vec3 p = position; float a = 1.0;
        if(aKind < .5){ p.x = uGx - 70.0 + t*140.0; a = .9; }
        else {
          float tt = min(t/.5, 1.0); p.x = uGx - 70.0 + tt*70.0;
          if(t > .5){ float e = (t-.5)*2.0; p += aDir*e*26.0; a = 1.0-e; }
        }
        vec4 mv = modelViewMatrix*vec4(p.x, p.y + 2.4, p.z, 1.0);
        gl_Position = projectionMatrix*mv; gl_PointSize = uPx*(2.4+ (aKind>.5? 1.6:0.0))*(220.0/-mv.z);
        vC = aColor; vA = a;
      }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor=vec4(vC, smoothstep(.5,0.,d)*vA); }`
  }));
  gateP.frustumCulled = false; scene.add(gateP);

  /* ---------- scroll story ---------- */
  const chap = () => [...document.querySelectorAll("[data-world]")].map(el => { const r = el.getBoundingClientRect(); return { c: r.top + r.height / 2 + scrollY, w: parseFloat(el.dataset.world) }; });
  let chapters = chap();
  const ease = f => f * f * (3 - 2 * f);
  const worldX = () => {
    const v = scrollY + innerHeight * .5; if (!chapters.length) return 0;
    if (v <= chapters[0].c) return chapters[0].w;
    for (let i = 0; i < chapters.length - 1; i++) { const a = chapters[i], b = chapters[i + 1]; if (v >= a.c && v < b.c) return MathUtils.lerp(a.w, b.w, ease((v - a.c) / (b.c - a.c))); }
    return chapters[chapters.length - 1].w;
  };
  let mx = 0, my = 0; addEventListener("pointermove", e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  const resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); chapters = chap(); };
  addEventListener("resize", resize); addEventListener("load", () => { chapters = chap(); }); resize();
  if (window.ResizeObserver) new ResizeObserver(() => { chapters = chap(); }).observe(document.body);

  // adaptive quality: measure real frame time, then trade resolution and particle count for smoothness
  let frames = 0, acc = 0, level = 0;
  const adapt = dt => {
    frames++; acc += dt;
    if (frames < 90) return;
    const avg = acc / frames; frames = 0; acc = 0;
    if (avg > 1 / 40 && level < 2) {
      level++;
      if (level === 1) { renderer.setPixelRatio(1); stream.material.uniforms.uPx.value = 1; gateP.material.uniforms.uPx.value = 1; resize(); }
      stream.geometry.setDrawRange(0, Math.floor(N * (level === 1 ? .6 : .32)));
    }
  };

  let cx = worldX() - 18, last = performance.now(), t = 0, visible = true;
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; last = performance.now(); });
  const look = new Vector3();
  function frame(now) {
    requestAnimationFrame(frame); if (!visible) return;
    const dt = Math.min((now - last) / 1000, .05); last = now; t += dt; adapt(dt);
    const wx = worldX(), tx = wx - 18 + mx * 5;
    cx += (tx - cx) * Math.min(1, dt * 3.2);
    camera.position.set(cx, 5.2 + Math.sin(wx * .02) * 1.6 - my * 2.2, 17 - Math.min(wx, 60) * .01 + Math.cos(t * .25) * .6);
    look.set(cx + 18 + mx * 3, 1.2, 0); camera.lookAt(look);
    stream.material.uniforms.uTime.value = t; gateP.material.uniforms.uTime.value = t;
    key.position.x = cx + 10; rim.position.x = cx + 20;
    engine.rotation.y = t * .5; ringA.rotation.z = t * .6; ringB.rotation.x = -t * .4; core.rotation.x = t * .8; core.rotation.y = t * .5;
    orb.forEach((s, i) => { const a = t * .9 + i * 1.047; s.position.set(Math.cos(a) * 4.2, Math.sin(a) * 4.2, 0); });
    twins.forEach((g, i) => { g.rotation.y = t * .6; g.rotation.x = t * .35; });
    okRing.scale.setScalar(1 + .1 * Math.sin(t * 3)); okRing.material.opacity = .6 + .4 * Math.sin(t * 3);
    const tilt = Math.sin(t * .8) * .09; beam.rotation.z = tilt; panL.rotation.z = -tilt; panR.rotation.z = -tilt;
    missing.rotation.z = t * .6;
    cap.rotation.y = t * .4; replay.rotation.z = -t * .9; replay.rotation.y = t * .3; seam.scale.setScalar(1 + .02 * Math.sin(t * 4));
    gate2.material.opacity = Math.max(0, Math.sin(t * 2.2)) * .55; gr.rotation.z = t * .15;
    gapRings.forEach((r, i) => { r.material.opacity = .25 + .35 * (.5 + .5 * Math.sin(t * 2 + i)); r.rotation.x = t * .2; });
    renderer.render(scene, camera);
  }
  if (reduce) { camera.position.set(-18, 5.5, 17); camera.lookAt(0, 1.2, 0); renderer.render(scene, camera); }
  else requestAnimationFrame(frame);
}
