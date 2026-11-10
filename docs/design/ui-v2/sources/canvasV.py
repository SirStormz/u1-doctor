"""Ajoute la rangée V « Visière » à maquettes/canvas.json et prépare le dossier de publication.

python sources/canvasV.py <dossier_racine>   (copie project/canvas.json + project/V-*.dc.html)
"""
import json, pathlib, shutil, sys

B = pathlib.Path(__file__).parent
M = B.parent / "maquettes"
Y = 7300
BOARDS = [
    ("V-Accueil.dc.html", 2180, "V · 1 · Visière : Accueil, réticule verrouillé sur la tête 3, scan hologramme, titre qui se décode"),
    ("V-Expert.dc.html", 1850, "V · 2 · Visière : Expert, vue hologramme à glisser, radar de session qui rejoue"),
    ("V-Verdict.dc.html", 1140, "V · 3 · Visière : Verdict, le réticule vole de cible en cible (cliquable)"),
    ("V-Diagnostiquer.dc.html", 1120, "V · 4 · Visière : Diagnostiquer, verrouiller un mode, maintenir pour autoriser"),
]

c = json.loads((M / "canvas.json").read_text(encoding="utf-8"))
present = [n for n, _, _ in BOARDS if (M / n).exists()]
for i, (name, h, title) in enumerate(BOARDS):
    if name not in present:
        continue
    c["boards"][name] = {"expand": "fill", "h": h, "is_interactive": True, "radius": 24, "title": title,
                         "w": 1440, "x": i * 1520, "y": Y}
    if name not in c["order"]:
        c["order"].append(name)
c["notes"]["rowV"] = {"kind": "title1", "maxW": 7520, "w": 240, "x": 0, "y": Y - 195,
                      "text": "V · Visière : HUD de casque néon or et rouge sur la vraie U1 (retouches Codex des rendus U1_Jay), hologramme tiré des pixels du rendu, réticule qui verrouille la tête 3, verre liquide sombre, lueur serrée sans halo"}
if "rowV" not in c["noteOrder"]:
    c["noteOrder"].append("rowV")
c["notes"]["title"]["text"] = "U1 Doctor · UI V2 · quatre directions : Pupitre 2, Notice, Obsidienne, Visière"
c["title"] = "U1 Doctor UI V2 · Pupitre 2, Notice, Obsidienne, Visière"
(M / "canvas.json").write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n")
print("boards V :", present)

if len(sys.argv) > 1:
    root = pathlib.Path(sys.argv[1]) / "project"
    root.mkdir(parents=True, exist_ok=True)
    shutil.copy(M / "canvas.json", root / "canvas.json")
    for n in present:
        shutil.copy(M / n, root / n)
    print("copié dans", root)
