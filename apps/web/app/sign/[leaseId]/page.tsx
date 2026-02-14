"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type Doc = {
  id: string;
  type: string;
  filename: string;
  created_at: string;
  parent_document_id?: string | null;
};

export default function SignPage({ params }: { params: { leaseId: string } }) {
  const leaseId = params.leaseId;

  const [token, setToken] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [contractDoc, setContractDoc] = useState<Doc | null>(null);
  const [finalSignedDoc, setFinalSignedDoc] = useState<Doc | null>(null);

  // ✅ NEW: notice + pack docs
  const [noticeDoc, setNoticeDoc] = useState<Doc | null>(null);
  const [packDoc, setPackDoc] = useState<Doc | null>(null);

  // ✅ NEW: lease kind to decide if notice is relevant
  const [leaseKind, setLeaseKind] = useState<string>("");

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [tenantName, setTenantName] = useState("Locataire");
  const [landlordName, setLandlordName] = useState("Bailleur");

  // ✅ confirmations
  const [tenantSigned, setTenantSigned] = useState(false);
  const [landlordSigned, setLandlordSigned] = useState(false);

  const tenantCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const landlordCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingTenant = useRef(false);
  const drawingLandlord = useRef(false);

  const blue = "#1f6feb";
  const border = "#e5e7eb";
  const muted = "#6b7280";
  const green = "#16a34a";

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  function setupCanvas(c: HTMLCanvasElement) {
    const w = Math.min(520, window.innerWidth - 48);
    c.width = w;
    c.height = 160;
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
  }

  useEffect(() => {
    if (tenantCanvasRef.current) setupCanvas(tenantCanvasRef.current);
    if (landlordCanvasRef.current) setupCanvas(landlordCanvasRef.current);
  }, [tenantCanvasRef.current, landlordCanvasRef.current]);

  async function loadLeaseKind() {
    try {
      const r = await fetch(`${API}/leases/${leaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return;

      // leases/:id => { lease, tenants, amounts }
      const l = j?.lease || j;
      setLeaseKind(String(l?.kind || ""));
    } catch {
      // ignore
    }
  }

  async function loadDocs() {
    setError("");
    setStatus("Chargement…");
    try {
      // load lease kind (to show/hide notice)
      await loadLeaseKind();

      const r = await fetch(`${API}/documents?leaseId=${leaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json();
      const arr = Array.isArray(j) ? j : [];
      setDocs(arr);

      const contract =
        arr
          .filter((d: any) => d.type === "CONTRAT" && !d.parent_document_id)
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
      setContractDoc(contract);

      const signed =
        arr
          .filter((d: any) => (d.filename || "").includes("SIGNED_FINAL"))
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
      setFinalSignedDoc(signed);

      // ✅ NEW: latest notice + pack
      const notice =
        arr
          .filter((d: any) => d.type === "NOTICE")
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
      setNoticeDoc(notice);

      const pack =
        arr
          .filter((d: any) => d.type === "PACK")
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
      setPackDoc(pack);

      // ✅ if final exists => both signed
      if (signed?.id) {
        setTenantSigned(true);
        setLandlordSigned(true);
      }

      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    if (token) loadDocs();
  }, [token]);

  async function generateContract() {
    setError("");
    setStatus("Génération du contrat…");
    try {
      const r = await fetch(`${API}/documents/contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Contrat généré ✅");
      await loadDocs();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  // ✅ NEW: generate notice (RP only)
  async function generateNotice() {
    setError("");
    setStatus("Génération de la notice…");
    try {
      const r = await fetch(`${API}/documents/notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Notice générée ✅");
      await loadDocs();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  // ✅ NEW: generate pack
  async function generatePack() {
    setError("");
    setStatus("Génération du pack PDF…");
    try {
      const r = await fetch(`${API}/documents/pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Pack généré ✅");
      await loadDocs();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function downloadDoc(documentId: string, filename?: string) {
    setError("");
    setStatus("Téléchargement…");
    const r = await fetch(`${API}/documents/${documentId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (!r.ok) {
      const t = await r.text();
      setStatus("");
      setError("Erreur téléchargement: " + t);
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);

    window.open(url, "_blank", "noopener,noreferrer");

    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `document_${documentId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setStatus("Téléchargé ✅");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  function clearCanvas(c: HTMLCanvasElement | null) {
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
  }

  function dataUrl(c: HTMLCanvasElement | null) {
    if (!c) return "";
    return c.toDataURL("image/png");
  }

  function pos(e: any, c: HTMLCanvasElement) {
    const rect = c.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
  }

  function startTenant(e: any) {
    const c = tenantCanvasRef.current!;
    drawingTenant.current = true;
    const ctx = c.getContext("2d")!;
    const p = pos(e, c);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function moveTenant(e: any) {
    if (!drawingTenant.current) return;
    const c = tenantCanvasRef.current!;
    const ctx = c.getContext("2d")!;
    const p = pos(e, c);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function endTenant() {
    drawingTenant.current = false;
  }

  function startLandlord(e: any) {
    const c = landlordCanvasRef.current!;
    drawingLandlord.current = true;
    const ctx = c.getContext("2d")!;
    const p = pos(e, c);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function moveLandlord(e: any) {
    if (!drawingLandlord.current) return;
    const c = landlordCanvasRef.current!;
    const ctx = c.getContext("2d")!;
    const p = pos(e, c);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function endLandlord() {
    drawingLandlord.current = false;
  }

  async function sign(role: "LOCATAIRE" | "BAILLEUR") {
    if (!contractDoc?.id) {
      setError("Aucun contrat. Génère d’abord le contrat.");
      return;
    }

    setError("");
    setStatus(role === "LOCATAIRE" ? "Signature locataire…" : "Signature bailleur…");

    const signerName = role === "LOCATAIRE" ? tenantName : landlordName;
    const signatureDataUrl = role === "LOCATAIRE"
      ? dataUrl(tenantCanvasRef.current)
      : dataUrl(landlordCanvasRef.current);

    if (!signatureDataUrl) {
      setStatus("");
      setError("Signature vide.");
      return;
    }

    try {
      const r = await fetch(`${API}/documents/${contractDoc.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ signerName, signerRole: role, signatureDataUrl }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }

      if (role === "LOCATAIRE") {
        clearCanvas(tenantCanvasRef.current);
        setTenantSigned(true);
        setStatus("✅ Signature locataire enregistrée");
      } else {
        clearCanvas(landlordCanvasRef.current);
        setLandlordSigned(true);
        setStatus("✅ Signature bailleur enregistrée");
      }

      await loadDocs();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function sendPublicLink() {
    setError("");
    setStatus("Envoi du lien locataire…");
    try {
      const r = await fetch(`${API}/public-links/tenant-sign/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId, ttlHours: 48 }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus(`✅ Email envoyé à ${j.sentTo} (lien copié)`);
      try { await navigator.clipboard.writeText(j.publicUrl); } catch {}
      alert(`Email envoyé à ${j.sentTo}\nLien (copié):\n${j.publicUrl}`);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  const hasFinal = useMemo(() => !!finalSignedDoc?.id, [finalSignedDoc]);

  const isRP = useMemo(() => {
    const k = String(leaseKind || "").toUpperCase();
    return k === "MEUBLE_RP" || k === "NU_RP";
  }, [leaseKind]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Contrat & signatures</h1>
          <div style={{ color: muted }}>
            Bail {leaseId.slice(0, 8)}… • Contrat: {contractDoc?.id ? "OK" : "—"} • Notice: {noticeDoc?.id ? "OK" : (isRP ? "—" : "n/a")} • Pack: {packDoc?.id ? "OK" : "—"} • PDF final: {hasFinal ? "OK" : "—"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={loadDocs} style={btnSecondary(border)}>Rafraîchir</button>

          <button onClick={generateContract} style={btnPrimarySmall(blue)}>Générer contrat</button>
          <button
            onClick={() => contractDoc?.id && downloadDoc(contractDoc.id, contractDoc.filename)}
            style={btnAction(border)}
            disabled={!contractDoc?.id}
          >
            Télécharger contrat
          </button>

          {isRP && (
            <>
              <button onClick={generateNotice} style={btnSecondary(border)}>Générer notice</button>
              <button
                onClick={() => noticeDoc?.id && downloadDoc(noticeDoc.id, noticeDoc.filename)}
                style={btnAction(border)}
                disabled={!noticeDoc?.id}
              >
                Télécharger notice
              </button>
            </>
          )}

          <button onClick={generatePack} style={btnPrimarySmall(blue)}>Générer pack</button>
          <button
            onClick={() => packDoc?.id && downloadDoc(packDoc.id, packDoc.filename)}
            style={btnAction(border)}
            disabled={!packDoc?.id}
          >
            Télécharger pack
          </button>

          <button onClick={sendPublicLink} style={btnPrimarySmall(blue)}>Envoyer lien locataire</button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={chip(border, tenantSigned ? green : muted)}>
          {tenantSigned ? "✅ Locataire signé" : "⏳ Locataire à signer"}
        </span>
        <span style={chip(border, landlordSigned ? green : muted)}>
          {landlordSigned ? "✅ Bailleur signé" : "⏳ Bailleur à signer"}
        </span>
        {hasFinal && (
          <span style={chip(border, green)}>✅ PDF final disponible</span>
        )}
      </div>

      {status && <p style={{ marginTop: 10, color: "#0a6" }}>{status}</p>}
      {error && <p style={{ marginTop: 10, color: "crimson" }}>{error}</p>}

      {finalSignedDoc?.id && (
        <section style={{ marginTop: 14, border: `1px solid rgba(22,163,74,0.35)`, borderRadius: 16, background: "rgba(22,163,74,0.06)", padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900 }}>PDF signé final</div>
              <div style={{ color: muted, fontSize: 12, wordBreak: "break-word" }}>{finalSignedDoc.filename}</div>
            </div>
            <button onClick={() => downloadDoc(finalSignedDoc.id, finalSignedDoc.filename)} style={btnPrimarySmall(blue)}>
              Télécharger PDF signé
            </button>
          </div>
        </section>
      )}

      <div style={{ marginTop: 14, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <section style={card(border)}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Signature locataire</h2>

          <label style={labelStyle(muted)}>
            Nom signataire<br />
            <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} style={inputStyle(border)} />
          </label>

          <div style={{ marginTop: 10 }}>
            <canvas
              ref={tenantCanvasRef}
              style={{ border: `1px solid ${border}`, borderRadius: 12, touchAction: "none", width: "100%", display: "block" }}
              onMouseDown={startTenant}
              onMouseMove={moveTenant}
              onMouseUp={endTenant}
              onMouseLeave={endTenant}
              onTouchStart={startTenant}
              onTouchMove={moveTenant}
              onTouchEnd={endTenant}
            />
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => clearCanvas(tenantCanvasRef.current)} style={btnAction(border)}>Effacer</button>
            <button onClick={() => sign("LOCATAIRE")} style={btnPrimarySmall(blue)}>Signer</button>
          </div>
        </section>

        <section style={card(border)}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Signature bailleur</h2>

          <label style={labelStyle(muted)}>
            Nom signataire<br />
            <input value={landlordName} onChange={(e) => setLandlordName(e.target.value)} style={inputStyle(border)} />
          </label>

          <div style={{ marginTop: 10 }}>
            <canvas
              ref={landlordCanvasRef}
              style={{ border: `1px solid ${border}`, borderRadius: 12, touchAction: "none", width: "100%", display: "block" }}
              onMouseDown={startLandlord}
              onMouseMove={moveLandlord}
              onMouseUp={endLandlord}
              onMouseLeave={endLandlord}
              onTouchStart={startLandlord}
              onTouchMove={moveLandlord}
              onTouchEnd={endLandlord}
            />
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => clearCanvas(landlordCanvasRef.current)} style={btnAction(border)}>Effacer</button>
            <button onClick={() => sign("BAILLEUR")} style={btnPrimarySmall(blue)}>Signer</button>
          </div>
        </section>
      </div>

      <div style={{ marginTop: 14 }}>
        <Link href="/dashboard/leases"><button style={btnSecondary(border)}>Retour aux baux</button></Link>
      </div>
    </main>
  );
}

function card(border: string) {
  return { border: `1px solid ${border}`, borderRadius: 16, background: "#fff", padding: 14, minWidth: 0 } as const;
}
function labelStyle(muted: string) {
  return { display: "grid", gap: 6, fontSize: 12, color: muted, minWidth: 0 } as const;
}
function inputStyle(border: string) {
  return { padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, width: "100%", minWidth: 0, boxSizing: "border-box" } as const;
}
function btnPrimarySmall(blue: string) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid rgba(31,111,235,0.35)`,
    background: "rgba(31,111,235,0.10)",
    color: "#0b2a6f",
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "center" as const,
  } as const;
}
function btnSecondary(border: string) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  } as const;
}
function btnAction(border: string) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    minWidth: 160,
    textAlign: "center" as const,
  } as const;
}
function chip(border: string, color: string) {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: "#fff",
    color,
    fontWeight: 800,
    fontSize: 12,
  } as const;
}
