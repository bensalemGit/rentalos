import React from "react";
import type { SignerTask } from "../_types/signature-center.types";
import { toneFromTaskStatus } from "../_lib/signature-status.helpers";
import { taskBadgeStyle } from "../_lib/signature-ui.helpers";

type SignerCardProps = {
  task: SignerTask;
  onStartOnSite: (task: SignerTask) => void;
  onSendEmail: (task: SignerTask) => void;
  onResendEmail: (task: SignerTask) => void;
  onDownloadSigned: (task: SignerTask) => void;
  onPrepare: (task: SignerTask) => void;
};

const textStrong = "#172033";
const textSoft = "#667085";
const borderSoft = "#dde3ec";

function stepStyles(state: "done" | "current" | "todo") {
  if (state === "done") {
    return {
      dotBg: "#22c55e",
      dotRing: "0 0 0 5px rgba(34,197,94,0.10)",
      labelColor: "#15803d",
      lineColor: "#22c55e",
    };
  }

  if (state === "current") {
    return {
      dotBg: "#f59e0b",
      dotRing: "0 0 0 5px rgba(245,158,11,0.12)",
      labelColor: "#b45309",
      lineColor: "#f59e0b",
    };
  }

  return {
    dotBg: "#cbd5e1",
    dotRing: "0 0 0 5px rgba(203,213,225,0.14)",
    labelColor: "#94a3b8",
    lineColor: "#e2e8f0",
  };
}

function cardSurfaceStyle(status: SignerTask["status"]) {
  if (status === "SIGNED") {
    return {
      border: "1px solid rgba(34,197,94,0.22)",
      background: "linear-gradient(180deg, #ffffff 0%, #f6fdf8 100%)",
      boxShadow: "0 10px 24px rgba(34,197,94,0.06), 0 2px 6px rgba(15,23,42,0.03)",
      opacity: 0.96,
    } as const;
  }

  if (status === "NOT_REQUIRED") {
    return {
      border: "1px solid rgba(203,213,225,0.9)",
      background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
      boxShadow: "0 8px 22px rgba(15,23,42,0.03), 0 2px 6px rgba(15,23,42,0.02)",
      opacity: 0.94,
    } as const;
  }

  if (status === "READY" || status === "LINK_SENT" || status === "IN_PROGRESS") {
    return {
      border: "1px solid rgba(245,158,11,0.28)",
      background: "linear-gradient(180deg, #ffffff 0%, #fffaf2 100%)",
      boxShadow: "0 16px 34px rgba(245,158,11,0.10), 0 4px 12px rgba(15,23,42,0.04)",
      opacity: 1,
    } as const;
  }

  return {
    border: `1px solid ${borderSoft}`,
    background: "#ffffff",
    boxShadow: "0 10px 30px rgba(15,23,42,0.04), 0 2px 6px rgba(15,23,42,0.03)",
    opacity: 1,
  } as const;
}

function roleAccentStyle(kind: SignerTask["kind"]) {
  if (kind === "TENANT") {
    return {
      background: "rgba(47,95,184,0.09)",
      color: "#2F5FB8",
    } as const;
  }

  if (kind === "GUARANTOR") {
    return {
      background: "rgba(124,58,237,0.08)",
      color: "#6d28d9",
    } as const;
  }

  return {
    background: "rgba(15,23,42,0.06)",
    color: "#334155",
  } as const;
}

