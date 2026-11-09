import { expect, test } from "vitest";
import { tx } from "../src/lib/dyn";

test("log-import findings are translated with their numbers", () => {
  expect(tx("fr", "Machine exception 0001-0523-0000-0048 raised 3 times in the logs: Pogopin disconnection during a print"))
    .toBe("Exception machine 0001-0523-0000-0048 levée 3 fois dans les journaux : Déconnexion des pogopins pendant une impression");
  expect(tx("fr", "Machine exception 0002-0532-0000-0002 raised 1 time in the logs")).toBe("Exception machine 0002-0532-0000-0002 levée 1 fois dans les journaux");
  expect(tx("fr", "Raised by the firmware (level 2): detect filament tangled!")).toBe("Levée par le firmware (niveau 2) : detect filament tangled!");
  expect(tx("fr", "Network trouble recorded in the logs: 146 Wi-Fi disconnections, 58 name-resolution failures"))
    .toBe("Problèmes réseau enregistrés dans les journaux : 146 déconnexions Wi-Fi, 58 échecs de résolution de noms");
  expect(tx("fr", "A firmware update attempt failed (script exit code 143)")).toBe("Une tentative de mise à jour du firmware a échoué (code de sortie du script 143)");
  expect(tx("fr", "Timelapse: 47 frame captures failed (camera service code 69)")).toBe("Timelapse : 47 captures d'image ont échoué (code du service caméra 69)");
  expect(tx("fr", "Klipper link counters stayed clean over 9587 samples on 5 controllers (e0, e1, e2, e3, mcu); retransmitted bytes at most 9"))
    .toContain("sont restés propres sur 9587 échantillons");
  expect(tx("fr", "Snapmaker Orca reported 'Application is not activated' 81368 times over 12 days")).toContain("81368 fois sur 12 jours");
  expect(tx("fr", "The printer's encrypted system log was provided (firmware 2.0.0 in the file name)")).toContain("(firmware 2.0.0 dans le nom du fichier)");
  expect(tx("fr", "Read from log files provided by the user (IMPORTED): the files may be old, partial or edited, and each time is the clock written in the log (its time zone is not recorded).")).toContain("fournis par l'utilisateur");
  expect(tx("en", "Klipper wrote: Timer too close")).toBe("Klipper wrote: Timer too close");
});
