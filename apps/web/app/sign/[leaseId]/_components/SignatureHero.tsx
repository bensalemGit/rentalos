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

const textStrong = "#172033";
const textSoft = "#667085";
const borderSoft = "#dde3ec";

function pillStyle(tone: "success" | "warning" | "neutral") {
  if (tone === "success") {
    return {
      background: "rgba(34,197,94,0.08)",
      color: "#1f7a57",
      border: "1px solid transparent",
    } as const;
  }

  if (tone === "warning") {
    return {
      background: "rgba(245,158,11,0.10)",
      color: "#b45309",
      border: "1px solid rgba(245,158,11,0.22)",
    } as const;
  }

  return {
    background: "rgba(100,116,139,0.08)",
    color: "#667085",
    border: "1px solid transparent",
  } as const;
}

export function SignatureHero({
  overview,
  recommendedActionLabel,
  canSendAllRemainingLinks,
  canStartNextOnSite,
  onSendAllRemainingLinks,
  onStartNextOnSite,
}: SignatureHeroProps) {
  const progressWidth = `${Math.max(6, Math.min(100, overview.progressPercent || 0))}%`;
  const remainingTone =
    overview.remainingCount === 0 ? "success" : overview.progressPercent >= 50 ? "warning" : "neutral";

  const isCompleted = overview.remainingCount === 0;

  return (
    <div
      style={{
        background: isCompleted
          ? "linear-gradient(180deg, #ffffff 0%, #f7fcf8 100%)"
          : "#ffffff",
        border: isCompleted
          ? "1px solid rgba(34,197,94,0.20)"
          : `1px solid ${borderSoft}`,
        borderRadius: 24,
        padding: "28px 30px",
        boxShadow: isCompleted
          ? "0 16px 36px rgba(34,197,94,0.08), 0 2px 6px rgba(15,23,42,0.03)"
          : "0 10px 30px rgba(15,23,42,0.04), 0 2px 6px rgba(15,23,42,0.03)",
        display: "grid",
        gap: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 280 }}>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: -0.04,
              color: textStrong,
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            Centre de signature
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 15.5,
              lineHeight: 1.65,
              color: "#334155",
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            <span style={{ color: textSoft }}>Dossier :</span>{" "}
            <span style={{ fontWeight: 700, color: textStrong }}>{overview.leaseLabel}</span>
            {" — "}
            <span style={{ color: textSoft }}>Locataire principal :</span>{" "}
            <span style={{ fontWeight: 700, color: textStrong }}>{overview.primaryTenantName}</span>
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "8px 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: -0.01,
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            whiteSpace: "nowrap",
            ...pillStyle(remainingTone),
          }}
        >
          {overview.remainingCount === 0
            ? "Dossier prêt"
            : `${overview.remainingCount} signature(s) restante(s)`}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            height: 8,
            borderRadius: 999,
            background: "#eef3f8",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: progressWidth,
              height: "100%",
              borderRadius: 999,
              background: overview.remainingCount === 0 ? "#66a884" : "#d49447",
              transition: "width 180ms ease",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "7px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              ...pillStyle(overview.tenants.pending === 0 && overview.tenants.total > 0 ? "success" : "warning"),
            }}
          >
            Locataires {overview.tenants.signed}/{overview.tenants.total}
          </span>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "7px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              ...pillStyle(
                overview.guarantors.total === 0 || overview.guarantors.pending === 0 ? "success" : "warning",
              ),
            }}
          >
            Garanties {overview.guarantors.signed}/{overview.guarantors.total}
          </span>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "7px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              ...pillStyle(overview.landlord.signed ? "success" : "warning"),
            }}
          >
            Bailleur {overview.landlord.signed ? "signé" : "à signer"}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 8,
          padding: "14px 16px",
          borderRadius: 16,
          border: isCompleted
            ? "1px solid rgba(34,197,94,0.18)"
            : "1px solid rgba(47,95,184,0.14)",
          background: isCompleted
            ? "rgba(34,197,94,0.05)"
            : "rgba(47,95,184,0.04)",
        }}
      >
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 800,
            letterSpacing: 0.3,
            textTransform: "uppercase",
            color: isCompleted ? "#15803d" : "#2F5FB8",
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          {isCompleted ? "Dossier finalisé" : "Prochaine action recommandée"}
        </div>
        <div
          style={{
            fontSize: 15,
            lineHeight: 1.55,
            color: textStrong,
            fontWeight: 700,
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          {isCompleted
            ? "Toutes les signatures requises ont été recueillies. Les documents finaux sont disponibles au téléchargement."
            : recommendedActionLabel}
        </div>

        {!isCompleted ? (    
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={onSendAllRemainingLinks}
            disabled={!canSendAllRemainingLinks}
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid #2F5FB8",
              background: "#2F5FB8",
              color: "#ffffff",
              fontWeight: 700,
              cursor: canSendAllRemainingLinks ? "pointer" : "not-allowed",
              opacity: canSendAllRemainingLinks ? 1 : 0.55,
              boxShadow: "0 8px 18px rgba(47,95,184,0.18), inset 0 -1px 0 rgba(0,0,0,0.08)",
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            Envoyer tous les liens restants
          </button>

          <button
            type="button"
            onClick={onStartNextOnSite}
            disabled={!canStartNextOnSite}
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid #cfd8e3",
              background: "#ffffff",
              color: "#243041",
              fontWeight: 700,
              cursor: canStartNextOnSite ? "pointer" : "not-allowed",
              opacity: canStartNextOnSite ? 1 : 0.55,
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            Lancer la prochaine signature sur place
          </button>
        </div>
      ) : null}
      </div>
    </div>
  );
}