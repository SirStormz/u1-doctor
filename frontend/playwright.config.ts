import { defineConfig } from "@playwright/test";

// E2E smoke tests against a running backend that serves the built UI (replay/demo data only).
//   cd backend; set U1DOCTOR_PORT=8766; python -m app      (or the Docker image)
//   cd frontend; npm run build; npm run e2e
// E2E_BASE_URL overrides the target; E2E_BROWSER_CHANNEL=msedge|chrome uses an installed browser
// instead of the downloaded Chromium (`npx playwright install chromium`).
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  // Each page loads the 3D chunk; many parallel browsers on one small machine made `h1` appear after 5 s now and then.
  expect: { timeout: 10_000 },
  workers: 4,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:8766",
    channel: process.env.E2E_BROWSER_CHANNEL || undefined,
    viewport: { width: 1440, height: 900 },
  },
});
