import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";

const CAT = {
  version: "0.1.0", checked_at: "2026-11-07", wiki_base: "https://wiki.snapmaker.com/en/", note: "n",
  materials: { PLA: { nozzle: [190, 230], bed: [55, 65] }, PETG: { nozzle: [230, 270], bed: [60, 80] } },
  fields: { numeric: { mesh_range: [0, 10], nozzle_temp: [-50, 500] }, choices: { plate: ["smooth_pei", "textured_pei", "other"] } },
  symptoms: [
    { id: "first-layer-gaps", page: "snapmaker_u1/troubleshooting/first_layer_printing_troubleshooting_guide", title: { en: "Wrinkles or gaps in the first layer", fr: "Plis ou trous dans la première couche" }, eyes: { en: "Look at the first layer.", fr: "Regardez la première couche." }, ask: ["mesh_range"], cause_count: 2 },
    { id: "gloss", page: "snapmaker_u1/u1_gloss", title: { en: "Gloss varies", fr: "Brillance variable" }, eyes: { en: "Look for patches.", fr: "Cherchez des zones." }, ask: [], cause_count: 1 },
  ],
};
const RESULT = (lean: "FOR" | "NONE") => ({
  symptom: { id: "first-layer-gaps", title: CAT.symptoms[0]!.title, eyes: CAT.symptoms[0]!.eyes, page: "p", url: "https://wiki.snapmaker.com/en/snapmaker_u1/p" },
  answers: {}, observed: { bed: null, nozzle: null }, catalog_checked_at: "2026-11-07", notes: [],
  causes: [
    { id: "fl-z-high", eyes: true, lean: "NONE", evidence: [], text: { en: "Z offset too high.", fr: "Décalage Z trop fort." } },
    { id: "fl-mesh", eyes: true, lean, text: { en: "Bed flatness.", fr: "Planéité du plateau." }, evidence: lean === "FOR" ? [{ direction: "for", source: "USER_REPORTED", text: { en: "Your mesh RANGE of 0.9 mm is above the wiki's 0.8 mm.", fr: "Votre RANGE de 0,9 mm dépasse les 0,8 mm du wiki." } }] : [] },
  ],
});

let evalBody: Record<string, unknown> | null = null;
beforeEach(() => {
  location.hash = "#/symptoms";
  evalBody = null;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/knowledge/symptoms")) return { ok: true, status: 200, json: async () => CAT };
    if (u.includes("/symptoms/evaluate")) {
      evalBody = JSON.parse(String(init?.body));
      const bad = (evalBody!.answers as Record<string, unknown>).mesh_range === 99;
      if (bad) return { ok: false, status: 422, json: async () => ({ detail: { code: "BAD_ANSWER", message: "mesh_range is outside 0 to 10" } }) };
      return { ok: true, status: 200, json: async () => RESULT(Object.keys(evalBody!.answers as object).length ? "FOR" : "NONE") };
    }
    if (u.includes("/api/v1/history")) return { ok: true, status: 200, json: async () => ({ sessions: [], totals: { sessions: 0, observations: 0 }, limits: { max_sessions: 1, max_observations: 1 } }) };
    return { ok: true, status: 200, json: async () => ({}) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("picking a symptom lists the wiki causes with 'needs your eyes' and no ranking", async () => {
  render(<App />);
  fireEvent.click(await screen.findByTestId("symptom-first-layer-gaps"));
  const list = await screen.findByTestId("symptom-causes");
  const items = list.querySelectorAll("li[data-lean]");
  expect(items.length).toBe(2);
  expect(items[0]!.textContent).toContain("Z offset too high.");
  expect(items[0]!.getAttribute("data-eyes")).toBe("true");
  expect(within(items[0] as HTMLElement).getByText("Needs your eyes")).toBeTruthy();
  expect(within(items[0] as HTMLElement).getByText("No data")).toBeTruthy();
  expect(screen.getByTestId("symptom-eyes").textContent).toBe("Look at the first layer.");
  expect(document.body.textContent).not.toMatch(/\d+ ?%|score:/i);
});

test("a typed number comes back as evidence labelled USER_REPORTED", async () => {
  render(<App />);
  fireEvent.click(await screen.findByTestId("symptom-first-layer-gaps"));
  fireEvent.change(await screen.findByLabelText(/Bed-mesh RANGE/), { target: { value: "0.9" } });
  fireEvent.click(screen.getByRole("button", { name: "Compare with the wiki" }));
  await waitFor(() => expect(screen.getByText(/above the wiki's 0.8 mm/)).toBeTruthy());
  expect(evalBody).toEqual({ symptom: "first-layer-gaps", answers: { mesh_range: 0.9 } });
  expect(screen.getByText("USER_REPORTED")).toBeTruthy();
  expect(screen.getByText("Data points to this")).toBeTruthy();
});

test("an eyes-only symptom asks for no number", async () => {
  render(<App />);
  fireEvent.click(await screen.findByTestId("symptom-gloss"));
  await screen.findByTestId("symptom-causes");
  expect(screen.getByText(/can only be judged by looking/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Compare with the wiki" })).toBeNull();
});

test("a refused number shows the reason and keeps the page usable", async () => {
  render(<App />);
  fireEvent.click(await screen.findByTestId("symptom-first-layer-gaps"));
  fireEvent.change(await screen.findByLabelText(/Bed-mesh RANGE/), { target: { value: "99" } });
  fireEvent.click(screen.getByRole("button", { name: "Compare with the wiki" }));
  expect((await screen.findByRole("alert")).textContent).toContain("mesh_range is outside 0 to 10");
});

test("French labels follow the language switch", async () => {
  localStorage.setItem("u1d.lang", "fr");
  render(<App />);
  expect(await screen.findByText("Plis ou trous dans la première couche")).toBeTruthy();
  localStorage.removeItem("u1d.lang");
});
