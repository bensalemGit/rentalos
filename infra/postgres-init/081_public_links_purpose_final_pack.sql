BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'public_link_purpose'
      AND e.enumlabel = 'FINAL_PACK_DOWNLOAD'
  ) THEN
    ALTER TYPE public_link_purpose ADD VALUE 'FINAL_PACK_DOWNLOAD';
  END IF;
END $$;

COMMIT;