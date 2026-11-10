"""Copies web des rendus Blender (private/ui-v2/renders/*.png) vers lab/r/ : JPEG 88 % ; hologrammes en PNG (transparence)."""
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[4]
SRC, DST = ROOT / "private/ui-v2/renders", ROOT / "docs/design/ui-v2/lab/r"
DST.mkdir(parents=True, exist_ok=True)
for f in sorted(SRC.glob("u1-*.png")):
    im = Image.open(f)
    if "-holo-" in f.name:
        im.save(DST / f.name, optimize=True)
    else:
        im.convert("RGB").save(DST / (f.stem + ".jpg"), quality=88, optimize=True, progressive=True)
    print("ok", f.name)
