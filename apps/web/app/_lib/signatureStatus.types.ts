export type TenantSigStatus = "NOT_SENT" | "SENT" | "SIGNED";
export type LandlordSigStatus = "NOT_SENT" | "SENT" | "SIGNED";
export type DocSigStatus = "NOT_GENERATED" | "DRAFT" | "IN_PROGRESS" | "SIGNED";
export type GuaranteeSigStatus = "NOT_SENT" | "SENT" | "IN_PROGRESS" | "SIGNED";
export type LinkMeta = {
  createdAt: string;
  expiresAt: string | null;
  consumedAt: string | null;
};

export type SignableDocBlock = {
  key: string;
  label: string;
  documentId: string | null;
  filename: string | null;
  signedFinalDocumentId: string | null;
  status: "NOT_GENERATED" | "DRAFT" | "IN_PROGRESS" | "SIGNED";
  need: {
    landlord: { required: boolean; signed: boolean };
    tenants: Array<{ tenantId: string; required: boolean; signed: boolean }>;
  };
  delivery: {
    lastLink: LinkMeta | null;
  };
};

export type SignatureStatusPayload = {
  leaseId: string;
  generatedAt: string;

  contract: {
    documentId: string | null;
    filename: string | null;
    signedFinalDocumentId: string | null;
    status: DocSigStatus;
    landlord: {
      signatureStatus: LandlordSigStatus;
      lastLink: { createdAt: string; expiresAt: string | null; consumedAt: string | null } | null;
    };
    tenants: Array<{
      leaseTenantId: string;
      tenantId: string;
      role: string;
      fullName: string;
      signatureStatus: TenantSigStatus;
      lastLink: { createdAt: string; expiresAt: string | null; consumedAt: string | null } | null;
    }>;
  };

   edl: {
      entry: SignableDocBlock;
      exit: SignableDocBlock;
    };
    inventory: {
      entry: SignableDocBlock;
      exit: SignableDocBlock;
    };
    
    guarantees: Array<{
      guaranteeId: string;
      leaseTenantId: string;
      tenantId: string;
      tenantFullName: string;
      guarantorFullName: string;
      guarantorEmail: string | null;
      guarantorPhone: string | null;
      actDocumentId: string | null;
      signedFinalDocumentId: string | null;
      signatureStatus: GuaranteeSigStatus;
      lastLink: { createdAt: string; expiresAt: string | null; consumedAt: string | null } | null;
      guaranteeStatus: string | null;
          ack?: {
        required: boolean;
        tenants: Array<{
          tenantId: string;
          acknowledged: boolean;
          acknowledgedAt: string | null;
        }>;
      };
    }>;
  };