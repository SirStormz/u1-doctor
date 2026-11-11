// Regenerates the README screenshots (docs/media/screens/*.png, 1440 x 900, Expert mode, demo on, English), in the
// default theme unless another theme id is given.
//   backend serving the built UI on 127.0.0.1:8766, then:  node scripts/capture-screens.mjs [theme]
// E2E_BROWSER_CHANNEL=msedge|chrome uses an installed browser, as for the e2e tests.
import { chromium } from "@playwright/test";
import path from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8766";
const OUT = process.env.E2E_OUT ?? path.resolve(import.meta.dirname, "../../docs/media/screens");
const THEME = process.argv[2] ?? "obsidienne";
const SCREENS = [
  ["01-welcome", "welcome"], ["02-connect", "connect"], ["03-overview", "overview"], ["04-error-codes", "explorer"],
  ["05-print-quality", "symptoms"], ["06-timeline", "timeline"], ["07-findings", "findings"], ["08-evidence", "evidence"],
  ["09-replay", "replay"], ["10-report", "report"], ["11-settings", "settings"],
];

const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript((t) => {
  localStorage.setItem("u1d.onboarded", "1"); localStorage.setItem("u1d.theme", t); localStorage.setItem("u1d.lang", "en");
  localStorage.setItem("u1d.mode", "expert"); localStorage.setItem("u1d.hints", '["marks","timeline","palette"]'); localStorage.setItem("u1d.checklistHidden", "1");
}, THEME);
await page.goto(`${BASE}/#/overview`);
await page.getByRole("button", { name: "Demo mode" }).click();
for (const [file, route] of SCREENS) {
  await page.evaluate((r) => { location.hash = `#/${r}`; }, route);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await page.waitForTimeout(route === "overview" ? 5000 : 1500); // entrance motion, 3D model
  await page.screenshot({ path: path.join(OUT, `${file}.png`) });
  console.log(file);
}
await browser.close();
