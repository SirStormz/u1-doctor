/** Display text of G-code pre-flight checks. English comes from the backend; French is built here from the check id, status and params. */
import type { Lang } from "./i18n";

export interface PfCheck {
  id: string; status: "FAIL" | "WARN" | "PASS" | "INFO" | "UNKNOWN"; title: string; detail: string;
  evidence: { lines: number[]; count: number }; code: string | null; code_title: string | null;
  reference: { title: string; url: string }; params: Record<string, unknown>;
}

const list = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v ?? ""));

/** [title, detail] in French for a given id:status[:variant] */
const FR: Record<string, (p: Record<string, unknown>) => [string, string]> = {
  "decimal_comma:FAIL": (p) => ["Virgules décimales dans les commandes de mouvement ou de température",
    "Les nombres utilisent la virgule comme séparateur décimal, que l'imprimante ne sait pas lire. " + (p.old_orca ? "L'en-tête indique un Orca antérieur à la 2.1.2, la cause documentée." : "Le wiki l'attribue à Snapmaker Orca antérieur à la 2.1.2 avec l'interface en allemand ou en français.") + " Réexportez avec un Snapmaker Orca récent."],
  "decimal_comma:PASS": () => ["Aucune virgule décimale dans les commandes de mouvement ou de température", "Aucun nombre à virgule décimale trouvé."],
  "m28_m30:FAIL": () => ["Commandes M28, M29 ou M30 non prises en charge", "La table officielle indique que ces commandes ne sont pas prises en charge et doivent être retirées."],
  "m28_m30:PASS": () => ["Pas de M28, M29 ni M30", "Aucune des commandes non prises en charge n'est présente."],
  "unknown_toolhead:FAIL": (p) => ["Le G-code sélectionne une tête que l'imprimante n'a pas", `Numéros d'outil [${list(p.tools)}] utilisés ; la U1 a quatre têtes (T0 à T3).`],
  "unknown_toolhead:PASS": (p) => (Array.isArray(p.tools) && p.tools.length ? ["Seuls T0 à T3 sont sélectionnés", `Outils utilisés : [${list(p.tools)}].`] : ["Aucune sélection d'outil trouvée", "Aucune commande Tn ; fichier mono-outil ou sélection par macro."]),
  "nozzle_temp_range:FAIL": () => ["Consigne de buse au-dessus de 300 °C", "Le wiki donne 300 °C comme maximum réglable ; le firmware refuse les consignes plus élevées."],
  "nozzle_temp_range:PASS": () => ["Aucune consigne de buse au-dessus de 300 °C", "Toutes les consignes de buse vues respectent le maximum documenté."],
  "bed_temp_range:FAIL": () => ["Consigne de plateau au-dessus de 110 °C", "Au-dessus de la plage valide documentée pour le plateau chauffant."],
  "bed_temp_range:WARN": () => ["Consigne de plateau au-dessus de 100 °C", "Les guides du wiki citent 100 °C comme maximum usuel (et 80 °C pour la plaque texturée) : vérifiez votre plaque."],
  "bed_temp_range:PASS": () => ["Consignes de plateau dans les limites documentées", "Aucune consigne de plateau au-dessus de 100 °C."],
  "bed_zero:WARN": () => ["Température du plateau à 0 avant l'impression", "Le firmware 1.2.0 a ajouté un rappel pour ce cas, qui peut faire échouer la première couche."],
  "bed_zero:PASS": () => ["Pas de température de plateau à 0 avant l'impression", "Aucun M140/M190 S0 avant la première extrusion."],
  "homing_first:UNKNOWN": () => ["Mouvement avant tout G28 visible", "Une macro s'exécute avant le premier mouvement et peut mettre les axes à l'origine ; ce contrôle statique ne voit pas dans les macros."],
  "homing_first:WARN": () => ["Mouvement avant la mise à l'origine", "Le premier mouvement précède tout G28 ; l'imprimante refuse les mouvements tant qu'elle n'est pas à l'origine."],
  "homing_first:PASS": () => ["La mise à l'origine précède le premier mouvement", "G28 apparaît avant le premier mouvement."],
  "homing_first:INFO": () => ["Aucune commande de mouvement trouvée", "Rien à vérifier."],
  "nozzle_diameters:WARN:mixed": (p) => ["Diamètres de buse mélangés dans un même travail", `La configuration du trancheur liste les diamètres [${list(p.diameters)}] ; le wiki indique que mélanger les diamètres n'est pas pris en charge et qu'un écart avec la buse installée bloque l'impression.`],
  "nozzle_diameters:WARN:unsupported": (p) => ["Diamètre de buse non pris en charge", `Le diamètre ${String(p.diameter)} mm n'est pas 0,2, 0,4, 0,6 ni 0,8 mm.`],
  "nozzle_diameters:INFO:declared": (p) => [`Diamètre de buse déclaré : ${String(p.diameter)} mm`, "Comparez avec Réglages > Maintenance > Infos tête sur l'imprimante : cet outil ne voit pas la buse installée."],
  "nozzle_diameters:UNKNOWN": () => ["Diamètre de buse introuvable", "Aucune entrée nozzle_diameter dans le bloc de configuration du trancheur."],
  "filename_hash:WARN": () => ["Le nom du fichier commence par #", "Avant le firmware 2.0.0, de tels noms pouvaient arrêter le système anormalement ; renommez le fichier par précaution."],
  "filename_hash:PASS": () => ["Le nom du fichier ne commence pas par #", "Aucun problème."],
  "filename_hash:UNKNOWN": () => ["Nom du fichier non fourni", "Indiquez le nom pour vérifier la note du firmware 2.0.0."],
  "slicer:INFO:orca": (p) => [`Tranché avec ${String(p.name)} ${String(p.version)}`, "La sortie de Snapmaker Orca est celle que recommande la table officielle pour les erreurs de G-code liées à l'extrusion."],
  "slicer:INFO:other": (p) => [`Tranché avec ${String(p.name)} ${String(p.version)}`, "Le wiki recommande le G-code exporté par Snapmaker Orca lorsque des erreurs d'extrusion pointent vers le fichier."],
  "slicer:UNKNOWN": () => ["Trancheur non identifié", "Pas d'en-tête « generated by » dans les 200 premières lignes."],
};

