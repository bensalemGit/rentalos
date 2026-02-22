# RentalOS — Disaster Recovery Runbook (10 min Restore)

This document is the **emergency procedure** to restore RentalOS after:

- server crash
- database corruption
- accidental deletion
- failed upgrade
- ransomware / storage loss

Goal: **full restore in < 10 minutes**.

---

# 🚨 DR PRIORITY CHECKLIST

## Immediate actions

- [ ] Stop writes / users if system partially running
- [ ] Confirm Docker is installed and working
- [ ] Confirm rclone access to Cloudflare R2
- [ ] Confirm latest backup exists

---

# 1️⃣ Prerequisites

Machine requirements:

- Windows 11 (or Linux equivalent)
- Docker Desktop installed + running
- Repo cloned:

```powershell
git clone https://github.com/bensalemGit/rentalos.git
cd rentalos

“DB restore + re-apply migrations”

après restore DB : .\infra\migrate.ps1 -Status puis -Apply

Simulation (ne modifie pas la DB) :
.\infra\migrate.ps1 -DryRun

Application :
.\infra\migrate.ps1 -Apply

Règles importantes

Les chemins relatifs sont résolus depuis le dossier du script (infra/).

Le runner utilise des chemins absolus pour docker compose -f et pour monter les fichiers SQL.

Règles importantes

Les chemins relatifs sont résolus depuis le dossier du script (infra/).

Le runner utilise des chemins absolus pour docker compose -f et pour monter les fichiers SQL.

### ✅ Bloc 2 — à ajouter ensuite dans le même fichier
```md
## Conventions migrations

- Les migrations sont des fichiers `.sql` dans `infra/postgres-init/` et sont appliquées **dans l'ordre alphabétique**.
- Une fois une migration appliquée sur un environnement, elle est **immuable** :
  - ❌ Interdit : renommer / modifier une migration déjà appliquée
  - ✅ Autorisé : ajouter une migration corrective (nouveau numéro), idempotente si besoin

### Seed templates : migrations idempotentes

Toute migration qui insère dans `document_templates` doit être idempotente via UPSERT :

- Contrainte logique : `(kind, lease_kind, version)` unique côté métier
- Pattern SQL :
  `INSERT ... ON CONFLICT (kind, lease_kind, version) DO UPDATE ...`