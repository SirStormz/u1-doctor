// Mesure réelle des images/s des planches (Edge = moteur de WebView2, celui de pywebview ; fenêtre visible : sinon le navigateur bride
// requestAnimationFrame à 1 image/s). Banc lancé au préalable : py -3 docs/design/ui-v2/sources/bench.py (port 8790)
//   node docs/design/ui-v2/lab/perf.mjs [headless] [reduce]
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../../frontend/package.json", import.meta.url));
const { chromium } = require("@playwright/test");

const headless = process.argv.includes("headless");
const reduce = process.argv.includes("reduce");
const BASE = process.env.BENCH || "http://127.0.0.1:8790/";
// Playwright lance Edge avec un rendu WebGL logiciel (SwiftShader) : on démarre donc le vrai Edge (GPU réel) et on s'y
// connecte en CDP, pour mesurer ce que verra WebView2.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const EDGE = process.env.EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const prof = mkdtempSync(join(tmpdir(), "u1perf-"));
const edge = spawn(EDGE, ["--remote-debugging-port=9333", "--user-data-dir=" + prof, "--no-first-run", "--window-size=1460,1100", "about:blank"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.connectOverCDP("http://127.0.0.1:9333");
const ctx = browser.contexts()[0];
const page = ctx.pages()[0] || (await ctx.newPage());
await page.setViewportSize({ width: 1440, height: 1000 });
if (reduce) await page.emulateMedia({ reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

const fps = (ms) => page.evaluate((ms) => new Promise((res) => {
  const d = []; let last = performance.now(); const t0 = last;
  function f(t) { d.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else {
    d.sort((a, b) => a - b);
    res({ fps: Math.round((d.length * 1000) / (t - t0)), p95ms: Math.round(d[Math.floor(d.length * 0.95)] * 10) / 10, worstMs: Math.round(d[d.length - 1]) });
  } }
  requestAnimationFrame(f);
}), ms);
const stage = (sel) => page.evaluate((sel) => document.querySelector(sel)?.__u1stage?.stats() ?? null, sel);
const ready = async (sel) => { const t = Date.now(); await page.waitForFunction((s) => document.querySelector(s)?.__u1stage, sel, { timeout: 20000 }); return Date.now() - t; };
const out = {};
out.gpu = await page.evaluate(() => { const c = document.createElement("canvas").getContext("webgl"); const e = c && c.getExtension("WEBGL_debug_renderer_info"); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : "?"; });

async function drag(sel, dx, dy) {
  const b = await page.locator(sel).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  const p = (async () => { for (let i = 0; i < 30; i++) { await page.mouse.move(b.x + b.width / 2 + i * dx, b.y + b.height / 2 + i * dy); await page.waitForTimeout(70); } await page.mouse.up(); })();
  const r = await fps(2000); await p; return r;
}

for (const n of ["P-Accueil", "E-Accueil", "F-Accueil", "V-Accueil"]) {
  const t = Date.now(); await page.goto(BASE + n + ".dc.html", { waitUntil: "domcontentloaded" }); await page.waitForLoadState("load", { timeout: 8000 }).catch(() => {}); out[n + " chargement ms"] = Date.now() - t;
  out[n + " entrée (0-2 s)"] = await fps(2000);
}
await page.goto(BASE + "F-Accueil.dc.html", { waitUntil: "domcontentloaded" });
out["F-Accueil 3D prête ms"] = await ready("canvas.u1c");
await page.mouse.move(1000, 500);
const hov = (async () => { for (let i = 0; i < 30; i++) { await page.mouse.move(900 + i * 10, 400 + i * 5); await page.waitForTimeout(70); } })();
out["F-Accueil survol 3D"] = await fps(2000); await hov;
out["F-Accueil stats"] = await stage("canvas.u1c");

await page.goto(BASE + "F-Verdict.dc.html", { waitUntil: "domcontentloaded" });
out["F-Verdict 3D prête ms"] = await ready("canvas.cam"); await page.waitForTimeout(600);
await page.getByRole("tab", { name: "2 · Nettoyer" }).click();
out["F-Verdict vol de caméra"] = await fps(1400);
out["F-Verdict stats"] = await stage("canvas.cam");

await page.goto(BASE + "V-Expert.dc.html", { waitUntil: "domcontentloaded" });
out["V-Expert 3D prête ms"] = await ready("canvas.u1c"); await page.waitForTimeout(500);
out["V-Expert dérive + hologramme"] = await fps(2500);
out["V-Expert stats"] = await stage("canvas.u1c");

await page.goto(BASE + "P-Accueil.dc.html", { waitUntil: "domcontentloaded" });
out["P-Accueil 3D prête ms"] = await ready("canvas.u1c"); await page.waitForTimeout(400);
out["P-Accueil rotation à la souris"] = await drag("canvas.u1c", 8, 2);
out["P-Accueil stats"] = await stage("canvas.u1c");

await page.goto(BASE + "E-Expert.dc.html", { waitUntil: "domcontentloaded" });
out["E-Expert 3D prête ms"] = await ready("canvas.u1c"); await page.waitForTimeout(400);
out["E-Expert rotation à la souris"] = await drag("canvas.u1c", -8, 1);
out["E-Expert stats"] = await stage("canvas.u1c");

// mémoire : 6 allers-retours sur une planche 3D, le tas JS doit rester stable (dispose correct)
const heap = [];
for (let i = 0; i < 6; i++) {
  await page.goto(BASE + "V-Expert.dc.html", { waitUntil: "domcontentloaded" }); await ready("canvas.u1c");
  await page.goto(BASE + "V-Accueil.dc.html", { waitUntil: "domcontentloaded" });
  heap.push(await page.evaluate(() => Math.round((performance.memory?.usedJSHeapSize || 0) / 1048576)));
}
out["tas JS après allers-retours (Mo)"] = heap;
out.erreurs = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
edge.kill();
