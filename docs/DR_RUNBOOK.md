# RentalOS — Disaster Recovery Runbook (10 min Restore)

This document is the **emergency procedure** to restore RentalOS after:

- server crash
- database corruption
- accidental deletion
- failed upgrade
- ransomware / storage loss

Goal: **full restore in < 10 minutes**.

---

# 🚨 DR PRIORITY CHECKLIST

## Immediate actions

- [ ] Stop writes / users if system partially running
- [ ] Confirm Docker is installed and working
- [ ] Confirm rclone access to Cloudflare R2
- [ ] Confirm latest backup exists

---

# 1️⃣ Prerequisites

Machine requirements:

- Windows 11 (or Linux equivalent)
- Docker Desktop installed + running
- Repo cloned:

```powershell
git clone https://github.com/bensalemGit/rentalos.git
cd rentalos
