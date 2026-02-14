ALTER TABLE leases
ADD COLUMN IF NOT EXISTS lease_designation jsonb;