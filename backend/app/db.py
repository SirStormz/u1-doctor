"""SQLite persistence with numbered, forward-only migrations (stdlib).

ADR-0004: Alembic/SQLAlchemy deferred; revisit when schema complexity warrants.
"""
from __future__ import annotations

import sqlite3
import threading
from typing import Any

MIGRATIONS: list[str] = [
    # 1
    """
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE replays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        scenario TEXT NOT NULL,
        source_mix TEXT NOT NULL,
        ruleset_hash TEXT NOT NULL,
        input_sha256 TEXT NOT NULL,
        findings_sha256 TEXT NOT NULL,
        matches_golden INTEGER NOT NULL
    );
    """,
    # 2: persistent local history (REQ-006/007). Observations are stored as canonical JSON, provenance untouched.
    """
    CREATE TABLE history_sessions (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        origin TEXT NOT NULL CHECK (origin IN ('synthetic','real_capture','bundle','dryrun')),
        saved_at TEXT NOT NULL,
        observation_count INTEGER NOT NULL CHECK (observation_count > 0),
        first_utc TEXT NOT NULL,
        last_utc TEXT NOT NULL,
        status_mix TEXT NOT NULL,
        content_sha256 TEXT NOT NULL UNIQUE
    );
    CREATE TABLE history_observations (
        session_id TEXT NOT NULL REFERENCES history_sessions(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (session_id, seq)
    );
    """,
]


class _Connection(sqlite3.Connection):
    """One connection shared by the server's worker threads (check_same_thread=False): every use holds `lock`."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.lock = threading.RLock()


_NO_LOCK = threading.RLock()  # for a plain sqlite3 connection opened elsewhere (tests)


def lock(conn: sqlite3.Connection) -> threading.RLock:
    """The lock serializing every read and transaction on `conn` across threads."""
    return getattr(conn, "lock", _NO_LOCK)


def connect(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path, check_same_thread=False, factory=_Connection)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    migrate(conn)
    return conn


def schema_version(conn: sqlite3.Connection) -> int:
    with lock(conn):
        return conn.execute("PRAGMA user_version").fetchone()[0]


def migrate(conn: sqlite3.Connection) -> int:
    v = schema_version(conn)
    if v > len(MIGRATIONS):
        raise RuntimeError(f"database schema v{v} is newer than this app (v{len(MIGRATIONS)})")
    for i in range(v, len(MIGRATIONS)):
        conn.executescript("BEGIN;" + MIGRATIONS[i] + f"PRAGMA user_version={i + 1};COMMIT;")
    return schema_version(conn)
