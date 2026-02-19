# RentalOS — Documentation Index

Bienvenue dans la documentation officielle de **RentalOS**.

Objectif :

- centraliser toute la documentation projet
- permettre une reprise rapide par un nouveau dev/chat
- garantir un runbook DR complet
- sécuriser le contrat meublé RP ("bail béton")
- formaliser le workflow multi-locataires + signatures

---

## 📚 Documents disponibles

### 🔥 Projet & Passation

- **HANDOVER.md**  
  Document principal de transmission (nouveau chat/dev)

---

### 🛡️ Disaster Recovery

- **DR_RUNBOOK.md**  
  Restore complet en moins de 10 minutes

- **OPS_CHECKLIST.md**  
  Checklist exploitation + monitoring

---

### 📄 Contrats & Templates

- **TEMPLATES.md**  
  Gestion SQL des templates (`document_templates`)  
  Backup + Update UTF-8 safe

---

### ✍️ Signatures électroniques

- **SIGNATURES.md**  
  Workflow complet multi-locataires + bailleur  
  Finalisation automatique du PDF signé

---

### 📌 Historique

- **CHANGELOG.md**  
  Liste des évolutions importantes (commits majeurs)

---

## ✅ Golden Path Terrain (Bail Meublé Béton)

1. Création bail MEUBLE_RP (multi-locataires possible)
2. Génération contrat via template SQL (`document_templates`)
3. Signature :
   - chaque locataire signe avec `signerTenantId`
   - bailleur signe en dernier
4. PDF final généré automatiquement :

CONTRAT_MEUBLE_RP_*_SIGNED_FINAL.pdf


---

## Next Steps

- Tests automatiques signature multi-tenant
- UI Visale + garants multiples
- Finalisation juridique du contrat RP
