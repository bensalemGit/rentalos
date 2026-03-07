export type SignatureMode = "ON_SITE" | "EMAIL" | null;

export type SignerKind = "TENANT" | "GUARANTOR" | "LANDLORD";

export type SignerTaskStatus =
  | "NOT_REQUIRED"
  | "NOT_READY"
  | "READY"
  | "LINK_SENT"
  | "IN_PROGRESS"
  | "SIGNED"
  | "BLOCKED";

export type SignerTask = {
  id: string;
  kind: SignerKind;

  displayName: string;
  roleLabel: string;

  documentId: string | null;
  documentLabel: string;
  documentFilename?: string | null;

  status: SignerTaskStatus;
  statusLabel: string;

  activeMode: SignatureMode;

  canSignOnSite: boolean;
  canSendEmailLink: boolean;
  canResendLink: boolean;
  canDownloadSigned: boolean;

  signedFinalDocumentId?: string | null;
  signedFinalFilename?: string | null;

  email?: string | null;

  tenantId?: string;
  guaranteeId?: string;

  hasActiveLink?: boolean;
  activeLinkCreatedAt?: string | null;

  requiresPreparation?: boolean;
  preparationLabel?: string | null;

  isOptional?: boolean;
  isBlocked?: boolean;
  blockedReason?: string | null;
};

export type SignatureOverview = {
  leaseId: string;
  leaseLabel: string;
  primaryTenantName: string;

  progressPercent: number;
  remainingCount: number;

  tenants: {
    total: number;
    signed: number;
    pending: number;
  };

  guarantors: {
    total: number;
    signed: number;
    pending: number;
    notRequired: number;
  };

  landlord: {
    signed: boolean;
  };
};

export type DocumentResource = {
  id: string;
  label: string;
  type: string;
  filename?: string | null;
  statusLabel: string;
  downloadable: boolean;
  signedFinalDocumentId?: string | null;
};

export type SignatureSessionDraft = {
  open: boolean;
  signerTaskId: string | null;
  signerKind: SignerKind | null;
  signerName: string;
  roleLabel: string;
  documentId: string | null;
  documentLabel: string;
  tenantId?: string;
  guaranteeId?: string;
};