-- 082_lease_terms.sql
BEGIN;

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS lease_terms jsonb NOT NULL DEFAULT '{}'::jsonb;

-- garde-fou: on veut un objet JSON (pas un array/string)
ALTER TABLE leases
  DROP CONSTRAINT IF EXISTS lease_terms_is_object;
ALTER TABLE leases
  ADD CONSTRAINT lease_terms_is_object
  CHECK (jsonb_typeof(lease_terms) = 'object');

COMMIT;