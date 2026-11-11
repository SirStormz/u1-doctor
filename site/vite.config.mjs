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
  plugins: [partials(), preloadFonts()],
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
