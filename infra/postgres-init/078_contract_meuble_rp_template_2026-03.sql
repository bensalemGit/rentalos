-- 078_contract_meuble_rp_template_2026-03.sql
-- Golden template: MEUBLE_RP / CONTRACT / 2026-03 (UTF-8 clean + vars aligned)

BEGIN;

-- Safety: avoid duplicate insert
DELETE FROM document_templates
WHERE kind='CONTRACT'
  AND lease_kind='MEUBLE_RP'
  AND version='2026-03';

INSERT INTO document_templates (id, kind, lease_kind, version, title, html_template)
VALUES (
  gen_random_uuid(),
  'CONTRACT',
  'MEUBLE_RP',
  '2026-03',
  'Contrat de location meublée (résidence principale) — 2026-03',
  $HTML$
<!--
IMPORTANT:
- This template MUST be UTF-8.
- Variables are aligned with DocumentsService.applyVars().
-->
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Contrat de location meublée (résidence principale)</title>
  <style>
    :root{ --text:#111; --muted:#555; --line:#d9d9d9; --soft:#f7f7f7; --accent:#0b2a6f; }
    @page { margin: 18mm 16mm; }
    html,body{ padding:0; margin:0; }
    body{ font-family: Arial, sans-serif; color:var(--text); font-size:10.8pt; line-height:1.35; }
    h1{ font-size:17pt; margin:0 0 10px 0; }
    h2{ font-size:13.5pt; margin:14px 0 6px 0; }
    h3{ font-size:11.5pt; margin:10px 0 4px 0; }
    .muted{ color:var(--muted); }
    .box{ border:1px solid var(--line); padding:10px; border-radius:8px; margin:10px 0; }
    .row{ display:flex; gap:12px; }
    .col{ flex:1; }
    table{ width:100%; border-collapse:collapse; }
    td,th{ border:1px solid var(--line); padding:6px; vertical-align:top; }
    th{ background:var(--soft); text-align:left; }
    .hr{ height:1px; background:var(--line); margin:12px 0; }
    .page-break{ page-break-before: always; }
  </style>
</head>
<body>

<h1>Contrat de location meublée (résidence principale)</h1>

<div class="box">
  <div><b>Logement</b> — {{unit_name}}</div>
  <div class="muted">{{unit_address}}</div>
  <div class="muted">Surface habitable : {{unit_area_m2}} m²</div>
</div>

<h2>1. Parties</h2>

<div class="row">
  <div class="col box">
    <b>Bailleur</b><br/>
    {{landlord_identifiers_html}}
  </div>
  <div class="col box">
    <b>Locataire(s)</b><br/>
    {{tenants_block}}
  </div>
</div>

{{colocation_clause}}

<h2>2. Objet — destination</h2>
<div class="box">
  Location meublée à usage d’habitation constituant la résidence principale du locataire.
</div>

<h2>3. Date d’effet — durée</h2>
<table>
  <tr><th>Date de prise d’effet</th><td>{{lease_start_date_fr}}</td></tr>
  <tr><th>Durée</th><td>{{lease_duration_label}}</td></tr>
  <tr><th>Date de fin théorique</th><td>{{lease_end_date_fr}}</td></tr>
</table>

<h2>4. Conditions financières</h2>
<table>
  <tr><th>Loyer mensuel</th><td>{{rent_amount_eur}}</td></tr>
  <tr><th>Charges</th><td>{{charges_clause_html}}</td></tr>
  <tr><th>Dépôt de garantie</th><td>{{deposit_amount_eur}}</td></tr>
  <tr><th>Date de paiement</th><td>{{rent_payment_day_label}}</td></tr>
</table>

<h2>5. Révision du loyer (IRL)</h2>
<div class="box">
  {{irl_clause_html}}
</div>

<h2>6. Annexes</h2>
<div class="box">
  {{annexes_list_html}}
</div>

<div class="page-break"></div>

<h2>Signatures</h2>
<div class="box">
  Fait à {{signature_place}}, le {{signature_date_fr}}.
  <div class="muted">Signature électronique — les attestations de signature sont annexées au présent contrat.</div>
</div>

</body>
</html>
$HTML$
);

COMMIT;