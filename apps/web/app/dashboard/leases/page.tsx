"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Archive,
  Building2,
  CalendarRange,
  CircleAlert,
  Ellipsis,
  FilePenLine,
  FolderKanban,
  HandCoins,
  Home,
  PackageSearch,
  PenSquare,
  Plus,
  RefreshCw,
  Shield,
  Wallet,
} from "lucide-react";
import Link from "next/link";


const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type IrlIndexation = {
  enabled?: boolean;
  referenceQuarter?: string | null;
  referenceValue?: number | string | null;
};

type LeaseTerms = {
  irlIndexation?: IrlIndexation | null;
  irl_indexation?: IrlIndexation | null; // defensive
  // (tu peux ajouter d'autres champs plus tard)
};

type Lease = {
  id: string;
  unit_id: string;
  tenant_id: string;
  start_date: string;
  end_date_theoretical: string;
  rent_cents: number;
  charges_cents: number;
  deposit_cents: number;
  payment_day: number;
  status: "draft" | "active" | "notice" | "ended" | string;
  created_at: string;
  unit_code?: string;
  tenant_name?: string;
  kind?: string;
  // IRL (si présent dans la liste /leases)
  irl_revision_date?: string | null;
  next_revision_date?: string | null;
  // legacy / flat (selon endpoints)
  irl_reference_value?: string | number | null;
  irl_reference_quarter?: string | null;
  // new
  lease_terms?: LeaseTerms | null;
  leaseTerms?: LeaseTerms | null; // defensive (si camelCase)
  // defensive camelCase (certains endpoints / transforms)
  irlReferenceValue?: string | number | null;
  irlReferenceQuarter?: string | null;
};


function kindLabel(k?: string) {
  const v = String(k || "MEUBLE_RP").toUpperCase();
  if (v === "MEUBLE_RP") return "Meublé (RP)";
  if (v === "NU_RP") return "Nu (RP)";
  if (v === "SAISONNIER") return "Saisonnier";
  return v;
}


