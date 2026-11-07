"""'Needs your eyes' symptom wizard for print-quality defects. Pure, offline, read-only.

For each symptom the official wiki lists causes. This module keeps that list in the wiki's order, adds no ranking and no
score, and attaches evidence FOR or AGAINST a cause only where a number exists to compare with a window the wiki states:
numbers typed by the owner (USER_REPORTED) or temperatures seen in a saved session (OBSERVED, with the session's own
source status). Every other cause carries "needs your eyes". Nothing here contacts the printer or sends a command.
"""
from __future__ import annotations

import json
from collections.abc import Callable
from functools import lru_cache
from pathlib import Path
from statistics import median
from typing import Any

from .knowledge import parse_firmware
from .paths import ROOT

SYMPTOMS_PATH = ROOT / "knowledge" / "u1_symptoms.json"

NUMERIC: dict[str, tuple[float, float]] = {
    "mesh_range": (0, 10), "bed_temp": (-50, 400), "nozzle_temp": (-50, 500), "retraction_length": (0, 30), "retraction_speed": (0, 500),
    "flow_ratio": (0, 3), "bridge_speed": (0, 500), "layer_height": (0, 3), "nozzle_diameter": (0, 3),
}
CHOICES: dict[str, tuple[str, ...]] = {
    "plate": ("smooth_pei", "textured_pei", "other"), "enclosure": ("yes", "no"), "toolheads": ("one", "several", "all"),
}
TEXT_FIELDS = ("material", "firmware")
ALL_FIELDS = (*NUMERIC, *CHOICES, *TEXT_FIELDS)

Ev = dict[str, Any]


def _t(en: str, fr: str) -> dict[str, str]:
    return {"en": en, "fr": fr}


def _g(x: float) -> str:
    return f"{x:g}"


def _ev(direction: str, text: dict[str, str], source: str) -> Ev:
    return {"direction": direction, "text": text, "source": source}


@lru_cache(maxsize=1)
def load_symptoms(path: Path = SYMPTOMS_PATH) -> dict[str, Any]:
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    ids = [s["id"] for s in data["symptoms"]]
    assert len(set(ids)) == len(ids), "duplicate symptom id"
    cause_ids = [c["id"] for s in data["symptoms"] for c in s["causes"]]
    assert len(set(cause_ids)) == len(cause_ids), "duplicate cause id"
    for s in data["symptoms"]:
        for c in s["causes"]:
            ev = (c.get("check") or {}).get("ev")
            assert ev is None or ev in EVALUATORS, f"unknown evaluator {ev}"
            if not c.get("eyes") and not c.get("check"):
                raise AssertionError(f"cause {c['id']} has neither a check nor eyes=true")
    return data


def needs(check: dict[str, Any] | None) -> list[str]:
    """Answer fields an evaluator can use (shown by the wizard only for the chosen symptom)."""
    return list(NEEDS.get((check or {}).get("ev", ""), ()))


def catalog() -> dict[str, Any]:
    data = load_symptoms()
    out = {k: v for k, v in data.items() if k != "symptoms"}
    out["symptoms"] = []
    for s in data["symptoms"]:
        fields: list[str] = []
        for c in s["causes"]:
            for f in needs(c.get("check")):
                if f not in fields:
                    fields.append(f)
        out["symptoms"].append({**{k: v for k, v in s.items() if k != "causes"}, "ask": fields, "cause_count": len(s["causes"])})
    out["fields"] = {"numeric": {k: list(v) for k, v in NUMERIC.items()}, "choices": {k: list(v) for k, v in CHOICES.items()}}
    return out


def clean_answers(raw: object) -> dict[str, Any]:
    """Strict: unknown keys, wrong types or out-of-range numbers are refused (never silently dropped)."""
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise ValueError("answers must be an object")
    out: dict[str, Any] = {}
    materials = load_symptoms()["materials"]
    for k, v in raw.items():
        if k not in ALL_FIELDS:
            raise ValueError(f"unknown answer: {k}")
        if v is None or v == "":
            continue
        if k in NUMERIC:
            if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v:
                raise ValueError(f"{k} must be a number")
            lo, hi = NUMERIC[k]
            if not lo <= v <= hi:
                raise ValueError(f"{k} is outside {_g(lo)} to {_g(hi)}")
            out[k] = float(v)
        elif k in CHOICES:
            if v not in CHOICES[k]:
                raise ValueError(f"{k} must be one of {', '.join(CHOICES[k])}")
            out[k] = v
        elif k == "material":
            if v not in materials:
                raise ValueError("unknown material")
            out[k] = v
        else:  # firmware
            if not isinstance(v, str) or parse_firmware(v) is None:
                raise ValueError("firmware must look like 1.5.2")
            out[k] = v.strip()
    return out


