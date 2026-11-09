"""Import log files exported from a Snapmaker U1 or from Snapmaker Orca as IMPORTED evidence.

Reads, never writes: pure functions over bytes, no network, nothing executed. Accepted: a plain log, `.gz`, `.zip` or
`.tar.gz` (several logs at once). Recognized kinds: Moonraker, Klipper (klippy), unisrv, syslog, GUI, mosquitto, the
flow calculator, Snapmaker Orca (the slicer, Windows), and the encrypted system log of the printer (recognized, never read).

Privacy by construction: parsers keep only counts, dates, codes and short fixed facts. File names, paths, IP and MAC
addresses, serial numbers and user names are never copied into an observation (messages are scrubbed too).
Everything is labelled IMPORTED: it was not observed by U1 Doctor on a machine.
"""
from __future__ import annotations

import gzip
import io
import re
import tarfile
import zipfile
from collections import Counter
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

MAX_UPLOAD = 64 * 1024 * 1024           # bytes received (compressed)
MAX_MEMBERS = 64                         # files inside one archive
MAX_MEMBER_BYTES = 256 * 1024 * 1024     # one decompressed log
MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024  # all decompressed logs of one import
MAX_RATIO = 400                          # decompressed / compressed, per member (zip bomb guard)
MAX_OBS = 3000
SESSION = "logs_import"
NOTICE = ("Read from log files you provided. Not an observation made by U1 Doctor on a machine: the files may be old, partial or edited, "
          "and times are the clock written in each log (its time zone is not recorded). Personal data (file names, paths, addresses, "
          "serial numbers, user names) is not copied.")


class LogImportError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


# ---------------------------------------------------------------- containers
def _bomb(compressed: int, size: int) -> bool:
    return size > MAX_MEMBER_BYTES or (compressed > 0 and size / compressed > MAX_RATIO and size > 1024 * 1024)


def _lines(raw: Iterator[bytes]) -> Iterator[str]:
    for b in raw:
        yield b.decode("utf-8", "replace").rstrip("\r\n")


def open_members(data: bytes) -> list[tuple[str, Iterator[str] | None, int]]:
    """Return [(kind_hint, line_iterator_or_None, decompressed_size)]. `None` = recognized but never read (encrypted)."""
    if len(data) > MAX_UPLOAD:
        raise LogImportError("TOO_LARGE", "upload larger than 64 MiB")
    if data[:4] == b"PK\x03\x04":
        try:
            z = zipfile.ZipFile(io.BytesIO(data))
        except zipfile.BadZipFile as e:
            raise LogImportError("BAD_ARCHIVE", "not a valid zip file") from e
        infos = [i for i in z.infolist() if not i.is_dir()]
        if len(infos) > MAX_MEMBERS:
            raise LogImportError("TOO_MANY_FILES", f"more than {MAX_MEMBERS} files in the archive")
        total = 0
        out: list[tuple[str, Iterator[str] | None, int]] = []
        for i in infos:
            if i.flag_bits & 1:
                raise LogImportError("ENCRYPTED_ZIP", "password-protected zip files are not read")
            total += i.file_size
            if _bomb(i.compress_size, i.file_size) or total > MAX_TOTAL_BYTES:
                raise LogImportError("TOO_LARGE", "the logs are too large once unpacked")
            out.append(("", _lines(z.open(i)), i.file_size))
        return out
    if data[:2] == b"\x1f\x8b":
        try:
            raw = gzip.GzipFile(fileobj=io.BytesIO(data))
            head = raw.read(512)
        except (OSError, EOFError) as e:
            raise LogImportError("BAD_ARCHIVE", "not a valid gzip file") from e
        if len(head) > 262 and head[257:262] == b"ustar":  # a tar archive inside the gzip
            return _tar(data)
        return [("", _lines(io.BufferedReader(_Cap(gzip.GzipFile(fileobj=io.BytesIO(data))))), 0)]
    return [("", _lines(io.BytesIO(data)), len(data))]


