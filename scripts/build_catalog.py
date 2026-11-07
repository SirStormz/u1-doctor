"""Build knowledge/u1_codes.json from a LOCAL snapshot of the official error-code table (private/, git-ignored).

The wiki text is never copied: each row becomes our own short wording (cause phrase + guidance categories), the
official title label, the toolhead mapping and a link to the official article. Existing hand-written entries are kept
byte-for-byte (their title/summary feed golden findings); new optional fields are added next to them.

Input : private/wiki-raw/codes_parsed.json  (rows: module, code, title, details, article, href)
Output: knowledge/u1_codes.json
Run   : backend/.venv/Scripts/python.exe scripts/build_catalog.py   (needs the private snapshot; the output is committed)
"""
import json
import re
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "private" / "wiki-raw"
CAT = ROOT / "knowledge" / "u1_codes.json"
VERIFIED_AT = "2026-11-06"

# Index -> unit convention, per module, checked against the row text of the official table (see docs/wiki-findings.md).
# 0522: 2..5 = toolhead MCU 1..4 (0 host, 1 mainboard, 100 none); 0523/0525: 0..3 = toolhead / feeder 1..4.
UNIT_WORD = {"0522": "toolhead", "0523": "toolhead", "0525": "feeder"}


def unit_from_index(module: str, idx: int) -> int | None:
    if module == "0522" and 2 <= idx <= 5:
        return idx - 1
    if module in ("0523", "0525") and 0 <= idx <= 3:
        return idx + 1
    return None


NUM_RE = re.compile(r"(?i)\b(?:toolhead|feeder|head)\s*(\d)")

