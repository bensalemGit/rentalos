# /sign/[leaseId] — Pilotage signatures

La page `/sign/[leaseId]` est alimentée par l’API:
- GET `/api/signature-status?leaseId=...`

## Contrat
Affiche :
- statut doc (NOT_GENERATED/DRAFT/IN_PROGRESS/SIGNED)
- locataires (NOT_SENT/SENT/SIGNED)
- bailleur (NOT_SENT/SENT/SIGNED)

## Garanties (caution)
Affiche une ligne par `guaranteeId` (CAUTION sélectionnée) :
- statut (NOT_SENT/SENT/IN_PROGRESS/SIGNED)
- actions :
  - Envoyer lien garant (POST `/api/public-links/guarantor-sign/send-by-guarantee`)
  - Télécharger acte (source)
  - Télécharger signé (final)