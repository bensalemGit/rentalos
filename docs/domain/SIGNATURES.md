# Signatures — Métier (documents, rôles, multi-signataires)

## Objectif

Le système de signature permet :
- de signer un document indépendamment des autres documents du bail
- de gérer plusieurs rôles signataires
- de finaliser automatiquement un `SIGNED_FINAL`
- de supporter le multi-locataires et les garanties

## Principe central

La signature est liée à un document précis.

Il n’existe pas de signature globale au dossier.

Un document signé produit son propre PDF `SIGNED_FINAL`.

---

## Public signature (UI)

Page principale :
- `/public/sign/[token]`

Le rôle signataire n’est pas piloté par un paramètre de page, mais par le token public et les métadonnées de `public_links`.

Règles UX :
- si colocation : afficher la liste des locataires et forcer la sélection
- envoyer `signerTenantId` (UUID) au backend

Le flux public n’est pas limité au seul contrat dans le système global :
le moteur de signature couvre également les actes de caution et d’autres documents signables via le backend.

---

## Payload signature (public)
`POST /api/public/sign`

```json
{
  "signerName": "Marie Martin",
  "signerRole": "LOCATAIRE",
  "signatureDataUrl": "data:image/png;base64,...",
  "signerTenantId": "uuid-du-locataire"
}

Dans le flux public moderne, le front envoie principalement :

```json
{
  "token": "...",
  "signatureDataUrl": "data:image/png;base64,..."
}

Le backend résout ensuite le rôle, le document et l’identité signataire à partir du token.

Rôles observés :
- `LOCATAIRE`
- `BAILLEUR`
- `GARANT`

Selon le document, tous les rôles ne sont pas requis.

---

## Documents signables

- `CONTRAT`
- `GUARANTOR_ACT`
- `EDL_ENTREE`
- `EDL_SORTIE`
- `INVENTAIRE_ENTREE`
- `INVENTAIRE_SORTIE`

## Règles métier

- contrat : locataire(s) + bailleur
- acte de caution : garant + bailleur
- EDL / inventaire : locataire(s) + bailleur
- VISALE : pas de signature garant


## Sortie locataire

La sortie est un flux distinct de l’entrée.

Documents concernés :
- EDL_SORTIE
- INVENTAIRE_SORTIE

Après signature :
→ génération des signed_final
→ possibilité de générer :
   - attestation sortie
   - pack sortie


---

## Canonical public links

La création des liens de signature est désormais unifiée via :

`POST /api/canonical-public-links`

Chaque demande est décrite par :

- `leaseId`
- `documentType`
- `phase`
- `signerRole`
- `tenantId` si signataire locataire
- `guaranteeId` si document de garantie
- `force` pour renvoi

Cas couverts :
- contrat
- acte de caution
- EDL entrée / sortie
- inventaire entrée / sortie


## Purposes publics observés

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

## Multi-garant (2026-04)

Un bail peut contenir plusieurs garanties.

Chaque garantie est liée à :
- un garant
- un locataire ciblé

Relation :
lease_guarantees
  → guarantor_id
  → tenant_id (IMPORTANT)

Un garant ne couvre JAMAIS implicitement tous les locataires.

## Ordre de signature réel

Ordre logique :

1. Locataires
2. Garants (chacun pour son locataire)
3. Bailleur

Le système autorise :
- cockpit (ordre libre)
- public (ordre contrôlé par token)

Le statut final est calculé côté backend.