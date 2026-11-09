/**
 * Display-only localisation of strings that come from the backend (catalog, rules, scenarios, enums).
 * The backend keeps English: its text is part of hashed replay output and of the exported bundle, so it must never change.
 * Unknown strings pass through unchanged; tests/i18n-data.test.ts fails if any known backend string lacks a French form.
 */
import type { Lang } from "./i18n";
import { txCatalog } from "./dyn-catalog";
import { txSignals } from "./dyn-signals";
import { txLive } from "./dyn-live";
import { txLogs } from "./dyn-logs";

const SEV: Record<string, string> = { warning: "avertissement", error: "erreur", notice: "notice", invalid: "invalide" };
const MODULE: Record<string, string> = {
  "motion control": "contrôle du mouvement", toolhead: "tête", "filament feeder": "chargeur de filament", "heated bed": "plateau chauffant",
  "chamber temperature detection": "détection de température de l'enceinte", homing: "mise à l'origine", "g-code": "G-code",
  "detection / calibration": "détection / calibrage", "slicing file exception": "exception de fichier de tranchage",
};
const STATE: Record<string, string> = { printing: "impression", paused: "pause", error: "erreur", idle: "repos", standby: "veille", complete: "terminée" };
const EVENT: Record<string, string> = {
  state_transition: "changement d'état", user_reported_error_code: "code d'erreur déclaré", capture_gap: "trou de capture",
  connection_timeout: "expiration de la connexion", extruder_temperature: "température de l'extrudeur", temperature_sample: "échantillon de température",
  bed_temperature_sample: "échantillon de température du plateau", transport_denied: "appel refusé", machine_action_code: "code d'action machine",
  extruder_offsets: "décalages des extrudeurs", nozzle_diameters: "diamètres de buse", gcode_nozzle_diameter: "diamètre de buse du G-code",
  heater_window: "fenêtre de chauffe", clock_check: "contrôle des horloges", disk_usage: "occupation du disque", extruder_activity: "activité des extrudeurs",
  bed_mesh_points: "points du maillage du plateau", live_coverage: "couverture de la capture", connectivity_check: "autodiagnostic de la connexion",
  history_totals: "totaux de l'historique des travaux",
  machine_exception: "exception de la machine", cloud_mqtt_offline: "coupures de la connexion cloud", moonraker_summary: "résumé du journal Moonraker",
  klippy_link_stats: "compteurs de liaison Klipper", klippy_summary: "résumé du journal Klipper", klippy_shutdown: "arrêt Klipper",
  unisrv_summary: "résumé du journal unisrv", syslog_summary: "résumé du journal système", gui_summary: "résumé du journal de l'écran",
  mosquitto_summary: "résumé du journal mosquitto", orca_summary: "résumé du journal Snapmaker Orca", firmware_upgrade: "mise à jour du firmware",
  encrypted_system_log: "journal système chiffré", log_file_seen: "fichier journal reconnu",
};
const ENTITY: Record<string, string> = { printer: "imprimante", toolhead_1: "tête 1", toolhead_2: "tête 2", toolhead_3: "tête 3", toolhead_4: "tête 4", unmapped: "non associé" };

