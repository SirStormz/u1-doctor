import fs from "node:fs";
import path from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";

/** Good-to-know notes: static, community-reported, sourced and dated; shown in the Known-issues area in EN and FR. */
const GK = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../knowledge/u1_good_to_know.json"), "utf8")) as { checked_at: string; notes: { id: string; title: { en: string; fr: string } }[] };
const ENGLISH = /\b(the|and|of|with|from|not|is|are|shown|camera|files|read-only|official|community|report|reported|owner|owners|staff|logs?|encrypted|advanced|scope|topic|posted)\b/i;
const ALLOWED = /(U1 Doctor|Snapmaker Orca|Snapmaker|Fluidd|printer\.cfg|firmware|Maintenance)/g;

beforeEach(() => {
  location.hash = "#/explorer";
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => (String(url).endsWith("/knowledge/good-to-know") ? GK : {}) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

const textOf = (el: HTMLElement) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const out: string[] = []; while (w.nextNode()) out.push(w.currentNode.textContent ?? ""); return out.join(" "); };

test("EN: the three notes carry the community label, their topics and the check date", async () => {
  localStorage.setItem("u1d.lang", "en");
  render(<App />);
  const list = await screen.findByTestId("good-to-know");
  const items = list.querySelectorAll("li[data-note]");
  expect([...items].map((li) => (li as HTMLElement).dataset.note)).toEqual(GK.notes.map((n) => n.id));
  for (const li of items) expect(within(li as HTMLElement).getByText("Community report, not official")).toBeTruthy();
  expect(screen.getByText(/Good to know \(reported by the community, not official\)/)).toBeTruthy();
  const hrefs = [...list.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  for (const id of ["40853", "43564", "42072", "41385", "40865"]) expect(hrefs).toContain(`https://forum.snapmaker.com/t/${id}`);
  expect(hrefs).toContain("https://wiki.snapmaker.com/en/snapmaker_u1/troubleshooting/U1_export_log");
  expect(screen.getByTestId("gk-checked").textContent).toBe(`Forum topics read on ${GK.checked_at}.`);
});

test("FR: the notes are in French, with no English words", async () => {
  localStorage.setItem("u1d.lang", "fr");
  render(<App />);
  const list = await screen.findByTestId("good-to-know");
  expect(within(list).getByText(GK.notes[0]!.title.fr)).toBeTruthy();
  expect(within(list).getAllByText("Signalement communautaire, non officiel")).toHaveLength(GK.notes.length);
  const panel = list.closest("section") ?? list;
  const words = textOf(panel as HTMLElement).replace(/https?:\S+/g, " ").replace(ALLOWED, " ");
  expect([...new Set(words.match(new RegExp(ENGLISH.source, "gi")) ?? [])]).toEqual([]);
});