# (regex on lowercased details, our cause phrase). {U} = unit label. First match wins.
CAUSES: list[tuple[str, str]] = [
    (r"swapping failed", "A tool change involving {U} failed; a toolhead that dropped out of or tilted in its dock is the usual suspect."),
    (r"picking failed", "{U} could not be picked up from the dock; check for a dropped or tilted toolhead."),
    (r"parking failed", "{U} could not be parked back in its dock."),
    (r"return failed", "{U} could not return to the dock; an obstruction in the dock area is suspected."),
    (r"detached|placement anomaly", "The printer considers {U} detached or not seated in its dock."),
    (r"pogopin", "The electrical contact between {U} and the swapper pins is abnormal."),
    (r"properly picked and placed", "A toolhead in the dock is missing or misaligned."),
    (r"mcu connection failed", "{U} could not be reached at startup."),
    (r"mcu connection interrupted", "The link to {U} dropped while running."),
    (r"mcu control timed out", "{U} stopped answering in time; the system shut down to protect itself."),
    (r"power-off signal", "{U} detected a power-off signal; the system shut down to protect itself."),
    (r"abnormal mcu connection", "An abnormal MCU connection was detected at startup."),
    (r"host mcu connection", "The link to the host MCU is faulty."),
    (r"mainboard mcu connection", "The link to the mainboard MCU is faulty."),
    (r"no toolhead detected", "No toolhead is detected at all."),
    (r"configuration load", "A configuration failed to load at startup."),
    (r"protocol load", "The communication protocol failed to load at startup."),
    (r"filament feeder anomaly", "{U} reports a generic anomaly; the official table advises contacting support."),
    (r"motor speed anomaly", "The feeder motor of {U} reports an abnormal speed; the cable is the first thing to check."),
    (r"no filament detected|detected no filament|filament not loaded", "No filament is seen at {U}."),
    (r"runout", "Filament ran out at {U}."),
    (r"temperature insufficient", "The nozzle of {U} is too cold for extrusion (below 170 degC)."),
    (r"thermistor|ceramic heater", "The temperature sensing or heating element of {U} looks disconnected."),
    (r"single extrusion distance", "A single extrusion move on {U} was longer than allowed, which points to a faulty G-code."),
    (r"extrusion volume exceeded", "The extrusion volume of {U} exceeded the allowed maximum, which points to a faulty G-code."),
    (r"outside the allowable range|outside the allowed", "The nozzle temperature requested for {U} is outside the allowed range."),
    (r"flow calibration", "The extrusion flow calibration of {U} failed."),
    (r"tangled on the spool|broken inside the tube", "Filament at {U} may be broken, tangled or the toolhead clogged."),
    (r"filament information not set", "Filament information was not set for {U}."),
    (r"loading timed out", "Filament loading at {U} timed out, usually because the path is blocked or the tube came off."),
    (r"drive gear", "Filament is blocked at the drive gear of {U}."),
    (r"loading anomaly", "A filament loading anomaly was reported for {U}."),
    (r"residual filament", "Filament remains in {U} and must be removed before retrying."),
    (r"encoder wheel|feeding timeout|stroke overrun|feeding failure", "The feeding path of {U} is likely tangled, jammed or detached."),
    (r"unloading anomaly|manual loading anomaly", "An unloading or manual loading anomaly occurred at {U}."),
    (r"calibration sensor", "The calibration sensor reading of {U} is missing or out of range."),
    (r"timing belts", "Homing failed; belt tension or an obstruction on the X/Y homing positions is suspected."),
    (r"axis movement anomaly|movement anomaly", "A single-axis movement anomaly occurred."),
    (r"travel limit", "A move went past the travel limit of an axis."),
    (r"tap home first|home x and y|home first", "A move was requested before the required homing."),
    (r"obvious resistance", "An axis shows noticeable resistance while moving."),
    (r"homing sensor not triggered", "The homing sensor did not trigger; residual filament on the nozzle is a known cause."),
    (r"shutdown protection", "The system is in protection shutdown and refuses this operation."),
    (r"toolhead is unavailable", "The current toolhead is unavailable for homing."),
    (r"adc sensor", "An ADC sensor configuration exceeded its limit; the system shut down to protect itself."),
    (r"failed to heat|heating module", "The heating module failed to heat normally; the system shut down to protect itself."),
    (r"heated bed temperature exceeded", "The heated bed temperature exceeded its limit."),
    (r"heated bed heating|bed detection", "The heated bed did not heat or was not detected normally."),
    (r"chamber temperature", "The chamber temperature exceeded its limit; check the sensor connection."),
    (r"accelerometer", "The accelerometer reported a storage or identification anomaly."),
    (r"motor driver", "A motor driver anomaly was reported."),
    (r"pei sheet", "The PEI sheet state does not match what the operation expects."),
    (r"toolhead swapping times", "The toolhead swap counter reached the maintenance interval."),
    (r"unrecognized by printer|toolhead unrecognized", "The G-code selected a toolhead the printer does not know."),
    (r"tap the error code", "{U} reported a generic anomaly; the screen's detail view holds more information and support is advised."),
    (r"obstructions and if toolhead nozzle|any obstructions", "Calibration probing met an obstruction or residual filament on the nozzle."),
    (r"^retry\.", "The operation failed with no further detail; retrying is the only guidance given."),
    (r"m28, m29", "The sliced file uses M28, M29 or M30, which the printer does not support."),
    (r"retrieve file list", "The printer could not retrieve its file list."),
    (r"cannot operate slicing files", "Sliced files cannot be handled while a print is running."),
    (r"resetting slicing file", "The sliced file cannot be reset while its G-code is being parsed."),
    (r"cannot open slicing file", "The sliced file could not be opened."),
    (r"failed to resume printing after power", "Resuming the print after a power outage failed."),
    (r"deleting power-off data", "Power-off data cannot be deleted during a print."),
    (r"missing a required parameter", "A G-code command is missing a required parameter."),
    (r"parameter parsing failed", "A G-code command parameter could not be parsed."),
    (r"less than the minimum", "A G-code command parameter is below its minimum."),
    (r"greater than the maximum", "A G-code command parameter is above its maximum."),
    (r"must be greater than", "A G-code command parameter must be larger than a value set earlier."),
    (r"must be less than", "A G-code command parameter must be smaller than a value set later."),
    (r"registered repeatedly", "A G-code command was registered twice."),
    (r"mux command", "A multiplexed G-code command failed to register (key error)."),
    (r"cannot be parsed", "The G-code could not be parsed."),
    (r"receives an invalid parameter", "A G-code command received an invalid parameter."),
    (r"gcode|g-code", "The G-code or one of its commands was rejected."),
    (r"slicing file|file list|m28", "A problem with the sliced file was reported."),
    (r"power outage|power-off data", "A power-loss recovery problem was reported."),
    (r"calibration", "A calibration step failed or its preconditions were not met."),
    (r"attach any one toolhead", "At least one toolhead must be attached for this operation."),
    (r"failed to activate", "Activation failed."),
]

