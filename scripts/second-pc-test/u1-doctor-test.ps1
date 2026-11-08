# U1 Doctor - test kit for a clean PC. Works on Windows PowerShell 5.1 (default on Windows 11).
# What it does: starts the exe on 127.0.0.1 only, calls the local API, takes headless-browser screenshots of the 11 screens,
# asks 4 short questions, and writes a report folder + zip on the Desktop. It never touches a printer and sends nothing anywhere.
# Collected: Windows version, language, RAM, antivirus names/status, download-zone flag of the exe (number only), timings, API results.
# NOT collected: user name, computer name, file paths, download URL, any personal file.
param([switch]$NoQuestions, [int]$Port = 18765)
$ErrorActionPreference = "Continue"
$kit = $PSScriptRoot
$exe = Join-Path (Split-Path $kit -Parent) "u1-doctor\u1-doctor.exe"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outDir = Join-Path ([Environment]::GetFolderPath("Desktop")) "U1Doctor-TestReport-$stamp"
New-Item -ItemType Directory -Force $outDir | Out-Null
$r = [ordered]@{ kit_version = 1; started_utc = (Get-Date).ToUniversalTime().ToString("o") }
function Clean([string]$s) {
  foreach ($p in @($env:USERPROFILE, $env:USERNAME, $env:COMPUTERNAME, (Split-Path $kit -Parent))) { if ($p) { $s = $s -replace [regex]::Escape($p), "<redacted>" } }
  return $s
}
function Try-Get($sb) { try { & $sb } catch { "n/a: " + (Clean $_.Exception.Message) } }

Write-Host ""
Write-Host "=== Test U1 Doctor ===" -ForegroundColor Yellow
Write-Host "Aucune imprimante n'est contactee. Rien n'est envoye. Un dossier de rapport sera cree sur le Bureau."
Write-Host ""

# 1. Environment
$os = Get-CimInstance Win32_OperatingSystem
$r.windows = [ordered]@{ caption = $os.Caption; build = $os.BuildNumber; arch = $os.OSArchitecture; language = (Get-Culture).Name; ram_gb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1); powershell = $PSVersionTable.PSVersion.ToString() }
$r.edge_found = $false
# Any Chromium browser works for the headless screenshots: Edge first, then Chrome; registry "App Paths" first, then usual folders.
$cands = @()
foreach ($n in "msedge.exe", "chrome.exe", "brave.exe") {
  foreach ($hive in "HKLM", "HKCU") {
    $v = (Get-ItemProperty "${hive}:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$n" -ErrorAction SilentlyContinue).'(default)'
    if ($v) { $cands += $v }
  }
  $cands += "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe", "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe", "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe"
}
$edge = $cands | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($edge) { $r.edge_found = $true; $r.browser = (Split-Path $edge -Leaf); $r.edge_version = (Get-Item $edge).VersionInfo.ProductVersion }

# 2. Security context
$r.antivirus_products = Try-Get { @(Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct | ForEach-Object { $_.displayName }) }
$r.defender = Try-Get { $m = Get-MpComputerStatus -ErrorAction Stop; [ordered]@{ service = $m.AMServiceEnabled; realtime = $m.RealTimeProtectionEnabled; signatures = $m.AntivirusSignatureVersion } }
if ("$($r.defender)" -like "n/a*") { $r.defender_service = Try-Get { (Get-Service WinDefend -ErrorAction Stop).Status.ToString() } }
$r.exe_present = Test-Path $exe
if (-not $r.exe_present) { Write-Host "u1-doctor.exe introuvable a cote du dossier test-kit. Arret." -ForegroundColor Red; $r | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $outDir "report.json") -Encoding utf8; exit 1 }
$r.exe_sha256 = (Get-FileHash $exe -Algorithm SHA256).Hash
$r.exe_size_bytes = (Get-Item $exe).Length
$hasZone = @(Get-Item $exe -Stream * -ErrorAction SilentlyContinue | Where-Object { $_.Stream -eq "Zone.Identifier" }).Count -gt 0
$zone = if ($hasZone) { (Get-Content $exe -Stream Zone.Identifier -ErrorAction SilentlyContinue | Where-Object { $_ -like "ZoneId=*" }) } else { $null }
$r.exe_zone_identifier = if ($zone) { "$zone" } else { "none (no download mark: SmartScreen cannot have triggered)" }
if (-not $zone) {
  Write-Host "ATTENTION : ce programme n'a PAS la marque 'telecharge d'Internet'. SmartScreen n'a donc pas pu se declencher : ce test ne le verifie pas." -ForegroundColor Yellow
  Write-Host "Pour le verifier : telechargez le zip avec un navigateur (pas de cle USB, pas de copie reseau) et extrayez-le avec 'Extraire tout' de l'Explorateur." -ForegroundColor Yellow
  Write-Host ""
}
$r.exe_signature = Try-Get { (Get-AuthenticodeSignature $exe).Status.ToString() }

