"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, RefreshCw, Download, RotateCcw, Package } from "lucide-react";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type Doc = {
  id: string;
  type: string;
  filename: string;
  created_at?: string;
  parent_document_id?: string | null;
  signed_final_document_id?: string | null;
};

type Phase = "entry" | "exit";

export default function LeaseDocumentsPage({ params }: { params: { leaseId: string } }) {
  const leaseId = params.leaseId;

  const [token, setToken] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [hasGuarantor, setHasGuarantor] = useState<boolean | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  async function refresh() {
    if (!token) return;
    setError("");
    setStatus("Chargement…");

    try {
            // Info garantie : l'acte de caution est optionnel
      try {
        const leaseRes = await fetch(`${API}/leases/${leaseId}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
          cache: "no-store",
        });

        const lease = await leaseRes.json().catch(() => ({}));

        const guarantees =
          lease?.guarantees ||
          lease?.lease?.guarantees ||
          lease?.data?.guarantees ||
          [];

        setHasGuarantor(
          Array.isArray(guarantees)
            ? guarantees.length > 0
            : Boolean(
                lease?.guarantor_id ||
                  lease?.guarantorId ||
                  lease?.guarantor ||
                  lease?.guarantee_id ||
                  lease?.guaranteeId
              )
        );
      } catch {
        setHasGuarantor(false);
      }

      const r = await fetch(`${API}/documents?leaseId=${leaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        cache: "no-store",
      });

      const j = await r.json().catch(() => []);
      if (!r.ok) throw new Error(j?.message || JSON.stringify(j));

      setDocs(Array.isArray(j) ? j : []);
      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, leaseId]);

  function latest(type: string) {
    return (
      docs
        .filter((d) => d.type === type && !String(d.filename || "").includes("SIGNED_FINAL"))
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0] || null
    );
  }

  const rows = useMemo(
    () => ({
      entry: [
        { label: "Contrat de location", type: "CONTRAT", regen: () => generateContract(true) },
        { label: "Acte de caution", type: "ACTE_CAUTION", regen: undefined },
        { label: "EDL entrée", type: "EDL_ENTREE", regen: () => generateEdl("entry", true) },
        { label: "Inventaire entrée", type: "INVENTAIRE_ENTREE", regen: () => generateInventory("entry", true) },
        { label: "Notice", type: "NOTICE", regen: undefined },
      ],
      exit: [
        { label: "EDL sortie", type: "EDL_SORTIE", regen: () => generateEdl("exit", true) },
        { label: "Inventaire sortie", type: "INVENTAIRE_SORTIE", regen: () => generateInventory("exit", true) },
        { label: "Attestation sortie", type: "ATTESTATION_SORTIE", regen: generateExitCertificate },
      ],
      packs: [
        { label: "Pack entrée", type: "PACK_FINAL", regen: generatePackEntry },
        { label: "Pack sortie", type: "PACK_SORTIE", regen: generateExitPack },
      ],
    }),
    [docs, token]
  );

  async function postJson(path: string, body: any, success: string) {
    setError("");
    setStatus("Génération…");

    try {
      const r = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || JSON.stringify(j));

      setStatus(success);
      await refresh();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  function generateContract(force = true) {
    return postJson(`/documents/contract${force ? "?force=true" : ""}`, { leaseId }, "Contrat régénéré ✅");
  }

  function generateEdl(phase: Phase, force = true) {
    return postJson(`/documents/edl`, { leaseId, phase, force }, `EDL ${phase === "entry" ? "entrée" : "sortie"} régénéré ✅`);
  }

  function generateInventory(phase: Phase, force = true) {
    return postJson(`/documents/inventory`, { leaseId, phase, force }, `Inventaire ${phase === "entry" ? "entrée" : "sortie"} régénéré ✅`);
  }

  function generatePackEntry() {
    return postJson(`/documents/pack-final`, { leaseId }, "Pack entrée généré ✅");
  }

  function generateExitCertificate() {
    return postJson(`/documents/exit-certificate`, { leaseId }, "Attestation sortie générée ✅");
  }

  function generateExitPack() {
    return postJson(`/documents/exit-pack`, { leaseId }, "Pack sortie généré ✅");
  }

  async function downloadDoc(doc: Doc) {
    const r = await fetch(`${API}/documents/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });

    if (!r.ok) {
      setError(await r.text());
      return;
    }

    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  function Section({
    title,
    subtitle,
    items,
  }: {
    title: string;
    subtitle: string;
    items: Array<{ label: string; type: string; regen?: (() => void | Promise<void>) | undefined }>;
  }) {
    return (
      <section style={card}>
        <div style={sectionHead}>
          <div>
            <h2 style={h2}>{title}</h2>
            <p style={muted}>{subtitle}</p>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => {
            const doc = latest(item.type);
            const signedId = doc?.signed_final_document_id;
            const isCaution = item.type === "ACTE_CAUTION";
            const noGuarantor = isCaution && hasGuarantor === false;

            return (
              <div key={item.type} className="document-row" style={row}>
                <div style={{ minWidth: 0, display: "flex", gap: 10, alignItems: "center" }}>
                  <FileText size={17} color="#7C8AA5" />
                  <div style={{ minWidth: 0 }}>
                    <div style={docTitle}>{item.label}</div>
                    <div style={docSub}>
                      {noGuarantor ? "Aucune garantie prévue sur ce bail" : doc ? doc.filename : "Non généré"}
                    </div>
                  </div>
                </div>

                <div className="document-actions" style={actions}>
                  <span style={noGuarantor ? neutralPill : doc ? okPill : emptyPill}>
                    {noGuarantor ? "Aucune garantie" : doc ? "Disponible" : "Manquant"}
                  </span>

                  {doc && (
                    <button style={linkBtn} onClick={() => downloadDoc(doc)}>
                      <Download size={14} /> Télécharger
                    </button>
                  )}

                  {signedId && (
                    <button
                      style={linkBtn}
                      onClick={() =>
                        downloadDoc({
                          ...doc!,
                          id: signedId,
                          filename: `${item.label}_SIGNE.pdf`,
                        })
                      }
                    >
                      <Download size={14} /> Signé
                    </button>
                  )}

                  {item.regen && (
                    <button style={regenBtn} onClick={item.regen}>
                      <RotateCcw size={14} /> Régénérer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <main style={page}>
      <header style={header}>
        <div>
          <div style={eyebrow}>Bibliothèque documentaire</div>
          <h1 style={h1}>Documents du bail</h1>
          <p style={muted}>Bail {leaseId.slice(0, 8)}… · entrée, sortie, packs et documents signés</p>
        </div>

        <div style={topActions}>
          <button onClick={refresh} style={secondaryBtn}>
            <RefreshCw size={15} /> Rafraîchir
          </button>
          <Link href={`/dashboard/leases`}>
            <button style={secondaryBtn}>Retour baux</button>
          </Link>
        </div>
      </header>

      {status && <div style={successBox}>{status}</div>}
      {error && <div style={errorBox}>{error}</div>}

      <div style={grid}>
        <Section
          title="Entrée locataire"
          subtitle="Contrat, caution, EDL entrée, inventaire entrée et notice."
          items={rows.entry}
        />

        <Section
          title="Sortie locataire"
          subtitle="EDL sortie, inventaire sortie, attestation et pack de sortie."
          items={rows.exit}
        />

        <section style={{ ...card, gridColumn: "1 / -1" }}>
          <div style={sectionHead}>
            <div>
              <h2 style={h2}>Packs</h2>
              <p style={muted}>Regroupements documentaires prêts à transmettre ou archiver.</p>
            </div>
            <Package size={20} color="#2F63E0" />
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {rows.packs.map((item) => {
              const doc = latest(item.type);
              return (
                <div key={item.type} className="document-row" style={row}>
                  <div>
                    <div style={docTitle}>{item.label}</div>
                    <div style={docSub}>{doc ? doc.filename : "Non généré"}</div>
                  </div>

                  <div className="document-actions" style={actions}>
                    <span style={doc ? okPill : emptyPill}>{doc ? "Disponible" : "À générer"}</span>
                    {doc && (
                      <button style={linkBtn} onClick={() => downloadDoc(doc)}>
                        <Download size={14} /> Télécharger
                      </button>
                    )}
                    <button style={regenBtn} onClick={item.regen}>
                      <RotateCcw size={14} /> Générer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 760px) {
              .document-row {
                grid-template-columns: 1fr !important;
                align-items: stretch !important;
              }

              .document-actions {
                justify-content: stretch !important;
              }

              .document-actions button,
              .document-actions span {
                flex: 1 1 100%;
                justify-content: center;
              }
            }
          `,
        }}
      />
    </main>
  );
}