ACTIONS: list[tuple[str, str]] = [
    (r"contact (technical )?support", "contact_support"),
    (r"retry|try again", "retry"),
    (r"resume|play button|tap to", "resume_from_screen"),
    (r"cable|connector|connection of", "check_cable"),
    (r"tangle|tube|path|obstruct|blocked|clog|foreign", "check_path_obstruction"),
    (r"dropped or tilted|reinstall|dock", "check_dock"),
    (r"insert filament|reload", "load_filament"),
    (r"unload|remove the residual", "unload_filament"),
    (r"clean", "clean"),
    (r"update firmware", "update_firmware"),
    (r"factory settings", "restore_factory_settings"),
    (r"export printer logs", "export_logs"),
    (r"snapmaker orca", "reslice_with_orca"),
    (r"power off|restart", "power_cycle"),
    (r"home", "home_axes"),
    (r"grease|maintenance", "maintenance"),
]


# What the linked official article asks the owner to send to support (read on each article, 2026-11-06).
SUPPORT_BY_ARTICLE = {
    "u1_axis_movement_anomaly": ["video_error", "logs"], "U1_homing_failure": ["video_error", "logs"], "u1_calibration_anomaly": ["video_error", "logs"],
    "0003-0522-0000-0002or0000": ["logs"], "u1_mainboard_MCU_control_timeout": ["logs", "gcode_file"], "hub-board-connection-issue": ["logs"],
    "Filament_loading_Anomaly": ["photo_runout_cable", "serial_number"], "pogopin_contact_anomaly": ["order_number", "photos_per_toolhead", "error_count"],
    "U1_nozzle_temperature_is_abnormal_caused_by_incorrect_slicing_parameters": ["gcode_file"], "toolhead_swapping_anomaly_first_setup": ["swap_video"],
}


def article_link(r: dict) -> dict | None:
    """Official link from the table cell itself (wiki page or the official video), never guessed from titles."""
    href = r.get("href")
    if not href:
        return None
    if href.startswith("/en/"):
        return {"title": r["article"], "url": "https://wiki.snapmaker.com" + urllib.parse.quote(href, safe="/"), "kind": "wiki"}
    if href.startswith("https://www.youtube.com/"):
        return {"title": r["article"], "url": href, "kind": "video"}
    return None


