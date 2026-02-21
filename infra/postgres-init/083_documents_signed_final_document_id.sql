-- 083_documents_signed_final_document_id.sql
BEGIN;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS signed_final_document_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_signed_final_document_id_fkey'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_signed_final_document_id_fkey
      FOREIGN KEY (signed_final_document_id)
      REFERENCES documents(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_signed_final_document_id
  ON documents(signed_final_document_id);

COMMIT;