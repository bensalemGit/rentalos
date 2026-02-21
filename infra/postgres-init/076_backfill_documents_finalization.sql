-- 076_backfill_documents_finalization.sql
-- Safe backfill (no-op if signed_final_document_id does not exist)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='documents'
      AND column_name='signed_final_document_id'
  ) THEN
    EXECUTE $q$
      UPDATE documents parent
      SET finalized_at = COALESCE(parent.finalized_at, final.created_at, NOW()),
          signed_final_sha256 = COALESCE(parent.signed_final_sha256, final.sha256)
      FROM documents final
      WHERE parent.signed_final_document_id = final.id
        AND (parent.finalized_at IS NULL OR parent.signed_final_sha256 IS NULL)
    $q$;
  END IF;
END $$;