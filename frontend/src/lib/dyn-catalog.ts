/**
 * French display forms for the generated catalog (knowledge/u1_codes.json, scripts/build_catalog.py).
 * Titles are "<unit>: <official label>"; summaries are our own phrases with the unit spliced in.
 * Display only: the backend text stays English because it is part of hashed replay output.
 */
type Unit = { u: string; d: string; a: string; t: string }; // subject, "de ...", "à ...", title prefix

const UNIT_RE = /(Toolhead (\d) MCU|Toolhead (\d)|Feeder (\d)|Host MCU|Mainboard MCU)/g;

function unitFr(tok: string): Unit {
  let m: RegExpExecArray | null;
  if ((m = /^Toolhead (\d) MCU$/.exec(tok))) return { u: `le MCU de la tête ${m[1]}`, d: `du MCU de la tête ${m[1]}`, a: `au MCU de la tête ${m[1]}`, t: `MCU de la tête ${m[1]}` };
  if ((m = /^Toolhead (\d)$/.exec(tok))) return { u: `la tête ${m[1]}`, d: `de la tête ${m[1]}`, a: `à la tête ${m[1]}`, t: `Tête ${m[1]}` };
  if ((m = /^Feeder (\d)$/.exec(tok))) return { u: `le chargeur ${m[1]}`, d: `du chargeur ${m[1]}`, a: `au chargeur ${m[1]}`, t: `Chargeur ${m[1]}` };
  if (tok === "Host MCU") return { u: "le MCU hôte", d: "du MCU hôte", a: "au MCU hôte", t: "MCU hôte" };
  return { u: "le MCU de la carte mère", d: "du MCU de la carte mère", a: "au MCU de la carte mère", t: "MCU de la carte mère" };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** official labels */
const BASE: Record<string, string> = {
  "Axis Movement Anomaly": "Anomalie de mouvement d'axe", "Calibration Anomaly": "Anomalie de calibrage", "Chamber Temperature Exceeded": "Température de l'enceinte dépassée",
  "Detection Anomaly": "Anomalie de détection", "Extrusion Anomaly": "Anomalie d'extrusion", "Extrusion Blockage": "Blocage d'extrusion",
  "Extrusion Flow Exceeded": "Débit d'extrusion dépassé", "Extrusion Length Exceeded": "Longueur d'extrusion dépassée", "Filament Anomaly": "Anomalie de filament",
  "Filament Loading Anomaly": "Anomalie de chargement du filament", "Filament Not Loaded": "Filament non chargé", "Filament Pre-loading Anomaly": "Anomalie de pré-chargement du filament",
  "Filament Unloading Anomaly": "Anomalie de déchargement du filament", "Flow Calibration Anomaly": "Anomalie de calibrage du débit", "Gcode Error": "Erreur de G-code",
  "Heated Bed Detection Anomaly": "Anomalie de détection du plateau chauffant", "Heated Bed Temperature Exceeded": "Température du plateau chauffant dépassée",
  "Homing Anomaly": "Anomalie de mise à l'origine", "Maintenance": "Maintenance", "Manual Loading Anomaly": "Anomalie de chargement manuel",
  "Motor Driver Anomaly": "Anomalie du pilote moteur", "Nozzle Temperature Anomaly": "Anomalie de température de la buse", "Nozzle Temperature Out of Range": "Température de buse hors plage",
  "Parking Failure": "Échec du rangement", "Picking Failure": "Échec de la prise", "Printing Anomaly": "Anomalie d'impression", "Sensor Anomaly": "Anomalie de capteur",
  "Swapping Anomaly": "Anomalie de changement de tête", "Swapping Failure": "Échec du changement de tête", "System Anomaly": "Anomalie système",
  "System Failed to Start": "Échec du démarrage du système", "Temperature Anomaly": "Anomalie de température",
};

/** summary phrases; {U} subject, {D} "de ...", {A} "à ..." */
const PHRASE: Record<string, string> = {
  "A calibration step failed or its preconditions were not met.": "Une étape de calibrage a échoué ou ses conditions préalables ne sont pas remplies.",
  "A configuration failed to load at startup.": "Une configuration n'a pas pu être chargée au démarrage.",
  "A filament loading anomaly was reported for {U}.": "Une anomalie de chargement du filament a été signalée pour {U}.",
  "{U} reports a generic anomaly; the official table advises contacting support.": "{U} signale une anomalie générique ; la table officielle conseille de contacter le support.",
  "A motor driver anomaly was reported.": "Une anomalie du pilote moteur a été signalée.",
  "A move was requested before the required homing.": "Un déplacement a été demandé avant la mise à l'origine requise.",
  "A move went past the travel limit of an axis.": "Un déplacement a dépassé la limite de course d'un axe.",
  "A power-loss recovery problem was reported.": "Un problème de reprise après coupure de courant a été signalé.",
  "A problem with the sliced file was reported.": "Un problème avec le fichier tranché a été signalé.",
  "A single extrusion move on {U} was longer than allowed, which points to a faulty G-code.": "Un mouvement d'extrusion unique sur {U} dépasse la longueur permise, ce qui évoque un G-code défectueux.",
  "A single-axis movement anomaly occurred.": "Une anomalie de mouvement sur un axe est survenue.",
  "A tool change involving {U} failed; a toolhead that dropped out of or tilted in its dock is the usual suspect.": "Un changement de tête impliquant {U} a échoué ; une tête tombée ou penchée dans son support est la cause la plus fréquente.",
  "A toolhead in the dock is missing or misaligned.": "Une tête du support est absente ou mal alignée.",
  "Activation failed.": "L'activation a échoué.",
  "An ADC sensor configuration exceeded its limit; the system shut down to protect itself.": "Une configuration de capteur ADC a dépassé sa limite ; le système s'est arrêté par protection.",
  "An abnormal MCU connection was detected at startup.": "Une connexion MCU anormale a été détectée au démarrage.",
  "An anomaly was reported; the official table gives no more specific cause.": "Une anomalie a été signalée ; la table officielle ne donne pas de cause plus précise.",
  "An axis shows noticeable resistance while moving.": "Un axe présente une résistance notable pendant son déplacement.",
  "At least one toolhead must be attached for this operation.": "Au moins une tête doit être fixée pour cette opération.",
  "Calibration probing met an obstruction or residual filament on the nozzle.": "Le palpage de calibrage a rencontré un obstacle ou du filament résiduel sur la buse.",
  "Filament at {U} may be broken, tangled or the toolhead clogged.": "Le filament {A} est peut-être cassé ou emmêlé, ou la tête est bouchée.",
  "Filament information was not set for {U}.": "Les informations de filament n'ont pas été définies pour {U}.",
  "Filament is blocked at the drive gear of {U}.": "Le filament est bloqué au pignon d'entraînement {D}.",
  "Filament loading at {U} timed out, usually because the path is blocked or the tube came off.": "Le chargement du filament {A} a expiré, généralement car le chemin est bloqué ou le tube s'est détaché.",
  "Filament ran out at {U}.": "Le filament est épuisé {A}.",
  "Filament remains in {U} and must be removed before retrying.": "Du filament reste dans {U} et doit être retiré avant de réessayer.",
  "Filament remains in the printer and must be removed before retrying.": "Du filament reste dans l'imprimante et doit être retiré avant de réessayer.",
  "Homing failed; belt tension or an obstruction on the X/Y homing positions is suspected.": "La mise à l'origine a échoué ; la tension des courroies ou un obstacle aux positions d'origine X/Y est suspecté.",
  "No filament is seen at {U}.": "Aucun filament n'est détecté {A}.",
  "No toolhead is detected at all.": "Aucune tête n'est détectée.",
  "The sliced file uses M28, M29 or M30, which the printer does not support.": "Le fichier tranché utilise M28, M29 ou M30, que l'imprimante ne prend pas en charge.",
  "The printer could not retrieve its file list.": "L'imprimante n'a pas pu récupérer sa liste de fichiers.",
  "Sliced files cannot be handled while a print is running.": "Les fichiers tranchés ne peuvent pas être traités pendant une impression.",
  "The sliced file cannot be reset while its G-code is being parsed.": "Le fichier tranché ne peut pas être réinitialisé pendant l'analyse de son G-code.",
  "The sliced file could not be opened.": "Le fichier tranché n'a pas pu être ouvert.",
  "Resuming the print after a power outage failed.": "La reprise de l'impression après une coupure de courant a échoué.",
  "Power-off data cannot be deleted during a print.": "Les données de coupure ne peuvent pas être supprimées pendant une impression.",
  "A G-code command is missing a required parameter.": "Une commande G-code n'a pas un paramètre obligatoire.",
  "A G-code command parameter could not be parsed.": "Un paramètre de commande G-code n'a pas pu être analysé.",
  "A G-code command parameter is below its minimum.": "Un paramètre de commande G-code est inférieur à son minimum.",
  "A G-code command parameter is above its maximum.": "Un paramètre de commande G-code est supérieur à son maximum.",
  "A G-code command parameter must be larger than a value set earlier.": "Un paramètre de commande G-code doit être supérieur à une valeur définie plus tôt.",
  "A G-code command parameter must be smaller than a value set later.": "Un paramètre de commande G-code doit être inférieur à une valeur définie plus tard.",
  "A G-code command was registered twice.": "Une commande G-code a été enregistrée deux fois.",
  "A multiplexed G-code command failed to register (key error).": "Une commande G-code multiplexée n'a pas pu être enregistrée (erreur de clé).",
  "The G-code could not be parsed.": "Le G-code n'a pas pu être analysé.",
  "A G-code command received an invalid parameter.": "Une commande G-code a reçu un paramètre invalide.",
  "The G-code or one of its commands was rejected.": "Le G-code ou l'une de ses commandes a été rejeté.",
  "The G-code selected a toolhead the printer does not know.": "Le G-code a sélectionné une tête que l'imprimante ne connaît pas.",
  "The PEI sheet state does not match what the operation expects.": "L'état de la plaque PEI ne correspond pas à ce que l'opération attend.",
  "The accelerometer reported a storage or identification anomaly.": "L'accéléromètre a signalé une anomalie de stockage ou d'identification.",
  "The calibration sensor reading of {U} is missing or out of range.": "La lecture du capteur de calibrage {D} est absente ou hors plage.",
  "The chamber temperature exceeded its limit; check the sensor connection.": "La température de l'enceinte a dépassé sa limite ; vérifiez la connexion du capteur.",
  "The communication protocol failed to load at startup.": "Le protocole de communication n'a pas pu être chargé au démarrage.",
  "The current toolhead is unavailable for homing.": "La tête actuelle est indisponible pour la mise à l'origine.",
  "The electrical contact between {U} and the swapper pins is abnormal.": "Le contact électrique entre {U} et les broches du changeur est anormal.",
  "The extrusion flow calibration of {U} failed.": "Le calibrage du débit d'extrusion {D} a échoué.",
  "The extrusion volume of {U} exceeded the allowed maximum, which points to a faulty G-code.": "Le volume d'extrusion {D} a dépassé le maximum permis, ce qui évoque un G-code défectueux.",
  "The feeder motor of {U} reports an abnormal speed; the cable is the first thing to check.": "Le moteur du chargeur {D} signale une vitesse anormale ; le câble est la première chose à vérifier.",
  "The feeding path of {U} is likely tangled, jammed or detached.": "Le chemin d'alimentation {D} est probablement emmêlé, coincé ou détaché.",
  "The heated bed did not heat or was not detected normally.": "Le plateau chauffant n'a pas chauffé ou n'a pas été détecté normalement.",
  "The heated bed temperature exceeded its limit.": "La température du plateau chauffant a dépassé sa limite.",
  "The heating module failed to heat normally; the system shut down to protect itself.": "Le module de chauffe n'a pas chauffé normalement ; le système s'est arrêté par protection.",
  "The link to {U} dropped while running.": "La liaison avec {U} s'est interrompue en fonctionnement.",
  "The nozzle of {U} is too cold for extrusion (below 170 degC).": "La buse {D} est trop froide pour extruder (moins de 170 °C).",
  "The nozzle temperature requested for {U} is outside the allowed range.": "La température de buse demandée pour {U} est hors de la plage permise.",
  "The operation failed with no further detail; retrying is the only guidance given.": "L'opération a échoué sans autre précision ; la seule consigne donnée est de réessayer.",
  "The printer considers {U} detached or not seated in its dock.": "L'imprimante considère {U} comme détachée ou mal logée dans son support.",
  "The system is in protection shutdown and refuses this operation.": "Le système est en arrêt de protection et refuse cette opération.",
  "The temperature sensing or heating element of {U} looks disconnected.": "L'élément de mesure de température ou de chauffe {D} semble déconnecté.",
  "{U} could not be parked back in its dock.": "{U} n'a pas pu être rangée dans son support.",
  "{U} could not be picked up from the dock; check for a dropped or tilted toolhead.": "{U} n'a pas pu être saisie dans le support ; vérifiez qu'aucune tête n'est tombée ou penchée.",
  "{U} could not be reached at startup.": "{U} n'a pas pu être joint au démarrage.",
  "{U} could not return to the dock; an obstruction in the dock area is suspected.": "{U} n'a pas pu retourner au support ; un obstacle dans la zone du support est suspecté.",
  "{U} detected a power-off signal; the system shut down to protect itself.": "{U} a détecté un signal de coupure d'alimentation ; le système s'est arrêté par protection.",
  "{U} reported a generic anomaly; the screen's detail view holds more information and support is advised.": "{U} a signalé une anomalie générique ; la vue détaillée de l'écran donne plus d'informations et le support est conseillé.",
  "{U} stopped answering in time; the system shut down to protect itself.": "{U} a cessé de répondre à temps ; le système s'est arrêté par protection.",
};

/** release-note facts attached to catalog codes (knowledge/u1_codes.json fw_notes) */
const FW_NOTE: Record<string, string> = {
  "Firmware 0.9.4 added an adjustable sensitivity for filament-tangle detection.": "Le firmware 0.9.4 a ajouté une sensibilité réglable pour la détection de filament emmêlé.",
  "Firmware 0.9.4 set the minimum active-toolhead temperature to 170 degC during printing.": "Le firmware 0.9.4 a fixé à 170 °C la température minimale de la tête active pendant l'impression.",
  "Firmware 1.0.0 added homing calibration and optimised the homing logic to prevent homing failures.": "Le firmware 1.0.0 a ajouté un calibrage de la mise à l'origine et optimisé sa logique pour éviter les échecs.",
  "Firmware 1.1.0 added a medium sensitivity option for tangle detection.": "Le firmware 1.1.0 a ajouté une sensibilité moyenne pour la détection de filament emmêlé.",
  "Firmware 1.1.1 fixed a toolhead being wrongly seen as loaded during a filament-runout pause.": "Le firmware 1.1.1 a corrigé une tête vue à tort comme chargée pendant une pause pour fin de filament.",
  "Firmware 1.1.1 no longer requires editing material information by hand after a runout.": "Le firmware 1.1.1 n'exige plus de modifier à la main les informations de matière après une fin de filament.",
  "Firmware 1.3.0 changed the pogo-pin continuity check to avoid false detections that paused prints.": "Le firmware 1.3.0 a modifié le contrôle de continuité des broches pogo pour éviter les fausses détections qui mettaient l'impression en pause.",
  "Firmware 1.3.0 fixed the 'unedited filament' message staying on screen.": "Le firmware 1.3.0 a corrigé le message « filament non modifié » qui restait affiché.",
  "Firmware 1.4.0 reduced MCU control timeout errors.": "Le firmware 1.4.0 a réduit les erreurs d'expiration de contrôle du MCU.",
  "Firmware 1.4.1 fixed filament runout not pausing the print in some cases, such as a new print started right after cancelling one.": "Le firmware 1.4.1 a corrigé une fin de filament qui ne mettait pas l'impression en pause dans certains cas, par exemple une nouvelle impression lancée juste après une annulation.",
  "Firmware 1.5.0 improved system performance to reduce the 'timer too close' error.": "Le firmware 1.5.0 a amélioré les performances du système pour réduire l'erreur « timer too close ».",
  "Snapmaker Orca older than 2.1.2 with the interface in German or French writes decimal commas that trigger this code.": "Snapmaker Orca antérieur à la 2.1.2 avec l'interface en allemand ou en français écrit des virgules décimales qui déclenchent ce code.",
};

const fill = (tpl: string, un: Unit | null) => (un ? tpl.replace(/\{U\}/g, un.u).replace(/\{D\}/g, un.d).replace(/\{A\}/g, un.a) : tpl);

/** French form of a generated catalog title or summary, or null when it is not one. */
export function txCatalog(s: string): string | null {
  if (FW_NOTE[s]) return FW_NOTE[s]!;
  const t = /^(Toolhead \d MCU|Toolhead \d|Feeder \d|Host MCU|Mainboard MCU|The MCU): (.+)$/.exec(s);
  if (t) {
    const base = BASE[t[2]!];
    if (!base) return null;
    return t[1] === "The MCU" ? `MCU : ${base}` : `${unitFr(t[1]!).t} : ${base}`;
  }
  if (BASE[s]) return BASE[s]!;
  const first = UNIT_RE.exec(s);
  UNIT_RE.lastIndex = 0;
  const key = s.replace(UNIT_RE, "{U}").replace("Filament remains in The printer", "Filament remains in the printer");
  UNIT_RE.lastIndex = 0;
  const tpl = PHRASE[key];
  if (tpl) {
    const out = fill(tpl, first ? unitFr(first[1]!) : null);
    return out.startsWith("le ") || out.startsWith("la ") ? cap(out) : out;
  }
  // "The printer ..." / "The MCU ..." variants of the phrases
  const generic = PHRASE[key.replace(/^The (printer|MCU)/, "{U}")];
  if (generic && /^The (printer|MCU)/.test(key)) return fill(generic, { u: "L'imprimante", d: "de l'imprimante", a: "à l'imprimante", t: "" });
  return null;
}

export const _CATALOG_FR_KEYS = [...Object.keys(BASE), ...Object.keys(PHRASE), ...Object.keys(FW_NOTE)];
