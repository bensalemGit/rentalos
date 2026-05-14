"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Archive,
  Building2,
  CalendarRange,
  BellRing,
  FileSignature,
  FileStack,
  PencilLine,
  ShieldX,
  FilePenLine,
  FolderKanban,
  HandCoins,
  Home,
  PackageSearch,
  Plus,
  RefreshCw,
  Shield,
  Wallet,
  CreditCard,
  FileText,
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
  notice_received_at?: string | null;
  planned_exit_date?: string | null;
  actual_exit_date?: string | null;
  closed_at?: string | null;
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

type Payment = {
  id: string;
  lease_id: string;
  paid_at: string;
  amount_cents: number;
  method: string;
  note?: string | null;
  period_year?: number;
  period_month?: number;
};

type PeriodPaymentStatus = {
  dueCents: number;
  paidCents: number;
  remainingCents: number;
  fullyPaid: boolean;
  occupiedDays?: number;
  daysInMonth?: number;
  prorated?: boolean;
};

function kindLabel(k?: string) {
  const v = String(k || "MEUBLE_RP").toUpperCase();
  if (v === "MEUBLE_RP") return "Meublé (RP)";
  if (v === "NU_RP") return "Nu (RP)";
  if (v === "SAISONNIER") return "Saisonnier";
  return v;
}

function getCurrentPaymentPeriod() {
  const now = new Date();

  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    label: new Intl.DateTimeFormat("fr-FR", {
      month: "short",
      year: "numeric",
    }).format(new Date(now.getFullYear(), now.getMonth(), 1)),
  };
}

function getLeasePaymentStatus(
  lease: Lease,
  payments: Payment[] | undefined,
  periodStatus?: PeriodPaymentStatus | null,
): {
  status: "paid" | "partial" | "unpaid";
  label: string;
  paidCents: number;
  dueCents: number;
  periodLabel: string;
} {
  const period = getCurrentPaymentPeriod();

  const fallbackDueCents =
    Number(lease.rent_cents || 0) + Number(lease.charges_cents || 0);

  const fallbackPaidCents = (payments || [])
    .filter(
      (payment) =>
        Number(payment.period_year) === period.year &&
        Number(payment.period_month) === period.month,
    )
    .reduce((sum, payment) => sum + Number(payment.amount_cents || 0), 0);

  const dueCents = Number(periodStatus?.dueCents ?? fallbackDueCents);
  const paidCents = Number(periodStatus?.paidCents ?? fallbackPaidCents);

  if (dueCents > 0 && paidCents >= dueCents) {
    return {
      status: "paid",
      label: "Payé",
      paidCents,
      dueCents,
      periodLabel: period.label,
    };
  }

  if (paidCents > 0) {
    return {
      status: "partial",
      label: "Partiel",
      paidCents,
      dueCents,
      periodLabel: period.label,
    };
  }

  return {
    status: "unpaid",
    label: "Impayé",
    paidCents,
    dueCents,
    periodLabel: period.label,
  };
}

function paymentStatusChip(status: "paid" | "partial" | "unpaid") {
  if (status === "paid") {
    return {
      border: "rgba(31,157,97,0.16)",
      background: "#ECF9F1",
      color: "#1F7A4D",
    } as const;
  }

  if (status === "partial") {
    return {
      border: "rgba(160,106,44,0.18)",
      background: "#FFF7E8",
      color: "#A06A2C",
    } as const;
  }

  return {
    border: "rgba(220,38,38,0.20)",
    background: "#FFF5F5",
    color: "#A12C2C",
  } as const;
}


