-- 072_contract_meuble_rp_template.sql
-- CONTRACT template for MEUBLE_RP (France) - version 2026-02

INSERT INTO document_templates (kind, lease_kind, version, title, html_template)
VALUES (
  'CONTRACT',
  'MEUBLE_RP',
  '2026-02',
  'Contrat de location meublée (RP) — charges non récupérables — IRL — v2026-02',
  $HTML$
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    @page { margin: 18mm 14mm; }
    body{ font-family: Arial, Helvetica, sans-serif; font-size: 11.2pt; line-height: 1.35; color:#111; }
    h1{ font-size: 18pt; margin: 0 0 6px 0; }
    h2{ font-size: 13pt; margin: 14px 0 6px 0; }
    h3{ font-size: 11.5pt; margin: 10px 0 6px 0; }
    .muted{ color:#555; font-size: 10pt; }
    .small{ color:#666; font-size: 9.5pt; }
    .box{ border:1px solid #ddd; border-radius:10px; padding:10px; margin:10px 0; }
    .row{ display:flex; gap:14px; flex-wrap:wrap; }
    .col{ flex:1; min-width:240px; }
    .kv{ border-collapse: collapse; width:100%; }
    .kv td{ border:1px solid #eee; padding:7px 8px; vertical-align: top; }
    .kv td.k{ width:34%; color:#333; background:#fafafa; font-weight:700; }
    .pill{ display:inline-block; padding:3px 8px; border-radius:999px; border:1px solid #ddd; background:#f7f7f7; font-size:9.5pt; }
    .pagebreak{ page-break-before: always; }
    ul{ margin:6px 0 0 18px; }
    .clause{ margin: 8px 0; }
    .titleline{ display:flex; justify-content:space-between; align-items:flex-end; gap:12px; flex-wrap:wrap; }
    .right{ text-align:right; }
  </style>
</head>

<body>
  <div class="titleline">
    <div>
      <h1>Contrat de location meublée</h1>
      <div class="muted">Résidence principale — durée 1 an (reconductible) — France</div>
    </div>
    <div class="right">
      <div class="pill">MEUBLÉ_RP</div><br/>
      <div class="small">Référence bail : {{lease_id_short}}</div>
    </div>
  </div>

  <div class="box">
    <table class="kv">
      <tr>
        <td class="k">Date de prise d’effet</td>
        <td>{{start_date}}</td>
      </tr>
      <tr>
        <td class="k">Fin théorique</td>
        <td>{{end_date_theoretical}}</td>
      </tr>
      <tr>
        <td class="k">Logement</td>
        <td><b>{{unit_code}}</b> — {{unit_label}}</td>
      </tr>
      <tr>
        <td class="k">Adresse</td>
        <td>{{unit_address_line1}}, {{unit_postal_code}} {{unit_city}}</td>
      </tr>
      <tr>
        <td class="k">Projet / Immeuble</td>
        <td>{{project_name}} — {{building_name}}</td>
      </tr>
    </table>
  </div>

  <h2>Article 1 — Désignation des parties</h2>
  <div class="row">
    <div class="col box">
      <h3 style="margin-top:0">Bailleur</h3>
      <div><b>{{landlord_name}}</b></div>
      <div class="small">{{landlord_address}}</div>
      <div class="small">Email : {{landlord_email}} — Tél : {{landlord_phone}}</div>
    </div>

    <div class="col box">
      <h3 style="margin-top:0">Locataire(s)</h3>
      {{tenants_block}}
    </div>
  </div>

  <h2>Article 2 — Désignation du logement loué</h2>
  <div class="box">
    {{designation_block}}
    <div class="small" style="margin-top:8px">
      Le détail des éléments d’équipement individuels et des meubles meublants est précisé dans l’inventaire annexé au présent contrat.
    </div>
  </div>

  <h2>Article 3 — Destination des lieux</h2>
  <div class="clause">
    Le logement est loué à usage de <b>résidence principale</b> du (des) locataire(s) et à usage exclusif d’habitation,
    sauf mention expresse d’un usage mixte dans la désignation (Article 2).
  </div>

  <h2>Article 4 — Durée</h2>
  <div class="clause">
    Le présent contrat est conclu pour une durée de <b>un (1) an</b>.
    Il prend effet le <b>{{start_date}}</b> et se termine théoriquement le <b>{{end_date_theoretical}}</b>,
    sauf résiliation anticipée dans les conditions prévues ci-après.
    Il est reconduit tacitement conformément au cadre légal applicable.
  </div>

  <h2>Article 5 — Conditions financières</h2>
  <div class="box">
    <table class="kv">
      <tr>
        <td class="k">Loyer mensuel</td>
        <td><b>{{rent_eur}} €</b></td>
      </tr>
      <tr>
        <td class="k">Charges</td>
        <td><b>{{charges_eur}} €</b> <span class="small">(charges non récupérables — aucune régularisation)</span></td>
      </tr>
      <tr>
        <td class="k">Paiement</td>
        <td>Le <b>{{payment_day}}</b> de chaque mois, par tout moyen convenu entre les parties.</td>
      </tr>
      <tr>
        <td class="k">Dépôt de garantie</td>
        <td><b>{{deposit_eur}} €</b></td>
      </tr>
    </table>
  </div>

  <h3>5.1 — Charges non récupérables (forfait / incluses)</h3>
  <div class="clause">
    Les charges indiquées ci-dessus sont convenues <b>non récupérables</b> :
    elles sont forfaitaires/incluses selon l’accord des parties et ne feront l’objet d’<b>aucune régularisation</b>,
    ni refacturation ultérieure, quels que soient les frais réellement supportés par le bailleur.
  </div>

  <h3>5.2 — Révision du loyer (IRL – INSEE)</h3>
  <div class="clause">
    Le loyer pourra être révisé <b>une fois par an</b> à la date anniversaire du contrat,
    conformément aux dispositions applicables et à l’article 17-1 de la loi du 6 juillet 1989.
    La révision est calculée sur la base de l’<b>Indice de Référence des Loyers (IRL)</b> publié par l’INSEE.
  </div>
  <div class="clause">
    <b>Trimestre de référence :</b> {{irl_reference_quarter}}<br/>
    <b>IRL de référence :</b> {{irl_reference_value}}<br/>
    <b>Formule :</b> Loyer révisé = Loyer en cours × (Nouvel IRL / IRL de référence)
  </div>
  <div class="small">
    À défaut de notification par le bailleur dans le délai d’un an suivant la date de révision, le bailleur est réputé avoir renoncé à la révision pour l’année écoulée.
  </div>

  <h2>Article 6 — Dépôt de garantie</h2>
  <div class="clause">
    Le dépôt de garantie est fixé à <b>{{deposit_eur}} €</b>. Il est versé à la signature du bail (ou au plus tard à l’entrée dans les lieux).
    Il est restitué selon les règles applicables, sous réserve des sommes restant dues et des réparations locatives dûment justifiées.
  </div>

  <h2>Article 7 — État des lieux & Inventaire</h2>
  <div class="clause">
    Un état des lieux d’entrée et un inventaire du mobilier sont établis contradictoirement.
    Ils sont annexés au présent contrat et font partie intégrante du bail.
  </div>

  <h2>Article 8 — Assurance</h2>
  <div class="clause">
    Le locataire s’engage à souscrire et maintenir une assurance “risques locatifs” et à en fournir l’attestation au bailleur.
  </div>

  <h2>Article 9 — Obligations des parties</h2>
  <h3>9.1 Obligations du bailleur</h3>
  <ul>
    <li>Délivrer un logement décent et en bon état d’usage et de réparation.</li>
    <li>Assurer la jouissance paisible.</li>
    <li>Entretenir les locaux et faire les réparations autres que locatives.</li>
  </ul>

  <h3>9.2 Obligations du locataire</h3>
  <ul>
    <li>Payer le loyer et respecter la destination des lieux.</li>
    <li>Entretenir le logement et assumer les réparations locatives.</li>
    <li>Répondre des dégradations et pertes survenues pendant la location.</li>
  </ul>

  <h2>Article 10 — Résiliation / congé</h2>
  <div class="clause">
    Les modalités de congé et de résiliation suivent le cadre applicable aux baux meublés de résidence principale.
    Toute notification se fait par écrit, selon les formes légales.
  </div>

  <h2>Article 11 — Colocation (le cas échéant)</h2>
  {{colocation_clause}}

  <h2>Article 12 — Caution / Garantie (optionnel)</h2>
  <div class="box">
    {{guarantor_block}}
    {{visale_block}}
    <div class="small" style="margin-top:8px">
      Si une caution solidaire est prévue, l’acte de cautionnement solidaire est annexé et signé séparément (signature électronique).
      En cas de garantie Visale, le visa Visale est annexé.
    </div>
  </div>

  <h2>Article 13 — Annexes</h2>
  <ul>
    <li>Notice d’information (résidence principale)</li>
    <li>État des lieux (entrée/sortie)</li>
    <li>Inventaire du mobilier</li>
    <li>Le cas échéant : acte de caution solidaire / visa Visale</li>
    <li>Le cas échéant : diagnostics (selon disponibilité)</li>
  </ul>

  <h2>Article 14 — Signature électronique</h2>
  <div class="clause">
    Le présent contrat est signé électroniquement. Les attestations de signature et le document PDF signé final
    sont joints en annexe (horodatage, audit, empreinte cryptographique).
  </div>

  <div class="box">
    <div><b>Fait à {{signature_city}}</b>, le <b>{{signature_date}}</b>.</div>
    <div class="small">Document généré par RentalOS.</div>
  </div>

</body>
</html>
$HTML$
)
ON CONFLICT (kind, lease_kind, version)
DO UPDATE SET
  title = EXCLUDED.title,
  html_template = EXCLUDED.html_template;
