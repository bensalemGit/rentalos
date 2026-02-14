-- Amounts history for a lease (effective date)
CREATE TABLE IF NOT EXISTS lease_amounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  effective_date date NOT NULL,
  rent_cents integer NOT NULL,
  charges_cents integer NOT NULL DEFAULT 0,
  deposit_cents integer NOT NULL DEFAULT 0,
  payment_day integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lease_id, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_lease_amounts_lease ON lease_amounts(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_amounts_effective ON lease_amounts(effective_date);

-- Seed: create an initial row at start_date for each lease if missing
INSERT INTO lease_amounts (lease_id, effective_date, rent_cents, charges_cents, deposit_cents, payment_day)
SELECT l.id, l.start_date, l.rent_cents, l.charges_cents, l.deposit_cents, l.payment_day
FROM leases l
LEFT JOIN lease_amounts a ON a.lease_id = l.id AND a.effective_date = l.start_date
WHERE a.id IS NULL;
