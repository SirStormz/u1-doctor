# Share an incident report

U1 Doctor never sends anything by itself. If you want to help improve it with a **real incident** from your own Snapmaker U1, you send it yourself, through a GitHub issue. This page explains how, what to include, and what happens next.

Why it matters: so far only normal prints have been captured on a real U1, so every incident in the app is `SYNTHETIC`. The rules were written from the official documentation. A real incident is the only way to find out where they are wrong or too weak.

## What you can share

- A **written description**: the error code, the firmware, the moment, what you saw and what U1 Doctor said. Always useful.
- Optionally, an **evidence bundle** (`U1-DEB`, a zip) of your own capture. It can be opened and replayed on another machine, which is what makes a report checkable. Take a read-only capture of your U1 from the **Connect** screen (tick *Save the capture in History*), then on the **Report** screen choose it under *Report source* and press **Export bundle**. The privacy scan on that screen reads the exact files that would be exported.

## 1. Gather what is useful

1. **The exact error code** shown on the printer screen, in the form `dddd-dddd-dddd-dddd` (copy it character by character).
2. **The firmware version**, if you know it, and **when** it happened: during a print, while heating, during a tool change, while idle.
3. **What you saw and tried**, in your own words.
4. **What U1 Doctor said**, if you ran it: open the **Findings** screen and copy the finding titles. Mention if a capture was taken during or after the problem.
5. **A bundle**, if you have a capture (see above). Open the zip first and read `privacy-report.json` and `observations.jsonl`: they list what was removed and the facts that would be shared (states, action codes, temperatures about once a minute, timestamps). If you see anything personal, do not attach it.

## 2. Check it before you post (one minute)

Everything you post in an issue is **public and stays indexed even if you delete it later.** Before posting, read your text and any screenshot and remove:

- IP addresses, MAC addresses, e-mail addresses and URLs;
- serial numbers and printer names;
- file names of your prints (a screenshot of the printer screen can show one);
- anything you would not show a stranger.

U1 Doctor's own capture never contains your address or file names, and the export removes addresses, e-mails, URLs, local paths and print-file names on a best-effort basis. Redaction cannot guarantee anonymity, and your screenshots and your text might hold more.

## 3. Open the issue

Open [**New issue, Incident report**](https://github.com/SirStormz/u1-doctor/issues/new?template=incident-report.yml), fill the short form, drag the bundle in if you have one, and tick the confirmations (you checked the content, you know it is public, and, only if you want it, that the bundle may become a test fixture).

## 4. What happens next

1. The maintainer reads the report and answers in the issue. Reports are labelled `incident-report` and `needs-review`.
2. The code, firmware and findings you describe are compared with what the rules say. A rule that did not fire, or fired wrongly, is a concrete thing to fix.
3. A real incident can confirm or break a rule that today rests on documentation only: for example which toolhead an error code points to, or the thresholds of the fan and swap-counter rules.
4. **Only if you ticked the permission box**, and after a second look at the privacy report, a bundle may be added under `fixtures/community/` as a test fixture, always labelled as community-provided and imported (never `REAL`, which is reserved for the owner's own captures). Removing something from a git history later means rewriting it, so nothing is added before the review.

## What we will not do

- Publish anything you did not choose to post.
- Treat one report as proof of a cause. A report is evidence, and the findings stay labelled as such.
- Add data you gave to the repository without asking you first.

## En français

U1 Doctor n'envoie jamais rien de lui-même. Pour aider avec un **vrai incident** : note le **code d'erreur exact** affiché sur l'écran, la version du firmware, le moment (pendant une impression, une chauffe, un changement d'outil, à l'arrêt), ce que tu as vu et essayé, et ce que l'écran **Constats** de U1 Doctor a indiqué. Relis ton texte, tes captures et ton paquet : **tout ce qui est posté dans une issue est public et reste indexé, même effacé** (pas d'IP, de numéro de série, de nom de fichier). Puis ouvre une [issue « Incident report »](https://github.com/SirStormz/u1-doctor/issues/new?template=incident-report.yml). Pour un paquet rejouable : écran Connexion (case « Enregistrer la capture dans l'Historique »), puis écran Rapport, choisis la capture dans « Source du rapport » et exporte. Rien n'est ajouté au dépôt sans ton accord explicite.
