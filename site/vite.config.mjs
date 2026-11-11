// Builds the public site into ../docs (GitHub Pages serves main:/docs). emptyOutDir stays false: docs/ also holds the
// project documentation and docs/sample-report/, which this build must not touch.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = "/u1-doctor/";

// <!--@head--> <!--@nav--> <!--@foot--> in the pages are replaced by partials/<name>.html ({{base}} = the Pages base path)
const partials = () => ({
  name: "u1d-partials",
  transformIndexHtml: {
    order: "pre",
    handler: (html) =>
      html.replace(/<!--@(\w+)-->/g, (_, name) => readFileSync(path.join(here, "partials", `${name}.html`), "utf8").replaceAll("{{base}}", BASE)),
  },
});

// Release facts and the changelog are written into the HTML at build time: the version, size and checksum on the page can
// never drift from data/release.json, and the history is real HTML (no layout jump, readable without JavaScript).
const readJson = (p) => JSON.parse(readFileSync(path.join(here, "src", "data", p), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const timelineHtml = (items, level) => {
  const fmt = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "numeric" });
  return items.map((r) => `<li><div class="ver">${esc(r.v)}<small>${fmt.format(new Date(r.date))}</small></div><${level}>${esc(r.en.title)}</${level}><p>${esc(r.en.body)}</p></li>`).join("");
};
const releaseData = () => ({
  name: "u1d-release-data",
  transformIndexHtml: {
    order: "pre",
    handler(html) {
      const rel = readJson("release.json"), log = readJson("changelog.json");
      if (log[0].v !== rel.version) throw new Error(`release.json (${rel.version}) and changelog.json (${log[0].v}) disagree`);
      return html
        .replace(/(<ol class="timeline" id="tl-home">)(<\/ol>)/, (_, a, b) => a + timelineHtml(log.slice(0, 3), "h3") + b)
        .replace(/(<ol class="timeline" id="tl-full">)(<\/ol>)/, (_, a, b) => a + timelineHtml(log, "h2") + b)
        .replaceAll("{{version}}", rel.version).replaceAll("{{zip}}", rel.zip).replaceAll("{{size}}", rel.size)
        .replaceAll("{{sha256}}", rel.sha256).replaceAll("{{vtScore}}", rel.vtScore).replaceAll("{{vtUrl}}", rel.vtUrl).replaceAll("{{relDate}}", rel.date);
    },
  },
});

// Preload the two fonts the default theme (A) draws above the fold, so the headline does not swap fonts after first paint
const preloadFonts = () => ({
  name: "u1d-preload-fonts",
  transformIndexHtml: {
    order: "post",
    handler(html, ctx) {
      const files = Object.keys(ctx.bundle ?? {}).filter((f) => /^assets\/(oxanium|saira)-latin-wght-normal-.*\.woff2$/.test(f));
      const tags = files.map((f) => ({ tag: "link", attrs: { rel: "preload", as: "font", type: "font/woff2", href: BASE + f, crossorigin: "" }, injectTo: "head" }));
      return { html, tags };
    },
  },
});

export default {
  plugins: [partials(), releaseData(), preloadFonts()],
  root: here,
  base: BASE,
  publicDir: path.join(here, "public"),
  server: { fs: { allow: [path.join(here, "..")] } },
  build: {
    outDir: path.join(here, "..", "docs"),
    emptyOutDir: false,
    assetsInlineLimit: 0,
    target: "es2022",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        index: path.join(here, "index.html"),
        changelog: path.join(here, "changelog", "index.html"),
        aider: path.join(here, "aider", "index.html"),
      },
    },
  },
};
