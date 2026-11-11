"""Support pack: one AES-256 encrypted zip with what Snapmaker support usually asks for, built from read-only GET (BACKLOG #70).

Owner-triggered, on explicit consent, to one RFC1918 address on port 7125, through the same read-only transport as the live
capture but with `support=True` (a larger, still GET-only allowlist: ADR-0002 amendment 2026-11-10 b). Nothing is ever written
to the printer. The pack is built in memory; its password is generated here, returned once to the owner and never stored.

Unlike the U1-DEB bundle, this pack is NOT anonymous: it holds the printer serial number (optional) and raw logs, because support
needs them. IPv4/IPv6/MAC addresses are removed from the logs and from the system info unless the owner turns that off. The zip
member names are not encrypted (AES zip limit), the contents are.
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import secrets
from collections.abc import Callable
from datetime import UTC, datetime
from functools import partial
from typing import Any

import httpx
import pyzipper

from .transport import Consent, PolicyViolation, ReadOnlyMoonrakerTransport
from .transport.policy import SUPPORT_OBJECTS, is_support_download
from .transport.readonly import TransportError

MAX_FILE_BYTES = 12 * 1024 * 1024
MAX_TOTAL_BYTES = 80 * 1024 * 1024
KLIPPY_ROTATIONS = 3  # klippy.log, .1, .2: the current run and the two before it
_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O/1/I/L: the password is read aloud or typed from a screen
_LOG_ORDER = ("klippylogs/klippy.log", "moonraker.log", "unisrv.log", "syslog", "mosquitto.log", "flow_calculator.log", "gui.log")  # touchscreen log last
_IPV4 = re.compile(rb"\b\d{1,3}(?:\.\d{1,3}){3}\b")
_H = rb"[0-9a-fA-F]{1,4}"
# Full form (8 groups) or compressed form (contains "::"): a clock such as 12:30:45 or a MAC (6 groups of 2) never matches.
_IPV6 = re.compile(
    rb"(?<![0-9a-fA-F:])(?:(?:" + _H + rb":){7}" + _H + rb"|(?:" + _H + rb":){1,7}:(?:" + _H + rb"(?::" + _H + rb"){0,6})?"
    + rb"|::" + _H + rb"(?::" + _H + rb"){0,6})(?![0-9a-fA-F:])")
_MAC = re.compile(rb"\b[0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5}\b")


class PackError(Exception):
    """A failure that is safe to show: `code` is stable, `message` never holds the address."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def new_password() -> str:
    """20 characters from a 31-letter alphabet (about 99 bits), shown as five groups of four."""
    raw = "".join(secrets.choice(_ALPHABET) for _ in range(20))
    return "-".join(raw[i:i + 4] for i in range(0, 20, 4))


def scrub_network(data: bytes) -> bytes:
    """Replace IPv4, IPv6 and MAC addresses by placeholders (bytes in, bytes out; invalid UTF-8 is left alone)."""
    return _IPV6.sub(b"<ip6>", _MAC.sub(b"<mac>", _IPV4.sub(b"<ip>", data)))


def _redact_system_info(doc: dict[str, Any], *, serial: bool, network: bool) -> dict[str, Any]:
    r = doc.get("result")
    si = r.get("system_info") if isinstance(r, dict) else None
    if not isinstance(si, dict):
        return doc
    if network:
        si.pop("network", None)
        if isinstance(si.get("cpu_info"), dict):
            si["cpu_info"].pop("serial_number", None)
    if not serial:
        for part in ("product_info", "sd_info"):
            if isinstance(si.get(part), dict) and "serial_number" in si[part]:
                si[part]["serial_number"] = "<removed by owner>"
    return doc


