# UX_ARCHITECTURE (G0.5-B)

Routes par hash (`#/overview`, `#/evidence/<id>`…), données partagées par `IncidentProvider` (1 chargement : scénario démo `demo_extrusion_blockage` + rejeu + décodage + compatibilité + santé). **Aucune route ne parle à une imprimante** ; le contrat API existant est inchangé (ajout additif : `capabilities` dans `/compatibility`, fixture `demo_extrusion_blockage`).

## Parcours
- **P-01 Code → sens (≤ 30 s)** : `Ctrl K` → coller `dddd-dddd-dddd-dddd` → résultat dans la palette (gravité, titre officiel) → Entrée → écran Codes d'erreur (limites, référence, gravité critique en alerte).
- **P-03 Incident → timeline → preuves → rapport** : Overview → « Ouvrir la chronologie » → curseur → Conclusions → Détail des preuves → Composeur de rapport (contrôle de confidentialité réel, export).
- **P-04 Indéterminé** : code inconnu = `INCONCLUSIVE` + « format valide, absent du catalogue » ; code mal formé = rejet explicite ; série interrompue = « PAS DE DONNÉE ».
- **Rejeu** : Laboratoire de rejeu → deux exécutions → « Identique à l'exécution précédente ».

## Les 10 écrans (fidélité : ● complet · ◐ prototype fonctionnel, contenu allégé)
| # | Écran | But / contenu | États traités | Fidélité |
|---|---|---|---|---|
| 1 | **Accueil / Confidentialité** | promesse, 3 piliers, points de confidentialité, CTA démo / décoder un code, key art | — | ● |
| 2 | **Connexion** | conçue, **désactivée** : étapes, champ adresse (IPv4 privée), liste des 5 requêtes autorisées, liste des refus permanents | `unavailable` | ◐ |
| 3 | **Overview** ★ | machine 3D (héros), dernier incident (gravité officielle, fil temporel mini), registre des preuves, compteurs observés/non concluants, disponibilité réelle (UNTESTED / TESTED_SYNTHETIC) | loading, error+retry | ● |
| 4 | **Codes d'erreur** | saisie, exemples officiels, résultat (gravité, module, tête d'après la table, limites, lien officiel), alerte critique 0003 | empty, error, malformed, structure-only, critique | ● |
| 5 | **Chronologie** ★ | événements, graphique multi-voies avec bande de trou et curseur clavier, valeurs au curseur (provenance + qualité de mapping), carte faits/hypothèses, sceau de rejeu, vue tableau | loading, error, empty, no data, série interrompue | ● |
| 6 | **Conclusions** | table triée statut → qualité, filtre, ouverture clavier/clic | empty (filtre), error | ● |
| 7 | **Détail des preuves** ★ | conclusion + puces, pour/contre/manquant, observations liées (provenance, heure), limites, actions sûres, référence officielle, hashes copiables | empty, prev/next | ● |
| 8 | **Laboratoire de rejeu** | choix de scénario, exécution, sceau, historique, comparaison à l'exécution précédente | empty, error | ● |
| 9 | **Composeur de rapport** ★ | aperçu du document avec champs retirés, contenu du dossier (SHA-256 **réels**), contrôle de confidentialité sur les fichiers exacts, export ZIP de démonstration | loading (hash), désactivé si un motif sensible est trouvé | ● |
| 10 | **Réglages / Compatibilité** | thème, densité, langue, versions/mode, matrice de capacités, limites | loading | ◐ |

## Règles d'interface transverses
Mode toujours visible (pastille + bandeau). Provenance et qualité de l'heure sur chaque observation. Jamais de pourcentage, de score de santé ni de « cause » dessinée. Les valeurs ne s'affichent que si un échantillon existe, sans trou entre l'échantillon et le curseur (≤ 120 s). Les étiquettes « Tête N » du modèle 3D sont `NON ASSOCIÉE`. Toute action d'export est précédée d'un contrôle visible.

## Clavier
`Ctrl/⌘ K` palette · flèches/Entrée/Échap dans la palette · curseur de chronologie : ← → Début Fin PgUp PgDn · Tab/Maj+Tab dans l'ordre visuel · lien « Aller au contenu ».

## Hors périmètre du prototype (conçu mais non branché)
Connexion réelle (G2), import U1-DEB et writer U1-DEB final (G4), rétention configurable, capture live, états CONNECTED/STALE réels.
