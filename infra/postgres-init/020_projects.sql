-- Projects (ownership groups)
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'indivision', -- indivision | couple | societe | autre
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Project members (optional, for indivision)
CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'indivisaire', -- indivisaire | gerant | autre
  share_pct numeric, -- optional
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Link units to projects
ALTER TABLE units
  ADD COLUMN IF NOT EXISTS project_id uuid NULL REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_units_project_id ON units(project_id);
