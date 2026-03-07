import type { SignerTaskStatus } from "../_types/signature-center.types";

export type SignatureUiTone = "neutral" | "primary" | "warning" | "success" | "danger";

export function toTaskStatusLabel(status: SignerTaskStatus): string {
  switch (status) {
    case "NOT_REQUIRED":
      return "Non requis";
    case "NOT_READY":
      return "À préparer";
    case "READY":
      return "Prêt à signer";
    case "LINK_SENT":
      return "Lien envoyé";
    case "IN_PROGRESS":
      return "En cours";
    case "SIGNED":
      return "Signé";
    case "BLOCKED":
      return "Bloqué";
    default:
      return "—";
  }
}

export function toneFromTaskStatus(status: SignerTaskStatus): SignatureUiTone {
  switch (status) {
    case "SIGNED":
      return "success";
    case "NOT_REQUIRED":
      return "neutral";
    case "READY":
      return "primary";
    case "LINK_SENT":
    case "IN_PROGRESS":
      return "warning";
    case "BLOCKED":
      return "danger";
    case "NOT_READY":
    default:
      return "neutral";
  }
}

export function isTaskActionable(status: SignerTaskStatus): boolean {
  return status === "READY" || status === "LINK_SENT" || status === "IN_PROGRESS";
}

export function isTaskTerminal(status: SignerTaskStatus): boolean {
  return status === "SIGNED" || status === "NOT_REQUIRED";
}