export default function LeasesPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [leases, setLeases] = useState<Lease[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [showArchives, setShowArchives] = useState(false);
  const [openLeaseMenuId, setOpenLeaseMenuId] = useState<string | null>(null);


  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-lease-actions-root="true"]')) return;
      setOpenLeaseMenuId(null);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);


  // -------------------------
  // IRL APPLY MODAL (mini)
  // -------------------------
  const [irlModalOpen, setIrlModalOpen] = useState(false);
  const [irlModalLease, setIrlModalLease] = useState<any>(null);

  const [irlApplyDate, setIrlApplyDate] = useState<string>("");
  const [irlApplyQuarter, setIrlApplyQuarter] = useState<string>("");
  const [irlApplyValue, setIrlApplyValue] = useState<string>("");

  const [irlApplyBusy, setIrlApplyBusy] = useState(false);
  const [irlApplyErr, setIrlApplyErr] = useState<string>("");

  const blue = "#3467EB";
  const border = "rgba(27,39,64,0.08)";
  const cardBorder = "rgba(27,39,64,0.06)";
  const line = "rgba(27,39,64,0.065)";
  const shellBg = "#F6F8FC";
  const title = "#17233A";
  const muted = "#667085";
  const softText = "#8D99AE";

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);


  async function loadAll() {
    setError("");
    setStatus("Chargement…");
    try {
      const l = await fetch(`${API}/leases`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      }).then((r) => r.json());

      const leasesArr: Lease[] = Array.isArray(l) ? l : [];
      setLeases(leasesArr);

      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

async function downloadDocument(documentId: string, filename?: string) {
  const token = localStorage.getItem("token");

  const r = await fetch(`${API}/documents/${documentId}/download`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`, // ✅ IMPORTANT
    },
    credentials: "include",
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Download failed ${r.status} ${txt}`);
  }

  const blob = await r.blob();
  const url = URL.createObjectURL(blob);

  // ✅ force un nom de fichier explicite
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "document.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Optionnel: preview
  //window.open(url, "_blank");

  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function openApplyIrlModal(lease: any) {
  setIrlApplyErr("");
  setIrlModalLease(lease);

  const defaultDate =
    (lease?.next_revision_date ? String(lease.next_revision_date).slice(0, 10) : "") ||
    new Date().toISOString().slice(0, 10);

  setIrlApplyDate(defaultDate);
  setIrlApplyQuarter("");
  setIrlApplyValue("");
  setIrlModalOpen(true);
}

async function submitApplyIrl() {
  if (!irlModalLease) return;

  const token = localStorage.getItem("token");
  const revisionDate = (irlApplyDate || "").trim();
  const irlNewQuarter = (irlApplyQuarter || "").trim();
  const irlNewValue = Number(String(irlApplyValue || "").replace(",", "."));

  if (!revisionDate) return setIrlApplyErr("Date de révision obligatoire.");
  if (!irlNewQuarter) return setIrlApplyErr("Trimestre obligatoire (ex: T4 2026).");
  if (!Number.isFinite(irlNewValue) || irlNewValue <= 0) return setIrlApplyErr("Valeur IRL invalide.");

  setIrlApplyErr("");
  setIrlApplyBusy(true);

  try {
    const r = await fetch(`${API}/leases/${irlModalLease.id}/irl/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      body: JSON.stringify({ revisionDate, irlNewQuarter, irlNewValue }),
    });

    const txt = await r.text().catch(() => "");
    if (!r.ok) {
      console.error("IRL apply error:", r.status, txt);
      setIrlApplyErr(`Erreur API (${r.status}) : ${txt || "voir console"}`);
      return;
    }

    setIrlModalOpen(false);
    setIrlModalLease(null);

    await loadAll();
    setStatus("Révision IRL appliquée ✅ (historique créé)");
    setTimeout(() => setStatus(""), 2500);
  } catch (e: any) {
    setIrlApplyErr(String(e?.message || e));
  } finally {
    setIrlApplyBusy(false);
  }
}

async function generateIrlAvenant(lease: any) {
  const token = localStorage.getItem("token");

  const defaultDate =
    (lease?.irl_revision_date ? String(lease.irl_revision_date).slice(0, 10) : "") ||
    (lease?.next_revision_date ? String(lease.next_revision_date).slice(0, 10) : "");

  const revisionDate = window.prompt("Date de révision (YYYY-MM-DD) :", defaultDate || "") || "";

  if (!revisionDate) {
    alert("Aucune date de révision IRL trouvée.");
    return;
  }

  const r = await fetch(`${API}/leases/${lease.id}/irl/avenant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`, // ✅ IMPORTANT
    },
    credentials: "include",
    body: JSON.stringify({ revisionDate }),
  });

  const txt = await r.text().catch(() => "");

if (!r.ok) {
  console.error("IRL avenant error:", r.status, txt);

  const normalized = String(txt || "").toLowerCase();

  if (
    r.status === 400 &&
    (normalized.includes("lease_revisions empty") ||
      normalized.includes("no irl revision exists"))
  ) {
    alert("Aucune révision IRL appliquée pour ce bail. Cliquez d’abord sur “Appliquer IRL”.");
  } else {
    alert(`Erreur génération avenant IRL (${r.status}). Voir console.`);
  }
  return;
}
  const data = JSON.parse(txt);

  const docId =
    data?.document?.id ||
    data?.id ||
    data?.documentId ||
    null;

  if (!docId) {
    console.error("Unexpected avenant response:", data);
    alert("Avenant généré mais id document introuvable (voir console).");
    return;
  }

  const code = lease?.unit_code || lease?.unitCode || "BAIL";
  const date = String(revisionDate).slice(0, 10);
  const niceName = `AVENANT_IRL_${code}_${date}.pdf`;

  await downloadDocument(docId, niceName);
}

  useEffect(() => {
    if (token) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);


  async function activateLease(id: string) {
    setError("");
    setStatus("Activation…");
    try {
      const r = await fetch(`${API}/leases/${id}/activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Bail activé ✅");
      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function setNoticeLease(id: string) {
    setError("");
    setStatus("Passage en préavis…");
    try {
      const r = await fetch(`${API}/leases/${id}/notice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Préavis activé ✅");
      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function cancelNoticeLease(id: string) {
    setError("");
    setStatus("Annulation du préavis…");
    try {
      const r = await fetch(`${API}/leases/${id}/cancel-notice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Préavis annulé ✅");
      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function closeLease(id: string) {
    if (!confirm("Clôturer ce bail ? (EDL/Inventaire sortie seront figés et reportés)")) return;

    setError("");
    setStatus("Clôture…");
    try {
      const r = await fetch(`${API}/leases/${id}/close`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Bail clôturé ✅");
      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  const leasesSorted = useMemo(() => {
    return [...leases].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }, [leases]);

  const activeLeases = useMemo(() => leasesSorted.filter((l) => l.status !== "ended"), [leasesSorted]);
  const endedLeases = useMemo(() => leasesSorted.filter((l) => l.status === "ended"), [leasesSorted]);


  return (
    <main
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "32px 36px 56px",
        background: shellBg,
        minHeight: "100vh",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <div>
          <h2
            style={{
              marginTop: 0,
              marginBottom: 8,
              fontSize: 34,
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              color: title,
              fontWeight: 900,
            }}
          >
            Baux
          </h2>
          <p style={{ margin: 0, fontSize: 15, color: muted, lineHeight: 1.65 }}>
            Liste de dossiers de bail — gestion, documents, import logement et signatures.
          </p>
          <div style={{ marginTop: 10, fontSize: 13, color: softText, fontWeight: 600 }}>
            {activeLeases.length} dossier(s) actif(s) · {endedLeases.length} archive(s)
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => {
              router.push("/dashboard/leases/new");
            }}
            style={btnPrimaryWide(blue)}
          >
            <>
              <Plus size={16} strokeWidth={2.3} />
              Nouveau bail
            </>
          </button>

          <button onClick={loadAll} style={btnSecondary(border)}>
            <RefreshCw size={13} strokeWidth={2} />
            Rafraîchir
          </button>
        </div>
      </div>

      {status && <p style={{ marginTop: 10, color: "#0a6" }}>{status}</p>}
      {error && <p style={{ marginTop: 10, color: "crimson" }}>{error}</p>}


            {/* Active */}
            <section style={{ marginTop: 18 }}>
              <div style={{ display: "grid", gap: 12 }}>
                {activeLeases.map((l) => {
                  const terms = l.lease_terms ?? (l as any).leaseTerms ?? null;

                  const irlEnabled =
                    terms?.irlIndexation?.enabled === true ||
                    terms?.irl_indexation?.enabled === true;

                  const canGenerateAvenant =
                    !!l?.irl_revision_date || !!l?.next_revision_date;

                  const primaryLabel =
                    l.status === "draft"
                      ? "Activer"
                      : "Contrat + signatures";


                  return (
                    <div
                      key={l.id}
                      style={{
                        border: `1px solid ${cardBorder}`,
                        borderRadius: 20,
                        background: "#fff",
                        boxShadow: "0 10px 30px rgba(16,24,40,0.05)",
                        overflow: "visible",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) auto",
                          gap: 18,
                          alignItems: "center",
                          padding: "18px 22px 14px",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 16,
                                background: "#EEF4FF",
                                color: blue,
                                border: "1px solid rgba(47,99,224,0.10)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <Home size={20} strokeWidth={2.1} />
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-0.04em", color: title }}>
                                  {l.unit_code || l.unit_id}
                                </span>
                                <span style={{ fontSize: 14, color: title, minWidth: 0, fontWeight: 500 }}>
                                  — {l.tenant_name || l.tenant_id}
                                </span>
                              </div>

                              <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <span style={{ color: muted, fontSize: 13.5 }}>{kindLabel(l.kind)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {l.status === "draft" ? (
                            <button onClick={() => activateLease(l.id)} style={{ ...btnCompactPrimary(blue), minWidth: 170, justifyContent: "center" }}>
                              <ArrowRightLeft size={16} strokeWidth={2.2} />
                              {primaryLabel}
                            </button>
                          ) : (
                            <Link href={`/sign/${l.id}`}>
                              <button style={{ ...btnCompactPrimary(blue), minWidth: 170, justifyContent: "center" }}>
                                <FilePenLine size={16} strokeWidth={2.2} />
                                {primaryLabel}
                              </button>
                            </Link>
                          )}

                          <div
                            data-lease-actions-root="true"
                            style={{
                              position: "relative",
                              zIndex: 30,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setOpenLeaseMenuId(openLeaseMenuId === l.id ? null : l.id)}
                              style={compactMenuButton(border)}
                            >
                              <Ellipsis size={18} strokeWidth={2.3} />
                            </button>

                            {openLeaseMenuId === l.id && (
                              <div style={leaseMenuStyle()}>
                                {(l.status === "active" || l.status === "notice") && (
                                  <>
                                    {l.status === "notice" ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenLeaseMenuId(null);
                                          cancelNoticeLease(l.id);
                                        }}
                                        style={leaseMenuItemStyle()}
                                      >
                                        <CalendarRange size={14} strokeWidth={2.1} />
                                        Annuler préavis
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenLeaseMenuId(null);
                                          setNoticeLease(l.id);
                                        }}
                                        style={leaseMenuItemStyle()}
                                      >
                                        <CalendarRange size={14} strokeWidth={2.1} />
                                        Préavis
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenLeaseMenuId(null);
                                        router.push(`/dashboard/leases/${l.id}/edit`);
                                      }}
                                      style={leaseMenuItemStyle()}
                                    >
                                      <PenSquare size={14} strokeWidth={2.1} />
                                      Modifier
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenLeaseMenuId(null);
                                        closeLease(l.id);
                                      }}
                                      style={leaseMenuDangerItemStyle()}
                                    >
                                      <CircleAlert size={14} strokeWidth={2.1} />
                                      Clôturer
                                    </button>
                                  </>
                                )}

                                {l.status === "draft" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenLeaseMenuId(null);
                                        router.push(`/dashboard/leases/${l.id}/edit`);
                                      }}
                                      style={leaseMenuItemStyle()}
                                    >
                                      <PenSquare size={14} strokeWidth={2.1} />
                                      Modifier
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenLeaseMenuId(null);
                                        closeLease(l.id);
                                      }}
                                      style={leaseMenuDangerItemStyle()}
                                    >
                                      <CircleAlert size={14} strokeWidth={2.1} />
                                      Clôturer
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) auto",
                          gap: 12,
                          alignItems: "center",
                          padding: "0 22px 14px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 14,
                            flexWrap: "wrap",
                            alignItems: "center",
                            color: muted,
                            fontSize: 13.5,
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                            <CalendarRange size={13} strokeWidth={2} color={softText} />
                            {String(l.start_date).slice(0, 10)} → {String(l.end_date_theoretical).slice(0, 10)}
                            <span style={{ ...statusChip(l.status, border), padding: "4px 10px", fontSize: 12 }}>
                              {l.status === "notice" ? "Préavis" : l.status === "active" ? "Actif" : l.status}
                            </span>
                          </span>

                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                            <Wallet size={13} strokeWidth={2} color={softText} />
                            {(l.rent_cents / 100).toFixed(0)} € + {(l.charges_cents / 100).toFixed(0)} €
                          </span>

                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <HandCoins size={13} strokeWidth={2} color={softText} />

                            <span style={irlStatusPill(irlEnabled ? "on" : "off")}>
                              {irlEnabled ? "IRL actif" : "IRL off"}
                            </span>

                            {irlEnabled && (
                              <button
                                type="button"
                                onClick={() => openApplyIrlModal(l)}
                                style={irlAvenantButtonStyle(border)}
                              >
                                Appliquer IRL
                              </button>
                            )}

                            {irlEnabled && canGenerateAvenant && (
                              <button
                                type="button"
                                onClick={() => generateIrlAvenant(l)}
                                style={irlAvenantButtonStyle(border)}
                              >
                                Avenant IRL
                              </button>
                            )}
                          </span>

                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                            <Shield size={13} strokeWidth={2} color={softText} />
                            {(l.deposit_cents / 100).toFixed(0)} €
                          </span>
                        </div>
                        <div />
                      </div>

                      <div
                        style={{
                          borderTop: `1px solid ${line}`,
                          padding: "12px 22px 14px",
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          alignItems: "center",
                          background: "#FBFCFE",
                        }}
                      >
                        <Link href={`/import/${l.id}`}>
                          <button style={docChipButton(border)}>
                            <Building2 size={14} strokeWidth={2.1} />
                            Import
                          </button>
                        </Link>

                        <span
                          style={{
                            width: 1,
                            height: 22,
                            background: "rgba(27,39,64,0.10)",
                            display: "inline-block",
                          }}
                        />

                        <Link href={`/guarantor-act/${l.id}`}>
                          <button style={docChipButton(border)}>
                            <Shield size={14} strokeWidth={2.1} /> Acte caution
                          </button>
                        </Link>

                        <Link href={`/edl/${l.id}`}>
                          <button style={docChipButton(border)}>
                            <FolderKanban size={14} strokeWidth={2.1} /> EDL
                          </button>
                        </Link>

                        <Link href={`/inventory/${l.id}`}>
                          <button style={docChipButton(border)}>
                            <PackageSearch size={14} strokeWidth={2.1} /> Inventaire
                          </button>
                        </Link>
                      </div>
                    </div>
                  );
                })}

                {!activeLeases.length && (
                  <div
                    style={{
                      border: `1px dashed ${border}`,
                      borderRadius: 16,
                      padding: 14,
                      color: muted,
                      background: "#fff",
                    }}
                  >
                    Aucun bail actif.
                  </div>
                )}
              </div>

        {/* Archives */}
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setShowArchives((v) => !v)} style={archiveToggleButton(border)}>
            <>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Archive size={16} strokeWidth={2.2} />
                Archives ({endedLeases.length})
              </span>
              <span style={{ color: softText, fontWeight: 700 }}>{showArchives ? "Masquer" : "Afficher"}</span>
            </>
          </button>

          {showArchives && (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {endedLeases.map((l) => (
                <div key={l.id} style={{ border: `1px solid ${cardBorder}`, borderRadius: 20, background: "#fff", boxShadow: "0 10px 30px rgba(16,24,40,0.05)", overflow: "visible" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 16, alignItems: "center", padding: "18px 22px 12px" }}>
                    <div style={{ minWidth: 0, display: "flex", gap: 14, alignItems: "center" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 14, background: "#EEF4FF", color: blue, border: "1px solid rgba(47,99,224,0.10)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Home size={18} strokeWidth={2.1} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 900, fontSize: 17, letterSpacing: "-0.03em", color: title }}>{l.unit_code || l.unit_id}</span>
                          <span style={{ fontSize: 14, color: title }}>— {l.tenant_name || l.tenant_id}</span>
                        </div>
                        <div style={{ marginTop: 6, color: muted, fontSize: 13.5 }}>Clôturé</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <Link href={`/sign/${l.id}`}><button style={{ ...btnCompactPrimary(blue), minWidth: 150, justifyContent: "center" }}><Archive size={13} strokeWidth={2} /> Voir l’archive</button></Link>
                      <div
                        data-lease-actions-root="true"
                        style={{
                          position: "relative",
                          zIndex: 30,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenLeaseMenuId(openLeaseMenuId === l.id ? null : l.id)}
                          style={compactMenuButton(border)}
                        >
                          <Ellipsis size={18} strokeWidth={2.3} />
                        </button>

                        {openLeaseMenuId === l.id && (
                          <div style={leasePopoverStyle()}>
                            <div style={leasePopoverHeaderStyle()}>
                              <div style={leasePopoverEyebrowStyle()}>Archive</div>
                              <div style={leasePopoverTitleStyle()}>{l.unit_code || l.unit_id}</div>
                              <div style={leasePopoverSubtitleStyle()}>{l.tenant_name || l.tenant_id}</div>
                            </div>

                            <div>
                              <div style={leasePopoverSectionLabelStyle()}>Documents</div>

                              <Link
                                href={`/guarantor-act/${l.id}`}
                                style={leasePopoverLinkReset()}
                                onClick={() => setOpenLeaseMenuId(null)}
                              >
                                <span style={leasePopoverItemStyle()}>
                                  <Shield size={15} strokeWidth={2.1} />
                                  Acte caution
                                </span>
                              </Link>

                              <Link
                                href={`/edl/${l.id}`}
                                style={leasePopoverLinkReset()}
                                onClick={() => setOpenLeaseMenuId(null)}
                              >
                                <span style={leasePopoverItemStyle()}>
                                  <FolderKanban size={15} strokeWidth={2.1} />
                                  EDL
                                </span>
                              </Link>

                              <Link
                                href={`/inventory/${l.id}`}
                                style={leasePopoverLinkReset()}
                                onClick={() => setOpenLeaseMenuId(null)}
                              >
                                <span style={leasePopoverItemStyle()}>
                                  <PackageSearch size={15} strokeWidth={2.1} />
                                  Inventaire
                                </span>
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", color: muted, fontSize: 13.5, padding: "0 22px 14px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><CalendarRange size={13} strokeWidth={2} color={softText} />{String(l.start_date).slice(0, 10)} → {String(l.end_date_theoretical).slice(0, 10)}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Wallet size={13} strokeWidth={2} color={softText} />{(l.rent_cents / 100).toFixed(0)} € HC</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Shield size={13} strokeWidth={2} color={softText} />{(l.deposit_cents / 100).toFixed(0)} €</span>
                  </div>

                  <div style={{ borderTop: `1px solid ${line}`, padding: "12px 22px 14px", display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link href={`/guarantor-act/${l.id}`}><button style={docChipButton(border)}><Shield size={14} strokeWidth={2.1} /> Acte caution</button></Link>
                    <Link href={`/edl/${l.id}`}><button style={docChipButton(border)}><FolderKanban size={14} strokeWidth={2.1} /> EDL</button></Link>
                    <Link href={`/inventory/${l.id}`}><button style={docChipButton(border)}><PackageSearch size={14} strokeWidth={2.1} /> Inventaire</button></Link>
                  </div>
                </div>
              ))}

              {!endedLeases.length && (
                <div style={{ border: `1px dashed ${border}`, borderRadius: 16, padding: 14, color: muted, background: "#fff" }}>Aucune archive.</div>
              )}
            </div>
          )}
        </div>
      </section>

      {irlModalOpen && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
      padding: "24px 16px",
      zIndex: 60,
    }}
    onClick={() => {
      if (irlApplyBusy) return;
      setIrlModalOpen(false);
      setIrlModalLease(null);
    }}
  >
    <div
      style={{
        background: "#fff",
        width: "min(720px, 100%)",
        margin: "0 auto",
        borderRadius: 16,
        padding: 14,
        border: `1px solid ${border}`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Appliquer une révision IRL</div>
          <div style={{ color: muted, fontSize: 12 }}>
            Bail: {irlModalLease?.unit_code || irlModalLease?.unit_id} — {irlModalLease?.tenant_name || irlModalLease?.tenant_id}
          </div>
        </div>

        <button
          style={btnSecondary(border)}
          onClick={() => {
            if (irlApplyBusy) return;
            setIrlModalOpen(false);
            setIrlModalLease(null);
          }}
        >
          Fermer
        </button>
      </div>

      {irlApplyErr && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 12,
            border: `1px solid rgba(220,38,38,0.35)`,
            background: "rgba(220,38,38,0.08)",
            fontWeight: 800,
            color: "#7f1d1d",
          }}
        >
          {irlApplyErr}
        </div>
      )}

      {/* Form */}
      <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <label style={labelStyle(muted)}>
          Date de révision *
          <br />
          <input
            type="date"
            value={irlApplyDate}
            onChange={(e) => setIrlApplyDate(e.target.value)}
            style={inputStyle(border)}
            disabled={irlApplyBusy}
          />
        </label>

        <label style={labelStyle(muted)}>
          Nouveau trimestre *
          <br />
          <input
            value={irlApplyQuarter}
            onChange={(e) => setIrlApplyQuarter(e.target.value)}
            placeholder="ex: T4 2026"
            style={inputStyle(border)}
            disabled={irlApplyBusy}
          />
        </label>

        <label style={labelStyle(muted)}>
          Nouvelle valeur IRL *
          <br />
          <input
            value={irlApplyValue}
            onChange={(e) => setIrlApplyValue(e.target.value)}
            placeholder="ex: 150.50"
            style={inputStyle(border)}
            disabled={irlApplyBusy}
          />
        </label>
      </div>

      {/* Preview calcul */}
      <IrlPreview
        muted={muted}
        border={border}
        lease={irlModalLease}
        newValueRaw={irlApplyValue}
      />

      <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button
          style={btnSecondary(border)}
          onClick={() => {
            if (irlApplyBusy) return;
            setIrlModalOpen(false);
            setIrlModalLease(null);
          }}
          disabled={irlApplyBusy}
        >
          Annuler
        </button>

        <button
          style={btnPrimarySmall(blue)}
          onClick={submitApplyIrl}
          disabled={irlApplyBusy}
        >
          {irlApplyBusy ? "Application…" : "Appliquer"}
        </button>
      </div>
    </div>
  </div>
)}
    </main>
  );
}

// Nouveaux helpers
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
    background: "#fff",
  } as const;
}

function btnPrimarySmall(blue: string) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid rgba(47,99,224,0.16)`,
    background: "#EEF4FF",
    color: blue,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  } as const;
}

function btnPrimaryWide(blue: string) {
  return {
    padding: "11px 16px",
    borderRadius: 14,
    border: "1px solid rgba(52,103,235,0.10)",
    background: blue,
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    width: "fit-content",
    boxShadow: "0 10px 24px rgba(52,103,235,0.16)",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  } as const;
}

function btnSecondary(border: string) {
  return {
    padding: "10px 14px",
    borderRadius: 14,
    border: `1px solid ${border}`,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 800,
    color: "#243247",
    boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  } as const;
}


function btnCompactPrimary(blue: string) {
  return {
    padding: "9px 12px",
    borderRadius: 13,
    border: "1px solid rgba(52,103,235,0.10)",
    background: blue,
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 8px 18px rgba(52,103,235,0.16)",
  } as const;
}


function chip(borderColor: string, color: string) {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${borderColor}`,
    background: "#fff",
    color,
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: "-0.01em",
  } as const;
}

