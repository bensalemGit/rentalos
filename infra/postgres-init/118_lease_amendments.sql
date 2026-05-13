BEGIN;

CREATE TABLE IF NOT EXISTS lease_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',

  effective_date date NOT NULL,

  title text NOT NULL,
  summary text,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,

  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  signed_final_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  generated_at timestamptz,
  sent_at timestamptz,
  signed_at timestamptz,
  applied_at timestamptz,
  cancelled_at timestamptz,

  CONSTRAINT lease_amendments_type_check
    CHECK (type IN ('ADD_TENANT', 'CUSTOM', 'IRL_REVISION')),

  CONSTRAINT lease_amendments_status_check
    CHECK (status IN ('draft', 'generated', 'sent', 'signed', 'applied', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_lease_amendments_lease_id
  ON lease_amendments(lease_id);

CREATE INDEX IF NOT EXISTS idx_lease_amendments_status
  ON lease_amendments(status);

CREATE TABLE IF NOT EXISTS lease_amendment_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id uuid NOT NULL REFERENCES lease_amendments(id) ON DELETE CASCADE,

  role text NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,

  signer_name text NOT NULL,
  signer_email text,

  signature_status text NOT NULL DEFAULT 'pending',
  signed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lease_amendment_signers_role_check
    CHECK (role IN ('BAILLEUR', 'LOCATAIRE')),

  CONSTRAINT lease_amendment_signers_status_check
    CHECK (signature_status IN ('pending', 'sent', 'signed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_lease_amendment_signers_amendment_id
  ON lease_amendment_signers(amendment_id);

CREATE INDEX IF NOT EXISTS idx_lease_amendment_signers_tenant_id
  ON lease_amendment_signers(tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_lease_amendment_signer_role_tenant
  ON lease_amendment_signers(amendment_id, role, tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_lease_amendment_signer_landlord
  ON lease_amendment_signers(amendment_id, role)
  WHERE role = 'BAILLEUR';

COMMIT;