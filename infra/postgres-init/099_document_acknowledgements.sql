-- 099_document_acknowledgements.sql
-- Track "prise de connaissance" (ack) by tenant on a given document (typically SIGNED_FINAL act)

-- If you already have this extension in your schema, this is harmless.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS document_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  document_id uuid NOT NULL,
  lease_id uuid NOT NULL,
  tenant_id uuid NOT NULL,

  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  ip text NULL,
  user_agent text NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- One ack max per (document, tenant)
CREATE UNIQUE INDEX IF NOT EXISTS document_acknowledgements_doc_tenant_uq
  ON document_acknowledgements (document_id, tenant_id);

CREATE INDEX IF NOT EXISTS document_acknowledgements_lease_idx
  ON document_acknowledgements (lease_id);

CREATE INDEX IF NOT EXISTS document_acknowledgements_doc_idx
  ON document_acknowledgements (document_id);

CREATE INDEX IF NOT EXISTS document_acknowledgements_tenant_idx
  ON document_acknowledgements (tenant_id);