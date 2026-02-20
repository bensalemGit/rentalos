# RentalOS — MASTER HANDOVER

Dernière mise à jour : 2026-02-20  
Branche active (dev) : `fix/public-sign-tenant-id`  
Repo : https://github.com/bensalemGit/rentalos

---

## 1) Objectif

Ce document permet à un nouveau dev/chat de reprendre RentalOS immédiatement, sans te demander d’uploader des fichiers : **tout est sur GitHub**.

---

## 2) Produit (résumé)

RentalOS est un SaaS self-hosted de gestion locative :
- gestion baux (meublé RP / nu RP / saisonnier)
- locataires multiples (colocation)
- génération documents PDF (contrat, notice, EDL, inventaire)
- signature électronique (locataires + bailleur)
- génération du **pack final signé**
- audit trail + robustesse infra (backup/restore)

---

## 3) Architecture & Stack

### Host / Infra
- Windows 11 (host)
- Docker Desktop
- Compose : `C:\rentalos\infra\docker-compose.yml`

Services (typiques) :
- Postgres
- API NestJS
- Web Next.js
- Gotenberg (PDF)
- (option) pgAdmin

### Backend
- NestJS (TypeScript)
- PostgreSQL
- SQL natif (pas Prisma)
- documents : génération + stockage + finalisation
- signatures : persistance + audit log + SHA256
- public links : tokens hashés + purpose enforced

### Frontend
- Next.js App Router
- signature publique : `/public/sign/[token]`
- download public : `/public/download/[token]`

---

## 4) Sécurité Cloudflare Access

Host protégé via Cloudflare Access :
- **Service Token** : pour Postman/Newman/CI
- **Allow emails** : pour navigation humaine

Résultat attendu : l’API renvoie du JSON (pas de HTML CF).

Doc : `docs/architecture/CLOUDFLARE_ACCESS.md`

---

## 5) Flow signature — état VALIDÉ

### A) Tokens publics (table `public_links`)
- token stocké en **SHA256** (jamais le token en clair)
- `purpose` obligatoire :
  - `TENANT_SIGN_CONTRACT`
  - `LANDLORD_SIGN_CONTRACT`
  - `FINAL_PDF_DOWNLOAD`

Enforcement :
- `/api/public/sign` accepte uniquement TENANT/LANDLORD
- `/api/public/download-final` accepte uniquement FINAL_PDF_DOWNLOAD

### B) Signature locataire / bailleur
- Locataire : token public + signature (DataURL)
- Bailleur : token public + `role=landlord`

### C) Finalisation
Quand tous les locataires requis + bailleur ont signé :
- génération du PDF final : `*_SIGNED_FINAL.pdf`
- création d’un document final
- mise à jour du **document parent** :
  - `signed_final_document_id`
  - `finalized_at`
  - `signed_final_sha256`

### D) Download PDF final (public)
- création admin : `/api/public-links/final-pdf`
- download public : `/api/public/download-final?token=...`
- token **one-time** :
  - 1er download => 200 PDF
  - 2e download => 410 Gone (“Token already used”)

---

## 6) DB — champs clés

Table `documents` :
- `signed_final_document_id`
- `finalized_at`
- `signed_final_sha256`

Table `public_links` :
- `purpose`
- `expires_at`
- `consumed_at` (one-time download)

Doc : `docs/architecture/DATABASE_FINALIZATION.md`

---

## 7) Tests E2E (Newman)

Dossier : `tests/postman`

Commande :
```powershell
cd C:\rentalos\tests\postman
newman run .\rentalos_signature_flow_autofresh_v8.postman_collection.json -e .\rentalos_env_autofresh_v8.postman_environment.json