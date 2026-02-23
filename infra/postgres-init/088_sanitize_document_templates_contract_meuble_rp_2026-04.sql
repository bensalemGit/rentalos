-- 088_sanitize_document_templates_contract_meuble_rp_2026-04.sql
-- Defensive cleanup for CONTRACT / MEUBLE_RP / 2026-04:
-- - removes accidental psql table header ("html_template" + dashed line)
-- - removes UTF-8 BOM (U+FEFF)
-- - removes CR characters
-- - trims leading whitespace/newlines

BEGIN;

UPDATE document_templates
SET html_template =
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          html_template,
          '^\s*html_template\s*\n-+\s*\n',  -- psql aligned header artifact
          '',
          'n'
        ),
        '^' || chr(65279),                 -- BOM (U+FEFF)
        '',
        'n'
      ),
      E'\\r',                               -- remove CR
      '',
      'g'
    ),
    E'^[\\s\\n]+',                          -- trim leading whitespace/newlines
    '',
    'n'
  )
WHERE kind='CONTRACT'
  AND lease_kind='MEUBLE_RP'
  AND version='2026-04';

COMMIT;