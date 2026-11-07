# Audit d'originalité — 2026-11-06

Méthode : lecture des pages publiques via le navigateur intégré (API JSON du forum Discourse, API GitHub publique, README bruts). Aucune connexion à une imprimante. Date de lecture : 2026-11-06. **À refaire le jour de la soumission** (les projets bougent vite : 25 sujets dans la catégorie Phase 2 en deux semaines).

Axes de comparaison de U1 Doctor :
- (a) diagnostic passif, lecture seule, sans jamais piloter la machine ;
- (b) explication de codes d'erreur avec règles déterministes et provenance ;
- (c) reconstruction d'incident (fenêtre observée, phases, trous déclarés) ;
- (d) dossier de preuves rejouable (U1-DEB : export, import sûr, rejeu local).

## 1. Résultat

**Aucun projet lu ne couvre (b), (c) et (d). Aucun ne se présente comme un outil d'analyse après incident.** Les voisins sont des tableaux de bord, des moniteurs ou des vérificateurs avant impression.

Recherches forum faites : « forensic », « diagnostic », « log », « error code », « replay », « bundle », « incident », « evidence », « timeline », « troubleshooting ». Aucun sujet récent (depuis septembre 2026) ne correspond. Les résultats pour « incident », « evidence » et « troubleshooting » sont des questions d'utilisateurs ou des projets sans rapport (Print Rescue, Fix Pack, Dry Run).

Limite : la recherche Discourse renvoie parfois zéro résultat sur des termes génériques ; l'absence de résultat n'est pas une preuve d'absence. La catégorie Phase 2 a été listée en entier (25 sujets), c'est la base la plus fiable.

## 2. Projets comparés

| Projet | Source / licence | Ce que c'est | (a) | (b) | (c) | (d) |
|---|---|---|---|---|---|---|
| **U1 Monitor IC** | forum 44029, 2026-11-03 ; dépôt `koicheviv/Snapmaker-U1-Monitor-IC` ; **aucune licence déclarée** ; C# | Appli Android : détecte le début d'une impression, allume l'écran du téléphone, le verrouille 15 min après la fin | faible | aucun | aucun | aucun |
| **Snapmaker Studio** | forum 43460, 2026-09-23 ; `DVOpenLabs/snapmaker-studio` ; **MIT** | Vérificateur avant impression de 3MF/STL, compare au profil de la machine via Moonraker, répare ce qui est justifiable | faible | aucun | aucun | faible (« prouve ce qui a survécu » côté fichier, pas côté incident) |
| **U1 Print Hub** (u1hub) | `dlgambill/u1hub` ; **MIT** ; 70 étoiles ; lauréat Tier 3 Phase 1 | Tableau de bord de ferme : file, planification, caméras, bobines. **Pilote** les imprimantes | moyen | faible | moyen | faible |
| hanye | forum 43823, 2026-10-28 ; fermé | Console de supervision de ferme, « journaux de traçabilité » | moyen | aucun | moyen | aucun |
| SliceGate | forum 44000, 2026-11-03 | Vérificateur de 3MF multi-outils avant impression | aucun | aucun | aucun | aucun |
| PaxxMaker | forum 43909, 2026-10-30 | Moniteur iOS (nécessite Paxx12 Extended) | faible | aucun | aucun | aucun |
| U1 Print Rescue | forum 44080, 2026-11-05 | Proposition : caméra en direct pour sauver une impression | aucun | aucun | aucun | aucun |
| Print Cost & Profit, MakerStride | forum 43827, 43994 | Coûts, bobines, travaux | aucun | aucun | aucun | aucun |
| U1 Dry Run | `DesignMaster-Solutions/u1-dryrun` ; GPL-3.0 | Passe le G-code dans le vrai firmware U1 sans imprimante | aucun | faible | aucun | aucun |
| U1 Fix Pack | forum 44036 | Correctifs firmware | aucun | aucun | aucun | aucun |

Autres dépôts GitHub trouvés (MoonrakerMonitor, ioBroker.snapmaker-u1, spoolman-klipper-helper, `u1-diagnostico`) : monitoring LED, domotique, bobines, relevé photo de tests. Aucun ne touche (b), (c) ou (d).

