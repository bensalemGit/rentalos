import React from "react";
import type { SignerTask } from "../_types/signature-center.types";

export function SignatureSessionPanel({
  task,
  onClose,
}: {
  task: SignerTask | null;
  onClose: () => void;
}) {
  if (!task) {
    return (
      <div style={panel}>
        <h3 style={title}>Poste de signature</h3>
        <p style={mutedLead}>
          Démarrez de préférence depuis une carte signataire pour ouvrir une
          session guidée.
        </p>

        <div style={innerCard}>
          <div style={innerTitle}>Commencez par choisir un signataire</div>
          <div style={illustrationRow}>
            <div style={illustrationBox}>
              <div style={sheet}>
                <div style={sheetLineLg} />
                <div style={sheetLineMd} />
                <div style={sheetLineSm} />
              </div>
              <div style={checkMark} />
            </div>

            <p style={innerMuted}>
              Sélectionnez un locataire, un garant ou le bailleur dans la section
              signataires pour ouvrir une session guidée de signature sur place.
            </p>
          </div>

          <button type="button" style={btnGhostWide}>
            Ouvrir le mode manuel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={panel}>
      <h3 style={title}>Poste de signature</h3>
      <p style={mutedLead}>
        Session guidée ouverte pour finaliser la signature sur place.
      </p>

      <div style={activeSessionCard}>
        <div style={infoBlock}>
          <div style={label}>Signataire</div>
          <div style={value}>{task.displayName}</div>
        </div>

        <div style={infoBlock}>
          <div style={label}>Document</div>
          <div style={value}>{task.documentLabel}</div>
        </div>

        <div style={signatureZone}>
          <span style={signatureHint}>Le signataire signe ici</span>
        </div>

        <div style={actionsRow}>
          <button type="button" style={btnSecondary} onClick={onClose}>
            Effacer
          </button>

          <button type="button" style={btnPrimary}>
            Confirmer signature
          </button>
        </div>

        <p style={footnote}>
          La signature sera horodatée et enregistrée dans le dossier locatif.
        </p>
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  border: "1px solid rgba(26,39,66,0.06)",
  borderRadius: 30,
  padding: 20,
  background: "linear-gradient(180deg, #FFFFFF 0%, #FCFDFF 100%)",
  boxShadow: "0 10px 24px rgba(15,23,42,0.03), 0 2px 8px rgba(15,23,42,0.018)",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  lineHeight: 1.18,
  fontWeight: 800,
  color: "#1B2740",
  letterSpacing: "-0.02em",
};

const mutedLead: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 13.5,
  lineHeight: 1.65,
  color: "#667085",
};

const innerCard: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid rgba(26,39,66,0.06)",
  borderRadius: 22,
  background: "rgba(255,255,255,0.82)",
  padding: 16,
  boxShadow: "0 6px 14px rgba(15,23,42,0.022)",
};

const innerTitle: React.CSSProperties = {
  fontSize: 15.5,
  lineHeight: 1.35,
  fontWeight: 800,
  color: "#172033",
  letterSpacing: "-0.01em",
  marginBottom: 12,
};

const illustrationRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "58px minmax(0, 1fr)",
  gap: 14,
  alignItems: "start",
};

const illustrationBox: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 14,
  background: "linear-gradient(180deg, #E7F6F4 0%, #D9F0ED 100%)",
  border: "1px solid rgba(155,206,202,0.72)",
  boxShadow: "0 4px 10px rgba(31,41,64,0.03)",
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const sheet: React.CSSProperties = {
  width: 28,
  height: 34,
  borderRadius: 6,
  background: "#FFFDF9",
  border: "1.5px solid #A6CFCA",
  position: "relative",
  boxShadow: "0 2px 5px rgba(31,41,64,0.04)",
};

const sheetLineLg: React.CSSProperties = {
  position: "absolute",
  top: 7,
  left: 6,
  width: 16,
  height: 2.5,
  borderRadius: 999,
  background: "#8AAECA",
};

const sheetLineMd: React.CSSProperties = {
  position: "absolute",
  top: 13,
  left: 6,
  width: 12,
  height: 2.5,
  borderRadius: 999,
  background: "#8AAECA",
};

const sheetLineSm: React.CSSProperties = {
  position: "absolute",
  top: 19,
  left: 6,
  width: 9,
  height: 2.5,
  borderRadius: 999,
  background: "#8AAECA",
};

const checkMark: React.CSSProperties = {
  position: "absolute",
  right: 8,
  bottom: 10,
  width: 18,
  height: 10,
  borderLeft: "4px solid #D98A4C",
  borderBottom: "4px solid #D98A4C",
  transform: "rotate(-45deg)",
  borderRadius: 2,
};

const innerMuted: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.7,
  color: "#667085",
};

const activeSessionCard: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid rgba(26,39,66,0.06)",
  borderRadius: 22,
  background: "rgba(255,255,255,0.82)",
  padding: 16,
  boxShadow: "0 6px 14px rgba(15,23,42,0.022)",
};

const infoBlock: React.CSSProperties = {
  marginBottom: 14,
};

const label: React.CSSProperties = {
  fontSize: 11.5,
  lineHeight: 1.4,
  fontWeight: 800,
  color: "#98A2B3",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
};

const value: React.CSSProperties = {
  fontSize: 14.5,
  lineHeight: 1.45,
  fontWeight: 700,
  color: "#1E293B",
};

const signatureZone: React.CSSProperties = {
  height: 148,
  border: "1px solid rgba(26,39,66,0.08)",
  borderRadius: 16,
  background: "linear-gradient(180deg, #FFFFFF 0%, #FBFDFF 100%)",
  marginBottom: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.82)",
};

const signatureHint: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#94A3B8",
};

const actionsRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
};

const btnPrimary: React.CSSProperties = {
  flex: 1,
  height: 42,
  background: "linear-gradient(180deg, #6A90EB 0%, #557ADD 100%)",
  color: "#FFFFFF",
  border: "none",
  borderRadius: 13,
  padding: "0 16px",
  fontWeight: 700,
  fontSize: 13.5,
  letterSpacing: "-0.01em",
  boxShadow: "0 8px 16px rgba(85,122,221,0.12), inset 0 1px 0 rgba(255,255,255,0.14)",
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  flex: 1,
  height: 42,
  background: "rgba(255,255,255,0.82)",
  color: "#243041",
  border: "1px solid rgba(26,39,66,0.08)",
  borderRadius: 13,
  padding: "0 16px",
  fontWeight: 600,
  fontSize: 13.5,
  letterSpacing: "-0.01em",
  boxShadow: "0 3px 8px rgba(15,23,42,0.022)",
  cursor: "pointer",
};

const btnGhostWide: React.CSSProperties = {
  width: "100%",
  height: 42,
  marginTop: 14,
  background: "rgba(255,255,255,0.82)",
  color: "#243041",
  border: "1px solid rgba(26,39,66,0.08)",
  borderRadius: 13,
  padding: "0 16px",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: "-0.01em",
  boxShadow: "0 3px 8px rgba(15,23,42,0.022)",
  cursor: "pointer",
};

const footnote: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 12.5,
  lineHeight: 1.55,
  color: "#667085",
};