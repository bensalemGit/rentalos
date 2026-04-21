export type CanonicalDocumentType =
  | 'LEASE_CONTRACT'
  | 'GUARANTEE_ACT'
  | 'EDL_ENTRY'
  | 'INVENTORY_ENTRY'
  | 'EDL_EXIT'
  | 'INVENTORY_EXIT';

export type CanonicalPhase = 'ENTRY' | 'EXIT';

export type CanonicalSignerRole = 'TENANT' | 'LANDLORD' | 'GUARANTOR';

export type CanonicalDocumentStatus =
  | 'NOT_REQUIRED'
  | 'TO_PREPARE'
  | 'GENERATED'
  | 'LINK_SENT'
  | 'IN_PROGRESS'
  | 'SIGNED';

export type CanonicalSignatureStatus =
  | 'NOT_REQUIRED'
  | 'READY'
  | 'LINK_SENT'
  | 'IN_PROGRESS'
  | 'SIGNED'
  | 'BLOCKED';

export type CanonicalLinkStatus =
  | 'NEVER_SENT'
  | 'ACTIVE'
  | 'CONSUMED'
  | 'EXPIRED'
  | 'OBSOLETE';

export type CanonicalSignerRef =
  | { kind: 'TENANT'; tenantId: string }
  | { kind: 'LANDLORD'; guaranteeId?: string }
  | { kind: 'GUARANTOR'; guaranteeId: string };

export type CanonicalSignatureTask = {
  id: string;
  leaseId: string;

  documentType: CanonicalDocumentType;
  phase: CanonicalPhase;
  documentId: string | null;
  documentLabel: string;
  documentStatus: CanonicalDocumentStatus;
  signedFinalDocumentId: string | null;

  signerRole: CanonicalSignerRole;
  signerRef: CanonicalSignerRef;
  signerName: string;
  signerEmail: string | null;

  signatureStatus: CanonicalSignatureStatus;
  signatureMode: 'ONSITE' | 'PUBLIC_LINK' | null;

  publicLinkStatus: CanonicalLinkStatus;
  publicLinkId: string | null;
  publicLinkCreatedAt: string | null;
  publicLinkExpiresAt: string | null;
  publicLinkConsumedAt: string | null;

  canSignOnsite: boolean;
  canSendLink: boolean;
  canResendLink: boolean;
  canDownloadSigned: boolean;

  blockingReason: string | null;
  helperText: string | null;
  progressText: string | null;
};

export type CanonicalSignatureWorkflow = {
  leaseId: string;
  tasks: CanonicalSignatureTask[];
};