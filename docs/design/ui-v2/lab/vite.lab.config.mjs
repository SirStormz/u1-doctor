// Assemble la scène 3D partagée en un seul module ES (three inclus) pour les planches et le canevas.
//   npx --prefix frontend vite build --config docs/design/ui-v2/lab/vite.lab.config.mjs
// Sortie : docs/design/ui-v2/lab/dist/u1stage.bundle.js (non versionnée, dist/ est ignoré).
import { fileURLToPath } from "node:url";


const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default ({
  root: here("../../../../frontend"),
  logLevel: "warn",
  publicDir: false,
  resolve: { alias: { three: here("../../../../frontend/node_modules/three") } },
  build: {
    outDir: here("./dist"),
    emptyOutDir: true,
    target: "es2020",
    minify: true,
    lib: { entry: here("./u1stage.js"), formats: ["es"], fileName: () => "u1stage.bundle.js" },
  },
});
