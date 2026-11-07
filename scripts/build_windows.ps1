# One-folder Windows build (no Python needed by the end user). Run from the repo root in PowerShell.
# NOTE: the owner's 3D model (frontend/public/models/u1-jay.glb, committed) is bundled in the build.
$ErrorActionPreference = "Stop"
$root = (Get-Location).Path

Push-Location frontend; npm ci; npm run build; Pop-Location

$stage = Join-Path $root "build\stage\frontend"
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item -Recurse (Join-Path $root "frontend\dist") (Join-Path $stage "dist")
if (-not (Test-Path (Join-Path $stage "dist\models\u1-jay.glb"))) { Write-Warning "No 3D model found: the exe will show a still image" }

& "backend\.venv\Scripts\python.exe" -m PyInstaller --noconfirm --clean --name u1-doctor `
  --paths backend `
  --add-data "$root\knowledge;knowledge" `
  --add-data "$root\rulesets;rulesets" `
  --add-data "$root\fixtures\synthetic;fixtures/synthetic" `
  --add-data "$root\fixtures\real;fixtures/real" `
  --add-data "$stage\dist;frontend/dist" `
  --distpath build\dist --workpath build\work --specpath build `
  backend\run_u1doctor.py

$bundled = Test-Path "build\dist\u1-doctor\_internal\frontend\dist\models\u1-jay.glb"
Write-Host "Built build\dist\u1-doctor\u1-doctor.exe (3D model bundled: $bundled)"
