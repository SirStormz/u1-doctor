import type { ThemeId } from "../themes/registry";

/**
 * How the 3D U1 is lit or drawn in each UI V2 theme (values from the audited mockups, docs/design/ui-v2/lab/u1stage.js).
 * Shaded looks keep the model's own PBR materials and only change light, environment and exposure; Notice draws the
 * machine like its line renders: flat fills from the material palette and black edges.
 */
export interface Look {
  exposure: number;
  env: number;
  /** key, rim, back rim: [hex colour, intensity] */
  lights: [[string, number], [string, number], [string, number]];
  shadow: number;
  /** turntable ring colour; null = the theme's ink */
  ring: string | null;
  flat: boolean;
}

export const LOOKS: Record<ThemeId, Look> = {
  obsidienne: { exposure: 1.05, env: 0.85, lights: [["#ffffff", 2.2], ["#dce6ff", 1.5], ["#ffe7a3", 1.1]], shadow: 0.3, ring: null, flat: false },
  pupitre: { exposure: 1.08, env: 1.0, lights: [["#fff4e6", 2.3], ["#ffe9d2", 1.2], ["#ffffff", 1.0]], shadow: 0.25, ring: null, flat: false },
  visiere: { exposure: 0.95, env: 0.35, lights: [["#ffdba8", 2.4], ["#ff3b2f", 1.6], ["#ffcc99", 0.4]], shadow: 0.45, ring: "#ffb547", flat: false },
  notice: { exposure: 1.0, env: 0, lights: [["#ffffff", 0], ["#ffffff", 0], ["#ffffff", 0]], shadow: 0, ring: null, flat: true },
};

/** Notice palette: model material name -> flat fill (same as the Blender line render). */
export const NOTICE_FILL: Record<string, string> = {
  Ceramic_White_Powdercoat: "#ffffff", Graphite_Polymer: "#4a4f57", Smoked_Glass: "#5a6068", Anodized_Aluminium: "#d9dce0",
  Brushed_Stainless: "#cfd3d8", Rubber: "#3a3d42", Harness_Black_Rubber: "#3a3d42", PTFE_Black_Clips: "#3a3d42",
  PTFE_Natural_Translucent: "#f2f0ec", PTFE_Fitting_Nickel: "#c9ccd1", Reel_Kraft: "#e2d2b8", Filament_Orange: "#f2a65a",
  Filament_Green: "#9cc98a", Filament_Purple: "#c49ae0", Filament_Red: "#f07c7c", Nozzle_Brass: "#d8b26a",
  Timing_Belt: "#3a3d42", Textured_PEI: "#6b6f75", Chamber_LED: "#ffffff",
};
