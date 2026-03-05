-- ===============================
-- ref_key for stable item identity
-- ===============================

ALTER TABLE edl_items
ADD COLUMN IF NOT EXISTS ref_key text;

ALTER TABLE inventory_lines
ADD COLUMN IF NOT EXISTS ref_key text;

-- backfill minimal

UPDATE edl_items
SET ref_key = COALESCE(
  ref_key,
  md5(COALESCE(section,'') || '::' || COALESCE(label,''))
)
WHERE ref_key IS NULL;

UPDATE inventory_lines
SET ref_key = COALESCE(
  ref_key,
  COALESCE(catalog_item_id::text, id::text)
)
WHERE ref_key IS NULL;

-- indexes (useful later for diff detection)

CREATE INDEX IF NOT EXISTS idx_edl_items_ref_key
ON edl_items(ref_key);

CREATE INDEX IF NOT EXISTS idx_inventory_lines_ref_key
ON inventory_lines(ref_key);