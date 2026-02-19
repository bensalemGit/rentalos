# RentalOS — HANDOVER (Passation)

Ce document permet à un nouveau dev/chat de reprendre RentalOS immédiatement.

Repo public :  
https://github.com/bensalemGit/rentalos

Dernière mise à jour : 2026-02

---

# 🎯 Objectif du projet

RentalOS est une application de gestion locative moderne :

- Baux (meublé RP / nu RP / saisonnier)
- Locataires multiples (colocation)
- Génération PDF (contrat, notice, EDL, inventaire)
- Signature électronique
- Pack complet signé
- PRA backup/restore robuste

---

# 🏗️ Architecture

## Local

- Windows 11 Pro
- Docker Desktop
- Projet : `C:\rentalos`

## Stack Docker

Dossier :

```powershell
cd C:\rentalos\infra
docker compose up -d

Services :

Postgres 16

API NestJS

Web Next.js

Gotenberg PDF

PgAdmin

💾 PRA Backup (VALIDÉ)

Script : C:\rentalos\backups\backup.ps1

Upload Cloudflare R2 chiffré

Restore complet <10 min

Commande test :
powershell.exe -ExecutionPolicy Bypass -File .\backup.ps1 -EmailMode FailOnly

📄 Génération documents

Service central :
apps/api/src/documents/documents.service.ts

Templates stockés en DB :
document_templates
kind='CONTRACT'
lease_kind='MEUBLE_RP'
version='2026-02'

✍️ Signature électronique

Route principale :
POST /api/documents/:id/sign

Cas critique :

Si plusieurs locataires → tenantId obligatoire

Voir doc complète : SIGNATURES.md

📌 Règle d’or (nouveau chat)

Si ChatGPT devient lent :

Ouvrir un nouveau chat

Lui donner en premier :

/docs/HANDOVER.md

/docs/README.md

/docs/SIGNATURES.md

/docs/TEMPLATES.md

Lui dire :

“Tout est sur GitHub, tu lis directement le repo public.”

🚀 Priorités prochaines

Test automatique E2E signature multi-locataires

Contrat meublé béton : garants multi + visale UI

Multi-locataires dès création bail (UX)


---

# ✅ 3) `/docs/SIGNATURES.md`

```md
# RentalOS — SIGNATURES (Multi-locataires)

Ce document décrit le workflow de signature électronique.

---

# 🎯 Objectif

Permettre la signature légale d’un document (contrat) par :

- 1 ou plusieurs locataires
- puis le bailleur
- génération finale du PDF signé

---

# 🔗 Endpoint principal

POST /api/documents/:documentId/sign

Payload :

```json
{
  "signerName": "Marie Martin",
  "signerRole": "LOCATAIRE",
  "signerTenantId": "uuid-du-locataire",
  "signatureDataUrl": "data:image/png;base64,..."
}

⚠️ Règle critique : tenantId obligatoire si colocation

Si le bail contient plusieurs locataires :

signerTenantId est requis

sinon erreur :
400 Unable to resolve signerTenantId for tenant signature

👥 Ordre de signature attendu

Tous les locataires (1 page chacun)

Bailleur (dernier)

Le PDF final est généré uniquement si :

tous les tenants ont signé

ET le bailleur a signé

🔍 Comment obtenir tenantId ?

En DB :
SELECT lt.role, t.id, t.full_name
FROM lease_tenants lt
JOIN tenants t ON t.id=lt.tenant_id
WHERE lt.lease_id='LEASE_UUID';

Dans l’UI :

la page /sign/[leaseId] doit envoyer tenantId dans le payload

✅ Finalisation automatique

Quand toutes signatures présentes :

merge PDF original + pages signatures

insertion document final :
CONTRAT_SIGNED_FINAL.pdf

Champ :
documents.signed_final_document_id

📌 Debug checklist

Locataires bien présents dans lease_tenants

UI envoie bien signerTenantId

Bailleur signe en dernier

Vérifier documents.service.ts → signDocumentMulti()

---

# ✅ 4) `/docs/TEMPLATES.md`

```md
# RentalOS — Templates Contrats (MEUBLE_RP)

Ce document décrit comment gérer les templates juridiques en base.

---

# 🎯 Principe

Les contrats sont stockés dans Postgres :

Table :

document_templates

Chaque template est identifié par :

- kind (CONTRACT)
- lease_kind (MEUBLE_RP)
- version (2026-02)

---

# 🔑 Template actif actuel

```sql
SELECT id, title, length(html_template)
FROM document_templates
WHERE kind='CONTRACT'
AND lease_kind='MEUBLE_RP'
AND version='2026-02';

🛡️ Règle d’or : toujours faire un backup avant update
Backup automatique (nouvelle version horodatée)
INSERT INTO document_templates (id, kind, lease_kind, version, title, html_template)
SELECT
  gen_random_uuid(),
  kind,
  lease_kind,
  '2026-02-backup-' || to_char(now(),'YYYYMMDD-HH24MISS'),
  title || ' (backup)',
  html_template
FROM document_templates
WHERE kind='CONTRACT'
AND lease_kind='MEUBLE_RP'
AND version='2026-02';

✍️ Update du template actif

⚠️ Toujours utiliser un bloc $HTML$
UPDATE document_templates
SET html_template = $HTML$
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
</head>
<body>

<h1>Contrat location meublée</h1>

<div>
  {{tenants_block}}
</div>

<div>
  {{colocation_clause}}
</div>

<div>
  {{guarantor_block}}
</div>

<div>
  {{visale_block}}
</div>

<div>
  {{charges_clause_html}}
</div>

<div>
  {{irl_clause_html}}
</div>

</body>
</html>
$HTML$
WHERE kind='CONTRACT'
AND lease_kind='MEUBLE_RP'
AND version='2026-02';

✅ Variables disponibles

Obligatoires :

{{tenants_block}}

{{colocation_clause}}

Garantie :

{{guarantor_block}}

{{visale_block}}

Financier :

{{rent_eur}}

{{charges_clause_html}}

{{deposit_eur}}

IRL :

{{irl_clause_html}}

📌 Vérifications après update
SELECT
  html_template LIKE '%{{tenants_block}}%' as tenants_ok,
  html_template LIKE '%{{colocation_clause}}%' as colocation_ok,
  html_template LIKE '%{{guarantor_block}}%' as guarantor_ok
FROM document_templates
WHERE kind='CONTRACT'
AND lease_kind='MEUBLE_RP'
AND version='2026-02';

🎯 Objectif final

Le template MEUBLE_RP doit produire un contrat “béton” :

multi-locataires

solidarité colocation

garants multiples

visale optionnelle

charges forfait/provision

IRL clause annuelle

---

# ✅ Next Action immédiate

Tu fais maintenant :

```powershell
cd C:\rentalos\docs
notepad README.md
notepad HANDOVER.md
notepad SIGNATURES.md
notepad TEMPLATES.md

git add *.md
git commit -m "docs: finalize ultra clean docs pack (handover + signatures + templates)"
git push origin main
