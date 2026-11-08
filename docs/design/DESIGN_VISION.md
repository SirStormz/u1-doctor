# DESIGN_VISION — « Instrument Noir » (G0.5-B, 2026-11-05)

> **Statut : validé par le propriétaire le 2026-11-05 (améliorations ultérieures prévues).** Le prototype navigable est implémenté (`frontend/`); raffinements possibles. Les planches d'inspiration IA de la v2 ont été supprimées (non produit). `docs/design/keyart/u1-keyart-poster.png` (validé par le propriétaire) est un rendu stylisé, pas une preuve de fonctionnalité.

## En une phrase
**Le tableau de bord d'un enquêteur d'incidents** : calme, dense là où il le faut, jamais décoratif — un instrument de précision plutôt qu'un dashboard de jeu ou un gabarit React.

## Trois sentiments visés
1. **Confiance** par la *traçabilité* : chaque donnée porte sa provenance, ses limites et un chemin vers les preuves en un clic. Pas de gros « OK » vert.
2. **Maîtrise** : la lecture seule est une propriété visible (bandeau DEMO, pastille READ-ONLY, bandeau de sécurité permanent), pas une note de bas de page.
3. **Clarté sous stress** : devant une erreur rouge sur une imprimante arrêtée, le sens officiel, la gravité et la prochaine étape sûre en ≤ 3 s (palette `Ctrl K` : coller un code).

## Éléments signature
| Élément | Rôle | Pourquoi c'est à nous |
|---|---|---|
| Accent cyan `#00C7FF` sur marine quasi noir | identité, focus, état actif | repris de la référence ; ≤ 5 % des pixels |
| **Bande de trou** (hachures) | montre l'absence d'observation, sur les graphiques **et** par-dessus les voies d'état | la thèse du produit : absence de données ≠ absence de problème |
| **Puce de provenance** | REAL · SYNTHETIC · USER_REPORTED · IMPORTED + qualité de l'heure | la provenance est un objet de premier rang |
| **Registre des preuves** (comptes pour/contre/manquant) | remplace tout score de confiance | véridique et lisible d'un coup d'œil |
| **Sceau de rejeu** | « Même résultat » + préfixe SHA-256 | reproductibilité visible |
| **Bandeau de sécurité** | « Lecture seule · 0 commande envoyée · local uniquement » | la garantie devient un signal de confiance |
| **Fait / hypothèse** (cadre plein vs tirets, lien pointillé « proximité temporelle ») | jamais de « cause » dessinée | évite visuellement la sur-causalité |
| **Machine 3D réelle** (modèle 3D du propriétaire) | héros de l'Overview, pièces survolables, vue éclatée | donne un ancrage physique ; étiquetée *illustration* |

## Logique de couleur (sémantique, jamais décorative)
Cyan = interactif/identité · Vert = observé/valide · Ambre = avertissement, donnée incomplète · Rouge = gravité officielle « erreur » uniquement · **Violet = DEMO** (réservé) · Bleu = REPLAY · Gris = inconnu/indisponible. La couleur n'est jamais seule : chaque état a un libellé et une icône de forme différente.

## Langage des modes (impossible à confondre)
| Mode | Traitement |
|---|---|
| **DEMO** (seul état atteignable dans cette version) | pastille violette en haut + **bandeau hachuré violet pleine largeur** « DEMO · données synthétiques · ne provient pas d'une imprimante » + contour **pointillé violet** sur toutes les cartes de données + puces `SYNTHETIC`. Aucun élément « connecté » n'existe (absent, pas désactivé). |
| **REPLAY** | pastille + bandeau bleus « mêmes entrées + mêmes règles = même résultat » |
| **OFFLINE / CONNECTED / STALE** | conçus (voir DESIGN_SYSTEM), **non atteignables** dans cette version ; l'écran Connexion les documente comme « NON DISPONIBLE DANS CETTE VERSION » |

## Mouvement (premium = retenue)
120 ms survol/focus · 200 ms changement d'état · 320 ms entrée de panneau, cascade ≤ 40 ms/carte. `transform` et `opacity` uniquement (test automatique). **Tout est neutralisé sous `prefers-reduced-motion`**, y compris l'intro 3D et la rotation auto. Aucune animation en boucle hors rotation 3D (désactivable), aucune lueur pulsante, aucune animation porteuse de sens.

## Ce que nous ne faisons délibérément pas
Pas de score de santé, pas de % de confiance, pas de jauges, pas de badge « IA », pas de fausse barre de fenêtre, pas de glassmorphism, pas de dégradé sur les cartes, pas d'illustration stock. (Test automatique : aucun `%`, « health », « confidence » dans aucun des 10 écrans.)

## Où nous dépassons la référence (et pourquoi) — voir `MOCKUP_AUDIT.md` §3
Puces de provenance, registre des preuves, bandes de trou, sceau de rejeu, palette de commandes `Ctrl K` (coller un code), bandeau de sécurité, trois thèmes issus des mêmes tokens, vue éclatée 3D, vue tableau alternative du graphique (accessibilité).

