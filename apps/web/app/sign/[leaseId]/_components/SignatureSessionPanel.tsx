import React from "react";
import type { SignerTask } from "../_types/signature-center.types";

type Props = {
  task: SignerTask | null;
  onClose: () => void;
  onClear: () => void;
  onConfirm: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  isSubmitting?: boolean;
  isSignatureDirty?: boolean;
  guarantorMention?: string;
  onGuarantorMentionChange?: (value: string) => void;
  requiredGuarantorMention?: string;
  guarantorMentionValid?: boolean;
};

export function SignatureSessionPanel({
  task,
  onClose,
  onClear,
  onConfirm,
  canvasRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  isSubmitting = false,
  isSignatureDirty = false,
  guarantorMention = "",
  onGuarantorMentionChange,
  requiredGuarantorMention = "",
  guarantorMentionValid = true,
}: Props) {
  if (!task) {
    return (
      <div style={panel}>
        <div style={panelTitle}>Poste de signature</div>

        <div style={panelLead}>
          Sélectionnez un locataire, un garant ou le bailleur dans la section
          signataires pour ouvrir une session guidée de signature sur place.
        </div>

        <div style={emptyCard}>
          <div style={emptyTitle}>Commencez par choisir un signataire</div>

          <div style={illustrationRow}>
            <div aria-hidden="true" style={illustrationBox}>
              <div style={sheet}>
                <div style={sheetLineLg} />
                <div style={sheetLineMd} />
                <div style={sheetLineSm} />
              </div>
              <div style={checkMark} />
            </div>

            <div style={emptyText}>
              Le panneau de droite devient le terminal unique de signature sur
              place dès qu’une session est ouverte depuis une carte signataire.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isGuarantor = String(task.kind || "").toUpperCase() === "GUARANTOR";
  const guarantorMentionOk = !isGuarantor || guarantorMentionValid;

  return (
    <div style={panel}>
      <div style={panelTitle}>Session de signature</div>

      <div style={panelLead}>
        Vérifiez l’identité du signataire puis recueillez sa signature.
      </div>

      <div style={activeSessionBanner}>
        <div style={bannerKicker}>Session guidée active</div>
        <div style={bannerName}>{task.displayName}</div>
        <div style={bannerMeta}>
          {task.roleLabel}
          {task.tenantLabel ? ` • ${task.tenantLabel}` : ""} • {task.documentLabel}
        </div>
      </div>

      <div style={activeCard}>
        <div style={infoBlock}>
          <div style={fieldLabel}>Signataire</div>
          <div style={fieldValue}>{task.displayName}</div>
        </div>

        <div style={infoGrid}>
          <div style={infoGridItem}>
            <div style={fieldLabel}>Rôle</div>
            <div style={fieldValue}>{task.roleLabel}</div>
          </div>

          <div style={infoGridItem}>
            <div style={fieldLabel}>Document concerné</div>
            <div style={fieldValue}>{task.documentLabel}</div>
          </div>
        </div>

        {task.progressLabel ? (
          <div style={progressWrap}>
            <div style={progressPill}>{task.progressLabel}</div>
          </div>
        ) : null}

        <div
          style={{
            ...signatureShell,
            ...(isSubmitting ? signatureShellSubmitting : null),
          }}
        >
          <div style={signatureSectionLabel}>Signature manuscrite</div>

          <div style={documentLabelBlock}>
            <div style={documentLabelKicker}>Document concerné</div>
            <div style={documentLabelValue}>{task.documentLabel}</div>
          </div>

          {isGuarantor ? (
            <div style={mentionBox}>
              <div style={mentionTitle}>Mention obligatoire du garant</div>

              <div style={mentionHelp}>
                Pour confirmer que le garant comprend son engagement, recopiez exactement la phrase suivante avant de signer :
              </div>

              <div style={mentionRequired}>
                {requiredGuarantorMention}
              </div>

              <textarea
                value={guarantorMention}
                onChange={(e) => onGuarantorMentionChange?.(e.target.value)}
                rows={4}
                style={mentionTextarea}
                placeholder="Recopiez ici la mention ci-dessus"
              />
              {!guarantorMentionOk ? (
                <div style={{ fontSize: 12, color: "#b42318", marginTop: 4 }}>
                  ⚠️ Mention incomplète — vérifiez la somme et la formulation d’engagement.
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={canvasWrap}>
            {!isSignatureDirty ? (
              <div style={canvasHint}>Le signataire signe ici</div>
            ) : null}

            <canvas
              ref={canvasRef}
              style={canvasStyle}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={onPointerUp}
            />
          </div>

          <div style={actionsRow}>
            <button type="button" onClick={onClear} style={secondaryButton}>
              Effacer
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting || !isSignatureDirty || !guarantorMentionOk}
              style={{
                ...primaryButton,
                ...(isSubmitting || !isSignatureDirty || !guarantorMentionOk ? primaryButtonDisabled : null),
              }}
            >
              {isSubmitting ? "Enregistrement…" : "Confirmer la signature"}
            </button>
          </div>

          <div style={footnote}>
            La signature sera horodatée et enregistrée dans le dossier locatif.
          </div>

          <button type="button" onClick={onClose} style={ghostWideButton}>
            Terminer cette session
          </button>
        </div>
      </div>
    </div>
  );
}

const UI_FONT =
  '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const panel: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #D9E2EC",
  borderRadius: 24,
  padding: 24,
  boxShadow: "0 8px 22px rgba(16,24,40,0.04), 0 2px 6px rgba(16,24,40,0.02)",
  fontFamily: UI_FONT,
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
};

const panelTitle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 600,
  color: "#1C2434",
  letterSpacing: -0.015,
  marginBottom: 6,
};

const panelLead: React.CSSProperties = {
  marginBottom: 16,
  fontSize: 13.5,
  lineHeight: 1.65,
  color: "#6B7688",
  fontWeight: 400,
};

const emptyCard: React.CSSProperties = {
  marginTop: 10,
  padding: 20,
  borderRadius: 20,
  border: "1px solid rgba(27,39,64,0.06)",
  background: "#FCFDFE",
  display: "grid",
  gap: 14,
};

const emptyTitle: React.CSSProperties = {
  fontSize: 15.5,
  fontWeight: 600,
  color: "#172033",
  letterSpacing: -0.015,
  lineHeight: 1.25,
};

const illustrationRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "64px minmax(0,1fr)",
  gap: 14,
  alignItems: "start",
};

const illustrationBox: React.CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: 14,
  background: "linear-gradient(180deg,#E8F6F4 0%,#DDF1EE 100%)",
  border: "1px solid rgba(155,206,202,0.52)",
  boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const sheet: React.CSSProperties = {
  width: 30,
  height: 36,
  borderRadius: 7,
  background: "#FFFDF9",
  border: "1.5px solid #A9CEC9",
  position: "relative",
  boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
};

const sheetLineLg: React.CSSProperties = {
  position: "absolute",
  top: 7,
  left: 6,
  width: 17,
  height: 2.5,
  borderRadius: 999,
  background: "#88A6C2",
};

const sheetLineMd: React.CSSProperties = {
  position: "absolute",
  top: 13,
  left: 6,
  width: 13,
  height: 2.5,
  borderRadius: 999,
  background: "#88A6C2",
};

const sheetLineSm: React.CSSProperties = {
  position: "absolute",
  top: 19,
  left: 6,
  width: 10,
  height: 2.5,
  borderRadius: 999,
  background: "#88A6C2",
};

const checkMark: React.CSSProperties = {
  position: "absolute",
  right: 8,
  bottom: 11,
  width: 18,
  height: 10,
  borderLeft: "4px solid #D98A4C",
  borderBottom: "4px solid #D98A4C",
  transform: "rotate(-45deg)",
  borderRadius: 2,
};

const emptyText: React.CSSProperties = {
  fontSize: 13.5,
  lineHeight: 1.72,
  color: "#6B7688",
  fontWeight: 400,
};

const activeSessionBanner: React.CSSProperties = {
  marginTop: 10,
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(47,99,224,0.12)",
  background: "#F2F6FF",
  display: "grid",
  gap: 4,
};

const bannerKicker: React.CSSProperties = {
  fontSize: 11,
  color: "#7B8799",
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: 0.04,
};

const bannerName: React.CSSProperties = {
  fontSize: 15.5,
  fontWeight: 600,
  color: "#172033",
  letterSpacing: -0.01,
};

const bannerMeta: React.CSSProperties = {
  fontSize: 13,
  color: "#6B7688",
  lineHeight: 1.6,
  fontWeight: 400,
};

const activeCard: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const infoBlock: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const infoGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 12,
};

const infoGridItem: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#8A94A6",
  fontWeight: 500,
  letterSpacing: 0.04,
  textTransform: "uppercase",
};

