-- 094_public_links_signer_fields.sql
-- Add signer identity fields so 1 token = 1 signer (tenant/cotenant/guarantor)

ALTER TABLE public.public_links
  ADD COLUMN IF NOT EXISTS signer_role text,
  ADD COLUMN IF NOT EXISTS signer_tenant_id uuid,
  ADD COLUMN IF NOT EXISTS signer_name text;

CREATE INDEX IF NOT EXISTS idx_public_links_signer_tenant
  ON public.public_links (signer_tenant_id);