/** exact English -> French */
const FR: Record<string, string> = {
  // finding titles
  "Malformed error code": "Code d'erreur mal formé",
  "Non-allowlisted request was blocked by U1 Doctor": "Une requête hors liste autorisée a été bloquée par U1 Doctor",
  "Observation incomplete: absence of data is not evidence of absence": "Observation incomplète : l'absence de données n'est pas une preuve d'absence",
  "Per-toolhead attribution unavailable (mapping unknown)": "Attribution par tête indisponible (association inconnue)",
  // evidence notes
  "Close in time to the transition: correlation only, not causation.": "Proche dans le temps de la transition : simple corrélation, pas de causalité.",
  "Code declared by the user.": "Code déclaré par l'utilisateur.",
  "Input rejected as malformed.": "Saisie rejetée car mal formée.",
  "Request refused by the read-only transport before any I/O.": "Requête refusée par le transport en lecture seule avant tout échange.",
  "Value cannot be attributed to a toolhead.": "Cette valeur ne peut pas être attribuée à une tête.",
  "Well-formed code not present in the local verified catalog.": "Code bien formé mais absent du catalogue local vérifié.",
  // missing data
  "A code of the form dddd-dddd-dddd-dddd.": "Un code de la forme dddd-dddd-dddd-dddd.",
  "Cause of the transition is not determined by this fact.": "La cause de la transition n'est pas établie par ce fait.",
  "Data for the affected window.": "Les données de la fenêtre concernée.",
  "No live machine state verified.": "Aucun état de machine en direct vérifié.",
  "Official meaning of this exact code was not verified locally.": "Le sens officiel de ce code exact n'a pas été vérifié localement.",
  "Verified mapping from the observed object to toolhead 1-4.": "Association vérifiée entre l'objet observé et la tête 1-4.",
  // safe actions
  "Check the printer screen and follow the official procedure for any displayed code.": "Vérifiez l'écran de l'imprimante et suivez la procédure officielle pour tout code affiché.",
  "Do not infer the machine state from the loss of connection; check the printer itself.": "Ne déduisez pas l'état de la machine de la perte de connexion ; vérifiez l'imprimante elle-même.",
  "Follow the linked official procedure; do not bypass safety interlocks.": "Suivez la procédure officielle indiquée ; ne contournez pas les sécurités.",
  "No action: do not read these values as belonging to a specific toolhead.": "Aucune action : ne lisez pas ces valeurs comme appartenant à une tête précise.",
  "No machine action was taken.": "Aucune action n'a été effectuée sur la machine.",
  "Re-enter the code exactly as shown on the printer screen.": "Saisissez de nouveau le code exactement comme affiché sur l'écran de l'imprimante.",
  "Search the exact code on the official wiki or contact Snapmaker support.": "Cherchez le code exact sur le wiki officiel ou contactez le support Snapmaker.",
  "Severity 'error': the official table says the print is stopped. Do not continue printing until the manufacturer's procedure is followed.": "Gravité « erreur » : la table officielle indique que l'impression est arrêtée. Ne reprenez pas l'impression avant d'avoir suivi la procédure du constructeur.",
  // limits
  "A lost or timed-out connection does not mean the printer stopped or failed.": "Une connexion perdue ou expirée ne signifie pas que l'imprimante s'est arrêtée ou est en panne.",
  "A state change is a fact, not a diagnosis.": "Un changement d'état est un fait, pas un diagnostic.",
  "Code declared by the user; not verified from the machine.": "Code déclaré par l'utilisateur ; non vérifié depuis la machine.",
  "Describes U1 Doctor's own behaviour, not the printer.": "Décrit le comportement de U1 Doctor lui-même, pas celui de l'imprimante.",
  "Input is not a valid U1 code; nothing was inferred.": "La saisie n'est pas un code U1 valide ; rien n'a été déduit.",
  "Module/severity are read from the code structure only; no cause is inferred.": "Le module et la gravité sont lus uniquement dans la structure du code ; aucune cause n'est déduite.",
  "The displayed code may not represent the actual fault source (official wiki note).": "Le code affiché peut ne pas représenter la véritable source du défaut (note du wiki officiel).",
  "Timestamps are receipt time only; ordering within the capture window is trusted, exact delay is not.": "Les horodatages sont uniquement des heures de réception ; l'ordre dans la fenêtre de capture est fiable, le délai exact ne l'est pas.",
  "Toolhead mapping must be proven (H-04) before per-toolhead statements.": "L'association des têtes doit être prouvée (H-04) avant toute affirmation par tête.",
  // malformed reasons
  "code must be ASCII text like dddd-dddd-dddd-dddd": "le code doit être du texte ASCII de la forme dddd-dddd-dddd-dddd",
  "code must match dddd-dddd-dddd-dddd (digits only, no spaces)": "le code doit respecter dddd-dddd-dddd-dddd (chiffres uniquement, sans espaces)",
  // catalog
  "Toolhead 3 filament feeder anomaly": "Anomalie du chargeur de filament de la tête 3",
  "Generic feeder anomaly for toolhead 3; the official table says to contact technical support.": "Anomalie générique du chargeur de la tête 3 ; la table officielle indique de contacter le support technique.",
  "Filament feeder 3 loading anomaly": "Anomalie de chargement du chargeur de filament 3",
  "Loading anomaly reported for feeder 3. Official guidance: check for tangled filament or loose connectors; if a print is running, resume it from the screen after troubleshooting.": "Anomalie de chargement signalée pour le chargeur 3. Consigne officielle : vérifier qu'aucun filament n'est emmêlé et qu'aucun connecteur n'est desserré ; si une impression est en cours, la reprendre depuis l'écran après le dépannage.",
  "Filament not loaded (toolhead 3)": "Filament non chargé (tête 3)",
  "The feeder of toolhead 3 detected no filament entering. Official guidance: insert filament.": "Le chargeur de la tête 3 n'a détecté aucun filament entrant. Consigne officielle : insérer du filament.",
  "Extrusion blockage at toolhead 3 drive gear": "Blocage d'extrusion au pignon d'entraînement de la tête 3",
  "Filament extrusion blocked at the drive gear of toolhead 3. Official guidance: check and clean, then retry.": "Extrusion du filament bloquée au pignon d'entraînement de la tête 3. Consigne officielle : vérifier et nettoyer, puis réessayer.",
  "Toolhead 3 feeder loading timeout": "Délai de chargement dépassé au chargeur de la tête 3",
  "Loading timed out on toolhead 3. Official guidance: check that the loading path is clear, then retry.": "Le chargement a expiré sur la tête 3. Consigne officielle : vérifier que le chemin de chargement est dégagé, puis réessayer.",
  "Toolhead 3 feeder loading timeout (tube / path)": "Délai de chargement dépassé au chargeur de la tête 3 (tube / chemin)",
  "Loading timed out on toolhead 3. Official guidance: check whether the filament tube is detached or the path blocked, then retry.": "Le chargement a expiré sur la tête 3. Consigne officielle : vérifier si le tube de filament est détaché ou si le chemin est bloqué, puis réessayer.",
  "Filament runout, toolhead 1": "Fin de filament, tête 1",
  "Filament runout detected on toolhead 1. Official guidance: reload filament, then resume.": "Fin de filament détectée sur la tête 1. Consigne officielle : recharger du filament, puis reprendre.",
  "Toolhead 1 nozzle temperature insufficient": "Température de la buse de la tête 1 insuffisante",
  "Nozzle temperature too low for extrusion on toolhead 1 (official threshold: above 170 C).": "Température de la buse trop basse pour extruder sur la tête 1 (seuil officiel : au-dessus de 170 °C).",
  "Toolhead 1 MCU connection failed at startup": "Échec de la connexion MCU de la tête 1 au démarrage",
  "Official guidance: power off, check the toolhead cable, restart; contact support if it persists. In this module the index 2 maps to toolhead 1.": "Consigne officielle : éteindre, vérifier le câble de la tête, redémarrer ; contacter le support si le problème persiste. Dans ce module, l'index 2 correspond à la tête 1.",
  "Toolhead 1 MCU connection interrupted": "Connexion MCU de la tête 1 interrompue",
  "Official guidance: power off, check the toolhead 1 cable, restart. In this module the index 2 maps to toolhead 1.": "Consigne officielle : éteindre, vérifier le câble de la tête 1, redémarrer. Dans ce module, l'index 2 correspond à la tête 1.",
  "X-axis movement exceeded travel limit": "Mouvement de l'axe X au-delà de sa limite de course",
  "X-axis movement went beyond its travel limit; a dedicated official article exists.": "Le mouvement de l'axe X a dépassé sa limite de course ; un article officiel dédié existe.",
  // chart lanes, capabilities
  "Toolhead 3 · nozzle": "Tête 3 · buse", Bed: "Plateau", "Print state": "État d'impression",
  "Moonraker HTTP :7125": "Moonraker HTTP :7125", "Objects list": "Liste d'objets", "Objects query": "Requête d'objets", "WebSocket subscribe": "Abonnement WebSocket",
  "Live error codes": "Codes d'erreur en direct", "Toolhead 1-4 mapping": "Association des têtes 1-4", "Official firmware version": "Version officielle du firmware",
  "Offline code decoder": "Décodeur de codes hors ligne", "Deterministic replay": "Rejeu déterministe",
};

