# H-06 — passive watch of a multi-colour print (read-only)

Derived facts only. No address, host name or file name. Raw frames stay in `private/` (git-ignored).

- Window: 2026-11-07 08:12:11Z → 09:07:51Z (3400.5 s). 18339 inbound frames, max gap 0.75 s.
- Outbound: 1 `printer.objects.subscribe` frame, 0 other. print_stats.state: `printing` → `complete`.
- 4 tools used (T0–T3), 13 tool changes after the first heat-up.

## Tool change signature (observed, every change)
1. old extruder `state` ACTIVATE → PARKED.
2. new extruder `state` UNKNOWN → ACTIVATE (0.3–2 s later).
3. `toolhead.extruder` switches to the new object name.
4. new extruder `switch_count` +1 (exactly). `retry_count` and `error_count` unchanged on all four.
5. `extruder_index` equals the object suffix (extruder=0, extruder1=1, extruder2=2, extruder3=3).

## switch_count over the print
extruder 752→765 (+13), extruder1 731→736 (+5), extruder2 664→672 (+8), extruder3 1106→1110 (+4).
retry_count 95 / 3 / 3 / 4 and error_count 0 for all four: unchanged.

## machine_state_manager.action_code
- First activation of each tool: 320 (extruder), 321 (extruder1), 322 (extruder2), 323 (extruder3), each held ~3.3 min.
- Later tool changes: 134 for ~13 s, then 0.
- Others seen: 136 (start), 132, 2, 257/258/256, 0.
- Link to the "toolhead N" wording of official codes is still NOT proven: 320+i matches extruder_index i, nothing more.

## Hotend fans and heaters
- All four nozzles reached 221–222 °C with power 1.0.
- `heater_fan eN_nozzle_fan`: speed max 0.75, rpm max 15975–17586. `power_fan`: speed 0.6.
- No fault, no exception (`exception_manager.exceptions` stayed empty).
