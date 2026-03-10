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

const FONT =
  '"Inter", "Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

const COLORS = {
  textStrong: "#1B2740",
  textSoft: "#667085",
  textMuted: "#98A2B3",
  line: "rgba(26,39,66,0.06)",
  lineSoft: "rgba(26,39,66,0.045)",
  blue: "#4F6FD3",
};

export function HistorySection({ items }: HistorySectionProps) {
  const visibleItems = items.slice(0, 5);

  return (
    <section
      style={{
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: "#A4AEBD",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 6,
          }}
        >
          Historique récent
        </div>

        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: COLORS.textStrong,
            letterSpacing: "-0.01em",
          }}
        >
          {visibleItems.length === 0
            ? "Aucun événement"
            : `Activité du dossier`}
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <div
          style={{
            padding: "10px 0 4px 0",
            borderTop: `1px solid ${COLORS.line}`,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: COLORS.textStrong,
              marginBottom: 4,
            }}
          >
            Aucun événement récent
          </div>

          <div
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: COLORS.textSoft,
              maxWidth: 760,
            }}
          >
            Les envois de liens, préparations de documents et signatures
            apparaîtront ici au fil de l’avancement du dossier.
          </div>
        </div>
      ) : (
        <div
          style={{
            borderTop: `1px solid ${COLORS.line}`,
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: "96px minmax(0, 1fr)",
                gap: 12,
                padding: "10px 0",
                borderTop: index === 0 ? "none" : `1px solid ${COLORS.lineSoft}`,
                alignItems: "start",
              }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: COLORS.textMuted,
                  lineHeight: 1.4,
                  whiteSpace: "nowrap",
                  paddingTop: 1,
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
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: COLORS.blue,
                    marginTop: 7,
                    flexShrink: 0,
                    opacity: 0.9,
                  }}
                />

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: COLORS.textStrong,
                      lineHeight: 1.45,
                      wordBreak: "break-word",
                    }}
                  >
                    {item.title}
                  </div>

                  {item.subtitle ? (
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 12.5,
                        lineHeight: 1.5,
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