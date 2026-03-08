import React from "react";

export type HistoryItem = {
  id: string;
  dateLabel: string;
  title: string;
  subtitle?: string;
};

type HistorySectionProps = {
  items: HistoryItem[];
};

const COLORS = {
  textStrong: "#172033",
  textSoft: "#667085",
  textMuted: "#98A2B3",
  border: "#D9E2EC",
  borderSoft: "#E9EEF5",
  surface: "#FFFFFF",
  graySoft: "#F8FAFC",
  blue: "#1D4ED8",
};

export function HistorySection({ items }: HistorySectionProps) {
  const visibleItems = items.slice(0, 5);

  return (
    <section
      style={{
        borderRadius: 18,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px 10px 16px",
          borderBottom: `1px solid ${COLORS.borderSoft}`,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: COLORS.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 4,
          }}
        >
          Historique récent
        </div>

        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: COLORS.textStrong,
          }}
        >
          {visibleItems.length === 0
            ? "Aucun événement"
            : `$Activité du dossier${visibleItems.length > 1 ? "s" : ""}`}
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <div
          style={{
            padding: "16px",
            display: "grid",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: COLORS.textStrong,
            }}
          >
            Aucun événement récent
          </div>

          <div
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: COLORS.textSoft,
            }}
          >
            Les envois de liens, préparations de documents et signatures
            apparaîtront ici au fil de l’avancement du dossier.
          </div>
        </div>
      ) : (
        <div>
          {visibleItems.map((item, index) => (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: "90px minmax(0, 1fr)",
                gap: 12,
                padding: "10px 16px",
                borderTop: index === 0 ? "none" : `1px solid ${COLORS.borderSoft}`,
                alignItems: "start",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: COLORS.textMuted,
                  lineHeight: 1.4,
                  whiteSpace: "nowrap",
                }}
              >
                {item.dateLabel}
              </div>

              <div
                style={{
                  minWidth: 0,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 9,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: COLORS.blue,
                    marginTop: 5,
                    flexShrink: 0,
                  }}
                />

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: COLORS.textStrong,
                      lineHeight: 1.4,
                      wordBreak: "break-word",
                    }}
                  >
                    {item.title}
                  </div>

                  {item.subtitle ? (
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: COLORS.textSoft,
                        wordBreak: "break-word",
                      }}
                    >
                      {item.subtitle}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}