import type { Shot } from "../themes/renders";

/** Official action keys of the decoder table, shown inspection first, then action, then resume (the table gives no order: display only). */
const ORDER = ["check_path_obstruction", "check_cable", "check_dock", "unload_filament", "clean", "load_filament", "maintenance", "home_axes", "power_cycle",
  "update_firmware", "restore_factory_settings", "resume_from_screen", "retry", "reslice_with_orca", "export_logs", "contact_support", "see_article"];
/** Which part a gesture is about: the toolheads for hands-on gestures, the screen for what is done on it, nothing in particular otherwise. */
const SHOT: Partial<Record<string, Shot>> = {
  check_path_obstruction: "tetes", clean: "tetes", unload_filament: "tetes", load_filament: "tetes", check_dock: "tetes",
  resume_from_screen: "ecran", retry: "ecran", home_axes: "ecran", power_cycle: "ecran", update_firmware: "ecran", restore_factory_settings: "ecran", export_logs: "ecran",
};

export type Focus = "head1" | "head2" | "head3" | "head4" | "screen";
export interface Step { key: string; shot?: Shot; focus: Focus | null }

export function officialSteps(actions: readonly string[] | undefined, head: number | null): Step[] {
  return [...(actions ?? [])]
    .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
    .map((key) => {
      const shot = SHOT[key];
      const focus: Focus | null = shot === "ecran" ? "screen" : shot === "tetes" && head ? (`head${head}` as Focus) : null;
      return { key, shot, focus };
    });
}