export default function LeasesPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [leases, setLeases] = useState<Lease[]>([]);
  const [paymentsByLease, setPaymentsByLease] = useState<Record<string, Payment[]>>({});
  const [paymentStatusByLease, setPaymentStatusByLease] = useState<Record<string, PeriodPaymentStatus | null>>({});
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [showArchives, setShowArchives] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [amendmentModalOpen, setAmendmentModalOpen] = useState(false);
  const [amendmentModalLease, setAmendmentModalLease] = useState<Lease | null>(null);



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

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();

    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
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

      const activeOrNoticeLeases = leasesArr.filter((lease) => lease.status !== "ended");

      const paymentsEntries = await Promise.all(
        activeOrNoticeLeases.map(async (lease) => {
          try {
            const r = await fetch(`${API}/payments?leaseId=${lease.id}`, {
              headers: { Authorization: `Bearer ${token}` },
              credentials: "include",
            });

            const j = await r.json().catch(() => []);
            return [lease.id, Array.isArray(j) ? j : []] as const;
          } catch {
            return [lease.id, []] as const;
          }
        }),
      );

      setPaymentsByLease(Object.fromEntries(paymentsEntries));

      const currentPeriod = getCurrentPaymentPeriod();

      const statusEntries = await Promise.all(
        activeOrNoticeLeases.map(async (lease) => {
          try {
            const r = await fetch(
              `${API}/payments/status?leaseId=${lease.id}&year=${currentPeriod.year}&month=${currentPeriod.month}&t=${Date.now()}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Cache-Control": "no-cache",
                },
                credentials: "include",
                cache: "no-store",
              },
            );

            const j = await r.json().catch(() => null);
            return [lease.id, r.ok ? j : null] as const;
          } catch {
            return [lease.id, null] as const;
          }
        }),
      );

      setPaymentStatusByLease(Object.fromEntries(statusEntries));

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

    const avenantRes = await fetch(`${API}/leases/${irlModalLease.id}/irl/avenant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      body: JSON.stringify({ revisionDate }),
    });

    const avenantTxt = await avenantRes.text().catch(() => "");

    if (!avenantRes.ok) {
      console.error("IRL avenant generation error:", avenantRes.status, avenantTxt);
      setIrlApplyErr(
        `Révision appliquée, mais génération avenant échouée (${avenantRes.status}). Voir console.`,
      );
      await loadAll();
      return;
    }

    setIrlModalOpen(false);
    setIrlModalLease(null);

    await loadAll();
    setStatus("Révision IRL appliquée ✅ Avenant IRL généré.");
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

function openGenericAmendmentModal(lease: Lease) {
  setAmendmentModalLease(lease);
  setAmendmentModalOpen(true);
}

function closeAmendmentModal() {
  setAmendmentModalOpen(false);
  setAmendmentModalLease(null);
}

function goToAddTenantAmendment() {
  if (!amendmentModalLease) return;

  closeAmendmentModal();

  router.push(
    `/dashboard/leases/${amendmentModalLease.id}/amendments/new?type=ADD_TENANT`
  );
}

function goToIrlAmendment() {
  if (!amendmentModalLease) return;

  const id = amendmentModalLease.id;

  closeAmendmentModal();

  router.push(`/dashboard/leases/${id}/amendments/new?type=AVENANT_IRL`);
}

async function generateConsolidatedContract(lease: Lease) {
  router.push(`/sign/${lease.id}`);
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
    const today = new Date().toISOString().slice(0, 10);

    const noticeReceivedAt =
      window.prompt("Date de réception du préavis (YYYY-MM-DD) :", today) || "";

    if (!noticeReceivedAt) return;

    const plannedExitDate =
      window.prompt("Date de sortie prévue (YYYY-MM-DD) :", noticeReceivedAt) || "";

    if (!plannedExitDate) return;

    setError("");
    setStatus("Passage en préavis…");

    try {
      const r = await fetch(`${API}/leases/${id}/notice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          noticeReceivedAt,
          plannedExitDate,
        }),
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
    const lease = leases.find((x) => x.id === id);
    const defaultExitDate =
      String(lease?.planned_exit_date || "").slice(0, 10) ||
      new Date().toISOString().slice(0, 10);

    const actualExitDate =
      window.prompt("Date de sortie effective (YYYY-MM-DD) :", defaultExitDate) || "";

    if (!actualExitDate) return;

    const ok = window.confirm(
      "Clôturer ce bail ?\n\n" +
        "La clôture sera refusée si l’EDL sortie signé final ou l’inventaire sortie signé final sont manquants.",
    );

    if (!ok) return;

    setError("");
    setStatus("Clôture…");

    try {
      const r = await fetch(`${API}/leases/${id}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ actualExitDate }),
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
        width: "100%",
        maxWidth: 1280,
        boxSizing: "border-box",
        margin: "0 auto",
        padding: isMobile ? "18px 14px 48px" : "32px 36px 56px",
        background: shellBg,
        minHeight: "100vh",
        overflowX: isMobile ? "hidden" : undefined,
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
              fontSize: isMobile ? 28 : 34,
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

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            width: isMobile ? "100%" : "auto",
          }}
        >
          <button
            type="button"
            onClick={() => {
              router.push("/dashboard/leases/new");
            }}
            style={{
            ...btnPrimaryWide(blue),
            flex: isMobile ? "1 1 100%" : undefined,
            justifyContent: "center",
            minHeight: 44,
          }}
          >
            <>
              <Plus size={16} strokeWidth={2.3} />
              Nouveau bail
            </>
          </button>

          <button onClick={loadAll} style={{
                                      ...btnSecondary(border),
                                      flex: isMobile ? "1 1 100%" : undefined,
                                      justifyContent: "center",
                                      minHeight: 44,
                                    }}>
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

                  const paymentStatus = getLeasePaymentStatus(
                    l,
                    paymentsByLease[l.id],
                    paymentStatusByLease[l.id],
                  );
                  const paymentTone = paymentStatusChip(paymentStatus.status);


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
                          gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) auto",
                          gap: 18,
                          alignItems: "center",
                          padding: isMobile ? "16px 14px 12px" : "18px 22px 14px",
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
                          {!isMobile && (
                            <div style={premiumActionsRailStyle()}>
                              <button
                                type="button"
                                title="Modifier"
                                onClick={() => router.push(`/dashboard/leases/${l.id}/edit`)}
                                style={premiumIconButtonStyle(border)}
                              >
                                <PencilLine size={20} strokeWidth={1.9} />
                              </button>

                              <button
                                type="button"
                                title="Avenants"
                                onClick={() => openGenericAmendmentModal(l)}
                                style={premiumIconButtonStyle(border, "primary")}
                              >
                                <FileSignature size={20} strokeWidth={1.9} />
                              </button>

                              <button
                                type="button"
                                title="Contrat consolidé"
                                onClick={() => generateConsolidatedContract(l)}
                                style={premiumIconButtonStyle(border)}
                              >
                                <FileStack size={20} strokeWidth={1.9} />
                              </button>

                              <button
                                type="button"
                                title={l.status === "notice" ? "Annuler préavis" : "Préavis"}
                                onClick={() =>
                                  l.status === "notice" ? cancelNoticeLease(l.id) : setNoticeLease(l.id)
                                }
                                style={premiumIconButtonStyle(border)}
                              >
                                <BellRing size={20} strokeWidth={1.9} />
                              </button>

                              <button
                                type="button"
                                title="Clôturer"
                                onClick={() => closeLease(l.id)}
                                style={premiumIconButtonStyle(border, "danger")}
                              >
                                <ShieldX size={20} strokeWidth={1.9} />
                              </button>
                            </div>
                          )}

                          {l.status === "draft" ? (
                            <button onClick={() => activateLease(l.id)} style={{
                              ...btnCompactPrimary(blue),
                              minWidth: isMobile ? "100%" : 170,
                              width: isMobile ? "100%" : undefined,
                              justifyContent: "center",
                              minHeight: 44,
                            }}>
                              <ArrowRightLeft size={16} strokeWidth={2.2} />
                              {primaryLabel}
                            </button>
                          ) : (
                            <Link href={`/sign/${l.id}`}>
                              <button style={{
                                ...btnCompactPrimary(blue),
                                minWidth: isMobile ? "100%" : 170,
                                width: isMobile ? "100%" : undefined,
                                justifyContent: "center",
                                minHeight: 44,
                              }}>
                                <FilePenLine size={16} strokeWidth={2.2} />
                                {primaryLabel}
                              </button>
                            </Link>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr",
                          gap: 12,
                          alignItems: "center",
                          padding: isMobile ? "0 14px 14px" : "0 22px 14px",
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
                            {l.status === "notice" && l.planned_exit_date ? (
                              <span
                                style={{
                                  ...chip("rgba(160,106,44,0.18)", "#A06A2C"),
                                  background: "#FBF2E8",
                                  padding: "4px 10px",
                                  fontSize: 12,
                                }}
                              >
                                Sortie prévue {String(l.planned_exit_date).slice(0, 10)}
                              </span>
                            ) : null}
                          </span>

                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                            <Wallet size={13} strokeWidth={2} color={softText} />
                            {(l.rent_cents / 100).toFixed(0)} € + {(l.charges_cents / 100).toFixed(0)} €
                          </span>

                          <Link
                            href={`/dashboard/leases/${l.id}/payments`}
                            style={{ textDecoration: "none" }}
                          >
                            <span
                              title={`${paymentStatus.periodLabel} · ${paymentStatus.paidCents / 100}€ / ${paymentStatus.dueCents / 100}€`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 7,
                                padding: "5px 10px",
                                borderRadius: 999,
                                border: `1px solid ${paymentTone.border}`,
                                background: paymentTone.background,
                                color: paymentTone.color,
                                fontSize: 12,
                                fontWeight: 800,
                                lineHeight: 1,
                                cursor: "pointer",
                              }}
                            >
                              <CreditCard size={13} strokeWidth={2.1} />
                              {paymentStatus.periodLabel} · {paymentStatus.label}
                            </span>
                          </Link>

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
                          padding: isMobile ? "12px 14px 14px" : "12px 22px 14px",
                          display: isMobile ? "grid" : "flex",
                          gridTemplateColumns: isMobile ? "1fr 1fr" : undefined,
                          gap: 10,
                          flexWrap: isMobile ? undefined : "wrap",
                          alignItems: "center",
                          background: "#FBFCFE",
                        }}
                      >
                        <Link href={`/import/${l.id}`}>
                          <button style={{
                                    ...docChipButton(border),
                                    width: isMobile ? "100%" : undefined,
                                    justifyContent: isMobile ? "center" : undefined,
                                    minHeight: isMobile ? 44 : 38,
                                  }}>
                            <Building2 size={14} strokeWidth={2.1} />
                            Import
                          </button>
                        </Link>

                        {!isMobile && (
                          <span
                            style={{
                              width: 1,
                              height: 22,
                              background: "rgba(27,39,64,0.10)",
                              display: "inline-block",
                            }}
                          />
                        )}

                        <Link href={`/guarantor-act/${l.id}`}>
                          <button style={{
                                    ...docChipButton(border),
                                    width: isMobile ? "100%" : undefined,
                                    justifyContent: isMobile ? "center" : undefined,
                                    minHeight: isMobile ? 44 : 38,
                                  }}>
                            <Shield size={14} strokeWidth={2.1} /> Acte caution
                          </button>
                        </Link>

                        <Link href={`/edl/${l.id}`}>
                          <button style={{
                                    ...docChipButton(border),
                                    width: isMobile ? "100%" : undefined,
                                    justifyContent: isMobile ? "center" : undefined,
                                    minHeight: isMobile ? 44 : 38,
                                  }}>
                            <FolderKanban size={14} strokeWidth={2.1} /> EDL
                          </button>
                        </Link>

                        <Link href={`/inventory/${l.id}`}>
                          <button style={{
                                    ...docChipButton(border),
                                    width: isMobile ? "100%" : undefined,
                                    justifyContent: isMobile ? "center" : undefined,
                                    minHeight: isMobile ? 44 : 38,
                                  }}>
                            <PackageSearch size={14} strokeWidth={2.1} /> Inventaire
                          </button>
                        </Link>
                        {!isMobile && (
                          <span
                            style={{
                              width: 1,
                              height: 22,
                              background: "rgba(27,39,64,0.10)",
                              display: "inline-block",
                            }}
                          />
                        )}

                        <Link href={`/dashboard/leases/${l.id}/payments`}>
                          <button style={{
                                    ...docChipButton(border),
                                    width: isMobile ? "100%" : undefined,
                                    justifyContent: isMobile ? "center" : undefined,
                                    minHeight: isMobile ? 44 : 38,
                                  }}>
                            <CreditCard size={14} strokeWidth={2.1} /> Paiements & solde
                          </button>
                        </Link>

                        {!isMobile && (
                          <span
                            style={{
                              width: 1,
                              height: 22,
                              background: "rgba(27,39,64,0.10)",
                              display: "inline-block",
                            }}
                          />
                        )}

                        <Link href={`/dashboard/leases/${l.id}/amendments`}>
                          <button
                            style={{
                              ...docChipButton(border),
                              width: isMobile ? "100%" : undefined,
                              justifyContent: isMobile ? "center" : undefined,
                              minHeight: isMobile ? 44 : 38,
                            }}
                          >
                            <FileSignature size={14} strokeWidth={2.1} /> Avenants
                          </button>
                        </Link>

                        {!isMobile && (
                          <span
                            style={{
                              width: 1,
                              height: 22,
                              background: "rgba(27,39,64,0.10)",
                              display: "inline-block",
                            }}
                          />
                        )}

                        <Link href={`/dashboard/leases/${l.id}/documents`}>
                          <button
                            style={{
                              ...docChipButton(border),
                              width: isMobile ? "100%" : undefined,
                              justifyContent: isMobile ? "center" : undefined,
                              minHeight: isMobile ? 44 : 38,
                            }}
                          >
                            <FileText size={14} strokeWidth={2.1} /> Documents
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
                      gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) auto",
                      gap: 18,
                      alignItems: "center",
                      padding: isMobile ? "16px 14px 12px" : "18px 22px 14px",
                    }}
                  >
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

                    <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <Link href={`/sign/${l.id}`}>
                        <button
                          style={{
                            ...btnCompactPrimary(blue),
                            minWidth: isMobile ? "100%" : 170,
                            width: isMobile ? "100%" : undefined,
                            justifyContent: "center",
                            minHeight: 44,
                          }}
                        >
                          <Archive size={16} strokeWidth={2.2} />
                          Voir l’archive
                        </button>
                      </Link>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", color: muted, fontSize: 13.5, padding: "0 22px 14px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><CalendarRange size={13} strokeWidth={2} color={softText} />{String(l.start_date).slice(0, 10)} → {String(l.end_date_theoretical).slice(0, 10)}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Wallet size={13} strokeWidth={2} color={softText} />{(l.rent_cents / 100).toFixed(0)} € HC</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Shield size={13} strokeWidth={2} color={softText} />{(l.deposit_cents / 100).toFixed(0)} €</span>
                  </div>

                  <div
                    style={{
                      borderTop: `1px solid ${line}`,
                      padding: isMobile ? "12px 14px 14px" : "12px 22px 14px",
                      display: isMobile ? "grid" : "flex",
                      gridTemplateColumns: isMobile ? "1fr 1fr" : undefined,
                      gap: 10,
                      flexWrap: isMobile ? undefined : "wrap",
                      alignItems: "center",
                      background: "#FBFCFE",
                    }}
                  >
                    <Link href={`/import/${l.id}`}>
                      <button
                        style={{
                          ...docChipButton(border),
                          width: isMobile ? "100%" : undefined,
                          justifyContent: isMobile ? "center" : undefined,
                          minHeight: isMobile ? 44 : 38,
                        }}
                      >
                        <Building2 size={14} strokeWidth={2.1} />
                        Import
                      </button>
                    </Link>

                    {!isMobile && (
                      <span
                        style={{
                          width: 1,
                          height: 22,
                          background: "rgba(27,39,64,0.10)",
                          display: "inline-block",
                        }}
                      />
                    )}

                    <Link href={`/guarantor-act/${l.id}`}>
                      <button
                        style={{
                          ...docChipButton(border),
                          width: isMobile ? "100%" : undefined,
                          justifyContent: isMobile ? "center" : undefined,
                          minHeight: isMobile ? 44 : 38,
                        }}
                      >
                        <Shield size={14} strokeWidth={2.1} /> Acte caution
                      </button>
                    </Link>

                    <Link href={`/edl/${l.id}`}>
                      <button
                        style={{
                          ...docChipButton(border),
                          width: isMobile ? "100%" : undefined,
                          justifyContent: isMobile ? "center" : undefined,
                          minHeight: isMobile ? 44 : 38,
                        }}
                      >
                        <FolderKanban size={14} strokeWidth={2.1} /> EDL
                      </button>
                    </Link>

                    <Link href={`/inventory/${l.id}`}>
                      <button
                        style={{
                          ...docChipButton(border),
                          width: isMobile ? "100%" : undefined,
                          justifyContent: isMobile ? "center" : undefined,
                          minHeight: isMobile ? 44 : 38,
                        }}
                      >
                        <PackageSearch size={14} strokeWidth={2.1} /> Inventaire
                      </button>
                    </Link>

                    {!isMobile && (
                      <span
                        style={{
                          width: 1,
                          height: 22,
                          background: "rgba(27,39,64,0.10)",
                          display: "inline-block",
                        }}
                      />
                    )}

                    <Link href={`/dashboard/leases/${l.id}/payments`}>
                      <button
                        style={{
                          ...docChipButton(border),
                          width: isMobile ? "100%" : undefined,
                          justifyContent: isMobile ? "center" : undefined,
                          minHeight: isMobile ? 44 : 38,
                        }}
                      >
                        <CreditCard size={14} strokeWidth={2.1} /> Paiements & solde
                      </button>
                    </Link>

                    {!isMobile && (
                      <span
                        style={{
                          width: 1,
                          height: 22,
                          background: "rgba(27,39,64,0.10)",
                          display: "inline-block",
                        }}
                      />
                    )}

                    <Link href={`/dashboard/leases/${l.id}/documents`}>
                      <button
                        style={{
                          ...docChipButton(border),
                          width: isMobile ? "100%" : undefined,
                          justifyContent: isMobile ? "center" : undefined,
                          minHeight: isMobile ? 44 : 38,
                        }}
                      >
                        <FileText size={14} strokeWidth={2.1} /> Documents
                      </button>
                    </Link>
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
  {amendmentModalOpen && amendmentModalLease && (
    <div
      style={modalOverlayStyle()}
      onClick={closeAmendmentModal}
    >
      <div
        style={amendmentModalStyle(border)}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: softText, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Avenant
            </div>
            <div style={{ marginTop: 6, fontSize: 22, fontWeight: 950, color: title, letterSpacing: "-0.04em" }}>
              Générer un avenant
            </div>
            <div style={{ marginTop: 6, fontSize: 13.5, color: muted }}>
              {amendmentModalLease.unit_code || amendmentModalLease.unit_id} — {amendmentModalLease.tenant_name || amendmentModalLease.tenant_id}
            </div>
          </div>

          <button type="button" onClick={closeAmendmentModal} style={btnSecondary(border)}>
            Fermer
          </button>
        </div>

        <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
          <button
            type="button"
            onClick={goToAddTenantAmendment}
            style={amendmentTypeButtonStyle(border, true)}
          >
            <span style={amendmentTypeIconStyle("#3467EB", "#EEF4FF")}>
              <FileSignature size={20} strokeWidth={2} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 900, color: title }}>
                Ajout locataire
              </span>
              <span style={{ display: "block", marginTop: 3, fontSize: 12.5, color: muted }}>
                Créer un avenant pour ajouter un colocataire au bail.
              </span>
            </span>
          </button>

          <button
              type="button"
              onClick={goToIrlAmendment}
              style={amendmentTypeButtonStyle(border, true)}
            >
              <span style={amendmentTypeIconStyle("#3467EB", "#EEF4FF")}>
                <HandCoins size={20} strokeWidth={2} />
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontWeight: 900, color: title }}>
                  Révision IRL
                </span>
                <span style={{ display: "block", marginTop: 3, fontSize: 12.5, color: muted }}>
                  Appliquer une révision annuelle du loyer.
                </span>
              </span>
            </button>

          {[
            "Départ locataire",
            "Modification loyer",
            "Changement charges",
            "Changement garant",
          ].map((label) => (
            <button
              key={label}
              type="button"
              disabled
              style={amendmentTypeButtonStyle(border, false)}
            >
              <span style={amendmentTypeIconStyle("#8D99AE", "#F8FAFC")}>
                <FileStack size={20} strokeWidth={2} />
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontWeight: 900, color: "#8D99AE" }}>
                  {label}
                </span>
                <span style={{ display: "block", marginTop: 3, fontSize: 12.5, color: "#A3ADBD" }}>
                  Bientôt disponible.
                </span>
              </span>
            </button>
          ))}
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

