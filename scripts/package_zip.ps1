# Builds the distributable zip: the one-folder exe build + the second-PC test kit + a SHA-256 file.
# Run from the repo root AFTER scripts\build_windows.ps1.
$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$app = Join-Path $root "build\dist\u1-doctor"
if (-not (Test-Path (Join-Path $app "u1-doctor.exe"))) { throw "Build first: scripts\build_windows.ps1" }
$name = "u1-doctor-0.1.4-g1-win64"
$stage = Join-Path $root "build\zip-stage\$name"
if (Test-Path (Split-Path $stage)) { Remove-Item -Recurse -Force (Split-Path $stage) }
New-Item -ItemType Directory -Force (Join-Path $stage "test-kit") | Out-Null
Copy-Item -Recurse $app (Join-Path $stage "u1-doctor")
$kit = Join-Path $root "scripts\second-pc-test"
Copy-Item (Join-Path $kit "RUN-TEST.cmd"), (Join-Path $kit "LISEZ-MOI.txt") $stage
Copy-Item (Join-Path $root "LICENSE") $stage
# Windows PowerShell 5.1 reads BOM-less files as ANSI: save the script with a BOM.
$ps1 = Get-Content (Join-Path $kit "u1-doctor-test.ps1") -Raw -Encoding UTF8
[IO.File]::WriteAllText((Join-Path $stage "test-kit\u1-doctor-test.ps1"), $ps1, (New-Object Text.UTF8Encoding($true)))
Copy-Item (Join-Path $root "examples\u1-deb\example-synthetic-known-code-feeder3.u1deb.zip") (Join-Path $stage "test-kit")
$zip = Join-Path $root "build\$name.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path $stage -DestinationPath $zip -CompressionLevel Optimal
$h = (Get-FileHash $zip -Algorithm SHA256).Hash
"$h  $name.zip" | Set-Content "$zip.sha256.txt" -Encoding ascii
Write-Host ("{0}  {1:N1} MB  SHA-256 {2}" -f $zip, ((Get-Item $zip).Length / 1MB), $h)