def _pick_logs(listing: dict[str, Any]) -> list[tuple[str, int]]:
    """Allowed log files from a `logs` listing, most useful first, with the klippy rotation limit applied."""
    res = listing.get("result")
    rows = res if isinstance(res, list) else []
    sizes = {str(r.get("path")): r.get("size") for r in rows if isinstance(r, dict) and isinstance(r.get("path"), str)}
    names = [n for n in sizes if is_support_download(f"/server/files/logs/{n}")]

    def rank(n: str) -> tuple[int, int]:
        base = n.rsplit(".", 1)[0] if re.search(r"\.\d{1,2}$", n) and not n.endswith(".csv") else n
        i = next((k for k, b in enumerate(_LOG_ORDER) if n == b or base == b), len(_LOG_ORDER))
        m = re.search(r"\.(\d{1,2})$", n)
        return i, int(m.group(1)) if m else -1

    keep = []
    for n in sorted(names, key=rank):
        m = re.fullmatch(r"klippylogs/klippy\.log(?:\.(\d{1,2}))?", n)
        if m and int(m.group(1) or 0) >= KLIPPY_ROTATIONS:
            continue
        sz = sizes[n]
        keep.append((n, int(sz) if isinstance(sz, int | float) else 0))
    return keep


def _pick_configs(listing: dict[str, Any]) -> list[str]:
    res = listing.get("result")
    rows = res if isinstance(res, list) else []
    names = sorted(str(r["path"]) for r in rows if isinstance(r, dict) and isinstance(r.get("path"), str))
    return [n for n in names if is_support_download(f"/server/files/config/{n}")]


def _mcu_versions(objects: dict[str, Any]) -> dict[str, str]:
    st = (objects.get("result") or {}).get("status") if isinstance(objects.get("result"), dict) else None
    out: dict[str, str] = {}
    for k, v in (st or {}).items():
        if k.startswith("mcu") and isinstance(v, dict) and isinstance(v.get("mcu_version"), str):
            out[k] = v["mcu_version"]
    return out


CHECKLIST_EN = """What Snapmaker support usually asks for (from the official wiki; add what applies, then send):
 - The error code shown on the screen (or a photo of it).
 - Photos or a short video of the problem, taken in good light.
 - The G-code / project file that was printing (for first-layer or quality issues also: firmware version, whether bed leveling was on).
 - For axis, calibration or MCU time-out cases: the official system log. It is ENCRYPTED and only support can open it:
   touchscreen Settings > About > System Log > export to a USB stick (FAT32/EXT2/EXT4, 64 GB or less), or, from firmware 1.1.1, to the Fluidd `logs` folder.
 - For pick/park problems: support may send a test G-code (100 cycles) to be filmed.
This pack already holds the readable parts (state, versions, recent jobs, temperatures, plain logs, calibration files)."""
CHECKLIST_FR = """Ce que le support Snapmaker demande en général (d'après le wiki officiel ; ajoutez ce qui s'applique, puis envoyez) :
 - Le code d'erreur affiché à l'écran (ou une photo).
 - Des photos ou une courte vidéo du problème, bien éclairées.
 - Le G-code / fichier de projet en cours (pour une première couche ou la qualité : aussi la version du firmware et si le nivellement du lit était activé).
 - Pour les cas d'axes, de calibration ou de time-out MCU : le journal système officiel. Il est CHIFFRÉ et seul le support peut l'ouvrir :
   écran tactile Réglages > À propos > Journal système > export sur clé USB (FAT32/EXT2/EXT4, 64 Go max), ou, dès le firmware 1.1.1, vers le dossier `logs` de Fluidd.
 - Pour les problèmes de pick/park : le support peut envoyer un G-code de test (100 cycles) à filmer.
Ce dossier contient déjà les parties lisibles (état, versions, jobs récents, températures, journaux en clair, fichiers de calibration)."""


