-- 107_lease_guarantees_guarantor_address.sql
-- Ajoute l'adresse postale de la caution dans le modèle principal lease_guarantees.

ALTER TABLE lease_guarantees
  ADD COLUMN IF NOT EXISTS guarantor_address text;