def build_entry(r: dict) -> dict:
    mod, idx = r["code"].split("-")[1], int(r["code"].split("-")[2])
    text = r["details"]
    nums = sorted(set(NUM_RE.findall(r["title"] + " " + text)))
    word = UNIT_WORD.get(mod, "toolhead")
    # The row text always wins over the index convention: 0522-*-0017 rows shift the index by one
    # (0 = mainboard, 1..4 = toolheads) compared with the 0006/0008/0016 rows.
    host = re.search(r"(?i)\b(host|mainboard) mcu", text)
    head, mapping = None, None
    if len(nums) == 1:
        head, mapping = int(nums[0]), "ROW_TEXT"
    elif not host and unit_from_index(mod, idx) is not None:
        head, mapping = unit_from_index(mod, idx), "MODULE_INDEX_RULE"
    if mod == "0522":
        unit = f"{host.group(1).capitalize()} MCU" if host else (f"Toolhead {head} MCU" if head else "The MCU")
    else:
        unit = f"{word.capitalize()} {head}" if head else "The printer"
    axis = re.search(r"(?i)(?<![a-z])([xyz])[- ]axis", text)
    low = text.lower()
    cause = next((c for rx, c in CAUSES if re.search(rx, low)), "An anomaly was reported; the official table gives no more specific cause.")
    actions = sorted({a for rx, a in ACTIONS if re.search(rx, low)}) or ["see_article"]
    base = re.sub(rf"(?i)^{word}\s+", "", r["title"])
    title = r["title"] if (mod != "0522" and not head) else f"{unit}: {base[0].upper() + base[1:]}"
    e = {"code": r["code"], "title": title, "summary": cause.format(U=unit).replace(" The printer", " the printer"), "toolhead": head, "mapping": mapping, "actions": actions}
    if axis:
        e["axis"] = axis.group(1).upper()
    ordered = [int(x) for x in NUM_RE.findall(text)]  # first number = the subject head, the rest = heads the row tells to inspect
    if "dropped or tilted" in low and len(ordered) >= 2:
        e["inspect_toolheads"], e["inspect_scope"] = sorted(set(ordered[1:])), "listed"
    elif "one by one" in low or "properly picked and placed" in low:
        e["inspect_toolheads"], e["inspect_scope"] = [1, 2, 3, 4], "all"
    elif ("reinstall the toolhead" in low or "return failed" in low) and ordered:
        e["inspect_toolheads"], e["inspect_scope"] = [ordered[0]], "this_head"
    e["article"] = article_link(r)
    href = r.get("href") or ""
    asks = SUPPORT_BY_ARTICLE.get(href.rstrip("/").rsplit("/", 1)[-1]) if href.startswith("/en/") else None
    asks = asks or (["logs"] if "export_logs" in actions else None)  # two rows say to export the printer logs
    if asks:
        e["support_asks"] = asks
    return e


RELEASE_BASE = "https://wiki.snapmaker.com/en/snapmaker_u1/firmware/release_notes/v"
KNOWN_ISSUES = "https://wiki.snapmaker.com/en/snapmaker_u1/troubleshooting/known_issues_and_quick_fixes"
FIRMWARE_LATEST = {"version": "2.1.0", "date": "2026-11-04", "source": "https://wiki.snapmaker.com/en/snapmaker_u1/firmware/release_notes"}


def _fw(version: str, kind: str, text: str) -> dict:
    return {"component": "firmware", "version": version, "kind": kind, "text": text, "source": RELEASE_BASE + version.replace(".", "")}


# Facts read in the official release notes (own wording). kind: introduced | changed | fixed | mitigated.
_MCU = _fw("1.4.0", "mitigated", "Firmware 1.4.0 reduced MCU control timeout errors.")
_TIMER = _fw("1.5.0", "mitigated", "Firmware 1.5.0 improved system performance to reduce the 'timer too close' error.")
_ORCA = {"component": "Snapmaker Orca", "version": "2.1.2", "kind": "fixed", "source": KNOWN_ISSUES,
         "text": "Snapmaker Orca older than 2.1.2 with the interface in German or French writes decimal commas that trigger this code."}
