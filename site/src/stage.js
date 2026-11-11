// Story section: the visual stays pinned while the three steps scroll by. Scroll drives which step is active and
// where the 3D camera is (overview, toolheads, screen). Images are the fallback and the first paint; the 3D model fades
// in over them only on a capable desktop screen, and never when the visitor asked for reduced motion.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function initStage({ reduce }) {
  const root = document.documentElement;
  const steps = [...document.querySelectorAll(".stage-steps .step")];
  const frame = document.getElementById("stage-frame");
  if (!steps.length || !frame) return;

  const imgs = [...frame.querySelectorAll("img")];
  let active = 0;
  const show = (k) => {
    active = k;
    steps.forEach((s, i) => s.classList.toggle("on", i === k));
    for (const img of imgs) img.classList.toggle("on", Number(img.dataset.k) === k);
  };
  show(0);

  let scene = null;
  const mm = gsap.matchMedia();
  mm.add("(min-width: 901px)", () => {
    const wrap = document.querySelector(".stage-steps");
    const st = ScrollTrigger.create({
      trigger: wrap, start: "top 60%", end: "bottom 60%", scrub: reduce ? false : 0.6,
      onUpdate: (self) => {
        const p = self.progress;
        show(Math.min(steps.length - 1, Math.floor(p * steps.length)));
        scene?.setProgress(p);
      },
    });
    return () => st.kill();
  });
  mm.add("(max-width: 900px)", () => {
    const sts = steps.map((s, i) => ScrollTrigger.create({ trigger: s, start: "top 65%", end: "bottom 35%", onToggle: (self) => self.isActive && show(i) }));
    return () => sts.forEach((t) => t.kill());
  });

  /* 3D: desktop, motion allowed, WebGL available */
  const wide = matchMedia("(min-width: 901px)").matches;
  if (reduce || !wide) return;
  // The 650 kB scene code and the 4.3 MB model are only fetched once the frame is really on screen, then when the browser is idle.
  const boot = () => {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    frame.append(canvas);
    import("./scene3d.js")
      .then((m) => m.createScene(canvas, { theme: root.dataset.theme, onReady: () => canvas.classList.add("on") }))
      .then((api) => {
        scene = api;
        document.addEventListener("u1d:theme", (e) => api.setTheme(e.detail));
        const io = new IntersectionObserver((e) => (e[0].isIntersecting && !document.hidden ? api.start() : api.stop()), { threshold: 0 });
        io.observe(frame);
        document.addEventListener("visibilitychange", () => (document.hidden ? api.stop() : api.start()));
      })
      .catch(() => canvas.remove()); // no WebGL or the model failed to load: the images stay
  };
  const idle = window.requestIdleCallback ?? ((f) => setTimeout(f, 200));
  const watch = new IntersectionObserver((e) => { if (e[0].isIntersecting) { watch.disconnect(); idle(boot); } }, { threshold: 0.15 });
  watch.observe(frame);
}