# ---------- telemetry from a saved session ----------

BED_TYPES = ("bed_temperature_sample",)
NOZZLE_TYPES = ("temperature_sample", "extruder_temperature")


def observed_from(observations: list[dict[str, Any]]) -> dict[str, Any]:
    """Highest FRESH temperature seen per sensor class. 'max' is a fact; whether the print window was reached is a fair test."""
    out: dict[str, Any] = {"bed": None, "nozzle": None}
    for key, types in (("bed", BED_TYPES), ("nozzle", NOZZLE_TYPES)):
        vals: list[float] = []
        statuses: set[str] = set()
        for o in observations:
            if o.get("event_type") not in types or o.get("validity") != "FRESH" or not isinstance(o.get("value"), dict):
                continue
            v = o["value"].get("celsius")
            if isinstance(v, (int, float)) and not isinstance(v, bool) and v == v:
                vals.append(float(v))
                statuses.add(str(o.get("source_status")))
        if vals:
            out[key] = {"n": len(vals), "max": max(vals), "median": median(vals), "statuses": sorted(statuses)}
    return out


def _src(obs_part: dict[str, Any]) -> str:
    return "OBSERVED " + "/".join(obs_part["statuses"])


# ---------- evaluators: each returns a list of evidence items ----------

def _value(ans: dict[str, Any], obs: dict[str, Any], akey: str, okey: str) -> tuple[float | None, str]:
    if akey in ans:
        return ans[akey], "USER_REPORTED"
    part = obs.get(okey)
    if part:
        return part["max"], _src(part)
    return None, ""


def ev_mesh_range(chk: dict[str, Any], ans: dict[str, Any], obs: dict[str, Any], data: dict[str, Any]) -> list[Ev]:
    if "mesh_range" not in ans:
        return []
    r, lim = ans["mesh_range"], data["limits"]
    if r > lim["mesh_manual_above"]:
        return [_ev("for", _t(f"Your mesh RANGE of {_g(r)} mm is above the wiki's {_g(lim['mesh_manual_above'])} mm: manual leveling is advised.", f"Votre RANGE de maillage de {_g(r)} mm dépasse les {_g(lim['mesh_manual_above'])} mm du wiki : un nivellement manuel est conseillé."), "USER_REPORTED")]
    if r < lim["mesh_ok_below"]:
        return [_ev("against", _t(f"Your mesh RANGE of {_g(r)} mm is under the wiki's {_g(lim['mesh_ok_below'])} mm normal limit.", f"Votre RANGE de maillage de {_g(r)} mm est sous la limite normale de {_g(lim['mesh_ok_below'])} mm du wiki."), "USER_REPORTED")]
    return [_ev("unclear", _t(f"Your mesh RANGE of {_g(r)} mm is between {_g(lim['mesh_ok_below'])} and {_g(lim['mesh_manual_above'])} mm: the wiki gives no verdict there.", f"Votre RANGE de maillage de {_g(r)} mm est entre {_g(lim['mesh_ok_below'])} et {_g(lim['mesh_manual_above'])} mm : le wiki ne tranche pas."), "USER_REPORTED")]


def _window(ans: dict[str, Any], data: dict[str, Any], key: str) -> tuple[str, list[float]] | None:
    m = ans.get("material")
    return (m, data["materials"][m][key]) if m else None


