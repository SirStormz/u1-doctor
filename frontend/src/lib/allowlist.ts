/** What the local service may ask the printer (mirrors the backend allowlist, see SECURITY.md): reads and one subscription, never a write. */
export const ALLOW = [["GET", "/server/info"], ["GET", "/printer/info"], ["GET", "/printer/objects/list"], ["GET", "/server/files/directory?path=logs"], ["GET", "/server/history/totals"], ["WS", "printer.objects.subscribe"]] as const;
export const DENY = ["printer.gcode.script", "printer.print.*", "printer.restart", "machine.*", "server.files.upload", "server.files.delete", "/printer/objects/query"] as const;
