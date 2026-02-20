-- 075_documents_finalization.sql
-- Persist finalization status on parent document (contract)

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS signed_final_sha256 TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_finalized_at ON documents(finalized_at);