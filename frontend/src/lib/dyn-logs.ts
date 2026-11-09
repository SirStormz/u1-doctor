/** French display forms of the findings read from imported log files (rules S25-S32). Display only: the backend text stays English (it is hashed). */
const EXACT: Record<string, string> = {
  "Read from log files provided by the user (IMPORTED): the files may be old, partial or edited, and each time is the clock written in the log (its time zone is not recorded).":
    "Lu dans des fichiers journaux fournis par l'utilisateur (IMPORTÉ) : les fichiers peuvent être anciens, partiels ou modifiés, et chaque heure est celle écrite dans le journal (son fuseau horaire n'est pas enregistré).",
  "Reported by the printer's exception manager during this live capture (read-only).": "Rapporté par le gestionnaire d'exceptions de l'imprimante pendant cette capture en direct (lecture seule).",
  "The on-screen code is rebuilt from the exception fields (level, id, index, code); the official wiki warns the displayed code may not be the real fault source.":
    "Le code affiché à l'écran est reconstruit à partir des champs de l'exception (niveau, id, index, code) ; le wiki officiel prévient que le code affiché peut ne pas être la vraie source du défaut.",
  "The exception index is not proven to be the toolhead number.": "Rien ne prouve que l'index de l'exception soit le numéro de la tête.",
  "What was printing and what the printer screen showed at that moment.": "Ce qui s'imprimait et ce que l'écran de l'imprimante affichait à ce moment-là.",
  "Follow the linked official procedure; do not bypass safety interlocks.": "Suivez la procédure officielle liée ; ne contournez pas les sécurités.",
  "Search the exact code on the official wiki or contact Snapmaker support.": "Cherchez le code exact sur le wiki officiel ou contactez le support Snapmaker.",
  "It came back several times: if the procedure does not stop it, contact Snapmaker support with these dates.": "Il est revenu plusieurs fois : si la procédure ne l'arrête pas, contactez le support Snapmaker avec ces dates.",
  "Pogopin disconnection during a print": "Déconnexion des pogopins pendant une impression",
  "Print-failure (noodle) detection": "Détection d'échec d'impression (spaghetti)",
  "The firmware reported that the electrical contact between a toolhead and the swapper was lost during the print and asked to clean and retry. The official page for the related toolhead-swapping anomaly says to clean the toolhead and the pogopin contacts on the swapper with a dust-free cloth, then resume.":
    "Le firmware a signalé que le contact électrique entre une tête et le changeur a été perdu pendant l'impression et demande de nettoyer puis de réessayer. La page officielle de l'anomalie de changement de tête voisine indique de nettoyer la tête et les pogopins du changeur avec un chiffon non pelucheux, puis de reprendre.",
  "The firmware printed 'detected noodle', which looks like its print-failure detection. The official table of this repository has no entry for this code, so no cause is inferred here. Look at the print on the printer and stop it if it has failed.":
    "Le firmware a affiché « detected noodle », qui ressemble à sa détection d'échec d'impression. La table officielle de ce dépôt n'a pas d'entrée pour ce code : aucune cause n'est déduite ici. Regardez la pièce sur l'imprimante et arrêtez l'impression si elle a échoué.",
  "Link counters in this log.": "Compteurs de liaison de ce journal.",
  "Whether a print failed at the same time, and the cable or power state of the affected controller.": "Si une impression a échoué au même moment, et l'état du câble ou de l'alimentation du contrôleur concerné.",
  "Power the printer off fully, check that the toolhead and swapper connectors are seated and clean, then watch whether the counters grow again.":
    "Éteignez complètement l'imprimante, vérifiez que les connecteurs de la tête et du changeur sont bien enfoncés et propres, puis regardez si les compteurs recommencent à monter.",
  "Counters are cumulative since the Klipper start; U1 Doctor has no official threshold, so any non-zero sync, crc or invalid count is shown as a fact, not as proof of a fault.":
    "Les compteurs sont cumulés depuis le démarrage de Klipper ; U1 Doctor n'a pas de seuil officiel : tout compteur sync, crc ou invalide non nul est montré comme un fait, pas comme la preuve d'un défaut.",
  "A log taken around a real fault, to compare with.": "Un journal pris autour d'un vrai défaut, pour comparer.",
  "No action: this is a healthy baseline.": "Aucune action : c'est une référence saine.",
  "A clean link record does not rule out a fault elsewhere (heater, sensor, mechanics).": "Une liaison propre n'exclut pas un défaut ailleurs (chauffe, capteur, mécanique).",
  "Power the printer off fully, read the code on the screen and follow its official procedure.": "Éteignez complètement l'imprimante, lisez le code à l'écran et suivez sa procédure officielle.",
  "Export the system log from the touchscreen for Snapmaker support.": "Exportez le journal système depuis l'écran tactile pour le support Snapmaker.",
  "A line that matches a shutdown phrase is a fact about the log, not a diagnosis.": "Une ligne qui contient une expression d'arrêt est un fait sur le journal, pas un diagnostic.",
  "Counts of link problems in this log.": "Nombre de problèmes de liaison dans ce journal.",
  "Wi-Fi signal strength over time, the router's own log, and whether prints were affected.": "La force du signal Wi-Fi au fil du temps, le journal du routeur, et si des impressions ont été touchées.",
  "Give the printer a fixed address (static lease) in the router, and move it or the access point closer if Wi-Fi disconnections are frequent.":
    "Donnez à l'imprimante une adresse fixe (bail statique) dans le routeur, et rapprochez-la du point d'accès si les déconnexions Wi-Fi sont fréquentes.",
  "Check the printer itself before concluding anything: a lost link does not mean it stopped.": "Vérifiez l'imprimante elle-même avant de conclure : une liaison perdue ne signifie pas qu'elle s'est arrêtée.",
  "These records describe the network and the cloud link, not the health of the printer.": "Ces traces décrivent le réseau et la liaison avec le cloud, pas la santé de l'imprimante.",
  "Cloud and name-resolution failures are common on home networks and do not by themselves stop local printing (not verified here).":
    "Les échecs du cloud et de la résolution de noms sont courants sur les réseaux domestiques et n'arrêtent pas à eux seuls l'impression locale (non vérifié ici).",
  "Why it failed (power, network, storage), and whether a later attempt worked.": "Pourquoi elle a échoué (alimentation, réseau, stockage), et si un essai ultérieur a fonctionné.",
  "Retry the update with the printer idle on a stable power and network connection.": "Relancez la mise à jour avec l'imprimante au repos, sur une alimentation et un réseau stables.",
  "If it fails again, keep the current firmware and contact Snapmaker support with the system log.": "Si elle échoue encore, gardez le firmware actuel et contactez le support Snapmaker avec le journal système.",
  "Exit code 143 usually means the script was stopped by a signal (shown as written; the cause is not in the log).": "Le code de sortie 143 signifie en général que le script a été arrêté par un signal (affiché tel quel ; la cause n'est pas dans le journal).",
  "Whether the camera works in the Snapmaker app, and which print was running.": "Si la caméra fonctionne dans l'application Snapmaker, et quelle impression était en cours.",
  "If you use timelapse, restart the printer and check the camera cable and the camera view; this record concerns timelapse frames only.":
    "Si vous utilisez le timelapse, redémarrez l'imprimante et vérifiez le câble et la vue de la caméra ; cette trace ne concerne que les images du timelapse.",
  "The meaning of the camera service code is not documented officially.": "Le sens du code du service caméra n'est pas documenté officiellement.",
  "Whether the printer shows as connected in Snapmaker Orca's device list, and which account is signed in.": "Si l'imprimante apparaît comme connectée dans la liste d'appareils de Snapmaker Orca, et quel compte est connecté.",
  "In Snapmaker Orca, sign in again and check that the printer is in the device list and bound to the account; use the printer's IP address as a fallback.":
    "Dans Snapmaker Orca, reconnectez-vous et vérifiez que l'imprimante est dans la liste d'appareils et liée au compte ; à défaut, utilisez son adresse IP.",
  "Orca's own message; its exact meaning is inferred from the text, not documented.": "Message propre à Orca ; son sens exact est déduit du texte, pas documenté.",
  "Wi-Fi quality at those times and whether the printer was off or asleep.": "La qualité du Wi-Fi à ces moments et si l'imprimante était éteinte ou en veille.",
  "Check that the printer and the PC are on the same network and that the printer's address did not change; a static lease in the router is the documented fix.":
    "Vérifiez que l'imprimante et le PC sont sur le même réseau et que l'adresse de l'imprimante n'a pas changé ; un bail statique dans le routeur est la solution documentée.",
  "A time-out describes the link, not the printer's health.": "Un délai dépassé décrit la liaison, pas la santé de l'imprimante.",
  "Encrypted system log recognized (not opened).": "Journal système chiffré reconnu (non ouvert).",
  "Its content: it is encrypted for Snapmaker support and U1 Doctor does not try to open it.": "Son contenu : il est chiffré pour le support Snapmaker et U1 Doctor n'essaie pas de l'ouvrir.",
  "Send this file unchanged to Snapmaker support; it is the file they ask for.": "Envoyez ce fichier tel quel au support Snapmaker ; c'est le fichier qu'il demande.",
  "Only the file name and size were read.": "Seuls le nom et la taille du fichier ont été lus.",
};