const sev = (s: string) => SEV[s] ?? s;
const mod = (s: string) => MODULE[s] ?? s;
const st = (s: string) => STATE[s] ?? s;

/** free text (titles, notes, summaries, limits…) */
export function tx(lang: Lang, s: string): string {
  if (lang === "en" || !s) return s;
  const hit = FR[s];
  if (hit) return hit;
  if (s.startsWith("SYNTHETIC: ")) return "SYNTHÉTIQUE : " + tx(lang, s.slice(11));
  let m: RegExpExecArray | null;
  if ((m = /^Code reported: (.+) \((\w+), ([\w /-]+)\)$/.exec(s))) return `Code déclaré : ${tx(lang, m[1]!)} (${sev(m[2]!)}, ${mod(m[3]!)})`;
  if ((m = /^Code not in verified catalog \(structure: (\w+), ([\w /-]+)\)$/.exec(s))) return `Code absent du catalogue vérifié (structure : ${sev(m[1]!)}, ${mod(m[2]!)})`;
  if ((m = /^Print state changed: (\w+) -> (\w+)$/.exec(s))) return `L'état de l'impression est passé de « ${st(m[1]!)} » à « ${st(m[2]!)} »`;
  if ((m = /^Observed state '(\w+)'\.$/.exec(s))) return `État observé « ${st(m[1]!)} ».`;
  if ((m = /^(\w+) \/ validity (\w+)$/.exec(s))) return `${EVENT[m[1]!] ?? m[1]} / validité ${tok(lang, "validity", m[2]!).toLowerCase()}`;
  return txSignals(s) ?? txLive(s) ?? txLogs(s, (x) => tx(lang, x)) ?? txCatalog(s) ?? s;
}

