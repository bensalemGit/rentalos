# Signature Flow — Public Tokens, Signature, Finalisation, Download

## 1) Overview
Le flow supporte :
1) création de liens publics (tokens)
2) signature locataire / bailleur
3) finalisation automatique PDF final
4) création d’un token download du PDF final
5) téléchargement public one-time

---

## 2) Public links (purpose enforced)

Purposes :
- `TENANT_SIGN_CONTRACT`
- `LANDLORD_SIGN_CONTRACT`
- `FINAL_PDF_DOWNLOAD`

Règle :
- un token doit être utilisé uniquement pour son purpose.
- signature ≠ download.

---

## 3) Endpoints

### Admin
- `POST /api/auth/login` -> JWT

- `POST /api/public-links/tenant-sign/send`
  - purpose : `TENANT_SIGN_CONTRACT`
  - si contrat déjà finalisé -> `409 Conflict`

- `POST /api/public-links/landlord-sign`
  - purpose : `LANDLORD_SIGN_CONTRACT`
  - si contrat déjà finalisé -> `409 Conflict`
  - publicUrl : `/public/sign/<token>?role=landlord`

- `POST /api/public-links/final-pdf`
  - purpose : `FINAL_PDF_DOWNLOAD`
  - prérequis : contrat finalisé

### Public
- `GET /api/public/info?token=...`
  - valide token non expiré/non invalidé

- `POST /api/public/sign?token=...`
  - accepte uniquement purpose tenant/landlord
  - payload : `signatureDataUrl`, `signerRole`, `signerTenantId` (si multi-tenant)
  - si déjà finalisé : renvoie 200 `alreadyFinalized: true` (pas de nouvelle signature)

- `GET /api/public/download-final?token=...`
  - accepte uniquement purpose `FINAL_PDF_DOWNLOAD`
  - token one-time :
    - 1er download => 200 PDF
    - 2e download => 410 Gone

---

## 4) Finalisation (DocumentsService)
Conditions :
- tous les locataires requis signés
- bailleur signé
=> générer doc final `*_SIGNED_FINAL.pdf`
=> update doc parent :
- `signed_final_document_id`
- `finalized_at`
- `signed_final_sha256`

---

## 5) Idempotence / anti-spam
- si contrat finalisé :
  - création liens signature => 409
  - tentative de signature => retour 200 `alreadyFinalized` (pas d’insert signature)
- download token :
  - consommé sur 1er download
  - replay => 410 Gone