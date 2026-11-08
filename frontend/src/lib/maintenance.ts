/** Local maintenance reminders (BACKLOG #65, UNTESTED on a real U1).
 *
 *  Tasks live in this window's browser storage only (localStorage, kept across restarts by the desktop app's storage
 *  folder; every access guarded: private mode or blocked storage simply keeps them in memory). Nothing is sent to the
 *  printer or anywhere else. The computation is pure and deterministic: a unit is due when
 *  (current total - baseline) >= interval. Remaining amounts are plain differences, never a prediction or a score. */

export type Unit = "print_hours" | "jobs" | "tool_changes";
export const UNITS: Unit[] = ["print_hours", "jobs", "tool_changes"];
export type Amounts = Partial<Record<Unit, number>>;

/** Inputs sent by the live capture (`maintenance_inputs`); null = not observable in that capture. */
export interface MaintenanceInputs {
  history_totals: { total_jobs: number; total_print_time: number; total_filament_used: number; total_time: number } | null;
  history_status: number | null;
  switch_count: { per_object: Record<string, number>; total: number } | null;
}

/** What the last capture observed, in reminder units (null = not observable). Stored with its capture time. */
export interface Current { print_hours: number | null; jobs: number | null; tool_changes: number | null; filament_m: number | null; captured_utc: string }

export interface Task { id: string; name: string; preset: string | null; every: Amounts; baseline: Amounts }

export interface Preset { id: string; name: { en: string; fr: string }; every: Amounts; note: { en: string; fr: string }; source: { url: string; title: string; checked: string } }

/** ONLY intervals stated on official Snapmaker wiki pages, each with its page and the date it was read. Calendar intervals
 *  of the same pages (monthly, quarterly, every 4-6 months) are not presets: they are not usage counts and are not converted. */
export const PRESETS: Preset[] = [
  {
    id: "pei_wash", every: { jobs: 5 },
    name: { en: "Wash the PEI sheet (dish soap)", fr: "Laver la plaque PEI (liquide vaisselle)" },
    note: { en: "Official interval: every 5 to 10 prints. The preset uses 5; change it if you like. Jobs are counted by the printer's job history, cancelled ones included.",
            fr: "Intervalle officiel : toutes les 5 à 10 impressions. Le préréglage prend 5 ; modifiez-le à votre guise. Les travaux sont comptés par l'historique de l'imprimante, travaux annulés compris." },
    source: { url: "https://wiki.snapmaker.com/en/snapmaker_u1/PEI_steel_sheet_cleaning", title: "PEI steel sheet cleaning", checked: "2026-11-08" },
  },
  {
    id: "pogo_clean", every: { tool_changes: 100000 },
    name: { en: "Clean the pogo-pin gold contacts", fr: "Nettoyer les contacts dorés des broches pogo" },
    note: { en: "Official: the U1 counts swaps itself and reminds you every 100,000 swaps. Here the tool-change number is the sum of the switch_count counters of the extruder objects; what they count is not documented officially, so it may differ from the printer's own count.",
            fr: "Officiel : l'U1 compte lui-même les changements de tête et vous le rappelle tous les 100 000. Ici, le nombre de changements est la somme des compteurs switch_count des objets extrudeurs ; ce qu'ils comptent n'est pas documenté officiellement, il peut donc différer du compte de l'imprimante." },
    source: { url: "https://wiki.snapmaker.com/en/FAQ/u1", title: "U1 FAQ (pogo pins)", checked: "2026-11-08" },
  },
];

export const MAX_TASKS = 50;
const MAX_AMOUNT = 1e9;
const KEY_TASKS = "u1d.maint.tasks";
const KEY_CURRENT = "u1d.maint.current";

const num = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= MAX_AMOUNT;
const r1 = (x: number) => Math.round(x * 10) / 10;

/** Reminder units from one capture. Print hours = total_print_time / 3600; filament in metres (shown, no reminder unit). */
export function currentFrom(mi: MaintenanceInputs | null | undefined, capturedUtc: string): Current {
  const h = mi?.history_totals ?? null;
  return {
    print_hours: h && num(h.total_print_time) ? r1(h.total_print_time / 3600) : null,
    jobs: h && num(h.total_jobs) ? h.total_jobs : null,
    tool_changes: mi?.switch_count && num(mi.switch_count.total) ? mi.switch_count.total : null,
    filament_m: h && num(h.total_filament_used) ? r1(h.total_filament_used / 1000) : null,
    captured_utc: capturedUtc,
  };
}

