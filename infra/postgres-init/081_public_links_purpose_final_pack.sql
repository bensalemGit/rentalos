BEGIN;

-- 1) Create enum if missing (with all values)
DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'public_link_purpose'
  ) THEN
    CREATE TYPE public_link_purpose AS ENUM (
      'TENANT_SIGN_CONTRACT',
      'LANDLORD_SIGN_CONTRACT',
      'FINAL_PDF_DOWNLOAD',
      'FINAL_PACK_DOWNLOAD'
    );
  END IF;
END
$block$;

-- 2) Add FINAL_PACK_DOWNLOAD if enum already existed
DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'public_link_purpose'
      AND e.enumlabel = 'FINAL_PACK_DOWNLOAD'
  ) THEN
    ALTER TYPE public_link_purpose
    ADD VALUE 'FINAL_PACK_DOWNLOAD';
  END IF;
END
$block$;

-- 3) Convert column purpose to enum if currently text/varchar
DO $block$
DECLARE
  col_udt text;
  default_expr text;
BEGIN
  SELECT udt_name
    INTO col_udt
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='public_links'
    AND column_name='purpose';

  -- capture current default (if any)
  SELECT pg_get_expr(d.adbin, d.adrelid)
    INTO default_expr
  FROM pg_attrdef d
  JOIN pg_attribute a
    ON a.attrelid = d.adrelid
   AND a.attnum = d.adnum
  JOIN pg_class c
    ON c.oid = d.adrelid
  JOIN pg_namespace n
    ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'public_links'
    AND a.attname = 'purpose';

  IF col_udt IN ('text', 'varchar') THEN
    -- drop default first to avoid cast error
    EXECUTE 'ALTER TABLE public.public_links ALTER COLUMN purpose DROP DEFAULT';

    -- cast
    EXECUTE 'ALTER TABLE public.public_links ' ||
            'ALTER COLUMN purpose TYPE public_link_purpose ' ||
            'USING purpose::public_link_purpose';

    -- restore default (best effort)
    IF default_expr IS NOT NULL THEN
      -- normalize common cases to enum literal
      -- examples: 'TENANT_SIGN_CONTRACT'::text or 'TENANT_SIGN_CONTRACT'
      default_expr := regexp_replace(default_expr, '::text$', '');
      default_expr := regexp_replace(default_expr, '::character varying$', '');

      -- if it's a quoted literal, reapply as enum
      IF default_expr ~ $$^'.*'$$ THEN
        EXECUTE 'ALTER TABLE public.public_links ALTER COLUMN purpose SET DEFAULT ' ||
                default_expr || '::public_link_purpose';
      ELSE
        -- fallback: set default to TENANT_SIGN_CONTRACT
        EXECUTE $$ALTER TABLE public.public_links ALTER COLUMN purpose SET DEFAULT 'TENANT_SIGN_CONTRACT'::public_link_purpose$$;
      END IF;
    ELSE
      -- no default found: set a safe one
      EXECUTE $$ALTER TABLE public.public_links ALTER COLUMN purpose SET DEFAULT 'TENANT_SIGN_CONTRACT'::public_link_purpose$$;
    END IF;
  END IF;
END
$block$;

COMMIT;