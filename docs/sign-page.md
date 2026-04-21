# /sign/[leaseId] — Cockpit admin de signature

La page `/sign/[leaseId]` est le cockpit admin de signature.

Elle est principalement alimentée par :
- `GET /api/signature-status?leaseId=...`
- `GET /api/signature-workflow?leaseId=...`

Elle orchestre ensuite :
- les cartes signataires
- les actions d’envoi de liens
- la signature sur place
- les téléchargements documentaires

Les actions d’envoi / renvoi de liens passent désormais par :

- `POST /api/canonical-public-links`

Le cockpit ne doit plus appeler directement les endpoints legacy spécialisés (`/api/public-links/...`) pour les documents couverts par le flux canonique.

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


## EDL / Inventaires (entrée & sortie)

La page expose également les tâches de signature pour :

- EDL entrée
- Inventaire entrée
- EDL sortie
- Inventaire sortie

Pour chacun :
- statut document
- statuts par signataire
- état du dernier lien public
- possibilité d’envoi / renvoi
- signature sur place
- téléchargement du document source ou signé


## Règle UX — liens publics

Le libellé d’action dépend du workflow canonique :

- `publicLinkStatus = NEVER_SENT` → **Envoyer un lien**
- `publicLinkStatus = ACTIVE` → **Renvoyer le lien**
- `publicLinkStatus = EXPIRED` → **Renvoyer le lien**
- `signatureStatus = SIGNED` → action masquée ou désactivée

Le renvoi utilise `force = true`.


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

la page recharge :
- `GET /api/signature-status`
- `GET /api/signature-workflow`


## Bloc "Sortie locataire"

Permet :
- générer attestation sortie
- générer pack sortie

Conditions :
- EDL sortie signé final
- Inventaire sortie signé final

Les signatures EDL sortie / inventaire sortie sont pilotées par le même cockpit canonical que l’entrée :
- envoi de lien via `/api/canonical-public-links`
- renvoi via `force=true`
- signature publique via `/api/public/sign`