export type UnitState = "due" | "not_due" | "not_observable" | "no_baseline" | "below_baseline";
export interface UnitStatus { unit: Unit; every: number; baseline: number | null; current: number | null; done: number | null; left: number | null; state: UnitState }

/** Pure: the same task and the same totals always give the same status. */
export function taskStatus(task: Task, cur: Current | null): { units: UnitStatus[]; due: boolean } {
  const units: UnitStatus[] = UNITS.filter((u) => num(task.every[u]) && task.every[u]! > 0).map((u) => {
    const every = task.every[u]!;
    const baseline = num(task.baseline[u]) ? task.baseline[u]! : null;
    const current = cur ? cur[u] : null;
    if (current === null) return { unit: u, every, baseline, current, done: null, left: null, state: "not_observable" };
    if (baseline === null) return { unit: u, every, baseline, current, done: null, left: null, state: "no_baseline" };
    const done = r1(current - baseline);
    if (done < 0) return { unit: u, every, baseline, current, done, left: null, state: "below_baseline" };
    return { unit: u, every, baseline, current, done, left: r1(Math.max(0, every - done)), state: done >= every ? "due" : "not_due" };
  });
  return { units, due: units.some((s) => s.state === "due") };
}

export function dueTasks(tasks: Task[], cur: Current | null): Task[] {
  return tasks.filter((t) => taskStatus(t, cur).due);
}

function cleanAmounts(v: unknown): Amounts {
  const out: Amounts = {};
  if (v && typeof v === "object") for (const u of UNITS) { const x = (v as Record<string, unknown>)[u]; if (num(x)) out[u] = x; }
  return out;
}

/** Bad stored values (not JSON, wrong shape, out of range) are dropped, never trusted. */
export function parseTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return [];
  const out: Task[] = [];
  for (const x of raw.slice(0, MAX_TASKS)) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== "string" || !/^[a-z0-9_-]{1,40}$/.test(o.id) || typeof o.name !== "string") continue;
    const name = o.name.trim().slice(0, 80);
    const every = cleanAmounts(o.every);
    if (!name || !UNITS.some((u) => (every[u] ?? 0) > 0)) continue;
    out.push({ id: o.id, name, preset: typeof o.preset === "string" && PRESETS.some((p) => p.id === o.preset) ? o.preset : null, every, baseline: cleanAmounts(o.baseline) });
  }
  return out;
}

export function loadTasks(): Task[] {
  try { return parseTasks(JSON.parse(localStorage.getItem(KEY_TASKS) ?? "[]")); } catch { return []; }
}
export function saveTasks(tasks: Task[]): void {
  try { localStorage.setItem(KEY_TASKS, JSON.stringify(tasks.slice(0, MAX_TASKS))); } catch { /* storage unavailable: the list stays in memory */ }
}

export function loadCurrent(): Current | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY_CURRENT) ?? "null") as Record<string, unknown> | null;
    if (!v || typeof v !== "object" || typeof v.captured_utc !== "string") return null;
    const pick = (k: string) => (num(v[k]) ? (v[k] as number) : null);
    return { print_hours: pick("print_hours"), jobs: pick("jobs"), tool_changes: pick("tool_changes"), filament_m: pick("filament_m"), captured_utc: v.captured_utc.slice(0, 32) };
  } catch { return null; }
}
export function saveCurrent(c: Current): void {
  try { localStorage.setItem(KEY_CURRENT, JSON.stringify(c)); } catch { /* storage unavailable */ }
}

/** "Done now": the baseline of every interval unit becomes the current total (units not observable keep their baseline). */
export function markDone(task: Task, cur: Current): Task {
  const baseline: Amounts = { ...task.baseline };
  for (const u of UNITS) if (task.every[u] && cur[u] !== null) baseline[u] = cur[u]!;
  return { ...task, baseline };
}

export function newId(tasks: Task[], seed: string): string {
  const base = seed.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "task";
  let id = base, k = 2;
  while (tasks.some((t) => t.id === id)) id = `${base}_${k++}`;
  return id;
}
