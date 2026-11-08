"""Deterministic rules engine (pure). evaluate(observations, ruleset) -> findings.

No clock, no I/O, no randomness. Output order and ids are derived from inputs.
Evaluators are a fixed built-in enum selected by the ruleset (no eval/exec).
"""
from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from typing import Any

from ..knowledge import interpret
from .canonical import replay_hash, ruleset_hash, sha256_hex

WIKI = "https://wiki.snapmaker.com/en/snapmaker_u1/troubleshooting/u1_error_codes"
CHECKED = "2026-11-05"
WIKI_NOTE = "The displayed code may not represent the actual fault source (official wiki note)."
ALLOWED_RULE_STATUS = {"PROPOSED", "VERIFIED"}

Obs = dict[str, Any]
Rule = dict[str, Any]


def _ts(o: Obs) -> datetime:
    return datetime.fromisoformat(o["capture_utc"].replace("Z", "+00:00"))


def sort_observations(observations: list[Obs]) -> list[Obs]:
    # On the parsed instant, not the string: "10:00:00.5Z" sorts before "10:00:00Z" as text.
    return sorted(observations, key=lambda o: (_ts(o), o["observation_id"]))


def _prefix(obs: list[Obs]) -> str:
    return "SYNTHETIC: " if any(o["source_status"] == "SYNTHETIC" for o in obs) else ""


def _mix(obs: list[Obs]) -> list[str]:
    return sorted({o["source_status"] for o in obs})


def _make(rule: Rule, rs_hash: str, rs_id: str, ev_for: list[tuple[Obs, str]], *, classification: str,
          title: str, hypotheses: list[dict[str, str]], ev_against: list[tuple[Obs, str]] | None = None,
          missing: list[str], safe: list[str], refs: list[dict[str, str]], limits: list[str],
          quality: str, not_root: bool = True, scope: list[str] | None = None) -> dict[str, Any]:
    ids = sorted(o["observation_id"] for o, _ in ev_for)
    all_obs = [o for o, _ in ev_for] + [o for o, _ in (ev_against or [])]
    f: dict[str, Any] = {
        "schema_version": "1.0",
        "finding_id": "f_" + sha256_hex((rule["id"] + "|" + ",".join(ids)).encode())[:16],
        "ruleset_id": rs_id,
        "ruleset_hash": rs_hash,
        "rule_id": rule["id"],
        "rule_version": rule["version"],
        "classification": classification,
        "human_title": _prefix(all_obs) + title,
        "not_a_root_cause": not_root,
        "hypotheses": hypotheses,
        "evidence_for": [{"observation_id": o["observation_id"], "note": n} for o, n in ev_for],
        "evidence_against": [{"observation_id": o["observation_id"], "note": n} for o, n in (ev_against or [])],
        "missing_data": missing,
        "firmware_scope": scope or ["UNKNOWN"],
        "safe_actions": safe,
        "references": refs,
        "limits": limits,
        "source_mix": _mix(all_obs),
        "evidence_quality": quality,
    }
    f["replay_hash"] = replay_hash(f)
    return f


WIKI_REF = [{"kind": "OFFICIAL_WIKI", "url": WIKI, "checked_at": CHECKED}]


