# Security policy

U1 Doctor is a local, read-only tool. Full analysis: [`docs/threat-model.md`](docs/threat-model.md).

## Security model in brief

- **Read-only transport allowlist.** Requests are checked before any network I/O. Allowed: `GET /server/info`, `GET /printer/info`, `GET /printer/objects/list`, `POST /printer/objects/query` (query body only), and one WebSocket method, `printer.objects.subscribe`. Everything else is refused, including pause, resume, cancel, restart, emergency stop and `printer.gcode.script`.
- **Target restriction.** A literal private (RFC1918) IPv4 address, port 7125 only. Hostnames, IPv6, loopback and public addresses are refused. Redirects are not followed and proxy environment variables are ignored.
- **Mandatory consent.** A real connection needs an explicit owner consent object matching the target host.
- **Local-only binding.** The app listens on `127.0.0.1` only. No cloud, no telemetry.
- **Untrusted imports.** U1-DEB bundles are validated (file-name allowlist, size and ratio caps, no symlinks or encrypted entries, SHA-256 and schema checks) and nothing in them is executed. See [`docs/U1-DEB.md`](docs/U1-DEB.md).
- **Known residual risks.** The policy is tested against a mock plus supervised read-only sessions on the owner's U1 (see `docs/evidence`); HTTP on the LAN is unencrypted; export redaction is best effort.

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

Pre-release. Version `0.1.5-g1` is the current build; only it and the current `main` are considered. `0.1.0-g1`, `0.1.1-g1`, `0.1.2-g1` and `0.1.4-g1` are superseded.
