#!/bin/sh
# Refait toutes les images U1 des planches depuis U1_Jay_Master.blend (Blender 5.2, EEVEE). ~2 min sur RTX 3070.
cd "$(dirname "$0")/../../../.."
B="${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
OUT="${1:-private/ui-v2/renders}"
mkdir -p "$OUT"
for t in obs vis line holo; do for s in hero tetes ecran; do
  "$B" -b U1_Jay_Pack_Complet/U1_Jay/U1_Jay_Master.blend --python docs/design/ui-v2/sources/render_u1.py -- $t $s "$PWD/$OUT/u1-$t-$s.png" 1 2>&1 | grep -E "RENDER_OK|Error|Traceback"
done; done
