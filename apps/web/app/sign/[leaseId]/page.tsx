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

type LeaseTenant = {
  tenant_id?: string; // some endpoints may return tenant_id
  id?: string; // or id
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  role?: "principal" | "cotenant" | string;
};

export default function SignPage({ params }: { params: { leaseId: string } }) {
  const leaseId = params.leaseId;

  const [token, setToken] = useState("");

  const [docs, setDocs] = useState<Doc[]>([]);
  const [contractDoc, setContractDoc] = useState<Doc | null>(null);
  const [finalSignedDoc, setFinalSignedDoc] = useState<Doc | null>(null);

  // notice + pack
  const [noticeDoc, setNoticeDoc] = useState<Doc | null>(null);
  const [packDoc, setPackDoc] = useState<Doc | null>(null);

  // lease kind
  const [leaseKind, setLeaseKind] = useState("");

  // ✅ NEW: tenants list for multi-tenant signature
  const [tenants, setTenants] = useState<LeaseTenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [tenantName, setTenantName] = useState("Locataire");
  const [landlordName, setLandlordName] = useState("Bailleur");

  // confirmations
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

  function normalizeTenantId(t: LeaseTenant): string {
    return String(t.tenant_id || t.id || "").trim();
  }

  function normalizeTenantName(t: LeaseTenant): string {
    return String(t.full_name || "").trim() || "Locataire";
  }

  async function loadLeaseBundle() {
    try {
      const r = await fetch(`${API}/leases/${leaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return;

      // leases/:id => { lease, tenants, amounts } (expected)
      const l = j?.lease || j;
      setLeaseKind(String(l?.kind || ""));

      const tArr: LeaseTenant[] = Array.isArray(j?.tenants) ? j.tenants : [];
      setTenants(tArr);

      // default selection = principal tenant if exists, otherwise first
      const principal =
        tArr.find((x) => String(x.role || "").toLowerCase() === "principal") ||
        tArr[0];
      const principalId = principal ? normalizeTenantId(principal) : "";
      if (principalId) setSelectedTenantId(principalId);

      // default tenantName from selected
      const principalName = principal ? normalizeTenantName(principal) : "Locataire";
      setTenantName(principalName);
    } catch {
      // ignore
    }
  }

  async function loadDocs() {
    setError("");
    setStatus("Chargement…");
    try {
      // load lease bundle (kind + tenants)
      await loadLeaseBundle();

      const r = await fetch(`${API}/documents?leaseId=${leaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json();
      const arr: Doc[] = Array.isArray(j) ? j : [];
      setDocs(arr);

      const contract =
        arr
          .filter((d: any) => d.type === "CONTRAT" && !d.parent_document_id)
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] ||
        null;
      setContractDoc(contract);

      const signed =
        arr
          .filter((d: any) => (d.filename || "").includes("SIGNED_FINAL"))
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] ||
        null;
      setFinalSignedDoc(signed);

      const notice =
        arr
          .filter((d: any) => d.type === "NOTICE")
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] ||
        null;
      setNoticeDoc(notice);

      const pack =
        arr
          .filter((d: any) => d.type === "PACK")
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] ||
        null;
      setPackDoc(pack);

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

  const hasFinal = useMemo(() => !!finalSignedDoc?.id, [finalSignedDoc]);

  const isRP = useMemo(() => {
    const k = String(leaseKind || "").toUpperCase();
    return k === "MEUBLE_RP" || k === "NU_RP";
  }, [leaseKind]);

  const hasMultipleTenants = useMemo(() => (tenants?.length || 0) > 1, [tenants]);

  const selectedTenant = useMemo(() => {
    const id = String(selectedTenantId || "").trim();
    if (!id) return null;
    return tenants.find((t) => normalizeTenantId(t) === id) || null;
  }, [tenants, selectedTenantId]);

  // keep tenantName synced when selection changes (unless user edits manually afterwards)
  useEffect(() => {
    if (selectedTenant) setTenantName(normalizeTenantName(selectedTenant));
  }, [selectedTenantId]);

  async function sign(role: "LOCATAIRE" | "BAILLEUR") {
    if (!contractDoc?.id) {
      setError("Aucun contrat. Génère d’abord le contrat.");
      return;
    }
    setError("");
    setStatus(role === "LOCATAIRE" ? "Signature locataire…" : "Signature bailleur…");

    const signerName = role === "LOCATAIRE" ? tenantName : landlordName;
    const signatureDataUrl =
      role === "LOCATAIRE" ? dataUrl(tenantCanvasRef.current) : dataUrl(landlordCanvasRef.current);

    if (!signatureDataUrl) {
      setStatus("");
      setError("Signature vide.");
      return;
    }

    // ✅ NEW: signerTenantId required when multiple tenants
    let signerTenantId: string | undefined = undefined;
    if (role === "LOCATAIRE") {
      if (hasMultipleTenants) {
        signerTenantId = String(selectedTenantId || "").trim();
        if (!signerTenantId) {
          setStatus("");
          setError("Sélectionne le locataire signataire (multi-locataires).");
          return;
        }
      } else {
        // single tenant: try infer from lease bundle
        const only = tenants?.[0];
        const id = only ? normalizeTenantId(only) : "";
        if (id) signerTenantId = id;
      }
    }

    try {
      const payload: any = { signerName, signerRole: role, signatureDataUrl };
      if (role === "LOCATAIRE" && signerTenantId) payload.signerTenantId = signerTenantId;

      const r = await fetch(`${API}/documents/${contractDoc.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify(payload),
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
      try {
        await navigator.clipboard.writeText(j.publicUrl);
      } catch {}
      alert(`Email envoyé à ${j.sentTo}\nLien (copié):\n${j.publicUrl}`);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  return (
    <div style={{ padding: 18, maxWidth: 980, margin: "0 auto", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Contrat & signatures</h1>
          <div style={{ color: muted, marginTop: 6, fontSize: 13 }}>
            Bail {leaseId.slice(0, 8)}… • Contrat: {contractDoc?.id ? "OK" : "—"} • Notice:{" "}
            {noticeDoc?.id ? "OK" : isRP ? "—" : "n/a"} • Pack: {packDoc?.id ? "OK" : "—"} • PDF final:{" "}
            {hasFinal ? "OK" : "—"}
          </div>
        </div>

        <button onClick={loadDocs} style={btnSecondary(border)}>
          Rafraîchir
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button onClick={generateContract} style={btnAction(border)}>
          Générer contrat
        </button>

        <button
          onClick={() => contractDoc?.id && downloadDoc(contractDoc.id, contractDoc.filename)}
          style={btnAction(border)}
          disabled={!contractDoc?.id}
        >
          Télécharger contrat
        </button>

        {isRP && (
          <>
            <button onClick={generateNotice} style={btnAction(border)}>
              Générer notice
            </button>
            <button
              onClick={() => noticeDoc?.id && downloadDoc(noticeDoc.id, noticeDoc.filename)}
              style={btnAction(border)}
              disabled={!noticeDoc?.id}
            >
              Télécharger notice
            </button>
          </>
        )}

        <button onClick={generatePack} style={btnAction(border)}>
          Générer pack
        </button>
        <button
          onClick={() => packDoc?.id && downloadDoc(packDoc.id, packDoc.filename)}
          style={btnAction(border)}
          disabled={!packDoc?.id}
        >
          Télécharger pack
        </button>

        <button onClick={sendPublicLink} style={btnAction(border)}>
          Envoyer lien locataire
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <div style={chip(border, tenantSigned ? green : muted)}>
          {tenantSigned ? "✅ Locataire signé" : "⏳ Locataire à signer"}
        </div>
        <div style={chip(border, landlordSigned ? green : muted)}>
          {landlordSigned ? "✅ Bailleur signé" : "⏳ Bailleur à signer"}
        </div>
        {hasFinal && <div style={chip(border, green)}>✅ PDF final disponible</div>}
      </div>

      {status && (
        <div style={{ ...card(border), background: "rgba(31,111,235,0.05)", borderColor: "rgba(31,111,235,0.25)" }}>
          <b>{status}</b>
        </div>
      )}
      {error && (
        <div style={{ ...card(border), background: "rgba(220,38,38,0.05)", borderColor: "rgba(220,38,38,0.25)" }}>
          <b style={{ color: "#b91c1c" }}>{error}</b>
        </div>
      )}

      {finalSignedDoc?.id && (
        <div style={card(border)}>
          <h3 style={{ marginTop: 0 }}>PDF signé final</h3>
          <div style={{ color: muted, marginBottom: 10 }}>{finalSignedDoc.filename}</div>
          <button onClick={() => downloadDoc(finalSignedDoc.id, finalSignedDoc.filename)} style={btnPrimarySmall(blue)}>
            Télécharger PDF signé
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        <div style={card(border)}>
          <h2 style={{ marginTop: 0 }}>Signature locataire</h2>

          {hasMultipleTenants && (
            <div style={{ marginBottom: 10, display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: muted, fontWeight: 700 }}>Locataire signataire (obligatoire)</div>
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                style={{ ...inputStyle(border), cursor: "pointer" }}
              >
                <option value="">— Sélectionner —</option>
                {tenants.map((t) => {
                  const id = normalizeTenantId(t);
                  const label = `${normalizeTenantName(t)}${t.role ? ` (${t.role})` : ""}`;
                  return (
                    <option key={id || label} value={id}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <div style={{ fontSize: 12, color: muted }}>
                L’API a besoin de l’UUID du locataire pour gérer la signature multi-locataires.
              </div>
            </div>
          )}

          <div style={labelStyle(muted)}>
            <div>Nom signataire</div>
            <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} style={inputStyle(border)} />
          </div>

          <div style={{ marginTop: 10 }}>
            <canvas
              ref={tenantCanvasRef}
              style={{ width: "100%", border: `1px solid ${border}`, borderRadius: 12, touchAction: "none" }}
              onMouseDown={startTenant}
              onMouseMove={moveTenant}
              onMouseUp={endTenant}
              onMouseLeave={endTenant}
              onTouchStart={startTenant}
              onTouchMove={moveTenant}
              onTouchEnd={endTenant}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={() => clearCanvas(tenantCanvasRef.current)} style={btnAction(border)}>
              Effacer
            </button>
            <button onClick={() => sign("LOCATAIRE")} style={btnPrimarySmall(blue)}>
              Signer
            </button>
          </div>
        </div>

        <div style={card(border)}>
          <h2 style={{ marginTop: 0 }}>Signature bailleur</h2>

          <div style={labelStyle(muted)}>
            <div>Nom signataire</div>
            <input value={landlordName} onChange={(e) => setLandlordName(e.target.value)} style={inputStyle(border)} />
          </div>

          <div style={{ marginTop: 10 }}>
            <canvas
              ref={landlordCanvasRef}
              style={{ width: "100%", border: `1px solid ${border}`, borderRadius: 12, touchAction: "none" }}
              onMouseDown={startLandlord}
              onMouseMove={moveLandlord}
              onMouseUp={endLandlord}
              onMouseLeave={endLandlord}
              onTouchStart={startLandlord}
              onTouchMove={moveLandlord}
              onTouchEnd={endLandlord}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={() => clearCanvas(landlordCanvasRef.current)} style={btnAction(border)}>
              Effacer
            </button>
            <button onClick={() => sign("BAILLEUR")} style={btnPrimarySmall(blue)}>
              Signer
            </button>
          </div>
        </div>
      </div>

      <div>
        <Link href="/dashboard/leases" style={{ color: blue, fontWeight: 800 }}>
          Retour aux baux
        </Link>
      </div>
    </div>
  );
}

function card(border: string) {
  return {
    border: `1px solid ${border}`,
    borderRadius: 16,
    background: "#fff",
    padding: 14,
    minWidth: 0,
  } as const;
}

function labelStyle(muted: string) {
  return { display: "grid", gap: 6, fontSize: 12, color: muted, minWidth: 0 } as const;
}

function inputStyle(border: string) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  } as const;
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
