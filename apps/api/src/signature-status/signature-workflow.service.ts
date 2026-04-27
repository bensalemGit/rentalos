import { Injectable } from '@nestjs/common';
import { SignatureStatusService } from './signature-status.service';
import type {
  CanonicalSignatureWorkflow,
  CanonicalSignatureTask,
  CanonicalLinkStatus,
} from './signature-workflow.types';

@Injectable()
export class SignatureWorkflowService {
  constructor(private readonly signatureStatus: SignatureStatusService) {}

  private resolveDocumentStatus(params: {
    documentId: string | null;
    signedFinalDocumentId: string | null;
    hasAnySignedSignature?: boolean;
    hasActiveLink?: boolean;
  }): 'TO_PREPARE' | 'GENERATED' | 'LINK_SENT' | 'IN_PROGRESS' | 'SIGNED' {
    const {
      documentId,
      signedFinalDocumentId,
      hasAnySignedSignature = false,
      hasActiveLink = false,
    } = params;

    if (signedFinalDocumentId) return 'SIGNED';
    if (!documentId) return 'TO_PREPARE';
    if (hasAnySignedSignature) return 'IN_PROGRESS';
    if (hasActiveLink) return 'LINK_SENT';
    return 'GENERATED';
  }

  private resolveSignatureStatus(params: {
    documentId: string | null;
    signerSigned: boolean;
    linkStatus: CanonicalLinkStatus;
    blockedReason?: string | null;
  }): 'BLOCKED' | 'READY' | 'LINK_SENT' | 'SIGNED' {
    const { documentId, signerSigned, linkStatus, blockedReason } = params;

    if (blockedReason || !documentId) return 'BLOCKED';
    if (signerSigned) return 'SIGNED';
    if (linkStatus === 'ACTIVE') return 'LINK_SENT';
    return 'READY';
  }

