## 2) 📌 CHANGELOG.md

```markdown
# RentalOS — Changelog

## 2026-02-17
- PRA Backup/Restore validé en production
- Dump PGDMP généré dans container + docker cp (fix corruption PowerShell UTF-16)
- Upload Cloudflare R2 chiffré opérationnel
- Task Scheduler daily 03:00 validé
- README Backup & DR ajouté

## Next
- Fail-only email notifications
- Healthcheck SQL post-backup
- Restore auto-latest amélioré
```

---

## [Unreleased]

### 2026-04-21

### Added
- Canonical public links endpoint (/api/canonical-public-links)
- Support signature flows for:
  - EDL exit
  - Inventory exit
  - Landlord guarantee signing

### Changed
- Unified signature flow across all document types
- Deprecated legacy public-links endpoints

### Fixed
- Invalid token purpose for EXIT flows
- Missing enum LANDLORD_SIGN_GUARANTEE_ACT