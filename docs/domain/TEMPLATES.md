# Templates Contrats — RentalOS

RentalOS génère les documents PDF (contrats, notices…) à partir de templates HTML stockés dans PostgreSQL.

Ce guide explique :
- où sont stockés les templates
- comment faire un backup avant modification
- comment mettre à jour un contrat proprement (UTF-8 safe)
- quelles vérifications exécuter

---

## 1) Table SQL
Templates dans :
- `document_templates`

Identité :
- `kind` (CONTRACT, NOTICE…)
- `lease_kind` (MEUBLE_RP, NU_RP…)
- `version` (ex: 2026-02)

---

## 2) Template principal (Contrat Meublé RP)

Actif :
- `kind = CONTRACT`
- `lease_kind = MEUBLE_RP`
- `version = 2026-02`

```sql
SELECT id, title, version, length(html_template) AS len
FROM document_templates
WHERE kind='CONTRACT'
  AND lease_kind='MEUBLE_RP'
  AND version='2026-02';

## 3) Règle d’or : backup avant modification

BEGIN;

WITH src AS (
  SELECT *
  FROM document_templates
  WHERE kind='CONTRACT'
    AND lease_kind='MEUBLE_RP'
    AND version='2026-02'
  LIMIT 1
)
INSERT INTO document_templates (
  id, kind, lease_kind, version, title, html_template
)
SELECT
  gen_random_uuid(),
  kind,
  lease_kind,
  '2026-02-backup-' || to_char(now(),'YYYYMMDD-HH24MISS'),
  title || ' (backup)',
  html_template
FROM src;

COMMIT;

## 4) Update (UTF-8 safe / dollar quoting)

BEGIN;

UPDATE document_templates
SET
  title = 'Contrat de location meublée (Résidence principale) — 2026-02',
  html_template = $HTML$
# Contrat de location meublée

## Locataires
{{tenants_block}}

## Clause colocation
{{colocation_clause}}

## Garants
{{guarantor_block}}

## Visale
{{visale_block}}

## Charges
{{charges_clause_html}}

## Révision IRL
{{irl_clause_html}}
$HTML$
WHERE kind='CONTRACT'
  AND lease_kind='MEUBLE_RP'
  AND version='2026-02';

COMMIT;

##5) Vérifications post-update

SELECT
  html_template LIKE '%{{tenants_block}}%' AS tenants_ok,
  html_template LIKE '%{{colocation_clause}}%' AS colocation_ok,
  html_template LIKE '%{{guarantor_block}}%' AS guarantor_ok
FROM document_templates
WHERE kind='CONTRACT'
  AND lease_kind='MEUBLE_RP'
  AND version='2026-02';
