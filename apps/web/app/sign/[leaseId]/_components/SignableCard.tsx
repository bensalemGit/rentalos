"use client";
import React from "react";

export type SignableCardAction = {
  label: string;
  onClick: () => void | Promise<void>;
  kind?: "primary" | "secondary";
  disabled?: boolean;
  title?: string;
};

const brandBlue = "#2F5FB8";
const borderSoft = "#dde3ec";
const borderSoftStrong = "#cfd8e3";
const textStrong = "#172033";
const textSoft = "#667085";

export function SignableCard(props: {
  title: string;
  statusChip: React.ReactNode;
  subtitle?: React.ReactNode;
  actions: SignableCardAction[];
  children?: React.ReactNode;
}) {
  const primary = props.actions.filter((a) => a.kind !== "secondary");
  const secondary = props.actions.filter((a) => a.kind === "secondary");

  return (
    <section
      style={{
        border: `1px solid ${borderSoft}`,
        borderRadius: 16,
        background: "#fff",
        padding: 14,
        marginTop: 12,
        boxShadow: "0 2px 6px rgba(15,23,42,0.03)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <h3
              style={{
                margin: 0,
                fontSize: 15.5,
                fontWeight: 800,
                color: textStrong,
                letterSpacing: -0.02,
              }}
            >
              {props.title}
            </h3>
            {props.statusChip}
          </div>

          {props.subtitle ? (
            <div style={{ marginTop: 8, color: textSoft, fontSize: 13, lineHeight: 1.5 }}>{props.subtitle}</div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {primary.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              disabled={a.disabled}
              title={a.title}
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                border: `1px solid ${brandBlue}`,
                background: brandBlue,
                color: "#fff",
                fontWeight: 600,
                cursor: a.disabled ? "not-allowed" : "pointer",
                opacity: a.disabled ? 0.55 : 1,
                boxShadow: "0 8px 18px rgba(47,95,184,0.16), inset 0 -1px 0 rgba(0,0,0,0.08)",
                fontFamily:
                  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            >
              {a.label}
            </button>
          ))}

          {secondary.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              disabled={a.disabled}
              title={a.title}
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                border: `1px solid ${borderSoftStrong}`,
                background: "#fff",
                color: "#243041",
                fontWeight: 600,
                cursor: a.disabled ? "not-allowed" : "pointer",
                opacity: a.disabled ? 0.55 : 1,
                boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
                fontFamily:
                  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {props.children ? <div style={{ marginTop: 12 }}>{props.children}</div> : null}
    </section>
  );
}