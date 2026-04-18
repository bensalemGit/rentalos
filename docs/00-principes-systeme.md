# RentalOS — Principes système (vérité code)

## 1. Source de vérité

Cette documentation reflète le comportement réel du code (backend + frontend), pas une cible théorique.

## 2. Document = unité juridique

Un document signé est toujours un PDF autonome incluant ses pages de signature.

Chaque document possède potentiellement :
- un document racine (généré)
- un document SIGNED_FINAL (juridiquement valide)

## 3. SIGNED_FINAL

Un document est considéré signé uniquement si :
- toutes les signatures requises sont collectées
- un PDF SIGNED_FINAL est généré

Le document racine n’est pas juridiquement suffisant.

## 4. Pack final

Le pack final assemble plusieurs documents :
- contrat SIGNED_FINAL (obligatoire)
- actes de caution SIGNED_FINAL
- notice
- EDL
- inventaire
- journal d’audit

⚠️ Actuellement, certains documents peuvent être inclus sans SIGNED_FINAL (fallback legacy).

## 5. Signature

Les signatures sont :
- stockées par document
- liées à un rôle (LOCATAIRE, BAILLEUR, GARANT)

## 6. Modèle hybride

Le système contient des couches legacy et des couches refactorées :
- multi-locataires : `lease_tenants`
- legacy locataire : `leases.tenant_id`
- garanties : `lease_guarantees` + legacy

Toute évolution doit tenir compte de cet état hybride.