class _Cap(io.RawIOBase):
    """Reads a decompressing stream but refuses to go past MAX_MEMBER_BYTES (gzip bomb guard)."""

    def __init__(self, inner: Any) -> None:
        self.inner, self.n = inner, 0

    def readable(self) -> bool:
        return True

    def readinto(self, b: Any) -> int:
        chunk = self.inner.read(len(b))
        self.n += len(chunk)
        if self.n > MAX_MEMBER_BYTES:
            raise LogImportError("TOO_LARGE", "the log is too large once unpacked")
        b[:len(chunk)] = chunk
        return len(chunk)


def _tar(data: bytes) -> list[tuple[str, Iterator[str] | None, int]]:
    try:
        t = tarfile.open(fileobj=io.BytesIO(data), mode="r:gz")
        members = [m for m in t.getmembers() if m.isfile()]
    except (tarfile.TarError, OSError, EOFError) as e:
        raise LogImportError("BAD_ARCHIVE", "not a valid tar.gz file") from e
    if len(members) > MAX_MEMBERS:
        raise LogImportError("TOO_MANY_FILES", f"more than {MAX_MEMBERS} files in the archive")
    names = {m.name.rsplit("/", 1)[-1] for m in members}
    if {"content.enc", "key.enc"} <= names:  # the printer's own encrypted export: recognized, never opened
        return [("encrypted", None, sum(m.size for m in members))]
    out: list[tuple[str, Iterator[str] | None, int]] = []
    total = 0
    for m in members:
        total += m.size
        if m.size > MAX_MEMBER_BYTES or total > MAX_TOTAL_BYTES:
            raise LogImportError("TOO_LARGE", "the logs are too large once unpacked")
        f = t.extractfile(m)
        if f is not None:
            out.append(("", _lines(f), m.size))
    return out


# ---------------------------------------------------------------- recognition
_ORCA = re.compile(r"^\[(?:trace|debug|info|warning|error|fatal)\]\t\d{4}-\d\d-\d\d \d\d:\d\d:\d\d")
_MOON = re.compile(r"^(?:-{10,} Log Start \||\d{4}-\d\d-\d\d \d\d:\d\d:\d\d,\d+ \[[\w.]+\.py)")
_UNI = re.compile(r"^\[\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+\] \[unisrv\]")
_SYS = re.compile(r"^[A-Z][a-z]{2} +\d{1,2} \d\d:\d\d:\d\d \S+ \S+\.\S+ ")
_GUI = re.compile(r"^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+ \(")
_MOSQ = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d: ")
_FLOW = re.compile(r"^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d \[(?:INFO|WARN|ERROR)")
_KLIPPY = re.compile(r"^(?:\d\d-\d\d )?(?:\d\d:\d\d:\d\d\.\d+:|=+ Config file =+)|^=+ Log rollover at |^Stats \d+\.\d+:|^Starting Klippy")


def classify(sample: list[str]) -> str:
    votes: Counter[str] = Counter()
    for ln in sample:
        for kind, rx in (("orca", _ORCA), ("moonraker", _MOON), ("unisrv", _UNI), ("syslog", _SYS), ("gui", _GUI),
                         ("mosquitto", _MOSQ), ("flow", _FLOW), ("klippy", _KLIPPY)):
            if rx.match(ln):
                votes[kind] += 1
                break
        else:
            if ln.startswith("# ver:"):
                votes["sysinfo"] += 3
    return votes.most_common(1)[0][0] if votes else "unknown"


# ---------------------------------------------------------------- helpers
_PATH = re.compile(r"(?:[A-Za-z]:\\|/(?:home|userdata|oem|tmp|var|usr)/)[^\s'\",)}\]]*")
_IP = re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}\b")
_MAC = re.compile(r"\b[0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5}\b")


def scrub(text: str, limit: int = 200) -> str:
    return _MAC.sub("<mac>", _IP.sub("<ip>", _PATH.sub("<path>", text)))[:limit]


def _utc(d: datetime) -> str:
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


