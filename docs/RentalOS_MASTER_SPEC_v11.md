---

# RentalOS — Audit & Spécification Détaillée

## MASTER v11 — Source of Truth Unique

Date : 2026-02-23
Repo : [https://github.com/bensalemGit/rentalos](https://github.com/bensalemGit/rentalos)
Branche : chore/audit-docs
Statut : Infra PROD READY — Moteur Bail MEUBLÉ RP stabilisé — Freeze Template sécurisé

---

# 0. PHILOSOPHIE DU PROJET

RentalOS repose sur 8 principes structurants :

1. Stack simple et maîtrisée
2. Zéro ORM — SQL explicite
3. Versionnement SQL incrémental traçable
4. Sécurité par conception
5. Documents juridiquement robustes
6. PRA validé en conditions réelles
7. Templates contractuels versionnés et figés
8. Séparation stricte UI / API / DB

Ce document remplace intégralement v10.

---

# 1. ARCHITECTURE TECHNIQUE RÉELLE

## 1.1 Environnement

* OS : Windows 11
* Docker Desktop
* Postgres 16
* Node + NestJS (API)
* Next.js 14 (App Router)
* Gotenberg (PDF engine)
* rclone (Cloudflare R2)
* Brevo (notifications)
* Cloudflare Access (protection API)

---

## 1.2 Containers Docker

Définis dans :

```
infra/docker-compose.yml
```

Services :

* postgres
* api
* web
* gotenberg
* pgadmin

Architecture mono-host, multi-container.

---

## 1.3 Politique ORM

Aucun Prisma.
Aucun ORM.

✔ SQL natif via `pg` pool
✔ Requêtes explicites
✔ Migrations versionnées
✔ Contrôle total en production

---

# 2. BASE DE DONNÉES

## 2.1 Versionnement

Dossier :

```
infra/postgres-init/
```

Migrations incrémentales 001 → 088.

### Migrations récentes majeures

086_contract_meuble_rp_template_2026-04_freeze.sql
087_contract_meuble_rp_template_2026-04_freeze_fix.sql
087_contract_meuble_rp_template_2026-04_freeze_from_repo.sql
088_sanitize_document_templates_contract_meuble_rp_2026-04.sql

Toutes APPLIED.

---

## 2.2 Tables cœur métier

### Baux

* leases
* lease_tenants
* lease_amounts

### Immobilier

* projects
* units
* project_landlords

### Documents

* documents
* document_templates

### Documents de sortie

- ATTESTATION_SORTIE
- PACK_EDL_INV_SORTIE

Contraintes :
- dépendance aux signed_final
- génération manuelle uniquement

### Sécurité

* public_links

---

## 2.3 Enums stratégiques

### lease_kind

* MEUBLE_RP
* NU_RP
* SAISONNIER (prévu)

### doc_type

Types observés / structurants dans le système :

* CONTRAT
* NOTICE
* GUARANTOR_ACT
* EDL_ENTREE
* EDL_SORTIE
* INVENTAIRE_ENTREE
* INVENTAIRE_SORTIE
* ANNEXE
* PHOTO
* PACK
* PACK_FINAL

Remarque :
la documentation historique simplifiait parfois `EDL` / `INVENTAIRE`, mais le code actuel distingue entrée / sortie.

### public_link_purpose

Purposes historiques et actuels observés :

* TENANT_SIGN_CONTRACT
* LANDLORD_SIGN_CONTRACT
* GUARANTOR_SIGN_ACT
* FINAL_PDF_DOWNLOAD
* FINAL_PACK_DOWNLOAD

---

# 3. DOMAINE MÉTIER — BAUX

---

## 3.1 MEUBLE_RP (stabilisé terrain)

✔ Durée 12 mois
✔ Dépôt ≤ 2 mois
✔ IRL
✔ Colocation
✔ Garants multiples
✔ Visale
✔ Bloc désignation complet
✔ Charges forfait / provision

Normalisation des clauses via :

```
normalizeLeaseTermsForContract()
```

Source de vérité : `lease_terms` JSON en DB.

---

## 3.2 Structure complète d’un bail

Un bail contient :

* Bailleur (project_landlords)
* 1..n locataires (lease_tenants)
* Montants (lease_amounts)
* lease_terms JSON
* Désignation structurée
* Bloc IRL
* Bloc garants
* Bloc colocation
* Documents générés

---

# 4. SYSTÈME DOCUMENTS

---

## 4.1 Templates versionnés

Stockés en DB : `document_templates`

Version active MEUBLE_RP :
`2026-04`

Source physique figée :

```
infra/templates/contract/MEUBLE_RP_2026-04.html
```

---

## 4.2 Freeze Template — Historique réel

Problèmes rencontrés :

1. CRLF en tête du HTML (`0d0a3c21...`)
2. Pollution export SQL (ligne "(1 row)")
3. Mojibake UTF-8 (Ã / Â)
4. Téléchargement PDF retournant HTML Cloudflare

Solution progressive :

### 086

Premier freeze manuel

### 087_fix

Correction intermédiaire

### 087_from_repo

Source de vérité = fichier repo versionné

### 088_sanitize

Nettoyage DB :

* suppression `\r`
* `ltrim()`
* garantie que le template commence par `<!doctype html>`

---

## 4.3 Hardening newline

Ajout `.gitattributes` :

Forcer LF sur :

* *.sql
* *.html
* *.md

Évite CRLF Windows dans migrations.

---

## 4.4 Génération PDF

Flow :

1. fetchLeaseBundle()
2. normalizeLeaseTermsForContract()
3. Injection vars
4. applyVars()
5. Guard placeholders non résolus
6. htmlToPdfBuffer (Gotenberg)
7. SHA256
8. Insert table documents

---

## 4.5 Sécurisation applyVars

Ajout :

* log clés non résolues
* guard si `{{...}}` reste dans HTML
* log mojibake si "Ã" ou "Â" détecté

---

## 4.6 Téléchargement PDF — Protection Cloudflare

Problème identifié :

Si CF headers absents → HTML Cloudflare téléchargé au lieu PDF.

Solution script :

* Inclure `CF-Access-Client-Id`
* Inclure `CF-Access-Client-Secret`
* Vérifier magic bytes `%PDF`

---

# 5. UI — NORMALISATION A1 (CRITIQUE)

---

## 5.1 Problème

`GET /leases/:id` retournait plusieurs shapes :

* { lease, tenants, amounts }
* { data: { ... } }
* objet direct
* array fallback

Cela cassait certaines pages.

---

## 5.2 Solution

Ajout :

```
apps/web/app/_lib/extractLease.ts
```

Fonction :

```
extractLeaseBundle(bundle)
```

Retourne toujours :

{
lease,
tenants,
amounts
}

---

## 5.3 Pages patchées

* dashboard/leases/page.tsx
* sign/[leaseId]/page.tsx

Aucun accès direct à j.lease désormais.

---

# 6. SIGNATURE FLOW

---

## 6.1 Flux complet

1. Génération d’un document racine
2. Création éventuelle de liens publics selon le rôle / le document
3. Signature(s) par rôle
4. Vérification des signatures requises
5. Génération du `SIGNED_FINAL`
6. Assemblage documentaire éventuel (pack final)
7. Download public ou admin selon le flux

---

## 6.2 Finalisation

Colonnes ajoutées :

* parent_document_id
* signed_final_document_id
* finalized_at
* signed_final_sha256

La finalisation s’applique désormais à plusieurs types documentaires :
- contrat
- acte de caution
- EDL entrée / sortie
- inventaire entrée / sortie

---

# 7. PUBLIC LINKS — SÉCURITÉ

---

Structure :

* token_hash (SHA256)
* lease_id
* document_id
* purpose
* expires_at
* used_count
* consumed_at

One-shot enforced.

410 Gone après usage.

Testé via Postman (32 assertions OK).

---

# 8. PRA — BACKUP & RESTORE

---

## Backup quotidien 03:00

Génère :

* dump PGDMP
* schema SQL
* zip storage
* zip config
* manifest JSON
* SHA256
* upload R2

Notification Brevo.

---

## Restore validé

Temps < 10 minutes.

Statut : PROD READY.

---

# 9. ÉTAT ACTUEL

---

## Stable

✔ Infra Docker
✔ Migrations 001 → 088
✔ Freeze template sécurisé
✔ Sanitization CRLF
✔ Mojibake contrôlé
✔ UI A1 stabilisée
✔ Signature flow complet
✔ Public links one-shot
✔ Backup validé

---

## En cours

🔧 Consolidation juridique MEUBLE_RP
🔧 Implémentation NU_RP
🔧 IRL automation

---

# 10. RISQUES

| Risque              | Niveau | Mitigation        |
| ------------------- | ------ | ----------------- |
| Clause incorrecte   | Moyen  | Audit juridique   |
| Mauvais IRL         | Moyen  | Automatisation    |
| Mauvais template    | Faible | Freeze + sanitize |
| HTML Cloudflare PDF | Faible | Magic byte check  |
| Token leak          | Faible | SHA256 + one-shot |

---

# 11. ROADMAP 2026

1. Finaliser MEUBLE_RP juridiquement
2. NU_RP complet
3. IRL automatique
4. Avenants
5. Remplacement colocataire
6. Paiements & quittances avancées

---

# 12. HANDOVER READY

Stack confirmée
SQL natif
Aucun ORM
Template figé repo
Sanitization DB en place
UI shape normalisée
Cloudflare PDF protégé

Objectif 2026 :
Moteur bail juridiquement irréprochable.

---

✔ documents.service.ts non commité volontairement
✔ Suite à traiter dans nouveau chat

---


## Baux – Charges mode

UI création : chargesMode envoyé au POST /leases
UI modale édition : affichage du charges_mode courant

## Garanties – état réel

Le système supporte :
- aucune garantie
- VISALE
- caution

Le modèle principal est `lease_guarantees`.

Règles métier :
- VISALE : pas de signature garant
- caution : acte indépendant à signer par GARANT + BAILLEUR

Des champs / flux legacy peuvent encore coexister côté bail, mais ne constituent plus la cible principale.

## Visale
Source de vérité : lease_terms.visale = { enabled, visaNumber, ...optionnel }