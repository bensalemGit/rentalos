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

const textStrong = "#172033";
const textSoft = "#667085";
const borderSoft = "#dde3ec";

export function HistorySection({ items }: HistorySectionProps) {
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: "#94a3b8",
            boxShadow: "0 0 0 6px rgba(148,163,184,0.10)",
          }}
        />
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 0.02,
            color: "#667085",
            textTransform: "uppercase",
          }}
        >
          Historique récent
        </div>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: `1px solid ${borderSoft}`,
          borderRadius: 20,
          padding: 18,
          boxShadow: "0 10px 30px rgba(15,23,42,0.04), 0 2px 6px rgba(15,23,42,0.03)",
          display: "grid",
          gap: 0,
        }}
      >
        {items.length === 0 ? (
          <div
            style={{
              display: "grid",
              gap: 8,
              padding: "6px 2px",
              color: textSoft,
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: textStrong,
                letterSpacing: -0.01,
              }}
            >
              Aucun événement récent
            </div>

            <div
              style={{
                fontSize: 13.5,
                lineHeight: 1.6,
                color: textSoft,
              }}
            >
              Les envois de liens, préparations de documents et signatures apparaîtront ici au fil de l’avancement du dossier.
            </div>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                gap: 16,
                padding: "14px 0",
                borderBottom: index === items.length - 1 ? "none" : "1px solid rgba(226,232,240,0.7)",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#98a2b3",
                  paddingTop: 2,
                  fontFamily:
                    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                {item.dateLabel}
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: textStrong,
                    letterSpacing: -0.01,
                    fontFamily:
                      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  {item.title}
                </div>

                {item.subtitle ? (
                  <div
                    style={{
                      fontSize: 13.5,
                      color: textSoft,
                      lineHeight: 1.55,
                      fontFamily:
                        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    }}
                  >
                    {item.subtitle}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}