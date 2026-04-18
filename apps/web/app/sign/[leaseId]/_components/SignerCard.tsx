import React from "react";
import {
  PenLine,
  Mail,
  Send,
  Download,
  FilePenLine,
  Circle,
  Check,
  CheckCircle2,
  Clock3,
  Link2,
  Sparkles,
} from "lucide-react";
import type { SignerTask } from "../_types/signature-center.types";

type SignerCardProps = {
  task: SignerTask;
  isActive: boolean;
  isProminent?: boolean;
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
  textStrong: "#18243D",
  textSoft: "#6A7690",
  textMuted: "#9AA6BA",

  border: "rgba(26, 39, 66, 0.06)",
  borderSoft: "rgba(26, 39, 66, 0.045)",
  borderStrong: "rgba(26, 39, 66, 0.08)",

  blue: "#557ADD",
  blueTop: "#6A90EB",

  green: "#4F9B71",
  amber: "#C18432",
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

function getRoleMeta(task: SignerTask) {
  if (task.kind === "TENANT") {
    return {
      label: task.roleLabel.toUpperCase(),
      color: "#5D7FE0",
    };
  }

  if (task.kind === "GUARANTOR") {
    return {
      label: "GARANT",
      color: "#796A99",
    };
  }

  return {
    label: "BAILLEUR",
    color: "#6A7690",
  };
}

function getStatusMeta(task: SignerTask) {
  if (task.status === "SIGNED") {
    return {
      label: "Signé",
      color: "#2FA35B",
      background: "#E9F7EE",
      iconColor: "#35B764",
      icon: CheckCircle2,
    };
  }

  if (task.status === "LINK_SENT") {
    return {
      label: "Lien envoyé",
      color: "#C97E14",
      background: "#F9F1E6",
      iconColor: "#DD8E1D",
      icon: Link2,
    };
  }

  if (task.status === "IN_PROGRESS") {
    return {
      label: "En cours",
      color: "#C97E14",
      background: "#F9F1E6",
      iconColor: "#DD8E1D",
      icon: Clock3,
    };
  }

  if (task.status === "READY") {
    return {
      label: "Prêt à signer",
      color: "#A06A2C",
      background: "#F6F1E8",
      iconColor: "#A06A2C",
      icon: Sparkles,
    };
  }

  if (task.requiresPreparation) {
    return {
      label: "À préparer",
      color: "#C97E14",
      background: "#F9F1E6",
      iconColor: "#DD8E1D",
      icon: FilePenLine,
    };
  }

  return {
    label: task.statusLabel || "En attente",
    color: "#61718C",
    background: "#F3F6FA",
    iconColor: "#9FAABD",
    icon: Clock3,
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
    return [{ label: "Signature finalisée", done: true }];
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
    return [{ label: "Signature garant requise", done: false }];
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
      icon: FilePenLine,
    };
  }

  if (task.status === "SIGNED" && task.canDownloadSigned) {
    return {
      key: "download" as const,
      label: "Télécharger signé",
      icon: Download,
    };
  }

  if (task.canSignOnSite && task.status !== "SIGNED" && task.status !== "NOT_REQUIRED") {
    return {
      key: "sign" as const,
      label: "Signer sur place",
      icon: PenLine,
    };
  }

  if (task.status === "LINK_SENT" && task.canResendLink) {
    return {
      key: "resend" as const,
      label: "Renvoyer le lien",
      icon: Send,
    };
  }

  if (task.canSendEmailLink && task.status !== "SIGNED" && task.status !== "NOT_REQUIRED") {
    return {
      key: "send" as const,
      label: "Envoyer un lien",
      icon: Mail,
    };
  }

  if (task.canDownloadSigned) {
    return {
      key: "download" as const,
      label: "Télécharger signé",
      icon: Download,
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
      icon: PenLine,
    };
  }

  if (
    primaryKey !== "send" &&
    primaryKey !== "resend" &&
    task.canSendEmailLink &&
    task.status !== "SIGNED" &&
    task.status !== "NOT_REQUIRED"
  ) {
    const resend = task.canResendLink || task.hasActiveLink;
    return {
      key: resend ? ("resend" as const) : ("send" as const),
      label: resend ? "Renvoyer le lien" : "Envoyer un lien",
      icon: resend ? Send : Mail,
    };
  }

  if (primaryKey !== "download" && task.status === "SIGNED" && task.canDownloadSigned) {
    return {
      key: "download" as const,
      label: "Télécharger signé",
      icon: Download,
    };
  }

  return null;
}

