import type {
  DocumentResource,
  SignatureOverview,
  SignerTask,
  SignerTaskStatus,
} from "../_types/signature-center.types";
import { toTaskStatusLabel } from "./signature-status.helpers";

type LeaseTenantLite = {
  tenant_id?: string;
  id?: string;
  full_name?: string;
  role?: string;
};

type SignatureStatusPayloadLite = {
  contract?: {
    documentId?: string | null;
    filename?: string | null;
    status?: string | null;
    signedFinalDocumentId?: string | null;
    landlord?: {
      signatureStatus?: string | null;
    };
    tenants?: Array<{
      leaseTenantId: string;
      tenantId: string;
      fullName?: string | null;
      role?: string | null;
      signatureStatus?: string | null;
      lastLink?: {
        createdAt?: string | null;
        consumedAt?: string | null;
      } | null;
    }>;
  };
  guarantees?: Array<{
    guaranteeId: string;
    leaseTenantId?: string | null;
    guarantorFullName?: string | null;
    tenantFullName?: string | null;
    type?: string | null;
    actDocumentId?: string | null;
    signatureStatus?: string | null;
    signedFinalDocumentId?: string | null;
    lastLink?: {
      createdAt?: string | null;
      consumedAt?: string | null;
    } | null;
  }>;
};

type DocLite = {
  id: string;
  type: string;
  filename?: string;
};

type MapSignatureDataArgs = {
  leaseId: string;
  sigStatus: SignatureStatusPayloadLite | null;
  tenants: LeaseTenantLite[];
  docs: DocLite[];
  guaranteeActOverride: Record<string, string>;
};

type MapSignatureDataResult = {
  overview: SignatureOverview;
  signerTasks: SignerTask[];
  documents: DocumentResource[];
};

function normalizeTenantName(t?: LeaseTenantLite | null): string {
  return String(t?.full_name || "").trim() || "Locataire";
}

function inferPrimaryTenantName(
  sigStatus: SignatureStatusPayloadLite | null,
  tenants: LeaseTenantLite[],
): string {
  const contractTenants = sigStatus?.contract?.tenants || [];
  if (contractTenants.length > 0) {
    return String(contractTenants[0]?.fullName || "").trim() || "Locataire";
  }

  if (tenants.length > 0) {
    return normalizeTenantName(tenants[0]);
  }

  return "Locataire";
}

function mapTenantTaskStatus(args: {
  contractDocumentId?: string | null;
  signatureStatus?: string | null;
  hasActiveLink: boolean;
}): SignerTaskStatus {
  const raw = String(args.signatureStatus || "").toUpperCase();

  if (!args.contractDocumentId) return "NOT_READY";
  if (raw === "SIGNED") return "SIGNED";
  if (raw === "IN_PROGRESS") return "IN_PROGRESS";
  if (args.hasActiveLink) return "LINK_SENT";
  return "READY";
}

function mapGuarantorTaskStatus(args: {
  isVisale: boolean;
  actDocumentId?: string | null;
  signatureStatus?: string | null;
  hasActiveLink: boolean;
}): SignerTaskStatus {
  if (args.isVisale) return "NOT_REQUIRED";

  const raw = String(args.signatureStatus || "").toUpperCase();

  if (!args.actDocumentId) return "NOT_READY";
  if (raw === "SIGNED") return "SIGNED";
  if (raw === "IN_PROGRESS") return "IN_PROGRESS";
  if (args.hasActiveLink) return "LINK_SENT";
  return "READY";
}

function mapLandlordTaskStatus(args: {
  contractDocumentId?: string | null;
  signatureStatus?: string | null;
}): SignerTaskStatus {
  const raw = String(args.signatureStatus || "").toUpperCase();

  if (!args.contractDocumentId) return "NOT_READY";
  if (raw === "SIGNED") return "SIGNED";
  return "READY";
}

