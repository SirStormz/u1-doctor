# Share an incident report

U1 Doctor never sends anything by itself. If you want to help improve it with a **real incident** from your own Snapmaker U1, you send it yourself, through a GitHub issue. This page explains how, what to include, and what happens next.

Why it matters: so far only normal prints have been captured on a real U1, so every incident in the app is `SYNTHETIC`. The rules were written from the official documentation. A real incident is the only way to find out where they are wrong or too weak.

## What works today, honestly

- You can take a read-only capture of your own U1 from the **Connect** screen and read its findings in the app (see [`INSTALL.md`](INSTALL.md)).
- The **Report** screen exports an evidence bundle (`U1-DEB`) **of the built-in demo scenario only**. Exporting a bundle of your own saved capture is not available yet, so an incident report today is a **written description plus what the app shows**, not a file.
- Because of that, a report cannot be replayed on another machine yet. It is still valuable: the error code, the firmware, the moment, and which findings fired or stayed silent are exactly what tells us if a rule is right.

## 1. Gather what is useful

1. **The exact error code** shown on the printer screen, in the form `dddd-dddd-dddd-dddd` (copy it character by character).
2. **The firmware version**, if you know it, and **when** it happened: during a print, while heating, during a tool change, while idle.
3. **What you saw and tried**, in your own words.
4. **What U1 Doctor said**, if you ran it: open the **Findings** screen and copy the finding titles, or take a screenshot. Mention if a capture was taken during or after the problem.

## 2. Check it before you post (one minute)

Everything you post in an issue is **public and stays indexed even if you delete it later.** Before posting, read your text and any screenshot and remove:

- IP addresses, MAC addresses, e-mail addresses and URLs;
- serial numbers and printer names;
- file names of your prints (a screenshot of the printer screen can show one);
- anything you would not show a stranger.

U1 Doctor's own capture never contains your address or file names, but your screenshots and your text might.

## 3. Open the issue

Open [**New issue, Incident report**](https://github.com/stormz85ia/u1-doctor/issues/new?template=incident-report.yml), fill the short form and tick the two confirmations (you checked the content, and you know it is public).

## 4. What happens next

1. The maintainer reads the report and answers in the issue. Reports are labelled `incident-report` and `needs-review`.
2. The code, firmware and findings you describe are compared with what the rules say. A rule that did not fire, or fired wrongly, is a concrete thing to fix.
3. A real incident can confirm or break a rule that today rests on documentation only: for example which toolhead an error code points to, or the thresholds of the fan and swap-counter rules.
4. If a replayable file would help, the maintainer asks you in the issue, and nothing is added to the repository without your explicit yes.

## What we will not do

- Publish anything you did not choose to post.
- Treat one report as proof of a cause. A report is evidence, and the findings stay labelled as such.
- Add data you gave to the repository without asking you first.

## En français

U1 Doctor n'envoie jamais rien de lui-même. Pour aider avec un **vrai incident** : note le **code d'erreur exact** affiché sur l'écran, la version du firmware, le moment (pendant une impression, une chauffe, un changement d'outil, à l'arrêt), ce que tu as vu et essayé, et ce que l'écran **Constats** de U1 Doctor a indiqué. Relis ton texte et tes captures : **tout ce qui est posté dans une issue est public et reste indexé, même effacé** (pas d'IP, de numéro de série, de nom de fichier). Puis ouvre une [issue « Incident report »](https://github.com/stormz85ia/u1-doctor/issues/new?template=incident-report.yml). À ce jour, l'écran Rapport n'exporte qu'un scénario de démo : un paquet rejouable de ta propre capture n'est pas encore possible, et rien n'est ajouté au dépôt sans ton accord explicite.
