-- 106_guarantor_act_template_duration_cap_v2.sql
-- Renforce l'acte de caution :
-- - duree bornee
-- - extinction en colocation
-- - plafond chiffre via {{guarantee_cap_eur}}
-- Ne modifie pas les documents deja generes.

UPDATE document_templates
SET html_template = $HTML$
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.35; }
    h1 { text-align: center; font-size: 16pt; margin-bottom: 16px; }
    h2 { font-size: 13pt; margin-top: 18px; }
    .section { margin-top: 12px; }
    .box { border: 1px solid #ddd; padding: 10px; border-radius: 8px; margin: 10px 0; }
    .small { font-size: 9pt; color: #555; }
  </style>
</head>
<body>

<h1>ACTE DE CAUTIONNEMENT SOLIDAIRE</h1>

<p class="small">
  Bail n° {{lease_id_short}} — Version template {{template_version}}
</p>

<h2>1. Parties</h2>

<div class="box">
  <strong>Bailleur :</strong><br/>
  {{landlord_identifiers_html}}
</div>

<div class="box">
  <strong>Locataire garanti :</strong><br/>
  {{guaranteed_tenant_full_name}}
</div>

<div class="box">
  <strong>Caution :</strong><br/>
  {{guarantor_full_name}}<br/>
  {{guarantor_address}}<br/>
  Email : {{guarantor_email}} — Tél : {{guarantor_phone}}
</div>

<h2>2. Bail concerné</h2>

<p>
  Le présent cautionnement est donné au titre du bail portant sur le logement suivant :
</p>

<p>
  {{designation_summary}}<br/>
  {{unit_address_line1}}<br/>
  {{unit_postal_code}} {{unit_city}}
</p>

<p>
  Date de prise d'effet du bail : {{start_date_fr}}.
</p>

<h2>3. Étendue de l'engagement</h2>

<p>
  La caution s'engage solidairement au paiement des sommes dues par le locataire garanti désigné ci-dessus
  au titre du bail, notamment les loyers, charges, indemnités d'occupation, réparations locatives,
  frais et accessoires, dans les conditions prévues au bail et par le présent acte.
</p>

<p>
  Lorsque le bail comporte une clause de solidarité entre colocataires, le présent cautionnement couvre
  également les conséquences financières de cette solidarité pour le locataire garanti, dans les limites
  légales et contractuelles applicables.
</p>

<p>
  Le présent acte ne vaut pas cautionnement indifférencié de tous les colocataires : il est rattaché
  au locataire garanti expressément identifié ci-dessus.
</p>

<h2>4. Durée de l'engagement</h2>

<p>
  Le présent cautionnement est consenti pour la durée initiale du bail, soit du {{start_date_fr}}
  au {{end_date_theoretical}}, ainsi que pour une seule reconduction ou un seul renouvellement,
  sans pouvoir excéder une durée totale de 24 mois à compter de la date de prise d'effet du bail.
</p>

<p>
  En cas de départ du locataire garanti dans le cadre d'une colocation, l'engagement de la caution
  prend fin dans les conditions prévues par l'article 8-1 de la loi du 6 juillet 1989 :
  à la date d'effet du congé si un nouveau colocataire figure au bail, ou à défaut au plus tard
  six mois après cette date.
</p>

<h2>5. Montants de référence</h2>

<p>
  Loyer mensuel hors charges : {{rent_eur}} €<br/>
  Charges mensuelles : {{charges_eur}} €<br/>
  Dépôt de garantie : {{deposit_eur}} €
</p>

<p>
  Le présent cautionnement est consenti dans la limite d'un montant maximal de
  <strong>{{guarantee_cap_eur}} €</strong>, correspondant à 24 mois de loyers charges comprises,
  hors éventuels frais, réparations locatives, indemnités et accessoires dus dans les conditions
  prévues au bail et par la loi.
</p>

<h2>6. Signatures</h2>

<p>
  Fait à {{signature_city}}, le {{signature_date}}.
</p>

<br/>

<table width="100%">
  <tr>
    <td width="50%">
      <strong>La caution</strong><br/><br/>
      {{guarantor_full_name}}<br/><br/>
      Signature :
    </td>
    <td width="50%">
      <strong>Le bailleur</strong><br/><br/>
      {{landlord_name}}<br/><br/>
      Signature :
    </td>
  </tr>
</table>

</body>
</html>
$HTML$
WHERE kind = 'GUARANTOR_ACT'
  AND lease_kind = 'MEUBLE_RP'
  AND version = '2026-04';