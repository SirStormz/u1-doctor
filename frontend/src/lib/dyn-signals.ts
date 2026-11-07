/** French display forms of the signal findings (rules S11-S14). Display only: the backend text stays English (it is hashed). */
const EXACT: Record<string, string> = {
  "Whether the fan was really stopped (no rpm collected) and whether a heater or fan fault code was shown.": "Si le ventilateur était vraiment arrêté (pas de rpm collecté) et si un code de défaut de chauffe ou de ventilateur s'est affiché.",
  "Which toolhead this is (mapping unknown).": "De quelle tête il s'agit (association inconnue).",
  "Check on the printer itself whether that nozzle fan spins; do not keep a hot nozzle idle without cooling.": "Vérifiez sur l'imprimante si ce ventilateur de buse tourne ; ne laissez pas une buse chaude à l'arrêt sans refroidissement.",
  "Follow the official procedure for any displayed code.": "Suivez la procédure officielle pour tout code affiché.",
  "Samples are about 60 s apart: a short real fault can be missed and a short normal pause can look like a fault.": "Les échantillons sont espacés d'environ 60 s : un court défaut réel peut passer inaperçu et une courte pause normale peut ressembler à un défaut.",
  "A reading is a fact about reported values, not proof of a fault.": "Une valeur est un fait sur les valeurs rapportées, pas la preuve d'un défaut.",
  "Live stream dropped.": "Le flux en direct s'est coupé.",
  "HTTP answered, Klipper state 'ready'.": "HTTP a répondu, état Klipper « ready ».",
  "Probe got no HTTP answer.": "La sonde n'a reçu aucune réponse HTTP.",
  "Stream dropped but Klipper still answered over HTTP (state ready): link problem, not a Klipper stop": "Flux coupé mais Klipper répond encore en HTTP (état ready) : problème de liaison, pas un arrêt de Klipper",
  "Stream dropped and the printer did not answer HTTP probes either": "Flux coupé et l'imprimante ne répond pas non plus aux sondes HTTP",
  "Why the stream closed (Wi-Fi, address change, host sleep).": "Pourquoi le flux s'est fermé (Wi-Fi, changement d'adresse, mise en veille du PC).",
  "Reconnect and look at the printer screen: the print may have continued.": "Reconnectez-vous et regardez l'écran de l'imprimante : l'impression a peut-être continué.",
  "Whether the printer or only the network path is down.": "Si c'est l'imprimante ou seulement le chemin réseau qui est coupé.",
  "Check the printer itself (screen, power) and the network before concluding anything.": "Vérifiez l'imprimante elle-même (écran, alimentation) et le réseau avant de conclure.",
  "Probes show whether Klipper answers; they do not show whether the print continues.": "Les sondes montrent si Klipper répond ; elles ne montrent pas si l'impression continue.",
  "Only the first drop of the capture is examined.": "Seule la première coupure de la capture est examinée.",
  "The cause of that state.": "La cause de cet état.",
  "Read the printer screen and follow the official procedure for any displayed code.": "Lisez l'écran de l'imprimante et suivez la procédure officielle pour tout code affiché.",
  "Heated bed temperature: reading outside the documented window": "Température du plateau chauffant : valeur hors de la plage documentée",
  "Nozzle temperature: reading outside the documented window": "Température de la buse : valeur hors de la plage documentée",
  "Same code declared again.": "Le même code est de nouveau déclaré.",
  "Whether the printer showed the code each time, and what was done between declarations.": "Si l'imprimante a affiché le code à chaque fois, et ce qui a été fait entre les déclarations.",
  "Follow the linked official procedure for this code; if it keeps returning, contact Snapmaker support.": "Suivez la procédure officielle liée à ce code ; s'il revient sans cesse, contactez le support Snapmaker.",
  "Codes are declared by the user: this counts declarations, not machine events.": "Les codes sont déclarés par l'utilisateur : on compte des déclarations, pas des événements de la machine.",
  "The printer's IP address over time (not collected) and Wi-Fi signal quality.": "L'adresse IP de l'imprimante au fil du temps (non collectée) et la qualité du signal Wi-Fi.",
  "Check the printer itself: a lost connection does not mean it stopped.": "Vérifiez l'imprimante elle-même : une connexion perdue ne signifie pas qu'elle s'est arrêtée.",
  "If the address changed, a static lease in the router is the documented fix.": "Si l'adresse a changé, un bail statique dans le routeur est la solution documentée.",
  "The wiki links frequent disconnects to address changes; other causes are possible.": "Le wiki relie les déconnexions fréquentes à un changement d'adresse ; d'autres causes sont possibles.",
  "The official static-IP page says a printer that often disconnects, looks offline or loses pairing may have changed address after a restart": "La page officielle sur l'IP statique indique qu'une imprimante qui se déconnecte souvent, paraît hors ligne ou perd son appairage peut avoir changé d'adresse après un redémarrage",
  "Whether the printer itself displayed the code, and the state of the sensor wiring.": "Si l'imprimante a elle-même affiché le code, et l'état du câblage du capteur.",
  "Follow the linked official page; do not bypass safety limits.": "Suivez la page officielle liée ; ne contournez pas les limites de sécurité.",
  "A reading is a fact about the sensor value, not proof of its cause.": "Une valeur est un fait sur la mesure du capteur, pas la preuve de sa cause.",
  "Thresholds come from the official wiki; the wiki pages do not always agree.": "Les seuils viennent du wiki officiel ; ses pages ne sont pas toujours d'accord.",
  "The official page gives -10 to 110 degC as the normal bed range and lists wiring and sensor checks when it is left": "La page officielle donne -10 à 110 °C comme plage normale du plateau et liste des contrôles de câblage et de capteur quand on en sort",
  "The official page gives -10 degC as the minimum and 310 degC as the maximum safe nozzle temperature and lists heater and sensor checks": "La page officielle donne -10 °C comme minimum et 310 °C comme maximum sûr pour la buse, et liste des contrôles du chauffage et du capteur",
};

