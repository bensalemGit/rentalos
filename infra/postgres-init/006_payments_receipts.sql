DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('virement','cb','cheque','especes','autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  paid_at date NOT NULL,
  amount_cents int NOT NULL,
  method payment_method NOT NULL DEFAULT 'virement',
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_lease ON payments(lease_id);

CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  period_year int NOT NULL,
  period_month int NOT NULL,
  total_rent_cents int NOT NULL,
  total_charges_cents int NOT NULL,
  document_id uuid NULL REFERENCES documents(id) ON DELETE SET NULL,
  sent_to text NULL,
  sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lease_id, period_year, period_month)
);
