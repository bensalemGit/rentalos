# System State — état hybride réel

## Objectif

Ce document décrit les zones hybrides encore présentes dans le code afin d’éviter toute lecture trop théorique de la documentation.

## 1. Locataires

Deux logiques coexistent :
- modèle actuel : `lease_tenants`
- compatibilité legacy : `leases.tenant_id`

La cible produit est centrée sur `lease_tenants`.

## 2. Garanties

Deux couches coexistent :
- modèle actuel : `lease_guarantees`
- champs / flux legacy encore présents autour du bail

La cible produit est centrée sur `lease_guarantees`.

## 3. Signature

La signature est désormais portée par document :
- stockage des signatures
- calcul des rôles requis
- génération de `SIGNED_FINAL`

Il n’existe pas de signature globale du dossier dans la cible fonctionnelle.

## 4. Pack final

Le système tend vers un pack composé uniquement de `SIGNED_FINAL`.

État actuel :
- contrat signé final exigé
- actes de caution signés finals pris en compte
- certains documents secondaires peuvent encore fallback sur leur document racine

## 5. Public links

Les flux publics ont évolué par couches :
- flux historiques orientés contrat
- flux plus récents couvrant d’autres usages

La documentation doit toujours privilégier le comportement réellement observé dans le code.