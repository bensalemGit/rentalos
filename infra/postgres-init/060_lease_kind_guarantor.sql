-- 1) Extend lease_status already exists; lease_kind is new enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='lease_kind') THEN
    CREATE TYPE lease_kind AS ENUM ('MEUBLE_RP','NU_RP','SAISONNIER');
  END IF;
END $$;

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS kind lease_kind NOT NULL DEFAULT 'MEUBLE_RP';

-- Optional guarantor/caution info (for NU_RP and MEUBLE_RP)
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS guarantor_full_name text,
  ADD COLUMN IF NOT EXISTS guarantor_email text,
  ADD COLUMN IF NOT EXISTS guarantor_phone text,
  ADD COLUMN IF NOT EXISTS guarantor_address text;
