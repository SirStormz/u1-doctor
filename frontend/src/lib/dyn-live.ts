/** French display forms of the live-rule findings S17-S24 (BACKLOG #57, UNTESTED). Display only: the backend text
 *  stays English (it is hashed). Object and field names (extruder1, heater_bed, switch_count...) are kept as they are. */
const EXACT: Record<string, string> = {
  "Whether a print actually failed on the start line, and which head started the print.": "Si une impression a vraiment échoué sur la ligne de départ, et quelle tête a commencé l'impression.",
  "Do not edit offsets by hand from this finding: run the official offset calibration, then contact Snapmaker support if the spread stays.": "Ne modifiez pas les décalages à la main à partir de ce constat : lancez la calibration officielle des décalages, puis contactez le support Snapmaker si l'écart reste.",
  "Values are keyed by the Klipper object name (extruder, extruder1...); which physical toolhead each one is stays unproven (H-04).": "Les valeurs sont rangées par nom d'objet Klipper (extruder, extruder1…) ; la tête physique correspondant à chacun reste non prouvée (H-04).",
  "UNTESTED: this rule has not been checked against a real U1 fault; it only restates the reported values.": "NON TESTÉ : cette règle n'a jamais été vérifiée sur une vraie panne d'U1 ; elle ne fait que reprendre les valeurs rapportées.",
  "One forum report: the stock start line G0 X85 Y1 failed with Move out of range on Y whenever the starting head had a Y offset below about -1.0 mm, on a printer whose Y offsets spread over 2.26 mm": "Un seul cas sur le forum : la ligne de départ d'origine G0 X85 Y1 échouait (déplacement hors limites sur Y) chaque fois que la tête de départ avait un décalage Y inférieur à environ -1,0 mm, sur une machine dont les décalages Y s'étalaient sur 2,26 mm",
  "Bed or cavity temperature reading is implausible": "La température du plateau ou de l'enceinte est invraisemblable",
  "Whether the printer showed an error code, and the Klipper log message (for example an ADC out-of-range shutdown).": "Si l'imprimante a affiché un code d'erreur, et le message du journal Klipper (par exemple un arrêt « ADC hors plage »).",
  "Power the printer off before touching any cable; follow the official procedure for any displayed code.": "Mettez l'imprimante hors tension avant de toucher un câble ; suivez la procédure officielle pour tout code affiché.",
  "If the code is 0003-0526-0000-0000, read the forum cause in the code decoder before replacing the bed.": "Si le code est 0003-0526-0000-0000, lisez la cause signalée sur le forum dans le décodeur de codes avant de remplacer le plateau.",
  "Identical readings can be a coincidence when both sensors sit at room temperature.": "Des valeurs identiques peuvent être une coïncidence quand les deux sondes sont à température ambiante.",
  "One resolved forum report: bed and chamber both read about -1035.8 degC (ADC out of range) and the cause was debris in a feeder ribbon-cable connector, not the bed": "Un seul cas résolu sur le forum : plateau et enceinte affichaient tous deux environ -1035,8 °C (ADC hors plage) et la cause était un débris dans un connecteur de nappe d'un module d'alimentation, pas le plateau",
  "Heater power over time, and whether the printer showed a heating error code.": "La puissance de chauffe au fil du temps, et si l'imprimante a affiché un code d'erreur de chauffe.",
  "A longer window: heating may start late.": "Une fenêtre plus longue : la chauffe peut démarrer tard.",
  "Watch the temperature on the printer screen; if it does not rise, follow the official heating troubleshooting page.": "Surveillez la température sur l'écran de l'imprimante ; si elle ne monte pas, suivez la page officielle de dépannage de la chauffe.",
  "The diameter configured in printer.cfg (not read: the whole configuration is outside the capture budget).": "Le diamètre configuré dans printer.cfg (non lu : la configuration entière dépasse le budget de la capture).",
  "Check the installed nozzles on the printer and the nozzle set in the slicer before printing this file.": "Vérifiez les buses montées sur l'imprimante et la buse réglée dans le trancheur avant d'imprimer ce fichier.",
  "The G-code value is the slicer setting found in the analysed file (IMPORTED), not a machine observation.": "La valeur du G-code est le réglage du trancheur trouvé dans le fichier analysé (IMPORTÉ), pas une observation de la machine.",
  "One forum report: Fluidd showed 0.4 mm for a head while 0.2 mm nozzles were set in the printer menu, and the nozzle later slipped during loading": "Un seul cas sur le forum : Fluidd affichait 0,4 mm pour une tête alors que des buses de 0,2 mm étaient réglées dans le menu de la machine, et la buse a ensuite glissé pendant le chargement",
  "Extruder objects report different nozzle diameters": "Les objets extrudeurs rapportent des diamètres de buse différents",
  "Compare with Settings > Maintenance > Toolhead Info on the printer and with the nozzles actually installed.": "Comparez avec Paramètres > Maintenance > Infos de la tête sur l'imprimante et avec les buses réellement montées.",
  "Different diameters can be intentional.": "Des diamètres différents peuvent être voulus.",
  "Whether the touchscreen is responsive, and the time of the last Klipper or firmware restart.": "Si l'écran tactile répond, et l'heure du dernier redémarrage de Klipper ou du firmware.",
  "If the touchscreen does not respond, control the print from Fluidd on the local network; power-cycle the printer fully once the print is over.": "Si l'écran tactile ne répond pas, pilotez l'impression depuis Fluidd sur le réseau local ; éteignez puis rallumez complètement l'imprimante une fois l'impression terminée.",
  "Host clock: the eventtime Klipper stamps on each update (host monotonic clock). Controller clock: toolhead.estimated_print_time (main MCU clock). It resets when the MCU restarts; a Klipper service restart without an MCU reset is not visible.": "Horloge de l'hôte : l'eventtime que Klipper appose sur chaque mise à jour (horloge monotone de l'hôte). Horloge du contrôleur : toolhead.estimated_print_time (horloge du MCU principal). Elle repart de zéro quand le MCU redémarre ; un redémarrage du service Klipper sans redémarrage du MCU n'est pas visible.",
  "One forum report on firmware 1.1.0: after Klipper was restarted without a full power cycle, the touchscreen went blank during the next print; a full power cycle cleared it": "Un seul cas sur le forum, firmware 1.1.0 : après un redémarrage de Klipper sans coupure complète de l'alimentation, l'écran tactile est resté noir pendant l'impression suivante ; une coupure complète a réglé le problème",
  "How fast the logs rotate on this printer, and whether the configuration lives on the same partition.": "À quelle vitesse les journaux tournent sur cette imprimante, et si la configuration est sur la même partition.",
  "Save the bundle now: export the system log from the touchscreen and a U1-DEB bundle before the logs rotate.": "Enregistrez le dossier maintenant : exportez le journal système depuis l'écran tactile et un dossier U1-DEB avant que les journaux ne tournent.",
  "Numbers as reported by Moonraker for the partition holding its `logs` root; no fill level is judged normal or not.": "Chiffres tels que Moonraker les donne pour la partition qui contient sa racine `logs` ; aucun taux de remplissage n'est jugé normal ou non.",
  "One forum report: logs and configuration share a 100 MB partition by default, logs rotate after one or two prints, and support gave no size limit": "Un seul cas sur le forum : journaux et configuration partagent par défaut une partition de 100 Mo, les journaux tournent après une ou deux impressions, et le support n'a donné aucune limite de taille",
  "Toolhead activity during the capture, per extruder object (counts, not ranked)": "Activité des têtes pendant la capture, par objet extrudeur (comptages, sans classement)",
  "What each counter means in the U1 firmware (not documented officially).": "Ce que signifie chaque compteur dans le firmware de l'U1 (non documenté officiellement).",
  "No action from counts alone; compare them with the printer screen if a toolhead misbehaves.": "Aucune action sur la seule base des comptages ; comparez-les avec l'écran de l'imprimante si une tête se comporte mal.",
  "Counters are the firmware's own totals; only their change during this window is an event of this capture.": "Les compteurs sont les totaux du firmware lui-même ; seule leur variation pendant cette fenêtre est un événement de cette capture.",
  "An official flatness tolerance for the U1 bed (none in U1 Doctor's sources).": "Une tolérance officielle de planéité du plateau de l'U1 (aucune dans les sources de U1 Doctor).",
  "No action from these numbers alone.": "Aucune action sur la seule base de ces chiffres.",
  "Statistics of the probed points only; U1 Doctor does not judge them normal or abnormal.": "Statistiques des points palpés uniquement ; U1 Doctor ne les juge ni normales ni anormales.",
  "No probed bed mesh in this capture": "Aucun maillage du plateau palpé dans cette capture",
  "The bed_mesh object reported no probed points.": "L'objet bed_mesh n'a rapporté aucun point palpé.",
  "A loaded bed-mesh profile.": "Un profil de maillage du plateau chargé.",
  "No action.": "Aucune action.",
  "Absence of a mesh says nothing about the bed.": "L'absence de maillage ne dit rien du plateau.",
  "No action: missing data says nothing about the printer.": "Aucune action : des données manquantes ne disent rien de l'imprimante.",
  "Absence of data is not evidence of absence.": "L'absence de données n'est pas une preuve d'absence.",
  // capability rows of the compatibility table
  "Log partition usage read": "Lecture de l'occupation de la partition des journaux",
  "Cavity sensor and bed mesh subscription": "Abonnement à la sonde de l'enceinte et au maillage du plateau",
  "Live rules S22-S24": "Règles en direct S22-S24",
  "Live rules S17-S21": "Règles en direct S17-S21",
  "Connectivity self-check": "Autodiagnostic de la connexion",
  "Job history totals read": "Lecture des totaux de l'historique des travaux",
  "Maintenance reminders": "Rappels d'entretien",
};

