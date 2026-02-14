param(
  [int]$KeepDays = 30,
  [string]$InfraPath = "C:\rentalos\infra",
  [string]$BackupRoot = "C:\rentalos\backups",
  [string]$OffsitePath = "D:\RentalOS_Backups"   # ✅ USB key
)

$ErrorActionPreference = "Stop"

function Ensure-Dir($p) {
  if (!(Test-Path $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
}

function NowStamp() {
  return (Get-Date).ToString("yyyyMMdd_HHmmss")
}

function Cleanup-Old($path, $days) {
  if (!(Test-Path $path)) { return }
  Get-ChildItem -Path $path -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$days) } |
    ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
}

Write-Host "=== RentalOS Backup ===" -ForegroundColor Cyan
Write-Host "InfraPath   : $InfraPath"
Write-Host "BackupRoot  : $BackupRoot"
Write-Host "KeepDays    : $KeepDays"
Write-Host "OffsitePath : $OffsitePath"

# Paths
$dbDir = Join-Path $BackupRoot "db"
$stDir = Join-Path $BackupRoot "storage"
$cfgDir = Join-Path $BackupRoot "config"

Ensure-Dir $BackupRoot
Ensure-Dir $dbDir
Ensure-Dir $stDir
Ensure-Dir $cfgDir

$stamp = NowStamp
$dbFile = Join-Path $dbDir ("rentalos_db_" + $stamp + ".sql")
$stFile = Join-Path $stDir ("rentalos_storage_" + $stamp + ".zip")
$cfgFile = Join-Path $cfgDir ("rentalos_config_" + $stamp + ".zip")

# 1) DB dump
Write-Host "`n[1/3] Export DB -> $dbFile" -ForegroundColor Yellow
Push-Location $InfraPath
try {
  docker compose exec -T postgres pg_dump -U rentalos -d rentalos --no-owner --no-privileges > $dbFile
} finally {
  Pop-Location
}

if (!(Test-Path $dbFile) -or ((Get-Item $dbFile).Length -lt 1000)) {
  throw "DB dump seems too small or missing: $dbFile"
}

# 2) Storage zip
Write-Host "`n[2/3] Zip Storage -> $stFile" -ForegroundColor Yellow
$storagePath = Join-Path $InfraPath "storage"
Ensure-Dir $storagePath

if (Test-Path $stFile) { Remove-Item $stFile -Force }
Compress-Archive -Path (Join-Path $storagePath "*") -DestinationPath $stFile -Force

# 3) Config zip
Write-Host "`n[3/3] Zip Config -> $cfgFile" -ForegroundColor Yellow
if (Test-Path $cfgFile) { Remove-Item $cfgFile -Force }

$tmpCfg = Join-Path $env:TEMP ("rentalos_cfg_" + $stamp)
Ensure-Dir $tmpCfg

Copy-Item -Force (Join-Path $InfraPath "docker-compose.yml") $tmpCfg -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force (Join-Path $InfraPath "postgres-init") $tmpCfg -ErrorAction SilentlyContinue

Get-ChildItem -Path $InfraPath -Filter "*.env" -File -ErrorAction SilentlyContinue | ForEach-Object {
  Copy-Item -Force $_.FullName $tmpCfg -ErrorAction SilentlyContinue
}
if (Test-Path (Join-Path $InfraPath ".env")) {
  Copy-Item -Force (Join-Path $InfraPath ".env") $tmpCfg -ErrorAction SilentlyContinue
}

$cfDir = Join-Path $env:USERPROFILE ".cloudflared"
if (Test-Path $cfDir) {
  $dst = Join-Path $tmpCfg ".cloudflared"
  Ensure-Dir $dst
  Copy-Item -Recurse -Force (Join-Path $cfDir "*") $dst -ErrorAction SilentlyContinue
}

Compress-Archive -Path (Join-Path $tmpCfg "*") -DestinationPath $cfgFile -Force
Remove-Item -Recurse -Force $tmpCfg -ErrorAction SilentlyContinue

# Retention cleanup
Write-Host "`n[Cleanup] Remove backups older than $KeepDays days" -ForegroundColor Yellow
Cleanup-Old $dbDir $KeepDays
Cleanup-Old $stDir $KeepDays
Cleanup-Old $cfgDir $KeepDays

# Offsite copy (USB)
Write-Host "`n[Offsite] Copy latest backups to USB (if available)" -ForegroundColor Yellow
try {
  if (Test-Path "D:\") {
    Ensure-Dir $OffsitePath
    robocopy $BackupRoot $OffsitePath /MIR /R:1 /W:1 | Out-Null
    Write-Host "✅ Offsite copy OK -> $OffsitePath" -ForegroundColor Green
  } else {
    Write-Host "⚠ USB drive D:\ not available, skipping offsite copy" -ForegroundColor DarkYellow
  }
} catch {
  Write-Host "⚠ Offsite copy failed (backup local kept). Error: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

Write-Host "`n✅ Backup OK" -ForegroundColor Green
Write-Host "DB      : $dbFile"
Write-Host "Storage : $stFile"
Write-Host "Config  : $cfgFile"