## 3. Voisins à citer honnêtement

**U1 Print Hub** est le seul vrai point de contact. Ses deux fonctions proches :
- le **Logbook** consigne automatiquement chaque pause ou erreur « avec une raison » et ce qui l'a réglée ; c'est un journal de maintenance, pas une reconstruction d'incident ;
- **Download diagnostics** produit un fichier à joindre à une issue GitHub ; c'est un envoi de support pour l'outil lui-même, pas un format de preuve rejouable de la machine.

Différences à dire clairement : le Hub **pilote** la machine (pause, reprise, annulation, envoi de fichiers) ; U1 Doctor ne le fait jamais. Le Hub affiche le message du firmware ; U1 Doctor applique des règles versionnées avec provenance par observation.

**hanye** : proche en vocabulaire (« journaux de traçabilité »), mais produit fermé, orienté ferme en Chine, U1 non livré.

## 4. Ce qui est vraiment différent

1. **Provenance par observation** : chaque fait est marqué REAL, SYNTHETIC, USER_REPORTED ou IMPORTED, avec qualité d'horodatage et de mapping.
2. **Règles déterministes et rejouables** : mêmes observations + même jeu de règles = mêmes constats, empreintes SHA-256 à l'appui.
3. **U1-DEB** : export déterministe, import sûr (liste blanche, taille, ratio, hash), rejeu local qui recalcule toujours les constats.
4. **Aveux explicites** : « NO_GAP_RECORDED » au lieu de « complet », trous seulement s'ils sont déclarés, SHA-256 présenté comme preuve d'intégrité et jamais d'authenticité.
5. **Lecture seule vérifiée par test** (liste de refus des endpoints qui modifient).
6. **Signal de demande réel** : les logs officiels U1 sont chiffrés (page wiki « U1 export log » : lisibles seulement par le support). Un outil qui s'appuie sur des observations autorisées répond à ce besoin.

## 5. Risques et formulation recommandée

- **Risque de surenchère** : « premier » ou « seul » est invérifiable. Ne pas l'écrire.
- **Risque de chevauchement perçu** avec Print Hub (logbook, diagnostics). À traiter dans le README et le formulaire, pas à cacher.
- **Aveu sur la preuve matérielle** : une seule capture réelle (impression normale). Aucune panne réelle capturée. À dire tel quel, car le critère « Completeness » demande une validation sur U1 réelle.
- **Licence de Monitor IC** : aucune. Aucune réutilisation de code, de toute façon (aucun code partagé).
- Aucun code, texte ni jeu de données d'un autre projet n'est repris dans U1 Doctor. Les lignes de la table d'erreurs du wiki sont **paraphrasées**, avec lien.

**Déclaration proposée pour le formulaire** (à valider par le propriétaire) :

> Projet original. Outil local de diagnostic en lecture seule qui explique des codes d'erreur et reconstruit un incident à partir d'observations marquées par provenance, avec un format de dossier de preuves rejouable (U1-DEB). Les projets proches (tableaux de bord et moniteurs, dont U1 Print Hub, et vérificateurs avant impression) ne font pas d'analyse après incident ni de rejeu ; nous les citons dans le README. Aucun code tiers repris.

Catégorie « Original New Idea » : défendable pour le cœur, pas pour les briques communes (lecture Moonraker, interface).

## 6. À refaire avant soumission

- Relire la catégorie Phase 2 (nouveaux sujets depuis le 2026-11-06).
- Rouvrir `dlgambill/u1hub` : le Logbook ou le diagnostic ont-ils évolué vers un format de preuve ?
- Relire hanye (le livrable U1 est-il sorti ?).
- Ouvrir les dépôts `DVOpenLabs/snapmaker-studio` et SliceGate : non lus au-delà du forum.
- Décision propriétaire : key art et licence du dépôt.

Sources : forum.snapmaker.com sujets 43460, 44029, 43227, 43823, 43909, 44000, 44080, 43827, 43994 ; catégorie 114 ; dépôts `dlgambill/u1hub`, `koicheviv/Snapmaker-U1-Monitor-IC`, `DVOpenLabs/snapmaker-studio` ; wiki.snapmaker.com (U1 export log, u1 error codes).
