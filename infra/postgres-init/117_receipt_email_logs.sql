CREATE TABLE IF NOT EXISTS receipt_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL,
  receipt_id uuid NULL,
  document_id uuid NULL,
  period_year int NOT NULL,
  period_month int NOT NULL,
  kind text NOT NULL DEFAULT 'receipt',
  to_email text NOT NULL,
  tenant_name text NULL,
  sent boolean NOT NULL DEFAULT false,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipt_email_logs_lease_period
ON receipt_email_logs (lease_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_receipt_email_logs_receipt
ON receipt_email_logs (receipt_id);

CREATE INDEX IF NOT EXISTS idx_receipt_email_logs_kind
ON receipt_email_logs (kind);