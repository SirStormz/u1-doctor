# Threat model (G0)

Assets: the U1 (must never be mutated), owner's private data (IP, serial, SSID, filenames, tokens), integrity of diagnostic claims, the PC.
Trust boundaries: browser↔backend (localhost), backend↔U1 (LAN, unauthenticated HTTP likely), file import (untrusted), Wiki/forum content (untrusted data).

| # | Threat | Control | Test / status |
|---|---|---|---|
| T1 | UI or injected input sends G-code/print/restart/upload | No generic proxy; 3 HTTP GET ops + 1 WS method, exact method+path+JSON-RPC; policy before I/O | `test_forbidden_http_denied_before_io` (38), `test_ws_denied` (23) — TESTED_SYNTHETIC |
| T2 | Allowed path abused (query smuggling, `..`, `%`, CRLF, unicode, case, `//`) | Strict path charset, no `?#%\;@`, exact dict lookup | same tests |
| T3 | `POST /printer/objects/query` body used to carry commands | Removed from the allowlist (never used by the app, BACKLOG #52 L3): every POST is refused, whatever the body. The same object validation still guards the WS subscribe params | `test_objects_query_denied_whatever_the_body`, `test_allowlist_is_get_only` |
| T4 | SSRF / pointing tool at public host, loopback, metadata IP | Target = literal canonical RFC1918 IPv4, port 7125 only; hostnames/IPv6 refused (no DNS ⇒ no rebinding window) | `test_bad_targets` (24) |
| T5 | Redirect to external host | `follow_redirects=False`, 3xx → error, one request only | `test_redirect_not_followed` |
| T6 | Proxy env var exfiltration | `trust_env=False` | `test_env_proxy_ignored` |
| T7 | Oversized/non-JSON response (DoS) | 2 MiB streaming cap, JSON object required | tests |
| T8 | Connecting to printer without owner approval | Real client needs `Consent(approved_by_owner, target_host==host)`; no code path creates it in G0 | `test_real_network_requires_owner_consent` |
| T9 | Auth bypass | 401/403 reported, never retried with credentials; no secret handling in G0 | `test_auth_status_reported_no_bypass` |
| T10 | Malicious import (zip-slip, bomb, symlink, JSON pollution, YAML exec) | Implemented (`app/deb.py`): U1-DEB only, fixed file-name enum, size caps pre-extraction, safe JSON, no YAML load of untrusted input | TESTED_SYNTHETIC (hostile-zip tests in `backend/tests/test_deb.py`); not fuzzed, not run on a second machine |
| T11 | Data leak in export (IP/serial/SSID/token/filename/path) | Allowlist schema + sentinel tests + preview + consent | Implemented (best-effort redaction, preview before export); TESTED_SYNTHETIC; not a guarantee of anonymity |
| T12 | False/dangerous diagnosis | Classification enum, mandatory `limits`, `evidence_against`, no score, SYNTHETIC badge, official wording only | schema tests; engine PLANNED |
| T13 | GPL contamination (u1-* forks GPL-3.0) | No copying; cite + link; licence is MIT, nothing copied from GPL-3.0 repositories | DECIDED (MIT); to be confirmed by the owner before going public (BACKLOG #31) |
| T14 | Prompt-injection via forum/wiki/subagent text | Treated as data; facts re-verified in primary source | process |
| T15 | Fake provenance (REAL label on demo) | schema: DEMO ⇒ SYNTHETIC; SYNTHETIC ⇒ id contains "synthetic" | `test_bad_observations_rejected` |
| T16 | CSRF: another web page in the browser POSTs to the local API (no-cors, `text/plain`, raw body: bundle, Dry Run, G-code, live capture) | Middleware refuses every non-GET request with a foreign `Origin` (`FOREIGN_ORIGIN`) or without the `X-U1D: 1` header (`MISSING_APP_HEADER`); a cross-origin custom header needs a CORS preflight the app never answers | `test_foreign_origin_is_refused_on_every_post`, `test_missing_app_header_is_refused_on_every_post` |
| T17 | Concurrent requests on the shared SQLite connection; two live captures at once | One lock around every database use; duplicate save is atomic (UNIQUE violation = already saved); a second live capture is refused (`LIVE_BUSY`, 409) | `test_concurrent_saves_of_the_same_content_make_one_session`, `test_a_second_concurrent_capture_is_refused_not_queued` |

Residual risks: the policy is tested against a mock; real stack behaviour (HTTP/WS client, Windows firewall) is untested. A WebSocket client exists (`app/transport/ws.py`) and was used once on the owner's U1 (H-02, subscribe only); no other real-network testing, no Windows-firewall testing. `server.connection.identify` handling undecided. HTTP on LAN is unencrypted — disclose in UI.