class _Acc:
    """Collects observations for one import, in a deterministic order, with a hard cap."""

    def __init__(self, imported_at: str) -> None:
        self.rows: list[dict[str, Any]] = []
        self.imported_at = imported_at
        self.dropped = 0

    def add(self, when: datetime | None, event_type: str, value: dict[str, Any], *, ref: str, quality: str | None = None) -> None:
        if len(self.rows) >= MAX_OBS:
            self.dropped += 1
            return
        self.rows.append({
            "schema_version": "1.0", "observation_id": f"logs_{len(self.rows) + 1:05d}", "session_id": SESSION, "source_kind": "IMPORT",
            "source_status": "IMPORTED", "capture_utc": _utc(when) if when else self.imported_at, "source_timestamp": None,
            "timestamp_quality": quality or ("SOURCE_WALLCLOCK" if when else "UNKNOWN"), "source_ref": ref, "entity_id": "unmapped",
            "mapping_quality": "UNKNOWN", "event_type": event_type, "value": value, "validity": "FRESH", "sensitive": False})


def _dt(s: str, fmt: str) -> datetime | None:
    try:
        return datetime.strptime(s, fmt).replace(tzinfo=UTC)
    except ValueError:
        return None


# ---------------------------------------------------------------- Moonraker
_M_TS = re.compile(r"^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d),\d+ ")
_M_EXC = re.compile(r"klippy raise exception: \{'id': (\d+), 'index': (\d+), 'code': (\d+), 'level': (\d+), 'message': (.*?), 'timestamp'")
_M_JOB = re.compile(r"state: (started|complete|cancelled|error|paused|resumed)\b")


def official_code(level: int, mid: int, index: int, code: int) -> str:
    """The on-screen code is level-id-index-code, four digits each (checked on 11 real events against the official table)."""
    return f"{level:04d}-{mid:04d}-{index:04d}-{code:04d}"


def parse_moonraker(lines: Iterator[str], acc: _Acc, n: int) -> dict[str, Any]:
    ex: list[tuple[datetime | None, dict[str, Any]]] = []
    starts = 0
    jobs: Counter[str] = Counter()
    mqtt_off: Counter[str] = Counter()
    cloud_fail = dns = 0
    first = last = None
    count = 0
    for ln in lines:
        count += 1
        if "Log Start" in ln and ln.startswith("-"):
            starts += 1
            continue
        m = _M_TS.match(ln)
        if not m:
            continue
        ts = _dt(m[1], "%Y-%m-%d %H:%M:%S")
        if ts:
            first = first or ts
            last = ts
        if "klippy raise exception" in ln:
            e = _M_EXC.search(ln)
            if e:
                mid, idx, code, lvl = (int(e[i]) for i in (1, 2, 3, 4))
                ex.append((ts, {"id": mid, "index": idx, "code": official_code(lvl, mid, idx, code), "raw_code": code, "level": lvl,
                                "message": scrub(e[5].strip("'\" "))}))
        elif "MQTT Client Offline" in ln and ts:
            mqtt_off[ts.strftime("%Y-%m-%d")] += 1
        elif "Max retries reached" in ln:
            cloud_fail += 1
        elif "Temporary failure in name resolution" in ln:
            dns += 1
        elif "_send_job_event" in ln:
            j = _M_JOB.search(ln)
            if j:
                jobs[j[1]] += 1
    for ts, v in ex:
        acc.add(ts, "machine_exception", v, ref="logs/moonraker")
    for day in sorted(mqtt_off):
        acc.add(_dt(day, "%Y-%m-%d"), "cloud_mqtt_offline", {"day": day, "count": mqtt_off[day]}, ref="logs/moonraker")
    acc.add(last, "moonraker_summary", {
        "lines": count, "first_utc": _utc(first) if first else None, "last_utc": _utc(last) if last else None, "service_starts": starts,
        "jobs": dict(sorted(jobs.items())), "cloud_update_failures": cloud_fail, "name_resolution_failures": dns,
        "mqtt_offline_events": sum(mqtt_off.values()), "exceptions": len(ex)}, ref="logs/moonraker")
    return {"lines": count, "exceptions": len(ex), "service_starts": starts, "jobs": dict(jobs), "from": _utc(first) if first else None, "to": _utc(last) if last else None}


