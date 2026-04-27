# RentalOS — Règles Pack final

Date : 2026-04-27  
Branche : `feat/public-sign`

## Objectif

Le pack final est une archive PDF juridiquement exploitable. Il ne doit assembler que des documents dans l’état attendu.

## Composition entrée — bail meublé RP

Le pack final entrée contient, dans l’ordre :

1. contrat `SIGNED_FINAL`
2. acte(s) de caution `SIGNED_FINAL`
3. notice d’information
4. EDL entrée `SIGNED_FINAL`
5. inventaire entrée `SIGNED_FINAL`
6. annexe technique / journal d’audit

## Règle SIGNED_FINAL only

Documents obligatoirement signés final avant pack :

- `CONTRAT`
- `GUARANTOR_ACT`
- `EDL_ENTREE`
- `INVENTAIRE_ENTREE`
- `EDL_SORTIE`
- `INVENTAIRE_SORTIE`

La notice n’est pas signable et peut rester document racine.

## Readiness

`pack-final/readiness` doit bloquer la génération si un document requis manque ou si son `SIGNED_FINAL` manque.

Issues attendues possibles :

- `CONTRACT_SIGNED_FINAL_MISSING`
- `NOTICE_MISSING`
- `EDL_MISSING`
- `EDL_SIGNED_FINAL_MISSING`
- `INVENTAIRE_MISSING`
- `INVENTAIRE_SIGNED_FINAL_MISSING`

## Pack sortie

Le pack sortie dépend de :

- EDL sortie `SIGNED_FINAL`
- inventaire sortie `SIGNED_FINAL`
- attestation de sortie générée

## Journal d’audit

Le pack final inclut une annexe technique listant : document id, type, filename, SHA-256 original, SHA-256 signé et signatures.

## Points de contrôle QA

- Aucun EDL / inventaire racine non signé dans le pack final.
- Tous les actes de caution finalisés sont inclus.
- Les SHA-256 sont présents.
- L’ordre des pièces est stable.