function mapTenantTasks(sigStatus: SignatureStatusPayloadLite | null): SignerTask[] {
  const contract = sigStatus?.contract;
  const contractTenants = contract?.tenants || [];

  return contractTenants.map((t) => {
    const hasActiveLink = Boolean(t.lastLink && !t.lastLink.consumedAt);

    const status = mapTenantTaskStatus({
      contractDocumentId: contract?.documentId,
      signatureStatus: t.signatureStatus,
      hasActiveLink,
    });

    return {
      id: `tenant:${t.leaseTenantId}`,
      kind: "TENANT",
      displayName: String(t.fullName || "").trim() || "Locataire",
      roleLabel: String(t.role || "").toLowerCase() === "principal" ? "Locataire principal" : "Cotitulaire",
      documentId: contract?.documentId || null,
      documentLabel: "Contrat de location",
      documentFilename: contract?.filename || null,
      status,
      statusLabel: toTaskStatusLabel(status),
      activeMode: status === "LINK_SENT" ? "EMAIL" : null,
      canSignOnSite: Boolean(contract?.documentId) && status !== "SIGNED",
      canSendEmailLink: Boolean(contract?.documentId) && status !== "SIGNED",
      canResendLink: status === "LINK_SENT",
      canDownloadSigned: Boolean(contract?.signedFinalDocumentId),
      signedFinalDocumentId: contract?.signedFinalDocumentId || null,
      signedFinalFilename: contract?.signedFinalDocumentId ? "contrat_SIGNE.pdf" : null,
      tenantId: t.tenantId,
      hasActiveLink,
      activeLinkCreatedAt: t.lastLink?.createdAt || null,
      requiresPreparation: !contract?.documentId,
      preparationLabel: !contract?.documentId ? "Le contrat doit être généré" : null,
      isOptional: false,
      isBlocked: !contract?.documentId,
      blockedReason: !contract?.documentId ? "Contrat non généré" : null,
    };
  });
}

function mapGuarantorTasks(
  sigStatus: SignatureStatusPayloadLite | null,
  guaranteeActOverride: Record<string, string>,
): SignerTask[] {
  const guarantees = Array.isArray(sigStatus?.guarantees) ? sigStatus!.guarantees : [];
  const landlordSigned =
  String(sigStatus?.contract?.landlord?.signatureStatus || "").toUpperCase() === "SIGNED";

  const tenantNameByLeaseTenantId = new Map<string, string>();

  (sigStatus?.contract?.tenants || []).forEach((t) => {
    const leaseTenantId = String(t.leaseTenantId || "").trim();
    const fullName = String(t.fullName || "").trim();

    if (leaseTenantId && fullName) {
      tenantNameByLeaseTenantId.set(leaseTenantId, fullName);
    }
  });

  return guarantees.map((g) => {
    const type = String(g.type || "").toUpperCase();
    const isVisale = type === "VISALE";
    const effectiveActId = guaranteeActOverride[g.guaranteeId] || g.actDocumentId || null;
    const hasActiveLink = Boolean(g.lastLink && !g.lastLink.consumedAt);

    const status = mapGuarantorTaskStatus({
      isVisale,
      actDocumentId: effectiveActId,
      signatureStatus: g.signatureStatus,
      hasActiveLink,
    });

    const guarantorSigned = String(g.signatureStatus || "").toUpperCase() === "SIGNED";

    const progressLabel = isVisale
      ? "Aucune signature garant requise"
      : guarantorSigned && landlordSigned
        ? "Signature finalisée"
        : guarantorSigned && !landlordSigned
          ? "Garant signé • Bailleur à signer"
          : !guarantorSigned && landlordSigned
            ? "Bailleur signé • Garant à signer"
            : !effectiveActId
              ? "Acte de caution à préparer"
              : "Garant et bailleur doivent signer";

    return {
      id: `guarantor:${g.guaranteeId}`,
      kind: "GUARANTOR",
      displayName: isVisale
        ? String(g.tenantFullName || "").trim() || "VISALE"
        : String(g.guarantorFullName || "").trim() || "Garant",
      roleLabel: "Garant",
      tenantLabel: !isVisale
        ? (() => {
            const tenantNameFromMap = tenantNameByLeaseTenantId.get(String(g.leaseTenantId || "").trim());
            const fallbackTenantName = String(g.tenantFullName || "").trim();

            const targetName = tenantNameFromMap || fallbackTenantName;
            return targetName ? `Garant pour ${targetName}` : null;
          })()
        : null,
      subtypeLabel: isVisale ? "Garantie VISALE" : "Caution personnelle",
      helperLabel: isVisale
        ? "Aucune signature garant requise"
        : !effectiveActId
          ? "Acte de caution à préparer"
          : "Signature garant requise",
      progressLabel,
      counterpartySigned: isVisale ? null : landlordSigned,
      documentId: isVisale ? null : effectiveActId,
      documentLabel: isVisale ? "Garantie VISALE" : "Acte de caution",
      documentFilename: null,
      status,
      statusLabel: toTaskStatusLabel(status),
      activeMode: status === "LINK_SENT" ? "EMAIL" : null,
      canSignOnSite: !isVisale && Boolean(effectiveActId) && status !== "SIGNED",
      canSendEmailLink: !isVisale && Boolean(effectiveActId) && status !== "SIGNED",
      canResendLink: status === "LINK_SENT",
      canDownloadSigned: Boolean(g.signedFinalDocumentId),
      signedFinalDocumentId: g.signedFinalDocumentId || null,
      signedFinalFilename: g.signedFinalDocumentId ? "acte_caution_SIGNE.pdf" : null,
      guaranteeId: g.guaranteeId,
      hasActiveLink,
      activeLinkCreatedAt: g.lastLink?.createdAt || null,
      requiresPreparation: !isVisale && !effectiveActId,
      preparationLabel: !isVisale && !effectiveActId ? "Acte de caution à préparer" : null,
      isOptional: true,
      isBlocked: false,
      blockedReason: null,
    };
  });
}

