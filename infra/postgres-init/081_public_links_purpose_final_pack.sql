BEGIN;

-- 1) Create enum if missing (and include ALL existing values)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'public_link_purpose') THEN
    CREATE TYPE public_link_purpose AS ENUM (
      'TENANT_SIGN_CONTRACT',
      'LANDLORD_SIGN_CONTRACT',
      'FINAL_PDF_DOWNLOAD',
      'FINAL_PACK_DOWNLOAD'
    );
  END IF;
END$$;

-- 2) Ensure FINAL_PACK_DOWNLOAD exists (if enum already existed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'public_link_purpose') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'public_link_purpose'
        AND e.enumlabel = 'FINAL_PACK_DOWNLOAD'
    ) THEN
      EXECUTE $$ALTER TYPE public_link_purpose ADD VALUE 'FINAL_PACK_DOWNLOAD'$$;
    END IF;
  END IF;
END$$;

-- 3) Convert column public_links.purpose from text -> enum (only if needed)
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type
    INTO col_type
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='public_links'
    AND column_name='purpose';

  -- When it's "text" or "character varying", convert it
  IF col_type IN ('text', 'character varying') THEN
    ALTER TABLE public_links
      ALTER COLUMN purpose TYPE public_link_purpose
      USING purpose::public_link_purpose;
  END IF;
END$$;

COMMIT;