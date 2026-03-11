import React from "react";
import { SIGN_UI, ActivityDot, SectionTitle } from "./signature-ui";

export type HistoryItem = {
  id: string;
  dateLabel: string;
  title: string;
  subtitle?: string;
};

type HistorySectionProps = {
  items: HistoryItem[];
};

export function HistorySection({ items }: HistorySectionProps) {
  const visibleItems = items.slice(0, 5);

  return (
    <section
      style={{
        fontFamily: SIGN_UI.font,
        minWidth: 0,
      }}
    >
      <SectionTitle
        eyebrow="Historique récent"
        title={visibleItems.length === 0 ? "Aucun événement" : "Activité du dossier"}
      />

      {visibleItems.length === 0 ? (
        <div
          style={{
            paddingTop: 10,
            borderTop: `1px solid ${SIGN_UI.colors.line}`,
            fontSize: 13,
            lineHeight: 1.55,
            color: SIGN_UI.colors.textSoft,
          }}
        >
          Les envois de liens, préparations et signatures apparaîtront ici.
        </div>
      ) : (
        <div style={{ borderTop: `1px solid ${SIGN_UI.colors.line}` }}>
          {visibleItems.map((item, index) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
                padding: "10px 0",
                borderTop: index === 0 ? "none" : `1px solid ${SIGN_UI.colors.lineSoft}`,
              }}
            >
              <ActivityDot />

              <span
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: "#8E9AAF",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                {item.dateLabel}
              </span>

              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: SIGN_UI.colors.textStrong,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  letterSpacing: "-0.01em",
                }}
                title={item.title}
              >
                {item.title}
              </span>

              {item.subtitle ? (
                <>
                  <span
                    style={{
                      color: "#C2CAD8",
                      flexShrink: 0,
                    }}
                  >
                    •
                  </span>

                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 400,
                      color: SIGN_UI.colors.textSoft,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={item.subtitle}
                  >
                    {item.subtitle}
                  </span>
                </>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}