function mapLandlordTask(sigStatus: SignatureStatusPayloadLite | null): SignerTask {
  const contract = sigStatus?.contract;
  const status = mapLandlordTaskStatus({
    contractDocumentId: contract?.documentId,
    signatureStatus: contract?.landlord?.signatureStatus,
  });

  return {
    id: "landlord:contract",
    kind: "LANDLORD",
    displayName: "Bailleur",
    roleLabel: "Bailleur",
    documentId: contract?.documentId || null,
    documentLabel: "Contrat de location",
    documentFilename: contract?.filename || null,
    status,
    statusLabel: toTaskStatusLabel(status),
    activeMode: null,
    canSignOnSite: Boolean(contract?.documentId) && status !== "SIGNED",
    canSendEmailLink: Boolean(contract?.documentId) && status !== "SIGNED",
    canResendLink: false,
    canDownloadSigned: Boolean(contract?.signedFinalDocumentId),
    signedFinalDocumentId: contract?.signedFinalDocumentId || null,
    signedFinalFilename: contract?.signedFinalDocumentId ? "contrat_SIGNE.pdf" : null,
    isOptional: false,
    isBlocked: !contract?.documentId,
    blockedReason: !contract?.documentId ? "Contrat non généré" : null,
  };
}

function mapOverview(args: {
  leaseId: string;
  sigStatus: SignatureStatusPayloadLite | null;
  tenants: LeaseTenantLite[];
  signerTasks: SignerTask[];
}): SignatureOverview {
  const contractTenants = args.sigStatus?.contract?.tenants || [];

  const tenantSigned = contractTenants.filter(
    (t) => String(t.signatureStatus || "").toUpperCase() === "SIGNED",
  ).length;
  const tenantTotal = contractTenants.length;
  const tenantPending = Math.max(tenantTotal - tenantSigned, 0);

  const guarantorTasks = args.signerTasks.filter((t) => t.kind === "GUARANTOR");
  const guarantorSigned = guarantorTasks.filter((t) => t.status === "SIGNED").length;
  const guarantorNotRequired = guarantorTasks.filter((t) => t.status === "NOT_REQUIRED").length;
  const guarantorPending = guarantorTasks.filter(
    (t) => t.status !== "SIGNED" && t.status !== "NOT_REQUIRED",
  ).length;

  const landlordSigned = args.signerTasks.some(
    (t) => t.kind === "LANDLORD" && t.status === "SIGNED",
  );

  const signableTasks = args.signerTasks.filter((t) => t.status !== "NOT_REQUIRED");
  const signedTasks = signableTasks.filter((t) => t.status === "SIGNED").length;
  const remainingCount = Math.max(signableTasks.length - signedTasks, 0);
  const progressPercent =
    signableTasks.length === 0 ? 0 : Math.round((signedTasks / signableTasks.length) * 100);

  return {
    leaseId: args.leaseId,
    leaseLabel: `Bail #${args.leaseId.slice(0, 8)}…`,
    primaryTenantName: inferPrimaryTenantName(args.sigStatus, args.tenants),
    progressPercent,
    remainingCount,
    tenants: {
      total: tenantTotal,
      signed: tenantSigned,
      pending: tenantPending,
    },
    guarantors: {
      total: guarantorTasks.length,
      signed: guarantorSigned,
      pending: guarantorPending,
      notRequired: guarantorNotRequired,
    },
    landlord: {
      signed: landlordSigned,
    },
  };
}

