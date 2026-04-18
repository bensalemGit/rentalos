import React from "react";
import type {
  DocumentResource,
  PackFinalReadiness,
} from "../_types/signature-center.types";
import { FileText, ChevronRight } from "lucide-react";
import { SIGN_UI, InlineTextStatus, SectionTitle, statusToneFromLabel } from "./signature-ui";

type DocumentsSectionProps = {
  documents: DocumentResource[];
  packFinalReadiness: PackFinalReadiness | null;
  packFinalReadinessError: string | null;
  loadingPackFinalReadiness: boolean;
  hasPackFinal: boolean;
  onGeneratePackFinal: () => void;
  onDownloadDocument: (doc: DocumentResource) => void;
  onDownloadSignedDocument: (doc: DocumentResource) => void;
  onGenerateExitCertificate: () => void;
  onGenerateExitPack: () => void;
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

function mapPackIssueLabel(issue: string): string {
  switch (issue) {
    case "CONTRACT_SIGNED_FINAL_MISSING":
      return "Contrat signé final manquant";
    case "NOTICE_MISSING":
      return "Notice manquante";
    case "EDL_MISSING":
      return "EDL manquant";
    case "EDL_SIGNED_FINAL_MISSING":
      return "EDL signé final manquant";
    case "INVENTAIRE_MISSING":
      return "Inventaire manquant";
    case "INVENTAIRE_SIGNED_FINAL_MISSING":
      return "Inventaire signé final manquant";
    default:
      return "Élément requis manquant";
  }
}

function PackFinalPanel({
  packFinalReadiness,
  packFinalReadinessError,
  loading,
  hasPackFinal,
  onGenerate,
}: {
  packFinalReadiness: PackFinalReadiness | null;
  packFinalReadinessError: string | null;
  loading: boolean;
  hasPackFinal: boolean;
  onGenerate: () => void;
}) {
  const hasError = Boolean(packFinalReadinessError);
  const ready = Boolean(packFinalReadiness?.ready) && !hasError;
  const issues = Array.isArray(packFinalReadiness?.issues)
    ? packFinalReadiness!.issues
    : [];

  const tone = hasError ? "danger" : ready ? "success" : "neutral";

  return (
    <div
      style={{
        border: `1px solid ${ready ? "rgba(49, 132, 90, 0.18)" : SIGN_UI.colors.cardBorder}`,
        background: ready
          ? "linear-gradient(180deg, rgba(243,250,245,0.96) 0%, rgba(255,255,255,0.98) 100%)"
          : "linear-gradient(180deg, #FFFFFF 0%, #FBFCFE 100%)",
        borderRadius: 18,
        padding: 16,
        display: "grid",
        gap: 12,
        boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: SIGN_UI.colors.textStrong,
              letterSpacing: "-0.01em",
            }}
          >
            Pack final
          </div>

          <div
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: SIGN_UI.colors.textSoft,
              maxWidth: 720,
            }}
          >
            {loading
              ? "Vérification de l’état de clôture documentaire…"
              : hasError
                ? "Impossible de vérifier l’état du pack final pour le moment."
                : ready
                  ? hasPackFinal
                    ? "Le dossier est prêt et un pack final est déjà disponible."
                    : "Tous les documents requis sont finalisés. Le pack final peut être généré."
                  : "Le pack final reste bloqué tant que tous les documents requis ne sont pas finalisés."}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <InlineTextStatus tone={tone}>
            {loading
              ? "Vérification…"
              : hasError
                ? "Indisponible"
                : ready
                  ? hasPackFinal
                    ? "Disponible"
                    : "Prêt à générer"
                  : "Non prêt"}
          </InlineTextStatus>

          <button
            type="button"
            onClick={onGenerate}
            disabled={!ready || loading || hasError}
            style={{
              appearance: "none",
              border: `1px solid ${ready ? "rgba(47,99,224,0.26)" : SIGN_UI.colors.cardBorder}`,
              background: ready
                ? "linear-gradient(180deg, rgba(47,99,224,0.10) 0%, rgba(47,99,224,0.06) 100%)"
                : "linear-gradient(180deg, #F8FAFC 0%, #F4F7FB 100%)",
              color: ready ? "#2349A8" : "#98A2B3",
              borderRadius: 12,
              height: 38,
              padding: "0 14px",
              fontFamily: SIGN_UI.font,
              fontSize: 13,
              fontWeight: 600,
              cursor: !ready || loading ? "not-allowed" : "pointer",
              transition: "all 120ms ease",
              boxShadow: ready ? "0 1px 2px rgba(16,24,40,0.04)" : "none",
            }}
          >
            Générer le pack final
          </button>
        </div>
      </div>


      {!loading && hasError ? (
        <div
          style={{
            borderRadius: 12,
            border: `1px solid rgba(239,68,68,0.16)`,
            background: "rgba(239,68,68,0.05)",
            color: "#B42318",
            padding: "10px 12px",
            fontSize: 12.5,
            lineHeight: 1.5,
            fontWeight: 500,
          }}
        >
          {packFinalReadinessError}
        </div>
      ) : null}

      {!loading && !ready && issues.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {issues.map((issue) => (
            <span
              key={issue}
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 28,
                padding: "0 10px",
                borderRadius: 999,
                background: "rgba(15,23,42,0.04)",
                border: `1px solid ${SIGN_UI.colors.lineSoft}`,
                color: "#516079",
                fontSize: 12.5,
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              {mapPackIssueLabel(issue)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}



export function DocumentsSection({
  documents,
  packFinalReadiness,
  packFinalReadinessError,
  loadingPackFinalReadiness,
  hasPackFinal,
  onGeneratePackFinal,
  onDownloadDocument,
  onDownloadSignedDocument,
  onGenerateExitCertificate,
  onGenerateExitPack,
}: DocumentsSectionProps) {
  return (
    <section
      style={{
        fontFamily: SIGN_UI.font,
        minWidth: 0,
        display: "grid",
        gap: 16,
      }}
    >
      <PackFinalPanel
        packFinalReadiness={packFinalReadiness}
        packFinalReadinessError={packFinalReadinessError}
        loading={loadingPackFinalReadiness}
        hasPackFinal={hasPackFinal}
        onGenerate={onGeneratePackFinal}
      />

      <div
        style={{
          border: `1px solid ${SIGN_UI.colors.cardBorder}`,
          background: "linear-gradient(180deg, #FFFFFF 0%, #FBFCFE 100%)",
          borderRadius: 18,
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              Sortie locataire
            </div>
            <div style={{ fontSize: 13, color: SIGN_UI.colors.textSoft }}>
              Attestation et pack de sortie (EDL + inventaire)
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onGenerateExitCertificate}
              style={{
                borderRadius: 10,
                padding: "6px 12px",
                border: "1px solid #d0d5dd",
                background: "#f9fafb",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Attestation sortie
            </button>

            <button
              onClick={onGenerateExitPack}
              style={{
                borderRadius: 10,
                padding: "6px 12px",
                border: "1px solid rgba(47,99,224,0.3)",
                background: "rgba(47,99,224,0.08)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Pack sortie
            </button>
          </div>
        </div>
      </div>

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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}