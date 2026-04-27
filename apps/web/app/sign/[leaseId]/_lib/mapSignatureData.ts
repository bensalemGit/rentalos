import type {
  DocumentResource,
  SignatureGlobalStatus,
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

type SignableDocNeed = {
  landlord?: { required: boolean; signed: boolean };
  tenants?: Array<{
    tenantId: string;
    required: boolean;
    signed: boolean;
  }>;
};

type SignableDocBlockLite = {
  key: string;
  label: string;
  documentId: string | null;
  filename?: string | null;
  signedFinalDocumentId?: string | null;
  status?: string | null;
  need?: SignableDocNeed;
  landlordLastLink?: {
    createdAt?: string | null;
    expiresAt?: string | null;
    consumedAt?: string | null;
  } | null;
  tenantLastLinkByTenantId?: Record<
    string,
    {
      createdAt?: string | null;
      expiresAt?: string | null;
      consumedAt?: string | null;
    } | null
  >;
};

type SignatureStatusPayloadLite = {
  contract?: {
    documentId?: string | null;
    filename?: string | null;
    status?: string | null;
    signedFinalDocumentId?: string | null;
    landlord?: {
      signatureStatus?: string | null;
      lastLink?: {
        createdAt?: string | null;
        consumedAt?: string | null;
      } | null;
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
    need?: {
      guarantor: boolean;
      landlord: boolean;
    };
    signatures?: {
      guarantorSigned: boolean;
      landlordSigned: boolean;
      remainingRoles: Array<"GUARANTOR" | "LANDLORD">;
    };
    lastLink?: {
      createdAt?: string | null;
      consumedAt?: string | null;
    } | null;
  }>;
  edl?: {
    entry?: SignableDocBlockLite | null;
    exit?: SignableDocBlockLite | null;
  };
  inventory?: {
    entry?: SignableDocBlockLite | null;
    exit?: SignableDocBlockLite | null;
  };
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
  landlordName?: string | null;
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
  hasActiveLink: boolean;
  allTenantsSigned: boolean;
}): SignerTaskStatus {
  const raw = String(args.signatureStatus || "").toUpperCase();

  if (!args.contractDocumentId) return "NOT_READY";
  if (raw === "SIGNED") return "SIGNED";
  if (!args.allTenantsSigned) return "NOT_READY";
  if (args.hasActiveLink) return "LINK_SENT";
  return "READY";
}

function mapSignableDocTaskStatus(signed: boolean): SignerTaskStatus {
  return signed ? "SIGNED" : "READY";
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
      id: `tenant:contract:${t.leaseTenantId}`,
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

    const guarantorSigned =
      Boolean(g.signatures?.guarantorSigned) ||
      (String(g.signatureStatus || "").toUpperCase() === "SIGNED" && !isVisale);

    const landlordSigned = Boolean(g.signatures?.landlordSigned);

    const progressLabel = isVisale
      ? "Aucune signature garant requise"
      : String(g.signatureStatus || "").toUpperCase() === "SIGNED"
        ? "Signature finalisée"
        : !effectiveActId
          ? "Acte de caution à préparer"
          : guarantorSigned && !landlordSigned
            ? "Garant signé • Bailleur à signer"
            : !guarantorSigned && landlordSigned
              ? "Bailleur signé • Garant à signer"
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
      signatureDetails: isVisale
        ? undefined
        : {
            guarantorSigned,
            landlordSigned,
            remainingRoles: g.signatures?.remainingRoles || [],
          },
      landlordPendingOnDocument: !isVisale && Boolean(effectiveActId) && !landlordSigned,
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

function buildLandlordGuaranteeSubTasks(
  sigStatus: SignatureStatusPayloadLite | null,
  guaranteeActOverride: Record<string, string>,
): SignerTask[] {
  const guarantees = Array.isArray(sigStatus?.guarantees) ? sigStatus!.guarantees : [];

  const tenantNameByLeaseTenantId = new Map<string, string>();

  (sigStatus?.contract?.tenants || []).forEach((t) => {
    const leaseTenantId = String(t.leaseTenantId || "").trim();
    const fullName = String(t.fullName || "").trim();

    if (leaseTenantId && fullName) {
      tenantNameByLeaseTenantId.set(leaseTenantId, fullName);
    }
  });

  return guarantees
    .filter((g) => String(g.type || "").toUpperCase() !== "VISALE")
    .map((g) => {
      const effectiveActId = guaranteeActOverride[g.guaranteeId] || g.actDocumentId || null;
      if (!effectiveActId) return null;

      const landlordSigned = Boolean(g.signatures?.landlordSigned);
      const guarantorSigned =
        Boolean(g.signatures?.guarantorSigned) ||
        String(g.signatureStatus || "").toUpperCase() === "SIGNED";

      const tenantName =
        tenantNameByLeaseTenantId.get(String(g.leaseTenantId || "").trim()) ||
        String(g.tenantFullName || "").trim();

      const status: SignerTaskStatus = landlordSigned ? "SIGNED" : "READY";

      return {
        id: `landlord:guarantee:${g.guaranteeId}`,
        kind: "LANDLORD",
        displayName: "Bailleur",
        roleLabel: "Bailleur",
        tenantLabel: tenantName ? `Acte de caution pour ${tenantName}` : "Acte de caution",
        helperLabel: guarantorSigned
          ? "Contresignature bailleur requise"
          : "En attente de la signature du garant",
        documentId: effectiveActId,
        documentLabel: "Acte de caution",
        documentFilename: null,
        status,
        statusLabel: toTaskStatusLabel(status),
        activeMode: null,
        canSignOnSite: !landlordSigned && guarantorSigned,
        canSendEmailLink: !landlordSigned && guarantorSigned,
        canResendLink: false,
        canDownloadSigned: Boolean(g.signedFinalDocumentId),
        signedFinalDocumentId: g.signedFinalDocumentId || null,
        signedFinalFilename: g.signedFinalDocumentId ? "acte_caution_SIGNE.pdf" : null,
        guaranteeId: g.guaranteeId,
        hasActiveLink: false,
        activeLinkCreatedAt: null,
        requiresPreparation: false,
        preparationLabel: null,
        isOptional: true,
        isBlocked: !guarantorSigned,
        blockedReason: !guarantorSigned ? "Le garant doit signer avant le bailleur" : null,
      } as SignerTask;
    })
    .filter(Boolean) as SignerTask[];
}

function mapLandlordTask(
  sigStatus: SignatureStatusPayloadLite | null,
  landlordName?: string | null,
): SignerTask {
  const contract = sigStatus?.contract;
  const contractTenants = contract?.tenants || [];

  const allTenantsSigned =
    contractTenants.length > 0 &&
    contractTenants.every((t) => String(t.signatureStatus || "").toUpperCase() === "SIGNED");

  const hasActiveLink = Boolean(
    contract?.landlord?.lastLink && !contract?.landlord?.lastLink?.consumedAt,
  );

  const status = mapLandlordTaskStatus({
    contractDocumentId: contract?.documentId,
    signatureStatus: contract?.landlord?.signatureStatus,
    hasActiveLink,
    allTenantsSigned,
  });

  return {
    id: "landlord:contract",
    kind: "LANDLORD",
    displayName: String(landlordName || "").trim() || "Bailleur",
    roleLabel: "Bailleur",
    documentId: contract?.documentId || null,
    documentLabel: "Contrat de location",
    documentFilename: contract?.filename || null,
    status,
    statusLabel: toTaskStatusLabel(status),
    activeMode: status === "LINK_SENT" ? "EMAIL" : null,
    canSignOnSite: Boolean(contract?.documentId) && allTenantsSigned && status !== "SIGNED",
    canSendEmailLink: Boolean(contract?.documentId) && allTenantsSigned && status !== "SIGNED",
    canResendLink: status === "LINK_SENT",
    canDownloadSigned: Boolean(contract?.signedFinalDocumentId),
    signedFinalDocumentId: contract?.signedFinalDocumentId || null,
    signedFinalFilename: contract?.signedFinalDocumentId ? "contrat_SIGNE.pdf" : null,
    hasActiveLink,
    activeLinkCreatedAt: contract?.landlord?.lastLink?.createdAt || null,
    isOptional: false,
    isBlocked: !contract?.documentId || !allTenantsSigned,
    blockedReason: !contract?.documentId
      ? "Contrat non généré"
      : !allTenantsSigned
        ? "Tous les locataires doivent signer avant le bailleur"
        : null,
  };
}

function buildSecondaryTenantTasks(args: {
  block: SignableDocBlockLite | null | undefined;
  documentLabel: string;
  contractTenants: Array<{
    leaseTenantId: string;
    tenantId: string;
    fullName?: string | null;
    role?: string | null;
  }>;
}): SignerTask[] {
  const { block, documentLabel, contractTenants } = args;
  if (!block?.documentId) return [];

  const tenantNeedByTenantId = new Map(
    (block.need?.tenants || []).map((t) => [String(t.tenantId), t]),
  );

  return contractTenants.map((tenant) => {
    const need = tenantNeedByTenantId.get(String(tenant.tenantId));
    const signed = Boolean(need?.signed);
    const lastLink =
      block.tenantLastLinkByTenantId?.[String(tenant.tenantId || '')] || null;
    const hasActiveLink = Boolean(lastLink && !lastLink.consumedAt);

    const status = signed
      ? "SIGNED"
      : hasActiveLink
        ? "LINK_SENT"
        : "READY";

    return {
      id: `tenant:${block.key}:${tenant.leaseTenantId}`,
      kind: "TENANT",
      displayName: String(tenant.fullName || "").trim() || "Locataire",
      roleLabel:
        String(tenant.role || "").toLowerCase() === "principal"
          ? "Locataire principal"
          : "Cotitulaire",
      documentId: block.documentId,
      documentLabel,
      documentFilename: block.filename || null,
      status,
      statusLabel: toTaskStatusLabel(status),
      activeMode: hasActiveLink ? "EMAIL" : null,
      canSignOnSite: status !== "SIGNED",
      canSendEmailLink: status !== "SIGNED",
      canResendLink: hasActiveLink,
      canDownloadSigned: Boolean(block.signedFinalDocumentId),
      signedFinalDocumentId: block.signedFinalDocumentId || null,
      signedFinalFilename: block.signedFinalDocumentId ? `${documentLabel}_SIGNE.pdf` : null,
      tenantId: tenant.tenantId,
      hasActiveLink,
      activeLinkCreatedAt: lastLink?.createdAt || null,
      requiresPreparation: false,
      preparationLabel: null,
      helperLabel: hasActiveLink ? "Lien public envoyé" : null,
      isOptional: false,
      isBlocked: false,
      blockedReason: null,
    };
  });
}

function buildSecondaryLandlordTask(args: {
  block: SignableDocBlockLite | null | undefined;
  documentLabel: string;
}): SignerTask[] {
  const { block, documentLabel } = args;
  if (!block?.documentId) return [];

  const signed = Boolean(block.need?.landlord?.signed);
  const lastLink = block.landlordLastLink || null;
  const hasActiveLink = Boolean(lastLink && !lastLink.consumedAt);
  const status = signed ? "SIGNED" : hasActiveLink ? "LINK_SENT" : "READY";

  return [
    {
      id: `landlord:${block.key}`,
      kind: "LANDLORD",
      displayName: "Bailleur",
      roleLabel: "Bailleur",
      documentId: block.documentId,
      documentLabel,
      documentFilename: block.filename || null,
      status,
      statusLabel: toTaskStatusLabel(status),
      activeMode: hasActiveLink ? "EMAIL" : null,
      canSignOnSite: status !== "SIGNED",
      canSendEmailLink: status !== "SIGNED",
      canResendLink: hasActiveLink,
      canDownloadSigned: Boolean(block.signedFinalDocumentId),
      signedFinalDocumentId: block.signedFinalDocumentId || null,
      signedFinalFilename: block.signedFinalDocumentId ? `${documentLabel}_SIGNE.pdf` : null,
      hasActiveLink,
      activeLinkCreatedAt: lastLink?.createdAt || null,
      requiresPreparation: false,
      preparationLabel: null,
      helperLabel: hasActiveLink ? "Lien public envoyé" : null,
      isOptional: false,
      isBlocked: false,
      blockedReason: null,
    },
  ];
}

function mapSecondaryDocTasks(sigStatus: SignatureStatusPayloadLite | null): SignerTask[] {
  const contractTenants = sigStatus?.contract?.tenants || [];

  const edlEntry = sigStatus?.edl?.entry || null;
  const edlExit = sigStatus?.edl?.exit || null;

  const inventoryEntry = sigStatus?.inventory?.entry || null;
  const inventoryExit = sigStatus?.inventory?.exit || null;

  return [
    ...buildSecondaryTenantTasks({
      block: edlEntry,
      documentLabel: "EDL entrée",
      contractTenants,
    }),
    ...buildSecondaryLandlordTask({
      block: edlEntry,
      documentLabel: "EDL entrée",
    }),

    ...buildSecondaryTenantTasks({
      block: inventoryEntry,
      documentLabel: "Inventaire entrée",
      contractTenants,
    }),
    ...buildSecondaryLandlordTask({
      block: inventoryEntry,
      documentLabel: "Inventaire entrée",
    }),

    ...buildSecondaryTenantTasks({
      block: edlExit,
      documentLabel: "EDL sortie",
      contractTenants,
    }),
    ...buildSecondaryLandlordTask({
      block: edlExit,
      documentLabel: "EDL sortie",
    }),

    ...buildSecondaryTenantTasks({
      block: inventoryExit,
      documentLabel: "Inventaire sortie",
      contractTenants,
    }),
    ...buildSecondaryLandlordTask({
      block: inventoryExit,
      documentLabel: "Inventaire sortie",
    }),
  ];
}

function computeGlobalStatus(args: {
  sigStatus: SignatureStatusPayloadLite | null;
  signerTasks: SignerTask[];
  docs: DocLite[];
}): {
  status: SignatureGlobalStatus;
  label: string;
  help: string | null;
} {
  const contractSigned = Boolean(args.sigStatus?.contract?.signedFinalDocumentId);

  const guarantees = Array.isArray(args.sigStatus?.guarantees) ? args.sigStatus!.guarantees : [];
  const requiredGuarantees = guarantees.filter((g) => String(g.type || "").toUpperCase() !== "VISALE");

  const guaranteesPrepared = requiredGuarantees.every(
    (g) => Boolean(g.actDocumentId),
  );

  const guaranteesSigned = requiredGuarantees.every(
    (g) => Boolean(g.signedFinalDocumentId),
  );

  const hasPreparationBlocker =
    !args.sigStatus?.contract?.documentId ||
    !guaranteesPrepared;

  if (hasPreparationBlocker) {
    return {
      status: "PREPARATION",
      label: "À préparer",
      help: !args.sigStatus?.contract?.documentId
        ? "Le contrat doit être généré avant de lancer les signatures."
        : "Un ou plusieurs actes de caution doivent être préparés.",
    };
  }

  if (!contractSigned || !guaranteesSigned) {
    return {
      status: "SIGNATURE",
      label: "En signature",
      help: "Des signatures restent à finaliser sur le contrat ou la caution.",
    };
  }

  const edlEntry = args.sigStatus?.edl?.entry || null;
  const inventoryEntry = args.sigStatus?.inventory?.entry || null;

  const edlRequired = Boolean(edlEntry?.documentId);
  const inventoryRequired = Boolean(inventoryEntry?.documentId);

  const hasEdlSignedFinal = edlRequired
    ? Boolean(edlEntry?.signedFinalDocumentId)
    : true;

  const hasInventorySignedFinal = inventoryRequired
    ? Boolean(inventoryEntry?.signedFinalDocumentId)
    : true;

  const packFinalDoc = args.docs.find((d) => d.type === "PACK_FINAL");
  const hasPackFinal = Boolean(packFinalDoc);

  if (!hasEdlSignedFinal || !hasInventorySignedFinal || !hasPackFinal) {
    return {
      status: "INCOMPLETE_CLOSURE",
      label: "Clôture documentaire incomplète",
      help: !hasEdlSignedFinal
        ? "L’EDL d’entrée signé final doit encore être généré."
        : !hasInventorySignedFinal
          ? "L’inventaire d’entrée signé final doit encore être généré."
          : "Le pack final doit encore être généré ou régénéré.",
    };
  }

  return {
    status: "CLOSED",
    label: "Clos",
    help: "Tous les documents requis sont signés et le pack final est disponible.",
  };
}

function flattenSignerTasks(tasks: SignerTask[]): SignerTask[] {
  return tasks.flatMap((task) => [
    task,
    ...((task.subTasks || []) as SignerTask[]),
  ]);
}

function mapOverview(args: {
  leaseId: string;
  sigStatus: SignatureStatusPayloadLite | null;
  tenants: LeaseTenantLite[];
  signerTasks: SignerTask[];
  docs: DocLite[];
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

  const allTasks = flattenSignerTasks(args.signerTasks);

  const landlordTasks = allTasks.filter((t) => t.kind === "LANDLORD");
  const landlordSigned =
    landlordTasks.length > 0 && landlordTasks.every((t) => t.status === "SIGNED");

  const signableTasks = allTasks.filter((t) => t.status !== "NOT_REQUIRED");
  const signedTasks = signableTasks.filter((t) => t.status === "SIGNED").length;


  const remainingCount = Math.max(signableTasks.length - signedTasks, 0);
  const progressPercent =
    signableTasks.length === 0 ? 0 : Math.round((signedTasks / signableTasks.length) * 100);

  const global = computeGlobalStatus({
    sigStatus: args.sigStatus,
    signerTasks: args.signerTasks,
    docs: args.docs,
  });

  return {
    leaseId: args.leaseId,
    leaseLabel: `Bail #${args.leaseId.slice(0, 8)}…`,
    primaryTenantName: inferPrimaryTenantName(args.sigStatus, args.tenants),
    progressPercent,
    remainingCount,
    globalStatus: global.status,
    globalStatusLabel: global.label,
    globalStatusHelp: global.help,
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

  const secondaryBlocks: Array<{ block: SignableDocBlockLite | null | undefined; type: string; label: string }> = [
    { block: args.sigStatus?.edl?.entry, type: "EDL_ENTRY", label: "EDL entrée" },
    { block: args.sigStatus?.inventory?.entry, type: "INVENTORY_ENTRY", label: "Inventaire entrée" },
    { block: args.sigStatus?.edl?.exit, type: "EDL_EXIT", label: "EDL sortie" },
    { block: args.sigStatus?.inventory?.exit, type: "INVENTORY_EXIT", label: "Inventaire sortie" },
  ];

  secondaryBlocks.forEach(({ block, type, label }) => {
    if (!block?.documentId) return;
    pushDoc({
      id: block.documentId,
      label,
      type,
      filename: block.filename || null,
      statusLabel: block.signedFinalDocumentId ? "Signé" : "Généré",
      downloadable: true,
      signedFinalDocumentId: block.signedFinalDocumentId || null,
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


  const exitCertificateDoc = args.docs.find(
    (d) => d.type === "ATTESTATION_SORTIE",
  );
  if (exitCertificateDoc) {
    pushDoc({
      id: exitCertificateDoc.id,
      label: "Attestation de sortie",
      type: "ATTESTATION_SORTIE",
      filename: exitCertificateDoc.filename || null,
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

  const exitPackDoc = args.docs.find(
    (d) => d.type === "PACK_EDL_INV_SORTIE",
  );
  if (exitPackDoc) {
    pushDoc({
      id: exitPackDoc.id,
      label: "Pack sortie",
      type: "PACK_EDL_INV_SORTIE",
      filename: exitPackDoc.filename || null,
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

  return items;
}

function sortSignerTasks(tasks: SignerTask[]): SignerTask[] {
  function docRank(task: SignerTask): number {
    if (task.documentLabel === "Contrat de location") return 1;
    if (task.documentLabel === "Acte de caution") return 2;
    if (task.documentLabel === "EDL entrée") return 3;
    if (task.documentLabel === "Inventaire entrée") return 4;
    if (task.documentLabel === "EDL sortie") return 5;
    if (task.documentLabel === "Inventaire sortie") return 6;
    return 99;
  }

  function personRank(task: SignerTask): number {
    if (task.kind === "TENANT" && task.roleLabel === "Locataire principal") return 1;
    if (task.kind === "TENANT") return 2;
    if (task.kind === "GUARANTOR") return 3;
    if (task.kind === "LANDLORD") return 4;
    return 99;
  }

  return [...tasks].sort((a, b) => {
    const docDiff = docRank(a) - docRank(b);
    if (docDiff !== 0) return docDiff;

    const personDiff = personRank(a) - personRank(b);
    if (personDiff !== 0) return personDiff;

    return String(a.displayName || "").localeCompare(String(b.displayName || ""), "fr", {
      sensitivity: "base",
    });
  });
}

export function mapSignatureData(args: MapSignatureDataArgs): MapSignatureDataResult {
  const tenantTasks = mapTenantTasks(args.sigStatus);
  const guarantorTasks = mapGuarantorTasks(args.sigStatus, args.guaranteeActOverride);
  const landlordTask = mapLandlordTask(args.sigStatus, args.landlordName);
  const secondaryDocTasks = mapSecondaryDocTasks(args.sigStatus);
  const landlordGuaranteeSubTasks = buildLandlordGuaranteeSubTasks(
    args.sigStatus,
    args.guaranteeActOverride,
  );

  const primaryTasks = [
    ...tenantTasks,
    ...guarantorTasks,
    landlordTask,
  ];

  const signerTasks = sortSignerTasks(
    primaryTasks.map((task) => {
      const subTasks = [
        ...secondaryDocTasks.filter((subTask) => {
          if (task.kind === "TENANT" && subTask.kind === "TENANT") {
            return task.tenantId && subTask.tenantId === task.tenantId;
          }

          if (task.kind === "LANDLORD" && subTask.kind === "LANDLORD") {
            return true;
          }

          return false;
        }),
        ...(task.kind === "LANDLORD" ? landlordGuaranteeSubTasks : []),
      ];

      if (subTasks.length === 0) {
        return task;
      }

      return {
        ...task,
        subTasks,
      } as SignerTask;
    }),
  );

  const overview = mapOverview({
    leaseId: args.leaseId,
    sigStatus: args.sigStatus,
    tenants: args.tenants,
    signerTasks,
    docs: args.docs,
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