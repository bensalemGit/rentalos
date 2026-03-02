// app/leases/[leaseId]/guarantor-act/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiFetch, API_BASE, apiFetchBlob } from "@app/_lib/api";
import type {
  GuarantorActCandidate,
  GuarantorActCandidatesResponse,
  GenerateDocResponse,
  GeneratedDocument,
} from "@app/_lib/documents.types";

type Props = {
  params: { leaseId: string };
};

export default function GuarantorActPage({ params }: Props) {
  const leaseId = params.leaseId;

  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<GuarantorActCandidate[]>([]);
  const [error, setError] = useState<string>("");

  const [creatingFor, setCreatingFor] = useState<string>(""); // leaseTenantId
  const [createdDocs, setCreatedDocs] = useState<Record<string, GeneratedDocument>>({});
  const [createError, setCreateError] = useState<string>("");


  async function loadCandidates() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<GuarantorActCandidatesResponse>(
        `/documents/guarantor-act/candidates?leaseId=${encodeURIComponent(leaseId)}`,
        { method: "GET" }
      );

      setCandidates(Array.isArray(data?.candidates) ? data.candidates : []);
    } catch (e: any) {
      setError(e?.message || "Erreur chargement candidats");
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaseId]);

  const hasMany = candidates.length > 1;

  async function generateAct(leaseTenantId: string) {
    setCreatingFor(leaseTenantId);
    setCreateError("");
    try {
      const body = { leaseId, leaseTenantId };
      const res = await apiFetch<GenerateDocResponse>(`/documents/guarantor-act`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setCreatedDocs((prev) => ({
        ...prev,
        [leaseTenantId]: res.document,
      }));
    } catch (e: any) {
      setCreateError(e?.message || "Erreur génération acte");
    } finally {
      setCreatingFor("");
    }
  }

  async function downloadPdf(doc: GeneratedDocument) {
  try {
    const blob = await apiFetchBlob(`/documents/${doc.id}/download`, { method: "GET" });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.filename || "document.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e: any) {
    alert(e?.message || "Erreur téléchargement PDF");
  }
}

  // Si tu as déjà une route de download documents côté API:
  // GET /api/documents/:id/download
  // Alors on peut faire un lien direct:
  const downloadUrlOf = (docId: string) => `${API_BASE}/documents/${docId}/download`;

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Acte de cautionnement
      </h1>
      <div style={{ color: "#555", marginBottom: 16 }}>
        Bail: <code>{leaseId}</code>
      </div>

      {loading ? (
        <div>Chargement…</div>
      ) : error ? (
        <div style={{ color: "#b00020" }}>
          {error}{" "}
          <button onClick={loadCandidates} style={btn()}>
            Réessayer
          </button>
        </div>
      ) : candidates.length === 0 ? (
        <div style={box()}>
          Aucun garant “CAUTION” sélectionné sur ce bail.
        </div>
      ) : (
        <div style={box()}>
          <div style={{ marginBottom: 10, fontWeight: 700 }}>
            {hasMany ? "Choisir le locataire concerné" : "Candidat détecté"}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {candidates.map((c) => {
              const doc = createdDocs[c.leaseTenantId];
              const busy = creatingFor === c.leaseTenantId;

              return (
                <div key={c.guaranteeId} style={card()}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>
                        {c.tenantFullName}{" "}
                        <span style={{ color: "#666", fontWeight: 400 }}>
                          ({c.role})
                        </span>
                      </div>
                      <div style={{ color: "#666", fontSize: 13 }}>
                        {c.tenantEmail || "—"}
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 700 }}>Garant</div>
                        <div style={{ color: "#333" }}>{c.guarantorFullName}</div>
                        <div style={{ color: "#666", fontSize: 13 }}>
                          {c.guarantorEmail || "—"}{" "}
                          {c.guarantorPhone ? `• ${c.guarantorPhone}` : ""}
                        </div>
                      </div>

                      <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
                        leaseTenantId: <code>{c.leaseTenantId}</code>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 180 }}>
                      <button
                        onClick={() => generateAct(c.leaseTenantId)}
                        disabled={busy}
                        style={btn(busy)}
                      >
                        {busy ? "Génération…" : doc ? "Régénérer / Recréer" : "Générer l’acte"}
                      </button>

                      {doc ? (
                        <>
                          <div style={{ color: "#0a7", fontSize: 13 }}>
                            {`OK: ${doc.filename}`}
                          </div>
                          <button
                            onClick={() => downloadPdf(doc)}
                            style={linkBtn()}
                          >
                            Télécharger PDF
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {createError ? (
            <div style={{ marginTop: 12, color: "#b00020" }}>{createError}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function box(): React.CSSProperties {
  return { border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 };
}
function card(): React.CSSProperties {
  return {
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 12,
    background: "#fff",
  };
}
function btn(disabled?: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #111",
    background: disabled ? "#ddd" : "#111",
    color: disabled ? "#666" : "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 700,
  };
}
function linkBtn(): React.CSSProperties {
  return {
    display: "inline-block",
    textAlign: "center",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#fff",
    color: "#111",
    textDecoration: "none",
    fontWeight: 700,
  };
}