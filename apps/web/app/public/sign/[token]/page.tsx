"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

function friendlyMessage(msg: string) {
  const m = (msg || "").toLowerCase();
  if (m.includes("expired")) return "⏰ Ce lien a expiré.";
  if (m.includes("already used")) return "✅ Ce lien a déjà été utilisé (signature déjà effectuée).";
  if (m.includes("already signed")) return "✅ Ce document a déjà été signé.";
  if (m.includes("invalid token")) return "❌ Lien invalide.";
  if (m.includes("unauthorized")) return "❌ Lien invalide ou expiré.";
  return "❌ Lien indisponible.";
}

export default function PublicSignPage({ params }: { params: { token: string } }) {
  const token = params.token;

  // 1️⃣ / 2️⃣ : lire le rôle via query param
  const sp = useSearchParams();
  const roleParam = (sp.get("role") || "").toLowerCase();
  const isLandlord = roleParam === "landlord";
  const signerRole = isLandlord ? "BAILLEUR" : "LOCATAIRE";

  const [info, setInfo] = useState<any>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [signerName, setSignerName] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  function setupCanvas(c: HTMLCanvasElement) {
    const w = Math.min(520, window.innerWidth - 32);
    c.width = w;
    c.height = 160;
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
  }

  useEffect(() => {
    const c = canvasRef.current;
    if (c) setupCanvas(c);
  }, [canvasRef.current]);

  // 4️⃣ loadInfo avec nom par rôle
  async function loadInfo() {
    setError("");
    setStatus("Chargement…");

    try {
      const r = await fetch(`${API}/public/info?token=${encodeURIComponent(token)}`);
      const j = await r.json();

      if (!r.ok) throw new Error(j?.message || "Lien indisponible");

      if (j?.documentId) {
        setInfo(j);
        setSignerName(isLandlord ? "Bailleur" : (j.tenantName || "Locataire"));
        setStatus("");
      } else {
        throw new Error("Lien indisponible");
      }
    } catch (e: any) {
      setInfo(null);
      setStatus("");
      setError(friendlyMessage(String(e?.message || e)));
    }
  }

  useEffect(() => {
    loadInfo();
  }, []);

  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
  }

  function getDataUrl() {
    const c = canvasRef.current;
    if (!c) return "";
    return c.toDataURL("image/png");
  }

  function pos(e: any, c: HTMLCanvasElement) {
    const rect = c.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
  }

  function start(e: any) {
    const c = canvasRef.current!;
    drawing.current = true;
    const ctx = c.getContext("2d")!;
    const p = pos(e, c);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: any) {
    if (!drawing.current) return;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const p = pos(e, c);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function end() {
    drawing.current = false;
  }

  async function download() {
    window.open(`${API}/public/download?token=${encodeURIComponent(token)}`, "_blank", "noopener,noreferrer");
  }

  // 5️⃣ sign avec signerRole envoyé
  async function sign() {
    setStatus("Signature en cours…");
    setError("");

    try {
      const signatureDataUrl = getDataUrl();
      const r = await fetch(`${API}/public/sign?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName, signerRole, signatureDataUrl }),
      });
      const j = await r.json();

      if (!r.ok) throw new Error(j?.message || JSON.stringify(j));

      if (j?.ok) {
        setStatus("✅ Signature enregistrée. Vous pouvez fermer cette page.");
        clear();
      } else {
        throw new Error(JSON.stringify(j));
      }
    } catch (e: any) {
      setStatus("");
      setError(friendlyMessage(String(e?.message || e)));
    }
  }

  return (
    <main style={{ padding: 16, fontFamily: "Arial", maxWidth: 900, margin: "0 auto" }}>
      {/* 3️⃣ titre dynamique */}
      <h1 style={{ marginTop: 0 }}>
        Signature du contrat ({isLandlord ? "Bailleur" : "Locataire"})
      </h1>

      {error && (
        <div style={{ border: "1px solid #f3b", borderRadius: 12, padding: 12, background: "#fff5fb" }}>
          <b>{error}</b>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => window.location.href = "about:blank"}>Fermer cette page</button>
          </div>
        </div>
      )}

      {!info && !error && <p>{status || "…"}</p>}

      {info && (
        <>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <div><b>Logement :</b> {info.unitCode}</div>
            <div><b>Locataire :</b> {info.tenantName}</div>
            <div style={{ color: "#666", fontSize: 12 }}>
              {info.startDate} → {info.endDateTheoretical} • expire le {String(info.expiresAt).slice(0, 19)}
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={download}>Télécharger / Voir le contrat</button>
          </div>

          <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <h2 style={{ marginTop: 0 }}>Signer au doigt</h2>

            <label>
              Nom signataire<br />
              <input value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: "100%" }} />
            </label>

            <div style={{ marginTop: 10 }}>
              <canvas
                ref={canvasRef}
                style={{ border: "1px solid #aaa", borderRadius: 8, touchAction: "none" }}
                onMouseDown={start}
                onMouseMove={move}
                onMouseUp={end}
                onMouseLeave={end}
                onTouchStart={start}
                onTouchMove={move}
                onTouchEnd={end}
              />
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={clear}>Effacer</button>
              <button onClick={sign}>Signer</button>
            </div>

            {status && <p style={{ marginTop: 10 }}>{status}</p>}
          </div>

          <p style={{ marginTop: 12, fontSize: 12, color: "#777" }}>
            Ce lien est personnel et expirera automatiquement.
          </p>

          <Link href="/"><button>Retour</button></Link>
        </>
      )}
    </main>
  );
}