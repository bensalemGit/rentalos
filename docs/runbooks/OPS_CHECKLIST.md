## 1) 🛠 OPS_CHECKLIST.md

```markdown
# RentalOS — Ops Checklist

## Quotidien
- [ ] Backup email reçu (si mode OK-notif activé)
- [ ] Task Scheduler : dernier résultat = 0
- [ ] Présence du dernier backup sur R2

## Hebdomadaire
- [ ] Vérifier taille des dumps (pas anormalement petits)
- [ ] Vérifier espace disque local (C:\rentalos\backups)
- [ ] Vérifier rclone remote accessible

## Mensuel
- [ ] Test restore complet sur machine staging
- [ ] Vérifier manifest + sha256
- [ ] Rotation credentials si nécessaire

## Trimestriel
- [ ] Audit secrets (SMTP, JWT, DB)
- [ ] Vérifier politique retention R2
```

---
