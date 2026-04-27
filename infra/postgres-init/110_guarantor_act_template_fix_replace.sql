-- 110_guarantor_act_template_fix_replace.sql
-- Remplacement robuste des blocs colocation via regexp (insensible aux espaces / retours ligne)

UPDATE document_templates
SET html_template = regexp_replace(
  regexp_replace(
    html_template,

    -- ❌ Bloc solidarité coloc (version large)
    'Lorsque le bail comporte une clause de solidarité entre colocataires[\s\S]*?applicables\.',

    -- ✅ Nouveau bloc propre
    'Le présent cautionnement couvre exclusivement les obligations du locataire garanti désigné ci-dessus, dans les conditions prévues au bail et par la loi.',

    'g'
  ),

  -- ❌ Bloc fin coloc (version large)
  'En cas de départ du locataire garanti dans le cadre d''une colocation[\s\S]*?cette date\.',

  -- ✅ Nouveau bloc universel
  'En cas de cessation du bail ou de départ du locataire garanti, l''engagement de la caution prend fin dans les conditions prévues par la loi et le contrat de bail.',

  'g'
)
WHERE kind = 'GUARANTOR_ACT'
  AND lease_kind = 'MEUBLE_RP'
  AND version = '2026-04';