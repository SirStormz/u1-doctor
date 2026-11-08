/** Display text of G-code pre-flight checks. English comes from the backend; French is built here from the check id, status and params. */
import type { Lang } from "./i18n";

export interface PfCheck {
  id: string; status: "FAIL" | "WARN" | "PASS" | "INFO" | "UNKNOWN"; title: string; detail: string;
  evidence: { lines: number[]; count: number }; code: string | null; code_title: string | null;
  reference: { title: string; url: string }; params: Record<string, unknown>;
  /** present when the check rests on public forum reports (never official) */
  community?: { kind: "COMMUNITY_REPORT"; checked: string; sources: { url: string; title: string }[] };
}

const list = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v ?? ""));
const num = (v: unknown) => String(v ?? "?").replace(".", ",");
const nums = (v: unknown) => (Array.isArray(v) ? v.map((x) => (x == null ? "?" : num(x))).join(" ; ") : "?");
const AXIS_FR: Record<string, string> = { x_min: "X min", x_max: "X max", y_min: "Y min", y_max: "Y max" };
const reachFr = (v: unknown) => Object.entries((v ?? {}) as Record<string, number>).map(([k, x]) => `${AXIS_FR[k] ?? k} ${num(x)}`).join(", ");
const bedFr = (v: unknown) => { const b = Array.isArray(v) ? v.map(num) : ["?", "?", "?", "?"]; return `X ${b[0]} à ${b[1]}, Y ${b[2]} à ${b[3]} mm`; };
const MAP_FR = " L'association automatique des filaments (active par défaut depuis le firmware 1.0.0) peut faire imprimer le fichier sur d'autres têtes que ses numéros Tn : un propriétaire a vu un fichier de test des têtes passer T2, T1, T2, T3 au lieu de T0 à T3 jusqu'à la désactivation de l'association (Réglages > Préférences d'impression). Vérifiez l'association à l'écran avant de lancer.";
function foreignFr(p: Record<string, unknown>): string {
  const parts: string[] = [];
  if (Number(p.dwells) > 0) parts.push(`${String(p.dwells)} pause(s) de 5 s ou plus près des changements d'outil (la plus longue : ${num(p.dwell_max)} s)`);
  if (Array.isArray(p.commands) && p.commands.length) parts.push(`des commandes propres à Bambu Lab ${p.commands.join(", ")}`);
  if (p.model) parts.push(`un modèle d'imprimante « ${String(p.model)} » dans les réglages`);
  if (p.bambu) parts.push("un en-tête Bambu Studio");
  return parts.join(" ; ");
}

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
  // checks 11-20: community-reported facts (forum), never official
  "m191_chamber_wait:WARN": () => ["M191 (attente de la température de chambre) est utilisé",
    "Des propriétaires ont signalé en avril 2026 que la U1 n'attendait pas sur M191, commande que le firmware n'implémenterait pas ; ils suggéraient de chauffer le plateau avec M190 puis d'ajouter une pause (G4 S<secondes>) pour réchauffer la chambre. La note de version 2.0.0 mentionne une attente de chambre avec le capot supérieur : vérifiez le comportement de votre installation."],
  "m191_chamber_wait:PASS": () => ["Pas de M191", "Aucune commande d'attente de la chambre."],
  "start_line_y_edge:WARN": (p) => ["Mouvements à Y 1 mm ou moins",
    `${String(p.n)} mouvement(s) atteignent Y 1 mm ou moins. Chez un propriétaire (firmware 2.0.0 et 2.1.0), la ligne de départ d'origine G0 X85 Y1 s'arrêtait en erreur de course sur chaque tête dont le décalage en Y était inférieur à environ -1 mm, car le décalage pousse le mouvement sous Y0 ; déplacer la ligne à Y5 a réglé le problème. Les décalages usuels sont bien plus faibles : cela ne compte que si les impressions échouent dès le départ.`],
  "start_line_y_edge:PASS": () => ["Aucun mouvement à Y 1 mm ou moins", "Aucun mouvement près du bord avant du plateau."],
  "probe_temperature:INFO:lower": (p) => [`Consigne de buse ${num(p.probe)} °C avant l'impression, puis ${num(p.print)} °C`,
    "Une consigne plus basse avant la première extrusion correspond en général à la température de palpage du plateau. Des propriétaires ont signalé que le G-code de démarrage de Snapmaker Orca palpe à la température d'impression moins 90 °C (165 °C pour le PETG), ce qu'ils jugeaient chaud pour certaines plaques. Simple information : vérifiez la limite de votre plaque."],
  "probe_temperature:INFO:single": (p) => [`Consigne de buse ${num(p.print)} °C avant l'impression`, "Aucune consigne de palpage plus basse n'est visible ; une macro (par exemple START_PRINT) peut fixer la sienne."],
  "probe_temperature:UNKNOWN": () => ["Aucune consigne de buse avant la première extrusion", "Les températures de départ sont peut-être fixées dans une macro que ce contrôle statique ne lit pas."],
  "tool_mapping:WARN": (p) => ["Outils sélectionnés sans entrée de filament", `Les outils [${list(p.tools)}] sont sélectionnés mais le trancheur ne liste que ${String(p.filaments)} filament(s).` + MAP_FR],
  "tool_mapping:INFO": (p) => [`Ordre des outils dans le fichier : ${list(p.order)}${p.more ? "…" : ""}`, `${String(p.selections)} sélections d'outil sur ${Array.isArray(p.tools) ? p.tools.length : "?"} outils.` + MAP_FR],
  "tool_mapping:PASS": () => ["Un seul outil ou aucun : pas d'association entre têtes", "L'association automatique des filaments n'a rien à réordonner."],
  "foreign_profile:WARN": (p) => ["Signes d'un profil d'une autre imprimante", `Trouvé : ${foreignFr(p)}. Un propriétaire qui imprimait depuis Bambu Studio voyait des pauses de 7 à 9 s à chaque changement d'outil, disparues après un nouveau tranchage dans Snapmaker Orca. Retranchez avec un profil U1.`],
  "foreign_profile:PASS": () => ["Aucun signe d'un profil d'une autre imprimante", "Aucune longue pause près des changements d'outil ni de commande étrangère."],
  "prime_tower_bounds:WARN:outside": (p) => ["Tour d'amorçage hors de la zone du plateau",
    `La tour d'amorçage atteint ${reachFr(p.reach)}, hors de la zone du plateau lue dans le fichier (${bedFr(p.bed)}). Le personnel Snapmaker reliait les erreurs de dépassement de course de l'axe X du firmware 1.0.0 à la tour d'amorçage ; le contournement proposé était une autre forme de tour ou une tour déplacée dans la zone imprimable.`],
  "prime_tower_bounds:PASS:inside": (p) => ["Tour d'amorçage dans la zone du plateau", `Zone du plateau lue dans le fichier : ${bedFr(p.bed)}.`],
  "prime_tower_bounds:PASS:none": () => ["Pas de tour d'amorçage", "Aucune section ni aucun réglage de tour d'amorçage trouvé."],
  "colour_block:WARN": () => ["Pas de bloc de couleurs de filament dans un fichier multi-outil",
    "Le fichier sélectionne plusieurs outils mais ne contient aucune ligne extruder_colour ni filament_colour. L'association automatique des filaments et la page de détails du fichier utilisent les informations de filament du trancheur, et le signalement d'un propriétaire relie l'association à ces lignes. Vérifiez l'association à l'écran, ou exportez à nouveau depuis le trancheur."],
  "colour_block:PASS:declared": () => ["Couleurs de filament déclarées", "extruder_colour ou filament_colour est présent."],
  "colour_block:PASS:single": () => ["Un seul outil ou aucun : bloc de couleurs inutile", "Rien à associer."],
  "tpu_profile:INFO": (p) => ["TPU déclaré : vérifiez la rétraction et le débit",
    `Emplacement(s) de filament [${list(p.slots)}] : rétraction ${nums(p.retraction)} mm à ${nums(p.retraction_speed)} mm/s, débit volumique maximal ${nums(p.mvs)} mm³/s. Les propriétaires qui ont eu des bourrages de TPU sur la U1 mettaient en cause les longues rétractions (un TPU très souple bourrait encore à 2 mm ; 0 à 4 mm était conseillé) et le débit volumique (environ 3 mm³/s pour du 95A, moins pour plus souple) ; le personnel conseillait de desserrer la vis de l'extrudeur pour le TPU souple. Pas de verdict fixe : comparez avec les valeurs du fabricant de votre filament.`],
  "tpu_profile:UNKNOWN": () => ["TPU déclaré, ses réglages sont introuvables", "Aucune valeur de rétraction ni de débit volumique pour les emplacements TPU dans les commentaires du trancheur."],
  "tpu_profile:PASS": () => ["Aucun TPU déclaré", "Aucun filament_type ne mentionne le TPU."],
  "purge_summary:INFO:no_change": () => ["Aucun changement d'outil", "Rien n'est purgé pour des changements de couleur."],
  "purge_summary:INFO:derived": (p) => [`${String(p.changes)} changement(s) d'outil, ${num(Math.round(Number(p.mm)))} mm de filament purgé`,
    `${num(p.mm)} mm de filament extrudé dans ${String(p.blocks)} bloc(s) de changement d'outil de la tour${p.mm3 != null ? ` (environ ${num(p.mm3)} mm³, ${num(p.per_block)} mm³ par bloc)` : ""}. Mesuré sur les mouvements entre « ; CP TOOLCHANGE START » et « ; CP TOOLCHANGE END » ; les couches clairsemées de la tour et les purges dans le remplissage ou les objets ne sont pas comptées.`],
  "purge_summary:INFO:not_derivable": (p) => [`${String(p.changes)} changement(s) d'outil, purge non calculable`, "Aucun bloc de changement d'outil de la tour dans le fichier : le volume purgé ne peut pas en être lu. Rien n'est estimé."],
  "last_move_scar:INFO:low": (p) => [`Dernier déplacement à Z ${num(p.z)}, la hauteur de la dernière couche de la pièce`,
    `Après la dernière extrusion sur la pièce (Z ${num(p.part_z)}) et le dernier changement d'outil, le premier déplacement reste à cette hauteur : la buse peut frotter sur le dessus terminé. Des propriétaires ont signalé ce schéma avec Snapmaker Orca 2.4.1 (la 2.4.0 relevait d'abord la buse), et le personnel a annoncé une correction du trancheur. Vérifiez le dessus de votre impression, ou ajoutez une levée en Z.`],
  "last_move_scar:PASS:lifted": (p) => ["Le dernier déplacement passe au-dessus de la dernière couche", `Le premier déplacement après le dernier changement d'outil est à Z ${num(p.z)}, au-dessus de la dernière couche de la pièce (Z ${num(p.part_z)}).`],
  "last_move_scar:PASS:none": () => ["Aucun déplacement après un dernier changement d'outil", "Rien à vérifier."],
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
  "Checks marked as reported by the community come from public forum topics (checked 2026-11-08): they are not official.": "Les contrôles marqués comme signalés par la communauté viennent de sujets publics du forum (vérifiés le 2026-11-08) : ils ne sont pas officiels.",
  "Several checks read the slicer's comment lines; a file without them gives fewer results.": "Plusieurs contrôles lisent les lignes de commentaire du trancheur ; un fichier qui n'en a pas donne moins de résultats.",
};
export const pfLimit = (lang: Lang, s: string) => (lang === "fr" ? LIMITS_FR[s] ?? s : s);

/** keys the backend can produce, for the exhaustiveness test */
export const PF_FR_KEYS = Object.keys(FR);
