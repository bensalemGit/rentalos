# RentalOS — Signature publique et cockpit

Date : 2026-04-27  
Branche : `feat/public-sign`

## Deux modes de signature

### Cockpit `/sign/[leaseId]`

Signature sur place depuis le cockpit admin.

- Sélection d’un signataire.
- Session de signature guidée.
- Canvas de signature.
- Mention obligatoire pour garant.
- Appel API direct `POST /api/documents/:documentId/sign`.

### Public `/public/sign/[token]`

Signature distante via lien sécurisé.

- Le token porte un `purpose`.
- Le signataire et le document sont résolus depuis `public_links`.
- Le lien ne doit permettre que l’action prévue.

## Canonical public links

Le cockpit utilise progressivement le flux canonique :

```http
POST /api/canonical-public-links
```

Payload métier :

- `leaseId`
- `documentType`
- `phase`
- `signerRole`
- `tenantId`
- `guaranteeId`
- `ttlHours`
- `force`

## Purposes principaux

- `TENANT_SIGN_CONTRACT`
- `LANDLORD_SIGN_CONTRACT`
- `GUARANT_SIGN_ACT`
- `LANDLORD_SIGN_GUARANTEE_ACT`
- `TENANT_SIGN_EDL_ENTRY`
- `LANDLORD_SIGN_EDL_ENTRY`
- `TENANT_SIGN_INVENTORY_ENTRY`
- `LANDLORD_SIGN_INVENTORY_ENTRY`
- `TENANT_SIGN_EDL_EXIT`
- `LANDLORD_SIGN_EDL_EXIT`
- `TENANT_SIGN_INVENTORY_EXIT`
- `LANDLORD_SIGN_INVENTORY_EXIT`
- `FINAL_PDF_DOWNLOAD`
- `FINAL_PACK_DOWNLOAD`

## Règles de sécurité

- Signature et téléchargement sont deux purposes distincts.
- Un lien actif peut être renvoyé avec `force=true`.
- Un lien déjà finalisé doit renvoyer un état clair.
- Un lien garant doit être rattaché à `guaranteeId`.

## Points de contrôle QA

- Le bon signataire voit le bon document.
- Le garant ne peut pas signer l’acte d’un autre garant.
- Le bailleur résolu est bien le bailleur du projet / profil.
- Après signature finale, `signature-status` et `signature-workflow` remontent l’état signé.
