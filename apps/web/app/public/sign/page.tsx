"use client";

import { useMemo, useRef, useState } from "react";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

export default function PublicSignPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token || "";

  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [signerName, setSignerName] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<boolean>(false);

  const contractUrl = useMemo(() => {
    if (!token) return "";
    return `${API}/public/contract?token=${encodeURIComponent(token)}`;
  }, [token]);

  function clearCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
  }

  function getSignatureDataUrl(): string | null {
    const c = canvasRef.current;
    if (!c) return null;
    // tiny check: if blank, refuse
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const img = ctx.getImageData(0, 0, c.width, c.height).data;
    let nonEmpty = false;
    for (let i = 3; i < img.length; i += 4) {
      if (img[i] !== 0) {
        nonEmpty = true;
        break;
      }
    }
    if (!nonEmpty) return null;

    return c.toDataURL("image/png");
  }

  async function submitSignature() {
    setError("");
    setStatus("");

    if (!token) {
      setError("Lien invalide : token manquant.");
      return;
    }
    if (!signerName.trim()) {
      setError("Nom requis.");
      return;
    }

    const signatureDataUrl = getSignatureDataUrl();
    if (!signatureDataUrl) {
      setError("Signature requise (dessine dans la zone).");
      return;
    }

    setStatus("Envoi de la signature…");

    try {
      const r = await fetch(
        `${API}/public/sign?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ signerName: signerName.trim(), signatureDataUrl }),
        }
      );

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }

      setError("");
      setStatus("Signature enregistrée ✅ Vous pouvez fermer cette page.");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    drawingRef.current = true;
    c.setPointerCapture(e.pointerId);

    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    const c = canvasRef.current;
    if (!c) return;
    try {
      c.releasePointerCapture(e.pointerId);
    } catch {}
  }

  return (
    <main style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Signature du contrat</h1>

      {!token && (
        <div style={{ color: "crimson" }}>
          Lien invalide : token manquant dans l’URL.
        </div>
      )}

      {status && <p style={{ marginTop: 10, color: "#0a6" }}>{status}</p>}
      {error && <p style={{ marginTop: 10, color: "crimson" }}>{error}</p>}

      <section style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff", padding: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>1) Télécharger / lire le contrat</div>
        {contractUrl ? (
          <a href={contractUrl} target="_blank" rel="noreferrer">
            Ouvrir le PDF
          </a>
        ) : (
          <span>—</span>
        )}
      </section>

      <section style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff", padding: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>2) Signer</div>

        <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#6b7280" }}>
          Nom / Prénom
          <input
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb" }}
            placeholder="Ex: Jean Dupont"
          />
        </label>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
            Signature (dessine au doigt / souris)
          </div>

          <canvas
            ref={canvasRef}
            width={700}
            height={220}
            style={{
              width: "100%",
              maxWidth: 800,
              height: 220,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              touchAction: "none",
              background: "#fff",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button
              onClick={clearCanvas}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Effacer
            </button>

            <button
              onClick={submitSignature}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(31,111,235,0.35)",
                background: "rgba(31,111,235,0.10)",
                color: "#0b2a6f",
                fontWeight: 900,
                cursor: "pointer",
              }}
              disabled={!token}
            >
              Signer et valider
            </button>
          </div>
        </div>
      </section>

      <div style={{ marginTop: 14, color: "#6b7280", fontSize: 12 }}>
        Si le lien est expiré / déjà utilisé, demande un nouveau lien au bailleur.
      </div>
    </main>
  );
}
