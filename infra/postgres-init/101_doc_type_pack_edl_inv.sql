DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'doc_type' AND e.enumlabel = 'PACK_EDL_INV_ENTREE'
  ) THEN
    ALTER TYPE doc_type ADD VALUE 'PACK_EDL_INV_ENTREE';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'doc_type' AND e.enumlabel = 'PACK_EDL_INV_SORTIE'
  ) THEN
    ALTER TYPE doc_type ADD VALUE 'PACK_EDL_INV_SORTIE';
  END IF;
END$$;