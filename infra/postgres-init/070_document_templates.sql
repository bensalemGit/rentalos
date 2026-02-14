CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,              -- 'CONTRACT'
  lease_kind lease_kind NOT NULL,  -- MEUBLE_RP | NU_RP | SAISONNIER
  version text NOT NULL,           -- ex: '2026-02'
  title text NOT NULL,
  html_template text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, lease_kind, version)
);

-- Replace templates for version 2026-02 (idempotent)
DELETE FROM document_templates WHERE kind='CONTRACT' AND version='2026-02';

-- 1) MEUBLE_RP
INSERT INTO document_templates(kind, lease_kind, version, title, html_template)
VALUES(
  'CONTRACT','MEUBLE_RP','2026-02',
  'Contrat de location meublée (résidence principale)',
$$
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.35;color:#111}
    h1{font-size:18px;margin:0 0 8px}
    h2{font-size:14px;margin:16px 0 6px}
    .muted{color:#555}
    .box{border:1px solid #ddd;border-radius:10px;padding:10px;margin:10px 0}
    table{width:100%;border-collapse:collapse}
    td,th{border:1px solid #ddd;padding:6px;vertical-align:top}
    .right{text-align:right}
  </style>
</head>
<body>
  <h1>Contrat de location meublée – Résidence principale</h1>
  <div class="muted">Version template: 2026-02 — À relire et adapter selon votre situation (annexes obligatoires à joindre).</div>

  <div class="box">
    <b>Bailleur</b><br/>
    {{landlord_name}}<br/>
    {{landlord_address}}<br/>
    Email: {{landlord_email}} — Tel: {{landlord_phone}}
  </div>

  <div class="box">
    <b>Locataire(s)</b><br/>
    {{tenants_block}}
  </div>

  <div class="box">
    <b>Logement</b><br/>
    Référence logement: <b>{{unit_code}}</b> — {{unit_label}}<br/>
    Adresse: {{unit_address_line1}}, {{unit_postal_code}} {{unit_city}}<br/>
    Projet: {{project_name}} — Immeuble: {{building_name}}<br/>
    Surface: {{unit_surface_m2}} m² — Étage: {{unit_floor}}
  </div>

  <h2>1. Objet</h2>
  <p>Le présent contrat a pour objet la location d’un logement <b>meublé</b> constituant la <b>résidence principale</b> du locataire.</p>

  <h2>2. Durée</h2>
  <p>Début: <b>{{start_date}}</b> — Fin théorique: <b>{{end_date_theoretical}}</b></p>

  <h2>3. Conditions financières</h2>
  <table>
    <tr><th>Loyer mensuel</th><td class="right">{{rent_eur}} €</td></tr>
    <tr><th>Charges mensuelles</th><td class="right">{{charges_eur}} €</td></tr>
    <tr><th>Dépôt de garantie</th><td class="right">{{deposit_eur}} €</td></tr>
    <tr><th>Jour de paiement</th><td class="right">J{{payment_day}}</td></tr>
  </table>

  <h2>4. Colocation</h2>
  <p>En cas de pluralité de locataires, ils sont tenus solidairement selon les clauses prévues au bail (à adapter si nécessaire).</p>

  <h2>5. Annexes</h2>
  <ul>
    <li>État des lieux d’entrée (EDL)</li>
    <li>Inventaire et état détaillé du mobilier (obligatoire en meublé)</li>
    <li>Notice d’information (résidence principale)</li>
    <li>Autres annexes selon cas (diagnostics, etc.)</li>
  </ul>

  <h2>Signature</h2>
  <p>Fait à {{signature_city}}, le {{signature_date}}.</p>
  <table>
    <tr>
      <th>Bailleur</th>
      <th>Locataire(s)</th>
    </tr>
    <tr>
      <td style="height:80px">Signature:</td>
      <td style="height:80px">Signature:</td>
    </tr>
  </table>
</body>
</html>
$$
);

-- 2) NU_RP
INSERT INTO document_templates(kind, lease_kind, version, title, html_template)
VALUES(
  'CONTRACT','NU_RP','2026-02',
  'Contrat de location nue (résidence principale)',
$$
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.35;color:#111}
    h1{font-size:18px;margin:0 0 8px}
    h2{font-size:14px;margin:16px 0 6px}
    .muted{color:#555}
    .box{border:1px solid #ddd;border-radius:10px;padding:10px;margin:10px 0}
    table{width:100%;border-collapse:collapse}
    td,th{border:1px solid #ddd;padding:6px;vertical-align:top}
    .right{text-align:right}
  </style>
</head>
<body>
  <h1>Contrat de location nue – Résidence principale</h1>
  <div class="muted">Version template: 2026-02 — À relire et adapter selon votre situation (notice obligatoire à joindre).</div>

  <div class="box">
    <b>Bailleur</b><br/>
    {{landlord_name}}<br/>
    {{landlord_address}}<br/>
    Email: {{landlord_email}} — Tel: {{landlord_phone}}
  </div>

  <div class="box">
    <b>Locataire(s)</b><br/>
    {{tenants_block}}
  </div>

  <div class="box">
    <b>Logement</b><br/>
    Référence logement: <b>{{unit_code}}</b> — {{unit_label}}<br/>
    Adresse: {{unit_address_line1}}, {{unit_postal_code}} {{unit_city}}<br/>
    Projet: {{project_name}} — Immeuble: {{building_name}}<br/>
    Surface: {{unit_surface_m2}} m² — Étage: {{unit_floor}}
  </div>

  <h2>1. Objet</h2>
  <p>Le présent contrat a pour objet la location d’un logement <b>nu</b> constituant la <b>résidence principale</b> du locataire.</p>

  <h2>2. Durée</h2>
  <p>Début: <b>{{start_date}}</b> — Fin théorique: <b>{{end_date_theoretical}}</b></p>

  <h2>3. Conditions financières</h2>
  <table>
    <tr><th>Loyer mensuel</th><td class="right">{{rent_eur}} €</td></tr>
    <tr><th>Charges mensuelles</th><td class="right">{{charges_eur}} €</td></tr>
    <tr><th>Dépôt de garantie</th><td class="right">{{deposit_eur}} €</td></tr>
    <tr><th>Jour de paiement</th><td class="right">J{{payment_day}}</td></tr>
  </table>

  <h2>4. Garant / caution (optionnel)</h2>
  <div class="box">
    {{guarantor_block}}
  </div>

  <h2>5. Annexes</h2>
  <ul>
    <li>État des lieux d’entrée (EDL)</li>
    <li>Notice d’information (obligatoire)</li>
    <li>Autres annexes selon cas (diagnostics, etc.)</li>
  </ul>

  <h2>Signature</h2>
  <p>Fait à {{signature_city}}, le {{signature_date}}.</p>
  <table>
    <tr>
      <th>Bailleur</th>
      <th>Locataire(s)</th>
    </tr>
    <tr>
      <td style="height:80px">Signature:</td>
      <td style="height:80px">Signature:</td>
    </tr>
  </table>
</body>
</html>
$$
);

-- 3) SAISONNIER
INSERT INTO document_templates(kind, lease_kind, version, title, html_template)
VALUES(
  'CONTRACT','SAISONNIER','2026-02',
  'Contrat de location saisonnière (meublé de tourisme)',
$$
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.35;color:#111}
    h1{font-size:18px;margin:0 0 8px}
    h2{font-size:14px;margin:16px 0 6px}
    .muted{color:#555}
    .box{border:1px solid #ddd;border-radius:10px;padding:10px;margin:10px 0}
    table{width:100%;border-collapse:collapse}
    td,th{border:1px solid #ddd;padding:6px;vertical-align:top}
    .right{text-align:right}
  </style>
</head>
<body>
  <h1>Contrat de location saisonnière – Meublé de tourisme</h1>
  <div class="muted">Version template: 2026-02 — Contrat écrit recommandé/attendu (mentions essentielles + descriptif).</div>

  <div class="box">
    <b>Loueur</b><br/>
    {{landlord_name}}<br/>
    {{landlord_address}}<br/>
    Email: {{landlord_email}} — Tel: {{landlord_phone}}
  </div>

  <div class="box">
    <b>Client (locataire)</b><br/>
    {{tenants_block}}
  </div>

  <div class="box">
    <b>Meublé</b><br/>
    Référence logement: <b>{{unit_code}}</b> — {{unit_label}}<br/>
    Adresse: {{unit_address_line1}}, {{unit_postal_code}} {{unit_city}}<br/>
    Surface: {{unit_surface_m2}} m²<br/>
    Descriptif / équipements: (à compléter si besoin)
  </div>

  <h2>1. Durée</h2>
  <p>Date d’entrée: <b>{{start_date}}</b> — Date de départ: <b>{{end_date_theoretical}}</b></p>

  <h2>2. Prix</h2>
  <table>
    <tr><th>Prix / loyer</th><td class="right">{{rent_eur}} €</td></tr>
    <tr><th>Charges</th><td class="right">{{charges_eur}} €</td></tr>
    <tr><th>Dépôt de garantie</th><td class="right">{{deposit_eur}} €</td></tr>
  </table>

  <h2>3. Inventaire & état descriptif</h2>
  <p>Un inventaire du mobilier et un descriptif des lieux sont joints.</p>

  <h2>Signature</h2>
  <p>Fait à {{signature_city}}, le {{signature_date}}.</p>
  <table>
    <tr>
      <th>Loueur</th>
      <th>Client</th>
    </tr>
    <tr>
      <td style="height:80px">Signature:</td>
      <td style="height:80px">Signature:</td>
    </tr>
  </table>
</body>
</html>
$$
);