def ev_bed_low(chk: dict[str, Any], ans: dict[str, Any], obs: dict[str, Any], data: dict[str, Any]) -> list[Ev]:
    w = _window(ans, data, "bed")
    v, src = _value(ans, obs, "bed_temp", "bed")
    if not w or v is None:
        return []
    m, (lo, hi) = w
    if v < lo:
        return [_ev("for", _t(f"Bed temperature {_g(v)} °C is below the wiki's {_g(lo)}–{_g(hi)} °C for {m}.", f"Température de plateau {_g(v)} °C sous les {_g(lo)}–{_g(hi)} °C du wiki pour le {m}."), src)]
    return [_ev("against", _t(f"Bed temperature {_g(v)} °C reaches the wiki's {_g(lo)}–{_g(hi)} °C for {m}.", f"Température de plateau {_g(v)} °C atteint les {_g(lo)}–{_g(hi)} °C du wiki pour le {m}."), src)]


def ev_nozzle_high(chk: dict[str, Any], ans: dict[str, Any], obs: dict[str, Any], data: dict[str, Any]) -> list[Ev]:
    w = _window(ans, data, "nozzle")
    v, src = _value(ans, obs, "nozzle_temp", "nozzle")
    if not w or v is None:
        return []
    m, (lo, hi) = w
    if v > hi:
        return [_ev("for", _t(f"Nozzle {_g(v)} °C is above the wiki's {_g(lo)}–{_g(hi)} °C for {m}.", f"Buse à {_g(v)} °C, au-dessus des {_g(lo)}–{_g(hi)} °C du wiki pour le {m}."), src)]
    return [_ev("against", _t(f"Nozzle {_g(v)} °C does not exceed the wiki's {_g(lo)}–{_g(hi)} °C for {m}.", f"Buse à {_g(v)} °C, ne dépasse pas les {_g(lo)}–{_g(hi)} °C du wiki pour le {m}."), src)]


def ev_nozzle_low(chk: dict[str, Any], ans: dict[str, Any], obs: dict[str, Any], data: dict[str, Any]) -> list[Ev]:
    w = _window(ans, data, "nozzle")
    v, src = _value(ans, obs, "nozzle_temp", "nozzle")
    if not w or v is None:
        return []
    m, (lo, hi) = w
    if v < lo:
        return [_ev("for", _t(f"Nozzle {_g(v)} °C is below the wiki's {_g(lo)}–{_g(hi)} °C for {m}.", f"Buse à {_g(v)} °C, sous les {_g(lo)}–{_g(hi)} °C du wiki pour le {m}."), src)]
    return [_ev("against", _t(f"Nozzle {_g(v)} °C reaches the wiki's {_g(lo)}–{_g(hi)} °C for {m}.", f"Buse à {_g(v)} °C, atteint les {_g(lo)}–{_g(hi)} °C du wiki pour le {m}."), src)]


def ev_retraction(chk: dict[str, Any], ans: dict[str, Any], obs: dict[str, Any], data: dict[str, Any]) -> list[Ev]:
    lim = data["limits"]
    (l_lo, l_ok, l_max), (s_lo, s_ok, s_max) = lim["retraction_length"], lim["retraction_speed"]
    out: list[Ev] = []
    ln, sp = ans.get("retraction_length"), ans.get("retraction_speed")
    if ln is None and sp is None:
        return []
    over = (ln is not None and ln > l_max) or (sp is not None and sp > s_max)
    high = (ln is not None and ln > l_ok) or (sp is not None and sp > s_ok)
    shown = ", ".join(x for x in (f"{_g(ln)} mm" if ln is not None else "", f"{_g(sp)} mm/s" if sp is not None else "") if x)
    if over:
        out.append(_ev("for", _t(f"Retraction {shown} is beyond the wiki's hard limits (2 mm, 60 mm/s).", f"Rétraction {shown} au-delà des limites dures du wiki (2 mm, 60 mm/s)."), "USER_REPORTED"))
    elif high:
        out.append(_ev("unclear", _t(f"Retraction {shown} is above the wiki's usual range ({_g(l_lo)}–{_g(l_ok)} mm, {_g(s_lo)}–{_g(s_ok)} mm/s) but under its limits.", f"Rétraction {shown} au-dessus de la plage habituelle du wiki ({_g(l_lo)}–{_g(l_ok)} mm, {_g(s_lo)}–{_g(s_ok)} mm/s) mais sous ses limites."), "USER_REPORTED"))
    else:
        out.append(_ev("against", _t(f"Retraction {shown} is inside the wiki's usual range ({_g(l_lo)}–{_g(l_ok)} mm, {_g(s_lo)}–{_g(s_ok)} mm/s).", f"Rétraction {shown} dans la plage habituelle du wiki ({_g(l_lo)}–{_g(l_ok)} mm, {_g(s_lo)}–{_g(s_ok)} mm/s)."), "USER_REPORTED"))
    return out