function mapDocuments(args: {
  docs: DocLite[];
  sigStatus: SignatureStatusPayloadLite | null;
  signerTasks: SignerTask[];
}): DocumentResource[] {
  const items: DocumentResource[] = [];
  const seen = new Set<string>();

  function pushDoc(doc: DocumentResource) {
    const key = `${doc.type}:${doc.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(doc);
  }

  const contract = args.sigStatus?.contract;
  if (contract?.documentId) {
    pushDoc({
      id: contract.documentId,
      label: "Contrat de location",
      type: "CONTRACT",
      filename: contract.filename || null,
      statusLabel: contract.signedFinalDocumentId ? "Signé" : "Généré",
      downloadable: true,
      signedFinalDocumentId: contract.signedFinalDocumentId || null,
    });
  }

  args.signerTasks
    .filter((t) => t.kind === "GUARANTOR" && t.documentId)
    .forEach((t) => {
      pushDoc({
        id: t.documentId as string,
        label: `${t.documentLabel} — ${t.displayName}`,
        type: "GUARANTOR_ACT",
        filename: t.documentFilename || null,
        statusLabel: t.signedFinalDocumentId ? "Signé" : t.statusLabel,
        downloadable: true,
        signedFinalDocumentId: t.signedFinalDocumentId || null,
      });
    });

  const noticeDoc = args.docs.find((d) => d.type === "NOTICE");
  if (noticeDoc) {
    pushDoc({
      id: noticeDoc.id,
      label: "Notice",
      type: "NOTICE",
      filename: noticeDoc.filename || null,
      statusLabel: "Généré",
      downloadable: true,
    });
  }

  const packDoc = args.docs.find((d) => d.type === "PACK");
  if (packDoc) {
    pushDoc({
      id: packDoc.id,
      label: "Pack documents",
      type: "PACK",
      filename: packDoc.filename || null,
      statusLabel: "Généré",
      downloadable: true,
    });
  }

  const packFinalDoc = args.docs.find((d) => d.type === "PACK_FINAL");
  if (packFinalDoc) {
    pushDoc({
      id: packFinalDoc.id,
      label: "Pack final",
      type: "PACK_FINAL",
      filename: packFinalDoc.filename || null,
      statusLabel: "Signé",
      downloadable: true,
    });
  }

  const edlDocs = args.docs.filter((d) => d.type === "EDL");
  edlDocs.forEach((doc, index) => {
    pushDoc({
      id: doc.id,
      label: `EDL ${index + 1}`,
      type: "EDL",
      filename: doc.filename || null,
      statusLabel: "Généré",
      downloadable: true,
    });
  });

  const inventoryDocs = args.docs.filter((d) => d.type === "INVENTORY");
  inventoryDocs.forEach((doc, index) => {
    pushDoc({
      id: doc.id,
      label: `Inventaire ${index + 1}`,
      type: "INVENTORY",
      filename: doc.filename || null,
      statusLabel: "Généré",
      downloadable: true,
    });
  });

  return items;
}

function sortSignerTasks(tasks: SignerTask[]): SignerTask[] {
  function rankTask(task: SignerTask): number {
    if (task.kind === "TENANT" && task.roleLabel === "Locataire principal") return 1;
    if (task.kind === "TENANT") return 2;
    if (task.kind === "GUARANTOR") return 3;
    if (task.kind === "LANDLORD") return 4;
    return 99;
  }

  return [...tasks].sort((a, b) => {
    const rankDiff = rankTask(a) - rankTask(b);
    if (rankDiff !== 0) return rankDiff;

    return String(a.displayName || "").localeCompare(String(b.displayName || ""), "fr", {
      sensitivity: "base",
    });
  });
}

export function mapSignatureData(args: MapSignatureDataArgs): MapSignatureDataResult {
  const tenantTasks = mapTenantTasks(args.sigStatus);
  const guarantorTasks = mapGuarantorTasks(args.sigStatus, args.guaranteeActOverride);
  const landlordTask = mapLandlordTask(args.sigStatus);

  const signerTasks = sortSignerTasks([...tenantTasks, ...guarantorTasks, landlordTask]);

  const overview = mapOverview({
    leaseId: args.leaseId,
    sigStatus: args.sigStatus,
    tenants: args.tenants,
    signerTasks,
  });

  const documents = mapDocuments({
    docs: args.docs,
    sigStatus: args.sigStatus,
    signerTasks,
  });

  return {
    overview,
    signerTasks,
    documents,
  };
}