export function pfKey(c: PfCheck): string {
  const v = c.params.v as string | undefined;
  if (c.id === "slicer" && c.status === "INFO") return `slicer:INFO:${c.params.orca ? "orca" : "other"}`;
  return v ? `${c.id}:${c.status}:${v}` : `${c.id}:${c.status}`;
}

export function pfView(lang: Lang, c: PfCheck): { title: string; detail: string } {
  if (lang === "en") return { title: c.title, detail: c.detail };
  const f = FR[pfKey(c)];
  if (!f) return { title: c.title, detail: c.detail };
  const [title, detail] = f(c.params);
  return { title, detail };
}

const LIMITS_FR: Record<string, string> = {
  "Static text checks, not a simulation: U1 Dry Run simulates the firmware.": "Contrôles statiques du texte, pas une simulation : U1 Dry Run simule le firmware.",
  "Macros can hide commands; the installed nozzle, plate and firmware version are unknown here.": "Les macros peuvent masquer des commandes ; la buse installée, la plaque et la version du firmware sont inconnues ici.",
  "Thresholds come from the official wiki and release notes; the wiki pages do not always agree.": "Les seuils viennent du wiki officiel et des notes de version ; les pages du wiki ne sont pas toujours d'accord.",
};
export const pfLimit = (lang: Lang, s: string) => (lang === "fr" ? LIMITS_FR[s] ?? s : s);

/** keys the backend can produce, for the exhaustiveness test */
export const PF_FR_KEYS = Object.keys(FR);
