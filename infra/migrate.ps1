param(
  [switch]$Status,
  [switch]$Apply,
  [switch]$DryRun,

  # If you pass relative paths, they are resolved from the script folder (infra/)
  [string]$ComposeFile,
  [string]$PostgresService = "postgres",
  [string]$MigrationsDir,

  [string]$PgUser = "rentalos",
  [string]$PgDb   = "rentalos"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$msg) { throw $msg }

# --- Resolve defaults relative to this script (C:\rentalos\infra\migrate.ps1)
$InfraDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($ComposeFile)) { $ComposeFile = Join-Path $InfraDir "docker-compose.yml" }
if ([string]::IsNullOrWhiteSpace($MigrationsDir)) { $MigrationsDir = Join-Path $InfraDir "postgres-init" }

# Make ComposeFile/MigrationsDir absolute (docker compose -f uses host path)
$ComposeFile = (Resolve-Path $ComposeFile).Path
$MigrationsDir = (Resolve-Path $MigrationsDir).Path

function Quote-Arg([string]$a) {
  if ($a -eq $null) { return '""' }
  if ($a -notmatch '[\s"]') { return $a }
  $escaped = $a -replace '"','\"'
  return '"' + $escaped + '"'
}

function Invoke-Native {
  param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [Parameter(Mandatory=$true)][string[]]$ArgumentList
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FilePath
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.UseShellExecute        = $false
  $psi.CreateNoWindow         = $true
  # Ensure relative paths resolve from repo root (parent of infra)
  $psi.WorkingDirectory       = (Split-Path -Parent $InfraDir)

  # Windows PowerShell 5.1: build command-line string
  $psi.Arguments = ($ArgumentList | ForEach-Object { Quote-Arg $_ }) -join ' '

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()

  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()

  $all = @()
  if ($stdout) { $all += ($stdout -split "`r?`n") }
  if ($stderr) { $all += ($stderr -split "`r?`n") }

  return [pscustomobject]@{
    ExitCode = $p.ExitCode
    StdOut   = $stdout
    StdErr   = $stderr
    AllLines = $all
  }
}

function RunCompose {
  param(
    [Parameter(Mandatory=$true)]
    [string[]]$ComposeArgs,
    [switch]$Quiet
  )

  $res = Invoke-Native -FilePath "docker.exe" -ArgumentList (@("compose") + $ComposeArgs)
  if (-not $Quiet) {
    $res.AllLines | ForEach-Object { if ($_ -ne $null -and $_ -ne "") { Write-Host $_ } }
  }
  if ($res.ExitCode -ne 0) {
    throw "docker compose failed (exit=$($res.ExitCode)): docker compose $($ComposeArgs -join ' ')`n$($res.AllLines -join "`n")"
  }
  return $res.AllLines
}

function EnsurePostgresUp {
  RunCompose -ComposeArgs @("-f",$ComposeFile,"up","-d","--no-recreate",$PostgresService) -Quiet | Out-Null
}

function PsqlCmd {
  param([Parameter(Mandatory=$true)][string]$Sql)

  $args = @(
    "-f",$ComposeFile,
    "exec","-T",$PostgresService,
    "psql","-v","ON_ERROR_STOP=1",
    "-U",$PgUser,
    "-d",$PgDb,
    "-c",$Sql
  )

  RunCompose -ComposeArgs $args -Quiet
}

function PsqlMigrationFile {
  param([Parameter(Mandatory=$true)][string]$Filename)

  # Convention: postgres container mounts infra/postgres-init to /docker-entrypoint-initdb.d
  $containerPath = "/docker-entrypoint-initdb.d/$Filename"

  $args = @(
    "-f",$ComposeFile,
    "exec","-T",$PostgresService,
    "psql","-v","ON_ERROR_STOP=1",
    "-U",$PgUser,
    "-d",$PgDb,
    "-f",$containerPath
  )

  RunCompose -ComposeArgs $args -Quiet
}

function EnsureSchemaMigrations {
  # Your DB uses: schema_migrations(filename text primary key, applied_at timestamptz default now())
  PsqlCmd @"
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"@ | Out-Null
}

function GetApplied {
  $out = PsqlCmd "SELECT filename FROM schema_migrations ORDER BY filename;"
  $set = New-Object 'System.Collections.Generic.HashSet[string]'
  foreach ($l in $out) {
    $v = $l.Trim()
    if ($v) { [void]$set.Add($v) }
  }
  return $set
}

function GetMigrationFiles {
  if (-not (Test-Path $MigrationsDir)) { Fail "MigrationsDir introuvable: $MigrationsDir" }
  Get-ChildItem -Path $MigrationsDir -Filter "*.sql" | Sort-Object Name
}

function MarkApplied([string]$filename) {
  # filename is PK, so ON CONFLICT is safe
  PsqlCmd "INSERT INTO schema_migrations(filename, applied_at) VALUES ('$filename', NOW()) ON CONFLICT (filename) DO NOTHING;" | Out-Null
}

# --- main ---
if (-not ($Status -or $Apply -or $DryRun)) { $Status = $true }
if ([string]::IsNullOrWhiteSpace($PgUser)) { Fail "PgUser is empty. Use -PgUser rentalos or set POSTGRES_USER." }
if ([string]::IsNullOrWhiteSpace($PgDb))   { Fail "PgDb is empty. Use -PgDb rentalos or set POSTGRES_DB." }

EnsurePostgresUp
EnsureSchemaMigrations

$applied = GetApplied
$files = GetMigrationFiles

if ($Status) {
  Write-Host ""
  Write-Host "== Migration status =="
  foreach ($f in $files) {
    $mark = if ($applied.Contains($f.Name)) { "APPLIED " } else { "PENDING " }
    Write-Host ("{0}  {1}" -f $mark, $f.Name)
  }
  Write-Host ""
  exit 0
}

if ($DryRun) {
  Write-Host ""
  Write-Host "== Dry-run (will apply) =="
  foreach ($f in $files) {
    if (-not $applied.Contains($f.Name)) {
      Write-Host ("- {0}" -f $f.Name)
    }
  }
  Write-Host ""
  exit 0
}

if ($Apply) {
  $pending = @()
  foreach ($f in $files) {
    if (-not $applied.Contains($f.Name)) { $pending += $f }
  }

  if ($pending.Count -eq 0) {
    Write-Host "Nothing to apply."
    exit 0
  }

  Write-Host ""
  Write-Host "== Applying migrations =="

  foreach ($f in $pending) {
    Write-Host ""
    Write-Host ("--> Applying {0}" -f $f.Name)

    try {
      # Apply SQL file inside the container (mounted folder)
      PsqlMigrationFile $f.Name | ForEach-Object { if ($_ -ne "") { Write-Host $_ } }

      # Mark applied only after success
      MarkApplied $f.Name
      Write-Host ("    OK  {0}" -f $f.Name)
    }
    catch {
      Write-Host ("    FAIL {0}" -f $f.Name) -ForegroundColor Red
      throw
    }
  }

  Write-Host ""
  Write-Host "All pending migrations applied."
  Write-Host ""
  exit 0
}
