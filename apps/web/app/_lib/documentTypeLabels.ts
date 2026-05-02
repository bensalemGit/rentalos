export type DocumentCategory = "entry" | "exit" | "guarantee" | "pack" | "legal" | "other";

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CONTRAT: "Contrat de location",

  GUARANTOR_ACT: "Acte de caution",
  ACTE_CAUTION: "Acte de caution",

  EDL_ENTREE: "EDL entrée",
  INVENTAIRE_ENTREE: "Inventaire entrée",
  NOTICE: "Notice",

  EDL_SORTIE: "EDL sortie",
  INVENTAIRE_SORTIE: "Inventaire sortie",
  ATTESTATION_SORTIE: "Attestation sortie",

  PACK_FINAL: "Pack entrée",
  PACK_EDL_INV_SORTIE: "Pack sortie",
};

export const DOCUMENT_TYPE_CATEGORIES: Record<string, DocumentCategory> = {
  CONTRAT: "legal",

  GUARANTOR_ACT: "guarantee",
  ACTE_CAUTION: "guarantee",

  EDL_ENTREE: "entry",
  INVENTAIRE_ENTREE: "entry",
  NOTICE: "entry",

  EDL_SORTIE: "exit",
  INVENTAIRE_SORTIE: "exit",
  ATTESTATION_SORTIE: "exit",

  PACK_FINAL: "pack",
  PACK_EDL_INV_SORTIE: "pack",
};

export function normalizeDocumentType(type?: string | null) {
  return String(type || "").trim().toUpperCase();
}

export function documentTypeLabel(type?: string | null) {
  const key = normalizeDocumentType(type);
  return DOCUMENT_TYPE_LABELS[key] || key || "Document";
}

export function documentTypeCategory(type?: string | null): DocumentCategory {
  const key = normalizeDocumentType(type);
  return DOCUMENT_TYPE_CATEGORIES[key] || "other";
}

export function isSignedFinalDocument(doc: { type?: string | null; filename?: string | null }) {
  const type = normalizeDocumentType(doc.type);
  const filename = String(doc.filename || "").toUpperCase();

  return type === "SIGNED_FINAL" || filename.includes("SIGNED_FINAL");
}

export function isGuarantorActType(type?: string | null) {
  return normalizeDocumentType(type) === "GUARANTOR_ACT";
}

export function isEntryPackType(type?: string | null) {
  return normalizeDocumentType(type) === "PACK_FINAL";
}

export function isExitPackType(type?: string | null) {
  return normalizeDocumentType(type) === "PACK_EDL_INV_SORTIE";
}