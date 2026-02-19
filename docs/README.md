# RentalOS — Documentation Index

Bienvenue dans la documentation officielle de **RentalOS**.

Objectifs :

- Centraliser toute la documentation projet
- Permettre une reprise immédiate par un nouveau dev/chat
- Garantir un PRA/DR opérationnel (<10 min)
- Sécuriser le workflow métier : **Bail → Contrat meublé béton**
- Encadrer la signature électronique multi-locataires

---

## 📌 Documents essentiels
---

## 🔗 Liens rapides

- Passation : **HANDOVER.md**
- Signature électronique : **SIGNATURES.md**
- Templates contrats : **TEMPLATES.md**
- PRA / Restore : **DR_RUNBOOK.md**


### 🚀 Onboarding / Passation

- **HANDOVER.md**  
  → Document principal de reprise projet (nouveau dev/chat)

### ✍️ Signatures électroniques

- **SIGNATURES.md**  
  → Workflow complet multi-locataires + bailleur + finalisation PDF

### 📄 Templates juridiques (contrats)

- **TEMPLATES.md**  
  → Gestion SQL des templates + variables + versioning

---

## 🛡️ PRA / DR (Backup & Restore)

- **DR_RUNBOOK.md**  
  → Restore complet en <10 min

- **OPS_CHECKLIST.md**  
  → Commandes réflexes d’exploitation

- **CHANGELOG.md**  
  → Historique des évolutions

---

## 📍 État actuel (février 2026)

✅ Backup daily + R2 chiffré + FailOnly email  
✅ Contrat MEUBLE_RP multi-locataires + clause colocation  
✅ Signature multi-tenant : tenantId requis si plusieurs locataires  
✅ Final PDF généré uniquement quand tous ont signé  

---

## Next Step (priorité)

1. Automatiser un test E2E signatures (2 locataires + bailleur)
2. Finaliser le contrat “bail béton” (garants multi + visale UI)
3. Améliorer création bail multi-locataires dès l’écran initial
