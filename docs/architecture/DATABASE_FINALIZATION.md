# Database — Finalisation & Public Tokens

## Portée réelle

Cette finalisation ne concerne plus uniquement le contrat.

Le mécanisme de `SIGNED_FINAL` est désormais utilisé de manière plus générale pour les documents signables du système.

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
- `GUARANTOR_SIGN_ACT`
- `FINAL_PDF_DOWNLOAD`
- `FINAL_PACK_DOWNLOAD`

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

Le projet utilise un runner PowerShell pour appliquer les migrations SQL versionnées dans `infra/postgres-init/`.



- Statut (repo vs DB) :
  ```powershell
  .\infra\migrate.ps1 -Status

- Simulation (ne modifie pas la DB) :
.\infra\migrate.ps1 -DryRun

- Application :
.\infra\migrate.ps1 -Apply


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

La présence de `signed_final_document_id` sur un document ne signifie pas encore que tous les assemblages en aval utilisent exclusivement ce `SIGNED_FINAL`.

En particulier, certains flux de pack final peuvent encore fallback sur le document racine.