const UNIT: Record<string, string> = {
  "Wi-Fi disconnections": "déconnexions Wi-Fi", "name-resolution failures": "échecs de résolution de noms", "cloud connection drops": "coupures de la connexion cloud",
  "cloud sign-in failures": "échecs de connexion au cloud", "slicer heartbeat time-outs": "délais dépassés de présence du trancheur",
};

const s = (n: string) => (n === "1" ? "" : "s");

export function txLogs(str: string, rec: (x: string) => string): string | null {
  if (EXACT[str]) return EXACT[str]!;
  let m: RegExpExecArray | null;
  if ((m = /^Machine exception (\S+) raised (\d+) times? in the logs(?:: (.+))?$/.exec(str)))
    return `Exception machine ${m[1]} levée ${m[2]} fois dans les journaux${m[3] ? ` : ${rec(m[3])}` : ""}`;
  if ((m = /^Raised by the firmware \(level (\d+)\): (.*)$/.exec(str))) return `Levée par le firmware (niveau ${m[1]}) : ${m[2]}`;
  if ((m = /^Only the first (\d+) of (\d+) events are listed as evidence\.$/.exec(str))) return `Seuls les ${m[1]} premiers des ${m[2]} événements sont listés comme preuves.`;
  if ((m = /^Klipper link errors recorded on (\d+) of (\d+) controllers \((.+)\)$/.exec(str))) return `Erreurs de liaison Klipper enregistrées sur ${m[1]} contrôleurs sur ${m[2]} (${m[3]!.replace(/sync/g, "sync").replace(/invalid/g, "invalides")})`;
  if ((m = /^Klipper link counters stayed clean over (\d+) samples on (\d+) controllers \((.+)\); retransmitted bytes at most (\d+)$/.exec(str)))
    return `Les compteurs de liaison Klipper sont restés propres sur ${m[1]} échantillons et ${m[2]} contrôleurs (${m[3]}) ; octets retransmis au plus ${m[4]}`;
  if ((m = /^Klipper wrote: (.*)$/.exec(str))) return `Klipper a écrit : ${m[1]}`;
  if ((m = /^Klipper wrote a shutdown-type line (\d+) times?: (.*)$/.exec(str))) return `Klipper a écrit ${m[1]} ligne${s(m[1]!)} de type arrêt : ${m[2]}`;
  if ((m = /^Network trouble recorded in the logs: (.+)$/.exec(str))) {
    const parts = m[1]!.split(", ").map((p) => { const q = /^(\d+) (.+)$/.exec(p); return q && UNIT[q[2]!] ? `${q[1]} ${UNIT[q[2]!]}` : p; });
    return `Problèmes réseau enregistrés dans les journaux : ${parts.join(", ")}`;
  }
  if ((m = /^A firmware update attempt failed(?: \(script exit code (\d+)\))?$/.exec(str))) return `Une tentative de mise à jour du firmware a échoué${m[1] ? ` (code de sortie du script ${m[1]})` : ""}`;
  if ((m = /^Firmware update failed\.(?: Exit code (\d+)\.)?$/.exec(str))) return `La mise à jour du firmware a échoué.${m[1] ? ` Code de sortie ${m[1]}.` : ""}`;
  if ((m = /^Version check: printer (\S+), available (\S+)\.$/.exec(str))) return `Vérification de version : imprimante ${m[1]}, disponible ${m[2]}.`;
  if ((m = /^Timelapse: (\d+) frame captures failed(?: \(camera service code (.+)\))?$/.exec(str))) return `Timelapse : ${m[1]} captures d'image ont échoué${m[2] ? ` (code du service caméra ${m[2]})` : ""}`;
  if ((m = /^(\d+) timelapse frames could not be written\.$/.exec(str))) return `${m[1]} images du timelapse n'ont pas pu être écrites.`;
  if ((m = /^Snapmaker Orca reported 'Application is not activated' (\d+) times over (\d+) days$/.exec(str))) return `Snapmaker Orca a signalé « Application is not activated » ${m[1]} fois sur ${m[2]} jours`;
  if ((m = /^(\d+) records of 'Application is not activated'\.$/.exec(str))) return `${m[1]} traces de « Application is not activated ».`;
  if ((m = /^Snapmaker Orca lost contact with the printer: (.+)$/.exec(str))) {
    const parts = m[1]!.split(", ").map((p) => p.replace(/^(\d+) heartbeat time-outs$/, "$1 délais dépassés de présence").replace(/^up to (\d+) consecutive time-sync failures$/, "jusqu'à $1 échecs de synchro d'heure consécutifs"));
    return `Snapmaker Orca a perdu le contact avec l'imprimante : ${parts.join(", ")}`;
  }
  if ((m = /^Link problems counted in the slicer log\.$/.exec(str))) return "Problèmes de liaison comptés dans le journal du trancheur.";
  if ((m = /^The printer's encrypted system log was provided(?: \(firmware (\S+) in the file name\))?$/.exec(str))) return `Le journal système chiffré de l'imprimante a été fourni${m[1] ? ` (firmware ${m[1]} dans le nom du fichier)` : ""}`;
  return null;
}