const TOK: Record<string, Record<string, string>> = {
  provenance: { REAL: "RÉEL", SYNTHETIC: "SYNTHÉTIQUE", USER_REPORTED: "DÉCLARÉ", IMPORTED: "IMPORTÉ" },
  classification: { OBSERVED: "OBSERVÉ", INCONCLUSIVE: "NON CONCLUANT", SUSPECTED: "SUPPOSÉ", REFUTED: "RÉFUTÉ", KNOWN: "CONNU", STRUCTURE_ONLY: "STRUCTURE SEULE", MALFORMED: "MAL FORMÉ" },
  quality: { STRONG: "FORTE", MODERATE: "MOYENNE", WEAK: "FAIBLE", UNKNOWN: "INCONNUE" },
  validity: { FRESH: "FRAÎCHE", STALE: "PÉRIMÉE", UNAVAILABLE: "INDISPONIBLE", UNKNOWN: "INCONNUE" },
  mapping: { VERIFIED: "VÉRIFIÉ", INFERRED: "DÉDUIT", UNMAPPED: "NON ASSOCIÉ", UNKNOWN: "INCONNU", PROVEN: "PROUVÉ" },
  status: { UNTESTED: "NON TESTÉ", TESTED_SYNTHETIC: "TESTÉ (SYNTHÉTIQUE)", TESTED_REAL: "TESTÉ (RÉEL)", UNAVAILABLE: "INDISPONIBLE" },
  label: { OFFICIAL_REFERENCE: "RÉFÉRENCE OFFICIELLE", COMMUNITY_HYPOTHESIS: "HYPOTHÈSE DE LA COMMUNAUTÉ" },
  access: { NONE_IN_THIS_BUILD: "AUCUN (CETTE VERSION)", READ_ONLY_ON_CONSENT: "LECTURE SEULE, SUR ACCORD" },
  match: { MATCH: "IDENTIQUE", MISMATCH: "DIFFÉRENT" },
  refkind: { OFFICIAL_WIKI: "WIKI OFFICIEL", OFFICIAL_DOC: "DOCUMENTATION OFFICIELLE", COMMUNITY_THREAD: "SUJET DU FORUM" },
};
export type TokKind = keyof typeof TOK;

