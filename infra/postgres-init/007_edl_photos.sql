CREATE TABLE IF NOT EXISTS edl_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edl_item_id uuid NOT NULL REFERENCES edl_items(id) ON DELETE CASCADE,
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edl_photos_item ON edl_photos(edl_item_id);
CREATE INDEX IF NOT EXISTS idx_edl_photos_lease ON edl_photos(lease_id);