def ev_catalog_code(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    out = []
    for o in obs:
        if o["event_type"] != rule["params"]["event_type"]:
            continue
        raw = o["value"].get("code") if isinstance(o["value"], dict) else None
        dec = interpret(raw)
        base_limits = [WIKI_NOTE, "Code declared by the user; not verified from the machine."]
        if dec["status"] == "KNOWN":
            e = dec["entry"]
            lvl = dec["level"]
            safe = ["Follow the linked official procedure; do not bypass safety interlocks."]
            if lvl == "0003":
                safe.insert(0, "Severity 'error': the official table says the print is stopped. Do not continue printing until the manufacturer's procedure is followed.")
            out.append(_make(
                rule, rs_hash, rs_id, [(o, "Code declared by the user.")], classification="OBSERVED",
                title=f"Code reported: {e['title']} ({dec['severity']}, {dec['module']})",
                hypotheses=[{"id": "h1", "text": e["summary"], "label": "OFFICIAL_REFERENCE"}],
                missing=["No live machine state verified."], safe=safe, refs=WIKI_REF,
                limits=base_limits, quality="WEAK"))
        elif dec["status"] == "STRUCTURE_ONLY":
            out.append(_make(
                rule, rs_hash, rs_id, [(o, "Well-formed code not present in the local verified catalog.")],
                classification="INCONCLUSIVE",
                title=f"Code not in verified catalog (structure: {dec['severity'] or 'unknown level'}, {dec['module'] or 'unknown module'})",
                hypotheses=[], missing=["Official meaning of this exact code was not verified locally."],
                safe=["Search the exact code on the official wiki or contact Snapmaker support."],
                refs=WIKI_REF, limits=base_limits + ["Module/severity are read from the code structure only; no cause is inferred."],
                quality="UNKNOWN"))
        else:
            out.append(_make(
                rule, rs_hash, rs_id, [(o, "Input rejected as malformed.")], classification="INCONCLUSIVE",
                title="Malformed error code", hypotheses=[], missing=["A code of the form dddd-dddd-dddd-dddd."],
                safe=["Re-enter the code exactly as shown on the printer screen."], refs=WIKI_REF,
                limits=["Input is not a valid U1 code; nothing was inferred."], quality="UNKNOWN"))
    return out


def ev_state_transition(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    p = rule["params"]
    states = [o for o in obs if o["event_type"] == p["event_type"] and o["entity_id"] == "printer"]
    codes = [o for o in obs if o["event_type"] == "user_reported_error_code"]
    out = []
    for prev, cur in zip(states, states[1:]):
        pv, cv = prev["value"].get("state"), cur["value"].get("state")
        if pv != p["from"] or cv not in p["to"]:
            continue
        ev = [(prev, f"Observed state '{pv}'."), (cur, f"Observed state '{cv}'.")]
        for c in codes:
            if abs((_ts(c) - _ts(cur)).total_seconds()) <= p["proximity_s"]:
                ev.append((c, "Close in time to the transition: correlation only, not causation."))
        rq = all(o["timestamp_quality"] == "RECEIPT_ONLY" for o in (prev, cur))
        out.append(_make(
            rule, rs_hash, rs_id, ev, classification="OBSERVED",
            title=f"Print state changed: {pv} -> {cv}",
            hypotheses=[], missing=["Cause of the transition is not determined by this fact."],
            safe=["Check the printer screen and follow the official procedure for any displayed code."],
            refs=WIKI_REF,
            limits=["A state change is a fact, not a diagnosis."] + (["Timestamps are receipt time only; ordering within the capture window is trusted, exact delay is not."] if rq else []),
            quality="MODERATE" if prev["source_status"] == "REAL" and cur["source_status"] == "REAL" else "WEAK"))
    return out


def ev_mapping_unknown(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    un = [o for o in obs if o["entity_id"] == "unmapped" or o["mapping_quality"] == "UNKNOWN"]
    if not un:
        return []
    return [_make(
        rule, rs_hash, rs_id, [(o, "Value cannot be attributed to a toolhead.") for o in un], classification="INCONCLUSIVE",
        title="Per-toolhead attribution unavailable (mapping unknown)", hypotheses=[],
        missing=["Verified mapping from the observed object to toolhead 1-4."],
        safe=["No action: do not read these values as belonging to a specific toolhead."], refs=[],
        limits=["Toolhead mapping must be proven (H-04) before per-toolhead statements."], quality="UNKNOWN")]


def ev_coverage_gaps(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    types = set(rule["params"]["event_types"])
    bad = [o for o in obs if o["event_type"] in types or o["validity"] in ("STALE", "UNAVAILABLE", "MALFORMED")]
    if not bad:
        return []
    return [_make(
        rule, rs_hash, rs_id, [(o, f"{o['event_type']} / validity {o['validity']}") for o in bad], classification="INCONCLUSIVE",
        title="Observation incomplete: absence of data is not evidence of absence", hypotheses=[],
        missing=["Data for the affected window."],
        safe=["Do not infer the machine state from the loss of connection; check the printer itself."],
        refs=[], limits=["A lost or timed-out connection does not mean the printer stopped or failed."], quality="UNKNOWN")]


def ev_transport_denied(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    d = [o for o in obs if o["event_type"] == rule["params"]["event_type"]]
    if not d:
        return []
    return [_make(
        rule, rs_hash, rs_id, [(o, "Request refused by the read-only transport before any I/O.") for o in d],
        classification="OBSERVED", title="Non-allowlisted request was blocked by U1 Doctor", hypotheses=[],
        missing=[], safe=["No machine action was taken."], refs=[],
        limits=["Describes U1 Doctor's own behaviour, not the printer."], quality="STRONG" if all(o["source_status"] == "REAL" for o in d) else "MODERATE")]


SIGNALS_CHECKED = "2026-11-06"


def _wiki_ref(url: str) -> list[dict[str, str]]:
    return [{"kind": "OFFICIAL_WIKI", "url": url, "checked_at": SIGNALS_CHECKED}]


def _number(v: Any) -> float | None:
    return float(v) if isinstance(v, int | float) and not isinstance(v, bool) and v == v else None


def ev_value_window(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """A sensor reading outside a window the official wiki documents. A fact about the value, never a diagnosis."""
    p = rule["params"]
    hits: list[tuple[Obs, float]] = []
    for o in obs:
        if o["event_type"] not in p["event_types"] or o["validity"] != "FRESH" or not isinstance(o["value"], dict):
            continue
        v = _number(o["value"].get(p["field"]))
        if v is not None and (v < p["min"] or v > p["max"]):
            hits.append((o, v))
    if not hits:
        return []
    code = f" (official code {p['code']})" if p.get("code") else ""
    return [_make(
        rule, rs_hash, rs_id, [(o, f"{p['field']} {v:g} is outside {p['min']:g} to {p['max']:g}.") for o, v in hits], classification="OBSERVED",
        title=f"{p['label']}: reading outside the documented window", hypotheses=[{"id": "h1", "text": p["hypothesis"] + code, "label": "OFFICIAL_REFERENCE"}],
        missing=["Whether the printer itself displayed the code, and the state of the sensor wiring."],
        safe=["Follow the linked official page; do not bypass safety limits."], refs=_wiki_ref(p["reference_url"]),
        limits=["A reading is a fact about the sensor value, not proof of its cause.", "Thresholds come from the official wiki; the wiki pages do not always agree."],
        quality="STRONG" if all(o["source_status"] == "REAL" for o, _ in hits) else "MODERATE")]


def _densest(items: list[Obs], window_s: float) -> list[Obs]:
    """The largest run of observations inside any window of window_s seconds (first one on ties)."""
    best: list[Obs] = []
    j = 0
    for i in range(len(items)):
        while (_ts(items[i]) - _ts(items[j])).total_seconds() > window_s:
            j += 1
        if i - j + 1 > len(best):
            best = items[j:i + 1]
    return best


def ev_code_recurrence(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """The same declared code reported several times in a short window: counts declarations, says nothing about the cause."""
    p = rule["params"]
    by: dict[str, list[Obs]] = {}
    for o in obs:
        if o["event_type"] == p["event_type"] and isinstance(o["value"], dict) and isinstance(o["value"].get("code"), str):
            by.setdefault(o["value"]["code"], []).append(o)
    out: list[dict[str, Any]] = []
    for code in sorted(by):
        grp = _densest(by[code], p["window_s"])
        if len(grp) < p["min_count"]:
            continue
        dec = interpret(code)
        hyp = [{"id": "h1", "text": dec["entry"]["summary"], "label": "OFFICIAL_REFERENCE"}] if dec["status"] == "KNOWN" else []
        out.append(_make(
            rule, rs_hash, rs_id, [(o, "Same code declared again.") for o in grp], classification="OBSERVED",
            title=f"Code {code} declared {len(grp)} times within {p['window_s']} s", hypotheses=hyp,
            missing=["Whether the printer showed the code each time, and what was done between declarations."],
            safe=["Follow the linked official procedure for this code; if it keeps returning, contact Snapmaker support."],
            refs=WIKI_REF, limits=["Codes are declared by the user: this counts declarations, not machine events.", WIKI_NOTE],
            quality="WEAK"))
    return out


def ev_connection_flaps(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Repeated connection drops in a short window. The link failed; nothing is said about the printer."""
    p = rule["params"]
    drops = [o for o in obs if o["event_type"] in p["event_types"]]
    grp = _densest(drops, p["window_s"])
    if len(grp) < p["min_count"]:
        return []
    return [_make(
        rule, rs_hash, rs_id, [(o, f"{o['event_type']} observed.") for o in grp], classification="INCONCLUSIVE",
        title=f"Connection dropped {len(grp)} times within {p['window_s']} s", hypotheses=[{"id": "h1", "text": p["hypothesis"], "label": "OFFICIAL_REFERENCE"}],
        missing=["The printer's IP address over time (not collected) and Wi-Fi signal quality."],
        safe=["Check the printer itself: a lost connection does not mean it stopped.", "If the address changed, a static lease in the router is the documented fix."],
        refs=_wiki_ref(p["reference_url"]),
        limits=["A lost or timed-out connection does not mean the printer stopped or failed.", "The wiki links frequent disconnects to address changes; other causes are possible."],
        quality="WEAK")]


def ev_drop_probe(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Stream dropped, then HTTP probes: tells a lost link apart from a Klipper stop. Facts about reachability only."""
    p = rule["params"]
    drops = [o for o in obs if o["event_type"] in p["drop_event_types"]]
    probes = [o for o in obs if o["event_type"] == p["probe_event_type"] and isinstance(o["value"], dict)]
    if not drops or not probes:
        return []  # no probe after a drop: U1-S10 already says the data is incomplete
    first = drops[0]
    after = [o for o in probes if 0 <= (_ts(o) - _ts(first)).total_seconds() <= p["window_s"]]
    if not after:
        return []
    ok = [o for o in after if o["value"].get("http_ok") is True]
    ev: list[tuple[Obs, str]] = [(first, "Live stream dropped.")]
    limits = ["Probes show whether Klipper answers; they do not show whether the print continues.",
              "Only the first drop of the capture is examined."]
    if not ok:
        return [_make(
            rule, rs_hash, rs_id, ev + [(o, "Probe got no HTTP answer.") for o in after], classification="INCONCLUSIVE",
            title="Stream dropped and the printer did not answer HTTP probes either", hypotheses=[],
            missing=["Whether the printer or only the network path is down."],
            safe=["Check the printer itself (screen, power) and the network before concluding anything."], refs=[],
            limits=limits, quality="WEAK")]
    states = sorted({str(o["value"].get("klippy_state")) for o in ok})
    if states == ["ready"]:
        return [_make(
            rule, rs_hash, rs_id, ev + [(o, "HTTP answered, Klipper state 'ready'.") for o in ok], classification="OBSERVED",
            title="Stream dropped but Klipper still answered over HTTP (state ready): link problem, not a Klipper stop",
            hypotheses=[], missing=["Why the stream closed (Wi-Fi, address change, host sleep)."],
            safe=["Reconnect and look at the printer screen: the print may have continued."], refs=[],
            limits=limits, quality="MODERATE" if all(o["source_status"] == "REAL" for o, _ in ev) else "WEAK")]
    return [_make(
        rule, rs_hash, rs_id, ev + [(o, f"HTTP answered, Klipper state '{o['value'].get('klippy_state')}'.") for o in ok], classification="OBSERVED",
        title=f"After the stream dropped, Klipper reports state {', '.join(states)}", hypotheses=[],
        missing=["The cause of that state."],
        safe=["Read the printer screen and follow the official procedure for any displayed code."], refs=WIKI_REF,
        limits=limits, quality="MODERATE" if all(o["source_status"] == "REAL" for o, _ in ev) else "WEAK")]


def ev_fan_off_hot(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """A nozzle fan reported at 0 while its nozzle read hot, several samples in a row. Threshold measured on one print, not official."""
    p = rule["params"]
    by: dict[str, list[Obs]] = {}
    for o in obs:
        if o["event_type"] == p["event_type"] and o["validity"] == "FRESH" and isinstance(o["value"], dict):
            by.setdefault(o["source_ref"], []).append(o)
    out: list[dict[str, Any]] = []
    for ref in sorted(by):
        best: list[Obs] = []
        run: list[Obs] = []
        for o in by[ref]:
            c, sp = _number(o["value"].get("celsius")), _number(o["value"].get("fan_speed"))
            if c is not None and sp is not None and c >= p["min_celsius"] and sp == 0:
                run.append(o)
                if len(run) > len(best):
                    best = list(run)
            else:
                run = []
        if len(best) < p["min_count"]:
            continue
        out.append(_make(
            rule, rs_hash, rs_id, [(o, f"Nozzle {o['value']['celsius']:g} degC, fan speed 0.") for o in best], classification="OBSERVED",
            title=f"A nozzle fan read 0 while its nozzle was at {p['min_celsius']:g} degC or more, {len(best)} samples in a row", hypotheses=[],
            missing=["Whether the fan was really stopped (no rpm collected) and whether a heater or fan fault code was shown.", "Which toolhead this is (mapping unknown)."],
            safe=["Check on the printer itself whether that nozzle fan spins; do not keep a hot nozzle idle without cooling.", "Follow the official procedure for any displayed code."],
            refs=[], limits=[f"The {p['min_celsius']:g} degC threshold and the sample count come from one multi-colour print on one U1 (about 18 000 samples, no fan at 0 above 45 degC); they are not official values.",
                             "Samples are about 60 s apart: a short real fault can be missed and a short normal pause can look like a fault.",
                             "A reading is a fact about reported values, not proof of a fault."],
            quality="WEAK"))
    return out


DRYRUN_EVIDENCE_CAP = 20


def ev_dryrun_prediction(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Problems predicted by an imported U1 Dry Run report. A simulation of the sliced file, never an observation of a machine."""
    p = rule["params"]
    errs = [o for o in obs if o["event_type"] == "dryrun_firmware_error"]
    scars = [o for o in obs if o["event_type"] == "dryrun_scar"]
    if not errs and not scars:
        return []  # a clean report proves nothing about the print: no finding
    shown_e, shown_s = errs[:DRYRUN_EVIDENCE_CAP], scars[:DRYRUN_EVIDENCE_CAP]
    ev: list[tuple[Obs, str]] = [(o, f"Predicted firmware error at line {_line(o)}.") for o in shown_e]
    ev += [(o, f"Predicted scar at line {_line(o)}, clearance {_clearance(o)} mm.") for o in shown_s]
    ev += [(o, "Code declared in the same observation set: co-occurrence only, Dry Run does not predict error codes.")
           for o in obs if o["event_type"] == p["declared_event_type"]]
    limits = ["Prediction made by simulating the sliced file, not an observation of a machine.",
              "The report's own caveat: predicted scars are not checked on a physical print.",
              "The sliced file name is dropped on import."]
    if len(errs) > len(shown_e) or len(scars) > len(shown_s):
        limits.append(f"Only the first {DRYRUN_EVIDENCE_CAP} of each kind are listed as evidence.")
    return [_make(
        rule, rs_hash, rs_id, ev, classification="SUSPECTED",
        title=f"Dry Run predicts {len(errs)} firmware errors and {len(scars)} scars in the sliced file",
        hypotheses=[{"id": "h1", "text": p["hypothesis"], "label": "COMMUNITY_HYPOTHESIS"}],
        missing=["A physical print of this file: nothing was observed on a machine."],
        safe=["Review the flagged lines in the slicer before printing; Dry Run is a community tool, not an official check."],
        refs=[{"kind": "COMMUNITY_THREAD", "url": p["reference_url"], "checked_at": SIGNALS_CHECKED}],
        limits=limits, quality="WEAK")]


def _line(o: Obs) -> int | str:
    v = o["value"].get("line") if isinstance(o["value"], dict) else None
    return v if isinstance(v, int) and not isinstance(v, bool) else "?"


def _clearance(o: Obs) -> str:
    v = _number(o["value"].get("clearance_mm")) if isinstance(o["value"], dict) else None
    return "?" if v is None else f"{v:g}"


EVALUATORS: dict[str, Callable[..., list[dict[str, Any]]]] = {
    "catalog_code": ev_catalog_code,
    "state_transition": ev_state_transition,
    "mapping_unknown": ev_mapping_unknown,
    "coverage_gaps": ev_coverage_gaps,
    "transport_denied": ev_transport_denied,
    "value_window": ev_value_window,
    "code_recurrence": ev_code_recurrence,
    "connection_flaps": ev_connection_flaps,
    "dryrun_prediction": ev_dryrun_prediction,
    "drop_probe": ev_drop_probe,
    "fan_off_hot": ev_fan_off_hot,
}


def evaluate(observations: list[Obs], ruleset: dict[str, Any]) -> list[dict[str, Any]]:
    rs_hash = ruleset_hash(ruleset)
    obs = sort_observations(observations)
    findings: list[dict[str, Any]] = []
    for rule in ruleset["rules"]:
        if rule["status"] not in ALLOWED_RULE_STATUS:
            raise ValueError(f"rule {rule['id']}: invalid status")
        fn = EVALUATORS.get(rule["evaluator"])
        if fn is None:
            raise ValueError(f"rule {rule['id']}: unknown evaluator {rule['evaluator']!r}")
        findings.extend(fn(rule, obs, rs_hash, ruleset["ruleset_id"]))
    return sorted(findings, key=lambda f: (f["rule_id"], f["finding_id"]))
