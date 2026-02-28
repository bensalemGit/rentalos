BEGIN;

-- Template minimal : Avenant IRL (MEUBLE_RP) - version 2026-04
INSERT INTO document_templates (kind, lease_kind, version, title, html_template)
SELECT
  'AVENANT_IRL',
  'MEUBLE_RP',
  '2026-04',
  'Avenant de révision du loyer (IRL)',
  $HTML$
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.35}
    h1{font-size:16pt;margin:0 0 10px 0}
    .small{color:#666;font-size:10pt}
    .box{border:1px solid #ddd;padding:10px;margin:10px 0;border-radius:8px}
    table{border-collapse:collapse;width:100%}
    td,th{border:1px solid #ddd;padding:8px;vertical-align:top}
    th{background:#f5f5f5;text-align:left}
    .right{text-align:right}
  </style>
</head>
<body>
  <h1>Avenant — Révision du loyer (IRL)</h1>
  <div class="small">Bail: {{lease_id_short}} — Logement: {{unit_code}}</div>

  <div class="box">
    <b>Bailleur</b><br/>
    {{landlord_identifiers_html}}
  </div>

  <div class="box">
    <b>Locataire(s)</b><br/>
    {{tenants_block}}
  </div>

  <div class="box">
    <b>Référence du bail</b><br/>
    Date d’effet du bail : <b>{{start_date}}</b><br/>
    Logement : <b>{{unit_label}}</b> ({{unit_code}})<br/>
    Adresse : {{unit_address_line1}}, {{unit_postal_code}} {{unit_city}}
  </div>

  <h2 style="font-size:13.5pt;margin:14px 0 8px 0">Révision</h2>

  <table>
    <tr>
      <th>Date d’application</th>
      <td>{{revision_date_fr}}</td>
    </tr>
    <tr>
      <th>Indice de référence (bail)</th>
      <td>{{irl_reference_quarter}} — valeur {{irl_reference_value}}</td>
    </tr>
    <tr>
      <th>Nouvel indice (à la date)</th>
      <td>{{irl_new_quarter}} — valeur {{irl_new_value}}</td>
    </tr>
    <tr>
      <th>Ancien loyer (hors charges)</th>
      <td class="right">{{previous_rent_eur}} €</td>
    </tr>
    <tr>
      <th>Nouveau loyer (hors charges)</th>
      <td class="right"><b>{{new_rent_eur}} €</b></td>
    </tr>
    <tr>
      <th>Formule</th>
      <td>{{formula}}</td>
    </tr>
  </table>

  <div class="box">
    <b>Charges</b><br/>
    Les charges restent inchangées : <b>{{charges_eur}} €</b> / mois.
  </div>

  <div class="box">
    <b>Signature</b><br/>
    Fait à {{signature_city}}, le {{signature_date}}.
  </div>

  <div style="margin-top:18px">
    <div style="display:flex;gap:20px">
      <div style="flex:1;border:1px dashed #999;border-radius:8px;padding:14px;min-height:100px">
        <b>Le Bailleur</b><br/><span class="small">(signature)</span>
      </div>
      <div style="flex:1;border:1px dashed #999;border-radius:8px;padding:14px;min-height:100px">
        <b>Le(s) Locataire(s)</b><br/><span class="small">(signature)</span>
      </div>
    </div>
  </div>

  <p class="small" style="margin-top:18px">
    Document généré par RentalOS — Avenant IRL.
  </p>
</body>
</html>
$HTML$
WHERE NOT EXISTS (
  SELECT 1 FROM document_templates
  WHERE kind='AVENANT_IRL' AND lease_kind='MEUBLE_RP' AND version='2026-04'
);

INSERT INTO schema_migrations(filename, applied_at)
SELECT '095_document_template_avenant_irl.sql', now()
WHERE NOT EXISTS (SELECT 1 FROM schema_migrations WHERE filename='095_document_template_avenant_irl.sql');

COMMIT;