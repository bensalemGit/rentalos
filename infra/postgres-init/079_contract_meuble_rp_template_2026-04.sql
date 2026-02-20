BEGIN;

INSERT INTO document_templates (
  kind,
  lease_kind,
  version,
  title,
  html_template,
  created_at
)
VALUES (
  'CONTRACT',
  'MEUBLE_RP',
  '2026-04',
  'Contrat de location meublée - Résidence principale (2026-04)',
$$
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>Contrat de location meublée - Résidence principale</title>
<style>
body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.4; }
h1 { text-align:center; font-size:16pt; }
h2 { margin-top:20px; font-size:13pt; }
.section { margin-top:12px; }
.small { font-size:9pt; color:#555; }
</style>
</head>
<body>

<h1>CONTRAT DE LOCATION MEUBLÉE</h1>
<p class="small">Conforme à la loi n°89-462 du 6 juillet 1989 et décret 2015-587</p>

<h2>1. Désignation des parties</h2>
<div class="section">
<strong>Bailleur :</strong><br/>
{{landlord_identifiers_html}}
</div>

<div class="section">
<strong>Locataire(s) :</strong><br/>
{{tenants_block}}
</div>

<h2>2. Désignation du logement</h2>
<div class="section">
{{designation_block}}
</div>

<h2>3. Destination</h2>
<p>
Le logement est loué à usage exclusif d’habitation principale.
</p>

<h2>4. Durée du bail</h2>
<p>
Le bail est conclu pour une durée d’un an, à compter du {{start_date}}  
et se terminant le {{end_date_theoretical}}.
</p>

<h2>5. Loyer</h2>
<p>
Le loyer mensuel est fixé à <strong>{{rent_eur}} €</strong>.
</p>

<h2>6. Charges</h2>
<p>
Montant mensuel des charges : <strong>{{charges_eur}} €</strong>.
</p>
{{charges_clause_html}}

<h2>7. Dépôt de garantie</h2>
<p>
Le dépôt de garantie est fixé à <strong>{{deposit_eur}} €</strong>.
</p>

<h2>8. Révision du loyer</h2>
{{irl_clause_html}}

<h2>9. Modalités de paiement</h2>
<p>
Le loyer est payable mensuellement, au plus tard le {{payment_day}} de chaque mois.
</p>

<h2>10. Clause de solidarité</h2>
{{colocation_clause}}

<h2>11. Garanties</h2>
{{guarantor_block}}
{{visale_block}}

<h2>12. État des lieux</h2>
<p>
Un état des lieux contradictoire sera établi lors de la remise des clés.
</p>

<h2>13. Annexes</h2>
<ul>
<li>État des lieux</li>
<li>Notice d’information</li>
<li>Dossier de diagnostic technique</li>
<li>Inventaire du mobilier</li>
</ul>

<h2>Signatures</h2>
<p>
Fait à {{signature_city}}, le {{signature_date}}.
</p>

<br/><br/>

<table width="100%">
<tr>
<td width="50%">
<strong>Le Bailleur</strong><br/><br/>
Signature :
</td>
<td width="50%">
<strong>Le(s) Locataire(s)</strong><br/><br/>
Signature :
</td>
</tr>
</table>

</body>
</html>
$$,
NOW()
);

COMMIT;