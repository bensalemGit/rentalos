import React from "react";
import type { DocumentResource } from "../_types/signature-center.types";
import { FileText, ChevronRight } from "lucide-react";
import { SIGN_UI, InlineTextStatus, SectionTitle, statusToneFromLabel } from "./signature-ui";

type DocumentsSectionProps = {
  documents: DocumentResource[];
  onDownloadDocument: (doc: DocumentResource) => void;
  onDownloadSignedDocument: (doc: DocumentResource) => void;
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
        fontSize: 13,
        lineHeight: 1.2,
        fontWeight: 500,
        color: SIGN_UI.colors.blue,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        whiteSpace: "nowrap",
        letterSpacing: "-0.01em",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = SIGN_UI.colors.blueHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = SIGN_UI.colors.blue;
      }}
    >
      {children}
      <ChevronRight size={13} strokeWidth={2.05} />
    </button>
  );
}

export function DocumentsSection({
  documents,
  onDownloadDocument,
  onDownloadSignedDocument,
}: DocumentsSectionProps) {
  return (
    <section
      style={{
        fontFamily: SIGN_UI.font,
        minWidth: 0,
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
        <div style={{ borderTop: `1px solid ${SIGN_UI.colors.line}` }}>
          {documents.map((doc, index) => {
            const tone = statusToneFromLabel(doc.statusLabel);

            return (
              <div
                key={doc.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto",
                  gap: 14,
                  alignItems: "center",
                  padding: "12px 0",
                  borderTop: index === 0 ? "none" : `1px solid ${SIGN_UI.colors.lineSoft}`,
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                  }}
                >
                  <FileText
                    size={14}
                    strokeWidth={1.95}
                    color="#7C92C9"
                    style={{ flexShrink: 0, opacity: 0.92 }}
                  />

                  <div
                    style={{
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 400,
                        color: SIGN_UI.colors.textStrong,
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
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}