def _summary(*, app_version: str, now: str, code: str | None, notes: str | None, info: dict[str, Any], mcus: dict[str, str],
             errors: list[dict[str, Any]], redacted: bool, serial: bool) -> str:
    si = ((info.get("result") or {}).get("system_info") or {}) if isinstance(info.get("result"), dict) else {}
    pi = si.get("product_info") or {}
    dist = si.get("distribution") or {}
    lines = [
        "U1 Doctor support pack / Dossier support U1 Doctor",
        f"Created / Créé : {now} (U1 Doctor {app_version})",
        "",
        f"Error code / Code d'erreur : {code or '-'}",
        f"Owner notes / Notes du propriétaire : {notes or '-'}",
        "",
        f"Machine : {pi.get('machine_type', '?')}",
        f"Firmware : {pi.get('firmware_version', '?')} (software {pi.get('software_version', '?')})",
        f"Serial number / N° de série : {pi.get('serial_number', '?') if serial else '(removed by owner / retiré par le propriétaire)'}",
        f"OS : {dist.get('name', '?')} {dist.get('version', '')}, kernel {dist.get('kernel_version', '?')}",
        "",
        "MCU versions (a different version on one MCU is worth telling support):",
    ]
    lines += [f"  {k}: {v}" for k, v in sorted(mcus.items())] or ["  not read / non lu"]
    if len(set(mcus.values())) > 1:
        lines.append("  !! the MCU versions are NOT all the same / les versions MCU ne sont PAS toutes identiques")
    lines += ["", f"IP/MAC addresses removed from logs and system info / adresses IP et MAC retirées : {'yes / oui' if redacted else 'NO / NON'}"]
    if errors:
        lines += ["", "Not collected / Non collecté :"] + [f"  {e['op']}: {e.get('why', 'error')}" for e in errors]
    return "\n".join(lines) + "\n\n" + CHECKLIST_EN + "\n\n" + CHECKLIST_FR + "\n"


