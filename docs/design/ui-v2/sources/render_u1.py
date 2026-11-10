"""Rendus de la U1 pour les planches UI V2, depuis la scène du propriétaire (U1_Jay_Master.blend).

Géométrie, inscriptions « snapmaker » (façade, tête) et écran viennent du modèle : rien n'est ajouté par-dessus.
Seuls changent la lumière, le fond, le sol et le cadrage.

    blender -b U1_Jay_Pack_Complet/U1_Jay/U1_Jay_Master.blend --python docs/design/ui-v2/sources/render_u1.py -- \
        <theme> <shot> <out.png> [scale]

theme : obs (studio graphite), vis (nuit, or + liseré rouge), line (trait noir sur blanc, tête 3 ambre),
        holo (contours or sur fond transparent, alignés au pixel sur le même cadrage)
shot  : hero (trois-quarts de l'aperçu du pack), tetes (les têtes garées), ecran (façade : inscription + écran)
Écrit aussi <out>.json : position en pixels des repères (têtes 1-4, écran, plateau, buse...).
"""
import json, math, sys

import bmesh
import bpy
import mathutils
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:]
THEME, SHOT, OUT = argv[0], argv[1], argv[2]
SCALE = float(argv[3]) if len(argv) > 3 else 1.0
S = bpy.context.scene
R = S.render

SHOTS = {
    # caméra du pack (rendu U1_Jay_Apercu.png), cadrage portrait
    "hero": dict(res=(1452, 1726), ortho_k=1.12),
    # têtes garées vues de l'avant, en surplomb
    "tetes": dict(res=(1536, 1024), target=(0.03, 0.125, 0.418), dirv=(0.22, -0.88, 0.42), dist=0.9, ortho=0.27),
    # façade : inscription « snapmaker » + écran tactile
    "ecran": dict(res=(1536, 1024), target=(0.0, -0.246, 0.395), dirv=(0.18, -0.95, 0.20), dist=0.9, ortho=0.42),
}
THEMES = {
    "obs": dict(bg="#0B0D10", floor=("#0E1013", 0.22), view="AgX",
                lights={"Key": ((1.0, 0.98, 0.96), 1.0), "Fill": ((0.86, 0.9, 1.0), 0.55), "Rim": ((1.0, 1.0, 1.0), 1.25)}),
    "vis": dict(bg="#08070A", floor=("#0C0908", 0.2), view="AgX",
                lights={"Key": ((1.0, 0.84, 0.62), 1.1), "Fill": ((1.0, 0.80, 0.6), 0.22), "Rim": ((1.0, 0.2, 0.12), 0.55)}),
    "line": dict(bg="#FFFFFF", view="Standard"),
    "holo": dict(bg=None, view="Standard"),
}


def hex2lin(h):
    def c(v):
        v = int(v, 16) / 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c(h[1:3]), c(h[3:5]), c(h[5:7]), 1.0)


def look_at(obj, target):
    d = mathutils.Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


cfg = SHOTS[SHOT]
th = THEMES[THEME]
R.resolution_x, R.resolution_y = (int(cfg["res"][0] * SCALE), int(cfg["res"][1] * SCALE))
R.resolution_percentage = 100
cam = S.camera
cam.animation_data_clear()
cam.data.animation_data_clear()
cam.data.lens_unit = "MILLIMETERS"
if cfg.get("target"):
    t = mathutils.Vector(cfg["target"])
    dv = mathutils.Vector(cfg["dirv"]).normalized()
    cam.location = t + dv * cfg["dist"]
    look_at(cam, t)
print("ORTHO0", cam.data.type, cam.data.ortho_scale)
if "ortho" in cfg:
    cam.data.ortho_scale = cfg["ortho"]
else:
    cam.data.ortho_scale *= cfg.get("ortho_k", 1.0)
cam.data.sensor_fit = "AUTO"
cam.data.clip_start = 0.01