function getPriorityTask(task: SignerTask): SignerTask {
  const subTasks = ((task as any).subTasks || []) as SignerTask[];

  if (!subTasks.length) return task;

  const actionable =
    subTasks.find((t) => t.status === "READY" && !t.isBlocked) ||
    subTasks.find((t) => t.status === "IN_PROGRESS" && !t.isBlocked) ||
    subTasks.find((t) => t.status === "LINK_SENT" && !t.isBlocked) ||
    subTasks.find((t) => t.requiresPreparation) ||
    null;

  return actionable || task;
}

function StatusChip({
  label,
  color,
  background,
  iconColor,
  icon: Icon,
}: {
  label: string;
  color: string;
  background: string;
  iconColor: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
}) {
  return (
    <span
      style={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        minHeight: 30,
        padding: "0 11px",
        borderRadius: 999,
        background,
        color,
        whiteSpace: "nowrap",
        fontSize: 12.5,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        border: "1px solid rgba(27,39,64,0.03)",
        boxShadow: "none",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <Icon size={14} strokeWidth={2.05} color={iconColor} />
      <span>{label}</span>
    </span>
  );
}

function getCardSurface(isActive: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 28,
    border: "1px solid rgba(27,39,64,0.06)",
    background: "#FFFFFF",
    boxShadow: "none",
    transition: "box-shadow 160ms ease, border-color 160ms ease",
  };

  if (isActive) {
    base.border = "1px solid rgba(47,99,224,0.10)";
    base.boxShadow = "none";
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

function PrimaryActionButton(props: {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick: () => void;
}) {
  const Icon = props.icon;
  const isOnSiteAction = props.label === "Signer sur place";

  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        appearance: "none",
        border: "1px solid rgba(47,99,224,0.14)",
        minHeight: 40,
        padding: "0 16px",
        borderRadius: 15,
        background: "#EEF4FF",
        color: "#2F63E0",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontWeight: 600,
        fontSize: 13.5,
        letterSpacing: "-0.01em",
        cursor: "pointer",
        boxShadow: "none",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <Icon size={15} strokeWidth={2.05} />
      <span>{props.label}</span>
    </button>
  );
}

function SecondaryActionButton(props: {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick: () => void;
}) {
  const Icon = props.icon;

  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        appearance: "none",
        border: "1px solid rgba(27,39,64,0.08)",
        minHeight: 40,
        padding: "0 16px",
        borderRadius: 15,
        background: "#FFFFFF",
        color: "#243041",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontWeight: 500,
        fontSize: 13.5,
        letterSpacing: "-0.01em",
        cursor: "pointer",
        boxShadow: "none",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <Icon size={15} strokeWidth={2.05} />
      <span>{props.label}</span>
    </button>
  );
}

