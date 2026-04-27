-- 109_guarantor_act_template_cleanup_colocation.sql
-- Nettoyage colocation / mono-locataire

UPDATE document_templates
SET html_template = REPLACE(
  REPLACE(
    html_template,

    -- ❌ ancien bloc solidarité coloc
    'Lorsque le bail comporte une clause de solidarité entre colocataires, le présent cautionnement couvre
  également les conséquences financières de cette solidarité pour le locataire garanti, dans les limites légales et
  contractuelles applicables.',

    -- ✅ nouveau bloc neutre juridiquement
    'Le présent cautionnement couvre exclusivement les obligations du locataire garanti désigné ci-dessus,
dans les conditions prévues au bail et par la loi.'
  ),

  -- ❌ ancien bloc fin coloc
  'En cas de départ du locataire garanti dans le cadre d''une colocation, l''engagement de la caution prend fin dans
les conditions prévues par l''article 8-1 de la loi du 6 juillet 1989 : à la date d''effet du congé si un nouveau
colocataire figure au bail, ou à défaut au plus tard six mois après cette date.',

  -- ✅ nouveau bloc propre et universel
  'En cas de cessation du bail ou de départ du locataire garanti, l''engagement de la caution prend fin dans les
conditions prévues par la loi et le contrat de bail.'
)
WHERE kind = 'GUARANTOR_ACT'
  AND lease_kind = 'MEUBLE_RP'
  AND version = '2026-04';