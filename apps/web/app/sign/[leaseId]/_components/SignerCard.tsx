import React from "react";
import type { SignerTask } from "../_types/signature-center.types";

type SignerCardProps = {
  task: SignerTask;
  isActive: boolean;
  onStartOnSite: (task: SignerTask) => void;
  onSendEmail: (task: SignerTask) => void;
  onResendEmail: (task: SignerTask) => void;
  onDownloadSigned: (task: SignerTask) => void;
  onPrepare: (task: SignerTask) => void;
};

type ProgressItem = {
  label: string;
  done: boolean;
};

type HistoryItem = {
  key: string;
  label: string;
};

const COLORS = {
  textStrong: "#172033",
  textSoft: "#667085",
  textMuted: "#98A2B3",
  border: "#D9E2EC",
  borderSoft: "#E9EEF5",
  borderStrong: "#C7D3E0",
  surface: "#FFFFFF",
  surfaceSoft: "#FCFDFE",
  blue: "#1D4ED8",
  blueSoft: "#EEF4FF",
  blueBorder: "#C7D7FE",
  green: "#16A34A",
  greenSoft: "#F0FDF4",
  greenBorder: "#BBF7D0",
  amber: "#D97706",
  amberSoft: "#FFF7ED",
  amberBorder: "#FED7AA",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  redBorder: "#FECACA",
  purple: "#7C3AED",
  purpleSoft: "#F5F3FF",
  purpleBorder: "#DDD6FE",
  graySoft: "#F8FAFC",
};

function getFirstName(name: string) {
  const clean = name.trim();
  if (!clean) return "";
  return clean.split(/\s+/)[0] ?? clean;
}

function formatShortDate(input?: string | null) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function getRoleChip(task: SignerTask) {
  if (task.kind === "TENANT") {
    return {
      label: task.roleLabel.toUpperCase(),
      background: COLORS.blueSoft,
      border: COLORS.blueBorder,
      color: COLORS.blue,
    };
  }

  if (task.kind === "GUARANTOR") {
    return {
      label: task.roleLabel.toUpperCase(),
      background: COLORS.purpleSoft,
      border: COLORS.purpleBorder,
      color: COLORS.purple,
    };
  }

  return {
    label: task.roleLabel.toUpperCase(),
    background: "#F3F4F6",
    border: "#E5E7EB",
    color: "#475467",
  };
}

function getStatusPill(task: SignerTask) {
  if (task.status === "SIGNED") {
    return {
      label: "Signé",
      background: COLORS.greenSoft,
      border: COLORS.greenBorder,
      color: COLORS.green,
    };
  }

  if (task.status === "LINK_SENT") {
    return {
      label: "Lien envoyé",
      background: COLORS.amberSoft,
      border: COLORS.amberBorder,
      color: COLORS.amber,
    };
  }

  if (task.status === "IN_PROGRESS") {
    return {
      label: "En cours",
      background: COLORS.amberSoft,
      border: COLORS.amberBorder,
      color: COLORS.amber,
    };
  }

  if (task.status === "READY") {
    return {
      label: "Prêt à signer",
      background: COLORS.blueSoft,
      border: COLORS.blueBorder,
      color: COLORS.blue,
    };
  }

  if (task.status === "NOT_REQUIRED") {
    return {
      label: "Non requis",
      background: COLORS.graySoft,
      border: "#E2E8F0",
      color: "#64748B",
    };
  }

  if (task.requiresPreparation) {
    return {
      label: "À préparer",
      background: COLORS.amberSoft,
      border: COLORS.amberBorder,
      color: COLORS.amber,
    };
  }

  return {
    label: task.statusLabel || "En attente",
    background: COLORS.graySoft,
    border: "#E2E8F0",
    color: "#64748B",
  };
}

function buildProgressItems(task: SignerTask): ProgressItem[] {
  if (task.status === "NOT_REQUIRED") {
    return [{ label: "Aucune signature requise", done: true }];
  }

  if (task.progressLabel) {
    const rawParts = task.progressLabel
      .split(/•|·|\||,/g)
      .map((part) => part.trim())
      .filter(Boolean);

    if (rawParts.length > 0) {
      return rawParts.map((part) => ({
        label: part,
        done: /signé|finalisé|disponible|reçu/i.test(part),
      }));
    }
  }

  if (task.kind === "GUARANTOR" && task.status === "SIGNED") {
    return [{ label: "Garant signé", done: true }];
  }

  if (task.kind === "LANDLORD" && task.status === "SIGNED") {
    return [{ label: "Bailleur signé", done: true }];
  }

  if (task.kind === "TENANT" && task.status === "SIGNED") {
    return [{ label: `${getFirstName(task.displayName)} signé`, done: true }];
  }

  if (task.requiresPreparation) {
    return [
      {
        label: task.preparationLabel || "Document à préparer",
        done: false,
      },
    ];
  }

  if (task.kind === "GUARANTOR") {
    return [{ label: "Garant à signer", done: false }];
  }

  if (task.kind === "LANDLORD") {
    return [{ label: "Bailleur à signer", done: false }];
  }

  return [{ label: `${getFirstName(task.displayName)} à signer`, done: false }];
}

