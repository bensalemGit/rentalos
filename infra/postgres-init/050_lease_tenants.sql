-- Co-tenants (many tenants per lease)
CREATE TABLE IF NOT EXISTS lease_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'cotenant', -- principal | cotenant
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lease_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_lease_tenants_lease ON lease_tenants(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_tenants_tenant ON lease_tenants(tenant_id);

-- Seed: ensure current primary tenant exists in lease_tenants
INSERT INTO lease_tenants (lease_id, tenant_id, role)
SELECT l.id, l.tenant_id, 'principal'
FROM leases l
LEFT JOIN lease_tenants lt ON lt.lease_id = l.id AND lt.tenant_id = l.tenant_id
WHERE lt.id IS NULL;