function statusChip(status: string, border: string) {
  if (status === "active") {
    return {
      ...chip("rgba(31,157,97,0.16)", "#1F9D61"),
      background: "#ECF9F1",
    } as const;
  }

  if (status === "notice") {
    return {
      ...chip("rgba(160,106,44,0.18)", "#A06A2C"),
      background: "#FBF2E8",
    } as const;
  }

  if (status === "ended") {
    return {
      ...chip("rgba(31,157,97,0.16)", "#1F9D61"),
      background: "#ECF9F1",
    } as const;
  }

  return {
    ...chip(border, "#667085"),
    background: "#F8FAFC",
  } as const;
}

function compactMenuButton(border: string) {
  return {
    listStyle: "none",
    width: 38,
    height: 38,
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#243247",
    boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
  } as const;
}

function leaseMenuStyle(): React.CSSProperties {
  return {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    minWidth: 170,
    padding: 4,
    borderRadius: 12,
    border: "1px solid rgba(27,39,64,0.06)",
    background: "#fff",
    boxShadow: "0 10px 24px rgba(16,24,40,0.12)",
    zIndex: 9999,
    display: "grid",
    gap: 2,
  };
}

function leaseMenuItemStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 7,
    width: "100%",
    minHeight: 34,
    padding: "8px 10px",
    border: "none",
    background: "transparent",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
    color: "#243247",
    textAlign: "left",
    lineHeight: 1.2,
  };
}

function leaseMenuDangerItemStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 7,
    width: "100%",
    minHeight: 34,
    padding: "8px 10px",
    border: "none",
    background: "#FBEFF3",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    color: "#A12C52",
    textAlign: "left",
    lineHeight: 1.2,
  };
}

function leasePopoverStyle(): React.CSSProperties {
  return {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    width: 344,
    maxWidth: "min(344px, calc(100vw - 64px))",
    padding: 12,
    borderRadius: 18,
    border: "1px solid rgba(27,39,64,0.08)",
    background: "#fff",
    boxShadow: "0 18px 44px rgba(16,24,40,0.16)",
    zIndex: 9999,
  };
}

function leasePopoverHeaderStyle(): React.CSSProperties {
  return {
    paddingBottom: 10,
    marginBottom: 10,
    borderBottom: "1px solid rgba(27,39,64,0.06)",
  };
}

function leasePopoverEyebrowStyle(): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#8D99AE",
    marginBottom: 6,
  };
}

function leasePopoverTitleStyle(): React.CSSProperties {
  return {
    fontSize: 15,
    fontWeight: 900,
    color: "#17233A",
    letterSpacing: "-0.02em",
  };
}

function leasePopoverSubtitleStyle(): React.CSSProperties {
  return {
    marginTop: 4,
    fontSize: 12.5,
    color: "#667085",
  };
}

