import React from "react";
import type { DocumentResource } from "../_types/signature-center.types";

type DocumentsSectionProps = {
  documents: DocumentResource[];
  onDownloadDocument: (doc: DocumentResource) => void;
  onDownloadSignedDocument: (doc: DocumentResource) => void;
};

const textStrong = "#172033";
const textSoft = "#667085";
const borderSoft = "#dde3ec";

export function DocumentsSection({
  documents,
  onDownloadDocument,
  onDownloadSignedDocument,
}: DocumentsSectionProps) {
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: "#94a3b8",
            boxShadow: "0 0 0 6px rgba(148,163,184,0.10)",
          }}
        />
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 0.02,
            color: "#667085",
            textTransform: "uppercase",
          }}
        >
          Documents du dossier
        </div>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: `1px solid ${borderSoft}`,
          borderRadius: 20,
          padding: 18,
          boxShadow: "0 10px 30px rgba(15,23,42,0.04), 0 2px 6px rgba(15,23,42,0.03)",
          display: "grid",
          gap: 10,
        }}
      >
        {documents.length === 0 ? (
          <div
            style={{
              color: textSoft,
              fontSize: 14,
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            Aucun document à afficher pour le moment.
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={`${doc.type}-${doc.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "center",
                padding: "14px 0",
                borderBottom: "1px solid rgba(226,232,240,0.7)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 220 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: textStrong,
                    letterSpacing: -0.02,
                    fontFamily:
                      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  {doc.label}
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13.5,
                    color: textSoft,
                    fontFamily:
                      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  {doc.statusLabel}
                  {doc.filename ? ` • ${doc.filename}` : ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => onDownloadDocument(doc)}
                  disabled={!doc.downloadable}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 14,
                    border: "1px solid #cfd8e3",
                    background: "#ffffff",
                    color: "#243041",
                    fontWeight: 600,
                    cursor: doc.downloadable ? "pointer" : "not-allowed",
                    opacity: doc.downloadable ? 1 : 0.55,
                    fontFamily:
                      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  Télécharger
                </button>

                {doc.signedFinalDocumentId ? (
                  <button
                    type="button"
                    onClick={() => onDownloadSignedDocument(doc)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 14,
                      border: "1px solid #2F5FB8",
                      background: "#2F5FB8",
                      color: "#ffffff",
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 8px 18px rgba(47,95,184,0.18), inset 0 -1px 0 rgba(0,0,0,0.08)",
                      fontFamily:
                        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    }}
                  >
                    Télécharger signé
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}