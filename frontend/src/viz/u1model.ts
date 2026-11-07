import type { Mesh, Object3D } from "three";

/** The owner's own model (U1_Jay_WEB.glb): metres, Y up, façade towards +Z. The scenes were laid out in ~mm, so the model is scaled by 100. */
export const MODEL_URL = "/models/u1-jay.glb";
export const MODEL_SCALE = 100;

export interface PartInfo {
  /** readable part name (node + material), for hover labels */
  name: string;
  /** 1-4 for PTFE_CHANNEL_n, else 0 */
  hot: number;
  group: "head1" | "head2" | "head3" | "head4" | "gantry" | "bed" | "screen" | "spools" | "door" | "body";
  glass: boolean;
  /** pure see-through or light parts that must not intercept pointer picks */
  unpickable: boolean;
}

/** Ancestor chain names, nearest first (the glTF nodes of the model: DOOR, BED_Z, GANTRY_Y, TOOLHEAD_X, TUBE_SYSTEM, PTFE_CHANNEL_n, REEL_*). */
const chain = (o: Object3D): string[] => {
  const out: string[] = [];
  for (let p: Object3D | null = o; p; p = p.parent) if (p.name) out.push(p.name);
  return out;
};

export function partInfo(mesh: Mesh): PartInfo {
  const names = chain(mesh);
  const own = mesh.name || "part";
  const has = (re: RegExp) => names.some((n) => re.test(n));
  const ch = names.map((n) => /^PTFE_CHANNEL_(\d)$/.exec(n)?.[1]).find(Boolean);
  const glass = /glass/i.test(own);
  let group: PartInfo["group"] = "body";
  if (ch) group = `head${ch}` as PartInfo["group"];
  else if (/^LCD_Display/i.test(own)) group = "screen";
  else if (glass || has(/^DOOR$/)) group = "door";
  else if (has(/^REEL_/)) group = "spools";
  else if (has(/^(GANTRY_Y|TOOLHEAD_X)$/)) group = "gantry";
  else if (has(/^BED_Z$/)) group = "bed";
  const readable = own.replace(/__/g, " · ").replace(/_/g, " ").replace(/\.\d+$/, "");
  return { name: readable, hot: ch ? Number(ch) : 0, group, glass, unpickable: glass || /^Chamber_Light/i.test(own) };
}
