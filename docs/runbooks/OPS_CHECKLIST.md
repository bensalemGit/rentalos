# RentalOS — Ops Checklist

## Quotidien
- [ ] Backup OK (email “FailOnly” => pas d’alerte = OK)
- [ ] Task Scheduler : dernier résultat = 0
- [ ] Dernier backup présent sur R2
- [ ] Services Docker up (api/web/postgres)

## Hebdomadaire
- [ ] Vérifier taille des dumps (pas anormalement petits)
- [ ] Vérifier espace disque local (`C:\rentalos\backups`)
- [ ] Vérifier accès rclone (R2)

## Mensuel
- [ ] Test restore complet sur machine staging
- [ ] Vérifier manifest + sha256
- [ ] Vérifier rotation des logs / dossiers

## Trimestriel
- [ ] Audit secrets (SMTP, JWT, DB)
- [ ] Vérifier politique retention R2
- [ ] Vérifier policies Cloudflare Access