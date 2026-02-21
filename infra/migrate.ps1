Param(
  [string]$ComposeFile = "infra/docker-compose.yml",
  [string]$PostgresService = "postgres",
  [string]$InitDir = "infra/postgres-init",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Exec([string]$cmd) {
  Write-Host ">> $cmd"
  $out = cmd /c $cmd
  return $out
}

function ExecLines([string]$cmd) {
  $out = Exec $cmd
  return ($out -split "`r?`n") | Where-Object { $_.Trim() -ne "" }
}

# 1) Ensure postgres is up
Exec "docker compose -f $ComposeFile up -d $PostgresService" | Out-Null

# 2) Wait for pg_isready
Write-Host "Waiting for Postgres..."
for ($i=0; $i -lt 60; $i++) {
  try {
    $ready = Exec "docker compose -f $ComposeFile exec -T $PostgresService pg_isready -U `$POSTGRES_USER" 2>$null
    if ($ready -match "accepting connections") { break }
  } catch {}
  Start-Sleep -Seconds 1
}
Write-Host "Postgres ready."

# 3) Ensure schema_migrations table exists (apply 000 if present)
$schemaFile = Join-Path $InitDir "000_schema_migrations.sql"
if (Test-Path $schemaFile) {
  if ($DryRun) {
    Write-Host "[DRYRUN] Would apply: $schemaFile"
  } else {
    Exec "docker compose -f $ComposeFile exec -T $PostgresService psql -U `$POSTGRES_USER -d `$POSTGRES_DB -v ON_ERROR_STOP=1 < `"$schemaFile`"" | Out-Null
  }
}

# 4) List sql files (sorted)
$files = Get-ChildItem -Path $InitDir -Filter "*.sql" | Sort-Object Name
if ($files.Count -eq 0) {
  Write-Host "No .sql files found in $InitDir"
  exit 0
}

# 5) Fetch applied filenames
$applied = @{}
try {
  $lines = ExecLines "docker compose -f $ComposeFile exec -T $PostgresService psql -U `$POSTGRES_USER -d `$POSTGRES_DB -t -A -c `"SELECT filename FROM schema_migrations;`""
  foreach ($l in $lines) { $applied[$l.Trim()] = $true }
} catch {
  Write-Host "schema_migrations not found. Ensure 000_schema_migrations.sql exists and re-run."
  throw
}

# 6) Apply missing migrations
$toApply = @()
foreach ($f in $files) {
  $name = $f.Name
  if (-not $applied.ContainsKey($name)) {
    $toApply += $f.FullName
  }
}

if ($toApply.Count -eq 0) {
  Write-Host "✅ No pending migrations."
  exit 0
}

Write-Host "Pending migrations:"
$toApply | ForEach-Object { Write-Host " - $_" }

foreach ($full in $toApply) {
  $name = Split-Path $full -Leaf
  if ($DryRun) {
    Write-Host "[DRYRUN] Would apply: $name"
    continue
  }

  Write-Host "Applying $name ..."
  # Apply file
  Exec "docker compose -f $ComposeFile exec -T $PostgresService psql -U `$POSTGRES_USER -d `$POSTGRES_DB -v ON_ERROR_STOP=1 < `"$full`"" | Out-Null

  # Record application
  Exec "docker compose -f $ComposeFile exec -T $PostgresService psql -U `$POSTGRES_USER -d `$POSTGRES_DB -v ON_ERROR_STOP=1 -c `"INSERT INTO schema_migrations(filename) VALUES ('$name') ON CONFLICT DO NOTHING;`"" | Out-Null
}

Write-Host "✅ Migrations applied successfully."