def ev_layer_ratio(chk: dict[str, Any], ans: dict[str, Any], obs: dict[str, Any], data: dict[str, Any]) -> list[Ev]:
    if "layer_height" not in ans or "nozzle_diameter" not in ans or ans["nozzle_diameter"] == 0:
        return []
    ratio = ans["layer_height"] / ans["nozzle_diameter"]
    lo, hi = data["limits"]["layer_ratio"]
    pct = round(ratio * 100)
    if ratio > hi:
        return [_ev("for", _t(f"Layer height is {pct} % of the nozzle, above the wiki's {_g(lo * 100)}–{_g(hi * 100)} %.", f"La hauteur de couche vaut {pct} % de la buse, au-dessus des {_g(lo * 100)}–{_g(hi * 100)} % du wiki."), "USER_REPORTED")]
    if ratio >= lo:
        return [_ev("against", _t(f"Layer height is {pct} % of the nozzle, inside the wiki's {_g(lo * 100)}–{_g(hi * 100)} %.", f"La hauteur de couche vaut {pct} % de la buse, dans les {_g(lo * 100)}–{_g(hi * 100)} % du wiki."), "USER_REPORTED")]
    return [_ev("unclear", _t(f"Layer height is {pct} % of the nozzle, below the wiki's {_g(lo * 100)}–{_g(hi * 100)} %: the wiki does not call that a cause here.", f"La hauteur de couche vaut {pct} % de la buse, sous les {_g(lo * 100)}–{_g(hi * 100)} % du wiki : le wiki n'en fait pas une cause ici."), "USER_REPORTED")]


def ev_flow_ratio(chk: dict[str, Any], ans: dict[str, Any], obs: dict[str, Any], data: dict[str, Any]) -> list[Ev]:
    if "flow_ratio" not in ans:
        return []
    f, (lo, hi) = ans["flow_ratio"], data["limits"]["flow_ratio"]
    mode = chk.get("mode", "outside")
    if mode == "high":
        if f > hi:
            return [_ev("for", _t(f"Flow ratio {_g(f)} is above the wiki's recommended {_g(lo)}–{_g(hi)}.", f"Ratio de débit {_g(f)} au-dessus de la plage conseillée {_g(lo)}–{_g(hi)} du wiki."), "USER_REPORTED")]
        return [_ev("against", _t(f"Flow ratio {_g(f)} is not above the wiki's recommended {_g(lo)}–{_g(hi)}.", f"Ratio de débit {_g(f)} pas au-dessus de la plage conseillée {_g(lo)}–{_g(hi)} du wiki."), "USER_REPORTED")]
    if f < lo or f > hi:
        return [_ev("for", _t(f"Flow ratio {_g(f)} is outside the wiki's recommended {_g(lo)}–{_g(hi)}.", f"Ratio de débit {_g(f)} hors de la plage conseillée {_g(lo)}–{_g(hi)} du wiki."), "USER_REPORTED")]
    return [_ev("against", _t(f"Flow ratio {_g(f)} is inside the wiki's recommended {_g(lo)}–{_g(hi)}.", f"Ratio de débit {_g(f)} dans la plage conseillée {_g(lo)}–{_g(hi)} du wiki."), "USER_REPORTED")]


def ev_bridge_speed(chk: dict[str, Any], ans: dict[str, Any], obs: dict[str, Any], data: dict[str, Any]) -> list[Ev]:
    if "bridge_speed" not in ans:
        return []
    s, (lo, hi) = ans["bridge_speed"], data["limits"]["bridge_speed"]
    if s > hi:
        return [_ev("for", _t(f"Bridge speed {_g(s)} mm/s is above the wiki's typical {_g(lo)}–{_g(hi)} mm/s.", f"Vitesse des ponts {_g(s)} mm/s au-dessus de la plage typique {_g(lo)}–{_g(hi)} mm/s du wiki."), "USER_REPORTED")]
    if s >= lo:
        return [_ev("against", _t(f"Bridge speed {_g(s)} mm/s is inside the wiki's typical {_g(lo)}–{_g(hi)} mm/s.", f"Vitesse des ponts {_g(s)} mm/s dans la plage typique {_g(lo)}–{_g(hi)} mm/s du wiki."), "USER_REPORTED")]
    return [_ev("unclear", _t(f"Bridge speed {_g(s)} mm/s is below the wiki's typical range: the wiki does not call that a cause.", f"Vitesse des ponts {_g(s)} mm/s sous la plage typique : le wiki n'en fait pas une cause."), "USER_REPORTED")]


