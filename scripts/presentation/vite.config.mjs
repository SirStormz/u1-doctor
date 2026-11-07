// Bundles scene.js (+ three.js, tree-shaken) into one IIFE. Used by scripts/build_presentation.py.
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

export default ({
  root: here,
  logLevel: "warn",
  resolve: { alias: { three: path.join(root, "frontend", "node_modules", "three", "build", "three.module.js") } },
  build: {
    outDir: path.join(root, "build", "presentation-scene"),
    emptyOutDir: true,
    minify: true,
    lib: { entry: path.join(here, "scene.js"), name: "U1Scene", formats: ["iife"], fileName: () => "scene.iife.js" },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
