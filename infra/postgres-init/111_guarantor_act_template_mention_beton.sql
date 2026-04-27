-- 111_guarantor_act_template_mention_beton.sql
-- Harmonisation mention caution : PDF acte = mention saisie = audit

UPDATE document_templates
SET html_template = REPLACE(
  html_template,
  'En me portant caution solidaire de {{tenant_full_name}}, dans la limite de la somme de <strong>{{guarantee_cap_eur}} €</strong>,
  couvrant le paiement du principal, des intérêts et, le cas échéant, des pénalités ou intérêts de retard,
  et pour la durée définie au présent acte, je m''engage à rembourser au bailleur les sommes dues sur mes revenus
  et mes biens si {{tenant_full_name}} n''y satisfait pas lui-même.

  Je reconnais avoir pris connaissance de la nature et de l''étendue de mon engagement.',
  'En me portant caution solidaire de {{tenant_full_name}}, dans la limite de la somme de <strong>{{guarantee_cap_eur}} €</strong> (vingt-quatre mille euros) couvrant le paiement du principal, des intérêts et, le cas échéant, des pénalités ou intérêts de retard, et pour une durée de 24 mois, je m''engage à rembourser au bailleur les sommes dues sur mes revenus et mes biens si {{tenant_full_name}} n''y satisfait pas lui-même.

  Je reconnais avoir parfaitement connaissance de la nature et de l''étendue de mon engagement.'
)
WHERE kind = 'GUARANTOR_ACT'
  AND lease_kind = 'MEUBLE_RP'
  AND version = '2026-04';