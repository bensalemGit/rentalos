-- Add phased doc types for EDL / INVENTORY (entry/exit)
-- Safe / idempotent with DO blocks.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'doc_type' AND e.enumlabel = 'EDL_ENTREE'
  ) THEN
    ALTER TYPE doc_type ADD VALUE 'EDL_ENTREE';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'doc_type' AND e.enumlabel = 'EDL_SORTIE'
  ) THEN
    ALTER TYPE doc_type ADD VALUE 'EDL_SORTIE';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'doc_type' AND e.enumlabel = 'INVENTAIRE_ENTREE'
  ) THEN
    ALTER TYPE doc_type ADD VALUE 'INVENTAIRE_ENTREE';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'doc_type' AND e.enumlabel = 'INVENTAIRE_SORTIE'
  ) THEN
    ALTER TYPE doc_type ADD VALUE 'INVENTAIRE_SORTIE';
  END IF;
END$$;