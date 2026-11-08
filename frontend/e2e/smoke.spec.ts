import { expect, test } from "@playwright/test";

const ROUTES = ["welcome", "connect", "overview", "explorer", "symptoms", "timeline", "findings", "evidence", "replay", "report", "settings"];

// the first-run assistant is a modal: every test starts as a returning user, except the onboarding test below
test.beforeEach(async ({ page }) => { await page.addInitScript(() => { if (!sessionStorage.getItem("e2e-first-run")) localStorage.setItem("u1d.onboarded", "1"); }); });

test.describe("every screen, demo mode on, read-only", () => {
  for (const route of ROUTES) {
    test(`#/${route} renders with the safety banners and no network beyond the app`, async ({ page, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      const foreign: string[] = [];
      const errors: string[] = [];
      page.on("request", (r) => {
        if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== origin) foreign.push(r.url());
      });
      page.on("pageerror", (e) => errors.push(e.message));

      await page.goto(`/#/${route}`);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await page.getByRole("button", { name: /^(Demo mode|Mode démo)$/ }).click(); // the app starts empty: the demo is opt-in
      await expect(page.getByText("DEMO", { exact: false }).first()).toBeVisible();
      await expect(page.getByText(/0 commands sent to printer|0 commande envoyée à l'imprimante/)).toBeVisible();

      expect(foreign, "no request may leave the local app").toEqual([]);
      expect(errors, "no uncaught page error").toEqual([]);
    });
  }
});

test("language switch changes the document language", async ({ page }) => {
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "FR", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("connect screen stays locked until the owner ticks the approval box", async ({ page }) => {
  await page.goto("/#/connect");
  const run = page.getByRole("button", { name: /^(capture|capturer).*(read-only|lecture seule)/i });
  await expect(run).toBeDisabled();
  await page.getByLabel(/printer address|adresse de l'imprimante/i).fill("192.168.1.2");
  await expect(run).toBeDisabled();
  await page.getByRole("checkbox", { name: /I own this printer|Cette imprimante est la mienne/i }).check();
  await expect(run).toBeEnabled();
});

test("timeline offers demo, real capture and history sources", async ({ page }) => {
  await page.goto("/#/timeline");
  for (const name of [/Synthetic demo|Démo synthétique/i, /Real capture|Capture réelle/i, /History|Historique/i]) {
    await expect(page.getByRole("button", { name }).first()).toBeVisible();
  }
});

test("the app starts empty and says so; demo mode is an explicit switch", async ({ page }) => {
  await page.goto("/#/overview");
  await expect(page.getByText(/No data loaded|Aucune donnée chargée/)).toBeVisible();
  await expect(page.getByText(/No data yet|Aucune donnée pour l'instant/).first()).toBeVisible();
  await expect(page.getByText("DEMO", { exact: true })).toHaveCount(0);
  const toggle = page.getByRole("button", { name: /^(Demo mode|Mode démo)$/ });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("DEMO", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/synthetic data · not from a printer|données synthétiques/).first()).toBeVisible();
});

test("first run: the assistant guides in three steps, can be skipped, and the list can hide", async ({ page }) => {
  await page.addInitScript(() => { sessionStorage.setItem("e2e-first-run", "1"); localStorage.removeItem("u1d.onboarded"); });
  await page.goto("/#/overview");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Step 1 of 3|Étape 1 sur 3/)).toBeVisible();
  await dialog.getByRole("button", { name: /^(Next|Suivant)$/ }).click();
  await expect(dialog.getByText(/Step 2 of 3|Étape 2 sur 3/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const list = page.getByRole("region", { name: /Getting started|Premiers pas/ });
  await expect(list).toBeVisible();
  await list.getByRole("button", { name: /Hide this list|Masquer cette liste/ }).click();
  await expect(list).toHaveCount(0);
});
