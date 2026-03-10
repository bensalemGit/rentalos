import React from "react";

type SignableAction = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  kind?: "primary" | "secondary";
};

export function SignableCard({
  title,
  subtitle,
  statusChip,
  actions = [],
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  statusChip?: React.ReactNode;
  actions?: SignableAction[];
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(26,39,66,0.06)",
        borderRadius: 20,
        background: "linear-gradient(180deg, #FFFFFF 0%, #FCFDFF 100%)",
        boxShadow: "0 8px 18px rgba(31,41,64,0.03), 0 2px 6px rgba(31,41,64,0.018)",
        padding: 16,
        display: "grid",
        gap: 12,
        minWidth: 0,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 15.5,
              lineHeight: 1.3,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#16233D",
            }}
          >
            {title}
          </div>

          {subtitle ? (
            <div
              style={{
                marginTop: 8,
                fontSize: 13.5,
                lineHeight: 1.6,
                color: "#667792",
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        {statusChip ? <div style={{ flexShrink: 0 }}>{statusChip}</div> : null}
      </div>

      {actions.length > 0 ? (
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {actions.map((action, index) => {
            const isPrimary = (action.kind || "primary") === "primary";

            return (
              <button
                key={`${action.label}-${index}`}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                style={{
                  appearance: "none",
                  border: isPrimary ? "none" : "1px solid rgba(26,39,66,0.08)",
                  borderRadius: 14,
                  minHeight: 40,
                  padding: "0 14px",
                  background: action.disabled
                    ? "#F3F5F8"
                    : isPrimary
                      ? "linear-gradient(180deg, #6A90EB 0%, #557ADD 100%)"
                      : "rgba(255,255,255,0.82)",
                  color: action.disabled
                    ? "#A0AAB9"
                    : isPrimary
                      ? "#FFFFFF"
                      : "#22324B",
                  fontSize: 13.5,
                  fontWeight: 800,
                  letterSpacing: "-0.01em",
                  cursor: action.disabled ? "not-allowed" : "pointer",
                  boxShadow: action.disabled
                    ? "none"
                    : isPrimary
                      ? "0 8px 16px rgba(85,122,221,0.12), inset 0 1px 0 rgba(255,255,255,0.14)"
                      : "0 3px 8px rgba(31,41,64,0.022)",
                  fontFamily:
                    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}