export function SignerCard({
  task,
  onStartOnSite,
  onSendEmail,
  onResendEmail,
  onDownloadSigned,
  onPrepare,
}: SignerCardProps) {
  const tone = toneFromTaskStatus(task.status);

  const surfaceStyle = cardSurfaceStyle(task.status);
  const accentStyle = roleAccentStyle(task.kind);

  let primaryAction: "PREPARE" | "SIGN" | "SEND" | "RESEND" | "DOWNLOAD" | null = null;

  if (task.requiresPreparation) {
    primaryAction = "PREPARE";
  } else if (task.status === "LINK_SENT") {
    primaryAction = "RESEND";
  } else if (task.status === "READY") {
    primaryAction = "SIGN";
  } else if (task.status === "SIGNED") {
    primaryAction = "DOWNLOAD";
  } else if (task.canSendEmailLink) {
    primaryAction = "SEND";
}

const prepState: "done" | "current" | "todo" = task.requiresPreparation
  ? "current"
  : task.status === "NOT_REQUIRED"
    ? "done"
    : "done";

const signatureState: "done" | "current" | "todo" =
  task.status === "SIGNED"
    ? "done"
    : task.status === "READY" || task.status === "LINK_SENT" || task.status === "IN_PROGRESS"
      ? "current"
      : task.requiresPreparation
        ? "todo"
        : task.status === "NOT_REQUIRED"
          ? "done"
          : "todo";

const finalState: "done" | "current" | "todo" =
  task.status === "SIGNED" || task.status === "NOT_REQUIRED" ? "done" : "todo";

const prepUi = stepStyles(prepState);
const signatureUi = stepStyles(signatureState);
const finalUi = stepStyles(finalState);

  return (
    <div
      style={{
        borderRadius: 20,
        padding: 18,
        display: "grid",
        gap: 14,
        transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
        ...surfaceStyle,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 240 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              width: "fit-content",
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: 0.3,
              textTransform: "uppercase",
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              ...accentStyle,
            }}
          >
            {task.roleLabel}
          </span>

          <div
            style={{
              marginTop: 6,
              fontSize: 19,
              lineHeight: 1.2,
              fontWeight: 800,
              color: textStrong,
              letterSpacing: -0.02,
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            {task.displayName}
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 14,
              color: "#334155",
              lineHeight: 1.6,
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            <span style={{ color: textSoft }}>Document :</span>{" "}
            <span style={{ fontWeight: 700, color: textStrong }}>{task.documentLabel}</span>
          </div>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "7px 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: -0.01,
            whiteSpace: "nowrap",
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            ...taskBadgeStyle(tone),
          }}
        >
          {task.statusLabel}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 16,
          background: "#f8fafc",
          border: "1px solid rgba(221,227,236,0.75)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
        }}
        onMouseEnter={(e) => {
          if (task.status === "SIGNED" || task.status === "NOT_REQUIRED") return;
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: prepUi.dotBg,
                  boxShadow: prepUi.dotRing,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: prepUi.labelColor,
                  fontFamily:
                    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                Préparation
              </span>
            </div>

            <div
              style={{
                height: 2,
                borderRadius: 999,
                background: prepUi.lineColor,
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: signatureUi.dotBg,
                  boxShadow: signatureUi.dotRing,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: signatureUi.labelColor,
                  fontFamily:
                    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                Signature
              </span>
            </div>

            <div
              style={{
                height: 2,
                borderRadius: 999,
                background: signatureUi.lineColor,
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: finalUi.dotBg,
                  boxShadow: finalUi.dotRing,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: finalUi.labelColor,
                  fontFamily:
                    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                Finalisation
              </span>
            </div>

            <div
              style={{
                height: 2,
                borderRadius: 999,
                background: finalUi.lineColor,
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 6,
          fontSize: 13.5,
          color: textSoft,
          lineHeight: 1.55,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {task.requiresPreparation ? (
          <div>
            <strong style={{ color: textStrong }}>Préparation :</strong>{" "}
            {task.preparationLabel || "Document à préparer"}
          </div>
        ) : null}

        {task.hasActiveLink ? (
          <div>
            <strong style={{ color: textStrong }}>Lien actif :</strong>{" "}
            {task.activeLinkCreatedAt
              ? `envoyé le ${new Date(task.activeLinkCreatedAt).toLocaleString()}`
              : "oui"}
          </div>
        ) : null}

        {task.signedFinalDocumentId ? (
          <div>
            <strong style={{ color: textStrong }}>Livrable :</strong> PDF signé disponible
          </div>
        ) : null}

        {task.isOptional && task.status === "NOT_REQUIRED" ? (
          <div>
            <strong style={{ color: textStrong }}>Information :</strong> aucune signature requise
          </div>
        ) : null}

        {task.kind === "TENANT" && !task.hasActiveLink && task.status !== "SIGNED" ? (
          <div>
            <strong style={{ color: textStrong }}>Envoi email :</strong>{" "}
            l’envoi locataire utilise actuellement le flux global du bail.
          </div>
        ) : null}

        {task.blockedReason ? (
          <div>
            <strong style={{ color: textStrong }}>Blocage :</strong> {task.blockedReason}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {primaryAction === "PREPARE" && (
          <button
            onClick={() => onPrepare(task)}
            style={{
              padding: "11px 16px",
              borderRadius: 14,
              border: "1px solid #2F5FB8",
              background: "#2F5FB8",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {task.kind === "GUARANTOR" ? "Préparer l’acte" : "Préparer le document"}
          </button>
        )}

        {primaryAction === "SIGN" && (
          <button
            onClick={() => onStartOnSite(task)}
            style={{
              padding: "11px 16px",
              borderRadius: 14,
              border: "1px solid #2F5FB8",
              background: "#2F5FB8",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Signer sur place
          </button>
        )}

        {primaryAction === "RESEND" && (
          <button
            onClick={() => onResendEmail(task)}
            style={{
              padding: "11px 16px",
              borderRadius: 14,
              border: "1px solid #2F5FB8",
              background: "#2F5FB8",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Renvoyer le lien
          </button>
        )}

        {primaryAction === "DOWNLOAD" && (
          <button
            onClick={() => onDownloadSigned(task)}
            style={{
              padding: "11px 16px",
              borderRadius: 14,
              border: "1px solid #cfd8e3",
              background: "#fff",
              color: "#243041",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Télécharger signé
          </button>
        )}

        {primaryAction !== "SEND" && task.canSendEmailLink && task.status !== "SIGNED" && (
          <button
            onClick={() => onSendEmail(task)}
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid #cfd8e3",
              background: "#fff",
              color: "#243041",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Envoyer un lien
          </button>
        )}

        {primaryAction !== "SIGN" && task.canSignOnSite && task.status !== "SIGNED" && (
          <button
            onClick={() => onStartOnSite(task)}
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid #cfd8e3",
              background: "#fff",
              color: "#243041",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Signer sur place
          </button>
        )}
      </div>
    </div>
  );
}