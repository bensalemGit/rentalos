"use client";

import { useState } from "react";
import Link from "next/link";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

function friendlyMessage(msg: string) {
  const m = (msg || "").toLowerCase();
  if (m.includes("expired")) return "⏰ Ce lien a expiré.";
  if (m.includes("invalid token")) return "❌ Lien invalide.";
  if (m.includes("purpose")) return "❌ Lien invalide.";
  if (m.includes("not finalized")) return "⏳ Contrat pas encore finalisé.";
  return "❌ Lien indisponible.";
}

export default function PublicDownloadPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const [error, setError] = useState("");

  function download() {
    setError("");
    const url = `${API}/public/download-final?token=${encodeURIComponent(token)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <main style={{ maxWidth: 720, margin: "24px auto", padding: 16 }}>
      <h1>Téléchargement du contrat signé</h1>

      {error && (
        <div style={{ background: "#ffecec", padding: 12, borderRadius: 8, marginTop: 12 }}>
          <b>{error}</b>
          <div style={{ marginTop: 10 }}>
            <button onClick={() => (window.location.href = "about:blank")}>Fermer cette page</button>
          </div>
        </div>
      )}

      {!error && (
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => {
              try {
                download();
              } catch (e: any) {
                setError(friendlyMessage(String(e?.message || e)));
              }
            }}
          >
            Télécharger le PDF signé
          </button>

          <div style={{ marginTop: 14, opacity: 0.8 }}>
            Ce lien est personnel et expirera automatiquement.
          </div>

          <div style={{ marginTop: 18 }}>
            <Link href="/">Retour</Link>
          </div>
        </div>
      )}
    </main>
  );
}