function leasePopoverSectionLabelStyle(): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#8D99AE",
    marginBottom: 8,
  };
}

function leasePopoverItemStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    minHeight: 38,
    padding: "8px 10px",
    marginBottom: 6,
    border: "1px solid rgba(27,39,64,0.08)",
    background: "#fff",
    borderRadius: 12,
    cursor: "pointer",
    fontSize: 13.5,
    fontWeight: 800,
    color: "#1B2740",
    textAlign: "left",
    whiteSpace: "nowrap",
    lineHeight: 1.2,
    boxSizing: "border-box",
  };
}

function leasePopoverLinkReset() {
  return { textDecoration: "none", color: "inherit", display: "block" } as const;
}

function irlStatusPill(mode: "on" | "off") {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    border:
      mode === "on"
        ? "1px solid rgba(31,157,97,0.14)"
        : "1px solid rgba(27,39,64,0.08)",
    background: mode === "on" ? "#ECF9F1" : "#F8FAFC",
    color: mode === "on" ? "#1F9D61" : "#8D99AE",
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1,
  } as const;
}

function irlAvenantButtonStyle(border: string) {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 500,
    color: "#243247",
    fontSize: 12,
    display: "inline-flex",
    alignItems: "center",
    lineHeight: 1,
  } as const;
}


