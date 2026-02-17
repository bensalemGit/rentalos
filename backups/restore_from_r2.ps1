param(
  [string]$RemoteRoot = "r2crypt:rentalos-backups",
  [string]$WorkDir    = "C:\rentalos\_dr_work",
  [string]$InfraPath  = "C:\rentalos\infra"
)

$ErrorActionPreference = "Stop"

function Ensure-Dir($p) {
  if (!(Test-Path $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
}

function Sha256File($path) {
  return (Get-FileHash -Algorithm SHA256 -Path $path).Hash.ToLower()
}

function Get-ManifestFileEntry($meta, [string]$name) {
  $e = $meta.files | Where-Object { $_.name -eq $name } | Select-Object -First 1
  if (!$e) { throw "Manifest missing file entry '$name' in meta.files[]" }
  return $e
}

Write-Host "=== DR Restore from R2 ===" -ForegroundColor Cyan
Write-Host "Remote: $RemoteRoot"
Write-Host "Work  : $WorkDir"
Write-Host "Infra : $InfraPath"

Ensure-Dir $WorkDir

# --- [1/7] Find latest manifest_*.json
Write-Host "`n[1/7] Find latest manifest on R2..." -ForegroundColor Yellow
$manifests = rclone lsf "$RemoteRoot/daily" -R --files-only --include "manifest_*.json"
if (!$manifests) { throw "No manifest_*.json found under $RemoteRoot/daily" }

$latestRel = ($manifests | Sort-Object)[-1].Trim()          # ex: 2026/02/17/20260217_024745/manifest_20260217_024745.json
$latestRemote = "$RemoteRoot/daily/$latestRel"
Write-Host "Latest manifest: $latestRemote" -ForegroundColor Green

# Base snapshot dir (parent of manifest file)
$baseRemoteDir = ($latestRemote -replace '/manifest_.*\.json$','')
if ($baseRemoteDir -eq $latestRemote) { throw "Could not compute baseRemoteDir from: $latestRemote" }

# Stamp from filename
if ($latestRemote -notmatch 'manifest_(\d{8}_\d{6})\.json$') { throw "Cannot extract stamp from $latestRemote" }
$stamp = $Matches[1]
Write-Host "Stamp: $stamp" -ForegroundColor Green
Write-Host "Base : $baseRemoteDir" -ForegroundColor Green

# Dedicated download dir per restore
$dlDir = Join-Path $WorkDir ("restore_" + $stamp)
Ensure-Dir $dlDir
Ensure-Dir (Join-Path $dlDir "db")
Ensure-Dir (Join-Path $dlDir "storage")
Ensure-Dir (Join-Path $dlDir "config")

# --- [2/7] Download manifest (+ sha if exists)
Write-Host "`n[2/7] Download manifest..." -ForegroundColor Yellow
$localManifest = Join-Path $dlDir "manifest.json"
$localManifestSha = Join-Path $dlDir "manifest.sha256"

rclone copyto "$latestRemote" "$localManifest" -v
# sha256 file is optional
$remoteSha = ($latestRemote -replace '\.json$','.sha256')
try { rclone copyto "$remoteSha" "$localManifestSha" -v } catch { }

$meta = Get-Content $localManifest -Raw | ConvertFrom-Json

# --- [3/7] Compute remote artifacts from manifest + base dir
Write-Host "`n[3/7] Resolve artifact paths..." -ForegroundColor Yellow
$dbEntry  = Get-ManifestFileEntry $meta "db_dump"
$stEntry  = Get-ManifestFileEntry $meta "storage"
$cfgEntry = Get-ManifestFileEntry $meta "config"

# We rebuild remote paths using known folder layout on R2
$dbRemote  = "$baseRemoteDir/db/rentalos_db_${stamp}.dump"
$stRemote  = "$baseRemoteDir/storage/rentalos_storage_${stamp}.zip"
$cfgRemote = "$baseRemoteDir/config/rentalos_config_${stamp}.zip"

$dbLocal  = Join-Path (Join-Path $dlDir "db")      ("rentalos_db_${stamp}.dump")
$stLocal  = Join-Path (Join-Path $dlDir "storage") ("rentalos_storage_${stamp}.zip")
$cfgLocal = Join-Path (Join-Path $dlDir "config")  ("rentalos_config_${stamp}.zip")

Write-Host "DB    : $dbRemote"  -ForegroundColor DarkGray
Write-Host "STORE : $stRemote"  -ForegroundColor DarkGray
Write-Host "CFG   : $cfgRemote" -ForegroundColor DarkGray

# --- [4/7] Download artifacts
Write-Host "`n[4/7] Download artifacts..." -ForegroundColor Yellow
rclone copyto "$dbRemote"  "$dbLocal"  -v
rclone copyto "$stRemote"  "$stLocal"  -v
# config is optional (can fail if you decided not to upload it)
try { rclone copyto "$cfgRemote" "$cfgLocal" -v } catch { }

# --- Verify sha256 (from manifest)
Write-Host "`n[5/7] Verify checksums..." -ForegroundColor Yellow

# Header check (must start with PGDMP)
$hdr = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($dbLocal)[0..4])
if ($hdr -ne "PGDMP") { throw "DB dump header invalid (expected PGDMP). Got '$hdr' file=$dbLocal" }

if ((Sha256File $dbLocal) -ne $dbEntry.sha256) { throw "DB dump sha256 mismatch" }
if ((Sha256File $stLocal) -ne $stEntry.sha256) { throw "Storage zip sha256 mismatch" }
if (Test-Path $cfgLocal) {
  if ((Sha256File $cfgLocal) -ne $cfgEntry.sha256) { throw "Config zip sha256 mismatch" }
}

Write-Host "✅ Checksums OK" -ForegroundColor Green

# --- [6/7] Restore DB
Write-Host "`n[6/7] Restore DB..." -ForegroundColor Yellow
Push-Location $InfraPath
try {
  docker compose down | Out-Null
  docker compose up -d postgres | Out-Null
  docker compose exec -T postgres pg_isready -U rentalos -d rentalos | Out-Null

  # Reset schema
  docker compose exec -T postgres psql -U rentalos -d rentalos -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" | Out-Null

  # Copy dump into the actual postgres container (avoid hardcoding infra-postgres-1)
  $pgId = (docker compose ps -q postgres)
  if (!$pgId) { throw "Cannot resolve postgres container id" }

  docker cp "$dbLocal" "${pgId}:/tmp/restore.dump" | Out-Null

  # Restore
  docker compose exec -T postgres pg_restore -U rentalos -d rentalos --no-owner --no-privileges --exit-on-error /tmp/restore.dump | Out-Null

  # Smoke tests
  $tables = docker compose exec -T postgres psql -U rentalos -d rentalos -c "select count(*) from information_schema.tables where table_schema='public';"
  Write-Host $tables
  $leases = docker compose exec -T postgres psql -U rentalos -d rentalos -c "select count(*) from leases;"
  Write-Host $leases
}
finally { Pop-Location }

# --- [7/7] Restore storage
Write-Host "`n[7/7] Restore storage..." -ForegroundColor Yellow
$storagePath = Join-Path $InfraPath "storage"

# Backup current storage folder if exists
if (Test-Path $storagePath) {
  $bak = Join-Path $InfraPath ("storage_before_restore_" + $stamp)
  if (Test-Path $bak) { Remove-Item -Recurse -Force $bak -ErrorAction SilentlyContinue }
  Rename-Item $storagePath $bak -Force
}

Ensure-Dir $storagePath
Expand-Archive -Path $stLocal -DestinationPath $storagePath -Force

Write-Host "`n✅ DR Restore OK" -ForegroundColor Green
Write-Host "DB dump  : $dbLocal"
Write-Host "Storage  : $stLocal"
Write-Host "Config   : $cfgLocal"
Write-Host "Work dir : $dlDir"
