-- 091_guarantor_act_template_2026-04.sql
INSERT INTO document_templates(kind, lease_kind, version, title, html_template)
VALUES
('GUARANTOR_ACT','MEUBLE_RP','2026-04','Acte de cautionnement solidaire (MEUBLE RP)',$HTML$
<!doctype html><html><head><meta charset="utf-8"/>
<style>
body{font-family:Arial, sans-serif; font-size:11pt;}
h1{font-size:16pt; text-align:center;}
.small{font-size:9pt; color:#555;}
.section{margin-top:12px;}
table{width:100%; border-collapse:collapse;}
td{vertical-align:top; padding:6px;}
.box{border:1px solid #ddd; border-radius:8px; padding:10px;}
</style></head>
<body>
<h1>ACTE DE CAUTIONNEMENT SOLIDAIRE</h1>
<p class="small">Annexe au contrat de location — signature électronique.</p>

<div class="section box">
  <b>Bail concerné</b><br/>
  Logement : {{designation_summary}}<br/>
  Adresse : {{unit_address_line1}} {{unit_postal_code}} {{unit_city}}<br/>
  Bailleur : {{landlord_identifiers_plain}}<br/>
  Locataire(s) : {{tenants_names_plain}}<br/>
  Date d’effet : {{start_date_fr}}
</div>

<div class="section box">
  <b>Caution (garant)</b><br/>
  Nom : {{guarantor_full_name}}<br/>
  Email : {{guarantor_email}}<br/>
  Téléphone : {{guarantor_phone}}<br/>
  Adresse : {{guarantor_address}}
</div>

<div class="section">
  <b>Engagement</b>
  <p>
    La caution s’engage solidairement au paiement des loyers, charges, indemnités, réparations locatives et frais
    dus par le(s) locataire(s) au titre du bail, dans les limites et conditions prévues par la réglementation applicable.
  </p>
  <p>
    Montant indicatif du loyer : <b>{{rent_eur}} €</b> — Charges : <b>{{charges_eur}} €</b>.
  </p>
</div>

<div class="section">
  <b>Signature électronique</b>
  <p class="small">Fait à {{signature_city}}, le {{signature_date}}.</p>
  <table>
    <tr>
      <td class="box" style="height:120px">
        <b>Signature du garant</b><br/><br/>
        Signature :
      </td>
      <td class="box" style="height:120px">
        <b>Signature du bailleur</b><br/><br/>
        Signature :
      </td>
    </tr>
  </table>
</div>
</body></html>
$HTML$)
ON CONFLICT (kind, lease_kind, version)
DO UPDATE SET title=EXCLUDED.title, html_template=EXCLUDED.html_template;