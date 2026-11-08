# Security policy

U1 Doctor is a local, read-only tool. Full analysis: [`docs/threat-model.md`](docs/threat-model.md).

## Security model in brief

- **Read-only transport allowlist.** Requests are checked before any network I/O. Allowed: `GET /server/info`, `GET /printer/info`, `GET /printer/objects/list`, `GET /server/files/directory?path=logs` (that exact query only: it reads the free space of the log partition, the file names in the reply are dropped), and one WebSocket method, `printer.objects.subscribe`, limited to a fixed list of object names. Everything else is refused, including `POST /printer/objects/query` (never used, removed from the allowlist), pause, resume, cancel, restart, emergency stop and `printer.gcode.script`.
- **What one live capture sends.** 4 GET and 1 WebSocket subscribe message; if the stream drops early, up to 6 more status GET (3 probes of `/server/info` and `/printer/info`): 10 GET and 1 WebSocket message at most. The stream is never reopened. The WebSocket client sends no keepalive pings (it only answers the printer at protocol level: pong, closing handshake). One capture at a time.
- **Target restriction.** A literal private (RFC1918) IPv4 address, port 7125 only. Hostnames, IPv6, loopback and public addresses are refused. Redirects are not followed and proxy environment variables are ignored.
- **Mandatory consent.** A real connection needs an explicit owner consent object matching the target host.
- **Printer address.** Never stored, exported or logged. To say "the address changed since the last capture", the app keeps only a keyed fingerprint (HMAC-SHA256 with a random key created on this PC, both in the local database).
- **Local-only binding.** The app listens on `127.0.0.1` only. No cloud, no telemetry.
- **No cross-site requests (CSRF).** Any web page open in the browser could POST to `127.0.0.1` without CORS (a no-cors `fetch` or a form, raw body). Every non-GET request is therefore refused (403) when it carries an `Origin` other than the app's own, or lacks the `X-U1D: 1` header that the app's front end adds; a browser only sends a custom header cross-origin after a CORS preflight, which the app never answers. GET routes read local data only.
- **Windows exe housekeeping.** At start the exe removes the "downloaded from the Internet" mark (`Zone.Identifier`) from the `.dll` files inside its bundled `_internal` folder only, so WebView2 can load them; no other file is touched. If the window cannot start it writes `%APPDATA%\U1 Doctor\error.log`, with the user profile path replaced by `%USERPROFILE%`; read it before attaching it to an issue.
- **Untrusted imports.** U1-DEB bundles are validated (file-name allowlist, size and ratio caps, no symlinks or encrypted entries, SHA-256 and schema checks) and nothing in them is executed. See [`docs/U1-DEB.md`](docs/U1-DEB.md).
- **Known residual risks.** The policy is tested against a mock plus supervised read-only sessions on the owner's U1 (see `docs/evidence`); HTTP on the LAN is unencrypted; export redaction is best effort (pattern based: IPv4/IPv6, MAC, e-mail, URLs, `.local`/`.lan` host names, local and home paths, print file names, serial-like tokens, credential `key=value` pairs).

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private vulnerability reporting: the **Security** tab of this repository, then **Report a vulnerability**.

Include what you found, how to reproduce it, and the version or commit. Do not include real printer addresses, serial numbers or credentials.

## Scope

In scope:
- Any way to make U1 Doctor send a request outside the allowlist, or to a target outside the allowed range.
- Any way to reach the app from another machine (binding beyond `127.0.0.1`).
- Unsafe handling of an imported bundle (zip-slip, bombs, symlinks, parser issues).
- Leaks of sensitive data in an export beyond what the privacy report states.

Out of scope:
- Vulnerabilities in the Snapmaker firmware, Klipper, Moonraker or Fluidd (report to the respective projects).
- The lack of encryption of HTTP on the local network (disclosed limitation).
- Anonymity guarantees for exports: redaction is documented as best effort.
- Issues requiring an already-compromised PC.

## Supported versions

Pre-release. Version `0.1.7-g1` is the current build; only it and the current `main` are considered. `0.1.0-g1`, `0.1.1-g1`, `0.1.2-g1`, `0.1.4-g1`, `0.1.5-g1` and `0.1.6-g1` are superseded.