# ---------------------------------------------------------------- Klipper
_K_ROLL = re.compile(r"^=+ Log rollover at \w{3} (\w{3}) +(\d+) \d\d:\d\d:\d\d (\d{4}) =+")
_K_TS = re.compile(r"^(?:(\d\d)-(\d\d) )?(\d\d):(\d\d):(\d\d)\.\d+:(.*)$")
_K_STATS = re.compile(r"^(?:\d\d-\d\d )?(\d\d:\d\d:\d\d\.\d+):Stats [\d.]+: gcodein=\d+\s+(.*)$")
_K_MCU = re.compile(r"(\w+): mcu_awake=\S+ mcu_task_avg=\S+ mcu_task_stddev=\S+ err_len=(\d+) err_dest=(\d+) err_sync=(\d+) err_crc=(\d+) "
                    r"bytes_write=\d+ bytes_read=\d+ bytes_retransmit=(\d+) bytes_invalid=(\d+)")
_K_SHUT = re.compile(r"Transition to shutdown state|MCU '\w+' shutdown|Timer too close|Lost communication|Unable to connect|ADC out of range|"
                     r"Heater \S+ not heating|thermal runaway|Move out of range|Must home axis|Internal error|Unable to open serial|Rescheduled timer", re.I)
_MONTHS = {m: i for i, m in enumerate(("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"), 1)}


def parse_klippy(lines: Iterator[str], acc: _Acc, n: int) -> dict[str, Any]:
    day: datetime | None = None
    year = datetime.fromisoformat(acc.imported_at.replace("Z", "+00:00")).year
    prev_s = -1
    in_cfg = False
    mcus: dict[str, dict[str, int]] = {}
    stats = 0
    switches: Counter[str] = Counter()
    retries = parks = 0
    versions: dict[str, str] = {}
    shut: list[tuple[datetime | None, str]] = []
    mesh: dict[str, float] = {}
    mesh_runs = 0
    starts = 0
    first = last = None
    count = 0
    for ln in lines:
        count += 1
        if "===== Config file" in ln[:40]:
            in_cfg = True
            continue
        if in_cfg:
            if ln.startswith("======="):
                in_cfg = False
            continue
        r = _K_ROLL.match(ln)
        if r:
            day = datetime(int(r[3]), _MONTHS.get(r[1], 1), int(r[2]), tzinfo=UTC)
            year = int(r[3])
            prev_s = -1
            continue
        if ln.startswith("Starting Klippy") or ln.startswith("Git version:"):
            starts += ln.startswith("Starting Klippy")
            if ln.startswith("Git version:"):
                versions["klipper"] = scrub(ln.split(":", 1)[1].strip(" '"), 40)
            continue
        if ln.startswith("Loaded MCU '"):
            mm = re.match(r"Loaded MCU '(\w+)' \d+ commands \((\S+)", ln)
            if mm:
                versions[f"mcu_{mm[1]}"] = scrub(mm[2], 40)
            continue
        t = _K_TS.match(ln)
        when = None
        if t:
            s = int(t[3]) * 3600 + int(t[4]) * 60 + int(t[5])
            if t[1]:  # rolled logs carry "MM-DD " in front of the time
                try:
                    when = datetime(year, int(t[1]), int(t[2]), tzinfo=UTC) + timedelta(seconds=s)
                except ValueError:
                    when = None
                if when:
                    first, last = first or when, when
            elif day is not None:
                if prev_s >= 0 and s < prev_s - 3600:  # the clock wrapped past midnight
                    day += timedelta(days=1)
                prev_s = s
                when = day + timedelta(seconds=s)
                first, last = first or when, when
        body = t[6] if t else ln
        st = _K_STATS.match(ln)
        if st:
            stats += 1
            for m in _K_MCU.finditer(st[2]):
                d = mcus.setdefault(m[1], {"samples": 0, "err_len": 0, "err_dest": 0, "err_sync": 0, "err_crc": 0, "retransmit": 0, "invalid": 0})
                d["samples"] += 1
                for key, val in zip(("err_len", "err_dest", "err_sync", "err_crc", "retransmit", "invalid"), (int(m[i]) for i in range(2, 8))):
                    d[key] = max(d[key], val)
            continue
        if body.startswith("Activating extruder "):
            switches[body.split()[-1]] += 1
        elif "Failed to switch extruder, retrying" in body:
            retries += 1
        elif body.startswith("park extruder"):
            parks += 1
        elif body.startswith("Mesh Average:") or body.startswith("Mesh Range:"):
            nums = re.findall(r"(\w+)=(-?\d+\.\d+)", body)
            if body.startswith("Mesh Average:"):
                mesh["average"] = float(body.split(":")[1])
                mesh_runs += 1
            for k, v in nums:
                mesh[k] = float(v)
        elif _K_SHUT.search(body) and "shutdown_speed" not in body and not body.lstrip().startswith(("gcode:", "{%", "RESPOND")):
            shut.append((when, scrub(body.strip(), 160)))
    for when, text in shut[:50]:
        acc.add(when, "klippy_shutdown", {"reason": text}, ref="logs/klippy")
    acc.add(last, "klippy_link_stats", {"mcus": dict(sorted(mcus.items())), "stats_lines": stats}, ref="logs/klippy")
    acc.add(last, "klippy_summary", {
        "lines": count, "first_utc": _utc(first) if first else None, "last_utc": _utc(last) if last else None, "starts": starts,
        "extruder_activations": dict(sorted(switches.items())), "switch_retries": retries, "parks": parks, "versions": versions,
        "bed_mesh_runs": mesh_runs, "bed_mesh_last": mesh or None, "shutdown_lines": len(shut)}, ref="logs/klippy")
    return {"lines": count, "stats_lines": stats, "shutdown_lines": len(shut), "from": _utc(first) if first else None, "to": _utc(last) if last else None}


