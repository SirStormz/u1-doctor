"""'What support will ask' checklist for a code. Pure, offline, read-only.

Items marked source=wiki are asked by the official article linked from the code (read 2026-11-06); source=suggested are
added by U1 Doctor and never presented as an official request. Nothing here contacts anyone or reads the machine.
"""
from __future__ import annotations

from typing import Any

from .knowledge import interpret, parse_firmware

TICKET = {"title": "Official support request form", "url": "https://snapmaker.formcrafts.com/u1-troubleshooting-request"}

TEXT = {
    "error_code": "The exact error code shown on the printer screen.",
    "video_error": "A video showing the error.",
    "logs": "The exported machine log files (they are encrypted: only support can read them).",
    "gcode_file": "The G-code file in use when the problem happened.",
    "serial_number": "The printer serial number (SN) from Settings > About.",
    "photo_runout_cable": "A photo of the broken filament runout sensor cable.",
    "order_number": "Your order number (website order starting with SM; for a distributor, its name and your order number; for a store, the store order number).",
    "photos_per_toolhead": "Photos of each toolhead, named by toolhead number.",
    "error_count": "The error count message shown when you tap the code after the test G-code has run.",
    "swap_video": "The video requested by the first-setup toolhead swap guide (firmware 0.9.4 or newer needed).",
    "troubleshooting_results": "Your troubleshooting results, with pictures or videos.",
    "firmware_version": "Your firmware version (Settings > About), so release-note facts can be compared.",
    "u1_deb": "Optional: a U1-DEB evidence bundle as a readable complement; support reads its own encrypted logs.",
}
SUGGESTED = {"firmware_version", "u1_deb"}


def checklist(code: str, firmware: str | None = None) -> dict[str, Any]:
    dec = interpret(code)
    if dec["status"] == "MALFORMED":
        raise ValueError(dec["reason"])
    entry = dec.get("entry") or {}
    ids = ["error_code", *entry.get("support_asks", []), "troubleshooting_results", "firmware_version", "u1_deb"]
    items = [{"id": i, "text": TEXT[i], "source": "suggested" if i in SUGGESTED else "wiki"} for i in ids]
    return {
        "code": code, "status": dec["status"], "title": entry.get("title"), "firmware": firmware if parse_firmware(firmware) else None,
        "items": items, "article": entry.get("article"), "ticket": TICKET,
        "notes": ["Serial numbers, order numbers and logs are for official support only: do not post them publicly.",
                  "Only the code's linked official article was used to decide what is asked; codes without one get the general items."],
    }
