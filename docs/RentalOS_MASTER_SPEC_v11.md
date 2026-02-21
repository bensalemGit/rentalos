Parfait.
Là on parle sérieux 👍

Je vais te produire **une v11 réellement supérieure à la v10**, structurée comme un vrai document d’architecture + produit + juridique + ops.

Ce qui suit est **la version complète**, prête à remplacer intégralement v10 dans `/docs/RentalOS_MASTER_SPEC_v11.md`.

---

# RentalOS — Audit & Spécification Détaillée

## MASTER v11 (Source of Truth Unique)

Date : 2026-02-21
Repo : [https://github.com/bensalemGit/rentalos](https://github.com/bensalemGit/rentalos)
Statut : Infra PROD READY — Moteur Bail en consolidation juridique

---

# 0. PHILOSOPHIE DU PROJET

RentalOS repose sur 6 principes structurants :

1. Stack simple et maîtrisée
2. Zéro ORM, SQL explicite
3. Versionnement SQL incrémental clair
4. Sécurité par conception
5. Documents juridiquement fiables
6. PRA validé en conditions réelles

Ce document remplace intégralement le MASTER v10.

---

# 1. ARCHITECTURE TECHNIQUE RÉELLE

## 1.1 Environnement

* OS : Windows 11
* Docker Desktop
* Postgres 16
* Node / NestJS (API)
* Next.js 14 (App Router)
* Gotenberg (génération PDF)
* rclone (Cloudflare R2)
* Brevo (notifications)

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

⚠️ Aucun Prisma
⚠️ Aucun ORM
✔ SQL natif via `pg` pool

Raison :

* Maîtrise complète des requêtes
* Pas d’abstraction fragile
* Contrôle fin migrations
* Prévisibilité production

---

# 2. BASE DE DONNÉES

## 2.1 Versionnement

Dossier :

```
infra/postgres-init/
```

Fichiers 001 → 081
Versionnement incrémental.

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

### Sécurité

* public_links

---

## 2.3 Enums stratégiques

### lease_kind

* MEUBLE_RP
* NU_RP

### doc_type

* CONTRAT
* NOTICE
* EDL
* INVENTAIRE
* ANNEXE
* PHOTO
* PACK

### public_link_purpose

* TENANT_SIGN_CONTRACT
* FINAL_PDF_DOWNLOAD
* FINAL_PACK_DOWNLOAD

---

# 3. DOMAINE MÉTIER — BAUX

---

## 3.1 Types supportés

### 3.1.1 MEUBLE_RP

✔ Durée 1 an
✔ Dépôt max 2 mois
✔ Liste mobilier
✔ IRL
✔ Colocation
✔ Garants multiples
✔ Visale

### 3.1.2 NU_RP (à finaliser)

* Durée 3 ans
* Dépôt max 1 mois
* Diagnostics spécifiques
* Clause vide (pas de mobilier)

---

## 3.2 Structure d’un bail

Un bail est composé de :

* Identité bailleur (project_landlords)
* 1..n locataires (lease_tenants)
* Conditions financières (lease_amounts)
* Paramètres IRL
* Mode charges (forfait / provision)
* Dépôt
* Clauses spécifiques
* Annexes
* Documents générés

---

## 3.3 Colocation

Gérée via lease_tenants.

Points juridiques à solidifier :

* Clause solidarité complète
* Gestion départ colocataire
* Remplacement colocataire
* Répartition loyer interne

---

## 3.4 Garants

Support :

* 1..n personnes physiques
* Visale

À renforcer :

* Bloc caution multi-signature
* Mention manuscrite légale
* Plafond et durée engagement

---

## 3.5 Charges

Modes :

### Forfait

* Non régularisable

### Provision

* Régularisation annuelle
* Justificatifs requis
* Historique à prévoir

---

## 3.6 IRL

Stockage :

* irl_reference_quarter
* irl_reference_value

À développer :

* Calcul révision automatique
* Historique des indexations
* Avenant généré automatiquement

---

# 4. SYSTÈME DOCUMENTS

---

## 4.1 Templates

Stockés en base :

document_templates

Versions :

* 2026-02
* 2026-03
* 2026-04

---

## 4.2 Génération

Process :

1. Récupération template
2. Injection variables
3. HTML généré
4. Envoi à Gotenberg
5. PDF retourné
6. Stockage FS local

---

## 4.3 Signature

Flux :

1. Génération contrat
2. Lien public locataire
3. Signature canvas
4. Lien public bailleur
5. Signature
6. Finalisation
7. Génération PACK_FINAL

---

## 4.4 Finalisation

Ajouts récents :

* parent_document_id
* signed_final_document_id
* finalized_at
* signed_final_sha256

---

# 5. PUBLIC LINKS — SÉCURITÉ

---

## 5.1 Structure

public_links :

* token_hash
* lease_id
* document_id
* purpose
* expires_at
* used_count
* consumed_at

---

## 5.2 Sécurité

* Token jamais stocké en clair
* Hash SHA256
* One-shot pour final-pdf et final-pack
* consumed_at rempli à première utilisation
* 410 Gone ensuite

Testé via Postman v9 (32 assertions OK).

---

# 6. FINAL PDF / FINAL PACK

Endpoints :

* /api/public/download-final
* /api/public/download-pack

PACK_FINAL inclut :

* Contrat signé
* Notice
* EDL
* Inventaire
* Annexes

---

# 7. PRA — BACKUP & RESTORE

---

## 7.1 Backup quotidien

03:00 via Task Scheduler

Génère :

* Dump PGDMP
* Schema SQL
* Zip storage
* Zip config
* Manifest JSON
* SHA256
* Upload R2 crypté

Notification Brevo.

---

## 7.2 Restore

Procédure validée :

* pg_restore
* Vérification intégrité
* Temps < 10 minutes

Statut : Production-ready.

---

# 8. MIGRATIONS CRITIQUES RÉCENTES

* 075_documents_finalization.sql
* 076_backfill_documents_finalization.sql
* 077_public_links_consumed_at.sql
* 080_doc_type_pack_final.sql
* 081_public_links_purpose_final_pack.sql

---

# 9. ÉTAT ACTUEL DU PROJET

---

## Stable

✔ Infra
✔ Docker
✔ Signature flow
✔ Final pack
✔ Public links sécurisés
✔ Backup PROD READY

---

## Chantier en cours

🔧 Consolidation juridique MEUBLE_RP
🔧 Implémentation complète NU_RP
🔧 Automatisation IRL

---

# 10. RISQUES & CONTRÔLES

| Risque                          | Niveau | Mitigation        |
| ------------------------------- | ------ | ----------------- |
| Erreur clause juridique         | Moyen  | Relecture expert  |
| Mauvaise régularisation charges | Moyen  | Historique dédié  |
| Perte données                   | Faible | PRA validé        |
| Token leak                      | Faible | SHA256 + one-shot |

---

# 11. ROADMAP STRATÉGIQUE 2026

1. Finaliser MEUBLE_RP juridiquement béton
2. Déployer NU_RP
3. IRL automation
4. Avenants automatiques
5. Gestion remplacement colocataire
6. Paiements & quittances avancés

---

# 12. HANDOVER NOUVEAU CHAT

Stack confirmée :
Windows 11 + Docker + Postgres 16 + NestJS + Next 14
SQL natif uniquement
Aucun Prisma

Moteur signature complet
Public links one-shot
Backup validé

Objectif 2026 :
Transformer RentalOS en moteur bail juridiquement irréprochable.

---

