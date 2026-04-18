# /sign/[leaseId] — Cockpit admin de signature

La page `/sign/[leaseId]` est le cockpit admin de signature.

Elle est principalement alimentée par :
- `GET /api/signature-status?leaseId=...`

Elle orchestre ensuite :
- les cartes signataires
- les actions d’envoi de liens
- la signature sur place
- les téléchargements documentaires

## Contrat

La page expose l’état du contrat :
- statut document : `NOT_GENERATED` / `DRAFT` / `IN_PROGRESS` / `SIGNED`
- statuts des locataires
- statut du bailleur
- actions de génération, envoi, signature, téléchargement selon l’état

## Garanties (caution)

La page affiche une ligne / carte par `guaranteeId` sélectionné de type `CAUTION`.

Pour chaque garantie :
- statut global de l’acte
- état de progression de signature
- actions :
  - envoyer lien garant
  - télécharger acte source
  - télécharger signed final

Règle UX importante :
si l’acte est en cours, l’UI doit expliciter quel rôle a déjà signé et quel rôle reste à signer.
Exemples :
- `Garant signé • Bailleur à signer`
- `Bailleur signé • Garant à signer`

## Structure UX réelle

Le cockpit est centré signataires.

Zones principales :
- hero / progression
- cartes signataires
- panneau de signature sur place
- section documents
- historique

Le panneau de droite joue le rôle de terminal universel de signature sur place.

## Rafraîchissement

Après chaque action structurante :
- génération document
- envoi lien
- signature
- finalisation

la page recharge les statuts via `GET /api/signature-status`.


## Bloc "Sortie locataire"

Permet :
- générer attestation sortie
- générer pack sortie

Conditions :
- EDL sortie signé final
- Inventaire sortie signé final