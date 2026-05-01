CREATE TABLE IF NOT EXISTS lease_deposit_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lease_deposit_deductions_lease
ON lease_deposit_deductions (lease_id);