function buildHistoryPreview(task: SignerTask): HistoryItem[] {
  const items: HistoryItem[] = [];

  if (task.activeLinkCreatedAt) {
    items.push({
      key: "link",
      label: `${formatShortDate(task.activeLinkCreatedAt) ?? "—"} · lien envoyé`,
    });
  }

  if (task.status === "SIGNED") {
    items.push({
      key: "signed",
      label: "Signature reçue",
    });
  }

  if (task.signedFinalDocumentId) {
    items.push({
      key: "pdf",
      label: "PDF signé disponible",
    });
  }

  if (items.length === 0 && task.helperLabel) {
    items.push({
      key: "helper",
      label: task.helperLabel,
    });
  }

  if (items.length === 0 && task.requiresPreparation) {
    items.push({
      key: "prep",
      label: task.preparationLabel || "Document à préparer",
    });
  }

  return items.slice(0, 2);
}

function getPrimaryAction(task: SignerTask) {
  if (task.requiresPreparation) {
    return {
      key: "prepare" as const,
      label: task.kind === "GUARANTOR" ? "Préparer l’acte" : "Préparer le document",
    };
  }

  if (task.status === "SIGNED" && task.canDownloadSigned) {
    return {
      key: "download" as const,
      label: "Télécharger signé",
    };
  }

  if (task.canSignOnSite && task.status !== "SIGNED" && task.status !== "NOT_REQUIRED") {
    return {
      key: "sign" as const,
      label: "Signer sur place",
    };
  }

  if (task.status === "LINK_SENT" && task.canResendLink) {
    return {
      key: "resend" as const,
      label: "Renvoyer un lien",
    };
  }

  if (task.canSendEmailLink && task.status !== "SIGNED" && task.status !== "NOT_REQUIRED") {
    return {
      key: "send" as const,
      label: "Envoyer un lien",
    };
  }

  if (task.canDownloadSigned) {
    return {
      key: "download" as const,
      label: "Télécharger signé",
    };
  }

  return null;
}

function getSecondaryAction(
  task: SignerTask,
  primaryKey: "prepare" | "download" | "resend" | "sign" | "send" | null,
) {
  if (
    primaryKey !== "sign" &&
    task.canSignOnSite &&
    task.status !== "SIGNED" &&
    task.status !== "NOT_REQUIRED"
  ) {
    return {
      key: "sign" as const,
      label: "Signer sur place",
    };
  }

  if (
    primaryKey !== "send" &&
    primaryKey !== "resend" &&
    task.canSendEmailLink &&
    task.status !== "SIGNED" &&
    task.status !== "NOT_REQUIRED"
  ) {
    return {
      key: task.canResendLink || task.hasActiveLink ? ("resend" as const) : ("send" as const),
      label: task.canResendLink || task.hasActiveLink ? "Renvoyer un lien" : "Envoyer un lien",
    };
  }

  if (primaryKey !== "download" && task.status === "SIGNED" && task.canDownloadSigned) {
    return {
      key: "download" as const,
      label: "Télécharger signé",
    };
  }

  return null;
}

function getCardSurface(task: SignerTask, isActive: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 16,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.surface,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
    transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
  };

  if (task.status === "SIGNED") {
    base.border = `1px solid ${COLORS.greenBorder}`;
    base.background = "linear-gradient(180deg, #FFFFFF 0%, #FBFFFC 100%)";
  } else if (task.status === "READY" || task.status === "LINK_SENT" || task.status === "IN_PROGRESS") {
    base.border = `1px solid ${COLORS.amberBorder}`;
    base.background = "linear-gradient(180deg, #FFFFFF 0%, #FFFDF9 100%)";
  } else if (task.status === "NOT_REQUIRED") {
    base.background = COLORS.graySoft;
  }

  if (isActive) {
    base.border = "1px solid #93C5FD";
    base.boxShadow = "0 12px 28px rgba(29, 78, 216, 0.12)";
  }

  return base;
}

function runAction(
  actionKey: "prepare" | "download" | "resend" | "sign" | "send",
  task: SignerTask,
  handlers: {
    onStartOnSite: (task: SignerTask) => void;
    onSendEmail: (task: SignerTask) => void;
    onResendEmail: (task: SignerTask) => void;
    onDownloadSigned: (task: SignerTask) => void;
    onPrepare: (task: SignerTask) => void;
  },
) {
  switch (actionKey) {
    case "prepare":
      handlers.onPrepare(task);
      return;
    case "download":
      handlers.onDownloadSigned(task);
      return;
    case "resend":
      handlers.onResendEmail(task);
      return;
    case "sign":
      handlers.onStartOnSite(task);
      return;
    case "send":
      handlers.onSendEmail(task);
      return;
  }
}

