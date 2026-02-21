BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'doc_type'
      AND e.enumlabel = 'PACK_FINAL'
  ) THEN
    ALTER TYPE doc_type ADD VALUE 'PACK_FINAL';
  END IF;
END $$;

COMMIT;