const EXACT_DRYRUN: Record<string, string> = {
  "A physical print of this file: nothing was observed on a machine.": "Une impression réelle de ce fichier : rien n'a été observé sur une machine.",
  "Review the flagged lines in the slicer before printing; Dry Run is a community tool, not an official check.": "Relisez les lignes signalées dans le slicer avant d'imprimer ; Dry Run est un outil communautaire, pas un contrôle officiel.",
  "Prediction made by simulating the sliced file, not an observation of a machine.": "Prédiction obtenue en simulant le fichier tranché, pas une observation d'une machine.",
  "The report's own caveat: predicted scars are not checked on a physical print.": "Réserve du rapport lui-même : les cicatrices prédites ne sont pas vérifiées sur une impression réelle.",
  "The sliced file name is dropped on import.": "Le nom du fichier tranché est supprimé à l'import.",
  "Code declared in the same observation set: co-occurrence only, Dry Run does not predict error codes.": "Code déclaré dans le même jeu d'observations : simple coïncidence, Dry Run ne prédit pas de codes d'erreur.",
  "The community tool U1 Dry Run replays the sliced file on the firmware motion code and reports the moves the firmware would refuse and the tool-change travel that would leave scars on the print; it is a simulation and models no heating, flow or sensors": "L'outil communautaire U1 Dry Run rejoue le fichier tranché sur le code de mouvement du firmware et signale les déplacements que le firmware refuserait et les trajets de changement d'outil qui laisseraient des cicatrices sur la pièce ; c'est une simulation qui ne modélise ni chauffe, ni débit, ni capteurs",
};

const EVENT: Record<string, string> = { connection_lost: "connexion perdue", connection_timeout: "expiration de la connexion" };
const num = (s: string) => s.replace(".", ",");

export function txSignals(s: string): string | null {
  if (EXACT[s]) return EXACT[s]!;
  if (EXACT_DRYRUN[s]) return EXACT_DRYRUN[s]!;
  let m: RegExpExecArray | null;
  if ((m = /^Code (\S+) declared (\d+) times within (\d+) s$/.exec(s))) return `Code ${m[1]} déclaré ${m[2]} fois en ${m[3]} s`;
  if ((m = /^Dry Run predicts (\d+) firmware errors and (\d+) scars in the sliced file$/.exec(s))) return `Dry Run prédit ${m[1]} erreurs du firmware et ${m[2]} cicatrices dans le fichier tranché`;
  if ((m = /^Predicted firmware error at line (\S+)\.$/.exec(s))) return `Erreur du firmware prédite à la ligne ${m[1]}.`;
  if ((m = /^Predicted scar at line (\S+), clearance (\S+) mm\.$/.exec(s))) return `Cicatrice prédite à la ligne ${m[1]}, dégagement ${num(m[2]!)} mm.`;
  if ((m = /^Only the first (\d+) of each kind are listed as evidence\.$/.exec(s))) return `Seuls les ${m[1]} premiers de chaque type sont listés comme preuves.`;
  if ((m = /^After the stream dropped, Klipper reports state (.+)$/.exec(s))) return `Après la coupure du flux, Klipper indique l'état ${m[1]}`;
  if ((m = /^HTTP answered, Klipper state '(.+)'\.$/.exec(s))) return `HTTP a répondu, état Klipper « ${m[1]} ».`;
  if ((m = /^A nozzle fan read 0 while its nozzle was at (\d+) degC or more, (\d+) samples in a row$/.exec(s))) return `Un ventilateur de buse indiquait 0 alors que sa buse était à ${m[1]} °C ou plus, ${m[2]} échantillons de suite`;
  if ((m = /^Nozzle (-?[\d.]+) degC, fan speed 0\.$/.exec(s))) return `Buse à ${num(m[1]!)} °C, vitesse du ventilateur 0.`;
  if ((m = /^The (\d+) degC threshold and the sample count come from one multi-colour print on one U1 \(about 18 000 samples, no fan at 0 above 45 degC\); they are not official values\.$/.exec(s))) return `Le seuil de ${m[1]} °C et le nombre d'échantillons viennent d'une seule impression multicolore sur une seule U1 (environ 18 000 échantillons, aucun ventilateur à 0 au-dessus de 45 °C) ; ce ne sont pas des valeurs officielles.`;
  if ((m = /^Connection dropped (\d+) times within (\d+) s$/.exec(s))) return `Connexion coupée ${m[1]} fois en ${m[2]} s`;
  if ((m = /^(connection_lost|connection_timeout) observed\.$/.exec(s))) return `${EVENT[m[1]!]} observée.`;
  if ((m = /^celsius (-?[\d.]+) is outside (-?[\d.]+) to (-?[\d.]+)\.$/.exec(s))) return `La valeur ${num(m[1]!)} °C est hors de la plage ${num(m[2]!)} à ${num(m[3]!)} °C.`;
  if ((m = /^(.+) \(official code (\d{4}-\d{4}-\d{4}-\d{4})\)$/.exec(s)) && EXACT[m[1]!]) return `${EXACT[m[1]!]} (code officiel ${m[2]})`;
  return null;
}
