/** French forms of the support checklist and the copyable request text. English comes from the backend. */
import type { Lang } from "./i18n";

export interface SupportItem { id: string; text: string; source: "wiki" | "suggested" }
export interface SupportOut {
  code: string; status: string; title: string | null; firmware: string | null; items: SupportItem[];
  article: { title: string; url: string } | null; ticket: { title: string; url: string }; notes: string[];
}

const FR: Record<string, string> = {
  error_code: "Le code d'erreur exact affiché sur l'écran de l'imprimante.",
  video_error: "Une vidéo montrant l'erreur.",
  logs: "Les fichiers de journal exportés de la machine (ils sont chiffrés : seul le support peut les lire).",
  gcode_file: "Le fichier G-code utilisé quand le problème est survenu.",
  serial_number: "Le numéro de série (SN) de l'imprimante, dans Réglages > À propos.",
  photo_runout_cable: "Une photo du câble cassé du capteur de fin de filament.",
  order_number: "Votre numéro de commande (site officiel : commence par SM ; distributeur : son nom et votre numéro ; boutique : le numéro de commande de la boutique).",
  photos_per_toolhead: "Des photos de chaque tête, nommées par numéro de tête.",
  error_count: "Le message de compteur d'erreurs affiché en touchant le code après l'exécution du G-code de test.",
  swap_video: "La vidéo demandée par le guide de changement de tête de première installation (firmware 0.9.4 ou plus récent requis).",
  troubleshooting_results: "Vos résultats de dépannage, avec des photos ou des vidéos.",
  firmware_version: "Votre version du firmware (Réglages > À propos), pour comparer avec les notes de version.",
  u1_deb: "Facultatif : un bundle de preuves U1-DEB comme complément lisible ; le support lit ses propres journaux chiffrés.",
};
const NOTES_FR: Record<string, string> = {
  "Serial numbers, order numbers and logs are for official support only: do not post them publicly.": "Numéros de série, de commande et journaux sont réservés au support officiel : ne les publiez pas.",
  "Only the code's linked official article was used to decide what is asked; codes without one get the general items.": "Seul l'article officiel lié au code sert à décider ce qui est demandé ; les codes sans article reçoivent les éléments généraux.",
};

export const supText = (lang: Lang, it: SupportItem) => (lang === "fr" ? FR[it.id] ?? it.text : it.text);
export const supNote = (lang: Lang, n: string) => (lang === "fr" ? NOTES_FR[n] ?? n : n);
export const SUPPORT_FR_IDS = Object.keys(FR);

/** plain text to paste into the official support form: code, firmware and the items the owner ticked */
export function buildRequest(lang: Lang, s: SupportOut, checked: Set<string>, title: string | null): string {
  const fr = lang === "fr";
  const lines = [`${fr ? "Code d'erreur" : "Error code"} : ${s.code}${title ? ` (${title})` : ""}`];
  if (s.firmware) lines.push(`Firmware : ${s.firmware}`);
  const have = s.items.filter((i) => checked.has(i.id) && i.id !== "error_code" && i.id !== "firmware_version");
  if (have.length) {
    lines.push(fr ? "Je joins :" : "I am attaching:");
    for (const i of have) lines.push(`- ${supText(lang, i)}`);
  }
  return lines.join("\n");
}
