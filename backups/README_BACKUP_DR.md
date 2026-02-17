# RentalOS — Backup & Disaster Recovery (Production)

This folder contains the **production-grade backup + restore system** for RentalOS.

## ✅ Goals

- Daily automated backup (Windows Task Scheduler)
- PostgreSQL dump (custom format, pg_restore compatible)
- Local storage/config snapshots
- Manifest + sha256 integrity
- Encrypted upload to Cloudflare R2 via rclone
- Email notification via Brevo SMTP
- Full Disaster Recovery restore possible anytime

---

## 📌 Backup Components

### Scripts

| File | Role |
|------|------|
| `backup.ps1` | Main daily backup orchestration |
| `restore_from_r2.ps1` | Disaster Recovery restore from R2 |

### Ignored (never committed)

- dumps (`*.dump`)
- archives (`*.zip`)
- logs
- secrets (`backups/secrets/`)

---

## 🗄 PostgreSQL Dump Format

Backup uses **custom pg_dump format**:

- Generated inside container (binary safe)
- Verified header: `PGDMP`
- Restorable with `pg_restore`

Example:

```bash
docker compose exec -T postgres sh -lc \
  "pg_dump -U rentalos -Fc rentalos -f /tmp/rentalos.dump"
