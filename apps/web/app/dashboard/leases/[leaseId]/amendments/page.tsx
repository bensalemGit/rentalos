"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSignature,
  Loader2,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type Amendment = {
  id: string;
  lease_id: string;
  type: string;
  status: string;
  effective_date?: string | null;
  title?: string | null;
  summary?: string | null;
  document_id?: string | null;
  signed_final_document_id?: string | null;
  created_at?: string | null;
  generated_at?: string | null;
  signed_at?: string | null;
  applied_at?: string | null;
  document_filename?: string | null;
  signed_final_filename?: string | null;
  signers?: Array<{
    role?: string | null;
    signerName?: string | null;
    signerEmail?: string | null;
    signatureStatus?: string | null;
    signedAt?: string | null;
  }>;
};

export default function AmendmentsPage() {
  const params = useParams();
  const router = useRouter();

  const leaseId = String(params?.leaseId || "");
  const [token, setToken] = useState("");
  const [items, setItems] = useState<Amendment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  useEffect(() => {
    if (!token || !leaseId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, leaseId]);

  async function load() {
    setLoading(true);
    setError("");
    setStatus("");

    try {
      const r = await fetch(`${API}/leases/${leaseId}/amendments`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        cache: "no-store",
      });

      const j = await r.json().catch(() => []);
      if (!r.ok) throw new Error(j?.message || JSON.stringify(j));

      const arr = Array.isArray(j) ? j : Array.isArray(j?.value) ? j.value : [];
      setItems(arr);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function downloadDoc(documentId: string, filename?: string | null) {
    setError("");
    setStatus("Téléchargement…");

    const r = await fetch(`${API}/documents/${documentId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      setStatus("");
      setError(`Erreur téléchargement: ${txt || r.status}`);
      return;
    }

    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename || `document_${documentId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setStatus("Téléchargé ✅");
  }

  async function applyAmendment(amendment: Amendment) {
    const ok = window.confirm("Appliquer cet avenant au bail ?");
    if (!ok) return;

    setBusyId(amendment.id);
    setError("");
    setStatus("Application de l’avenant…");

    try {
      const r = await fetch(
        `${API}/leases/${leaseId}/amendments/${amendment.id}/apply`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
        },
      );

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || JSON.stringify(j));

      setStatus("Avenant appliqué ✅");
      await load();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    } finally {
      setBusyId(null);
    }
  }

  const sorted = useMemo(() => {
    return [...items].sort((a, b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || "")),
    );
  }, [items]);

  const blue = "#3467EB";
  const title = "#17233A";
  const muted = "#667085";
  const border = "rgba(27,39,64,0.08)";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F6F8FC",
        padding: "clamp(18px, 4vw, 42px)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <button
              type="button"
              onClick={() => router.push("/dashboard/leases")}
              style={secondaryBtn(border)}
            >
              <ArrowLeft size={16} />
              Retour aux baux
            </button>

            <h1
              style={{
                margin: "18px 0 8px",
                fontSize: 34,
                color: title,
                letterSpacing: "-0.05em",
              }}
            >
              Avenants
            </h1>

            <p style={{ margin: 0, color: muted, lineHeight: 1.6 }}>
              Suivi des avenants, signatures et application au bail.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={load} style={secondaryBtn(border)}>
              <RefreshCw size={16} />
              Rafraîchir
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/dashboard/leases/${leaseId}/amendments/new?type=ADD_TENANT`,
                )
              }
              style={primaryBtn(blue)}
            >
              <Plus size={16} />
              Nouvel avenant
            </button>
          </div>
        </div>

        {status && <div style={alertBox("success")}>{status}</div>}
        {error && <div style={alertBox("danger")}>{error}</div>}

        <section style={{ marginTop: 20, display: "grid", gap: 12 }}>
          {loading ? (
            <div style={emptyCard(border, muted)}>
              <Loader2 size={18} className="spin" />
              Chargement des avenants…
            </div>
          ) : sorted.length === 0 ? (
            <div style={emptyCard(border, muted)}>
              Aucun avenant pour ce bail.
            </div>
          ) : (
            sorted.map((a) => {
              const canSign = Boolean(a.document_id) && a.status !== "applied";
              const canApply = a.status === "signed";

              return (
                <article key={a.id} style={card(border)}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0,1fr) auto",
                      gap: 16,
                      alignItems: "start",
                    }}
                    className="amendment-row"
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={iconBox(blue)}>
                          <FileSignature size={18} />
                        </span>

                        <h2
                          style={{
                            margin: 0,
                            color: title,
                            fontSize: 18,
                            letterSpacing: "-0.035em",
                          }}
                        >
                          {a.title || "Avenant"}
                        </h2>

                        <span style={statusPill(a.status)}>
                          {statusLabel(a.status)}
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: 10,
                          color: muted,
                          fontSize: 13.5,
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>Effet : {fmtDate(a.effective_date)}</span>
                        <span>Créé : {fmtDateTime(a.created_at)}</span>
                        {a.generated_at && (
                          <span>Généré : {fmtDateTime(a.generated_at)}</span>
                        )}
                        {a.signed_at && (
                          <span>Signé : {fmtDateTime(a.signed_at)}</span>
                        )}
                        {a.applied_at && (
                          <span>Appliqué : {fmtDateTime(a.applied_at)}</span>
                        )}
                      </div>

                      {a.summary ? (
                        <p style={{ margin: "10px 0 0", color: muted }}>
                          {a.summary}
                        </p>
                      ) : null}

                      {Array.isArray(a.signers) && a.signers.length > 0 ? (
                        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {a.signers.map((s, i) => (
                            <span key={i} style={signerPill(s.signatureStatus)}>
                              {s.role === "BAILLEUR" ? "Bailleur" : "Locataire"} ·{" "}
                              {s.signerName || "—"} ·{" "}
                              {s.signatureStatus === "signed" ? "signé" : "en attente"}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        justifyContent: "flex-end",
                        flexWrap: "wrap",
                      }}
                    >
                      {a.document_id ? (
                        <button
                          type="button"
                          style={smallBtn(border)}
                          onClick={() =>
                            downloadDoc(a.document_id!, a.document_filename)
                          }
                        >
                          <Download size={15} />
                          PDF
                        </button>
                      ) : null}

                      {a.signed_final_document_id ? (
                        <button
                          type="button"
                          style={smallBtn(border)}
                          onClick={() =>
                            downloadDoc(
                              a.signed_final_document_id!,
                              a.signed_final_filename,
                            )
                          }
                        >
                          <Download size={15} />
                          Signé
                        </button>
                      ) : null}

                      {canSign ? (
                        <button
                          type="button"
                          style={smallPrimaryBtn(blue)}
                          onClick={() =>
                            router.push(
                              `/sign/${leaseId}?documentId=${a.document_id}`,
                            )
                          }
                        >
                          <Send size={15} />
                          Signer
                        </button>
                      ) : null}

                      {canApply ? (
                        <button
                          type="button"
                          style={smallSuccessBtn()}
                          disabled={busyId === a.id}
                          onClick={() => applyAmendment(a)}
                        >
                          {busyId === a.id ? (
                            <Loader2 size={15} className="spin" />
                          ) : (
                            <CheckCircle2 size={15} />
                          )}
                          Appliquer
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>

      <style jsx>{`
        @media (max-width: 820px) {
          .amendment-row {
            grid-template-columns: 1fr !important;
          }
        }
        .spin {
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}

function fmtDate(v?: string | null) {
  return v ? String(v).slice(0, 10) : "—";
}

function fmtDateTime(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("fr-FR");
}

function statusLabel(status: string) {
  if (status === "draft") return "Brouillon";
  if (status === "generated") return "Généré";
  if (status === "signed") return "Signé";
  if (status === "applied") return "Appliqué";
  if (status === "cancelled") return "Annulé";
  return status;
}

function secondaryBtn(border: string): React.CSSProperties {
  return {
    border: `1px solid ${border}`,
    background: "#fff",
    borderRadius: 14,
    padding: "10px 14px",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 900,
    color: "#243247",
    cursor: "pointer",
  };
}

function primaryBtn(blue: string): React.CSSProperties {
  return {
    border: "1px solid rgba(52,103,235,0.12)",
    background: blue,
    color: "#fff",
    borderRadius: 14,
    padding: "10px 14px",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(52,103,235,0.18)",
  };
}

function smallBtn(border: string): React.CSSProperties {
  return {
    border: `1px solid ${border}`,
    background: "#fff",
    color: "#243247",
    borderRadius: 12,
    padding: "9px 11px",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    fontWeight: 850,
    cursor: "pointer",
  };
}

function smallPrimaryBtn(blue: string): React.CSSProperties {
  return {
    ...smallBtn("rgba(52,103,235,0.16)"),
    background: "#EEF4FF",
    color: blue,
  };
}

function smallSuccessBtn(): React.CSSProperties {
  return {
    ...smallBtn("rgba(31,157,97,0.18)"),
    background: "#ECF9F1",
    color: "#1F7A4D",
  };
}

function card(border: string): React.CSSProperties {
  return {
    background: "#fff",
    border: `1px solid ${border}`,
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 14px 38px rgba(16,24,40,0.06)",
  };
}

function emptyCard(border: string, muted: string): React.CSSProperties {
  return {
    background: "#fff",
    border: `1px dashed ${border}`,
    borderRadius: 20,
    padding: 22,
    color: muted,
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 800,
  };
}

function iconBox(blue: string): React.CSSProperties {
  return {
    width: 38,
    height: 38,
    borderRadius: 14,
    background: "#EEF4FF",
    color: blue,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function statusPill(status: string): React.CSSProperties {
  const s = String(status || "").toLowerCase();

  const tone =
    s === "applied"
      ? ["#ECF9F1", "#1F7A4D", "rgba(31,157,97,0.18)"]
      : s === "signed"
        ? ["#EEF4FF", "#3467EB", "rgba(52,103,235,0.16)"]
        : s === "generated"
          ? ["#FFF7E8", "#A06A2C", "rgba(160,106,44,0.18)"]
          : ["#F8FAFC", "#667085", "rgba(27,39,64,0.08)"];

  return {
    border: `1px solid ${tone[2]}`,
    background: tone[0],
    color: tone[1],
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 900,
  };
}

function signerPill(status?: string | null): React.CSSProperties {
  const signed = String(status || "").toLowerCase() === "signed";

  return {
    border: signed
      ? "1px solid rgba(31,157,97,0.18)"
      : "1px solid rgba(160,106,44,0.18)",
    background: signed ? "#ECF9F1" : "#FFF7E8",
    color: signed ? "#1F7A4D" : "#A06A2C",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 850,
  };
}

function alertBox(mode: "danger" | "success"): React.CSSProperties {
  return {
    marginTop: 16,
    padding: "12px 14px",
    borderRadius: 16,
    border:
      mode === "danger"
        ? "1px solid rgba(220,38,38,0.22)"
        : "1px solid rgba(31,157,97,0.18)",
    background: mode === "danger" ? "#FFF5F5" : "#ECF9F1",
    color: mode === "danger" ? "#A12C2C" : "#1F7A4D",
    fontWeight: 900,
  };
}