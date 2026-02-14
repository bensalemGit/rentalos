DO $$ BEGIN
  CREATE TYPE doc_type AS ENUM ('CONTRAT','EDL','INVENTAIRE','ANNEXE','PHOTO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sign_role AS ENUM ('BAILLEUR','LOCATAIRE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES units(id) ON DELETE CASCADE,
  lease_id uuid REFERENCES leases(id) ON DELETE SET NULL,
  type doc_type NOT NULL,
  filename text NOT NULL,
  storage_path text NOT NULL,
  sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  signer_role sign_role NOT NULL,
  signer_name text NOT NULL,
  signature_image_path text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip text NULL,
  user_agent text NULL,
  pdf_sha256 text NOT NULL,
  audit_log jsonb NOT NULL DEFAULT '{}'::jsonb
);
