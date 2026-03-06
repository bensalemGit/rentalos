"use client";
import React from "react";

const brandBlue = "#356AC3";
const borderSoft = "#d9dee7";
const borderSoftStrong = "#cfd7e3";
const textStrong = "#1f2937";
const textSoft = "#64748b";

export type SignableCardAction = {
  label: string;
  onClick: () => void | Promise<void>;
  kind?: "primary" | "secondary";
  disabled?: boolean;
  title?: string;
};

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
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                lineHeight: 1.25,
                fontWeight: 700,
                color: textStrong,
                fontFamily:
                  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            >
              {props.title}
            </h3>
            {props.statusChip}
          </div>

          {props.subtitle ? (
            <div
              style={{
                marginTop: 8,
                color: textSoft,
                fontSize: 13,
                lineHeight: 1.45,
                fontFamily:
                  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            >
              {props.subtitle}
            </div>
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
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 14,
                lineHeight: 1.2,
                cursor: a.disabled ? "not-allowed" : "pointer",
                opacity: a.disabled ? 0.45 : 1,
                boxShadow: "0 1px 2px rgba(53,106,195,0.18)",
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
                background: "#ffffff",
                color: "#0f172a",
                fontWeight: 700,
                fontSize: 14,
                lineHeight: 1.2,
                cursor: a.disabled ? "not-allowed" : "pointer",
                opacity: a.disabled ? 0.45 : 1,
                boxShadow: "0 1px 1px rgba(15,23,42,0.03)",
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