const LABEL: Record<string, string> = {
  "Toolhead offsets": "Décalages des têtes", "Bed and cavity temperatures": "Températures du plateau et de l'enceinte", "Heater temperatures": "Températures de chauffe",
  "Nozzle diameters": "Diamètres de buse", "Controller and host clocks": "Horloges du contrôleur et de l'hôte", "Log partition usage": "Occupation de la partition des journaux",
  "Toolhead activity counters": "Compteurs d'activité des têtes", "Bed mesh": "Maillage du plateau",
};

const n = (s: string) => s.replace(/(\d)\.(\d)/g, "$1,$2");

function sentence(s: string): string | null {
  let m: RegExpExecArray | null;
  if ((m = /^(.+?) read (-?[\d.]+) degC \(below (-?[\d.]+) degC\)\.$/.exec(s))) return `${m[1]} a indiqué ${n(m[2]!)} °C (sous ${n(m[3]!)} °C).`;
  if ((m = /^Bed and cavity sensors gave exactly the same value in all (\d+) paired readings\.$/.exec(s))) return `Les sondes du plateau et de l'enceinte ont donné exactement la même valeur dans les ${m[1]} relevés appariés.`;
  if ((m = /^(.+?): target (-?[\d.]+) degC, (-?[\d.]+) -> (-?[\d.]+) degC in ([\d.]+) s\.$/.exec(s))) return `${m[1]} : consigne ${n(m[2]!)} °C, ${n(m[3]!)} -> ${n(m[4]!)} °C en ${n(m[5]!)} s.`;
  if ((m = /^(\S+): (\d+) state changes(.*)\.$/.exec(s))) {
    const rest = m[3]!.replace(/, (\w+) (\d+) \(([+-]\d+)\)/g, ", $1 $2 ($3)");
    return `${m[1]} : ${m[2]} changements d'état${rest}.`;
  }
  if ((m = /^Homed-axes changes: (\d+)\.$/.exec(s))) return `Changements d'axes référencés : ${m[1]}.`;
  return null;
}