FW_RULES: list[tuple[str, list[dict]]] = [
    (r"^0003-0522-0000-0016$", [_MCU, _TIMER]),
    (r"^0003-0522-\d{4}-0016$", [_MCU]),
    (r"^0002-0523-\d{4}-0045$", [_fw("1.3.0", "changed", "Firmware 1.3.0 changed the pogo-pin continuity check to avoid false detections that paused prints.")]),
    (r"^0002-0523-000[123]-0000$", [_fw("1.1.1", "fixed", "Firmware 1.1.1 fixed a toolhead being wrongly seen as loaded during a filament-runout pause."),
                                   _fw("1.4.1", "fixed", "Firmware 1.4.1 fixed filament runout not pausing the print in some cases, such as a new print started right after cancelling one.")]),
    (r"^0002-0523-\d{4}-0038$", [_fw("0.9.4", "introduced", "Firmware 0.9.4 added an adjustable sensitivity for filament-tangle detection."),
                                 _fw("1.1.0", "changed", "Firmware 1.1.0 added a medium sensitivity option for tangle detection.")]),
    (r"^0002-0523-\d{4}-0039$", [_fw("1.1.1", "changed", "Firmware 1.1.1 no longer requires editing material information by hand after a runout."),
                                 _fw("1.3.0", "fixed", "Firmware 1.3.0 fixed the 'unedited filament' message staying on screen.")]),
    (r"^0003-0523-\d{4}-0001$", [_fw("0.9.4", "introduced", "Firmware 0.9.4 set the minimum active-toolhead temperature to 170 degC during printing.")]),
    (r"^0003-0529-0000-0001$", [_ORCA]),
]
HOMING_NOTE = _fw("1.0.0", "changed", "Firmware 1.0.0 added homing calibration and optimised the homing logic to prevent homing failures.")


def fw_notes_for(entry: dict) -> list[dict]:
    notes = [n for rx, ns in FW_RULES if re.match(rx, entry["code"]) for n in ns]
    if entry["code"].split("-")[1] == "0528" and "Homing Anomaly" in entry["title"]:
        notes.append(HOMING_NOTE)
    return list({n["text"]: n for n in notes}.values())


def pages_citing_codes() -> dict[str, str]:
    """Wiki pages whose own title names a code (a few codes have a dedicated page the table does not link)."""
    lst = json.loads((RAW / "pages.json").read_text(encoding="utf-8"))["data"]["pages"]["list"]
    out: dict[str, str] = {}
    for p in lst:
        if p["locale"] == "en" and "u1" in p["path"].lower():
            for c in re.findall(r"\d{4}-\d{4}-\d{4}-\d{4}", p["title"]):
                out.setdefault(c, p["path"])
    return out


def main() -> None:
    cited = pages_citing_codes()
    rows = json.loads((RAW / "codes_parsed.json").read_text(encoding="utf-8"))
    for r in rows:  # link a dedicated page only when the table has no link of its own
        if not r.get("href") and r["code"] in cited:
            r["href"], r["article"] = "/en/" + cited[r["code"]], r["article"] if r["article"] not in ("", "—") else cited[r["code"]].rsplit("/", 1)[-1].replace("_", " ")
    cat = json.loads(CAT.read_text(encoding="utf-8"))
    kept = {e["code"]: e for e in cat["entries"]}
    out = []
    for r in sorted(rows, key=lambda x: x["code"]):
        e = build_entry(r)
        old = kept.get(r["code"])
        if old:  # keep hand-written wording; take only new optional fields
            e = {**old, "mapping": e["mapping"] if old.get("toolhead") == e["toolhead"] else old.get("mapping"),
                 "actions": e["actions"], "article": e["article"],
                 **{k: e[k] for k in ("inspect_toolheads", "inspect_scope", "support_asks") if k in e}}
        notes = fw_notes_for(e)
        if notes:
            e["fw_notes"] = notes
        out.append(e)
    missing = set(kept) - {e["code"] for e in out}
    assert not missing, f"hand-written codes absent from the table: {sorted(missing)}"
    cat.update(catalog_version="0.3.0", last_verified_at=VERIFIED_AT, firmware_latest=FIRMWARE_LATEST, entries=out)
    cat["modules"] = {**cat["modules"]}
    CAT.write_text(json.dumps(cat, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(len(out), "entries;", sum(1 for e in out if e["article"]), "with article;", sum(1 for e in out if e["toolhead"]), "with toolhead")


if __name__ == "__main__":
    main()