# ---------------------------------------------------------------- unisrv
_U_TS = re.compile(r"^\[(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\.\d+\] \[unisrv\] \[(\w+)\] \[(\w*):\d+\] (.*)$")


def parse_unisrv(lines: Iterator[str], acc: _Acc, n: int) -> dict[str, Any]:
    c: Counter[str] = Counter({k: 0 for k in ("timelapse_capture_failed", "cloud_auth_failures", "name_resolution_failures", "mqtt_quota_exceeded", "local_mqtt_lost", "wifi_interface_changes")})
    upg: list[tuple[datetime | None, dict[str, Any]]] = []
    first = last = None
    count = 0
    hal_codes: Counter[str] = Counter()
    for ln in lines:
        count += 1
        m = _U_TS.match(ln)
        if not m:
            continue
        ts, lvl, mod, msg = _dt(m[1], "%Y-%m-%d %H:%M:%S"), m[2], m[3], m[4]
        if ts:
            first = first or ts
            last = ts
        if lvl not in ("error", "warning", "critical") and mod != "UPGM":
            continue
        if "capture to file failed" in msg:
            c["timelapse_capture_failed"] += 1
        elif mod == "HALMM" and "Execute error, code is" in msg:
            hal_codes[msg.rsplit(" ", 1)[-1]] += 1
        elif "Temporary failure in name resolution" in msg or "Couldn't resolve host" in msg or "Internet not reachable" in msg:
            c["name_resolution_failures"] += 1
        elif mod == "MA_AUTH" and ("failed" in msg or "network error" in msg):
            c["cloud_auth_failures"] += 1
        elif "Quota exceeded" in msg:
            c["mqtt_quota_exceeded"] += 1
        elif "connection lost" in msg and mod == "MQTT":
            c["local_mqtt_lost"] += 1
        elif mod == "IMNETMON" or "Interface wlan" in msg:
            c["wifi_interface_changes"] += 1
        elif mod == "UPGM" and "Check new version" in msg:
            v = re.search(r"remote fullversion is (\S+), local fullversion is (\S+)", msg)
            if v:
                upg.append((ts, {"event": "version_check", "remote": scrub(v[1], 40), "local": scrub(v[2], 40)}))
        elif mod == "IMSYS" and "Upgrade failed" in msg:
            upg.append((ts, {"event": "upgrade_failed"}))
        elif "systemUpgrade.sh" in msg and "failed with code" in msg:
            code = re.search(r"failed with code (\d+)", msg)
            upg.append((ts, {"event": "upgrade_script_failed", "exit_code": int(code[1]) if code else None}))
    for ts, uv in upg[:40]:
        acc.add(ts, "firmware_upgrade", uv, ref="logs/unisrv")
    acc.add(last, "unisrv_summary", {
        "lines": count, "first_utc": _utc(first) if first else None, "last_utc": _utc(last) if last else None, **dict(sorted(c.items())),
        "hal_execute_error_codes": dict(sorted(hal_codes.items()))}, ref="logs/unisrv")
    return {"lines": count, "from": _utc(first) if first else None, "to": _utc(last) if last else None, **dict(c)}


