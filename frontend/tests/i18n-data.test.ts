import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { tx } from "../src/lib/dyn";

/** Every English string the backend can send must have a French form (display layer only: the backend stays English, it is hashed). */
const ROOT = path.resolve(__dirname, "../..");
const FIX = path.join(ROOT, "fixtures/synthetic");
const strings = new Set<string>();
const add = (s: unknown) => { if (typeof s === "string" && s.trim()) strings.add(s.replace(/^SYNTHETIC: /, "")); };

for (const f of fs.readdirSync(FIX).filter((n) => n.endsWith(".findings.json"))) {
  const list = JSON.parse(fs.readFileSync(path.join(FIX, f), "utf8")) as Record<string, unknown>[];
  for (const x of list) {
    add(x.human_title);
    for (const e of [...((x.evidence_for as { note: string }[]) ?? []), ...((x.evidence_against as { note: string }[]) ?? [])]) add(e.note);
    for (const k of ["missing_data", "safe_actions", "limits"]) for (const v of (x[k] as string[]) ?? []) add(v);
    for (const h of (x.hypotheses as { text: string }[]) ?? []) add(h.text);
  }
}
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge/u1_codes.json"), "utf8")) as { entries: { title: string; summary: string; fw_notes?: { text: string }[] }[] };
for (const e of cat.entries) { add(e.title); add(e.summary); for (const n of e.fw_notes ?? []) add(n.text); }
[
  "The displayed code may not represent the actual fault source (official wiki note).", "Code declared by the user; not verified from the machine.",
  "code must be ASCII text like dddd-dddd-dddd-dddd", "code must match dddd-dddd-dddd-dddd (digits only, no spaces)",
  "Moonraker HTTP :7125", "Objects list", "Objects query", "WebSocket subscribe", "Live error codes", "Toolhead 1-4 mapping", "Official firmware version", "Offline code decoder", "Deterministic replay", "Log partition usage read", "Cavity sensor and bed mesh subscription", "Live rules S22-S24", "Live rules S17-S21", "Connectivity self-check", "Job history totals read", "Maintenance reminders",
  "Toolhead 3 · nozzle", "Bed", "Print state",
].forEach(add);

test("all backend strings are translated to French", () => {
  expect(strings.size).toBeGreaterThan(50);
  const missing = [...strings].filter((s) => tx("fr", s) === s && s !== "Moonraker HTTP :7125");
  expect(missing).toEqual([]);
});

test("English display is untouched", () => {
  for (const s of strings) expect(tx("en", s)).toBe(s);
});

test("parametrised titles keep their values", () => {
  expect(tx("fr", "SYNTHETIC: Print state changed: printing -> paused")).toBe("SYNTHÉTIQUE : L'état de l'impression est passé de « impression » à « pause »");
  expect(tx("fr", "Code reported: Toolhead 1 MCU connection interrupted (error, motion control)")).toBe("Code déclaré : Connexion MCU de la tête 1 interrompue (erreur, contrôle du mouvement)");
});
