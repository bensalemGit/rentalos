-- 089_sign_role_add_garant.sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'sign_role'
      AND e.enumlabel = 'GARANT'
  ) THEN
    ALTER TYPE sign_role ADD VALUE 'GARANT';
  END IF;
END $$;