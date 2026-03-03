export type TenantSigStatus = "NOT_SENT" | "SENT" | "SIGNED";
export type LandlordSigStatus = "NOT_SENT" | "SENT" | "SIGNED";
export type DocSigStatus = "NOT_GENERATED" | "DRAFT" | "IN_PROGRESS" | "SIGNED";
export type GuaranteeSigStatus = "NOT_SENT" | "SENT" | "IN_PROGRESS" | "SIGNED";

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