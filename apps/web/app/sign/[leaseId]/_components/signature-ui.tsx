import React from "react";

export const SIGN_UI = {
  font:
    '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',

  colors: {
    textStrong: "#1F2A3C",
    textSoft: "#667085",
    textMuted: "#98A2B3",

    blue: "#2F63E0",
    blueSoft: "#EEF4FF",
    blueHover: "#2A5BD7",

    green: "#2F9366",
    greenText: "#1E7A55",
    greenBg: "#EDF7F1",

    amber: "#B57B38",
    amberText: "#A06A2C",
    amberBg: "#F6F1E8",

    red: "#C65A5A",
    redBg: "#FCEEEE",

    neutral: "#7D8798",
    neutralBg: "#F4F7FB",

    line: "rgba(20, 33, 61, 0.08)",
    lineSoft: "rgba(20, 33, 61, 0.05)",

    cardBorder: "#E4EAF2",
    borderSoft: "rgba(20, 33, 61, 0.08)",
    borderUltraSoft: "rgba(20, 33, 61, 0.05)",

    cardBg: "#FFFFFF",
    pageBgTop: "#FAFBFD",
    pageBgBottom: "#F3F6FA",
  },

  shadows: {
    card: "0 6px 18px rgba(16,24,40,0.035), 0 2px 6px rgba(16,24,40,0.02)",
    cardHover: "0 10px 24px rgba(16,24,40,0.06), 0 3px 10px rgba(16,24,40,0.03)",
    button: "0 2px 4px rgba(47,99,224,0.12), inset 0 1px 0 rgba(255,255,255,0.14)",
    soft: "0 1px 2px rgba(16,24,40,0.04)",
  },

  radius: {
    xl: 24,
    lg: 18,
    md: 14,
    sm: 12,
    xs: 10,
    pill: 999,
  },
} as const;

export const COLORS = SIGN_UI.colors;

export function statusToneFromLabel(label?: string): "success" | "warning" | "neutral" {
  const value = String(label || "").toLowerCase();

  if (value.includes("signé") || value.includes("signe")) return "success";
  if (
    value.includes("cours") ||
    value.includes("prépar") ||
    value.includes("génér") ||
    value.includes("brouillon") ||
    value.includes("restant") ||
    value.includes("envoy")
  ) {
    return "warning";
  }

  return "neutral";
}

function getHeroChipTone(done: boolean, empty = false) {
  if (empty) {
    return {
      bg: "rgba(27,39,64,0.04)",
      text: "#667085",
      icon: "#98A2B3",
      border: "rgba(27,39,64,0.05)",
    };
  }

  if (done) {
    return {
      bg: "#EDF7F1",
      text: "#1E7A55",
      icon: "#2F9366",
      border: "rgba(47,147,102,0.14)",
    };
  }

  return {
    bg: "#F6F1E8",
    text: "#A06A2C",
    icon: "#B57B38",
    border: "rgba(160,106,44,0.14)",
  };
}

export function HeroChip({
  icon,
  label,
  done,
  empty = false,
}: {
  icon: React.ReactNode;
  label: string;
  done: boolean;
  empty?: boolean;
}) {
  const tone = getHeroChipTone(done, empty);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minHeight: 34,
        padding: "0 12px",
        borderRadius: 10,
        background: tone.bg,
        color: tone.text,
        border: `1px solid ${tone.border}`,
        boxShadow: "none",
        fontSize: 12.5,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
        fontFamily: SIGN_UI.font,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: tone.icon,
        }}
      >
        {icon}
      </span>
      <span>{label}</span>
    </span>
  );
}

export function PremiumButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  size = "md",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  const isSm = size === "sm";

  const base: React.CSSProperties = {
    appearance: "none",
    borderRadius: 14,
    height: isSm ? 38 : 44,
    padding: isSm ? "0 14px" : "0 18px",
    fontSize: isSm ? 13 : 13.5,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 140ms ease",
    fontFamily: SIGN_UI.font,
    whiteSpace: "nowrap",
  };

  let style: React.CSSProperties = {};

  if (variant === "primary") {
    style = {
      border: "none",
      background: disabled
        ? "#E8EDF5"
        : "linear-gradient(180deg, #2F63E0 0%, #2A5BD7 100%)",
      color: disabled ? "#9AA6BA" : "#FFFFFF",
      boxShadow: disabled ? "none" : SIGN_UI.shadows.button,
    };
  } else if (variant === "secondary") {
    style = {
      border: `1px solid ${disabled ? "#D9E1EC" : "rgba(27,39,64,0.08)"}`,
      background: disabled ? "#FFFFFF" : "#FAFBFC",
      color: disabled ? "#9AA6BA" : SIGN_UI.colors.textStrong,
      boxShadow: "none",
    };
  } else {
    style = {
      border: "none",
      background: "transparent",
      color: disabled ? "#9AA6BA" : SIGN_UI.colors.blue,
      boxShadow: "none",
      padding: 0,
      height: "auto",
    };
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...base, ...style }}>
      {children}
    </button>
  );
}

export function InlineTextLink({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
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
        fontFamily: SIGN_UI.font,
        fontSize: 13,
        lineHeight: 1.25,
        fontWeight: 500,
        color: disabled ? "#A7B0C0" : SIGN_UI.colors.blue,
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export function InlineTextStatus({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "success" | "warning" | "neutral" | "danger";
}) {
  const map = {
    success: "#117A51",
    warning: "#A96D16",
    neutral: "#6F7B91",
    danger: "#C65A5A",
  } as const;

  return (
    <span
      style={{
        fontSize: 12.5,
        lineHeight: 1.2,
        fontWeight: 500,
        color: map[tone],
        whiteSpace: "nowrap",
        fontFamily: SIGN_UI.font,
      }}
    >
      {children}
    </span>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  countLabel,
}: {
  eyebrow: string;
  title: string;
  countLabel?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: SIGN_UI.colors.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 6,
          fontFamily: SIGN_UI.font,
        }}
      >
        {eyebrow}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: SIGN_UI.colors.textStrong,
            letterSpacing: "-0.01em",
            fontFamily: SIGN_UI.font,
          }}
        >
          {title}
        </div>

        {countLabel ? (
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: SIGN_UI.colors.textStrong,
              fontFamily: SIGN_UI.font,
            }}
          >
            {countLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ActivityDot() {
  return (
    <span
      style={{
        width: 5,
        height: 5,
        borderRadius: 999,
        background: "#5E7FEF",
        opacity: 0.9,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

export const ICONS = {
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: SIGN_UI.colors.blue,
    display: "inline-block",
    flexShrink: 0,
  } as React.CSSProperties,
};