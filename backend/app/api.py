"""U1 Doctor local API. Offline/demo by default; the only machine route is POST /api/v1/live/capture
(read-only, explicit consent, one private address). This module never imports the transport itself."""
from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware

from . import db, history, symptoms
from .deb import MAX_ZIP_BYTES, BundleError, export_bundle, import_bundle, import_bundle_with_observations, summarize_bundle
from .dryrun_import import MAX_BYTES as DRYRUN_MAX_BYTES
from .dryrun_import import DryRunError
from .dryrun_import import normalize as dryrun_normalize
from .engine import canon, evaluate, ruleset_hash
from .engine.canonical import sha256_hex
from .gcode_preflight import MAX_BYTES as PREFLIGHT_MAX_BYTES
from .gcode_preflight import PreflightError
from .gcode_preflight import analyze as preflight_analyze
from .knowledge import interpret, load_catalog, load_known_issues
from .live import LiveError, run_live_capture
from .paths import ROOT
from .support import checklist as support_checklist
from .timeline import build_timeline

API_VERSION = "1"
APP_VERSION = "0.1.0-g1"

FIXTURES = ROOT / "fixtures" / "synthetic"
REAL = ROOT / "fixtures" / "real"
_REAL_IDS = {"h02_normal_print": "real_h02_normal_print"}
RULESET_PATH = ROOT / "rulesets" / "u1-starter" / "ruleset.json"
DIST = ROOT / "frontend" / "dist"
_SCENARIO = re.compile(r"^[a-z0-9_]{1,64}$")


class HistorySourceIn(BaseModel):
    source: str = Field(max_length=96)  # "synthetic:<scenario>" or "real:<capture id>"
    label: str | None = Field(default=None, max_length=200)


_HISTORY_ID = re.compile(r"^h[0-9a-f]{12}$")


class LiveIn(BaseModel):
    host: str = Field(max_length=15)  # private IPv4 literal; validated by the transport policy, never echoed back
    consent: bool = False
    seconds: int = Field(default=15, ge=3, le=60)
    save: bool = True
    label: str | None = Field(default=None, max_length=200)


def _local_origins(request: Request) -> set[str]:
    host = request.headers.get("host", "")
    return {f"http://{host}"}


class SupportIn(BaseModel):
    code: str = Field(max_length=64)
    firmware: str | None = Field(default=None, max_length=32)


class InterpretIn(BaseModel):
    code: str = Field(max_length=64)
    firmware: str | None = Field(default=None, max_length=32)  # stated by the user, e.g. "1.5.2"


class SymptomIn(BaseModel):
    symptom: str = Field(max_length=64)
    answers: dict[str, Any] = Field(default_factory=dict)  # strictly validated in symptoms.clean_answers
    session: str | None = Field(default=None, max_length=16)  # optional saved history session whose temperatures are compared


class ReplayIn(BaseModel):
    scenario: str = Field(max_length=64)


class ExportIn(BaseModel):
    source: str = Field(max_length=96)  # "synthetic:<scenario>" or "real:<capture id>"


def _ruleset() -> dict[str, Any]:
    return json.loads(RULESET_PATH.read_text(encoding="utf-8"))


def _scenarios() -> list[str]:
    return sorted(p.name.removeprefix("synthetic_").removesuffix(".observations.jsonl") for p in FIXTURES.glob("*.observations.jsonl"))


def _load_scenario(name: str) -> tuple[bytes, list[dict[str, Any]], bytes]:
    if not _SCENARIO.fullmatch(name) or name not in _scenarios():
        raise HTTPException(404, "unknown demo scenario")
    raw = (FIXTURES / f"synthetic_{name}.observations.jsonl").read_bytes()
    obs = [json.loads(line) for line in raw.decode("utf-8").splitlines()]
    return raw, obs, (FIXTURES / f"synthetic_{name}.findings.json").read_bytes()


