-- 079_project_landlords.sql
-- Create project-level landlord profile + link projects.landlord_id
-- Safe to re-run.

BEGIN;

-- 1) Table project_landlords
CREATE TABLE IF NOT EXISTS project_landlords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One landlord can be reused across projects later if needed.
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,

  city TEXT NULL,
  postal_code TEXT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Link from projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS landlord_id UUID NULL;

-- 3) FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_landlord_id_fkey'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_landlord_id_fkey
      FOREIGN KEY (landlord_id)
      REFERENCES project_landlords(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 4) Index
CREATE INDEX IF NOT EXISTS idx_projects_landlord_id ON projects(landlord_id);

COMMIT;