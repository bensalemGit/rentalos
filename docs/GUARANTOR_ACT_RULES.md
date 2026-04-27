# RentalOS — Règles Acte de caution / Multi-garants

Date : 2026-04-27  
Branche : `feat/public-sign`

## Objectif

Un acte de caution est rattaché à une garantie sélectionnée (`lease_guarantees`) et à un locataire cible. En colocation, chaque garant doit signer uniquement l’acte qui concerne le locataire qu’il garantit.

## Source de vérité

- `lease_guarantees.id` = identité métier de la garantie.
- `lease_guarantees.lease_tenant_id` = rattachement au locataire garanti.
- `lease_guarantees.guarantor_act_document_id` = acte racine généré.
- `lease_guarantees.signed_final_document_id` = acte signé final.
- `documents.parent_document_id` = lien entre racine et `SIGNED_FINAL`.

## Règles de génération

- 1 garantie CAUTION sélectionnée = 1 acte de caution.
- Le filename contient une clé stable par garantie pour éviter les collisions.
- Si l’acte existe déjà, il est réutilisé et réattaché à la garantie.
- Le template doit afficher le locataire garanti, pas la liste globale des colocataires.

## Règles de signature

Signataires requis pour `GUARANTOR_ACT` :

1. `GARANT`
2. `BAILLEUR`

La finalisation ne doit produire un `SIGNED_FINAL` que lorsque les deux signatures sont présentes.

## Mention garant

La mention recopiée est contrôlée côté UI et côté API.

Le contrôle API vérifie les fragments juridiques essentiels et le montant, sans dépendre strictement des retours à la ligne ou de la ponctuation.

## Attestation de signature

L’annexe de signature doit afficher :

```text
Signataire : Nom réel (ROLE)
```

Pour le bailleur, le nom réel vient du profil bailleur résolu via projet / landlord profile. Ne pas afficher seulement `Bailleur (BAILLEUR)` si le nom est connu.

## Points de contrôle QA

- Chaque acte vise le bon locataire garanti.
- Chaque acte contient le bon garant.
- Le plafond et la durée sont cohérents avec le bail.
- Les signatures garant + bailleur sont présentes dans le `SIGNED_FINAL`.
- `lease_guarantees.signed_final_document_id` est renseigné après finalisation.