def ev_plate_material(chk: dict[str, Any], ans: dict[str, Any], obs: dict[str, Any], data: dict[str, Any]) -> list[Ev]:
    plate, m = ans.get("plate"), ans.get("material")
    if not plate or not m:
        return []
    lim = data["limits"]
    if plate == "smooth_pei" and m in lim["release_agent_on_smooth_pei"]:
        return [_ev("for", _t(f"{m} on a smooth PEI plate: the wiki advises a release agent (glue stick or liquid glue) because of strong adhesion.", f"{m} sur un plateau PEI lisse : le wiki conseille un agent de démoulage (colle en bâton ou liquide) à cause de la forte adhérence."), "USER_REPORTED")]
    if plate == "textured_pei" and m in lim["bad_on_textured_pei"]:
        return [_ev("for", _t(f"{m} on textured PEI is one of the wiki's examples of an unsuited pair.", f"{m} sur PEI texturé est un des exemples de couple inadapté du wiki."), "USER_REPORTED")]
    return [_ev("unclear", _t(f"No conflict is documented for {m} on this plate in the pages used. The wiki's Build Plate Guide (not read here) holds the full compatibility table.", f"Aucun conflit n'est documenté pour le {m} sur ce plateau dans les pages utilisées. Le guide des plateaux du wiki (non lu ici) contient le tableau complet."), "WIKI")]


def ev_enclosure(chk: dict[str, Any], ans: dict[str, Any], obs: dict[str, Any], data: dict[str, Any]) -> list[Ev]:
    m, enc = ans.get("material"), ans.get("enclosure")
    if not m or m not in data["limits"]["warp_prone"]:
        return []
    amb = data["limits"]["abs_ambient_c"]
    if enc == "no":
        return [_ev("for", _t(f"{m} printed without an enclosure: the wiki says ABS needs an ambient temperature of at least {amb} °C.", f"{m} imprimé sans enceinte : le wiki indique que l'ABS demande une température ambiante d'au moins {amb} °C."), "USER_REPORTED")]
    if enc == "yes":
        return [_ev("unclear", _t(f"You declare an enclosure. Its temperature is not measured here; the wiki asks for at least {amb} °C ambient for ABS.", f"Vous déclarez une enceinte. Sa température n'est pas mesurée ici ; le wiki demande au moins {amb} °C ambiants pour l'ABS."), "USER_REPORTED")]
    return []


def ev_firmware_range(chk: dict[str, Any], ans: dict[str, Any], obs: dict[str, Any], data: dict[str, Any]) -> list[Ev]:
    fw = parse_firmware(ans.get("firmware"))
    if fw is None:
        return []
    lo, hi = tuple(chk["lo"]), tuple(chk["hi"])
    label = chk["label"]
    if lo <= fw < hi:
        return [_ev("for", _t(f"Firmware {ans['firmware']} is in the affected range: {label['en']}.", f"Le firmware {ans['firmware']} est dans la plage concernée : {label['fr']}."), "USER_REPORTED")]
    return [_ev("against", _t(f"Firmware {ans['firmware']} is outside the affected range ({label['en']}).", f"Le firmware {ans['firmware']} est hors de la plage concernée ({label['fr']})."), "USER_REPORTED")]


def ev_toolhead_scope(chk: dict[str, Any], ans: dict[str, Any], obs: dict[str, Any], data: dict[str, Any]) -> list[Ev]:
    scope = ans.get("toolheads")
    if not scope:
        return []
    label = chk["label"]
    if scope in chk["matches_for"]:
        return [_ev("for", _t(f"You report that {label['en']}: the wiki sends you to that toolhead.", f"Vous indiquez que {label['fr']} : le wiki vous renvoie à cette tête."), "USER_REPORTED")]
    return [_ev("against", _t(f"You do not report that {label['en']}.", f"Vous n'indiquez pas que {label['fr']}."), "USER_REPORTED")]


