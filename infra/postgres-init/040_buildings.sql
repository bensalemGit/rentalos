CREATE TABLE IF NOT EXISTS buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buildings_project_id ON buildings(project_id);

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS building_id uuid NULL REFERENCES buildings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_units_building_id ON units(building_id);
