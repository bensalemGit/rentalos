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

export type SignatureGlobalStatus =
  | "PREPARATION"
  | "SIGNATURE"
  | "SIGNED"
  | "INCOMPLETE_CLOSURE"
  | "CLOSED";

export type SignerTask = {
  id: string;
  kind: SignerKind;
  subTasks?: SignerTask[];

  displayName: string;
  roleLabel: string;
  tenantLabel?: string | null;

  subtypeLabel?: string | null;
  helperLabel?: string | null;
  progressLabel?: string | null;
  counterpartySigned?: boolean | null;

  signatureDetails?: {
    guarantorSigned?: boolean;
    landlordSigned?: boolean;
    remainingRoles?: Array<"GUARANTOR" | "LANDLORD">;
  };

  documentId: string | null;
  documentLabel: string;
  documentType?: string | null;
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

  globalStatus?: SignatureGlobalStatus;
  globalStatusLabel?: string;
  globalStatusHelp?: string | null;

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

export type PackFinalReadinessIssue =
  | "CONTRACT_SIGNED_FINAL_MISSING"
  | "NOTICE_MISSING"
  | "EDL_MISSING"
  | "EDL_SIGNED_FINAL_MISSING"
  | "INVENTAIRE_MISSING"
  | "INVENTAIRE_SIGNED_FINAL_MISSING";

export type PackFinalReadiness = {
  ready: boolean;
  leaseId: string;
  leaseKind: string;
  issues: PackFinalReadinessIssue[];
  selected?: {
    contractSignedFinal?: {
      id: string;
      filename?: string | null;
      type?: string | null;
    } | null;
    guarantorActsSignedFinal?: Array<{
      id: string;
      filename?: string | null;
      type?: string | null;
      parent_document_id?: string | null;
    }>;
    notice?: {
      id: string;
      filename?: string | null;
      type?: string | null;
    } | null;
    edlRoot?: {
      id: string;
      filename?: string | null;
      type?: string | null;
    } | null;
    edlSignedFinal?: {
      id: string;
      filename?: string | null;
      type?: string | null;
      parent_document_id?: string | null;
    } | null;
    inventaireRoot?: {
      id: string;
      filename?: string | null;
      type?: string | null;
    } | null;
    inventaireSignedFinal?: {
      id: string;
      filename?: string | null;
      type?: string | null;
      parent_document_id?: string | null;
    } | null;
  };
  availableDocs?: Array<{
    id: string | null;
    type: string | null;
    filename: string | null;
    parent_document_id: string | null;
    signed_final_document_id: string | null;
  }>;
};
