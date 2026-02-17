param(
  [int]$KeepDaysLocal = 30,
  [int]$KeepDaysRemote = 90,

  [string]$InfraPath = "C:\rentalos\infra",
  [string]$BackupRoot = "C:\rentalos\backups",
  [string]$OffsitePath = "D:\RentalOS_Backups", # USB

  [string]$RcloneRemote = "r2crypt:rentalos-backups",

  # --- Email (Brevo SMTP) ---
  # EmailMode:
  #   - "FailOnly" (prod recommended): send email only if backup FAILED
  #   - "All": send email on OK + FAILED
  [ValidateSet("FailOnly","All")]
  [string]$EmailMode = "FailOnly",

  [bool]$EmailEnabled = $true,
  [string]$EmailTo = "bensalem.diourieloulam@gmail.com",
  [string]$SmtpHost = "smtp-relay.brevo.com",
  [int]$SmtpPort = 587,
  [string]$SmtpFromEmail = "no-reply@rentalos.fr",
  [string]$SmtpFromName = "RentalOS",
  [string]$SmtpCredFile = "C:\rentalos\backups\secrets\brevo_smtp_cred.xml",

  # --- Robust ---
  [int]$PgWaitSeconds = 60,

  # --- Healthcheck ---
  [switch]$HealthcheckEnabled,
  [string]$HealthcheckSql = "select count(*) from leases;",
  [int]$HealthcheckMinRows = 1,

  # --- Remote retention ---
  [bool]$RemoteRetentionDryRun = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Dir([string]$p) {
  if (!(Test-Path $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
}

function NowStamp() { return (Get-Date).ToString("yyyyMMdd_HHmmss") }

function Cleanup-OldFiles([string]$path, [int]$days) {
  if (!(Test-Path $path)) { return }
  Get-ChildItem -Path $path -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$days) } |
    ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
}

function Sha256File([string]$path) { return (Get-FileHash -Algorithm SHA256 -Path $path).Hash.ToLower() }

function Write-Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Step($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Ok($msg)   { Write-Host $msg -ForegroundColor Green }
function Write-Warn($msg) { Write-Host $msg -ForegroundColor DarkYellow }
function Write-Err($msg)  { Write-Host $msg -ForegroundColor Red }

# =========================
# SMTP (Brevo)
# =========================
function Load-SmtpCredential([string]$path) {
  if (!(Test-Path $path)) { throw "SMTP credential file not found: $path" }
  $c = Import-Clixml -Path $path
  if ($null -eq $c -or $null -eq $c.UserName) { throw "SMTP credential file invalid: $path" }
  $p = $c.GetNetworkCredential().Password
  if ([string]::IsNullOrWhiteSpace($p)) { throw "SMTP credential file invalid (empty password): $path" }
  return $c
}

function Try-SendBackupMail([string]$Subject, [string]$Body) {
  if (-not $EmailEnabled) { return }

  try {
    $cred = Load-SmtpCredential $SmtpCredFile

    # Force TLS 1.2 for PS 5.1 / .NET Framework
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

    $smtp = New-Object System.Net.Mail.SmtpClient($SmtpHost, $SmtpPort)
    $smtp.EnableSsl = $true
    $smtp.DeliveryMethod = [System.Net.Mail.SmtpDeliveryMethod]::Network
    $smtp.UseDefaultCredentials = $false
    $smtp.Credentials = New-Object System.Net.NetworkCredential(
      $cred.UserName,
      $cred.GetNetworkCredential().Password
    )

    $mail = New-Object System.Net.Mail.MailMessage
    $mail.From = New-Object System.Net.Mail.MailAddress($SmtpFromEmail, $SmtpFromName)
    $mail.To.Add($EmailTo) | Out-Null
    $mail.Subject = $Subject
    $mail.Body = $Body
    $mail.IsBodyHtml = $false
    $mail.BodyEncoding = [System.Text.Encoding]::UTF8
    $mail.SubjectEncoding = [System.Text.Encoding]::UTF8

    $smtp.Send($mail)
    Write-Ok "Email sent to $EmailTo"
  }
  catch {
    # IMPORTANT: do NOT fail backup because email failed
    Write-Warn "Email send failed: $($_.Exception.Message)"
  }
  finally {
    if ($smtp) { $smtp.Dispose() }
    if ($mail) { $mail.Dispose() }
  }
}

# =========================
# Postgres robust check
# =========================
function Ensure-PostgresUp {
  Write-Step "`n[0/5] Ensure postgres is up..."
  Push-Location $InfraPath
  try {
    docker compose up -d postgres | Out-Null
    Start-Sleep -Seconds 2

    $deadline = (Get-Date).AddSeconds($PgWaitSeconds)
    while ((Get-Date) -lt $deadline) {
      try {
        docker compose exec -T postgres pg_isready -U rentalos -d rentalos | Out-Null
        Write-Host " Container postgres Running"
        return
      } catch {
        Start-Sleep -Seconds 2
      }
    }
    throw "Postgres not ready after ${PgWaitSeconds}s"
  }
  finally { Pop-Location }
}

function Invoke-DbScalar([string]$sql) {
  Push-Location $InfraPath
  try {
    # -tA => tuples only, unaligned (just the value)
    $out = docker compose exec -T postgres psql -U rentalos -d rentalos -v ON_ERROR_STOP=1 -tA -c $sql
    return ($out | Out-String).Trim()
  }
  finally { Pop-Location }
}

function Verify-RemoteExists([string]$remoteFile) {
  # rclone lsf returns the filename if exists; throws on auth/other errors
  $name = rclone lsf $remoteFile 2>$null
  if ([string]::IsNullOrWhiteSpace($name)) {
    throw "Remote file not found on R2: $remoteFile"
  }
}

# --- logging
Ensure-Dir $BackupRoot
$logDir = Join-Path $BackupRoot "logs"
Ensure-Dir $logDir

$stamp = NowStamp
$logFile = Join-Path $logDir ("backup_" + $stamp + ".log")
Start-Transcript -Path $logFile -Append | Out-Null

$backupSucceeded = $false
$remotePath = $null

$dbDump = $null; $dbSchema = $null; $stFile = $null; $cfgFile = $null
$manifest = $null; $manifestSha = $null

try {
  Write-Info "=== RentalOS Backup ==="
  Write-Host "InfraPath          : $InfraPath"
  Write-Host "BackupRoot         : $BackupRoot"
  Write-Host "KeepDaysLocal       : $KeepDaysLocal"
  Write-Host "KeepDaysRemote      : $KeepDaysRemote"
  Write-Host "OffsitePath         : $OffsitePath"
  Write-Host "RcloneRemote        : $RcloneRemote"
  Write-Host "EmailEnabled        : $EmailEnabled"
  Write-Host "EmailMode           : $EmailMode"
  Write-Host "HealthcheckEnabled  : $HealthcheckEnabled"

  Ensure-PostgresUp

  # Paths
  $dbDir = Join-Path $BackupRoot "db"
  $stDir = Join-Path $BackupRoot "storage"
  $cfgDir = Join-Path $BackupRoot "config"
  Ensure-Dir $dbDir; Ensure-Dir $stDir; Ensure-Dir $cfgDir

  # Filenames
  $dbDumpFile   = Join-Path $dbDir ("rentalos_db_" + $stamp + ".dump")
  $dbSchemaFile = Join-Path $dbDir ("rentalos_schema_" + $stamp + ".sql")
  $stFile       = Join-Path $stDir ("rentalos_storage_" + $stamp + ".zip")
  $cfgFile      = Join-Path $cfgDir ("rentalos_config_" + $stamp + ".zip")
  $manifest     = Join-Path $BackupRoot ("manifest_" + $stamp + ".json")
  $manifestSha  = Join-Path $BackupRoot ("manifest_" + $stamp + ".sha256")

  # Optional git hash
  $gitHash = ""
  try {
    Push-Location (Split-Path $InfraPath -Parent)
    $gitHash = (git rev-parse --short HEAD 2>$null)
  } catch { $gitHash = "" } finally { Pop-Location }

  # --- 1) DB dump (binaire safe)
  Write-Step "`n[1/5] Export DB (custom dump + schema) -> $dbDir"
  Push-Location $InfraPath
  try {
    $pgId = (docker compose ps -q postgres)
    if ([string]::IsNullOrWhiteSpace($pgId)) {
      throw "Postgres container not found (docker compose ps -q postgres returned empty)"
    }

    docker compose exec -T postgres sh -lc "pg_dump -U rentalos -d rentalos -Fc --no-owner --no-privileges -f /tmp/rentalos.dump"
    docker compose exec -T postgres sh -lc "pg_dump -U rentalos -d rentalos --schema-only --no-owner --no-privileges -f /tmp/rentalos_schema.sql"

    docker cp "${pgId}:/tmp/rentalos.dump" $dbDumpFile
    docker cp "${pgId}:/tmp/rentalos_schema.sql" $dbSchemaFile

    docker compose exec -T postgres sh -lc "rm -f /tmp/rentalos.dump /tmp/rentalos_schema.sql"
  }
  finally { Pop-Location }

  if (!(Test-Path $dbDumpFile) -or ((Get-Item $dbDumpFile).Length -lt 1024)) {
    throw "DB dump seems too small or missing: $dbDumpFile"
  }

  $hdr = [System.Text.Encoding]::ASCII.GetString([System.IO.File]::ReadAllBytes($dbDumpFile)[0..4])
  if ($hdr -ne "PGDMP") {
    throw "DB custom dump header invalid (expected PGDMP). Got: '$hdr' File: $dbDumpFile"
  }

  if (!(Test-Path $dbSchemaFile) -or ((Get-Item $dbSchemaFile).Length -lt 200)) {
    throw "DB schema seems too small or missing: $dbSchemaFile"
  }

  # Smoke check pg_restore can read it
  Push-Location $InfraPath
  try {
    $pgId2 = (docker compose ps -q postgres)
    docker cp "$dbDumpFile" "${pgId2}:/tmp/_check.dump" | Out-Null
    docker compose exec -T postgres sh -lc "pg_restore -l /tmp/_check.dump > /dev/null"
    docker compose exec -T postgres sh -lc "rm -f /tmp/_check.dump"
  }
  finally { Pop-Location }

  $dbDump = $dbDumpFile
  $dbSchema = $dbSchemaFile

  # --- 2) Optional DB healthcheck (post dump)
  Write-Step "`n[2/5] Healthcheck DB (post dump)"
  if ($HealthcheckEnabled) {
    $val = Invoke-DbScalar $HealthcheckSql
    if ($val -notmatch '^\d+$') {
      throw "Healthcheck returned non-numeric value: '$val' (sql=$HealthcheckSql)"
    }
    $n = [int]$val
    Write-Host "Healthcheck result: $n"
    if ($n -lt $HealthcheckMinRows) {
      throw "Healthcheck failed: $n < $HealthcheckMinRows (sql=$HealthcheckSql)"
    }
  } else {
    Write-Warn "Healthcheck disabled"
  }

  # --- 3) Storage zip
  Write-Step "`n[3/5] Zip Storage -> $stFile"
  $storagePath = Join-Path $InfraPath "storage"
  Ensure-Dir $storagePath
  if (Test-Path $stFile) { Remove-Item $stFile -Force }
  Compress-Archive -Path (Join-Path $storagePath "*") -DestinationPath $stFile -Force

  # --- 4) Config zip
  Write-Step "`n[4/5] Zip Config -> $cfgFile"
  if (Test-Path $cfgFile) { Remove-Item $cfgFile -Force }

  $tmpCfg = Join-Path $env:TEMP ("rentalos_cfg_" + $stamp)
  Ensure-Dir $tmpCfg
  Copy-Item -Force (Join-Path $InfraPath "docker-compose.yml") $tmpCfg -ErrorAction SilentlyContinue
  Copy-Item -Recurse -Force (Join-Path $InfraPath "postgres-init") $tmpCfg -ErrorAction SilentlyContinue
  Copy-Item -Force (Join-Path $InfraPath ".env.example") $tmpCfg -ErrorAction SilentlyContinue

  # note: if you prefer not to archive .env in backups, set this to skip
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

  # --- 5) Manifest + checksums
  Write-Step "`n[5/5] Manifest -> $manifest"

  $items = @(
    @{ name="db_dump";   path=$dbDump;   sha256=(Sha256File $dbDump);   size=(Get-Item $dbDump).Length },
    @{ name="db_schema"; path=$dbSchema; sha256=(Sha256File $dbSchema); size=(Get-Item $dbSchema).Length },
    @{ name="storage";   path=$stFile;   sha256=(Sha256File $stFile);   size=(Get-Item $stFile).Length },
    @{ name="config";    path=$cfgFile;  sha256=(Sha256File $cfgFile);  size=(Get-Item $cfgFile).Length }
  )

  $meta = [ordered]@{
    stamp = $stamp
    git = $gitHash
    host = $env:COMPUTERNAME
    user = $env:USERNAME
    created_at = (Get-Date).ToString("s")
    files = $items
  }

  ($meta | ConvertTo-Json -Depth 6) | Out-File -FilePath $manifest -Encoding utf8
  $manifestHash = Sha256File $manifest
  "$manifestHash $(Split-Path $manifest -Leaf)" | Out-File -FilePath $manifestSha -Encoding ascii

  # Local retention
  Write-Step "`n[Cleanup] Local retention older than $KeepDaysLocal days"
  Cleanup-OldFiles $dbDir $KeepDaysLocal
  Cleanup-OldFiles $stDir $KeepDaysLocal
  Cleanup-OldFiles $cfgDir $KeepDaysLocal
  Cleanup-OldFiles $logDir $KeepDaysLocal
  Cleanup-OldFiles $BackupRoot $KeepDaysLocal

  # Offsite USB
  Write-Step "`n[Offsite] Copy backups to USB (if available)"
  try {
    if (Test-Path "D:\") {
      Ensure-Dir $OffsitePath
      robocopy $BackupRoot $OffsitePath /MIR /R:1 /W:1 | Out-Null
      Write-Ok "✅ Offsite copy OK -> $OffsitePath"
    } else {
      Write-Warn "⚠ USB drive D:\ not available, skipping offsite copy"
    }
  } catch {
    Write-Warn "⚠ Offsite copy failed (local kept). Error: $($_.Exception.Message)"
  }

  # Upload to R2
  Write-Step "`n[R2] Upload to $RcloneRemote"
  $remotePath = "$RcloneRemote/daily/$((Get-Date).ToString('yyyy/MM/dd'))/$stamp"

  rclone copy "$dbDump"      "$remotePath/db/"      --checksum --retries 5 --retries-sleep 2s --transfers 2 --checkers 4
  rclone copy "$dbSchema"    "$remotePath/db/"      --checksum --retries 5 --retries-sleep 2s --transfers 2 --checkers 4
  rclone copy "$stFile"      "$remotePath/storage/" --checksum --retries 5 --retries-sleep 2s --transfers 2 --checkers 4
  rclone copy "$cfgFile"     "$remotePath/config/"  --checksum --retries 5 --retries-sleep 2s --transfers 2 --checkers 4
  rclone copy "$manifest"    "$remotePath/"         --checksum
  rclone copy "$manifestSha" "$remotePath/"         --checksum

  # Verify remote existence (anti false-positive)
  Write-Step "`n[R2] Verify remote artifacts exist"
  Verify-RemoteExists "$remotePath/$(Split-Path $manifest -Leaf)"
  Verify-RemoteExists "$remotePath/db/$(Split-Path $dbDump -Leaf)"

  # Remote retention
  Write-Step "`n[R2] Retention remote older than $KeepDaysRemote days (best effort)"
  try {
    $args = @("$RcloneRemote/daily","--min-age","${KeepDaysRemote}d","--rmdirs")
    if ($RemoteRetentionDryRun) { $args += "--dry-run" }
    & rclone delete @args | Out-Null
  } catch {
    Write-Warn "⚠ Remote retention skipped: $($_.Exception.Message)"
  }

  Write-Ok "`n✅ Backup OK"
  Write-Host "DB dump  : $dbDump"
  Write-Host "DB schema: $dbSchema"
  Write-Host "Storage  : $stFile"
  Write-Host "Config   : $cfgFile"
  Write-Host "Manifest : $manifest"
  Write-Host "Log      : $logFile"
  Write-Host "Remote   : $remotePath"

  $backupSucceeded = $true
}
catch {
  $backupSucceeded = $false
  Write-Err "`n❌ Backup FAILED: $($_.Exception.Message)"
}
finally {
  try {
    $shouldEmail =
      $EmailEnabled -and (
        ($EmailMode -eq "All") -or
        (($EmailMode -eq "FailOnly") -and (-not $backupSucceeded))
      )

    if ($shouldEmail) {
      if ($backupSucceeded) {
        $subject = "✅ RentalOS Backup OK - $stamp"
        $body = @"
Backup OK
Stamp: $stamp
Host : $($env:COMPUTERNAME)

R2   : $remotePath
Log  : $logFile
"@
      } else {
        $subject = "❌ RentalOS Backup FAILED - $stamp"
        $body = @"
Backup FAILED
Stamp: $stamp
Host : $($env:COMPUTERNAME)
Log  : $logFile
"@
      }

      Try-SendBackupMail -Subject $subject -Body $body
    } else {
      Write-Host "Email skipped (EmailMode=$EmailMode, success=$backupSucceeded)" -ForegroundColor DarkGray
    }
  } catch {
    Write-Warn "Email send failed (unexpected): $($_.Exception.Message)"
  }

  Stop-Transcript | Out-Null

  # IMPORTANT: exit code = success of backup itself (not email)
  if ($backupSucceeded) { exit 0 } else { exit 1 }
}
