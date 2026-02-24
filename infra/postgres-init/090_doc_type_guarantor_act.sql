-- 090_doc_type_guarantor_act.sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'doc_type'
      AND e.enumlabel = 'GUARANTOR_ACT'
  ) THEN
    ALTER TYPE doc_type ADD VALUE 'GUARANTOR_ACT';
  END IF;
END $$;