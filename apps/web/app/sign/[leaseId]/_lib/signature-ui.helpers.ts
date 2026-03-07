import type { CSSProperties } from "react";
import type { SignatureUiTone } from "./signature-status.helpers";

export function taskBadgeStyle(tone: SignatureUiTone): CSSProperties {
  if (tone === "success") {
    return {
      background: "rgba(34,197,94,0.08)",
      color: "#1f7a57",
      border: "1px solid transparent",
    };
  }

  if (tone === "warning") {
    return {
      background: "rgba(245,158,11,0.10)",
      color: "#b45309",
      border: "1px solid rgba(245,158,11,0.22)",
    };
  }

  if (tone === "primary") {
    return {
      background: "rgba(47,95,184,0.09)",
      color: "#2F5FB8",
      border: "1px solid transparent",
    };
  }

  if (tone === "danger") {
    return {
      background: "rgba(239,68,68,0.08)",
      color: "#b42318",
      border: "1px solid transparent",
    };
  }

  return {
    background: "rgba(100,116,139,0.08)",
    color: "#667085",
    border: "1px solid transparent",
  };
}