# 3. Questions (about the manual double-click done BEFORE this test)
$q = [ordered]@{}
if (-not $NoQuestions) {
  Write-Host "4 questions sur le double-clic manuel fait AVANT ce test (repondez o = oui, n = non, ? = pas teste) :" -ForegroundColor Cyan
  $q.smartscreen_blue_screen = Read-Host "1/4 Un ecran bleu 'Windows a protege votre ordinateur' est-il apparu ? (o/n/?)"
  $q.smartscreen_text = if ($q.smartscreen_blue_screen -eq "o") { Read-Host "    Recopiez le titre / le nom de l'editeur affiche (1 ligne)" } else { "" }
  $q.antivirus_alert = Read-Host "2/4 Windows Defender ou un antivirus a-t-il bloque, supprime ou signale le fichier ? (o/n/?)"
  $q.antivirus_text = if ($q.antivirus_alert -eq "o") { Read-Host "    Que disait le message ? (1 ligne)" } else { "" }
  $q.firewall_prompt = Read-Host "3/4 Le pare-feu Windows a-t-il demande une autorisation (reseau prive/public) ? (o/n/?)"
  $q.free_comment = Read-Host "4/4 Autre chose a signaler ? (1 ligne, ou Entree)"
}
$r.answers = $q

# 4. Start the exe (local only, temp database)
$env:U1DOCTOR_PORT = "$Port"
$env:U1DOCTOR_HEADLESS = "1"  # server only: the window itself is what the owner checks by hand (LISEZ-MOI step 2)
$env:U1DOCTOR_DB = Join-Path $env:TEMP "u1doctor-test-$stamp.sqlite3"
$sw = [Diagnostics.Stopwatch]::StartNew()
$proc = Start-Process -FilePath $exe -WorkingDirectory (Split-Path $exe -Parent) -PassThru -WindowStyle Minimized -RedirectStandardError (Join-Path $outDir "exe-stderr.log") -RedirectStandardOutput (Join-Path $outDir "exe-stdout.log")
$base = "http://127.0.0.1:$Port"
$up = $false
for ($i = 0; $i -lt 90 -and -not $up; $i++) {
  Start-Sleep -Milliseconds 500
  if ($proc.HasExited) { break }
  try { $null = Invoke-RestMethod "$base/api/v1/health" -TimeoutSec 2; $up = $true } catch {}
}
$r.start = [ordered]@{ healthy = $up; seconds_to_health = [math]::Round($sw.Elapsed.TotalSeconds, 1); exited_early = $proc.HasExited }
$r.listening = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | ForEach-Object { "$($_.LocalAddress):$($_.LocalPort)" })
$r.firewall_rules_for_exe = Try-Get { @(Get-NetFirewallApplicationFilter -ErrorAction Stop | Where-Object { $_.Program -like "*u1-doctor*" } | ForEach-Object { $_.Program -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%" }).Count }

# 5. API checks
function Http($method, $path, $body, $ct) {
  try {
    $a = @{ Uri = "$base$path"; Method = $method; UseBasicParsing = $true; TimeoutSec = 20; Headers = @{ "X-U1D" = "1" } }  # app header: required on every non-GET request
    if ($null -ne $body) { $a.Body = $body; $a.ContentType = $ct }
    $x = Invoke-WebRequest @a
    return [ordered]@{ status = [int]$x.StatusCode; bytes = $x.RawContentLength; text = $x.Content }
  } catch {
    $s = 0; if ($_.Exception.Response) { $s = [int]$_.Exception.Response.StatusCode }
    return [ordered]@{ status = $s; error = $_.Exception.Message; text = "" }
  }
}
$api = [ordered]@{}
if ($up) {
  foreach ($p in "/api/v1/health", "/", "/api/v1/compatibility", "/api/v1/knowledge/known-issues", "/api/v1/knowledge/symptoms", "/api/v1/rulesets", "/api/v1/demo/scenarios") {
    $x = Http "GET" $p $null $null; $api[$p] = [ordered]@{ status = $x.status; bytes = $x.bytes; error = $x.error }
  }
  $h = Http "GET" "/api/v1/health" $null $null; $r.health_json = $h.text
  $sc = @((Http "GET" "/api/v1/demo/scenarios" $null $null).text | ConvertFrom-Json).scenarios
  $match = 0; $failed = @()
  foreach ($s in $sc) {
    $x = Http "POST" "/api/v1/replays" (@{ scenario = $s } | ConvertTo-Json) "application/json"
    $ok = $false; if ($x.status -eq 200) { $ok = [bool](($x.text | ConvertFrom-Json).matches_golden) }
    if ($ok) { $match++ } else { $failed += $s }
  }
  $api.replays = [ordered]@{ scenarios = @($sc).Count; matching_golden = $match; not_matching = $failed }
  $zip = Join-Path $kit "example-synthetic-known-code-feeder3.u1deb.zip"
  if (Test-Path $zip) {
    $x = Http "POST" "/api/v1/bundles/import" ([IO.File]::ReadAllBytes($zip)) "application/zip"
    $api.bundle_import = [ordered]@{ status = $x.status; error = $x.error }
  }
}
$r.api = $api

# 6. Screenshots of the 11 screens (headless Edge, own profile, nothing saved elsewhere)
$shots = [ordered]@{}
if ($up -and $edge) {
  $prof = Join-Path $env:TEMP "u1doctor-edge-$stamp"
  $routes = "welcome", "connect", "overview", "explorer", "symptoms", "timeline", "findings", "evidence", "replay", "report", "settings"
  $n = 0
  foreach ($rt in $routes) {
    $n++; $png = Join-Path $outDir ("{0:00}-{1}.png" -f $n, $rt)
    $ep = Start-Process -FilePath $edge -ArgumentList @("--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--user-data-dir=`"$prof`"", "--window-size=1440,900", "--virtual-time-budget=12000", "--screenshot=`"$png`"", "$base/#/$rt") -PassThru -WindowStyle Hidden
    if (-not $ep.WaitForExit(45000)) { try { $ep.Kill() } catch {} }
    $shots[$rt] = (Test-Path $png) -and ((Get-Item $png -ErrorAction SilentlyContinue).Length -gt 5000)
  }
  Remove-Item -Recurse -Force $prof -ErrorAction SilentlyContinue
}
$r.screenshots = $shots

# 7. Stop the app (the exe is a bootloader + a child: stop whatever listens on the port)
Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1
$r.stopped_cleanly = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue).Count -eq 0
Remove-Item $env:U1DOCTOR_DB -Force -ErrorAction SilentlyContinue
$r.finished_utc = (Get-Date).ToUniversalTime().ToString("o")

$json = Clean ($r | ConvertTo-Json -Depth 6)
Set-Content (Join-Path $outDir "report.json") $json -Encoding utf8
Set-Content (Join-Path $outDir "report.txt") $json -Encoding utf8
# Last safety net: scrub the app logs too (user name, computer name, profile path).
foreach ($f in Get-ChildItem $outDir -Filter *.log) { Set-Content $f.FullName (Clean (Get-Content $f.FullName -Raw)) -Encoding utf8 }
$zipOut = "$outDir.zip"
Compress-Archive -Path "$outDir\*" -DestinationPath $zipOut -Force
Write-Host ""
Write-Host "Termine. Envoyez ce fichier :" -ForegroundColor Green
Write-Host $zipOut
Write-Host "(Vous pouvez l'ouvrir avant : il ne contient ni nom, ni chemin, ni fichier personnel.)"
Write-Host ""
Write-Host "Vous pouvez maintenant supprimer le dossier u1-doctor et ce kit."
if (-not $NoQuestions) { Read-Host "Appuyez sur Entree pour fermer" | Out-Null }
