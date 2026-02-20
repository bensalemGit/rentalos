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