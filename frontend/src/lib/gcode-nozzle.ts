/** Nozzle diameters of the last G-code analysed in this tab (pre-flight), handed to the live capture for rule S20.
 *  Session storage only: diameters, never the file name. Every access is guarded (private mode, blocked storage). */
const KEY = "u1d.gcodeNozzle";

export function saveGcodeNozzle(mm: number[] | null): void {
  try {
    if (mm && mm.length) sessionStorage.setItem(KEY, JSON.stringify(mm));
    else sessionStorage.removeItem(KEY);
  } catch { /* storage unavailable: the comparison is simply skipped */ }
}

export function loadGcodeNozzle(): number[] | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as unknown;
    return Array.isArray(v) && v.length > 0 && v.length <= 16 && v.every((x) => typeof x === "number" && x >= 0.05 && x <= 2) ? (v as number[]) : null;
  } catch { return null; }
}

/** distinct diameters declared by a pre-flight result (`nozzle_diameters` check), or null */
export function nozzleFromPreflight(checks: { id: string; params?: Record<string, unknown> }[]): number[] | null {
  const c = checks.find((x) => x.id === "nozzle_diameters");
  const p = c?.params ?? {};
  if (Array.isArray(p.diameters)) return (p.diameters as unknown[]).filter((x): x is number => typeof x === "number");
  if (typeof p.diameter === "number") return [p.diameter];
  return null;
}
