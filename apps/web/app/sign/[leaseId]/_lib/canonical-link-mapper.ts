import type { CanonicalSignatureTask } from "../../../_lib/canonical-signature.types";
import type { CreateCanonicalPublicLinkInput } from "../../../_lib/canonical-public-links.types";

export function canCreateCanonicalLink(task: CanonicalSignatureTask): boolean {
  if (task.documentType === "LEASE_CONTRACT" && task.signerRole === "TENANT") {
    return true;
  }

  if (task.documentType === "LEASE_CONTRACT" && task.signerRole === "LANDLORD") {
    return true;
  }

  if (task.documentType === "GUARANTEE_ACT" && task.signerRole === "GUARANTOR") {
    return true;
  }

  if (task.documentType === "GUARANTEE_ACT" && task.signerRole === "LANDLORD") {
    return true;
  }

  if (task.documentType === "EDL_ENTRY" && task.signerRole === "TENANT") {
    return true;
  }

  if (task.documentType === "EDL_ENTRY" && task.signerRole === "LANDLORD") {
    return true;
  }

  if (task.documentType === "INVENTORY_ENTRY" && task.signerRole === "TENANT") {
    return true;
  }

  if (task.documentType === "INVENTORY_ENTRY" && task.signerRole === "LANDLORD") {
    return true;
  }

  if (task.documentType === "EDL_EXIT" && task.signerRole === "TENANT") {
    return true;
  }

  if (task.documentType === "EDL_EXIT" && task.signerRole === "LANDLORD") {
    return true;
  }

  if (task.documentType === "INVENTORY_EXIT" && task.signerRole === "TENANT") {
    return true;
  }

  if (task.documentType === "INVENTORY_EXIT" && task.signerRole === "LANDLORD") {
    return true;
  }

  return false;
}

export function toCanonicalPublicLinkInput(
  task: CanonicalSignatureTask,
  force = false,
): CreateCanonicalPublicLinkInput | null {
  if (!canCreateCanonicalLink(task)) {
    return null;
  }

  return {
    leaseId: task.leaseId,
    documentType: task.documentType,
    signerRole: task.signerRole,
    phase: task.phase,
    force,
    tenantId:
      task.signerRef.kind === "TENANT" ? task.signerRef.tenantId : undefined,
    guaranteeId:
      task.signerRef.kind === "GUARANTOR"
        ? task.signerRef.guaranteeId
        : task.signerRef.kind === "LANDLORD"
          ? task.signerRef.guaranteeId
          : undefined,
  };
}