function docChipButton(border: string) {
  return {
    padding: "8px 12px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "#F8FAFC",
    cursor: "pointer",
    fontWeight: 600,
    color: "#243247",
    boxShadow: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 38,
  } as const;
}

function archiveToggleButton(border: string) {
  return {
    width: "100%",
    padding: "18px 20px",
    borderRadius: 18,
    border: `1px solid ${border}`,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    color: "#1F2A3C",
    boxShadow: "0 10px 30px rgba(16,24,40,0.05)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  } as const;
}

function IrlPreview({
  lease,
  newValueRaw,
  muted,
  border,
}: {
  lease: any;
  newValueRaw: string;
  muted: string;
  border: string;
}) {
  const currentRent = Number(lease?.rent_cents || 0) / 100;

  const terms = lease?.lease_terms ?? lease?.leaseTerms ?? null;

  const refValue =
    terms?.irlIndexation?.referenceValue ??
    terms?.irl_indexation?.referenceValue ??
    lease?.irl_reference_value ??
    lease?.irlReferenceValue ??
    null;

  const refNum = Number(refValue);
  const newNum = Number(String(newValueRaw || "").replace(",", "."));

  const canCompute =
    Number.isFinite(refNum) &&
    refNum > 0 &&
    Number.isFinite(newNum) &&
    newNum > 0 &&
    currentRent > 0;

  const coef = canCompute ? newNum / refNum : null;
  const nextRent = canCompute ? Math.round(currentRent * coef! * 100) / 100 : null;

  return (
    <div
      style={{
        marginTop: 12,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: 10,
        background: "#fff",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 6 }}>Aperçu (calcul attendu)</div>

      <div style={{ color: muted, fontSize: 12, display: "grid", gap: 4 }}>
        <div>Loyer actuel (contrat) : <b>{currentRent.toFixed(2)} €</b></div>
        <div>IRL référence : <b>{Number.isFinite(refNum) ? refNum : "—"}</b></div>
        <div>IRL nouveau : <b>{Number.isFinite(newNum) ? newNum : "—"}</b></div>

        {canCompute ? (
          <>
            <div>Coefficient : <b>{coef!.toFixed(6)}</b></div>
            <div>Nouveau loyer attendu : <b>{nextRent!.toFixed(2)} €</b></div>
            <div style={{ marginTop: 6 }}>
              (Le backend peut arrondir au centime / gérer des règles spécifiques, mais tu dois retomber très proche.)
            </div>
          </>
        ) : (
          <div style={{ marginTop: 6 }}>
            Renseigne la valeur IRL pour afficher le calcul.
          </div>
        )}
      </div>
    </div>
  );
}