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
    skip = set(rule["params"].get("skip_event_types", []))  # summaries read from log files are not values that belong to a toolhead
    un = [o for o in obs if (o["entity_id"] == "unmapped" or o["mapping_quality"] == "UNKNOWN") and o["event_type"] not in skip]
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


# --- Live rules S17-S24 (BACKLOG #57). Written from documentation and forum reports; UNTESTED on a real U1. --------
# Each reads one window summary built by app.capture.live_facts. When the source is missing, a rule speaks only if
# the capture says so (`live_coverage.absent`): one INCONCLUSIVE "not observable" finding, never a guess.
UNTESTED = "UNTESTED: this rule has not been checked against a real U1 fault; it only restates the reported values."
NAMES = "Values are keyed by the Klipper object name (extruder, extruder1...); which physical toolhead each one is stays unproven (H-04)."


def _community(url: str) -> list[dict[str, str]]:
    return [{"kind": "COMMUNITY_THREAD", "url": url, "checked_at": "2026-11-08"}]


def _latest(obs: list[Obs], etype: str) -> Obs | None:
    hits = [o for o in obs if o["event_type"] == etype and o["validity"] == "FRESH" and isinstance(o["value"], dict)]
    return hits[-1] if hits else None


def _quality(os_: list[Obs]) -> str:
    return "MODERATE" if all(o["source_status"] == "REAL" for o in os_) else "WEAK"


