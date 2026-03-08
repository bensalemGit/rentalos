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
        <h3 style={title}>Session de signature</h3>
        <p style={muted}>
          Sélectionnez un signataire à gauche pour démarrer une signature.
        </p>
      </div>
    );
  }

  return (
    <div style={panel}>
      <h3 style={title}>Session de signature</h3>

      <div style={{ marginBottom: 12 }}>
        <div style={label}>Signataire</div>
        <div style={value}>{task.displayName}</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={label}>Document</div>
        <div style={value}>{task.documentLabel}</div>
      </div>

      <div style={canvas}>
        Zone de signature
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button style={btnSecondary} onClick={onClose}>
          Effacer
        </button>

        <button style={btnPrimary}>
          Confirmer signature
        </button>
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  border: "1px solid #E2E8F0",
  borderRadius: 14,
  padding: 16,
  background: "#fff",
};

const title = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 14,
};

const label = {
  fontSize: 12,
  color: "#64748B",
};

const value = {
  fontSize: 14,
  fontWeight: 600,
};

const muted = {
  fontSize: 13,
  color: "#64748B",
};

const canvas = {
  height: 120,
  border: "1px dashed #CBD5E1",
  borderRadius: 10,
  marginBottom: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  color: "#64748B",
};

const btnPrimary: React.CSSProperties = {
  background: "#2563EB",
  color: "white",
  border: "none",
  borderRadius: 8,
  padding: "8px 12px",
  fontWeight: 600,
};

const btnSecondary: React.CSSProperties = {
  background: "#F1F5F9",
  border: "1px solid #E2E8F0",
  borderRadius: 8,
  padding: "8px 12px",
};