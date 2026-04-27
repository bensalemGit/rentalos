# Signature Status API

## Endpoint
GET `/api/signature-status?leaseId=<uuid>`

Auth: **JWT required**.

## Objectif

Exposer une vue unifiée de l’avancement documentaire et des signatures pour un bail.

Le `signature-status` sert de vue métier agrégée pour le cockpit admin.
Le cockpit moderne consomme également `GET /api/signature-workflow?leaseId=...`, qui projette cette vue agrégée en tâches canoniques orientées UI.

Il couvre notamment :
- contrat
- garanties de type caution
- EDL entrée / sortie
- inventaire entrée / sortie
- états documentaires
- signatures individuelles
- liens publics utiles au cockpit

## États renvoyés

### Contrat (document)
- `NOT_GENERATED` : aucun document contrat racine trouvé
- `DRAFT` : document présent, aucune signature
- `IN_PROGRESS` : au moins une signature posée, document non finalisé
- `SIGNED` : document finalisé (`signed_final_document_id` présent)

### EDL / Inventaire (document)
- `NOT_GENERATED` : aucun document racine trouvé pour ce type
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
    "landlord": {
      "signatureStatus": "NOT_SENT|SENT|SIGNED",
      "lastLink": null
    },
    "tenants": [
      {
        "tenantId": "...",
        "fullName": "...",
        "signatureStatus": "NOT_SENT|SENT|SIGNED",
        "lastLink": null
      }
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
  ],
  "edl": {
    "entry": {
      "documentId": "...",
      "signedFinalDocumentId": "...",
      "status": "NOT_GENERATED|DRAFT|IN_PROGRESS|SIGNED",
      "landlordLastLink": null,
      "tenantLastLinkByTenantId": {}
    },
    "exit": {
      "documentId": "...",
      "signedFinalDocumentId": "...",
      "status": "NOT_GENERATED|DRAFT|IN_PROGRESS|SIGNED",
      "landlordLastLink": null,
      "tenantLastLinkByTenantId": {}
    }
  },
  "inventory": {
    "entry": {
      "documentId": "...",
      "signedFinalDocumentId": "...",
      "status": "NOT_GENERATED|DRAFT|IN_PROGRESS|SIGNED",
      "landlordLastLink": null,
      "tenantLastLinkByTenantId": {}
    },
    "exit": {
      "documentId": "...",
      "signedFinalDocumentId": "...",
      "status": "NOT_GENERATED|DRAFT|IN_PROGRESS|SIGNED",
      "landlordLastLink": null,
      "tenantLastLinkByTenantId": {}
    }
  }
}

Le cockpit admin ne pilote plus directement les familles d’endpoints legacy.

Il consomme :

- `GET /api/signature-status?leaseId=...`
- `GET /api/signature-workflow?leaseId=...`

Le `signature-workflow` projette les données en tâches canoniques portant notamment :

- `documentType`
- `phase`
- `signerRole`
- `signerRef`
- `signatureStatus`
- `publicLinkStatus`

Règle UI :
- `NEVER_SENT` → afficher **Envoyer un lien**
- `ACTIVE` / `EXPIRED` → afficher **Renvoyer le lien**
- `SIGNED` → action désactivée

## SIGNED_FINAL

Un document est considéré SIGNED_FINAL uniquement si :
- tous les signataires requis ont signé

Cas multi-garant :
- chaque garant doit signer
- chaque locataire doit signer
- le bailleur doit signer

Sinon :
→ statut PARTIAL

## Impact sur le pack

Le pack final ne doit contenir QUE :
- des documents SIGNED_FINAL

Exclure :
- PARTIAL
- DRAFT