const fieldValue: React.CSSProperties = {
  fontSize: 14.5,
  lineHeight: 1.5,
  color: "#243041",
  fontWeight: 600,
};

const progressWrap: React.CSSProperties = {
  marginTop: -4,
};

const progressPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 32,
  padding: "0 12px",
  borderRadius: 999,
  background: "#F6F1E8",
  color: "#A06A2C",
  fontWeight: 700,
  fontSize: 12.5,
  letterSpacing: -0.01,
};

const signatureShell: React.CSSProperties = {
  borderRadius: 20,
  border: "1px solid rgba(27,39,64,0.06)",
  background: "#FCFDFE",
  padding: 16,
  display: "grid",
  gap: 12,
};

const signatureShellSubmitting: React.CSSProperties = {
  opacity: 0.85,
};

const signatureSectionLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#8A94A6",
  fontWeight: 500,
  letterSpacing: 0.04,
  textTransform: "uppercase",
};

const documentLabelBlock: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const documentLabelKicker: React.CSSProperties = {
  fontSize: 11,
  color: "#8A94A6",
  fontWeight: 500,
  letterSpacing: 0.04,
  textTransform: "uppercase",
};

const documentLabelValue: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  background: "#FAFBFC",
  border: "1px solid rgba(27,39,64,0.08)",
  fontWeight: 500,
  fontSize: 14,
  color: "#243041",
};

