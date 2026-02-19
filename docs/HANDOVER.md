# HANDOVER — RentalOS (Master Passation)

Ce document est la référence principale pour transmettre RentalOS à un nouveau dev/chat.

---

## 🎯 Objectif

RentalOS est une application complète de gestion locative :

- baux meublés résidence principale (priorité)
- gestion multi-locataires (colocation)
- génération de documents PDF (contrat, notice, EDL, inventaire)
- workflow de signature électronique multi-parties
- PRA / Backup / Restore en production

---

## 📦 Repo

GitHub public :

https://github.com/bensalemGit/rentalos

---

## ⚙️ Stack Technique

- Front : Next.js (`apps/web`)
- Backend : NestJS (`apps/api`)
- Database : PostgreSQL
- PDF Engine : Gotenberg
- Storage : filesystem + R2 (backup)
- Infra : Docker Compose

---

## 📍 Points critiques MVP

### 1. Contrat MEUBLE_RP Béton

Le contrat meublé résidence principale est généré via :

- table SQL `document_templates`
- template versionné `2026-02`

Fichier backend :

apps/api/src/documents/documents.service.ts


Fonction :

- `generateContractPdf()`

Doc complète :

➡️ `TEMPLATES.md`

---

### 2. Multi-locataires (Colocation)

RentalOS supporte :

- locataire principal
- plusieurs cotenants
- clause solidarité automatique

Bloc généré :

- `{{tenants_block}}`
- `{{colocation_clause}}`

---

### 3. Garants + Visale

Support prévu :

- garants multiples (`guarantors_json`)
- Visale (`visale_json`)

Blocs template :

- `{{guarantor_block}}`
- `{{visale_block}}`

---

### 4. Signature électronique (Point le plus sensible)

Route :

POST /api/documents/:id/sign


Règle OR :

- Si plusieurs locataires → `signerTenantId` obligatoire
- Document final généré uniquement quand :

✅ tous les locataires ont signé  
✅ le bailleur a signé

Sinon : état pending

Doc complète :

➡️ `SIGNATURES.md`

---

## 📌 Golden Workflow Terrain

1. Création bail MEUBLE_RP
2. Ajout cotenants dans `lease_tenants`
3. Génération contrat PDF
4. Signature locataires un par un
5. Signature bailleur
6. Génération automatique :

*_SIGNED_FINAL.pdf


---

## TODO Prochaines étapes

- Tests e2e signature multi-tenant
- UI Visale
- Contrat NU_RP
- Pack complet email automatique (Brevo)
- Phase Polish UX après complétude métier
