# RentalOS — Documentation

Bienvenue dans la documentation de **RentalOS**.

Objectifs :
- reprise immédiate (dev/chat)
- documentation durable (architecture + runbooks)
- DR/PRA opérationnel
- flow signature + finalisation documentaire + downloads publics **testés**

---

## Démarrer ici (obligatoire)

- **Handover master** : `docs/handover/MASTER_HANDOVER.md`
- **Signature flow (tech)** : `docs/architecture/SIGNATURE_FLOW.md`
- **DB finalisation & public links** : `docs/architecture/DATABASE_FINALIZATION.md`
- **Newman runbook** : `docs/testing/NEWMAN_RUNBOOK.md`
- **État hybride du système** : `docs/system-state.md`

---

## Arborescence

- `docs/handover/` : passation + DR
- `docs/architecture/` : design technique (signature, DB, CF Access)
- `docs/runbooks/` : exploitation / ops
- `docs/domain/` : métier (signatures, templates)
- `docs/testing/` : tests (Newman/CI)

---

## État actuel (mars 2026)

✅ Signature documentaire par document avec génération de `SIGNED_FINAL`  
✅ Contrat, acte de caution, EDL et inventaire supportent la finalisation signée  
✅ Cockpit admin `/sign/[leaseId]` centré signataires  
✅ Signature publique par lien pour plusieurs rôles / usages  
✅ `signed_final_document_id`, `finalized_at`, `signed_final_sha256` présents en base  
✅ Download public séparé de la signature via `purpose` dédié  
⚠️ Pack final encore hybride : certains documents peuvent fallback sur le document racine si le `SIGNED_FINAL` n’existe pas


## Point d’attention

La documentation décrit désormais le comportement réel du code, y compris les zones hybrides / legacy encore présentes :
- `lease_tenants` vs `leases.tenant_id`
- `lease_guarantees` vs champs legacy de bail
- `SIGNED_FINAL` document par document
- fallback root encore présent dans certains flux de pack final

---

## Changelog
- `docs/CHANGELOG.md`