/** uppercase enum tokens (provenance, classification, quality…) */
export function tok(lang: Lang, kind: TokKind, v: string): string {
  if (lang === "en") return kind === "access" && v === "NONE_IN_THIS_BUILD" ? "NONE (THIS BUILD)" : kind === "access" && v === "READ_ONLY_ON_CONSENT" ? "READ-ONLY, ON CONSENT" : kind === "status" && v.startsWith("TESTED_") ? `TESTED (${v.slice(7)})` : v;
  return TOK[kind]?.[v] ?? v;
}

export const eventLabel = (lang: Lang, e: string) => (lang === "fr" ? EVENT[e] ?? e : e);
export const entityLabel = (lang: Lang, e: string) => (lang === "fr" ? ENTITY[e] ?? e : e);
export const stateLabel = (lang: Lang, s: string) => (lang === "fr" ? (STATE[s] ?? s).toUpperCase() : s.toUpperCase());
export const moduleLabel = (lang: Lang, m: string) => (lang === "fr" ? mod(m) : m);

const SCENARIOS: Record<string, [string, string]> = {
  demo_extrusion_blockage: ["Extrusion blockage (demo incident)", "Blocage d'extrusion (incident de démo)"],
  known_code_feeder3: ["Known code · feeder 3", "Code connu · chargeur 3"],
  known_code_level3: ["Known code · severity error", "Code connu · gravité erreur"],
  mapping_unknown: ["Unknown toolhead mapping", "Association de tête inconnue"],
  offline_gap: ["Offline gap", "Trou hors ligne"],
  out_of_order: ["Out-of-order events", "Événements désordonnés"],
  signal_out_of_window: ["Readings outside documented windows", "Valeurs hors des plages documentées"],
  signal_code_recurrence: ["Recurring declared code", "Code déclaré de façon récurrente"],
  signal_connection_flaps: ["Repeated connection drops", "Coupures de connexion répétées"],
  signal_drop_link_only: ["Stream dropped, Klipper still answers", "Flux coupé, Klipper répond encore"],
  signal_drop_klipper_stopped: ["Stream dropped, Klipper reports a stop", "Flux coupé, Klipper signale un arrêt"],
  signal_drop_unreachable: ["Stream dropped, printer unreachable", "Flux coupé, imprimante injoignable"],
  signal_fan_off_hot: ["Nozzle fan at 0 while hot", "Ventilateur de buse à 0 en chauffe"],
  live_rules_positive: ["Live rules S17-S24 · every rule fires", "Règles en direct S17-S24 · chaque règle se déclenche"],
  live_rules_normal: ["Live rules S17-S24 · usual values", "Règles en direct S17-S24 · valeurs habituelles"],
  live_rules_absent: ["Live rules S17-S24 · data not observable", "Règles en direct S17-S24 · données non observables"],
  security_denied_call: ["Call denied by the security policy", "Appel refusé par la politique de sécurité"],
  state_changed_no_code: ["State change without code", "Changement d'état sans code"],
  timeout: ["Connection timeout", "Expiration de connexion"],
  unknown_and_malformed_code: ["Unknown and malformed codes", "Codes inconnus et mal formés"],
};
export const scenarioLabel = (lang: Lang, n: string) => SCENARIOS[n]?.[lang === "fr" ? 1 : 0] ?? n;

/** every French form, for the exhaustiveness test */
export const _FR_KEYS = Object.keys(FR);
