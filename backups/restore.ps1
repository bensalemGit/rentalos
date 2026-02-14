param(
  [Parameter(Mandatory=$true)][string]$DbSqlFile,
  [Parameter(Mandatory=$true)][string]$StorageZip,
  [string]$InfraPath = "C:\rentalos\infra"
)

$ErrorActionPreference = "Stop"

function Ensure-Dir($p) {
  if (!(Test-Path $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
}

Write-Host "=== RentalOS Restore ===" -ForegroundColor Cyan
Write-Host "InfraPath  : $InfraPath"
Write-Host "DB file    : $DbSqlFile"
Write-Host "StorageZip : $StorageZip"

if (!(Test-Path $DbSqlFile)) { throw "DB dump file not found: $DbSqlFile" }
if (!(Test-Path $StorageZip)) { throw "Storage zip not found: $StorageZip" }

# 1) Stop stack
Write-Host "`n[1/5] Stopping docker stack..." -ForegroundColor Yellow
Push-Location $InfraPath
try {
  docker compose down
} finally {
  Pop-Location
}

# 2) Start only postgres (for restore)
Write-Host "`n[2/5] Starting postgres..." -ForegroundColor Yellow
Push-Location $InfraPath
try {
  docker compose up -d postgres
} finally {
  Pop-Location
}

# 3) Restore DB
Write-Host "`n[3/5] Restoring DB..." -ForegroundColor Yellow

# We recreate schema by dropping public then restoring
# Use cmd type to pipe cleanly into docker (avoids encoding issues)
$cmd = "type `"$DbSqlFile`" | docker compose exec -T postgres psql -U rentalos -d rentalos"
Push-Location $InfraPath
try {
  docker compose exec -T postgres psql -U rentalos -d rentalos -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
  cmd /c $cmd
} finally {
  Pop-Location
}

# 4) Restore storage
Write-Host "`n[4/5] Restoring storage..." -ForegroundColor Yellow
$storagePath = Join-Path $InfraPath "storage"
Ensure-Dir $storagePath

# optional: backup current storage
$backupOld = Join-Path $InfraPath ("storage_before_restore_" + (Get-Date).ToString("yyyyMMdd_HHmmss"))
if (Test-Path $storagePath) {
  Rename-Item -Path $storagePath -NewName (Split-Path $backupOld -Leaf)
  Ensure-Dir $storagePath
}

Expand-Archive -Path $StorageZip -DestinationPath $storagePath -Force

# 5) Start full stack
Write-Host "`n[5/5] Starting full stack..." -ForegroundColor Yellow
Push-Location $InfraPath
try {
  docker compose up -d
} finally {
  Pop-Location
}

Write-Host "`n✅ Restore OK" -ForegroundColor Green
Write-Host "Old storage kept at: $backupOld"