## Alternatives à valider
- **Thème** : A *Nuit* (défaut) · B *Graphite* (neutre, plus « outil pro ») · C *Clair* (projection/impression/accessibilité). Les trois sont implémentés (sélecteur en haut à droite) et testés en contraste.
- **Navigation** : A *Barre latérale* (implémentée ; repliée en rails d'icônes sous 1440 px) · B *Onglets en haut* (concept 3 ; ~1 jour).
- **Densité** : *Confortable* (défaut) / *Compacte* (implémentée, Réglages).
- **Héros Overview** : A *Machine 3D interactive* (implémentée) · B *Key art statique* (utilisé comme repli sans WebGL et en Accueil).

## v3 « Cinéma contrôlé » (2026-11-05, branche `design-v3`)
Direction ajoutée à la demande du propriétaire (concours) : on garde la sémantique, la provenance et la retenue côté données, mais l'enveloppe devient cinématique.
- **Landing scrollytelling** (URL nue `#/`) : une scène three.js fixe pilotée par le scroll — scan (solide au-dessus d'un plan, fil de fer cyan en dessous) → dissection (vue éclatée) → preuves (fil d'attache 3D → carte Fait / Hypothèse / Trou) → rejeu. Titre : « Every error has proof. » / « Chaque erreur a une preuve. ». Les cartes de la landing sont étiquetées SYNTHETIC.
- **Nombre d'or (φ)** : colonnes 1 : 1,618 (Overview, héros 3D décalé de (1/φ²)/2), échelle typographique 16 px × φ^(n/2), espacements 8 px × φⁿ, durées 324/524/848/1372 ms, décalage 62 ms, easing `cubic-bezier(.618,0,.382,1)`, trajectoire de caméra. Touche **G** : superpose la construction dorée (grille 38,2/61,8 + spirale) sur la landing et dans l'app.
- **Dans l'app** : transition de page (opacité + translation), indicateur de navigation partagé (layoutId), compteurs, balayage de scan unique sur le héros 3D.
- **Contraintes tenues** : `transform`/`opacity` seulement, aucun % ni score, `prefers-reduced-motion` ⇒ pas de canvas, illustration statique ; qualité auto-adaptative (couche fil de fer retirée sur GPU faible) ; WebGL absent ⇒ repli image.
- **Limite connue** : le modèle 3D est une illustration réalisée par le propriétaire, pas de la CAO officielle ; les tubes PTFE statiques ne se plient pas.

## v4 « Manuel de service » (2026-11-05) — remplace l'identité cyan/Instrument Noir
Décision du propriétaire après comparaison de 3 directions (`docs/design/directions-v4/`, comparaison dans un Artifact design) : **C, manuel de service**. Le bleu/cyan et la structure « dashboard à barre latérale » sont abandonnés.
- **Palette** : blanc cassé `#F4F4F0`, noir `#0E0E0E`, le jaune de la machine `#FFC400` (remplissages et repères seulement ; le texte d'accent reste noir pour le contraste). Sémantique inchangée : vert observé, orange avertissement, rouge erreur officielle, violet DEMO, bleu REJEU. Thèmes : *Manuel* (défaut, clair), *Atelier* et *Graphite* (sombres, accent jaune).
- **Structure** : barre noire (marque, DEMO, LECTURE SEULE, palette Ctrl K, thème, langue) + index numéroté 01-10 (plus de barre latérale) + pied noir. Titres « FIG. nn / 10 », étiquettes jaunes à bord plein, panneaux à filets noirs, tableaux réglés, chiffres géants.
- **Fait / hypothèse / trou** : plein, **tirets**, hachures — les tirets ne servent plus qu'aux hypothèses (les panneaux de démo ne sont plus en pointillé).
- **Landing** (`#/`) : studio clair, U1 3D avec traits d'attache jaune/noir vers les chiffres 01-04, scan, vue éclatée, cartes Fait/Hypothèse/Trou, rejeu, bloc de fin noir à filet jaune.
- **3D** : seulement là où elle sert (landing, héros de l'Overview). Couleurs de bobines = celles des photos réelles (noir, jaune, blanc, rouge). Lettrage et écran suivent le capot pendant l'éclatement.
- **φ** et mouvement : inchangés (échelle typographique, espacements, durées, easing, raccourci Alt+G, sans touche unique : WCAG 2.1.4).
- **Audit** : 10 écrans relus à 1440×810 en thème Manuel (+ Atelier en EN/FR) ; corrigés : titre/icône empilés, viewer écrasé par `container-type:size`, pastilles de thème encore bleues, Accueil avec le key art bleu (supprimé), chiffres fantômes de la landing, lettrage 3D dispersé. Limite : modèle 3MF « nano » communautaire, licence inconnue, git-ignoré.
