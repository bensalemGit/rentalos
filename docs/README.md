# RentalOS — Documentation

Bienvenue dans la documentation de **RentalOS**.

Objectifs :
- reprise immédiate (dev/chat)
- documentation durable (architecture + runbooks)
- DR/PRA opérationnel
- flow signature + finalisation + download PDF final **testé Newman**

---

## Démarrer ici (obligatoire)

- **Handover master** : `docs/handover/MASTER_HANDOVER.md`
- **Signature flow (tech)** : `docs/architecture/SIGNATURE_FLOW.md`
- **DB finalisation & public links** : `docs/architecture/DATABASE_FINALIZATION.md`
- **Newman runbook** : `docs/testing/NEWMAN_RUNBOOK.md`

---

## Arborescence

- `docs/handover/` : passation + DR
- `docs/architecture/` : design technique (signature, DB, CF Access)
- `docs/runbooks/` : exploitation / ops
- `docs/domain/` : métier (signatures, templates)
- `docs/testing/` : tests (Newman/CI)

---

## État actuel (février 2026)

✅ Signature publique locataire + bailleur (tokens)  
✅ Finalisation PDF “SIGNED_FINAL” (quand toutes signatures présentes)  
✅ Champs DB finalisation : `finalized_at`, `signed_final_sha256`  
✅ Token download PDF final : `FINAL_PDF_DOWNLOAD` **one-time** (2e call => 410 Gone)  
✅ Enforcements purpose : signature ≠ download  
✅ Newman : 0 failed sur le flow complet

---

## Changelog
- `docs/CHANGELOG.md`