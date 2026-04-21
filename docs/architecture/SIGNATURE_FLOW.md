# Signature Flow — Documents, rôles, finalisation, liens publics

## 1) Overview

Le moteur de signature fonctionne par document.

Le flow supporte :
1) génération du document racine
2) création éventuelle de liens publics
3) collecte des signatures par rôle
4) vérification des signatures requises
5) génération du PDF `SIGNED_FINAL`
6) téléchargement du document signé ou d’un pack final
---

## 2) Public links (purpose enforced)

Purposes principaux observés dans le système :
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

Remarque :
le code contient des flux legacy et des flux plus récents ; tous les usages ne passent pas exactement par les mêmes endpoints historiques.
Règle :
- un token doit être utilisé uniquement pour son purpose.
- signature ≠ download.

---

## 3) Endpoints

### Admin
Exemples de familles d’endpoints utilisées :
- génération de documents
- envoi de liens de signature
- envoi de liens de téléchargement
- lecture du `signature-status`
- téléchargement de documents / signed final / pack

### Public
Exemples de familles d’endpoints utilisées :
- `GET /api/public/info?token=...`
- `POST /api/public/sign?token=...`
- endpoints de download public document / final / pack selon le `purpose`

Important :
les flux publics coexistent en plusieurs générations :
- flux historiques centrés contrat
- flux plus récents couvrant aussi garanties et téléchargements pack
- nouveau flux canonical unifié (`/api/canonical-public-links`)
---

## 3bis) Canonical Public Links (v2)

Un endpoint unique permet désormais de gérer tous les flux de signature :

POST `/api/canonical-public-links`

---

### 🎯 Objectif

Remplacer les endpoints legacy spécifiques par un routeur unique basé sur :

- documentType
- phase
- signerRole

---

### 📥 Payload

```json
{
  "leaseId": "uuid",
  "documentType": "EDL_EXIT",
  "phase": "EXIT",
  "signerRole": "TENANT",
  "tenantId": "uuid",
  "guaranteeId": null,
  "ttlHours": 72,
  "force": false
}

### Routing interne

Le backend route automatiquement vers le service métier approprié selon :

- `documentType`
- `phase`
- `signerRole`

Cas couverts :
- contrat
- acte de caution
- EDL entrée / sortie
- inventaire entrée / sortie

### Signature publique

La signature publique est ensuite exécutée via :

- `POST /api/public/sign`

### Renvoyer un lien

Le flag `force` permet :

- `force=false` → refus si un lien actif existe déjà
- `force=true` → renvoi / recréation du lien

### Cible

Le flux canonique est la cible de référence pour le cockpit admin.  
Les endpoints legacy spécialisés doivent être considérés comme transitoires.

---

## 4) Finalisation (DocumentsService)

La finalisation est gérée par document.

Cycle :
- signatures persistées dans `signatures`
- calcul des rôles requis selon le type de document
- génération de pages de signature
- fusion avec le PDF original
- création du document enfant `*_SIGNED_FINAL.pdf`
- mise à jour du document parent :
  - `signed_final_document_id`
  - `finalized_at`
  - `signed_final_sha256`

Documents supportés par la finalisation signée :
- `CONTRAT`
- `GUARANTOR_ACT`
- `EDL_ENTREE`
- `EDL_SORTIE`
- `INVENTAIRE_ENTREE`
- `INVENTAIRE_SORTIE`

---
## 5) Rôles requis par document

| Document | Signataires requis |
|----------|--------------------|
| CONTRAT | LOCATAIRE + BAILLEUR |
| GUARANTOR_ACT | GARANT + BAILLEUR |
| EDL_ENTREE | LOCATAIRE + BAILLEUR |
| EDL_SORTIE | LOCATAIRE + BAILLEUR |
| INVENTAIRE_ENTREE | LOCATAIRE + BAILLEUR |
| INVENTAIRE_SORTIE | LOCATAIRE + BAILLEUR |

---
## 6) Idempotence / anti-spam

Règles observées :
- si un document est déjà finalisé :
  - création de certains liens de signature refusée selon le flux
  - tentative de signature publique peut renvoyer un état du type `alreadyFinalized`
- les liens de download one-time sont consommés au premier usage
- signature et download restent séparés par `purpose`

---
## 7) Limite actuelle connue

Le pack final n’est pas encore strictement `SIGNED_FINAL only`.

Pour certains documents secondaires (notamment EDL / inventaire), le système peut encore utiliser :
- le `SIGNED_FINAL` si présent
- sinon le document racine

Ce comportement est legacy / transitoire.
Nouveaux purposes introduits pour EDL / inventaire entrée & sortie et signature bailleur des garanties.