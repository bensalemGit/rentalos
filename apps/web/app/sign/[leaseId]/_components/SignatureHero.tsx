import React from "react";
import type { SignatureOverview } from "../_types/signature-center.types";

type SignatureHeroProps = {
  overview: SignatureOverview;
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

export function SignatureHero({ overview }: SignatureHeroProps) {
  const progressWidth = `${Math.max(6, Math.min(100, overview.progressPercent || 0))}%`;
  const remainingTone =
    overview.remainingCount === 0 ? "success" : overview.progressPercent >= 50 ? "warning" : "neutral";

  return (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid ${borderSoft}`,
        borderRadius: 24,
        padding: "28px 30px",
        boxShadow: "0 10px 30px rgba(15,23,42,0.04), 0 2px 6px rgba(15,23,42,0.03)",
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
    </div>
  );
}