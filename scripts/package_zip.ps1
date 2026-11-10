# Builds the distributable zip: the one-folder exe build + the licence + a SHA-256 file.
# Run from the repo root AFTER scripts\build_windows.ps1.
$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$app = Join-Path $root "build\dist\u1-doctor"
if (-not (Test-Path (Join-Path $app "u1-doctor.exe"))) { throw "Build first: scripts\build_windows.ps1" }
$name = "u1-doctor-0.3.0-g1-win64"
$stage = Join-Path $root "build\zip-stage\$name"
if (Test-Path (Split-Path $stage)) { Remove-Item -Recurse -Force (Split-Path $stage) }
New-Item -ItemType Directory -Force $stage | Out-Null
# The user gets the app only: u1-doctor.exe at the top of the folder, its runtime files, the licence and the third-party notices. The second-PC test kit
# (scripts\second-pc-test) stays in the repository for maintainers and is not shipped.
Copy-Item -Recurse (Join-Path $app "*") $stage
Copy-Item (Join-Path $root "LICENSE") $stage
# The bundled fonts are under the SIL OFL 1.1 (one under Apache 2.0): ship their notices and full licence texts with them.
Copy-Item (Join-Path $root "THIRD_PARTY_NOTICES.md") $stage
$fontLic = Join-Path $stage "licenses\fonts"
New-Item -ItemType Directory -Force $fontLic | Out-Null
$found = Get-ChildItem (Join-Path $root "frontend\node_modules\@fontsource*\*\LICENSE")
if (-not $found) { throw "Font licences not found: run npm ci in frontend first" }
$found | ForEach-Object { Copy-Item $_.FullName (Join-Path $fontLic ("{0}-{1}.txt" -f $_.Directory.Parent.Name.TrimStart("@"), $_.Directory.Name)) }
$zip = Join-Path $root "build\$name.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path $stage -DestinationPath $zip -CompressionLevel Optimal
$h = (Get-FileHash $zip -Algorithm SHA256).Hash
"$h  $name.zip" | Set-Content "$zip.sha256.txt" -Encoding ascii
Write-Host ("{0}  {1:N1} MB  SHA-256 {2}" -f $zip, ((Get-Item $zip).Length / 1MB), $h)
