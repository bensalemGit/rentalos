CREATE TABLE IF NOT EXISTS public_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text UNIQUE NOT NULL,
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  purpose text NOT NULL DEFAULT 'TENANT_SIGN_CONTRACT',
  expires_at timestamptz NOT NULL,
  used_count int NOT NULL DEFAULT 0,
  last_used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_links_lease ON public_links(lease_id);