def _not_observable(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    p = rule["params"]
    cov = _latest(obs, "live_coverage")
    absent = cov["value"].get("absent") if cov else None
    if cov is None or not isinstance(absent, list) or not set(p["coverage_keys"]) & set(absent):
        return []
    what = p["label"]
    return [_make(
        rule, rs_hash, rs_id, [(cov, f"Not reported in this capture: {', '.join(sorted(set(p['coverage_keys']) & set(absent)))}.")],
        classification="INCONCLUSIVE", title=f"{what}: not observable in this capture", hypotheses=[],
        missing=[f"{what}: the printer did not report this data during the capture (object or field absent, or the read failed)."],
        safe=["No action: missing data says nothing about the printer."], refs=[],
        limits=["Absence of data is not evidence of absence.", UNTESTED], quality="UNKNOWN")]


def ev_offset_spread(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Spread of one extruder_offset axis across the extruder objects. A fact about reported offsets, not a fault."""
    p = rule["params"]
    o = _latest(obs, p["event_type"])
    if o is None:
        return _not_observable(rule, obs, rs_hash, rs_id)
    ax = p["axis"]
    vals = {n: v for n, d in sorted(o["value"].items()) if isinstance(d, dict) and (v := _number(d.get(ax))) is not None}
    if len(vals) < 2:
        return []
    spread = max(vals.values()) - min(vals.values())
    if spread <= p["max_spread_mm"]:
        return []
    low = [n for n, v in vals.items() if v < p["low_mm"]]
    listed = ", ".join(f"{n} {v:g}" for n, v in vals.items())
    return [_make(
        rule, rs_hash, rs_id, [(o, f"{ax.upper()} offsets (mm): {listed}.")], classification="OBSERVED",
        title=f"{ax.upper()} offsets of the extruders spread over {spread:.2f} mm (above {p['max_spread_mm']:g} mm)",
        hypotheses=[{"id": "h1", "text": p["hypothesis"], "label": "COMMUNITY_HYPOTHESIS"}],
        missing=["Whether a print actually failed on the start line, and which head started the print."]
        + ([] if low else [f"No extruder object reports a {ax.upper()} offset below {p['low_mm']:g} mm."]),
        safe=["Do not edit offsets by hand from this finding: run the official offset calibration, then contact Snapmaker support if the spread stays."],
        refs=_community(p["reference_url"]),
        limits=[f"The {p['max_spread_mm']:g} mm and {p['low_mm']:g} mm figures come from one forum report, not from Snapmaker.", NAMES, UNTESTED],
        quality=_quality([o]))]


def ev_sensor_implausible(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Bed or cavity sensor below a physically implausible value, or the two reading exactly the same all window long."""
    p = rule["params"]
    o = _latest(obs, p["event_type"])
    if o is None or not isinstance(o["value"].get("sensors"), dict):
        return _not_observable(rule, obs, rs_hash, rs_id)
    sens = o["value"]["sensors"]
    notes: list[str] = []
    for n in p["sensors"]:
        d = sens.get(n)
        lo = _number(d.get("min_c")) if isinstance(d, dict) else None
        if lo is not None and lo < p["below_c"]:
            notes.append(f"{n} read {lo:g} degC (below {p['below_c']:g} degC).")
    bc = o["value"].get("bed_cavity")
    pairs = bc.get("pairs") if isinstance(bc, dict) else None
    same = bc.get("identical") if isinstance(bc, dict) else None
    if isinstance(pairs, int) and isinstance(same, int) and pairs >= p["min_pairs"] and same == pairs:
        notes.append(f"Bed and cavity sensors gave exactly the same value in all {pairs} paired readings.")
    if not notes:
        return []
    return [_make(
        rule, rs_hash, rs_id, [(o, " ".join(notes))], classification="OBSERVED",
        title="Bed or cavity temperature reading is implausible", hypotheses=[{"id": "h1", "text": p["hypothesis"], "label": "COMMUNITY_HYPOTHESIS"}],
        missing=["Whether the printer showed an error code, and the Klipper log message (for example an ADC out-of-range shutdown)."],
        safe=["Power the printer off before touching any cable; follow the official procedure for any displayed code.", "If the code is 0003-0526-0000-0000, read the forum cause in the code decoder before replacing the bed."],
        refs=_community(p["reference_url"]),
        limits=[f"The {p['below_c']:g} degC limit is a plausibility bound chosen by U1 Doctor, not an official value.",
                "Identical readings can be a coincidence when both sensors sit at room temperature.", UNTESTED],
        quality=_quality([o]))]


def ev_heater_no_rise(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """A heater target set well above the reading, and the reading did not rise during the window."""
    p = rule["params"]
    o = _latest(obs, p["event_type"])
    if o is None or not isinstance(o["value"].get("sensors"), dict):
        return _not_observable(rule, obs, rs_hash, rs_id)
    notes: list[str] = []
    for n, d in sorted(o["value"]["sensors"].items()):
        if not isinstance(d, dict):
            continue
        f, la, tg, s = (_number(d.get(k)) for k in ("first_c", "last_c", "target_c", "seconds"))
        if None in (f, la, tg, s) or tg <= 0 or s < p["min_window_s"] or tg - f < p["min_gap_c"]:  # type: ignore[operator]
            continue
        if la - f < p["min_rise_c"]:  # type: ignore[operator]
            notes.append(f"{n}: target {tg:g} degC, {f:g} -> {la:g} degC in {s:g} s.")
    if not notes:
        return []
    return [_make(
        rule, rs_hash, rs_id, [(o, " ".join(notes))], classification="OBSERVED",
        title=f"Heater target set but the temperature rose less than {p['min_rise_c']:g} degC during the capture", hypotheses=[],
        missing=["Heater power over time, and whether the printer showed a heating error code.", "A longer window: heating may start late."],
        safe=["Watch the temperature on the printer screen; if it does not rise, follow the official heating troubleshooting page."],
        refs=[], limits=[f"Window of {p['min_window_s']:g} s and rise of {p['min_rise_c']:g} degC are U1 Doctor display thresholds, not official values.", NAMES, UNTESTED],
        quality=_quality([o]))]


def ev_nozzle_compare(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Reported nozzle diameter per extruder object, against each other and against an analysed G-code (sets, not slots)."""
    p = rule["params"]
    o = _latest(obs, p["event_type"])
    if o is None:
        return _not_observable(rule, obs, rs_hash, rs_id)
    rep = {n: d for n, raw in sorted(o["value"].items()) if (d := _number(raw)) is not None}
    if not rep:
        return []
    listed = ", ".join(f"{n} {v:g} mm" for n, v in rep.items())
    base_missing = ["The diameter configured in printer.cfg (not read: the whole configuration is outside the capture budget)."]
    limits = [NAMES, UNTESTED]
    refs = _community(p["reference_url"])
    hyp = [{"id": "h1", "text": p["hypothesis"], "label": "COMMUNITY_HYPOTHESIS"}]
    out: list[dict[str, Any]] = []
    if len(set(rep.values())) > 1:
        out.append(_make(
            rule, rs_hash, rs_id, [(o, f"Reported: {listed}.")], classification="OBSERVED",
            title="Extruder objects report different nozzle diameters", hypotheses=hyp, missing=base_missing,
            safe=["Compare with Settings > Maintenance > Toolhead Info on the printer and with the nozzles actually installed."],
            refs=refs, limits=["Different diameters can be intentional.", *limits], quality=_quality([o])))
    g = _latest(obs, p["gcode_event_type"])
    gm = sorted({v for x in g["value"].get("mm", []) if (v := _number(x)) is not None}) if g else []
    extra = [x for x in gm if x not in set(rep.values())]
    if g is not None and extra:
        out.append(_make(
            rule, rs_hash, rs_id, [(o, f"Reported: {listed}."), (g, f"G-code nozzle_diameter: {', '.join(f'{x:g}' for x in gm)} mm.")], classification="OBSERVED",
            title=f"G-code nozzle diameter {', '.join(f'{x:g}' for x in extra)} mm is not reported by any extruder object", hypotheses=hyp, missing=base_missing,
            safe=["Check the installed nozzles on the printer and the nozzle set in the slicer before printing this file."],
            refs=refs, limits=["The G-code value is the slicer setting found in the analysed file (IMPORTED), not a machine observation.", *limits],
            quality="WEAK"))
    return out


def ev_clock_gap(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Controller clock (main MCU) much shorter than the host clock while printing: a restart left the host running."""
    p = rule["params"]
    o = _latest(obs, p["event_type"])
    if o is None:
        return _not_observable(rule, obs, rs_hash, rs_id)
    h, m, st = _number(o["value"].get("host_s")), _number(o["value"].get("mcu_s")), o["value"].get("print_state")
    if h is None or m is None or st not in p["states"] or h - m <= p["min_gap_s"]:
        return []
    return [_make(
        rule, rs_hash, rs_id, [(o, f"Host clock {h:g} s, controller clock {m:g} s, print state '{st}'.")], classification="OBSERVED",
        title=f"Controller clock is {h - m:.0f} s shorter than the host clock during a print",
        hypotheses=[{"id": "h1", "text": p["hypothesis"], "label": "COMMUNITY_HYPOTHESIS"}],
        missing=["Whether the touchscreen is responsive, and the time of the last Klipper or firmware restart."],
        safe=["If the touchscreen does not respond, control the print from Fluidd on the local network; power-cycle the printer fully once the print is over."],
        refs=_community(p["reference_url"]),
        limits=["Host clock: the eventtime Klipper stamps on each update (host monotonic clock). Controller clock: toolhead.estimated_print_time (main MCU clock). It resets when the MCU restarts; a Klipper service restart without an MCU reset is not visible.",
                f"The {p['min_gap_s']:g} s gap is a U1 Doctor display threshold, not an official value.", UNTESTED],
        quality=_quality([o]))]


def ev_disk_usage(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Disk usage of the partition holding the `logs` root, as numbers, with the 'save the bundle now' pointer."""
    p = rule["params"]
    o = _latest(obs, p["event_type"])
    if o is None:
        return _not_observable(rule, obs, rs_hash, rs_id)
    tot, used, free = (_number(o["value"].get(k)) for k in ("total_bytes", "used_bytes", "free_bytes"))
    if tot is None or used is None or free is None or tot <= 0:
        return []
    return [_make(
        rule, rs_hash, rs_id, [(o, f"total {tot:.0f} B, used {used:.0f} B, free {free:.0f} B.")], classification="OBSERVED",
        title=f"Log partition: {free / 1e6:.1f} MB free of {tot / 1e6:.1f} MB ({100 * used / tot:.0f} % used)",
        hypotheses=[{"id": "h1", "text": p["hypothesis"], "label": "COMMUNITY_HYPOTHESIS"}],
        missing=["How fast the logs rotate on this printer, and whether the configuration lives on the same partition."],
        safe=["Save the bundle now: export the system log from the touchscreen and a U1-DEB bundle before the logs rotate."],
        refs=_community(p["reference_url"]),
        limits=["Numbers as reported by Moonraker for the partition holding its `logs` root; no fill level is judged normal or not.", UNTESTED],
        quality=_quality([o]))]


def ev_extruder_activity(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Per extruder object: state changes and counter changes during the window. Counts only, in a fixed order, no ranking."""
    p = rule["params"]
    o = _latest(obs, p["event_type"])
    if o is None or not isinstance(o["value"].get("extruders"), dict):
        return _not_observable(rule, obs, rs_hash, rs_id)
    parts: list[str] = []
    changed = False
    for n, d in sorted(o["value"]["extruders"].items()):
        if not isinstance(d, dict):
            continue
        sc = d.get("state_changes", 0)
        bits = [f"{sc} state changes"]
        changed |= isinstance(sc, int) and sc > 0
        for k in ("switch_count", "retry_count", "error_count"):
            v = d.get(k)
            if isinstance(v, list) and len(v) == 2 and all(isinstance(x, int) for x in v):
                bits.append(f"{k} {v[1]} ({v[1] - v[0]:+d})")
                changed |= v[1] != v[0]
        parts.append(f"{n}: " + ", ".join(bits) + ".")
    hc = o["value"].get("homing_changes", 0)
    changed |= isinstance(hc, int) and hc > 0
    if not changed:
        return []
    return [_make(
        rule, rs_hash, rs_id, [(o, " ".join(parts) + f" Homed-axes changes: {hc}.")], classification="OBSERVED",
        title="Toolhead activity during the capture, per extruder object (counts, not ranked)", hypotheses=[],
        missing=["What each counter means in the U1 firmware (not documented officially)."],
        safe=["No action from counts alone; compare them with the printer screen if a toolhead misbehaves."], refs=[],
        limits=["Counters are the firmware's own totals; only their change during this window is an event of this capture.", NAMES, UNTESTED],
        quality=_quality([o]))]


def ev_bed_mesh_stats(rule: Rule, obs: list[Obs], rs_hash: str, rs_id: str) -> list[dict[str, Any]]:
    """Bed-mesh statistics as numbers only: no 'normal' judgement (no official threshold in the repo)."""
    p = rule["params"]
    o = _latest(obs, p["event_type"])
    if o is None:
        return _not_observable(rule, obs, rs_hash, rs_id)
    v = o["value"]
    if not v.get("points"):
        return [_make(
            rule, rs_hash, rs_id, [(o, "The bed_mesh object reported no probed points.")], classification="INCONCLUSIVE",
            title="No probed bed mesh in this capture", hypotheses=[], missing=["A loaded bed-mesh profile."],
            safe=["No action."], refs=[], limits=["Absence of a mesh says nothing about the bed.", UNTESTED], quality="UNKNOWN")]
    nums = [_number(v.get(k)) for k in ("range_mm", "stdev_mm", "min_mm", "max_mm")]
    if None in nums:
        return []
    rng, sd, lo, hi = nums
    return [_make(
        rule, rs_hash, rs_id, [(o, f"{v['points']} points ({v.get('rows')} x {v.get('cols')}), min {lo:g} mm, max {hi:g} mm.")], classification="OBSERVED",
        title=f"Bed mesh: {v['points']} points, range {rng:.3f} mm, standard deviation {sd:.3f} mm", hypotheses=[],
        missing=["An official flatness tolerance for the U1 bed (none in U1 Doctor's sources)."],
        safe=["No action from these numbers alone."], refs=[],
        limits=["Statistics of the probed points only; U1 Doctor does not judge them normal or abnormal.", UNTESTED],
        quality=_quality([o]))]


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
    "offset_spread": ev_offset_spread,
    "sensor_implausible": ev_sensor_implausible,
    "heater_no_rise": ev_heater_no_rise,
    "nozzle_compare": ev_nozzle_compare,
    "clock_gap": ev_clock_gap,
    "disk_usage": ev_disk_usage,
    "extruder_activity": ev_extruder_activity,
    "bed_mesh_stats": ev_bed_mesh_stats,
}


from .log_rules import LOG_EVALUATORS  # noqa: E402  (log_rules reads helpers from this module at call time)

EVALUATORS.update(LOG_EVALUATORS)


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
