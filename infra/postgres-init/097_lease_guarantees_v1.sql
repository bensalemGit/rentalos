-- 097_lease_guarantees_v1.sql
-- V1 minimal: multi-garanties par locataire (lease_tenant)
-- Ne remplace pas le legacy (leases.guarantor_*), on ajoute seulement.

BEGIN;

-- 1) enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'guarantee_type') THEN
    CREATE TYPE guarantee_type AS ENUM ('CAUTION', 'VISALE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'guarantee_status') THEN
    CREATE TYPE guarantee_status AS ENUM (
      'DRAFT',
      'READY',
      'SENT',
      'SIGNED',
      'REJECTED',
      'EXPIRED',
      'CANCELLED'
    );
  END IF;
END$$;

-- 2) table
CREATE TABLE IF NOT EXISTS lease_guarantees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  lease_tenant_id uuid NOT NULL REFERENCES lease_tenants(id) ON DELETE CASCADE,
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  type guarantee_type NOT NULL,
  status guarantee_status NOT NULL DEFAULT 'DRAFT',

  selected boolean NOT NULL DEFAULT false,
  rank integer,

  -- CAUTION fields
  guarantor_full_name text,
  guarantor_email text,
  guarantor_phone text,

  -- VISALE fields
  visale_reference text,
  visale_validated_at timestamptz,

  -- document links (optional but very useful)
  guarantor_act_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  signed_final_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) indexes
CREATE INDEX IF NOT EXISTS idx_lease_guarantees_lease_tenant
  ON lease_guarantees(lease_tenant_id);

CREATE INDEX IF NOT EXISTS idx_lease_guarantees_lease
  ON lease_guarantees(lease_id);

CREATE INDEX IF NOT EXISTS idx_lease_guarantees_status
  ON lease_guarantees(status);

-- 4) unique: at most one selected per lease_tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname='public'
      AND indexname='uniq_selected_guarantee_per_lease_tenant'
  ) THEN
    CREATE UNIQUE INDEX uniq_selected_guarantee_per_lease_tenant
      ON lease_guarantees(lease_tenant_id)
      WHERE selected = true;
  END IF;
END$$;

-- 5) updated_at trigger (standard)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_lease_guarantees_updated_at'
  ) THEN
    CREATE TRIGGER trg_lease_guarantees_updated_at
    BEFORE UPDATE ON lease_guarantees
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

COMMIT;