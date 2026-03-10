import React, { useEffect, useState } from "react";
import type { DocumentResource } from "../_types/signature-center.types";

type DocumentsSectionProps = {
  documents: DocumentResource[];
  onDownloadDocument: (doc: DocumentResource) => void;
  onDownloadSignedDocument: (doc: DocumentResource) => void;
};

const FONT =
  '"Inter", "Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

const COLORS = {
  textStrong: "#1B2740",
  textSoft: "#667085",
  textMuted: "#98A2B3",
  line: "rgba(26,39,66,0.06)",
  lineSoft: "rgba(26,39,66,0.045)",
  blue: "#4F6FD3",
  blueHover: "#3F60C5",
  green: "#2FA35B",
  orange: "#C97E14",
  neutral: "#7B879C",
};

function getStatusTone(doc: DocumentResource) {
  const value = (doc.statusLabel || "").toLowerCase();

  if (doc.signedFinalDocumentId || value.includes("signé")) {
    return {
      color: COLORS.green,
      dot: "rgba(47,163,91,0.95)",
    };
  }

  if (
    value.includes("en cours") ||
    value.includes("prépar") ||
    value.includes("génér") ||
    value.includes("brouillon")
  ) {
    return {
      color: COLORS.orange,
      dot: "rgba(201,126,20,0.95)",
    };
  }

  return {
    color: COLORS.neutral,
    dot: "rgba(123,135,156,0.95)",
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

function DownloadLink({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        appearance: "none",
        border: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        fontFamily: FONT,
        fontSize: 13.5,
        lineHeight: 1.4,
        fontWeight: 500,
        color: disabled ? "#A7B0C0" : COLORS.blue,
        cursor: disabled ? "not-allowed" : "pointer",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.color = COLORS.blueHover;
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.color = COLORS.blue;
      }}
    >
      {label}
    </button>
  );
}

export function DocumentsSection({
  documents,
  onDownloadDocument,
  onDownloadSignedDocument,
}: DocumentsSectionProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const sync = () => setIsMobile(window.innerWidth < 720);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return (
    <section
      style={{
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: "#A4AEBD",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 6,
          }}
        >
          Documents du dossier
        </div>

        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: COLORS.textStrong,
            letterSpacing: "-0.01em",
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
            padding: "10px 0 4px 0",
            borderTop: `1px solid ${COLORS.line}`,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: COLORS.textStrong,
              marginBottom: 4,
            }}
          >
            Aucun document disponible pour le moment
          </div>

          <div
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: COLORS.textSoft,
              maxWidth: 760,
            }}
          >
            Les documents apparaîtront ici dès que le contrat, les actes ou les packs
            auront été générés.
          </div>
        </div>
      ) : (
        <div
          style={{
            borderTop: `1px solid ${COLORS.line}`,
          }}
        >
          {documents.map((doc, index) => {
            const tone = getStatusTone(doc);

            return (
              <div
                key={doc.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : "minmax(0, 1fr) auto",
                  gap: isMobile ? 8 : 14,
                  alignItems: "center",
                  padding: "11px 0",
                  borderTop: index === 0 ? "none" : `1px solid ${COLORS.lineSoft}`,
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 14,
                      marginTop: 1,
                      opacity: 0.9,
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
                        marginBottom: doc.filename ? 3 : 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: COLORS.textStrong,
                          minWidth: 0,
                          wordBreak: "break-word",
                          lineHeight: 1.45,
                        }}
                      >
                        {doc.label}
                      </div>

                      {doc.statusLabel ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: tone.color,
                            whiteSpace: "nowrap",
                            lineHeight: 1.3,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              background: tone.dot,
                              display: "inline-block",
                              flexShrink: 0,
                            }}
                          />
                          <span>{doc.statusLabel}</span>
                        </span>
                      ) : null}
                    </div>

                    {doc.filename ? (
                      <div
                        style={{
                          fontSize: 12.5,
                          color: COLORS.textSoft,
                          lineHeight: 1.45,
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
                    gap: 14,
                    flexWrap: "wrap",
                    justifyContent: isMobile ? "flex-start" : "flex-end",
                    alignItems: "center",
                    width: isMobile ? "100%" : "auto",
                    paddingLeft: isMobile ? 34 : 0,
                  }}
                >
                  <DownloadLink
                    label="Télécharger"
                    disabled={!doc.downloadable}
                    onClick={() => onDownloadDocument(doc)}
                  />

                  {doc.signedFinalDocumentId ? (
                    <DownloadLink
                      label="Télécharger signé"
                      onClick={() => onDownloadSignedDocument(doc)}
                    />
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