# --- slots des têtes : blocs garés = îlots de géométrie isolés dans FRAME__Graphite_Polymer ---
frame_poly = bpy.data.objects["FRAME__Graphite_Polymer"]
mw = frame_poly.matrix_world
bm = bmesh.new()
bm.from_mesh(frame_poly.data)
bm.faces.ensure_lookup_table()
seen, islands = set(), []
for f in bm.faces:
    if f.index in seen:
        continue
    stack, isl = [f], []
    seen.add(f.index)
    while stack:
        g = stack.pop()
        isl.append(g.index)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in seen:
                    seen.add(h.index)
                    stack.append(h)
    vs = {v for i in isl for v in bm.faces[i].verts}
    ws = [mw @ v.co for v in vs]
    mn = mathutils.Vector([min(w[i] for w in ws) for i in range(3)])
    mx = mathutils.Vector([max(w[i] for w in ws) for i in range(3)])
    islands.append((isl, mn, mx))
slots, slot_faces = {}, {}
for n, sx in ((1, -0.103), (2, -0.035), (3, 0.033), (4, 0.100)):
    cand = [(isl, mn, mx) for isl, mn, mx in islands
            if abs((mn.x + mx.x) / 2 - sx) < 0.03 and 0.10 < (mn.y + mx.y) / 2 < 0.26 and (mn.z + mx.z) / 2 > 0.33
            and (mx - mn).x < 0.075 and (mx - mn).y < 0.14 and (mx - mn).z < 0.16]
    if cand:
        mn = mathutils.Vector([min(c[1][i] for c in cand) for i in range(3)])
        mx = mathutils.Vector([max(c[2][i] for c in cand) for i in range(3)])
        slots[n] = ((mn + mx) / 2, mn, mx)
        slot_faces[n] = [i for c in cand for i in c[0]]
print("SLOTS", {n: [round(v, 3) for v in s[0]] for n, s in slots.items()}, {n: len(f) for n, f in slot_faces.items()})

# --- matières / lumières par thème ---
world = S.world
bgnode = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
S.view_settings.view_transform = th["view"]
S.view_settings.look = "None"
S.view_settings.exposure = 0
S.view_settings.gamma = 1

R.engine = "BLENDER_EEVEE"
try:
    S.eevee.taa_render_samples = 96
    S.eevee.use_raytracing = True
except AttributeError:
    pass

floor = bpy.data.objects.get("Studio_Floor")


def flat(name, hexcol):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = hex2lin(hexcol)
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


if THEME in ("obs", "vis"):
    bgnode.inputs[0].default_value = hex2lin(th["bg"])
    bgnode.inputs[1].default_value = 1.0
    for ln, (col, k) in th["lights"].items():
        L = bpy.data.objects.get(ln)
        if L:
            L.data.color = col
            L.data.energy *= k
    if floor:
        fm = bpy.data.materials.new("ThemeFloor")
        fm.use_nodes = True
        b = fm.node_tree.nodes.get("Principled BSDF")
        b.inputs["Base Color"].default_value = hex2lin(th["floor"][0])
        b.inputs["Roughness"].default_value = th["floor"][1]
        floor.data.materials.clear()
        floor.data.materials.append(fm)
