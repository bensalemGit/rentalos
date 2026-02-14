DO $$ BEGIN
  CREATE TYPE condition_grade AS ENUM ('neuf','tres_bon','bon','moyen','mauvais');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE item_state AS ENUM ('ok','usure','casse','manquant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- EDL
CREATE TABLE IF NOT EXISTS edl_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  source_reference_edl_id uuid NULL,
  status text NOT NULL DEFAULT 'draft',
  entry_done_at timestamptz NULL,
  exit_done_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS edl_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_session_id uuid NOT NULL REFERENCES edl_sessions(id) ON DELETE CASCADE,
  section text NOT NULL,
  label text NOT NULL,
  entry_condition condition_grade NULL,
  entry_notes text NULL,
  exit_condition condition_grade NULL,
  exit_notes text NULL
);

CREATE INDEX IF NOT EXISTS idx_edl_items_session ON edl_items(edl_session_id);

-- Inventaire
CREATE TABLE IF NOT EXISTS inventory_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'piece',
  default_qty int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  source_reference_inventory_id uuid NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_session_id uuid NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES inventory_catalog_items(id) ON DELETE RESTRICT,
  entry_qty int NOT NULL DEFAULT 0,
  entry_state item_state NOT NULL DEFAULT 'ok',
  entry_notes text NULL,
  exit_qty int NOT NULL DEFAULT 0,
  exit_state item_state NOT NULL DEFAULT 'ok',
  exit_notes text NULL
);

CREATE INDEX IF NOT EXISTS idx_inv_lines_session ON inventory_lines(inventory_session_id);

-- Référence logement (sortie -> prochaine entrée)
CREATE TABLE IF NOT EXISTS unit_reference_state (
  unit_id uuid PRIMARY KEY REFERENCES units(id) ON DELETE CASCADE,
  reference_edl_session_id uuid NULL REFERENCES edl_sessions(id) ON DELETE SET NULL,
  reference_inventory_session_id uuid NULL REFERENCES inventory_sessions(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
