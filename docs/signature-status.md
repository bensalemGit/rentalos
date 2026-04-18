# Signature Status API

## Endpoint
GET `/api/signature-status?leaseId=<uuid>`

Auth: **JWT required**.

## Objectif

Exposer une vue unifiée de l’avancement documentaire et des signatures pour un bail.

Le `signature-status` sert de vue métier agrégée pour le cockpit admin.

Il couvre notamment :
- contrat
- garanties de type caution
- états documentaires
- signatures individuelles
- liens publics utiles au cockpit

## États renvoyés

### Contrat (document)
- `NOT_GENERATED` : aucun document contrat racine trouvé
- `DRAFT` : document présent, aucune signature
- `IN_PROGRESS` : au moins une signature posée, document non finalisé
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

Lorsque l’état est `IN_PROGRESS`, l’UI doit pouvoir expliciter quel rôle a déjà signé et quel rôle reste à signer.
Exemples :
- garant signé / bailleur en attente
- bailleur signé / garant en attente

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

- Cette API fournit une vue agrégée orientée cockpit, pas un miroir brut des tables.
- Elle cohabite avec un système encore hybride :
  - multi-locataires via `lease_tenants`
  - garanties via `lease_guarantees`
  - certains flux publics encore legacy
- Le contrat et les actes de caution sont les éléments les plus complètement exposés aujourd’hui dans cette vue.