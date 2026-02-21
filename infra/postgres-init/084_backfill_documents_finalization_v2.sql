-- 084_backfill_documents_finalization_v2.sql
-- Now that signed_final_document_id exists, re-run the backfill safely.

UPDATE documents parent
SET finalized_at = COALESCE(parent.finalized_at, final.created_at, NOW()),
    signed_final_sha256 = COALESCE(parent.signed_final_sha256, final.sha256)
FROM documents final
WHERE parent.signed_final_document_id = final.id
  AND (parent.finalized_at IS NULL OR parent.signed_final_sha256 IS NULL);