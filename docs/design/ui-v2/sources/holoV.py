"""Hologramme or dérivé pixel à pixel de vis-hero (géométrie identique, rien d'inventé)."""
import sys
import numpy as np
from PIL import Image, ImageFilter

src, out, prev = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src).convert("RGB")
g = np.asarray(im.convert("L").filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32) / 255.0

# Sobel
kx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], np.float32)
ky = kx.T
p = np.pad(g, 1, mode="edge")
gx = sum(kx[i, j] * p[i:i + g.shape[0], j:j + g.shape[1]] for i in range(3) for j in range(3))
gy = sum(ky[i, j] * p[i:i + g.shape[0], j:j + g.shape[1]] for i in range(3) for j in range(3))
e = np.sqrt(gx * gx + gy * gy)
e = np.clip(e / np.percentile(e, 99.2), 0, 1) ** 0.85

# masque objet : tout ce qui n'est pas le fond quasi noir
obj = np.asarray(Image.fromarray((g > 0.06).astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(3)), np.float32) / 255.0

fill = (g ** 1.6) * 0.22 * obj          # surfaces : plans translucides
v = np.clip(e * 0.95 + fill, 0, 1)

# lignes de balayage horizontales fines
rows = np.arange(g.shape[0])[:, None]
v = v * np.where(rows % 3 == 0, 0.62, 1.0)

# rampe or : noir chaud -> #8A4A08 -> #FFB547 -> #FFE7BF
stops = np.array([[8, 7, 10], [138, 74, 8], [255, 181, 71], [255, 231, 191]], np.float32)
pos = np.array([0.0, 0.35, 0.72, 1.0], np.float32)
rgb = np.stack([np.interp(v, pos, stops[:, c]) for c in range(3)], axis=-1)
Image.fromarray(rgb.astype(np.uint8)).save(out)
t = Image.open(out); t.thumbnail((900, 900)); t.save(prev, quality=85)
print("ok", im.size)
