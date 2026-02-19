# Signatures — Workflow Multi-locataires

RentalOS supporte la signature électronique des contrats.

---

## 🎯 Objectif

- permettre à chaque locataire de signer individuellement
- permettre au bailleur de signer ensuite
- générer automatiquement le PDF final signé

---

## API Endpoint

POST /api/documents/:documentId/sign


Payload :

```json
{
  "signerName": "Marie Martin",
  "signerRole": "LOCATAIRE",
  "signatureDataUrl": "data:image/png;base64,...",
  "signerTenantId": "uuid-du-locataire"
}

Champ critique : signerTenantId
Mono-locataire

champ optionnel

fallback automatique sur le tenant principal

Multi-locataires

Si tenants.length > 1 alors :

✅ signerTenantId obligatoire

Sinon erreur :
400 Unable to resolve signerTenantId for tenant signature

Backend Implementation
Fichier :

apps/api/src/documents/documents.service.ts

Fonction :

signDocumentMulti()

Guard principal :
if (tenants.length > 1 && !signerTenantId) {
  throw new BadRequestException(
    'Missing signerTenantId (required when multiple tenants)'
  );
}

Validation :
if (!allowed.has(effectiveTenantId)) {
  throw new BadRequestException(
    'signerTenantId is not a tenant of this lease'
  );
}

Finalisation automatique

Le document final est généré quand :

tous les locataires ont signé

bailleur a signé

Résultat :

nouveau PDF :
*_SIGNED_FINAL.pdf

document parent mis à jour :
documents.signed_final_document_id

UI Web

Fichier :
apps/web/app/sign/[leaseId]/page.tsx

Le front doit :

afficher tous les locataires

forcer la sélection du signataire

envoyer signerTenantId dans la requête