def build_support_pack(host: str, *, code: str | None = None, notes: str | None = None, include_serial: bool = True,
                       redact_network: bool = True, include_job_names: bool = False,
                       http_transport: httpx.BaseTransport | None = None,
                       progress: Callable[[str], None] | None = None) -> dict[str, Any]:
    """Collect and zip. Raises PackError. `http_transport` is a test hook only. Returns the zip bytes, the password and a summary."""
    from .api import APP_VERSION  # lazy: app.api imports this module

    consent = Consent(approved_by_owner=True, target_host=host, scope="SUPPORT")
    try:
        tr = ReadOnlyMoonrakerTransport(host, consent=consent, http_transport=http_transport, timeout_s=30.0, support=True)
    except PolicyViolation as e:
        raise PackError("REFUSED_TARGET", "only a private IPv4 address (10.x, 172.16-31.x, 192.168.x) is accepted") from e
    now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    errors: list[dict[str, Any]] = []
    files: dict[str, bytes] = {}

    def say(msg: str) -> None:
        if progress:
            progress(msg)

    def get(op: str, fn: Callable[[], Any]) -> Any:
        try:
            return fn()
        except (TransportError, httpx.HTTPError, OSError) as e:
            errors.append({"op": op, "why": str(e)[:120]})
            return None

    def put_json(name: str, doc: Any) -> None:
        raw = json.dumps(doc, indent=2, ensure_ascii=False, sort_keys=True).encode()
        files[name] = scrub_network(raw) if redact_network else raw

    try:
        say("printer")
        server = get("server.info", tr.get_server_info)
        if server is None:
            raise PackError("UNREACHABLE", "the printer did not answer on port 7125 (check power, network and address)")
        pinfo = get("printer.info", tr.get_printer_info)
        sysinfo = get("machine.system_info", tr.get_system_info) or {}
        sysinfo = _redact_system_info(sysinfo, serial=include_serial, network=redact_network)
        for name, doc in (("printer/server_info.json", server), ("printer/printer_info.json", pinfo),
                          ("printer/system_info.json", sysinfo or None),
                          ("printer/proc_stats.json", get("machine.proc_stats", tr.get_proc_stats)),
                          ("printer/usb_devices.json", get("machine.peripherals.usb", tr.get_usb_devices)),
                          ("printer/history_totals.json", get("server.history.totals", tr.get_history_totals)),
                          ("printer/temperature_store.json", get("server.temperature_store", tr.get_temperature_store)),
                          ("printer/console.json", get("server.gcode_store", tr.get_gcode_store))):
            if doc is not None:
                put_json(name, doc)
        jobs = get("server.history.list", tr.get_history_jobs)
        if jobs is not None:
            for j in ((jobs.get("result") or {}).get("jobs") or []) if isinstance(jobs.get("result"), dict) else []:
                if isinstance(j, dict):
                    j.pop("user", None)
                    if isinstance(j.get("metadata"), dict):
                        j["metadata"].pop("thumbnails", None)
                        j["metadata"].pop("uuid", None)
                    if not include_job_names:
                        j.pop("filename", None)
            put_json("printer/history_jobs.json", jobs)
        objs = get("printer.objects.query", lambda: tr.query_objects(sorted(SUPPORT_OBJECTS)))
        mcus: dict[str, str] = {}
        if objs is not None:
            put_json("printer/objects_state.json", objs)
            mcus = _mcu_versions(objs)

        say("config")
        listing = get("server.files.list(config)", lambda: tr.list_files("config"))
        for n in _pick_configs(listing or {}):
            data = get(f"config/{n}", partial(tr.download_file, "config", n, MAX_FILE_BYTES))
            if data is not None:
                files[f"config/{n}"] = scrub_network(data) if redact_network else data
        say("logs")
        total = 0
        listing = get("server.files.list(logs)", lambda: tr.list_files("logs"))
        for n, size in _pick_logs(listing or {}):
            if total + size > MAX_TOTAL_BYTES:
                errors.append({"op": f"logs/{n}", "why": "skipped: total size limit"})
                continue
            data = get(f"logs/{n}", partial(tr.download_file, "logs", n, MAX_FILE_BYTES))
            if data is not None:
                total += len(data)
                files[f"logs/{n}"] = scrub_network(data) if redact_network else data
        audit = [{"method": a.method, "tag": a.tag, "status": a.status, "allowed": a.allowed} for a in tr.audit]
    finally:
        tr.close()
    if any(a["method"] != "GET" or not a["allowed"] for a in audit):  # pragma: no cover - fixed senders; tripwire
        raise RuntimeError("operation outside the documented budget recorded: STOP")

    say("zip")
    info_doc = sysinfo if isinstance(sysinfo, dict) else {}
    files["LISEZ-MOI-README.txt"] = _summary(app_version=APP_VERSION, now=now, code=code, notes=notes, info=info_doc, mcus=mcus, errors=errors,
                                             redacted=redact_network, serial=include_serial).encode()
    manifest = {"format": "u1-doctor-support-pack", "format_version": "1.0.0", "app_version": APP_VERSION, "created_utc": now,
                "options": {"include_serial": include_serial, "redact_network": redact_network, "include_job_names": include_job_names},
                "read_only_requests": len(audit), "not_collected": errors,
                "files": [{"name": n, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()} for n, b in sorted(files.items())]}
    files["manifest.json"] = json.dumps(manifest, indent=2, ensure_ascii=False, sort_keys=True).encode()
    password = new_password()
    buf = io.BytesIO()
    with pyzipper.AESZipFile(buf, "w", compression=pyzipper.ZIP_DEFLATED, compresslevel=6, encryption=pyzipper.WZ_AES) as zf:
        zf.setpassword(password.encode())
        zf.setencryption(pyzipper.WZ_AES, nbits=256)
        for n in sorted(files):
            zf.writestr(n, files[n], compress_type=pyzipper.ZIP_DEFLATED)
    blob = buf.getvalue()
    return {"name": f"u1-support-pack-{now.replace(':', '').replace('-', '')}.zip", "zip": blob, "password": password, "bytes": len(blob),
            "sha256": hashlib.sha256(blob).hexdigest(), "files": manifest["files"], "not_collected": errors, "created_utc": now,
            "options": manifest["options"], "mcu_versions": mcus}
