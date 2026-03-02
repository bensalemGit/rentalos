export type GeneratedDocument = {
  id: string;
  unit_id: string;
  lease_id: string;
  type: string;
  filename: string;
  storage_path: string;
  sha256: string;
  created_at: string;
  parent_document_id: string | null;
  signed_final_document_id: string | null;
  finalized_at: string | null;
  signed_final_sha256: string | null;
};

export type GenerateDocResponse = {
  created: boolean;
  document: GeneratedDocument;
};

export type GuarantorActCandidate = {
  guaranteeId: string;
  leaseTenantId: string;
  tenantId: string;
  tenantFullName: string;
  tenantEmail?: string | null;
  role?: string | null;
  guarantorFullName?: string | null;
  guarantorEmail?: string | null;
  guarantorPhone?: string | null;
};

export type GuarantorActCandidatesResponse = {
  leaseId: string;
  count: number;
  candidates: GuarantorActCandidate[];
};
