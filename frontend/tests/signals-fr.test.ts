import { expect, test } from "vitest";
import { tx } from "../src/lib/dyn";

test("signal findings keep their numbers in French and use decimal commas", () => {
  expect(tx("fr", "celsius -12.3 is outside -10 to 110.")).toBe("La valeur -12,3 °C est hors de la plage -10 à 110 °C.");
  expect(tx("fr", "SYNTHETIC: Code 0003-0522-0001-0016 declared 3 times within 900 s")).toBe("SYNTHÉTIQUE : Code 0003-0522-0001-0016 déclaré 3 fois en 900 s");
  expect(tx("fr", "Connection dropped 4 times within 600 s")).toBe("Connexion coupée 4 fois en 600 s");
  expect(tx("fr", "connection_lost observed.")).toBe("connexion perdue observée.");
});

test("the official-code suffix of the bed hypothesis is translated, not dropped", () => {
  const en = "The official page gives -10 to 110 degC as the normal bed range and lists wiring and sensor checks when it is left (official code 0003-0526-0000-0000)";
  const fr = tx("fr", en);
  expect(fr).toContain("(code officiel 0003-0526-0000-0000)");
  expect(fr).not.toBe(en);
  expect(tx("en", en)).toBe(en);
});

test("Dry Run prediction findings are translated with their numbers", () => {
  expect(tx("fr", "Dry Run predicts 3 firmware errors and 12 scars in the sliced file")).toBe("Dry Run prédit 3 erreurs du firmware et 12 cicatrices dans le fichier tranché");
  expect(tx("fr", "Predicted scar at line 900, clearance 0.2 mm.")).toBe("Cicatrice prédite à la ligne 900, dégagement 0,2 mm.");
  expect(tx("fr", "Predicted firmware error at line 42.")).toBe("Erreur du firmware prédite à la ligne 42.");
  expect(tx("fr", "Prediction made by simulating the sliced file, not an observation of a machine.")).toContain("pas une observation");
  expect(tx("en", "Predicted firmware error at line 42.")).toBe("Predicted firmware error at line 42.");
});