function modalOverlayStyle(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.42)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "48px 16px",
    zIndex: 80,
  };
}

function amendmentModalStyle(border: string): React.CSSProperties {
  return {
    width: "min(620px, 100%)",
    borderRadius: 24,
    border: `1px solid ${border}`,
    background: "#fff",
    boxShadow: "0 28px 80px rgba(16,24,40,0.24)",
    padding: 20,
  };
}

function amendmentTypeButtonStyle(border: string, active: boolean): React.CSSProperties {
  return {
    width: "100%",
    border: active ? "1px solid rgba(52,103,235,0.16)" : `1px solid ${border}`,
    background: active ? "#FFFFFF" : "#FBFCFE",
    borderRadius: 18,
    padding: 14,
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: active ? "pointer" : "not-allowed",
    opacity: active ? 1 : 0.72,
    textAlign: "left",
    boxShadow: active ? "0 10px 28px rgba(16,24,40,0.07)" : "none",
  };
}

function amendmentTypeIconStyle(color: string, background: string): React.CSSProperties {
  return {
    width: 44,
    height: 44,
    borderRadius: 16,
    background,
    color,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
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

function premiumActionsRailStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: 7,
    borderRadius: 20,
    border: "1px solid rgba(27,39,64,0.08)",
    background: "rgba(255,255,255,0.78)",
    backdropFilter: "blur(14px)",
    boxShadow: "0 14px 34px rgba(16,24,40,0.10)",
    flexShrink: 0,
  };
}

function premiumIconButtonStyle(
  border: string,
  tone?: "primary" | "danger",
): React.CSSProperties {
  const isPrimary = tone === "primary";
  const isDanger = tone === "danger";

  return {
    width: 46,
    height: 46,
    borderRadius: 16,
    border: `1px solid ${
      isPrimary
        ? "rgba(52,103,235,0.16)"
        : isDanger
          ? "rgba(220,38,38,0.16)"
          : border
    }`,
    background: isPrimary ? "#EEF4FF" : isDanger ? "#FFF1F4" : "#fff",
    color: isPrimary ? "#3467EB" : isDanger ? "#A12C52" : "#243247",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: isPrimary
      ? "0 12px 28px rgba(52,103,235,0.16)"
      : "0 8px 20px rgba(16,24,40,0.06)",
  };
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