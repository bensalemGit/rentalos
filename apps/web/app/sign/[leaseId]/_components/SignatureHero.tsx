import React from "react";
import type { SignatureOverview } from "../_types/signature-center.types";

type SignatureHeroProps = {
  overview: SignatureOverview;
  recommendedActionLabel: string;
  canSendAllRemainingLinks: boolean;
  canStartNextOnSite: boolean;
  onSendAllRemainingLinks: () => void;
  onStartNextOnSite: () => void;
};

const COLORS = {
  textStrong: "#172033",
  textSoft: "#667085",
  textMuted: "#98A2B3",
  border: "#D9E2EC",
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
  slateSoft: "#F8FAFC",
};

function getProgressTone(progressPercent: number, remainingCount: number) {
  if (remainingCount === 0) {
    return {
      bar: "linear-gradient(90deg, #22C55E 0%, #16A34A 100%)",
      chipBg: COLORS.greenSoft,
      chipBorder: COLORS.greenBorder,
      chipColor: COLORS.green,
    };
  }

  if (progressPercent >= 50) {
    return {
      bar: "linear-gradient(90deg, #F59E0B 0%, #D97706 100%)",
      chipBg: COLORS.amberSoft,
      chipBorder: COLORS.amberBorder,
      chipColor: COLORS.amber,
    };
  }

  return {
    bar: "linear-gradient(90deg, #3B82F6 0%, #1D4ED8 100%)",
    chipBg: COLORS.blueSoft,
    chipBorder: COLORS.blueBorder,
    chipColor: COLORS.blue,
  };
}

function statPill(label: string, tone: "neutral" | "success" | "warning" = "neutral") {
  if (tone === "success") {
    return {
      label,
      style: {
        background: COLORS.greenSoft,
        border: `1px solid ${COLORS.greenBorder}`,
        color: COLORS.green,
      },
    };
  }

  if (tone === "warning") {
    return {
      label,
      style: {
        background: COLORS.amberSoft,
        border: `1px solid ${COLORS.amberBorder}`,
        color: COLORS.amber,
      },
    };
  }

  return {
    label,
    style: {
      background: "#F8FAFC",
      border: "1px solid #E2E8F0",
      color: "#475467",
    },
  };
}

export function SignatureHero({
  overview,
  recommendedActionLabel,
  canSendAllRemainingLinks,
  canStartNextOnSite,
  onSendAllRemainingLinks,
  onStartNextOnSite,
}: SignatureHeroProps) {
  const progressPercent = Math.max(0, Math.min(100, overview.progressPercent || 0));
  const progressWidth = `${Math.max(progressPercent, progressPercent > 0 ? 8 : 0)}%`;
  const isCompleted = overview.remainingCount === 0;
  const progressTone = getProgressTone(progressPercent, overview.remainingCount);

  const tenantPill =
    overview.tenants.total > 0
      ? statPill(
          `Locataires ${overview.tenants.signed}/${overview.tenants.total}`,
          overview.tenants.signed === overview.tenants.total ? "success" : "warning",
        )
      : statPill("Aucun locataire");

  const guarantorPill =
    overview.guarantors.total > 0
      ? statPill(
          `Garanties ${overview.guarantors.signed}/${overview.guarantors.total}`,
          overview.guarantors.signed === overview.guarantors.total ? "success" : "warning",
        )
      : statPill("Aucune garantie");

  const landlordPill = statPill(
    `Bailleur ${overview.landlord.signed ? "signé" : "à signer"}`,
    overview.landlord.signed ? "success" : "warning",
  );

  return (
    <section
      style={{
        borderRadius: 22,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
        boxShadow: "0 12px 32px rgba(15, 23, 42, 0.05)",
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: COLORS.blue,
              marginBottom: 8,
            }}
          >
            Signature du bail
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 28,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              fontWeight: 800,
              color: COLORS.textStrong,
            }}
          >
            {overview.leaseLabel}
          </h1>

          <div
            style={{
              marginTop: 8,
              fontSize: 15,
              color: COLORS.textSoft,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span>Locataire principal :</span>
            <span style={{ color: COLORS.textStrong, fontWeight: 700 }}>
              {overview.primaryTenantName}
            </span>
          </div>
        </div>

        <div style={{ flexShrink: 0 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "8px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              background: progressTone.chipBg,
              border: `1px solid ${progressTone.chipBorder}`,
              color: progressTone.chipColor,
              whiteSpace: "nowrap",
            }}
          >
            {isCompleted
              ? "Dossier finalisé"
              : `${overview.remainingCount} signature(s) restante(s)`}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            width: "100%",
            height: 10,
            borderRadius: 999,
            background: "#E9EEF5",
            overflow: "hidden",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: progressWidth,
              minWidth: progressPercent > 0 ? 10 : 0,
              height: "100%",
              borderRadius: 999,
              background: progressTone.bar,
              transition: "width 220ms ease",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                ...tenantPill.style,
              }}
            >
              {tenantPill.label}
            </span>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                ...guarantorPill.style,
              }}
            >
              {guarantorPill.label}
            </span>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                ...landlordPill.style,
              }}
            >
              {landlordPill.label}
            </span>
          </div>

          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: COLORS.textSoft,
              whiteSpace: "nowrap",
            }}
          >
            Progression : {progressPercent}%
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: `1px solid ${COLORS.border}`,
          paddingTop: 16,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 280, flex: "1 1 380px" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              color: COLORS.textMuted,
              marginBottom: 8,
            }}
          >
            {isCompleted ? "Résumé dossier" : "Prochaine action recommandée"}
          </div>

          <div
            style={{
              fontSize: 15,
              lineHeight: 1.5,
              color: COLORS.textStrong,
              fontWeight: 700,
            }}
          >
            {isCompleted
              ? "Toutes les signatures requises ont été recueillies. Les documents finaux sont disponibles au téléchargement."
              : recommendedActionLabel}
          </div>
        </div>

        {!isCompleted ? (
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={onSendAllRemainingLinks}
              disabled={!canSendAllRemainingLinks}
              style={{
                appearance: "none",
                border: `1px solid ${canSendAllRemainingLinks ? "#1D4ED8" : "#D0D5DD"}`,
                background: canSendAllRemainingLinks ? "#1D4ED8" : "#F2F4F7",
                color: canSendAllRemainingLinks ? "#FFFFFF" : "#98A2B3",
                borderRadius: 12,
                padding: "11px 16px",
                fontSize: 14,
                fontWeight: 800,
                cursor: canSendAllRemainingLinks ? "pointer" : "not-allowed",
                boxShadow: canSendAllRemainingLinks
                  ? "0 6px 16px rgba(29, 78, 216, 0.18)"
                  : "none",
              }}
            >
              Envoyer tous les liens restants
            </button>

            <button
              type="button"
              onClick={onStartNextOnSite}
              disabled={!canStartNextOnSite}
              style={{
                appearance: "none",
                border: `1px solid ${canStartNextOnSite ? COLORS.borderStrong : "#D0D5DD"}`,
                background: canStartNextOnSite ? "#FFFFFF" : "#F9FAFB",
                color: canStartNextOnSite ? COLORS.textStrong : "#98A2B3",
                borderRadius: 12,
                padding: "11px 16px",
                fontSize: 14,
                fontWeight: 700,
                cursor: canStartNextOnSite ? "pointer" : "not-allowed",
              }}
            >
              Lancer la prochaine signature sur place
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}