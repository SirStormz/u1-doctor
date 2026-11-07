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
  // On the CI runner (2 shared cores) a random screen still missed the 10 s window about once in four runs, while the API answers in
  // milliseconds: it is load, not a bug. So on CI: fewer parallel browsers, a longer wait, one-off retries that keep a trace of the first
  // failure (uploaded by the workflow) so a real regression still fails after the retries and a flaky one leaves evidence.
  expect: { timeout: process.env.CI ? 20_000 : 10_000 },
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  reporter: "list",
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:8766",
    channel: process.env.E2E_BROWSER_CHANNEL || undefined,
    viewport: { width: 1440, height: 900 },
  },
});