# ---------------------------------------------------------------- syslog
_S_TS = re.compile(r"^([A-Z][a-z]{2}) +(\d{1,2}) (\d\d:\d\d:\d\d) \S+ (\S+)\.(\S+) ([^:]+): (.*)$")


def parse_syslog(lines: Iterator[str], acc: _Acc, n: int) -> dict[str, Any]:
    now = datetime.fromisoformat(acc.imported_at.replace("Z", "+00:00"))
    deauth: Counter[str] = Counter()
    usb = oom = thermal = volt = segv = 0
    kerr: Counter[str] = Counter()
    first = last = None
    count = 0
    for ln in lines:
        count += 1
        m = _S_TS.match(ln)
        if not m:
            continue
        mon = _MONTHS.get(m[1])
        if not mon:
            continue
        year = now.year
        ts = _dt(f"{year} {mon} {m[2]} {m[3]}", "%Y %m %d %H:%M:%S")
        if ts and ts > now + timedelta(days=1):
            ts = ts.replace(year=year - 1)  # the log has no year: a date in the future belongs to last year
        if ts:
            first = first or ts
            last = ts
        msg = m[7]
        if "WLC_E_DEAUTH" in msg or "Link down" in msg:
            r = re.search(r"reason (\d+)", msg)
            deauth[r[1] if r else "?"] += 1
        elif "USB disconnect" in msg:
            usb += 1
        elif m[5] in ("err", "crit", "alert", "emerg") and m[4] == "kern":
            k = re.sub(r"\[[\s\d.]+\]\s*", "", msg)
            k = re.sub(r"0x[0-9a-f]+|\d+", "#", k)[:70]
            kerr[scrub(k, 70)] += 1
        if re.search(r"Out of memory|oom-kill|Killed process", msg):
            oom += 1
        elif re.search(r"thermal.*(critical|shutdown)|temperature.*(too high|critical)", msg, re.I):
            thermal += 1
        elif re.search(r"under-?voltage|Undervoltage", msg):
            volt += 1
        elif re.search(r"segfault", msg):
            segv += 1
    acc.add(last, "syslog_summary", {
        "lines": count, "first_utc": _utc(first) if first else None, "last_utc": _utc(last) if last else None,
        "wifi_deauth_total": sum(deauth.values()), "wifi_deauth_reasons": dict(sorted(deauth.items())), "usb_disconnects": usb,
        "out_of_memory": oom, "thermal_events": thermal, "undervoltage": volt, "segfaults": segv,
        "kernel_errors_top": [{"message": k, "count": v} for k, v in kerr.most_common(5)]}, ref="logs/syslog")
    return {"lines": count, "wifi_deauth": sum(deauth.values()), "usb_disconnects": usb, "from": _utc(first) if first else None, "to": _utc(last) if last else None}