export const SignerCard = React.forwardRef<HTMLDivElement, SignerCardProps>(
  function SignerCard(
    { task, isActive, onStartOnSite, onSendEmail, onResendEmail, onDownloadSigned, onPrepare },
    ref,
  ) {
    const roleChip = getRoleChip(task);
    const statusPill = getStatusPill(task);
    const progressItems = buildProgressItems(task);
    const historyItems = buildHistoryPreview(task);
    const primaryAction = getPrimaryAction(task);
    const secondaryAction = getSecondaryAction(task, primaryAction?.key ?? null);

    return (
      <div
        ref={ref}
        style={{
          ...getCardSurface(task, isActive),
          padding: 14,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
        onMouseEnter={(e) => {
          if (isActive) return;
          if (task.status === "SIGNED" || task.status === "NOT_REQUIRED") return;
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 8px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.03em",
                  background: roleChip.background,
                  border: `1px solid ${roleChip.border}`,
                  color: roleChip.color,
                }}
              >
                {roleChip.label}
              </span>

              {task.subtypeLabel ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: COLORS.textMuted,
                  }}
                >
                  {task.subtypeLabel}
                </span>
              ) : null}

              {isActive ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "3px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    background: COLORS.blueSoft,
                    border: `1px solid ${COLORS.blueBorder}`,
                    color: COLORS.blue,
                  }}
                >
                  Session active
                </span>
              ) : null}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  lineHeight: 1.15,
                  fontWeight: 700,
                  color: COLORS.textStrong,
                  letterSpacing: "-0.02em",
                  wordBreak: "break-word",
                }}
              >
                {task.displayName}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: COLORS.textSoft,
                }}
              >
                Document :{" "}
                <span style={{ color: COLORS.textSoft }}>
                  {task.documentLabel}
                </span>
              </div>
            </div>
          </div>

          <div style={{ flexShrink: 0 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                background: statusPill.background,
                border: `1px solid ${statusPill.border}`,
                color: statusPill.color,
                whiteSpace: "nowrap",
              }}
            >
              {statusPill.label}
            </span>
          </div>
        </div>

        <div
          style={{
            borderTop: `1px solid ${COLORS.borderSoft}`,
            paddingTop: 10,
            display: "grid",
            gap: 10,
            flex: 1,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 7,
            }}
          >
            {progressItems.map((item, index) => (
              <div
                key={`${item.label}-${index}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: item.done ? COLORS.textStrong : "#475467",
                  fontWeight: item.done ? 700 : 600,
                  lineHeight: 1.35,
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    border: item.done ? `1px solid ${COLORS.green}` : `1px solid #D0D5DD`,
                    background: item.done ? COLORS.greenSoft : "#FFF",
                    color: item.done ? COLORS.green : "#98A2B3",
                    fontSize: 11,
                    lineHeight: 1,
                  }}
                >
                  {item.done ? "✓" : "○"}
                </span>

                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {task.blockedReason ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 10,
                border: `1px solid ${COLORS.redBorder}`,
                background: COLORS.redSoft,
                fontSize: 11,
                lineHeight: 1.4,
                color: COLORS.red,
                fontWeight: 600,
              }}
            >
              <span style={{ fontSize: 12, lineHeight: 1 }}>!</span>
              <span>{task.blockedReason}</span>
            </div>
          ) : task.helperLabel ? (
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.45,
                color: COLORS.textSoft,
              }}
            >
              {task.helperLabel}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              marginTop: "auto",
            }}
>
            {primaryAction ? (
              <button
                type="button"
                onClick={() =>
                  runAction(primaryAction.key, task, {
                    onStartOnSite,
                    onSendEmail,
                    onResendEmail,
                    onDownloadSigned,
                    onPrepare,
                  })
                }
                style={{
                  appearance: "none",
                  border: "1px solid #1D4ED8",
                  background: "#1D4ED8",
                  color: "#FFF",
                  borderRadius: 10,
                  padding: "9px 13px",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 5px 14px rgba(29, 78, 216, 0.16)",
                }}
              >
                {primaryAction.label}
              </button>
            ) : null}

            {secondaryAction ? (
              <button
                type="button"
                onClick={() =>
                  runAction(secondaryAction.key, task, {
                    onStartOnSite,
                    onSendEmail,
                    onResendEmail,
                    onDownloadSigned,
                    onPrepare,
                  })
                }
                style={{
                  appearance: "none",
                  border: `1px solid ${COLORS.borderStrong}`,
                  background: "#FFF",
                  color: COLORS.textStrong,
                  borderRadius: 10,
                  padding: "9px 13px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {secondaryAction.label}
              </button>
            ) : null}
          </div>

          {historyItems.length > 0 ? (
            <div
              style={{
                borderTop: `1px solid ${COLORS.borderSoft}`,
                paddingTop: 10,
                display: "grid",
                gap: 6,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: COLORS.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                Historique
              </div>

              {historyItems.map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 7,
                    fontSize: 12,
                    lineHeight: 1.4,
                    color: COLORS.textSoft,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: "#94A3B8",
                      marginTop: 5,
                      flexShrink: 0,
                    }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);