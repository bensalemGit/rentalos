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
Pages :
- `/public/sign/[token]` (locataire/bailleur)
- bailleur : `?role=landlord`

Règles UX :
- si colocation : afficher la liste des locataires et forcer la sélection
- envoyer `signerTenantId` (UUID) au backend

Le flux public n’est pas limité au seul contrat dans le système global :
le moteur de signature couvre également les actes de caution et d’autres documents signables via le backend.

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