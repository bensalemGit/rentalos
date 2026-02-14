-- Templates NOTICE (résidence principale) : MEUBLE_RP & NU_RP
-- (Saisonnier = pas de notice)
DELETE FROM document_templates WHERE kind='NOTICE' AND version='2026-02';

INSERT INTO document_templates(kind, lease_kind, version, title, html_template)
VALUES
(
  'NOTICE','MEUBLE_RP','2026-02',
  'Notice d’information (résidence principale) — Meublé',
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
    ul{margin:6px 0 0 18px}
    code{word-break:break-all}
  </style>
</head>
<body>
  <h1>Notice d’information — Location en résidence principale (Meublé)</h1>
  <div class="muted">Version template: 2026-02 — Annexe obligatoire pour les baux de résidence principale.</div>

  <div class="box">
    <b>Bail concerné</b><br/>
    Logement: <b>{{unit_code}}</b> — {{unit_label}}<br/>
    Adresse: {{unit_address_line1}}, {{unit_postal_code}} {{unit_city}}<br/>
    Période: {{start_date}} → {{end_date_theoretical}}<br/>
    Type: <b>Meublé (RP)</b>
  </div>

  <h2>Objet</h2>
  <p>
    Cette notice rappelle les informations essentielles liées à un bail de résidence principale.
    Elle accompagne le contrat de location. Elle ne remplace pas les textes officiels.
  </p>

  <h2>Points clés (rappel)</h2>
  <ul>
    <li>Durée et congés : règles spécifiques aux baux de résidence principale.</li>
    <li>Dépôt de garantie, état des lieux, inventaire du mobilier (en meublé).</li>
    <li>Charges : modalités de récupération et régularisation selon le bail.</li>
    <li>Obligations : assurance du locataire, usage paisible, entretien.</li>
  </ul>

  <h2>Texte officiel</h2>
  <p>
    La notice officielle est publiée par l’administration. Pour conformité stricte, vous pouvez
    remplacer cette notice par la notice officielle actualisée (PDF) et versionner votre template.
  </p>
  <p class="muted">
    Référence : Décret n°2015-587 et notice d’information (arrêté). Sources : Légifrance / Service-public.
  </p>

  <h2>Signature</h2>
  <p>Fait à {{signature_city}}, le {{signature_date}}.</p>
  <div class="box">
    Bailleur: ____________________ &nbsp;&nbsp; Locataire(s): ____________________
  </div>
</body>
</html>
$$
),
(
  'NOTICE','NU_RP','2026-02',
  'Notice d’information (résidence principale) — Nu',
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
    ul{margin:6px 0 0 18px}
  </style>
</head>
<body>
  <h1>Notice d’information — Location en résidence principale (Nu)</h1>
  <div class="muted">Version template: 2026-02 — Annexe obligatoire pour les baux de résidence principale.</div>

  <div class="box">
    <b>Bail concerné</b><br/>
    Logement: <b>{{unit_code}}</b> — {{unit_label}}<br/>
    Adresse: {{unit_address_line1}}, {{unit_postal_code}} {{unit_city}}<br/>
    Période: {{start_date}} → {{end_date_theoretical}}<br/>
    Type: <b>Nu (RP)</b>
  </div>

  <h2>Points clés (rappel)</h2>
  <ul>
    <li>Durée et congés : règles spécifiques aux baux de résidence principale.</li>
    <li>Dépôt de garantie, état des lieux.</li>
    <li>Charges : modalités selon le bail.</li>
    <li>Obligations : assurance du locataire, entretien, usage paisible.</li>
  </ul>

  <h2>Texte officiel</h2>
  <p class="muted">
    Pour conformité stricte, vous pouvez remplacer cette notice par la notice officielle actualisée (PDF)
    et versionner votre template dans RentalOS.
  </p>

  <h2>Signature</h2>
  <p>Fait à {{signature_city}}, le {{signature_date}}.</p>
  <div class="box">
    Bailleur: ____________________ &nbsp;&nbsp; Locataire(s): ____________________
  </div>
</body>
</html>
$$
);
