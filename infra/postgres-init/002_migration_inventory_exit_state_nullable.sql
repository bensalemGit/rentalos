-- 2026-02-15: Fix inventory_lines insert (entry-only) by allowing exit_state to be NULL
ALTER TABLE inventory_lines
  ALTER COLUMN exit_state DROP NOT NULL;