  private resolveLinkStatus(link?: {
    createdAt?: string | null;
    expiresAt?: string | null;
    consumedAt?: string | null;
  } | null): CanonicalLinkStatus {
    if (!link) return 'NEVER_SENT';
    if (link.consumedAt) return 'CONSUMED';
    if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) return 'EXPIRED';
    return 'ACTIVE';
  }

  async getByLease(leaseId: string): Promise<CanonicalSignatureWorkflow> {
    const raw = await this.signatureStatus.getByLease(leaseId);

    const tasks: CanonicalSignatureTask[] = [];

    // IMPORTANT
    // Dans cette première étape :
    // - on mappe seulement l’existant
    // - on ne change pas la logique métier
    // - on ne force pas encore la complétude entrée/sortie
    //
    // Tu vas remplir progressivement ce mapping à partir des blocs déjà présents
    // dans raw.contract / raw.guarantees / raw.edl / raw.inventory etc.

    // 1) CONTRACT / TENANTS
    if (raw?.contract?.tenants?.length) {
      for (const tenant of raw.contract.tenants) {
        const lastLink = tenant.lastLink ?? null;
        tasks.push({
          id: `contract:tenant:${tenant.tenantId}`,
          leaseId,

          documentType: 'LEASE_CONTRACT',
          phase: 'ENTRY',
          documentId: raw.contract.documentId ?? null,
          documentLabel: 'Contrat',
          documentStatus: this.resolveDocumentStatus({
            documentId: raw.contract.documentId ?? null,
            signedFinalDocumentId: raw.contract.signedFinalDocumentId ?? null,
            hasAnySignedSignature: raw.contract.tenants.some(
              (t: { signatureStatus: string }) => t.signatureStatus === 'SIGNED',
            ) || raw.contract.landlord?.signatureStatus === 'SIGNED',
            hasActiveLink: this.resolveLinkStatus(lastLink) === 'ACTIVE',
          }),
          signedFinalDocumentId: raw.contract.signedFinalDocumentId ?? null,

          signerRole: 'TENANT',
          signerRef: { kind: 'TENANT', tenantId: tenant.tenantId },
          signerName: tenant.fullName ?? 'Locataire',
          signerEmail: null,

          signatureStatus: this.resolveSignatureStatus({
            documentId: raw.contract.documentId ?? null,
            signerSigned: tenant.signatureStatus === 'SIGNED',
            linkStatus: this.resolveLinkStatus(lastLink),
            blockedReason: raw.contract.documentId ? null : 'Contrat non généré',
          }),

          signatureMode: lastLink ? 'PUBLIC_LINK' : 'ONSITE',

          publicLinkStatus: this.resolveLinkStatus(lastLink),
          publicLinkId: null,
          publicLinkCreatedAt: lastLink?.createdAt ?? null,
          publicLinkExpiresAt: lastLink?.expiresAt ?? null,
          publicLinkConsumedAt: lastLink?.consumedAt ?? null,

          canSignOnsite: !!raw.contract.documentId && tenant.signatureStatus !== 'SIGNED',
          canSendLink: !!raw.contract.documentId && tenant.signatureStatus !== 'SIGNED',
          canResendLink: !!lastLink && tenant.signatureStatus !== 'SIGNED',
          canDownloadSigned: !!raw.contract.signedFinalDocumentId,

          blockingReason: raw.contract.documentId ? null : 'Contrat non généré',
          helperText: null,
          progressText: tenant.signatureStatus === 'SIGNED' ? 'Locataire signé' : null,
        });
      }
    }

    // 2) CONTRACT / LANDLORD
    if (raw?.contract?.landlord) {
      const lastLink = raw.contract.landlord.lastLink ?? null;
      tasks.push({
        id: `contract:landlord`,
        leaseId,

        documentType: 'LEASE_CONTRACT',
        phase: 'ENTRY',
        documentId: raw.contract.documentId ?? null,
        documentLabel: 'Contrat',
        documentStatus: this.resolveDocumentStatus({
          documentId: raw.contract.documentId ?? null,
          signedFinalDocumentId: raw.contract.signedFinalDocumentId ?? null,
          hasAnySignedSignature:
            raw.contract.tenants?.some((t: { signatureStatus: string }) => t.signatureStatus === 'SIGNED') ||
            raw.contract.landlord?.signatureStatus === 'SIGNED',
          hasActiveLink: this.resolveLinkStatus(lastLink) === 'ACTIVE',
        }),
        signedFinalDocumentId: raw.contract.signedFinalDocumentId ?? null,

        signerRole: 'LANDLORD',
        signerRef: { kind: 'LANDLORD' },
        signerName: 'Bailleur',
        signerEmail: null,

        signatureStatus: this.resolveSignatureStatus({
          documentId: raw.contract.documentId ?? null,
          signerSigned: raw.contract.landlord.signatureStatus === 'SIGNED',
          linkStatus: this.resolveLinkStatus(lastLink),
          blockedReason: raw.contract.documentId ? null : 'Contrat non généré',
        }),
        signatureMode: lastLink ? 'PUBLIC_LINK' : 'ONSITE',

        publicLinkStatus: this.resolveLinkStatus(lastLink),
        publicLinkId: null,
        publicLinkCreatedAt: lastLink?.createdAt ?? null,
        publicLinkExpiresAt: lastLink?.expiresAt ?? null,
        publicLinkConsumedAt: lastLink?.consumedAt ?? null,

        canSignOnsite:
          !!raw.contract.documentId && raw.contract.landlord.signatureStatus !== 'SIGNED',
        canSendLink:
          !!raw.contract.documentId && raw.contract.landlord.signatureStatus !== 'SIGNED',
        canResendLink: !!lastLink && raw.contract.landlord.signatureStatus !== 'SIGNED',
        canDownloadSigned: !!raw.contract.signedFinalDocumentId,

        blockingReason: raw.contract.documentId ? null : 'Contrat non généré',
        helperText: null,
        progressText:
          raw.contract.landlord.signatureStatus === 'SIGNED' ? 'Bailleur signé' : null,
      });
    }

            // 3) GUARANTEES (raw.guarantees = array)
    if (Array.isArray(raw?.guarantees)) {
      for (const guarantee of raw.guarantees) {
        const lastLink = guarantee.lastLink ?? null;

        const guarantorSigned = !!guarantee.signatures?.guarantorSigned;
        const landlordSigned = !!guarantee.signatures?.landlordSigned;
        const isSigned = guarantee.signatureStatus === 'SIGNED';
        const isVisale = String(guarantee.type || '').toUpperCase() === 'VISALE';

        let progressText: string | null = null;
        if (guarantorSigned && !landlordSigned) {
          progressText = 'Garant signé • Bailleur à signer';
        } else if (!guarantorSigned && landlordSigned) {
          progressText = 'Bailleur signé • Garant à signer';
        } else if (guarantorSigned && landlordSigned) {
          progressText = 'Acte signé';
        }

        if (!isVisale) {
          tasks.push({
            id: `guarantee:guarantor:${guarantee.guaranteeId}`,
            leaseId,

            documentType: 'GUARANTEE_ACT',
            phase: 'ENTRY',
            documentId: guarantee.actDocumentId ?? null,
            documentLabel: 'Acte de caution',
            documentStatus: this.resolveDocumentStatus({
              documentId: guarantee.actDocumentId ?? null,
              signedFinalDocumentId: guarantee.signedFinalDocumentId ?? null,
              hasAnySignedSignature: guarantorSigned || landlordSigned,
              hasActiveLink: this.resolveLinkStatus(lastLink) === 'ACTIVE',
            }),
            signedFinalDocumentId: guarantee.signedFinalDocumentId ?? null,

            signerRole: 'GUARANTOR',
            signerRef: { kind: 'GUARANTOR', guaranteeId: guarantee.guaranteeId },
            signerName: guarantee.guarantorFullName || 'Garant',
            signerEmail: guarantee.guarantorEmail ?? null,

            signatureStatus: this.resolveSignatureStatus({
              documentId: guarantee.actDocumentId ?? null,
              signerSigned: guarantorSigned,
              linkStatus: this.resolveLinkStatus(lastLink),
              blockedReason: guarantee.actDocumentId ? null : 'Acte de caution non généré',
            }),

            signatureMode: lastLink ? 'PUBLIC_LINK' : 'ONSITE',

            publicLinkStatus: this.resolveLinkStatus(lastLink),
            publicLinkId: null,
            publicLinkCreatedAt: lastLink?.createdAt ?? null,
            publicLinkExpiresAt: lastLink?.expiresAt ?? null,
            publicLinkConsumedAt: lastLink?.consumedAt ?? null,

            canSignOnsite: !!guarantee.actDocumentId && !guarantorSigned,
            canSendLink: !!guarantee.actDocumentId && !guarantorSigned,
            canResendLink: !!lastLink && !guarantorSigned,
            canDownloadSigned: !!guarantee.signedFinalDocumentId,

            blockingReason: guarantee.actDocumentId ? null : 'Acte de caution non généré',
            helperText: null,
            progressText,
          });

          tasks.push({
            id: `guarantee:landlord:${guarantee.guaranteeId}`,
            leaseId,

            documentType: 'GUARANTEE_ACT',
            phase: 'ENTRY',
            documentId: guarantee.actDocumentId ?? null,
            documentLabel: 'Acte de caution',
            documentStatus: this.resolveDocumentStatus({
              documentId: guarantee.actDocumentId ?? null,
              signedFinalDocumentId: guarantee.signedFinalDocumentId ?? null,
              hasAnySignedSignature: guarantorSigned || landlordSigned,
              hasActiveLink: false,
            }),
            signedFinalDocumentId: guarantee.signedFinalDocumentId ?? null,

            signerRole: 'LANDLORD',
            signerRef: { kind: 'LANDLORD', guaranteeId: guarantee.guaranteeId },
            signerName: 'Bailleur',
            signerEmail: null,

            signatureStatus: this.resolveSignatureStatus({
              documentId: guarantee.actDocumentId ?? null,
              signerSigned: landlordSigned,
              linkStatus: 'NEVER_SENT',
              blockedReason: guarantee.actDocumentId ? null : 'Acte de caution non généré',
            }),

            signatureMode: 'ONSITE',

            publicLinkStatus: 'NEVER_SENT',
            publicLinkId: null,
            publicLinkCreatedAt: null,
            publicLinkExpiresAt: null,
            publicLinkConsumedAt: null,

            canSignOnsite: !!guarantee.actDocumentId && !landlordSigned,
            canSendLink: false,
            canResendLink: false,
            canDownloadSigned: !!guarantee.signedFinalDocumentId,

            blockingReason: guarantee.actDocumentId ? null : 'Acte de caution non généré',
            helperText: null,
            progressText,
          });
        }
      }
    }

    // 4) EDL ENTRY (raw.edl.entry)
    if (raw?.edl?.entry) {
      const edlEntry = raw.edl.entry;

      if (Array.isArray(raw?.contract?.tenants)) {
        for (const tenant of raw.contract.tenants) {
          const tenantId = tenant.tenantId;
          const tenantNeed = edlEntry.need?.tenants?.find(
            (t: { tenantId: string; signed: boolean }) => t.tenantId === tenantId,
          );
          const lastLink = edlEntry.tenantLastLinkByTenantId?.[tenantId] ?? null;
          const tenantSigned = !!tenantNeed?.signed;
          const landlordSigned = !!edlEntry.need?.landlord?.signed;

          tasks.push({
            id: `edl-entry:tenant:${tenantId}`,
            leaseId,

            documentType: 'EDL_ENTRY',
            phase: 'ENTRY',
            documentId: edlEntry.documentId ?? null,
            documentLabel: "EDL d'entrée",
            documentStatus: this.resolveDocumentStatus({
              documentId: edlEntry.documentId ?? null,
              signedFinalDocumentId: edlEntry.signedFinalDocumentId ?? null,
              hasAnySignedSignature: tenantSigned || landlordSigned,
              hasActiveLink: this.resolveLinkStatus(lastLink) === 'ACTIVE',
            }),
            signedFinalDocumentId: edlEntry.signedFinalDocumentId ?? null,

            signerRole: 'TENANT',
            signerRef: { kind: 'TENANT', tenantId },
            signerName: tenant.fullName ?? 'Locataire',
            signerEmail: null,

            signatureStatus: this.resolveSignatureStatus({
              documentId: edlEntry.documentId ?? null,
              signerSigned: tenantSigned,
              linkStatus: this.resolveLinkStatus(lastLink),
              blockedReason: edlEntry.documentId ? null : "EDL d'entrée non généré",
            }),

            signatureMode: lastLink ? 'PUBLIC_LINK' : 'ONSITE',

            publicLinkStatus: this.resolveLinkStatus(lastLink),
            publicLinkId: null,
            publicLinkCreatedAt: lastLink?.createdAt ?? null,
            publicLinkExpiresAt: lastLink?.expiresAt ?? null,
            publicLinkConsumedAt: lastLink?.consumedAt ?? null,

            canSignOnsite: !!edlEntry.documentId && !tenantSigned,
            canSendLink: !!edlEntry.documentId && !tenantSigned,
            canResendLink: !!lastLink && !tenantSigned,
            canDownloadSigned: !!edlEntry.signedFinalDocumentId,

            blockingReason: edlEntry.documentId ? null : "EDL d'entrée non généré",
            helperText: null,
            progressText: tenantSigned ? 'Locataire signé' : null,
          });
        }
      }

      const landlordLastLink = edlEntry.landlordLastLink ?? null;
      const landlordSigned = !!edlEntry.need?.landlord?.signed;
      const anyTenantSigned = Array.isArray(edlEntry.need?.tenants)
        ? edlEntry.need.tenants.some((t: { signed: boolean }) => t.signed)
        : false;

      tasks.push({
        id: `edl-entry:landlord`,
        leaseId,

        documentType: 'EDL_ENTRY',
        phase: 'ENTRY',
        documentId: edlEntry.documentId ?? null,
        documentLabel: "EDL d'entrée",
        documentStatus: this.resolveDocumentStatus({
          documentId: edlEntry.documentId ?? null,
          signedFinalDocumentId: edlEntry.signedFinalDocumentId ?? null,
          hasAnySignedSignature: anyTenantSigned || landlordSigned,
          hasActiveLink: this.resolveLinkStatus(landlordLastLink) === 'ACTIVE',
        }),
        signedFinalDocumentId: edlEntry.signedFinalDocumentId ?? null,

        signerRole: 'LANDLORD',
        signerRef: { kind: 'LANDLORD' },
        signerName: 'Bailleur',
        signerEmail: null,

        signatureStatus: this.resolveSignatureStatus({
          documentId: edlEntry.documentId ?? null,
          signerSigned: landlordSigned,
          linkStatus: this.resolveLinkStatus(landlordLastLink),
          blockedReason: edlEntry.documentId ? null : "EDL d'entrée non généré",
        }),

        signatureMode: landlordLastLink ? 'PUBLIC_LINK' : 'ONSITE',

        publicLinkStatus: this.resolveLinkStatus(landlordLastLink),
        publicLinkId: null,
        publicLinkCreatedAt: landlordLastLink?.createdAt ?? null,
        publicLinkExpiresAt: landlordLastLink?.expiresAt ?? null,
        publicLinkConsumedAt: landlordLastLink?.consumedAt ?? null,

        canSignOnsite: !!edlEntry.documentId && !landlordSigned,
        canSendLink: !!edlEntry.documentId && !landlordSigned,
        canResendLink: !!landlordLastLink && !landlordSigned,
        canDownloadSigned: !!edlEntry.signedFinalDocumentId,

        blockingReason: edlEntry.documentId ? null : "EDL d'entrée non généré",
        helperText: null,
        progressText: landlordSigned ? 'Bailleur signé' : null,
      });
    }

    // 5) INVENTORY ENTRY (raw.inventory.entry)
    if (raw?.inventory?.entry) {
      const inventoryEntry = raw.inventory.entry;

      if (Array.isArray(raw?.contract?.tenants)) {
        for (const tenant of raw.contract.tenants) {
          const tenantId = tenant.tenantId;
          const tenantNeed = inventoryEntry.need?.tenants?.find(
            (t: { tenantId: string; signed: boolean }) => t.tenantId === tenantId,
          );
          const lastLink = inventoryEntry.tenantLastLinkByTenantId?.[tenantId] ?? null;
          const tenantSigned = !!tenantNeed?.signed;
          const landlordSigned = !!inventoryEntry.need?.landlord?.signed;

          tasks.push({
            id: `inventory-entry:tenant:${tenantId}`,
            leaseId,

            documentType: 'INVENTORY_ENTRY',
            phase: 'ENTRY',
            documentId: inventoryEntry.documentId ?? null,
            documentLabel: "Inventaire d'entrée",
            documentStatus: this.resolveDocumentStatus({
              documentId: inventoryEntry.documentId ?? null,
              signedFinalDocumentId: inventoryEntry.signedFinalDocumentId ?? null,
              hasAnySignedSignature: tenantSigned || landlordSigned,
              hasActiveLink: this.resolveLinkStatus(lastLink) === 'ACTIVE',
            }),
            signedFinalDocumentId: inventoryEntry.signedFinalDocumentId ?? null,

            signerRole: 'TENANT',
            signerRef: { kind: 'TENANT', tenantId },
            signerName: tenant.fullName ?? 'Locataire',
            signerEmail: null,

            signatureStatus: this.resolveSignatureStatus({
              documentId: inventoryEntry.documentId ?? null,
              signerSigned: tenantSigned,
              linkStatus: this.resolveLinkStatus(lastLink),
              blockedReason: inventoryEntry.documentId ? null : "Inventaire d'entrée non généré",
            }),

            signatureMode: lastLink ? 'PUBLIC_LINK' : 'ONSITE',

            publicLinkStatus: this.resolveLinkStatus(lastLink),
            publicLinkId: null,
            publicLinkCreatedAt: lastLink?.createdAt ?? null,
            publicLinkExpiresAt: lastLink?.expiresAt ?? null,
            publicLinkConsumedAt: lastLink?.consumedAt ?? null,

            canSignOnsite: !!inventoryEntry.documentId && !tenantSigned,
            canSendLink: !!inventoryEntry.documentId && !tenantSigned,
            canResendLink: !!lastLink && !tenantSigned,
            canDownloadSigned: !!inventoryEntry.signedFinalDocumentId,

            blockingReason: inventoryEntry.documentId ? null : "Inventaire d'entrée non généré",
            helperText: null,
            progressText: tenantSigned ? 'Locataire signé' : null,
          });
        }
      }

      const landlordLastLink = inventoryEntry.landlordLastLink ?? null;
      const landlordSigned = !!inventoryEntry.need?.landlord?.signed;
      const anyTenantSigned = Array.isArray(inventoryEntry.need?.tenants)
        ? inventoryEntry.need.tenants.some((t: { signed: boolean }) => t.signed)
        : false;

      tasks.push({
        id: `inventory-entry:landlord`,
        leaseId,

        documentType: 'INVENTORY_ENTRY',
        phase: 'ENTRY',
        documentId: inventoryEntry.documentId ?? null,
        documentLabel: "Inventaire d'entrée",
        documentStatus: this.resolveDocumentStatus({
          documentId: inventoryEntry.documentId ?? null,
          signedFinalDocumentId: inventoryEntry.signedFinalDocumentId ?? null,
          hasAnySignedSignature: anyTenantSigned || landlordSigned,
          hasActiveLink: this.resolveLinkStatus(landlordLastLink) === 'ACTIVE',
        }),
        signedFinalDocumentId: inventoryEntry.signedFinalDocumentId ?? null,

        signerRole: 'LANDLORD',
        signerRef: { kind: 'LANDLORD' },
        signerName: 'Bailleur',
        signerEmail: null,

        signatureStatus: this.resolveSignatureStatus({
          documentId: inventoryEntry.documentId ?? null,
          signerSigned: landlordSigned,
          linkStatus: this.resolveLinkStatus(landlordLastLink),
          blockedReason: inventoryEntry.documentId ? null : "Inventaire d'entrée non généré",
        }),

        signatureMode: landlordLastLink ? 'PUBLIC_LINK' : 'ONSITE',

        publicLinkStatus: this.resolveLinkStatus(landlordLastLink),
        publicLinkId: null,
        publicLinkCreatedAt: landlordLastLink?.createdAt ?? null,
        publicLinkExpiresAt: landlordLastLink?.expiresAt ?? null,
        publicLinkConsumedAt: landlordLastLink?.consumedAt ?? null,

        canSignOnsite: !!inventoryEntry.documentId && !landlordSigned,
        canSendLink: !!inventoryEntry.documentId && !landlordSigned,
        canResendLink: !!landlordLastLink && !landlordSigned,
        canDownloadSigned: !!inventoryEntry.signedFinalDocumentId,

        blockingReason: inventoryEntry.documentId ? null : "Inventaire d'entrée non généré",
        helperText: null,
        progressText: landlordSigned ? 'Bailleur signé' : null,
      });
    }

        // 6) EDL EXIT (raw.edl.exit)
    if (raw?.edl?.exit) {
      const edlExit = raw.edl.exit;

      if (Array.isArray(raw?.contract?.tenants)) {
        for (const tenant of raw.contract.tenants) {
          const tenantId = tenant.tenantId;
          const tenantNeed = edlExit.need?.tenants?.find(
            (t: { tenantId: string; signed: boolean }) => t.tenantId === tenantId,
          );
          const lastLink = edlExit.tenantLastLinkByTenantId?.[tenantId] ?? null;
          const tenantSigned = !!tenantNeed?.signed;
          const landlordSigned = !!edlExit.need?.landlord?.signed;

          tasks.push({
            id: `edl-exit:tenant:${tenantId}`,
            leaseId,

            documentType: 'EDL_EXIT',
            phase: 'EXIT',
            documentId: edlExit.documentId ?? null,
            documentLabel: 'EDL de sortie',
            documentStatus: this.resolveDocumentStatus({
              documentId: edlExit.documentId ?? null,
              signedFinalDocumentId: edlExit.signedFinalDocumentId ?? null,
              hasAnySignedSignature: tenantSigned || landlordSigned,
              hasActiveLink: this.resolveLinkStatus(lastLink) === 'ACTIVE',
            }),
            signedFinalDocumentId: edlExit.signedFinalDocumentId ?? null,

            signerRole: 'TENANT',
            signerRef: { kind: 'TENANT', tenantId },
            signerName: tenant.fullName ?? 'Locataire',
            signerEmail: null,

            signatureStatus: this.resolveSignatureStatus({
              documentId: edlExit.documentId ?? null,
              signerSigned: tenantSigned,
              linkStatus: this.resolveLinkStatus(lastLink),
              blockedReason: edlExit.documentId ? null : 'EDL de sortie non généré',
            }),

            signatureMode: lastLink ? 'PUBLIC_LINK' : 'ONSITE',

            publicLinkStatus: this.resolveLinkStatus(lastLink),
            publicLinkId: null,
            publicLinkCreatedAt: null,
            publicLinkExpiresAt: null,
            publicLinkConsumedAt: null,

            canSignOnsite: !!edlExit.documentId && !tenantSigned,
            canSendLink: !!edlExit.documentId && !tenantSigned,
            canResendLink: !!lastLink && !tenantSigned,
            canDownloadSigned: !!edlExit.signedFinalDocumentId,

            blockingReason: edlExit.documentId ? null : 'EDL de sortie non généré',
            helperText: null,
            progressText: tenantSigned ? 'Locataire signé' : null,
          });
        }
      }

      const landlordLastLink = edlExit.landlordLastLink ?? null;
      const landlordSigned = !!edlExit.need?.landlord?.signed;
      const anyTenantSigned = Array.isArray(edlExit.need?.tenants)
        ? edlExit.need.tenants.some((t: { signed: boolean }) => t.signed)
        : false;

      tasks.push({
        id: `edl-exit:landlord`,
        leaseId,

        documentType: 'EDL_EXIT',
        phase: 'EXIT',
        documentId: edlExit.documentId ?? null,
        documentLabel: 'EDL de sortie',
        documentStatus: this.resolveDocumentStatus({
          documentId: edlExit.documentId ?? null,
          signedFinalDocumentId: edlExit.signedFinalDocumentId ?? null,
          hasAnySignedSignature: anyTenantSigned || landlordSigned,
          hasActiveLink: this.resolveLinkStatus(landlordLastLink) === 'ACTIVE',
        }),
        signedFinalDocumentId: edlExit.signedFinalDocumentId ?? null,

        signerRole: 'LANDLORD',
        signerRef: { kind: 'LANDLORD' },
        signerName: 'Bailleur',
        signerEmail: null,

        signatureStatus: this.resolveSignatureStatus({
          documentId: edlExit.documentId ?? null,
          signerSigned: landlordSigned,
          linkStatus: this.resolveLinkStatus(landlordLastLink),
          blockedReason: edlExit.documentId ? null : 'EDL de sortie non généré',
        }),

        signatureMode: landlordLastLink ? 'PUBLIC_LINK' : 'ONSITE',

        publicLinkStatus: this.resolveLinkStatus(landlordLastLink),
        publicLinkId: null,
        publicLinkCreatedAt: null,
        publicLinkExpiresAt: null,
        publicLinkConsumedAt: null,

        canSignOnsite: !!edlExit.documentId && !landlordSigned,
        canSendLink: !!edlExit.documentId && !landlordSigned,
        canResendLink: !!landlordLastLink && !landlordSigned,
        canDownloadSigned: !!edlExit.signedFinalDocumentId,

        blockingReason: edlExit.documentId ? null : 'EDL de sortie non généré',
        helperText: null,
        progressText: landlordSigned ? 'Bailleur signé' : null,
      });
    }

        // 7) INVENTORY EXIT (raw.inventory.exit)
    if (raw?.inventory?.exit) {
      const inventoryExit = raw.inventory.exit;

      if (Array.isArray(raw?.contract?.tenants)) {
        for (const tenant of raw.contract.tenants) {
          const tenantId = tenant.tenantId;
          const tenantNeed = inventoryExit.need?.tenants?.find(
            (t: { tenantId: string; signed: boolean }) => t.tenantId === tenantId,
          );
          const lastLink = inventoryExit.tenantLastLinkByTenantId?.[tenantId] ?? null;
          const tenantSigned = !!tenantNeed?.signed;
          const landlordSigned = !!inventoryExit.need?.landlord?.signed;

          tasks.push({
            id: `inventory-exit:tenant:${tenantId}`,
            leaseId,

            documentType: 'INVENTORY_EXIT',
            phase: 'EXIT',
            documentId: inventoryExit.documentId ?? null,
            documentLabel: 'Inventaire de sortie',
            documentStatus: this.resolveDocumentStatus({
              documentId: inventoryExit.documentId ?? null,
              signedFinalDocumentId: inventoryExit.signedFinalDocumentId ?? null,
              hasAnySignedSignature: tenantSigned || landlordSigned,
              hasActiveLink: this.resolveLinkStatus(lastLink) === 'ACTIVE',
            }),
            signedFinalDocumentId: inventoryExit.signedFinalDocumentId ?? null,

            signerRole: 'TENANT',
            signerRef: { kind: 'TENANT', tenantId },
            signerName: tenant.fullName ?? 'Locataire',
            signerEmail: null,

            signatureStatus: this.resolveSignatureStatus({
              documentId: inventoryExit.documentId ?? null,
              signerSigned: tenantSigned,
              linkStatus: this.resolveLinkStatus(lastLink),
              blockedReason: inventoryExit.documentId ? null : 'Inventaire de sortie non généré',
            }),

            signatureMode: lastLink ? 'PUBLIC_LINK' : 'ONSITE',

            publicLinkStatus: this.resolveLinkStatus(lastLink),
            publicLinkId: null,
            publicLinkCreatedAt: null,
            publicLinkExpiresAt: null,
            publicLinkConsumedAt: null,

            canSignOnsite: !!inventoryExit.documentId && !tenantSigned,
            canSendLink: !!inventoryExit.documentId && !tenantSigned,
            canResendLink: !!lastLink && !tenantSigned,
            canDownloadSigned: !!inventoryExit.signedFinalDocumentId,

            blockingReason: inventoryExit.documentId ? null : 'Inventaire de sortie non généré',
            helperText: null,
            progressText: tenantSigned ? 'Locataire signé' : null,
          });
        }
      }

      const landlordLastLink = inventoryExit.landlordLastLink ?? null;
      const landlordSigned = !!inventoryExit.need?.landlord?.signed;
      const anyTenantSigned = Array.isArray(inventoryExit.need?.tenants)
        ? inventoryExit.need.tenants.some((t: { signed: boolean }) => t.signed)
        : false;

      tasks.push({
        id: `inventory-exit:landlord`,
        leaseId,

        documentType: 'INVENTORY_EXIT',
        phase: 'EXIT',
        documentId: inventoryExit.documentId ?? null,
        documentLabel: 'Inventaire de sortie',
        documentStatus: this.resolveDocumentStatus({
          documentId: inventoryExit.documentId ?? null,
          signedFinalDocumentId: inventoryExit.signedFinalDocumentId ?? null,
          hasAnySignedSignature: anyTenantSigned || landlordSigned,
          hasActiveLink: this.resolveLinkStatus(landlordLastLink) === 'ACTIVE',
        }),
        signedFinalDocumentId: inventoryExit.signedFinalDocumentId ?? null,

        signerRole: 'LANDLORD',
        signerRef: { kind: 'LANDLORD' },
        signerName: 'Bailleur',
        signerEmail: null,

        signatureStatus: this.resolveSignatureStatus({
          documentId: inventoryExit.documentId ?? null,
          signerSigned: landlordSigned,
          linkStatus: this.resolveLinkStatus(landlordLastLink),
          blockedReason: inventoryExit.documentId ? null : 'Inventaire de sortie non généré',
        }),

        signatureMode: landlordLastLink ? 'PUBLIC_LINK' : 'ONSITE',

        publicLinkStatus: this.resolveLinkStatus(landlordLastLink),
        publicLinkId: null,
        publicLinkCreatedAt: null,
        publicLinkExpiresAt: null,
        publicLinkConsumedAt: null,

        canSignOnsite: !!inventoryExit.documentId && !landlordSigned,
        canSendLink: !!inventoryExit.documentId && !landlordSigned,
        canResendLink: !!landlordLastLink && !landlordSigned,
        canDownloadSigned: !!inventoryExit.signedFinalDocumentId,

        blockingReason: inventoryExit.documentId ? null : 'Inventaire de sortie non généré',
        helperText: null,
        progressText: landlordSigned ? 'Bailleur signé' : null,
      });
    }






    return { leaseId, tasks };
  }
}