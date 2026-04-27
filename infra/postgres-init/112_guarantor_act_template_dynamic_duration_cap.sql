-- 112_guarantor_act_template_dynamic_duration_cap.sql
-- Rend la durée et le plafond de caution dynamiques dans l'acte :
-- {{guarantee_cap_eur}} = (loyer + charges) x durée du bail
-- {{guarantee_duration_label}} = durée du bail en mois

UPDATE document_templates
SET html_template = REPLACE(
  REPLACE(
    REPLACE(
      html_template,

      'sans pouvoir excéder une durée totale de 24 mois à compter de la date de prise d''effet du bail.',
      'sans pouvoir excéder une durée totale de {{guarantee_duration_label}} à compter de la date de prise d''effet du bail.'
    ),

    'correspondant à 24 mois de loyers charges comprises.',
    'correspondant à {{guarantee_duration_label}} de loyers charges comprises.'
  ),

  'et pour une durée de 24 mois, je m''engage à rembourser au bailleur les sommes dues sur mes revenus et mes biens si {{tenant_full_name}} n''y satisfait pas lui-même.',
  'et pour une durée de {{guarantee_duration_label}}, je m''engage à rembourser au bailleur les sommes dues sur mes revenus et mes biens si {{tenant_full_name}} n''y satisfait pas lui-même.'
)
WHERE kind = 'GUARANTOR_ACT'
  AND lease_kind = 'MEUBLE_RP'
  AND version = '2026-04';