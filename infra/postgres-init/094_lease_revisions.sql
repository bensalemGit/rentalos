BEGIN;

CREATE TABLE IF NOT EXISTS lease_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  revision_date date NOT NULL,              -- date de la révision (anniversaire)
  previous_rent_cents int NOT NULL,
  new_rent_cents int NOT NULL,

  irl_reference_quarter text,
  irl_reference_value numeric,
  irl_new_quarter text,
  irl_new_value numeric NOT NULL,

  formula text,                             -- optionnel: audit lisible
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lease_revisions_lease_id ON lease_revisions(lease_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_lease_revisions_lease_date ON lease_revisions(lease_id, revision_date);

INSERT INTO schema_migrations(filename, applied_at)
SELECT '094_lease_revisions.sql', now()
WHERE NOT EXISTS (SELECT 1 FROM schema_migrations WHERE filename='094_lease_revisions.sql');

COMMIT;