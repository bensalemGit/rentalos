# Signatures — Métier (Multi-locataires)

## Objectif
- permettre à chaque locataire de signer individuellement
- permettre au bailleur de signer ensuite
- générer automatiquement le PDF final signé

---

## Public signature (UI)
Pages :
- `/public/sign/[token]` (locataire/bailleur)
- bailleur : `?role=landlord`

Règles UX :
- si colocation : afficher la liste des locataires et forcer la sélection
- envoyer `signerTenantId` (UUID) au backend

---

## Payload signature (public)
`POST /api/public/sign?token=...`

```json
{
  "signerName": "Marie Martin",
  "signerRole": "LOCATAIRE",
  "signatureDataUrl": "data:image/png;base64,...",
  "signerTenantId": "uuid-du-locataire"
}