export const SignerCard = React.forwardRef<HTMLDivElement, SignerCardProps>(
  function SignerCard(
    {
      task,
      isActive,
      onStartOnSite,
      onSendEmail,
      onResendEmail,
      onDownloadSigned,
      onPrepare,
    },
    ref,
  ) {
    const effectiveTask = getPriorityTask(task);

    console.log("[SIGNER CARD EFFECTIVE TASK]", {
      cardTaskId: task.id,
      cardTaskLabel: task.documentLabel,
      effectiveTaskId: effectiveTask.id,
      effectiveTaskLabel: effectiveTask.documentLabel,
      effectiveTaskStatus: effectiveTask.status,
    });

    const roleMeta = getRoleMeta(effectiveTask);
    const statusMeta = getStatusMeta(effectiveTask);
    const progressItems = buildProgressItems(effectiveTask);
    const historyItems = buildHistoryPreview(effectiveTask);

    const primaryAction = getPrimaryAction(effectiveTask);
    const secondaryAction = getSecondaryAction(
      effectiveTask,
      primaryAction?.key ?? null,
    );

    return (
      <article
        ref={ref}
        style={{
          ...getCardSurface(isActive),
          padding: 22,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.9,
                  lineHeight: 1.2,
                  fontWeight: 800,
                  letterSpacing: "0.045em",
                  textTransform: "uppercase",
                  color: roleMeta.color,
                  marginBottom: 12,
                }}
              >
                {roleMeta.label}
              </div>

              <div
                style={{
                  fontSize: 19,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.28,
                  fontWeight: 800,
                  color: "#1F2A3C",
                  wordBreak: "break-word",
                }}
              >
                {effectiveTask.displayName}
              </div>

              {effectiveTask.tenantLabel ? (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    lineHeight: 1.45,
                    color: "#475467",
                    fontWeight: 700,
                  }}
                >
                  {effectiveTask.tenantLabel}
                </div>
              ) : null}

              {effectiveTask.subtypeLabel ? (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12.5,
                    lineHeight: 1.42,
                    color: "#8A94A8",
                  }}
                >
                  {effectiveTask.subtypeLabel}
                </div>
              ) : null}
            </div>

            <StatusChip
              label={statusMeta.label}
              color={statusMeta.color}
              background={statusMeta.background}
              iconColor={statusMeta.iconColor}
              icon={statusMeta.icon}
            />
          </div>

          <div
            style={{
              borderTop: "1px solid rgba(26,39,66,0.045)",
              paddingTop: 14,
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
            }}
          >
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.4,
                color: "#6B778C",
                marginBottom: 10,
              }}
            >
              {effectiveTask.documentLabel}
            </div>

            {(task as any).subTasks?.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gap: 6,
                  marginTop: 6,
                  marginBottom: 10,
                }}
              >
                {(task as any).subTasks.map((t: SignerTask) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 12.5,
                      color: "#7B879C",
                      paddingLeft: 2,
                    }}
                  >
                    <span>{t.documentLabel}</span>

                    <span
                      style={{
                        fontWeight: 600,
                        color:
                          t.status === "SIGNED"
                            ? "#2FA35B"
                            : t.status === "READY"
                              ? "#A06A2C"
                              : "#98A2B3",
                      }}
                    >
                      {t.statusLabel}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "grid", gap: 8 }}>
              {progressItems.map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    color: item.done ? "#1C2B42" : "#4E5C73",
                    fontSize: 13.5,
                    lineHeight: 1.45,
                    fontWeight: item.done ? 700 : 500,
                  }}
                >
                  {item.done ? (
                    <Check size={15} strokeWidth={2.2} color="#4C936A" />
                  ) : (
                    <Circle size={14} strokeWidth={2.0} color="#CC8B37" />
                  )}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            {effectiveTask.helperLabel &&
            !effectiveTask.requiresPreparation &&
            effectiveTask.status !== "SIGNED" ? (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  color: "#667085",
                }}
              >
                {effectiveTask.helperLabel}
              </div>
            ) : null}

            {primaryAction || secondaryAction ? (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 16,
                }}
              >
                {primaryAction ? (
                  <PrimaryActionButton
                    label={primaryAction.label}
                    icon={primaryAction.icon}
                    onClick={() =>
                      runAction(primaryAction.key, effectiveTask, {
                        onStartOnSite,
                        onSendEmail,
                        onResendEmail,
                        onDownloadSigned,
                        onPrepare,
                      })
                    }
                  />
                ) : null}

                {secondaryAction ? (
                  <SecondaryActionButton
                    label={secondaryAction.label}
                    icon={secondaryAction.icon}
                    onClick={() =>
                      runAction(secondaryAction.key, effectiveTask, {
                        onStartOnSite,
                        onSendEmail,
                        onResendEmail,
                        onDownloadSigned,
                        onPrepare,
                      })
                    }
                  />
                ) : null}
              </div>
            ) : null}

            <div
              style={{
                marginTop: primaryAction || secondaryAction ? "auto" : 12,
                paddingTop: primaryAction || secondaryAction ? 16 : 6,
              }}
            />

            <div
              style={{
                paddingTop: 12,
                borderTop: `1px solid ${COLORS.borderSoft}`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.2,
                  fontWeight: 800,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  color: COLORS.textMuted,
                  marginBottom: 8,
                }}
              >
                Historique
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {historyItems.length === 0 ? (
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: COLORS.textSoft,
                    }}
                  >
                    Aucun historique.
                  </div>
                ) : (
                  historyItems.map((item) => (
                    <div
                      key={item.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13.5,
                        lineHeight: 1.45,
                        color: "#667085",
                      }}
                    >
                      <span style={{ color: "#A8B2C3", fontSize: 15, lineHeight: 1 }}>•</span>
                      <span
                        style={{
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                        }}
                        title={item.label}
                      >
                        {item.label}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  },
);