<p align="center">
<a href="https://sirstormz.github.io/u1-doctor/"><picture>
<source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/banner-dark.svg">
<img src="docs/media/readme/banner-light.svg" alt="U1 Doctor. When a print stops, know what happened. Local, read-only, no cloud, no telemetry, no AI." width="100%">
</picture></a>
</p>

<p align="center">
<a href="https://github.com/SirStormz/u1-doctor/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/SirStormz/u1-doctor/actions/workflows/ci.yml/badge.svg"></a>
<a href="https://github.com/SirStormz/u1-doctor/releases/latest"><img alt="release" src="https://img.shields.io/github/v/release/SirStormz/u1-doctor?include_prereleases&style=flat-square&labelColor=131416&color=ffc400"></a>
<a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/licence-MIT-ffc400?style=flat-square&labelColor=131416"></a>
<img alt="read-only" src="https://img.shields.io/badge/printer-read--only-ffc400?style=flat-square&labelColor=131416">
<br><a href="README.fr.md">Français</a>
</p>

<p align="center">
<a href="https://github.com/SirStormz/u1-doctor/releases/latest"><b>Download for Windows</b></a> &nbsp;|&nbsp;
<a href="https://sirstormz.github.io/u1-doctor/"><b>Website</b></a> &nbsp;|&nbsp;
<a href="https://sirstormz.github.io/u1-doctor/sample-report/"><b>Sample report</b></a> &nbsp;|&nbsp;
<a href="docs/INSTALL.md"><b>Install guide</b></a>
</p>

> Unofficial. Not affiliated with, endorsed by, or approved by Snapmaker.

https://github.com/user-attachments/assets/d7ad3b51-ea4c-40c8-b4de-bf7bd6530c2a

## Three questions, three answers

<p align="center"><picture>
<source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/questions-dark.svg">
<img src="docs/media/readme/questions-light.svg" alt="1. An offline decoder explains an error code and links the official wiki page. 2. A timeline shows only observed facts, with the gaps visible. 3. A U1-DEB evidence bundle is privacy-checked and replays on any PC." width="100%">
</picture></p>

U1 Doctor runs on your own PC. The decoder knows the 413 official codes; a code it does not know gives "inconclusive", never a guess.

## It only looks

<p align="center"><picture>
<source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/readonly-dark.svg">
<img src="docs/media/readme/readonly-light.svg" alt="The printer answers read-only requests from your PC. No command, no G-code, no pause goes the other way. Nothing goes to a cloud." width="100%">
</picture></p>

It cannot pause, cancel, restart or send G-code. It reads a printer only if you type its private address and tick an approval box, through a fixed list of at most 13 read-only requests (GET). Details: [threat model](docs/threat-model.md) and [SECURITY.md](SECURITY.md).

## No guessing

<p align="center"><picture>
<source media="(prefers-color-scheme: dark)" srcset="docs/media/readme/replay-dark.svg">
<img src="docs/media/readme/replay-light.svg" alt="A gap in the timeline stays a gap, it does not mean nothing happened. The same observations and the same rules always give the same hash." width="100%">
</picture></p>

Every fact keeps its source. Rules are a pure function, so anyone can replay a bundle and get the same result. What it does not claim: [limits](docs/LIMITS.md).

## Get started (Windows)

1. Download `u1-doctor-0.4.0-g1-win64.zip` from the [latest release](https://github.com/SirStormz/u1-doctor/releases/latest).
2. Right-click it, **Extract all**, then double-click `u1-doctor.exe`.
3. Switch on **Demo mode** to try it with clearly labelled synthetic data, or open **Diagnose** to read your own U1.

Checksum, SmartScreen, Linux, macOS and Docker: [install guide](docs/INSTALL.md).

## Four themes

![The Home screen in the four themes: Pupitre, Notice, Obsidienne and Visière](docs/media/themes.jpg)

Pick one in Settings. A theme changes the look only, never what the app says.

## Help wanted: a real failure

Only normal prints have been captured so far, so every incident in the app is synthetic. If your U1 stops, your report is what the rules need most.

- [Send an incident report](https://github.com/SirStormz/u1-doctor/issues/new?template=incident-report.yml) ([how, in two minutes](docs/SHARE_A_REPORT.md))
- [Snapmaker forum](https://forum.snapmaker.com/) and [Snapmaker Discord](https://discord.com/invite/snapmaker-official-1086575708903571536) (#u1-printer)

## Go deeper

| | |
|---|---|
| [How it works](docs/HOW-IT-WORKS.md) | The 28 rules, their sources and limits |
| [Everything it does](docs/OVERVIEW.md) | All screens, what works today, safety model, run from source |
| [Install](docs/INSTALL.md) and [log files](docs/LOGS.md) | Checksums, other systems, reading exported logs |
| [U1-DEB format](docs/U1-DEB.md) and [API](docs/API.md) | The evidence bundle and the local API |
| [Contributing](CONTRIBUTING.md) | Code, tests, how to help |

## License

MIT, see [LICENSE](LICENSE). The official Snapmaker repositories (`u1-klipper`, `u1-moonraker`, `u1-fluidd`) are GPL-3.0; no code is copied from them. Error-code descriptions are short paraphrases with links to the official wiki.
