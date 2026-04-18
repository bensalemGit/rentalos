export type CanonicalPublicDocumentType =
  | 'LEASE_CONTRACT'
  | 'GUARANTEE_ACT'
  | 'EDL_ENTRY'
  | 'INVENTORY_ENTRY'
  | 'EDL_EXIT'
  | 'INVENTORY_EXIT';

export type CanonicalPublicSignerRole = 'TENANT' | 'LANDLORD' | 'GUARANTOR';

export type CanonicalPublicPhase = 'ENTRY' | 'EXIT';

export class CreateCanonicalPublicLinkDto {
  leaseId!: string;
  documentType!: CanonicalPublicDocumentType;
  signerRole!: CanonicalPublicSignerRole;
  phase!: CanonicalPublicPhase;
  tenantId?: string;
  guaranteeId?: string;
  force?: boolean;
  ttlHours?: number;
}