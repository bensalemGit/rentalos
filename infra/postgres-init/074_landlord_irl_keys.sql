-- 074_landlord_irl_keys.sql

-- 1) Bailleur multi-projets
CREATE TABLE IF NOT EXISTS landlord_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,               -- ex: "INDIVISION DES POINTES"
  representative text,              -- ex: "Bensalem Diouri..."
  address text NOT NULL,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS landlord_profile_id uuid
    REFERENCES landlord_profiles(id) ON DELETE SET NULL;

-- 2) IRL reference values stored on lease (freeze at signature)
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS irl_reference_quarter text,
  ADD COLUMN IF NOT EXISTS irl_reference_value numeric;

-- 3) Keys count stored in lease_designation JSON OR as column (we choose column for clarity)
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS keys_count integer;