def ev_moisture_info(chk: dict[str, Any], ans: dict[str, Any], obs: dict[str, Any], data: dict[str, Any]) -> list[Ev]:
    m = ans.get("material")
    if not m:
        return []
    row = data["materials"][m]
    if "dry" not in row and "saturate" not in row:
        return [_ev("info", _t(f"The wiki gives no drying or saturation figures for {m}.", f"Le wiki ne donne pas de chiffres de séchage ni de saturation pour le {m}."), "WIKI")]
    sat = row.get("saturate")
    en = f"Wiki for {m}: " + (f"drying {row['dry']}" if "dry" in row else "no drying figure") + (f"; saturates in about {sat['en']}." if sat else ".")
    fr = f"Wiki pour le {m} : " + (f"séchage {row['dry']}" if "dry" in row else "pas de chiffre de séchage") + (f" ; sature en {sat['fr']} environ." if sat else ".")
    return [_ev("info", _t(en, fr), "WIKI")]


EVALUATORS: dict[str, Callable[[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]], list[Ev]]] = {
    "mesh_range": ev_mesh_range, "bed_low": ev_bed_low, "nozzle_high": ev_nozzle_high, "nozzle_low": ev_nozzle_low, "retraction": ev_retraction,
    "layer_ratio": ev_layer_ratio, "flow_ratio": ev_flow_ratio, "bridge_speed": ev_bridge_speed, "plate_material": ev_plate_material,
    "enclosure": ev_enclosure, "firmware_range": ev_firmware_range, "toolhead_scope": ev_toolhead_scope, "moisture_info": ev_moisture_info,
}
NEEDS: dict[str, tuple[str, ...]] = {
    "mesh_range": ("mesh_range",), "bed_low": ("material", "bed_temp"), "nozzle_high": ("material", "nozzle_temp"), "nozzle_low": ("material", "nozzle_temp"),
    "retraction": ("retraction_length", "retraction_speed"), "layer_ratio": ("layer_height", "nozzle_diameter"), "flow_ratio": ("flow_ratio",),
    "bridge_speed": ("bridge_speed",), "plate_material": ("plate", "material"), "enclosure": ("material", "enclosure"), "firmware_range": ("firmware",),
    "toolhead_scope": ("toolheads",), "moisture_info": ("material",),
}


def _lean(evidence: list[Ev]) -> str:
    dirs = {e["direction"] for e in evidence}
    if "for" in dirs and "against" in dirs:
        return "MIXED"
    if "for" in dirs:
        return "FOR"
    if "against" in dirs:
        return "AGAINST"
    return "NONE"


def evaluate(symptom_id: str, answers: object, observations: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    data = load_symptoms()
    sym = next((s for s in data["symptoms"] if s["id"] == symptom_id), None)
    if sym is None:
        raise KeyError(symptom_id)
    ans = clean_answers(answers)
    obs = observed_from(observations) if observations else {"bed": None, "nozzle": None}
    causes = []
    for c in sym["causes"]:
        chk = c.get("check")
        evidence = EVALUATORS[chk["ev"]](chk, ans, obs, data) if chk else []
        causes.append({"id": c["id"], "text": c["text"], "eyes": bool(c.get("eyes")), "evidence": evidence, "lean": _lean(evidence)})
    return {
        "symptom": {"id": sym["id"], "title": sym["title"], "eyes": sym["eyes"], "page": sym["page"], "url": data["wiki_base"] + sym["page"]},
        "answers": ans, "observed": obs, "causes": causes, "catalog_checked_at": data["checked_at"],
        "notes": [
            "The causes keep the official page's order. There is no ranking and no score.",
            "FOR or AGAINST only compares a number with a window the wiki states. It never proves a cause.",
            "A cause marked 'needs your eyes' can only be settled by looking at the print or the machine.",
            "Observed temperatures use the highest value seen in the saved session: it tells whether the window was reached, not what the print used.",
            "The wiki pages do not always agree with each other; the linked page is the reference.",
        ],
    }