def create_app(db_path: str = ":memory:") -> FastAPI:
    app = FastAPI(title="U1 Doctor", version=APP_VERSION, docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"])
    conn = db.connect(db_path)
    app.state.db = conn

    @app.get("/api/v1/health")
    def health() -> dict[str, Any]:
        return {"status": "ok", "api_version": API_VERSION, "app_version": APP_VERSION, "mode": "DEMO",
                "machine_access": "READ_ONLY_ON_CONSENT", "db_schema": db.schema_version(conn)}

    @app.get("/api/v1/compatibility")
    def compatibility() -> dict[str, Any]:
        # TESTED_REAL only where docs/evidence/H-01 and H-02 prove it on the owner's U1 (Klipper 2.1.0.157).
        caps = [("Moonraker HTTP :7125", "TESTED_REAL"), ("Objects list / query", "TESTED_REAL"), ("WebSocket subscribe", "TESTED_REAL"),
                ("Live error codes", "UNTESTED"), ("Toolhead 1-4 mapping", "UNTESTED"), ("Official firmware version", "TESTED_REAL"),
                ("Offline code decoder", "TESTED_SYNTHETIC"), ("Deterministic replay", "TESTED_REAL")]
        return {"verified_on_hardware": True, "firmware_target": "V2.1.0",
                "capabilities": [{"name": n, "status": s} for n, s in caps],
                "rows": [{"firmware": fw, "rest_readonly": "TESTED_REAL" if fw == "V2.1.0" else "UNTESTED",
                          "ws_subscribe": "TESTED_REAL" if fw == "V2.1.0" else "UNTESTED", "errors_live": "UNTESTED",
                          "toolhead_mapping": "UNTESTED", "replay": "TESTED_REAL" if fw == "V2.1.0" else "TESTED_SYNTHETIC"}
                         for fw in ("V2.1.0", "V2.0.0")]}

    @app.get("/api/v1/real/captures/{cid}")
    def real_capture(cid: str) -> dict[str, Any]:
        base = _REAL_IDS.get(cid)
        if base is None:
            raise HTTPException(404, "unknown real capture")
        raw = (REAL / f"{base}.observations.jsonl").read_bytes()
        obs = [json.loads(line) for line in raw.decode("utf-8").splitlines()]
        gold = (REAL / f"{base}.findings.json").read_bytes()
        out = canon(evaluate(obs, _ruleset())) + b"\n"
        return {"source_status": "REAL", "provenance": json.loads((REAL / f"{base}.provenance.json").read_text(encoding="utf-8")),
                "observations": obs, "findings": json.loads(out), "matches_golden": out == gold,
                "input_sha256": sha256_hex(raw), "findings_sha256": sha256_hex(out)}

    @app.post("/api/v1/errors/interpret")
    def errors_interpret(body: InterpretIn) -> dict[str, Any]:
        cat = load_catalog()
        dec = interpret(body.code, body.firmware)
        dec.pop("entry", None) if dec.get("status") != "KNOWN" else None
        return {"source": "USER_REPORTED", "decoding": dec, "catalog_version": cat["catalog_version"],
                "catalog_verified_at": cat["last_verified_at"], "official_reference": cat["source_url"],
                "limits": ["The displayed code may not represent the actual fault source (official wiki note).",
                           "Code declared by the user; not verified from the machine."]}

    @app.get("/api/v1/knowledge/known-issues")
    def known_issues() -> dict[str, Any]:
        return load_known_issues()

    @app.get("/api/v1/knowledge/symptoms")
    def symptom_catalog() -> dict[str, Any]:
        return symptoms.catalog()

    @app.post("/api/v1/symptoms/evaluate")
    def symptom_evaluate(body: SymptomIn) -> dict[str, Any]:
        observations = None
        if body.session is not None:
            if not _HISTORY_ID.fullmatch(body.session) or history.get(conn, body.session) is None:
                raise HTTPException(404, "unknown history session")
            observations = history.observations(conn, body.session)
        try:
            return symptoms.evaluate(body.symptom, body.answers, observations)
        except KeyError as e:
            raise HTTPException(404, "unknown symptom") from e
        except ValueError as e:
            raise HTTPException(422, {"code": "BAD_ANSWER", "message": str(e)}) from e

    @app.get("/api/v1/rulesets")
    def rulesets() -> dict[str, Any]:
        rs = _ruleset()
        return {"ruleset_id": rs["ruleset_id"], "version": rs["version"], "hash": ruleset_hash(rs),
                "rules": [{"id": r["id"], "version": r["version"], "status": r["status"]} for r in rs["rules"]]}

    @app.get("/api/v1/demo/scenarios")
    def demo_scenarios() -> dict[str, Any]:
        return {"banner": "SYNTHETIC / DEMO - not captured from a real U1", "scenarios": _scenarios()}

    @app.get("/api/v1/demo/scenarios/{name}")
    def demo_scenario(name: str) -> dict[str, Any]:
        _, obs, gold = _load_scenario(name)
        return {"banner": "SYNTHETIC / DEMO", "observations": obs, "golden_findings": json.loads(gold)}

    @app.post("/api/v1/replays")
    def replays(body: ReplayIn) -> dict[str, Any]:
        raw, obs, gold = _load_scenario(body.scenario)
        rs = _ruleset()
        findings = evaluate(obs, rs)
        out = canon(findings) + b"\n"
        match = out == gold
        cur = conn.execute(
            "INSERT INTO replays(created_at,scenario,source_mix,ruleset_hash,input_sha256,findings_sha256,matches_golden) VALUES (?,?,?,?,?,?,?)",
            (datetime.now(UTC).isoformat(), body.scenario, "SYNTHETIC", ruleset_hash(rs), sha256_hex(raw), sha256_hex(out), int(match)))
        conn.commit()
        return {"mode": "REPLAY", "source_status": "REPLAYED_FROM_SYNTHETIC", "replay_id": cur.lastrowid,
                "ruleset_hash": ruleset_hash(rs), "input_sha256": sha256_hex(raw), "findings_sha256": sha256_hex(out),
                "matches_golden": match, "findings": findings}

    def _source_obs(source: str) -> tuple[str, str, list[dict[str, Any]]]:
        kind, _, name = source.partition(":")
        if kind == "synthetic":
            _, obs, _ = _load_scenario(name)
        elif kind == "real" and name in _REAL_IDS:
            obs = [json.loads(x) for x in (REAL / f"{_REAL_IDS[name]}.observations.jsonl").read_text(encoding="utf-8").splitlines()]
        else:
            raise HTTPException(404, "unknown source")
        return kind, name, obs

    def _bundle_blob(source: str) -> tuple[str, str, bytes]:
        kind, name, obs = _source_obs(source)
        return kind, name, export_bundle(obs, _ruleset(), app_version=APP_VERSION)

    @app.get("/api/v1/timeline")
    def timeline(source: str) -> dict[str, Any]:
        if source.startswith("history:"):
            sid = source[8:]
            meta = history.get(conn, sid) if _HISTORY_ID.fullmatch(sid) else None
            if meta is None:
                raise HTTPException(404, "unknown history session")
            shown = {"synthetic": "SYNTHETIC", "real_capture": "REAL"}.get(meta["origin"], "IMPORTED")
            return {"source_status": shown, "history": meta, **build_timeline(history.observations(conn, sid))}
        kind, _, obs = _source_obs(source)
        return {"source_status": "REAL" if kind == "real" else "SYNTHETIC", **build_timeline(obs)}

    async def _body(request: Request, limit: int, what: str) -> bytes:
        declared = request.headers.get("content-length")
        if declared is not None and declared.isdigit() and int(declared) > limit:
            raise HTTPException(413, f"{what} too large")
        data = b""
        async for chunk in request.stream():
            data += chunk
            if len(data) > limit:
                raise HTTPException(413, f"{what} too large")
        return data

    def _saved(obs: list[dict[str, Any]], origin: str, label: str | None, default: str) -> dict[str, Any]:
        try:
            session, already = history.save(conn, obs, origin, label, default)
        except history.HistoryError as e:
            raise HTTPException(409 if e.code == "HISTORY_FULL" else 422, {"code": e.code, "message": str(e)}) from e
        return {"session": session, "already_saved": already}

    @app.get("/api/v1/history")
    def history_list() -> dict[str, Any]:
        return history.list_sessions(conn)

    @app.post("/api/v1/history/source")
    def history_save_source(body: HistorySourceIn) -> dict[str, Any]:
        kind, name, obs = _source_obs(body.source)
        return _saved(obs, "real_capture" if kind == "real" else "synthetic", body.label, f"{kind}:{name}")

    @app.post("/api/v1/history/bundle")
    async def history_save_bundle(request: Request, label: str | None = Query(default=None, max_length=200)) -> dict[str, Any]:
        data = await _body(request, MAX_ZIP_BYTES, "bundle")
        try:
            _, obs = import_bundle_with_observations(data, _ruleset())
        except BundleError as e:
            raise HTTPException(422, {"code": e.code, "message": str(e)}) from e
        return _saved(obs, "bundle", label, "Imported bundle")

    @app.post("/api/v1/history/dryrun")
    async def history_save_dryrun(request: Request, label: str | None = Query(default=None, max_length=200)) -> dict[str, Any]:
        data = await _body(request, DRYRUN_MAX_BYTES, "report")
        try:
            out = dryrun_normalize(data, datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"))
        except DryRunError as e:
            raise HTTPException(422, {"code": e.code, "message": str(e)}) from e
        return _saved(out["observations"], "dryrun", label, "U1 Dry Run report")

    @app.get("/api/v1/history/{sid}")
    def history_get(sid: str) -> dict[str, Any]:
        meta = history.get(conn, sid) if _HISTORY_ID.fullmatch(sid) else None
        if meta is None:
            raise HTTPException(404, "unknown history session")
        return meta

    @app.get("/api/v1/history/{sid}/findings")
    def history_findings(sid: str) -> dict[str, Any]:
        """Findings recomputed from one saved session with the local ruleset (never merged with another session)."""
        meta = history.get(conn, sid) if _HISTORY_ID.fullmatch(sid) else None
        if meta is None:
            raise HTTPException(404, "unknown history session")
        rs = _ruleset()
        return {"session": meta, "ruleset": {"id": rs["ruleset_id"], "version": rs["version"], "hash": ruleset_hash(rs)},
                "findings": evaluate(history.observations(conn, sid), rs)}

    @app.delete("/api/v1/history/{sid}")
    def history_delete(sid: str) -> dict[str, Any]:
        if not _HISTORY_ID.fullmatch(sid) or not history.delete(conn, sid):
            raise HTTPException(404, "unknown history session")
        return {"deleted": sid}

    @app.post("/api/v1/bundles/preview")
    def bundles_preview(body: ExportIn) -> dict[str, Any]:
        _, _, blob = _bundle_blob(body.source)
        return summarize_bundle(blob)

    @app.post("/api/v1/bundles/export")
    def bundles_export(body: ExportIn) -> Response:
        kind, name, blob = _bundle_blob(body.source)
        return Response(blob, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="u1-deb-{kind}-{name}.zip"'})

    @app.post("/api/v1/bundles/import")
    async def bundles_import(request: Request) -> dict[str, Any]:
        declared = request.headers.get("content-length")
        if declared is not None and declared.isdigit() and int(declared) > MAX_ZIP_BYTES:
            raise HTTPException(413, "bundle too large")
        data = b""
        async for chunk in request.stream():
            data += chunk
            if len(data) > MAX_ZIP_BYTES:
                raise HTTPException(413, "bundle too large")
        try:
            return import_bundle(data, _ruleset())
        except BundleError as e:
            raise HTTPException(422, {"code": e.code, "message": str(e)}) from e

    @app.post("/api/v1/imports/dryrun")
    async def import_dryrun(request: Request) -> dict[str, Any]:
        """Normalize a U1 Dry Run report.json into IMPORTED observations (a prediction, not a machine observation)."""
        declared = request.headers.get("content-length")
        if declared is not None and declared.isdigit() and int(declared) > DRYRUN_MAX_BYTES:
            raise HTTPException(413, "report too large")
        data = b""
        async for chunk in request.stream():
            data += chunk
            if len(data) > DRYRUN_MAX_BYTES:
                raise HTTPException(413, "report too large")
        try:
            return dryrun_normalize(data, datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"))
        except DryRunError as e:
            raise HTTPException(422, {"code": e.code, "message": str(e)}) from e

    @app.post("/api/v1/support/checklist")
    def support_list(body: SupportIn) -> dict[str, Any]:
        try:
            return support_checklist(body.code, body.firmware)
        except ValueError as e:
            raise HTTPException(422, {"code": "MALFORMED_CODE", "message": str(e)}) from e

    @app.post("/api/v1/preflight/gcode")
    async def preflight_gcode(request: Request, name: str | None = Query(default=None, max_length=255)) -> dict[str, Any]:
        """Static pre-flight of a sliced file. The file is read as text only; its name is never echoed back."""
        declared = request.headers.get("content-length")
        if declared is not None and declared.isdigit() and int(declared) > PREFLIGHT_MAX_BYTES:
            raise HTTPException(413, "file too large")
        data = b""
        async for chunk in request.stream():
            data += chunk
            if len(data) > PREFLIGHT_MAX_BYTES:
                raise HTTPException(413, "file too large")
        try:
            return preflight_analyze(data, name)
        except PreflightError as e:
            raise HTTPException(422, {"code": e.code, "message": str(e)}) from e

    @app.post("/api/v1/live/capture")
    def live_capture(body: LiveIn, request: Request) -> dict[str, Any]:
        """Owner-triggered read-only capture (3 GET + 1 WS subscribe) from one private address. Needs `consent: true`."""
        origin = request.headers.get("origin")
        if origin is not None and origin not in _local_origins(request):
            raise HTTPException(403, {"code": "FOREIGN_ORIGIN", "message": "request must come from this app"})
        if body.consent is not True:
            raise HTTPException(403, {"code": "CONSENT_REQUIRED", "message": "explicit owner consent is required"})
        hooks = getattr(app.state, "live_hooks", {})
        try:
            out = run_live_capture(body.host, seconds=body.seconds, **hooks)
        except LiveError as e:
            raise HTTPException(422 if e.code.startswith("REFUSED") else 502, {"code": e.code, "message": str(e)}) from e
        rs = _ruleset()
        out["ruleset"] = {"id": rs["ruleset_id"], "version": rs["version"], "hash": ruleset_hash(rs)}
        out["findings"] = evaluate(out["observations"], rs) if out["observations"] else []
        out["source_status"] = "REAL"
        out["session"] = None
        if body.save and out["observations"]:
            saved = _saved(out["observations"], "real_capture", body.label, "Live capture")
            out["session"], out["already_saved"] = saved["session"], saved["already_saved"]
        return out

    if (DIST / "index.html").exists():
        app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")
        if (DIST / "models").exists():
            app.mount("/models", StaticFiles(directory=DIST / "models"), name="models")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str) -> FileResponse:
            if path.split("/", 1)[0] in ("api", "docs", "redoc", "openapi.json"):
                raise HTTPException(404, "not found")
            return FileResponse(DIST / "index.html")

    return app
