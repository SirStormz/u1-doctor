# U1 Doctor — Protocole de validation matériel et plan de tests

**Statut : protocole de test à réaliser, aucune vérification physique réalisée lors de la rédaction.**

## 1. Accord et prérequis

- Le propriétaire désigne une U1, fournit volontairement son adresse sur le LAN et autorise **explicitement des lectures**.
- Machine sur firmware officiel ; noter version affichée à l'écran, date, build app, commit hash, IP uniquement dans fichier privé local.
- Ne pas modifier settings machine, root, SSH, config, fichiers, impression, chauffe ou moteurs.
- Si imprimante chauffe/imprime déjà, les tests restent strictement passifs ; ne pas provoquer des pannes.
- Toute commande Moonraker hors allowlist du cahier des charges est bloquée au niveau transport même si elle est présente dans le GUI ou suggérée par une IA.

## 2. Vérifications H-01 — connectivité et capacités

| Check | Observation | Statut initial |
|---|---|---|
| App écoute seulement localhost | Capture sockets/services | NOT_TESTED |
| `GET /server/info` | Réponse HTTP, auth, version Moonraker si visible | NOT_TESTED |
| `GET /printer/info` | État Klipper | NOT_TESTED |
| `GET /printer/objects/list` | Inventaire exact des objets | NOT_TESTED |
| `POST /printer/objects/query` | Lecture des objets découverts | NOT_TESTED |
| WS `/websocket` lecture seule | Abonnement validé, pas de méthode interdite | NOT_TESTED |
| Mapping quatre têtes | Preuve de correspondance T1–T4, sinon UNKNOWN | NOT_TESTED |
| Disponibilité codes U1 | Exposés par API ? sinon NOT_AVAILABLE | NOT_TESTED |
| Firmware réel vs Klipper version | Conserver séparés | NOT_TESTED |
| Capture réseau | Zéro mutation / accès externe | NOT_TESTED |

**Important :** la config publiée de Snapmaker mentionne 7125, mais ce port n'a pas été testé chez le propriétaire. Si inaccessible, documenter le problème sans rooter la machine.

## 3. H-02 — observation non intrusive d'une impression normale

1. Démarrer la lecture uniquement si propriétaire d'accord.
2. Observer une impression déjà prévue, sans envoyer de G-code ; consigner passage `standby` / `printing` / `complete` ou autres **états réellement vus**.
3. Vérifier rafraîchissement, fréquence réseau, reprise après perte WebSocket sans surcharger la machine.
4. Comparer timestamps UTC de réception et éventuel `eventtime` monotone ; calculer les incertitudes d'ordre et les gaps.
5. Exporter un exemple **redacted** après prévisualisation ; consigner la politique.

## 4. H-03 — déconnexion purement côté PC

1. Fermer l'adaptateur réseau U1 Doctor ou isoler uniquement le client dans un environnement de test contrôlé.
2. Vérifier que l'UI indique `OFFLINE` et `OBSERVATION GAP`, jamais « imprimante en panne ».
3. Rétablir la connexion client et vérifier session, horodatages et gaps. **Ne pas couper l'imprimante pour ce test.**

## 5. H-04 — mapping T1–T4

- Ne jamais associer `extruder` à une tête sur la seule base du nom de champ.
- Valider le mapping contre les ressources Snapmaker/états machine et une observation indépendante **sans créer de manœuvre artificielle**.
- Si doute, afficher `unmapped` et les champs bruts audités, sans conclusion par tête.

## 6. H-05 — replay indépendant

- Exporter un U1-DEB anonymisé ; copier sur autre PC ou CI ; charger **même version de ruleset** ; comparer findings canoniques et hashes.
- Faire varier volontairement la version des règles pour tester l'affichage du diff plutôt que de prétendre à une stabilité éternelle.
- Tester archive modifiée/incomplète/malveillante ; refuser proprement.

## 7. Cas sécurité négatifs obligatoires

- Rejeter les chemins `printer/gcode/script`, `printer/print/start`, `printer/print/pause`, `printer/print/cancel`, `printer/restart`, `machine/reboot`, `server/files/upload`, et toute route nouvelle non revue.
- Rejeter les appels WS `printer.gcode.script` et méthodes non allowlistées.
- Rejeter URL externe, 127.0.0.1 comme cible machine, adresse IPv6 non validée, redirection vers public IP, DNS rebinding, `HTTP_PROXY` imposé.
- Rejeter ZIP traversal, chemins absolus, symlink, archives énormes compressées, JSON excessif, chaîne de code malformée.
- Nettoyer IP/serial/SSID/tokens/hostname/filename sensibles dans U1-DEB ; assertions explicites sur valeurs sentinelles.

## 8. Modèle de compte rendu H-XX

```yaml
test_id: H-01
date_utc: null
approved_by_owner: false
app_git_commit: null
windows_version: null
u1_model: Snapmaker-U1
u1_official_firmware: UNKNOWN
machine_api_status: NOT_TESTED
read_only_requests_observed: []
blocked_calls_verified: []
capabilities_observed: []
missing_or_ambiguous: []
issues: []
artifacts_redacted: []
conclusion: NOT_EXECUTED
reviewer_notes: ""
```

Ce fichier peut être rempli par Claude Code uniquement depuis des observations réelles authentifiées par l'utilisateur et les sorties de test. Il est interdit de remplir « PASS » par supposition.

## 9. Matrice compatibilité à publier

| Firmware U1 | Windows | REST read-only | WS subscribe | Errors live | Toolheads mapping | Rapport |
|---|---|---|---|---|---|---|
| V2.1.0 (cible) | 11 | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| V2.0.0 (ancien) | 11 | UNTESTED | UNTESTED | UNTESTED | UNTESTED | UNTESTED |

Ne jamais cocher compatible pour un firmware non testé ; distinguer `SUPPORTED`, `PARTIAL`, `NOT_AVAILABLE`, `UNTESTED`, `FAILED`.