# ---------------------------------------------------------------- GUI, mosquitto, flow calculator
def parse_gui(lines: Iterator[str], acc: _Acc, n: int) -> dict[str, Any]:
    mqtt_disc = wifi = exc_lists = nonempty = 0
    first = last = None
    count = 0
    for ln in lines:
        count += 1
        if ln[:4].isdigit():
            ts = _dt(ln[:19], "%Y-%m-%d %H:%M:%S")
            if ts:
                first = first or ts
                last = ts
        if "MQTT Agent State:disconnected" in ln:
            mqtt_disc += 1
        elif "Wi-Fi state" in ln:
            wifi += 1
        elif "Exception list count:" in ln:
            exc_lists += 1
            if not ln.rstrip().endswith("count: 0"):
                nonempty += 1
    acc.add(last, "gui_summary", {"lines": count, "first_utc": _utc(first) if first else None, "last_utc": _utc(last) if last else None,
                                  "mqtt_agent_disconnects": mqtt_disc, "wifi_state_changes": wifi, "exception_list_updates": exc_lists,
                                  "exception_list_nonempty": nonempty}, ref="logs/gui")
    return {"lines": count, "mqtt_agent_disconnects": mqtt_disc, "from": _utc(first) if first else None, "to": _utc(last) if last else None}


def parse_mosquitto(lines: Iterator[str], acc: _Acc, n: int) -> dict[str, Any]:
    c: Counter[str] = Counter()
    last = None
    count = 0
    for ln in lines:
        count += 1
        ts = _dt(ln[:19], "%Y-%m-%dT%H:%M:%S") if ln[:4].isdigit() else None
        last = ts or last
        if "Protocol error" in ln:
            c["protocol_errors"] += 1
        elif "disconnected" in ln:
            c["disconnects"] += 1
        elif "OpenSSL Error" in ln:
            c["tls_errors"] += 1
    acc.add(last, "mosquitto_summary", {"lines": count, **dict(sorted(c.items()))}, ref="logs/mosquitto")
    return {"lines": count, **dict(c)}


def parse_flow(lines: Iterator[str], acc: _Acc, n: int) -> dict[str, Any]:
    count = sum(1 for _ in lines)
    acc.add(None, "log_file_seen", {"kind": "flow", "lines": count}, ref="logs/flow")
    return {"lines": count}


def parse_sysinfo(lines: Iterator[str], acc: _Acc, n: int) -> dict[str, Any]:
    count = sum(1 for _ in lines)
    acc.add(None, "log_file_seen", {"kind": "sysinfo", "lines": count}, ref="logs/sysinfo")
    return {"lines": count, "note": "recognized, not analysed (the columns are not documented)"}


# ---------------------------------------------------------------- Snapmaker Orca
_O_LINE = re.compile(r"^\[(\w+)\]\t(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\.\d+\[Thread [^\]]+\]:(.*)$")