else:
    # rendus au trait : couleurs à plat + lignes Freestyle calculées sur la géométrie
    if floor:
        floor.hide_render = True
    for L in [o for o in bpy.data.objects if o.type == "LIGHT"]:
        L.hide_render = True
    R.use_freestyle = True
    R.line_thickness_mode = "ABSOLUTE"
    R.line_thickness = 1.0
    vl = S.view_layers[0]
    vl.use_freestyle = True
    fs = vl.freestyle_settings
    fs.crease_angle = math.radians(128)
    ls = fs.linesets[0] if fs.linesets else fs.linesets.new("L")
    for k in ("select_silhouette", "select_border", "select_crease", "select_external_contour"):
        setattr(ls, k, True)
    ls.visibility = "VISIBLE"
    st = ls.linestyle
    st.caps = "ROUND"
    if THEME == "line":
        bgnode.inputs[0].default_value = hex2lin("#FFFFFF")
        bgnode.inputs[1].default_value = 1.0
        st.color = (0.07, 0.07, 0.07)
        st.thickness = 2.2 * SCALE * (1.25 if SHOT == "hero" else 1.6)
        palette = {  # matière du pack -> aplat de la notice
            "Ceramic_White_Powdercoat": "#FFFFFF", "Graphite_Polymer": "#4A4F57", "Smoked_Glass": "#5A6068",
            "Anodized_Aluminium": "#D9DCE0", "Brushed_Stainless": "#CFD3D8", "Rubber": "#3A3D42",
            "Harness_Black_Rubber": "#3A3D42", "PTFE_Black_Clips": "#3A3D42", "PTFE_Natural_Translucent": "#F2F0EC",
            "PTFE_Fitting_Nickel": "#C9CCD1", "Reel_Kraft": "#E2D2B8", "Filament_Orange": "#F2A65A",
            "Filament_Green": "#9CC98A", "Filament_Purple": "#C49AE0", "Filament_Red": "#F07C7C",
            "Nozzle_Brass": "#D8B26A", "Timing_Belt": "#3A3D42", "Textured_PEI": "#6B6F75",
            "Chamber_LED": "#FFFFFF", "Touchscreen": None,
        }
        cache = {}
        for o in bpy.data.objects:
            if o.type != "MESH":
                continue
            for i, slot in enumerate(o.material_slots):
                m = slot.material
                if not m or m.name not in palette or palette[m.name] is None:
                    continue
                if m.name not in cache:
                    cache[m.name] = flat("N_" + m.name, palette[m.name])
                slot.material = cache[m.name]
        # tête 3 en ambre : faces du bloc garé n° 3 (même géométrie, seule la couleur change)
        amber = flat("N_Amber", "#FFB547")
        if 3 in slot_faces:
            frame_poly.data.materials.append(amber)
            ai = len(frame_poly.data.materials) - 1
            for i in slot_faces[3]:
                frame_poly.data.polygons[i].material_index = ai
    else:  # holo
        R.film_transparent = True
        st.color = (1.0, 0.85, 0.6)
        st.alpha = 1.0
        st.thickness = 1.25 * SCALE * (1.2 if SHOT == "hero" else 1.5)
        hold = bpy.data.materials.new("Hold")
        hold.use_nodes = True
        nt = hold.node_tree
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        h = nt.nodes.new("ShaderNodeHoldout")
        o = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(h.outputs[0], o.inputs[0])
        for o in bpy.data.objects:
            if o.type == "MESH":
                for slot in o.material_slots:
                    slot.material = hold

R.image_settings.file_format = "PNG"
R.image_settings.color_mode = "RGBA" if THEME == "holo" else "RGB"
R.filepath = OUT
bpy.ops.render.render(write_still=True)

# --- repères projetés (pixels, origine en haut à gauche) ---
W, H = R.resolution_x, R.resolution_y


def px(p):
    v = world_to_camera_view(S, cam, mathutils.Vector(p))
    return [round(v.x * W, 1), round((1 - v.y) * H, 1)]


anch = {"size": [W, H]}
for n, (c, mn, mx) in slots.items():
    anch[f"slot{n}"] = px(c)
    anch[f"slot{n}_box"] = [px((mn.x, c.y, mx.z)), px((mx.x, c.y, mn.z))]
anch["head1_face"] = px((0.0025, -0.016, 0.4025))
anch["screen"] = px((0.11, -0.246, 0.398))
anch["screen_box"] = [px((0.059, -0.246, 0.428)), px((0.161, -0.246, 0.368))]
anch["bed"] = px((0.0, 0.0, 0.115))
anch["nozzle"] = px((0.0025, 0.04, 0.326))
anch["door"] = px((0.0, -0.25, 0.19))
anch["gear3"] = px((0.033, 0.20, 0.455))
json.dump(anch, open(OUT.rsplit(".", 1)[0] + ".json", "w"), indent=1)
print("RENDER_OK", OUT, W, H)
