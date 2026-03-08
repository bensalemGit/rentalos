import React from "react";
import type { DocumentResource } from "../_types/signature-center.types";

type DocumentsSectionProps = {
  documents: DocumentResource[];
  onDownloadDocument: (doc: DocumentResource) => void;
  onDownloadSignedDocument: (doc: DocumentResource) => void;
};

const COLORS = {
  textStrong: "#172033",
  textSoft: "#667085",
  textMuted: "#98A2B3",
  border: "#D9E2EC",
  borderSoft: "#E9EEF5",
  borderStrong: "#C7D3E0",
  surface: "#FFFFFF",
  blue: "#1D4ED8",
  blueSoft: "#EEF4FF",
  blueBorder: "#C7D7FE",
  green: "#16A34A",
  greenSoft: "#F0FDF4",
  greenBorder: "#BBF7D0",
  amber: "#D97706",
  amberSoft: "#FFF7ED",
  amberBorder: "#FED7AA",
  graySoft: "#F8FAFC",
};

function getStatusTone(doc: DocumentResource) {
  const value = (doc.statusLabel || "").toLowerCase();

  if (doc.signedFinalDocumentId || value.includes("signé")) {
    return {
      background: COLORS.greenSoft,
      border: COLORS.greenBorder,
      color: COLORS.green,
    };
  }

  if (
    value.includes("en cours") ||
    value.includes("prépar") ||
    value.includes("génér") ||
    value.includes("brouillon")
  ) {
    return {
      background: COLORS.amberSoft,
      border: COLORS.amberBorder,
      color: COLORS.amber,
    };
  }

  return {
    background: COLORS.graySoft,
    border: "#E2E8F0",
    color: "#64748B",
  };
}

function getDocumentIcon(doc: DocumentResource) {
  const value = `${doc.label} ${doc.type}`.toLowerCase();

  if (value.includes("caution") || value.includes("garant")) {
    return "🛡️";
  }

  if (value.includes("pack")) {
    return "📦";
  }

  return "📄";
}

export function DocumentsSection({
  documents,
  onDownloadDocument,
  onDownloadSignedDocument,
}: DocumentsSectionProps) {
  return (
    <section
      style={{
        borderRadius: 18,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px 10px 16px",
          borderBottom: `1px solid ${COLORS.borderSoft}`,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: COLORS.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 4,
          }}
        >
          Documents du dossier
        </div>

        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: COLORS.textStrong,
          }}
        >
          {documents.length === 0
            ? "Aucun document disponible"
            : `${documents.length} document${documents.length > 1 ? "s" : ""}`}
        </div>
      </div>

      {documents.length === 0 ? (
        <div
          style={{
            padding: "16px",
            display: "grid",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: COLORS.textStrong,
            }}
          >
            Aucun document disponible pour le moment
          </div>

          <div
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: COLORS.textSoft,
            }}
          >
            Les documents apparaîtront ici dès que le contrat, les actes ou les packs
            auront été générés.
          </div>
        </div>
      ) : (
        <div>
          {documents.map((doc, index) => {
            const tone = getStatusTone(doc);

            return (
              <div
                key={doc.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 16px",
                  borderTop: index === 0 ? "none" : `1px solid ${COLORS.borderSoft}`,
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 28,
                      borderRadius: 12,
                      border: `1px solid ${COLORS.borderSoft}`,
                      background: "#FFF",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 16,
                    }}
                  >
                    {getDocumentIcon(doc)}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: COLORS.textStrong,
                          minWidth: 0,
                          wordBreak: "break-word",
                        }}
                      >
                        {doc.label}
                      </div>

                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: tone.background,
                          border: `1px solid ${tone.border}`,
                          color: tone.color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {doc.statusLabel}
                      </span>
                    </div>

                    {doc.filename ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: COLORS.textSoft,
                          lineHeight: 1.4,
                          wordBreak: "break-word",
                        }}
                      >
                        {doc.filename}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onDownloadDocument(doc)}
                    disabled={!doc.downloadable}
                    style={{
                      appearance: "none",
                      border: `1px solid ${doc.downloadable ? COLORS.borderStrong : "#D0D5DD"}`,
                      background: doc.downloadable ? "#FFFFFF" : "#F2F4F7",
                      color: doc.downloadable ? COLORS.textStrong : "#98A2B3",
                      borderRadius: 10,
                      padding: "9px 12px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: doc.downloadable ? "pointer" : "not-allowed",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Télécharger
                  </button>

                  {doc.signedFinalDocumentId ? (
                    <button
                      type="button"
                      onClick={() => onDownloadSignedDocument(doc)}
                      style={{
                        appearance: "none",
                        border: `1px solid ${COLORS.blue}`,
                        background: COLORS.blue,
                        color: "#FFFFFF",
                        borderRadius: 10,
                        padding: "9px 12px",
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: "pointer",
                        boxShadow: "0 5px 14px rgba(29, 78, 216, 0.16)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Télécharger signé
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}