def parse_orca(lines: Iterator[str], acc: _Acc, n: int) -> dict[str, Any]:
    c: Counter[str] = Counter()
    days: dict[str, Counter[str]] = {}
    versions: set[str] = set()
    oses: set[str] = set()
    fw: set[str] = set()
    sync_max = 0
    first = last = None
    count = 0
    for ln in lines:
        count += 1
        m = _O_LINE.match(ln)
        if not m:
            continue
        lvl, ts_s, msg = m[1], m[2], m[3]
        ts = _dt(ts_s, "%Y-%m-%d %H:%M:%S")
        if ts:
            first = first or ts
            last = ts
        if lvl == "error":
            c["error_lines"] += 1
        if "[Version] Snapmaker Orca:" in msg:
            versions.add(scrub(msg.split(":", 1)[1].split(",")[0].strip(), 20))
        elif "[Version] OS:" in msg:
            mm = re.search(r"Windows \d+ \(build (\d+)\)", msg)
            if mm:
                oses.add(f"Windows build {mm[1]}")
        elif "firmware_version:" in msg:
            f = re.search(r"firmware_version: ([\d.]+)", msg)
            if f:
                fw.add(f[1])
        key = None
        if "application is not activated" in msg.lower():
            key = "not_activated"
        elif "Command timed out" in msg and ("Heartbeat" in msg or "machine.heartbeat" in msg):
            key = "heartbeat_timeouts"
        elif "consecutive sync failures" in msg:
            key = "time_sync_failures"
            nn = re.search(r"(\d+) consecutive", msg)
            sync_max = max(sync_max, int(nn[1]) if nn else 0)
        elif "response callback not found" in msg:
            key = "mqtt_callback_misses"
        elif "Request expired" in msg or ": time out" in msg:
            key = "request_timeouts"
        if key:
            c[key] += 1
            days.setdefault(ts_s[:10], Counter())[key] += 1
    acc.add(last, "orca_summary", {
        "lines": count, "first_utc": _utc(first) if first else None, "last_utc": _utc(last) if last else None,
        "orca_versions": sorted(versions), "os": sorted(oses), "printer_firmware_seen": sorted(fw), "max_consecutive_time_sync_failures": sync_max,
        **dict(sorted(c.items())), "days_not_activated": sorted(k for k, d in days.items() if d["not_activated"])[:400],
        "days_heartbeat_timeouts": sorted(k for k, d in days.items() if d["heartbeat_timeouts"])[:400]}, ref="logs/orca")
    return {"lines": count, "from": _utc(first) if first else None, "to": _utc(last) if last else None, **dict(c)}


PARSERS = {"moonraker": parse_moonraker, "klippy": parse_klippy, "unisrv": parse_unisrv, "syslog": parse_syslog, "gui": parse_gui,
           "mosquitto": parse_mosquitto, "flow": parse_flow, "sysinfo": parse_sysinfo, "orca": parse_orca}

_ENC_NAME = re.compile(r"(\d+\.\d+\.\d+)")


def _chain(sample: list[str], rest: Iterator[str]) -> Iterator[str]:
    yield from sample
    yield from rest


def analyse(data: bytes, name: str, imported_at_utc: str) -> dict[str, Any]:
    """Read one upload (a log, or an archive of logs) and return observations plus a per-file summary. `imported_at_utc` is `YYYY-MM-DDTHH:MM:SSZ`."""
    members = open_members(data)
    acc = _Acc(imported_at_utc)
    files: list[dict[str, Any]] = []
    total = 0
    for hint, it, size in members:
        total += size
        if it is None:  # the encrypted export
            fw = _ENC_NAME.search(name or "")
            acc.add(None, "encrypted_system_log", {"firmware_in_name": fw[1] if fw else None, "size_bytes": size}, ref="logs/encrypted")
            files.append({"kind": "encrypted", "lines": 0, "note": "The printer's own encrypted system log. U1 Doctor cannot and does not open it: send it unchanged to Snapmaker support."})
            continue
        sample: list[str] = []
        for ln in it:
            sample.append(ln)
            if len(sample) >= 40:
                break
        kind = hint or classify([s for s in sample if s.strip()])
        parser = PARSERS.get(kind)
        if parser is None:
            files.append({"kind": "unrecognized", "lines": len(sample), "note": "not a log format U1 Doctor knows"})
            continue
        res = parser(_chain(sample, it), acc, size)
        files.append({"kind": kind, **res})
    if not acc.rows:
        raise LogImportError("NOTHING_RECOGNIZED", "no known log format found in this file")
    return {"observations": acc.rows, "files": files, "summary": {
        "files": len(files), "recognized": sum(1 for f in files if f["kind"] not in ("unrecognized",)), "observations": len(acc.rows),
        "dropped_observations": acc.dropped, "unpacked_bytes": total}, "notice": NOTICE}
