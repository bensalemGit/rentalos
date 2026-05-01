CREATE TABLE IF NOT EXISTS inventory_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_line_id uuid NOT NULL REFERENCES inventory_lines(id) ON DELETE CASCADE,
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  sha256 text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_photos_line
ON inventory_photos (inventory_line_id);

CREATE INDEX IF NOT EXISTS idx_inventory_photos_lease
ON inventory_photos (lease_id);