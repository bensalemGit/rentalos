"use client";

import { ArrowLeft } from "lucide-react";

type LeaseEditHeaderProps = {
  title: string;
  subtitle: string;
  kindLabel: string;
  statusLabel: string;
  status: string;
  onBack: () => void;
  onSave: () => void;
  saving?: boolean;
};

export default function LeaseEditHeader({
  title,
  subtitle,
  kindLabel,
  statusLabel,
  status,
  onBack,
  onSave,
  saving = false,
}: LeaseEditHeaderProps) {
  return (
    <>
      <div style={topBarStyle}>
        <button onClick={onBack} style={ghostButtonStyle}>
          <ArrowLeft size={16} />
          Retour aux baux
        </button>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={onSave} disabled={saving} style={primaryButtonStyle}>
            {saving ? "Enregistrement…" : "Enregistrer la désignation"}
          </button>
        </div>
      </div>

      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Édition</div>
          <h1 style={pageTitleStyle}>{title}</h1>
          <p style={pageSubtitleStyle}>{subtitle}</p>
        </div>

        <div style={heroBadgesStyle}>
          <span style={softBadgeStyle}>{kindLabel}</span>
          <span style={statusBadgeStyle(status)}>{statusLabel}</span>
        </div>
      </section>
    </>
  );
}

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const ghostButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid rgba(27,39,64,0.08)",
  background: "#fff",
  color: "#243247",
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid rgba(52,103,235,0.10)",
  background: "#3467EB",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(52,103,235,0.16)",
};

const heroStyle: React.CSSProperties = {
  border: "1px solid rgba(27,39,64,0.06)",
  borderRadius: 24,
  background: "linear-gradient(180deg, #FCFDFF 0%, #F7F9FD 100%)",
  padding: "24px 24px 22px",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#8D99AE",
  fontWeight: 800,
  marginBottom: 8,
};

const pageTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 38,
  lineHeight: 1.02,
  letterSpacing: "-0.04em",
  color: "#17233A",
  fontWeight: 900,
};

const pageSubtitleStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 15,
  color: "#667085",
  lineHeight: 1.6,
};

const heroBadgesStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const softBadgeStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(27,39,64,0.08)",
  background: "#fff",
  color: "#243247",
  fontSize: 13,
  fontWeight: 700,
};

function statusBadgeStyle(status: string): React.CSSProperties {
  if (status === "active") {
    return {
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(31,157,97,0.16)",
      background: "#ECF9F1",
      color: "#1F9D61",
      fontSize: 13,
      fontWeight: 800,
    };
  }

  if (status === "notice") {
    return {
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(160,106,44,0.18)",
      background: "#FBF2E8",
      color: "#A06A2C",
      fontSize: 13,
      fontWeight: 800,
    };
  }

  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(27,39,64,0.08)",
    background: "#fff",
    color: "#667085",
    fontSize: 13,
    fontWeight: 800,
  };
}