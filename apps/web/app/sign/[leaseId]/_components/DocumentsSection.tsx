import React from "react";
import type { DocumentResource } from "../_types/signature-center.types";
import { FileText, ChevronRight } from "lucide-react";
import { SIGN_UI, InlineTextStatus, SectionTitle, statusToneFromLabel } from "./signature-ui";


type DocumentsSectionProps = {
  documents: DocumentResource[];
  onDownloadDocument: (doc: DocumentResource) => void;
  onDownloadSignedDocument: (doc: DocumentResource) => void;
  onRegenerateContract?: () => void;
  onRegenerateEdlEntry?: () => void;
  onRegenerateInventoryEntry?: () => void;
  onRegenerateEdlExit?: () => void;
  onRegenerateInventoryExit?: () => void;
};

function DocumentActionLink({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: "none",
        border: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        fontFamily: SIGN_UI.font,
        fontSize: 12.75,
        lineHeight: 1.2,
        fontWeight: 500,
        color: "rgba(47,99,224,0.78)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        whiteSpace: "nowrap",
        letterSpacing: "-0.01em",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "rgba(47,99,224,0.92)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "rgba(47,99,224,0.78)";
      }}
    >
      {children}
      <ChevronRight size={12} strokeWidth={1.95} />
    </button>
  );
}

export function DocumentsSection({
  documents,
  onDownloadDocument,
  onDownloadSignedDocument,
  onRegenerateContract,
  onRegenerateEdlEntry,
  onRegenerateInventoryEntry,
  onRegenerateEdlExit,
  onRegenerateInventoryExit,
}: DocumentsSectionProps) {

  function getRegenerateHandler(doc: DocumentResource) {
    if (doc.label === "Contrat de location") return onRegenerateContract;
    if (doc.label === "EDL entrée") return onRegenerateEdlEntry;
    if (doc.label === "Inventaire entrée") return onRegenerateInventoryEntry;
    if (doc.label === "EDL sortie") return onRegenerateEdlExit;
    if (doc.label === "Inventaire sortie") return onRegenerateInventoryExit;
    return undefined;
  }

  return (
    <section
      style={{
        fontFamily: SIGN_UI.font,
        minWidth: 0,
        display: "grid",
        gap: 16,
      }}
    >

      <SectionTitle
        eyebrow="Documents du dossier"
        title={
          documents.length === 0
            ? "Aucun document disponible"
            : `${documents.length} document${documents.length > 1 ? "s" : ""}`
        }
      />

      {documents.length === 0 ? (
        <div
          style={{
            paddingTop: 10,
            borderTop: `1px solid ${SIGN_UI.colors.line}`,
            fontSize: 13,
            lineHeight: 1.55,
            color: SIGN_UI.colors.textSoft,
          }}
        >
          Les documents apparaîtront ici dès que le contrat, les actes ou les packs auront été générés.
        </div>
      ) : (
        <div className="documents-list" style={{ borderTop: `1px solid ${SIGN_UI.colors.line}` }}>
          {documents.map((doc, index) => {
            const tone = statusToneFromLabel(doc.statusLabel);

            return (
              <div
                key={doc.id}
                className="document-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "13px 0",
                  borderTop: index === 0 ? "none" : `1px solid ${SIGN_UI.colors.lineSoft}`,
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
                  <FileText
                    size={14}
                    strokeWidth={1.9}
                    color="#8EA3D4"
                    style={{ flexShrink: 0, opacity: 0.82 }}
                  />

                  <div
                    style={{
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      minHeight: 28,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#22324D",
                        lineHeight: 1.3,
                        minWidth: 0,
                        wordBreak: "break-word",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {doc.label}
                    </span>

                    {doc.statusLabel ? (
                      <InlineTextStatus tone={tone}>
                        {doc.statusLabel}
                      </InlineTextStatus>
                    ) : null}
                  </div>
                </div>

                <div
                  className="document-actions"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  {doc.downloadable ? (
                    <DocumentActionLink onClick={() => onDownloadDocument(doc)}>
                      Télécharger
                    </DocumentActionLink>
                  ) : null}

                  {doc.signedFinalDocumentId ? (
                    <DocumentActionLink onClick={() => onDownloadSignedDocument(doc)}>
                      Télécharger signé
                    </DocumentActionLink>
                  ) : null}

                  {getRegenerateHandler(doc) ? (
                    <DocumentActionLink onClick={getRegenerateHandler(doc)!}>
                      Régénérer
                    </DocumentActionLink>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 700px) {
              .document-row {
                grid-template-columns: 1fr !important;
                gap: 10px !important;
                align-items: start !important;
                padding: 16px 0 !important;
              }

              .document-actions {
                display: grid !important;
                grid-template-columns: 1fr !important;
                justify-content: stretch !important;
                gap: 8px !important;
                width: 100% !important;
              }

              .document-actions button {
                width: 100% !important;
                min-height: 44px !important;
                justify-content: center !important;
                padding: 10px 12px !important;
                border: 1px solid rgba(47,99,224,0.14) !important;
                border-radius: 12px !important;
                background: #ffffff !important;
                font-size: 14px !important;
              }
            }
          `,
        }}
      />
    </section>
  );
}