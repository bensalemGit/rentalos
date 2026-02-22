# Database — Finalisation & Public Tokens

## documents (finalisation)

Le document parent (contrat source) porte l’état final :

- `signed_final_document_id` : FK vers le doc final signé
- `finalized_at` : timestamp de finalisation
- `signed_final_sha256` : sha du PDF final

Le document final stocke :
- `storage_path`, `filename`, `sha256`
- `parent_document_id` = id du parent

---

## public_links (tokens publics)

- `token_hash` : sha256 du token
- `purpose` : usage autorisé
- `expires_at` : expiration
- `consumed_at` : consommation (one-time download)
- (si présent) `invalidated_at` : invalidation des tokens signature après usage

Purposes :
- `TENANT_SIGN_CONTRACT`
- `LANDLORD_SIGN_CONTRACT`
- `FINAL_PDF_DOWNLOAD`

---

## Scripts SQL (infra/postgres-init)

- `075_documents_finalization.sql`
  - ajoute `finalized_at`, `signed_final_sha256`

- `076_backfill_documents_finalization.sql`
  - backfill parent finalisé (si historique)

- `077_public_links_consumed_at.sql`
  - ajoute `consumed_at`

---

## Backfill utile (environnement existant)

```sql
UPDATE documents parent
SET
  finalized_at = COALESCE(parent.finalized_at, final.created_at, NOW()),
  signed_final_sha256 = COALESCE(parent.signed_final_sha256, final.sha256)
FROM documents final
WHERE parent.signed_final_document_id = final.id
  AND (parent.finalized_at IS NULL OR parent.signed_final_sha256 IS NULL);

## Migration Runner (infra/migrate.ps1)

Le projet utilise un runner PowerShell pour appliquer les migrations SQL versionnées dans `infra/postgres-init/`.

### Commandes

- Statut (repo vs DB) :
  ```powershell
  .\infra\migrate.ps1 -Status

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

✅ Bloc 3 — “Reconcile repo vs DB” (à coller aussi dans DATABASE_FINALIZATION.md)
## Reconcile repo vs DB (diagnostic)

Permet de vérifier qu'il n'existe aucun écart entre :
- les fichiers `infra/postgres-init/*.sql`
- la table `schema_migrations` en base

Exemple PowerShell :

```powershell
$files = Get-ChildItem infra/postgres-init -Filter "*.sql" | Sort-Object Name | Select-Object -ExpandProperty Name

$applied = docker compose -f infra/docker-compose.yml exec -T postgres `
  psql -U rentalos -d rentalos -t -A -c "SELECT filename FROM schema_migrations ORDER BY filename;" `
| ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }

$missingInDb = $files | Where-Object { $applied -notcontains $_ }
$missingInRepo = $applied | Where-Object { $files -notcontains $_ }

"FILES=" + $files.Count
"APPLIED=" + $applied.Count
"Missing in DB:"
$missingInDb
"Missing in repo:"
$missingInRepo


### ✅ Bloc 4 — à ajouter dans `docs/handover/MASTER_HANDOVER.md`
```md
## Git workflow (règles)

- `main` = branche de production (source de vérité)
- Chaque changement passe par une branche courte + PR :
  - `feat/...` ou `fix/...`
- Après merge PR :
  - suppression de la branche distante + locale recommandée

### Protection recommandée (GitHub)

- Interdire les push directs sur `main`
- Exiger une PR + checks (même minimal)
- Squash merge ou merge commit : au choix (le projet utilise déjà des "Merge pull request #X")