export function txLive(s: string): string | null {
  if (EXACT[s]) return EXACT[s]!;
  let m: RegExpExecArray | null;
  if ((m = /^([XYZ]) offsets of the extruders spread over ([\d.]+) mm \(above ([\d.]+) mm\)$/.exec(s))) return `Les décalages ${m[1]} des extrudeurs s'étalent sur ${n(m[2]!)} mm (plus de ${n(m[3]!)} mm)`;
  if ((m = /^([XYZ]) offsets \(mm\): (.+)\.$/.exec(s))) return `Décalages ${m[1]} (mm) : ${n(m[2]!)}.`;
  if ((m = /^No extruder object reports a ([XYZ]) offset below (-?[\d.]+) mm\.$/.exec(s))) return `Aucun objet extrudeur ne rapporte de décalage ${m[1]} inférieur à ${n(m[2]!)} mm.`;
  if ((m = /^The (-?[\d.]+) mm and (-?[\d.]+) mm figures come from one forum report, not from Snapmaker\.$/.exec(s))) return `Les valeurs ${n(m[1]!)} mm et ${n(m[2]!)} mm viennent d'un seul cas sur le forum, pas de Snapmaker.`;
  if ((m = /^The (-?[\d.]+) degC limit is a plausibility bound chosen by U1 Doctor, not an official value\.$/.exec(s))) return `La limite de ${n(m[1]!)} °C est une borne de vraisemblance choisie par U1 Doctor, pas une valeur officielle.`;
  if ((m = /^Heater target set but the temperature rose less than ([\d.]+) degC during the capture$/.exec(s))) return `Consigne de chauffe réglée mais la température a monté de moins de ${n(m[1]!)} °C pendant la capture`;
  if ((m = /^Window of ([\d.]+) s and rise of ([\d.]+) degC are U1 Doctor display thresholds, not official values\.$/.exec(s))) return `La fenêtre de ${n(m[1]!)} s et la hausse de ${n(m[2]!)} °C sont des seuils d'affichage de U1 Doctor, pas des valeurs officielles.`;
  if ((m = /^G-code nozzle diameter (.+) mm is not reported by any extruder object$/.exec(s))) return `Le diamètre de buse ${n(m[1]!)} mm du G-code n'est rapporté par aucun objet extrudeur`;
  if ((m = /^Reported: (.+)\.$/.exec(s))) return `Rapporté : ${n(m[1]!)}.`;
  if ((m = /^G-code nozzle_diameter: (.+) mm\.$/.exec(s))) return `nozzle_diameter du G-code : ${n(m[1]!)} mm.`;
  if ((m = /^Controller clock is (\d+) s shorter than the host clock during a print$/.exec(s))) return `L'horloge du contrôleur a ${m[1]} s de moins que celle de l'hôte pendant une impression`;
  if ((m = /^Host clock ([\d.]+) s, controller clock ([\d.]+) s, print state '(.+)'\.$/.exec(s))) return `Horloge de l'hôte ${n(m[1]!)} s, horloge du contrôleur ${n(m[2]!)} s, état d'impression « ${m[3]} ».`;
  if ((m = /^The ([\d.]+) s gap is a U1 Doctor display threshold, not an official value\.$/.exec(s))) return `L'écart de ${n(m[1]!)} s est un seuil d'affichage de U1 Doctor, pas une valeur officielle.`;
  if ((m = /^Log partition: ([\d.]+) MB free of ([\d.]+) MB \((\d+) % used\)$/.exec(s))) return `Partition des journaux : ${n(m[1]!)} Mo libres sur ${n(m[2]!)} Mo (${m[3]} % occupés)`;
  if ((m = /^total (\d+) B, used (\d+) B, free (\d+) B\.$/.exec(s))) return `total ${m[1]} o, occupé ${m[2]} o, libre ${m[3]} o.`;
  if ((m = /^Bed mesh: (\d+) points, range ([\d.]+) mm, standard deviation ([\d.]+) mm$/.exec(s))) return `Maillage du plateau : ${m[1]} points, amplitude ${n(m[2]!)} mm, écart type ${n(m[3]!)} mm`;
  if ((m = /^(\d+) points \((\S+) x (\S+)\), min (-?[\d.]+) mm, max (-?[\d.]+) mm\.$/.exec(s))) return `${m[1]} points (${m[2]} x ${m[3]}), min ${n(m[4]!)} mm, max ${n(m[5]!)} mm.`;
  if ((m = /^(.+): not observable in this capture$/.exec(s)) && LABEL[m[1]!]) return `${LABEL[m[1]!]} : non observable dans cette capture`;
  if ((m = /^(.+): the printer did not report this data during the capture \(object or field absent, or the read failed\)\.$/.exec(s)) && LABEL[m[1]!])
    return `${LABEL[m[1]!]} : l'imprimante n'a pas rapporté ces données pendant la capture (objet ou champ absent, ou lecture échouée).`;
  if ((m = /^Not reported in this capture: (.+)\.$/.exec(s))) return `Non rapporté dans cette capture : ${m[1]}.`;
  // evidence notes made of several sentences (S18, S19, S23)
  const parts = s.match(/[^.]+(?:\.\d[^.]*)*\./g);
  if (parts && parts.join("") === s && parts.length > 0) {
    const fr = parts.map((p) => sentence(p.trim()));
    if (fr.every((x) => x !== null)) return fr.join(" ");
  }
  return null;
}
