"""Persistent local history of observation sessions (REQ-006/007), stored in the local SQLite database only.

What is saved is exactly what was observed or imported, with its provenance untouched: saving never upgrades a status
(SYNTHETIC stays SYNTHETIC, a prediction stays a prediction). Sessions are never merged into one timeline: the gap
between two sessions is "not observed", not "no incident". The id is derived from the content, so saving the same
content twice returns the same session. Nothing leaves the machine; nothing here talks to the printer.
"""
from __future__ import annotations

import re
import sqlite3
from datetime import UTC, datetime
from typing import Any

from . import db
from .deb import MAX_OBSERVATIONS, BundleError, validate_observation
from .engine import canon, sort_observations
from .engine.canonical import sha256_hex

MAX_SESSIONS = 200
MAX_TOTAL_OBSERVATIONS = 1_000_000
MAX_LABEL = 80
ORIGINS = ("synthetic", "real_capture", "bundle", "dryrun", "logs")
_CTRL = re.compile(r"[\x00-\x1f\x7f]")


class HistoryError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def clean_label(label: str | None, default: str) -> str:
    s = _CTRL.sub(" ", label or "").strip()
    return (s or default)[:MAX_LABEL]


def _row(r: sqlite3.Row) -> dict[str, Any]:
    return {"id": r["id"], "label": r["label"], "origin": r["origin"], "saved_at": r["saved_at"], "observation_count": r["observation_count"],
            "first_utc": r["first_utc"], "last_utc": r["last_utc"], "status_mix": r["status_mix"].split(","), "content_sha256": r["content_sha256"]}


def save(conn: sqlite3.Connection, observations: list[dict[str, Any]], origin: str, label: str | None, default_label: str) -> tuple[dict[str, Any], bool]:
    """Store a session. Returns (session, already_saved)."""
    if origin not in ORIGINS:
        raise HistoryError("BAD_ORIGIN", "unknown origin")
    if not observations:
        raise HistoryError("EMPTY", "nothing to save")
    if len(observations) > MAX_OBSERVATIONS:
        raise HistoryError("TOO_LARGE", "too many observations")
    seen: set[str] = set()
    for o in observations:
        try:
            validate_observation(o)
        except BundleError as e:
            raise HistoryError("BAD_OBSERVATION", str(e)) from e
        if o["observation_id"] in seen:
            raise HistoryError("BAD_OBSERVATION", "duplicate observation id")
        seen.add(o["observation_id"])
    obs = sort_observations(observations)
    digest = sha256_hex(b"".join(canon(o) + b"\n" for o in obs))
    sid = "h" + digest[:12]
    mix = ",".join(sorted({o["source_status"] for o in obs}))
    now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    with db.lock(conn):  # the duplicate check, the quota check and the insert are one step for every thread
        existing = conn.execute("SELECT * FROM history_sessions WHERE id=?", (sid,)).fetchone()
        if existing:
            return _row(existing), True
        n_sessions, n_obs = conn.execute("SELECT COUNT(*), COALESCE(SUM(observation_count),0) FROM history_sessions").fetchone()
        if n_sessions >= MAX_SESSIONS or n_obs + len(obs) > MAX_TOTAL_OBSERVATIONS:
            raise HistoryError("HISTORY_FULL", "local history is full: delete a session first")
        try:
            with conn:
                conn.execute("INSERT INTO history_sessions(id,label,origin,saved_at,observation_count,first_utc,last_utc,status_mix,content_sha256) VALUES (?,?,?,?,?,?,?,?,?)",
                             (sid, clean_label(label, default_label), origin, now, len(obs), obs[0]["capture_utc"], obs[-1]["capture_utc"], mix, digest))
                conn.executemany("INSERT INTO history_observations(session_id,seq,payload) VALUES (?,?,?)", [(sid, i, canon(o).decode("utf-8")) for i, o in enumerate(obs)])
        except sqlite3.IntegrityError:  # saved meanwhile through another connection to the same file: same content, same session
            existing = conn.execute("SELECT * FROM history_sessions WHERE id=?", (sid,)).fetchone()
            if existing is None:
                raise
            return _row(existing), True
        return _row(conn.execute("SELECT * FROM history_sessions WHERE id=?", (sid,)).fetchone()), False


def list_sessions(conn: sqlite3.Connection) -> dict[str, Any]:
    with db.lock(conn):
        rows = conn.execute("SELECT * FROM history_sessions ORDER BY saved_at DESC, id").fetchall()
        total = conn.execute("SELECT COALESCE(SUM(observation_count),0) FROM history_sessions").fetchone()[0]
    return {"sessions": [_row(r) for r in rows], "totals": {"sessions": len(rows), "observations": total},
            "limits": {"max_sessions": MAX_SESSIONS, "max_observations": MAX_TOTAL_OBSERVATIONS}}


def get(conn: sqlite3.Connection, sid: str) -> dict[str, Any] | None:
    with db.lock(conn):
        r = conn.execute("SELECT * FROM history_sessions WHERE id=?", (sid,)).fetchone()
    return _row(r) if r else None


def observations(conn: sqlite3.Connection, sid: str) -> list[dict[str, Any]]:
    import json
    with db.lock(conn):
        rows = conn.execute("SELECT payload FROM history_observations WHERE session_id=? ORDER BY seq", (sid,)).fetchall()
    return [json.loads(r["payload"]) for r in rows]


def delete(conn: sqlite3.Connection, sid: str) -> bool:
    with db.lock(conn), conn:
        n = conn.execute("DELETE FROM history_sessions WHERE id=?", (sid,)).rowcount
    return n > 0
