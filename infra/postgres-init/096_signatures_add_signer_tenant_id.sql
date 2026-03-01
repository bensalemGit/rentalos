-- 096_signatures_add_signer_tenant_id.sql
ALTER TABLE signatures
ADD COLUMN IF NOT EXISTS signer_tenant_id uuid;

-- Optionnel mais recommandé: index pour le guard "déjà signé"
CREATE INDEX IF NOT EXISTS idx_signatures_doc_role_tenant
ON signatures (document_id, signer_role, signer_tenant_id);