const page: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: 20,
  display: "grid",
  gap: 16,
  fontFamily: "Inter, ui-sans-serif, system-ui",
  background: "#F5F7FB",
  minHeight: "100vh",
};

const header: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(27,39,64,0.08)",
  borderRadius: 24,
  padding: 20,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const eyebrow = {
  fontSize: 12,
  fontWeight: 900,
  color: "#2F63E0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
};

const h1 = { margin: "6px 0 4px", fontSize: 28, letterSpacing: "-0.04em", color: "#1F2A3C" };
const h2 = { margin: 0, fontSize: 17, letterSpacing: "-0.02em", color: "#1F2A3C" };
const muted = { margin: 0, color: "#7C8AA5", fontSize: 13.5, lineHeight: 1.5 };

const topActions: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))",
  gap: 16,
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(27,39,64,0.08)",
  borderRadius: 22,
  padding: 16,
  display: "grid",
  gap: 14,
  boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
};

const sectionHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) minmax(260px, auto)",
  gap: 14,
  alignItems: "center",
  border: "1px solid rgba(27,39,64,0.08)",
  borderRadius: 16,
  padding: 12,
  background: "#FBFCFE",
};

const docTitle = { fontWeight: 900, color: "#243247", fontSize: 14 };
const docSub: React.CSSProperties = {
  color: "#7C8AA5",
  fontSize: 12,
  marginTop: 3,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "100%",
};

const actions: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  minWidth: 0,
};

const secondaryBtn: React.CSSProperties = {
  border: "1px solid rgba(27,39,64,0.10)",
  background: "#fff",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 850,
  cursor: "pointer",
  display: "inline-flex",
  gap: 8,
  alignItems: "center",
};

const linkBtn: React.CSSProperties = {
  ...secondaryBtn,
  padding: "8px 10px",
  fontSize: 12,
  color: "#2F63E0",
};

const regenBtn: React.CSSProperties = {
  ...secondaryBtn,
  padding: "8px 10px",
  fontSize: 12,
  background: "#EEF4FF",
  color: "#2F63E0",
};

const okPill: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(22,163,74,0.10)",
  color: "#14532d",
  fontSize: 11,
  fontWeight: 900,
};

const emptyPill: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(245,158,11,0.12)",
  color: "#78350f",
  fontSize: 11,
  fontWeight: 900,
};

const neutralPill: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(100,116,139,0.10)",
  color: "#475569",
  fontSize: 11,
  fontWeight: 900,
};

const successBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: "#F3FAF5",
  color: "#166534",
  fontWeight: 800,
};

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: "rgba(239,68,68,0.06)",
  color: "#b42318",
  fontWeight: 800,
};