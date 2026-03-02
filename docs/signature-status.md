# Signature Status API

## Endpoint
GET `/api/signature-status?leaseId=<uuid>`

Auth: **JWT required**.

## Objectif
Exposer une vue unifiée de l’avancement des signatures pour un bail :

- **Contrat** : signatures locataires + bailleur, statut global du document.
- **Garanties CAUTION sélectionnées** : statut de signature par guaranteeId (multi).

## États renvoyés

### Contrat (document)
- `NOT_GENERATED` : pas de document contrat racine trouvé
- `DRAFT` : document présent, aucune signature
- `IN_PROGRESS` : au moins une signature posée, pas finalisé
- `SIGNED` : document finalisé (`signed_final_document_id` présent)

### Signatures individuelles
- `NOT_SENT` : aucun lien public actif et non signé
- `SENT` : lien public existant et non consommé
- `SIGNED` : signature posée (et/ou document finalisé selon contexte)

### Garanties (par guaranteeId)
- `NOT_SENT` : pas de lien + pas de signature
- `SENT` : lien public existant et non consommé
- `IN_PROGRESS` : signature(s) existante(s) sur l’acte mais pas finalisé
- `SIGNED` : `lease_guarantees.signed_final_document_id` renseigné

## Shape de réponse (high level)
```json
{
  "leaseId": "...",
  "generatedAt": "...",
  "contract": {
    "documentId": "...",
    "filename": "...",
    "signedFinalDocumentId": "...",
    "status": "DRAFT|IN_PROGRESS|SIGNED|NOT_GENERATED",
    "landlord": { "signatureStatus": "NOT_SENT|SENT|SIGNED", "lastLink": null },
    "tenants": [
      { "tenantId": "...", "fullName": "...", "signatureStatus": "NOT_SENT|SENT|SIGNED", "lastLink": null }
    ]
  },
  "guarantees": [
    {
      "guaranteeId": "...",
      "tenantFullName": "...",
      "guarantorFullName": "...",
      "actDocumentId": "...",
      "signedFinalDocumentId": "...",
      "signatureStatus": "NOT_SENT|SENT|IN_PROGRESS|SIGNED",
      "lastLink": null
    }
  ]
}