const canvasWrap: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: 220,
  borderRadius: 20,
  border: "1px dashed rgba(27,39,64,0.12)",
  background: "linear-gradient(180deg, rgba(47,99,224,0.015) 0%, rgba(27,39,64,0.02) 100%)",
  overflow: "hidden",
};

const canvasHint: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  color: "#9AA5B5",
  fontSize: 13.5,
  fontWeight: 400,
  zIndex: 1,
};

const canvasStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
  position: "relative",
  zIndex: 2,
  touchAction: "none",
};

const actionsRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  justifyContent: "space-between",
  flexWrap: "wrap",
};

const secondaryButton: React.CSSProperties = {
  flex: 1,
  height: 42,
  padding: "0 16px",
  borderRadius: 12,
  border: "1px solid rgba(27,39,64,0.08)",
  background: "#FAFBFC",
  fontWeight: 600,
  fontSize: 14,
  color: "#2D3A52",
  boxShadow: "none",
  fontFamily: UI_FONT,
  cursor: "pointer",
};

const primaryButton: React.CSSProperties = {
  flex: 1,
  height: 42,
  padding: "0 16px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(180deg, #2F63E0 0%, #2A5BD7 100%)",
  color: "white",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: -0.01,
  boxShadow: "0 2px 4px rgba(47,99,224,0.12), inset 0 1px 0 rgba(255,255,255,0.14)",
  fontFamily: UI_FONT,
};

const primaryButtonDisabled: React.CSSProperties = {
  opacity: 0.7,
  cursor: "default",
};

const footnote: React.CSSProperties = {
  marginTop: 2,
  fontSize: 12.5,
  lineHeight: 1.6,
  color: "#6B7688",
  fontWeight: 400,
};

const ghostWideButton: React.CSSProperties = {
  width: "100%",
  height: 42,
  marginTop: 4,
  padding: "0 16px",
  borderRadius: 14,
  border: "1px solid #C8D4E3",
  background: "#fff",
  color: "#243041",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: UI_FONT,
};

const mentionBox: React.CSSProperties = {
  marginBottom: 14,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #D9E2EC",
  background: "#F8FAFC",
  display: "grid",
  gap: 10,
};

const mentionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#1C2434",
};

const mentionHelp: React.CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.5,
  color: "#6B7688",
};

const mentionRequired: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #D9E2EC",
  background: "#FFFFFF",
  fontSize: 12.5,
  lineHeight: 1.5,
  color: "#1C2434",
};

const mentionTextarea: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 92,
  padding: 10,
  borderRadius: 10,
  border: "1px solid #AEBACC",
  fontFamily: UI_FONT,
  fontSize: 13,
  lineHeight: 1.45,
  resize: "vertical",
};
