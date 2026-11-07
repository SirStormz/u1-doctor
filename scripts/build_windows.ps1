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

# --noupx: never compress the exe (UPX raises antivirus false positives). --version-file: product metadata. The excluded modules are
# development tools the app never imports (they only got in because the venv holds the dev extras).
& "backend\.venv\Scripts\python.exe" -m PyInstaller --noconfirm --clean --noupx --name u1-doctor `
  --version-file "$root\scripts\version_info.txt" `
  --exclude-module mypy --exclude-module mypy_extensions --exclude-module pytest --exclude-module _pytest --exclude-module setuptools `
  --exclude-module pkg_resources --exclude-module tkinter --exclude-module jsonschema `
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
