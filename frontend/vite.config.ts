/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Libraries that change rarely get their own cached chunks. Narrow tests on purpose: a bare /node_modules/ group would pull three.js
  // (lazy, loaded with the 3D view only) into the start-up bundle.
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
            { name: "motion", test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  server: { host: "127.0.0.1", port: 5173, proxy: { "/api": "http://127.0.0.1:8765" } },
  test: { environment: "jsdom", globals: true, setupFiles: ["./tests/setup.ts"], exclude: ["e2e/**", "node_modules/**"] },
});
