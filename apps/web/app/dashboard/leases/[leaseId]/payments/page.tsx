"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  Plus,
  RefreshCw,
  Trash2,
  CalendarDays,
  Wallet,
  Download,
  FileText,
} from "lucide-react";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type Payment = {
  id: string;
  lease_id: string;
  paid_at: string;
  amount_cents: number;
  method: string;
  note?: string | null;
  created_at?: string;
  period_year?: number;
  period_month?: number;
};

type Receipt = {
  id: string;
  lease_id: string;
  period_year: number;
  period_month: number;
  total_rent_cents: number;
  total_charges_cents: number;
  document_id?: string | null;
  filename?: string | null;
  document_created_at?: string | null;
};

type Lease = {
  id: string;
  unit_code?: string;
  tenant_name?: string;
  rent_cents?: number;
  charges_cents?: number;
  deposit_cents?: number;
};

type DepositDeduction = {
  id: string;
  lease_id: string;
  label: string;
  amount_cents: number;
};

type PaymentStatus = "paid" | "partial" | "unpaid";

function formatEuros(cents: number) {
  return `${(Number(cents || 0) / 100).toFixed(2).replace(".", ",")} €`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("fr-FR");
}

function formatPeriod(payment: Payment) {
  if (!payment.period_year || !payment.period_month) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(payment.period_year, payment.period_month - 1, 1));
}

export default function LeasePaymentsPage({
  params,
}: {
  params: { leaseId: string };
}) {
  const router = useRouter();
  const leaseId = params.leaseId;

  const [token, setToken] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [deductions, setDeductions] = useState<DepositDeduction[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [lease, setLease] = useState<Lease | null>(null);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const now = new Date();
  const [periodYear, setPeriodYear] = useState(String(now.getFullYear()));
  const [periodMonth, setPeriodMonth] = useState(String(now.getMonth() + 1));
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("virement");
  const [note, setNote] = useState("");

  const [isMobile, setIsMobile] = useState(false);

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
    if (!token) return;

    setLoading(true);
    setError("");
    setStatus("");

    try {
      const [paymentsRes, receiptsRes, deductionsRes, leasesRes] = await Promise.all([
        fetch(`${API}/payments?leaseId=${leaseId}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }),
        fetch(`${API}/receipts?leaseId=${leaseId}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }),
        fetch(`${API}/lease-deposit?leaseId=${leaseId}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }),
        fetch(`${API}/leases`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }),
      ]);

      const paymentsJson = await paymentsRes.json().catch(() => []);
      const receiptsJson = await receiptsRes.json().catch(() => []);
      const deductionsJson = await deductionsRes.json().catch(() => []);
      const leasesJson = await leasesRes.json().catch(() => []);

      if (!paymentsRes.ok) {
        throw new Error(paymentsJson?.message || "Erreur chargement paiements");
      }

      if (!receiptsRes.ok) {
        throw new Error(receiptsJson?.message || "Erreur chargement quittances");
      }

      if (!deductionsRes.ok) {
        throw new Error(deductionsJson?.message || "Erreur chargement dépôt de garantie");
      }

      setPayments(Array.isArray(paymentsJson) ? paymentsJson : []);
      setReceipts(Array.isArray(receiptsJson) ? receiptsJson : []);
      setDeductions(Array.isArray(deductionsJson) ? deductionsJson : []);

      const leaseList = Array.isArray(leasesJson) ? leasesJson : [];
      setLease(leaseList.find((l: Lease) => l.id === leaseId) || null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, leaseId]);

  const totalPaidCents = useMemo(() => {
    return payments.reduce((sum, p) => sum + Number(p.amount_cents || 0), 0);
  }, [payments]);

  const monthlyDueCents =
    Number(lease?.rent_cents || 0) + Number(lease?.charges_cents || 0);

  const depositCents = Number(lease?.deposit_cents || 0);

  const totalDeductionsCents = deductions.reduce(
    (sum, deduction) => sum + Number(deduction.amount_cents || 0),
    0,
  );

  const restitutionCents = Math.max(0, depositCents - totalDeductionsCents);

  const remainingCents = Math.max(0, monthlyDueCents - totalPaidCents);

  const paymentStatus: PaymentStatus =
    monthlyDueCents > 0 && totalPaidCents >= monthlyDueCents
      ? "paid"
      : totalPaidCents > 0
        ? "partial"
        : "unpaid";

  const currentPeriodReceipt = useMemo(() => {
    const py = Number(periodYear);
    const pm = Number(periodMonth);

    return (
      receipts.find(
        (r) =>
          Number(r.period_year) === py &&
          Number(r.period_month) === pm &&
          r.document_id,
      ) || null
    );
  }, [receipts, periodYear, periodMonth]);

  async function downloadDocument(documentId: string, filename?: string | null) {
    setError("");
    setStatus("Téléchargement…");

    try {
      const r = await fetch(`${API}/documents/${documentId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`Erreur téléchargement: ${txt || r.status}`);
      }

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `quittance_${leaseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setStatus("Téléchargé ✅");
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function addPayment() {
    const amountNumber = Number(String(amount).replace(",", "."));
    const amountCents = Math.round(amountNumber * 100);
    const py = Number(periodYear);
    const pm = Number(periodMonth);

    if (!Number.isFinite(py) || !Number.isFinite(pm) || pm < 1 || pm > 12) {
      return setError("Période concernée invalide.");
    }

    if (!paidAt) return setError("Date de paiement obligatoire.");
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return setError("Montant invalide.");
    }

    setBusy(true);
    setError("");
    setStatus("Ajout du paiement…");

    try {
      const r = await fetch(`${API}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          leaseId,
          paidAt,
          amountCents,
          method,
          note: note.trim() || null,
          periodYear: py,
          periodMonth: pm,
        }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        throw new Error(j?.message || JSON.stringify(j));
      }

      setModalOpen(false);
      setAmount("");
      setNote("");
      setStatus("Paiement ajouté ✅");
      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function deletePayment(payment: Payment) {
    const ok = window.confirm(
      `Supprimer le paiement du ${formatDate(payment.paid_at)} de ${formatEuros(payment.amount_cents)} ?`,
    );

    if (!ok) return;

    setBusy(true);
    setError("");
    setStatus("Suppression du paiement…");

    try {
      const r = await fetch(`${API}/payments/${payment.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        throw new Error(j?.message || JSON.stringify(j));
      }

      setStatus("Paiement supprimé ✅");
      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function addDepositDeduction() {
    const label = window.prompt("Motif de la retenue ?", "Ménage");
    if (!label) return;

    const amountRaw = window.prompt("Montant de la retenue (€) ?", "0");
    if (!amountRaw) return;

    const amount = Number(String(amountRaw).replace(",", "."));
    const amountCents = Math.round(amount * 100);

    if (!Number.isFinite(amountCents) || amountCents < 0) {
      setError("Montant de retenue invalide.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus("Ajout de la retenue…");

    try {
      const r = await fetch(`${API}/lease-deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          leaseId,
          label: label.trim(),
          amountCents,
        }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        throw new Error(j?.message || JSON.stringify(j));
      }

      setStatus("Retenue ajoutée ✅");
      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteDepositDeduction(deduction: DepositDeduction) {
    const ok = window.confirm(
      `Supprimer la retenue "${deduction.label}" de ${formatEuros(deduction.amount_cents)} ?`,
    );

    if (!ok) return;

    setBusy(true);
    setError("");
    setStatus("Suppression de la retenue…");

    try {
      const r = await fetch(`${API}/lease-deposit/${deduction.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        throw new Error(j?.message || JSON.stringify(j));
      }

      setStatus("Retenue supprimée ✅");
      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function generateDepositSummary() {
    setBusy(true);
    setError("");
    setStatus("Génération du solde de sortie…");

    try {
      const r = await fetch(`${API}/lease-deposit/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ leaseId }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        throw new Error(j?.message || JSON.stringify(j));
      }

      const documentId = j?.document?.id;
      const filename = j?.document?.filename || `SOLDE_SORTIE_${leaseId}.pdf`;

      if (!documentId) {
        throw new Error("Document généré mais id introuvable.");
      }

      await downloadDocument(documentId, filename);
      setStatus("Solde de sortie généré ✅");
      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

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
        overflowX: "hidden",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-start",
          marginBottom: 20,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <button
            type="button"
            onClick={() => router.push("/dashboard/leases")}
            style={ghostButton(border)}
          >
            <ArrowLeft size={15} strokeWidth={2.2} />
            Retour aux baux
          </button>

          <h2
            style={{
              marginTop: 18,
              marginBottom: 8,
              fontSize: isMobile ? 28 : 34,
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              color: title,
              fontWeight: 900,
            }}
          >
            Paiements
          </h2>

          <p style={{ margin: 0, fontSize: 15, color: muted, lineHeight: 1.65 }}>
            {lease
              ? `${lease.unit_code || "Logement"} — ${lease.tenant_name || "Locataire"}`
              : "Suivi des paiements du bail"}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            width: isMobile ? "100%" : "auto",
          }}
        >
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            style={{
              ...primaryButton(blue),
              width: isMobile ? "100%" : undefined,
              justifyContent: "center",
            }}
          >
            <Plus size={16} strokeWidth={2.3} />
            Ajouter un paiement
          </button>

          <button
            type="button"
            onClick={loadAll}
            style={{
              ...secondaryButton(border),
              width: isMobile ? "100%" : undefined,
              justifyContent: "center",
            }}
          >
            <RefreshCw size={14} strokeWidth={2.2} />
            Rafraîchir
          </button>
        </div>
      </div>

      {status ? <div style={successBox}>{status}</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}

      <PaymentStatusBanner
        status={paymentStatus}
        paidCents={totalPaidCents}
        dueCents={monthlyDueCents}
        remainingCents={remainingCents}
        isMobile={isMobile}
      />

      <section
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <SummaryCard
          icon={<Wallet size={18} strokeWidth={2.2} />}
          label="Total encaissé"
          value={formatEuros(totalPaidCents)}
          border={cardBorder}
          muted={muted}
          title={title}
          blue={blue}
        />

        <SummaryCard
          icon={<CalendarDays size={18} strokeWidth={2.2} />}
          label="Échéance mensuelle"
          value={monthlyDueCents > 0 ? formatEuros(monthlyDueCents) : "—"}
          border={cardBorder}
          muted={muted}
          title={title}
          blue={blue}
        />

        <SummaryCard
          icon={<CreditCard size={18} strokeWidth={2.2} />}
          label="Nombre de paiements"
          value={String(payments.length)}
          border={cardBorder}
          muted={muted}
          title={title}
          blue={blue}
        />
      </section>

      <section
        style={{
          border: `1px solid ${cardBorder}`,
          borderRadius: 20,
          background: "#fff",
          boxShadow: "0 10px 30px rgba(16,24,40,0.05)",
          padding: isMobile ? "16px 14px" : "18px 22px",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 15,
              background: "#EEF4FF",
              color: blue,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FileText size={18} strokeWidth={2.2} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: title }}>
              Quittance de la période
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: softText }}>
              {currentPeriodReceipt?.document_id
                ? `Disponible pour ${new Intl.DateTimeFormat("fr-FR", {
                    month: "long",
                    year: "numeric",
                  }).format(new Date(Number(periodYear), Number(periodMonth) - 1, 1))}`
                : paymentStatus === "paid"
                  ? "Payé : la quittance sera disponible après génération automatique."
                  : "Disponible uniquement lorsque la période est entièrement payée."}
            </div>
          </div>
        </div>

        {currentPeriodReceipt?.document_id ? (
          <button
            type="button"
            onClick={() =>
              downloadDocument(
                currentPeriodReceipt.document_id!,
                currentPeriodReceipt.filename ||
                  `QUITTANCE_${periodMonth}-${periodYear}.pdf`,
              )
            }
            style={{
              ...primaryButton(blue),
              width: isMobile ? "100%" : undefined,
              justifyContent: "center",
            }}
          >
            <Download size={15} strokeWidth={2.2} />
            Télécharger la quittance
          </button>
        ) : (
          <button
            type="button"
            disabled
            style={{
              ...secondaryButton(border),
              width: isMobile ? "100%" : undefined,
              justifyContent: "center",
              opacity: 0.55,
              cursor: "not-allowed",
            }}
          >
            <FileText size={15} strokeWidth={2.2} />
            Aucune quittance
          </button>
        )}
      </section>

      <section
        style={{
          border: `1px solid ${cardBorder}`,
          borderRadius: 20,
          background: "#fff",
          boxShadow: "0 10px 30px rgba(16,24,40,0.05)",
          padding: isMobile ? "16px 14px" : "18px 22px",
          marginBottom: 16,
          display: "grid",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: title }}>
              Dépôt de garantie & retenues
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: softText }}>
              Suivi du solde de sortie du locataire.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              width: isMobile ? "100%" : "auto",
            }}
          >
            <button
              type="button"
              onClick={generateDepositSummary}
              disabled={busy}
              style={{
                ...secondaryButton(border),
                width: isMobile ? "100%" : undefined,
                justifyContent: "center",
              }}
            >
              <Download size={15} strokeWidth={2.2} />
              Générer solde PDF
            </button>

            <button
              type="button"
              onClick={addDepositDeduction}
              disabled={busy}
              style={{
                ...primaryButton(blue),
                width: isMobile ? "100%" : undefined,
                justifyContent: "center",
              }}
            >
              <Plus size={15} strokeWidth={2.2} />
              Ajouter une retenue
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <SummaryCard
            icon={<Wallet size={18} strokeWidth={2.2} />}
            label="Dépôt versé"
            value={formatEuros(depositCents)}
            border={cardBorder}
            muted={muted}
            title={title}
            blue={blue}
          />

          <SummaryCard
            icon={<Trash2 size={18} strokeWidth={2.2} />}
            label="Retenues"
            value={formatEuros(totalDeductionsCents)}
            border={cardBorder}
            muted={muted}
            title={title}
            blue={blue}
          />

          <SummaryCard
            icon={<CreditCard size={18} strokeWidth={2.2} />}
            label="À restituer"
            value={formatEuros(restitutionCents)}
            border={cardBorder}
            muted={muted}
            title={title}
            blue={blue}
          />
        </div>

        {deductions.length === 0 ? (
          <div
            style={{
              padding: "12px 0 0",
              borderTop: `1px solid ${line}`,
              color: muted,
              fontSize: 13,
            }}
          >
            Aucune retenue enregistrée.
          </div>
        ) : (
          <div style={{ borderTop: `1px solid ${line}` }}>
            {deductions.map((deduction, index) => (
              <div
                key={deduction.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) 140px auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 0",
                  borderTop: index === 0 ? "none" : `1px solid ${line}`,
                }}
              >
                <div style={cellBlock(isMobile)}>
                  <span style={cellLabel}>Motif</span>
                  <span style={cellValue(title)}>{deduction.label}</span>
                </div>

                <div style={cellBlock(isMobile)}>
                  <span style={cellLabel}>Montant</span>
                  <span style={{ ...cellValue(title), fontWeight: 900 }}>
                    {formatEuros(deduction.amount_cents)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => deleteDepositDeduction(deduction)}
                  disabled={busy}
                  style={{
                    ...dangerButton(),
                    width: isMobile ? "100%" : undefined,
                    justifyContent: "center",
                  }}
                >
                  <Trash2 size={14} strokeWidth={2.1} />
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        style={{
          border: `1px solid ${cardBorder}`,
          borderRadius: 20,
          background: "#fff",
          boxShadow: "0 10px 30px rgba(16,24,40,0.05)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: isMobile ? "16px 14px" : "18px 22px",
            borderBottom: `1px solid ${line}`,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: title }}>
              Historique des paiements
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: softText }}>
              Les quittances pourront être générées à partir des paiements encaissés.
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 18, color: muted }}>Chargement…</div>
        ) : payments.length === 0 ? (
          <div style={{ padding: 18, color: muted }}>
            Aucun paiement enregistré pour ce bail.
          </div>
        ) : (
          <div>
            {payments.map((payment, index) => (
              <div
                key={payment.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "130px 130px 130px 130px minmax(0, 1fr) auto",
                  gap: isMobile ? 8 : 14,
                  alignItems: "center",
                  padding: isMobile ? "16px 14px" : "14px 22px",
                  borderTop: index === 0 ? "none" : `1px solid ${line}`,
                }}
              >
                <div style={cellBlock(isMobile)}>
                  <span style={cellLabel}>Date</span>
                  <span style={cellValue(title)}>{formatDate(payment.paid_at)}</span>
                </div>

                <div style={cellBlock(isMobile)}>
                  <span style={cellLabel}>Période</span>
                  <span style={cellValue(title)}>{formatPeriod(payment)}</span>
                </div>

                <div style={cellBlock(isMobile)}>
                  <span style={cellLabel}>Montant</span>
                  <span style={{ ...cellValue(title), fontWeight: 900 }}>
                    {formatEuros(payment.amount_cents)}
                  </span>
                </div>

                <div style={cellBlock(isMobile)}>
                  <span style={cellLabel}>Méthode</span>
                  <span style={methodPill}>{payment.method || "—"}</span>
                </div>

                <div style={cellBlock(isMobile)}>
                  <span style={cellLabel}>Note</span>
                  <span style={cellValue(muted)}>{payment.note || "—"}</span>
                </div>

                <button
                  type="button"
                  onClick={() => deletePayment(payment)}
                  disabled={busy}
                  style={{
                    ...dangerButton(),
                    width: isMobile ? "100%" : undefined,
                    justifyContent: "center",
                  }}
                >
                  <Trash2 size={14} strokeWidth={2.1} />
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {modalOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.42)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "24px 14px",
            overflowY: "auto",
            zIndex: 100,
          }}
          onClick={() => {
            if (!busy) setModalOpen(false);
          }}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              background: "#fff",
              borderRadius: 20,
              border: `1px solid ${cardBorder}`,
              boxShadow: "0 18px 44px rgba(16,24,40,0.16)",
              padding: 18,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 900, color: title }}>
              Ajouter un paiement
            </div>

            <div style={{ marginTop: 6, fontSize: 13, color: muted }}>
              Enregistre un encaissement réel du locataire.
            </div>

            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              <label style={labelStyle(muted)}>
                Date du paiement
                <input
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  style={inputStyle(border)}
                />
              </label>

              <label style={labelStyle(muted)}>
                Montant payé
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="ex: 533,34"
                  inputMode="decimal"
                  style={inputStyle(border)}
                />
              </label>

              <label style={labelStyle(muted)}>
                Méthode
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  style={inputStyle(border)}
                >
                  <option value="virement">Virement</option>
                  <option value="cheque">Chèque</option>
                  <option value="especes">Espèces</option>
                  <option value="prelevement">Prélèvement</option>
                  <option value="autre">Autre</option>
                </select>
              </label>

              <label style={labelStyle(muted)}>
                Note
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="ex: Paiement prorata avril 2026"
                  style={inputStyle(border)}
                />
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <label style={labelStyle(muted)}>
                Mois concerné
                <select
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(e.target.value)}
                  style={inputStyle(border)}
                >
                  <option value="1">Janvier</option>
                  <option value="2">Février</option>
                  <option value="3">Mars</option>
                  <option value="4">Avril</option>
                  <option value="5">Mai</option>
                  <option value="6">Juin</option>
                  <option value="7">Juillet</option>
                  <option value="8">Août</option>
                  <option value="9">Septembre</option>
                  <option value="10">Octobre</option>
                  <option value="11">Novembre</option>
                  <option value="12">Décembre</option>
                </select>
              </label>

              <label style={labelStyle(muted)}>
                Année concernée
                <input
                  value={periodYear}
                  onChange={(e) => setPeriodYear(e.target.value)}
                  inputMode="numeric"
                  style={inputStyle(border)}
                />
              </label>
            </div>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={busy}
                style={secondaryButton(border)}
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={addPayment}
                disabled={busy}
                style={primaryButton(blue)}
              >
                {busy ? "Ajout…" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function PaymentStatusBanner({
  status,
  paidCents,
  dueCents,
  remainingCents,
  isMobile,
}: {
  status: PaymentStatus;
  paidCents: number;
  dueCents: number;
  remainingCents: number;
  isMobile: boolean;
}) {
  const tone =
    status === "paid"
      ? {
          label: "Payé",
          emoji: "🟢",
          bg: "#ECF9F1",
          border: "rgba(31,157,97,0.16)",
          color: "#1F7A4D",
          text: "Le montant dû est entièrement encaissé pour cette période.",
        }
      : status === "partial"
        ? {
            label: "Partiel",
            emoji: "🟡",
            bg: "#FFF7E8",
            border: "rgba(160,106,44,0.18)",
            color: "#A06A2C",
            text: `Reste à payer : ${formatEuros(remainingCents)}.`,
          }
        : {
            label: "Impayé",
            emoji: "🔴",
            bg: "#FFF5F5",
            border: "rgba(220,38,38,0.20)",
            color: "#A12C2C",
            text: "Aucun paiement encaissé pour cette période.",
          };

  return (
    <section
      style={{
        marginBottom: 16,
        border: `1px solid ${tone.border}`,
        borderRadius: 18,
        background: tone.bg,
        padding: isMobile ? 14 : 16,
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
        color: tone.color,
        boxShadow: "0 10px 30px rgba(16,24,40,0.04)",
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 900 }}>
          {tone.emoji} Statut paiement : {tone.label}
        </div>

        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, lineHeight: 1.45 }}>
          {tone.text}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 4,
          textAlign: isMobile ? "left" : "right",
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        <span>Payé : {formatEuros(paidCents)}</span>
        <span>Dû : {dueCents > 0 ? formatEuros(dueCents) : "—"}</span>
      </div>
    </section>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  border,
  muted,
  title,
  blue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  border: string;
  muted: string;
  title: string;
  blue: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 18,
        background: "#fff",
        padding: 16,
        boxShadow: "0 10px 30px rgba(16,24,40,0.04)",
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 15,
          background: "#EEF4FF",
          color: blue,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      <div>
        <div style={{ fontSize: 12.5, color: muted, fontWeight: 700 }}>
          {label}
        </div>
        <div style={{ marginTop: 4, fontSize: 20, color: title, fontWeight: 900 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function primaryButton(blue: string): React.CSSProperties {
  return {
    minHeight: 44,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid rgba(52,103,235,0.10)",
    background: blue,
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(52,103,235,0.16)",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
}

function secondaryButton(border: string): React.CSSProperties {
  return {
    minHeight: 44,
    padding: "0 14px",
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
  };
}

function ghostButton(border: string): React.CSSProperties {
  return {
    minHeight: 38,
    padding: "0 12px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 800,
    color: "#243247",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
}

function dangerButton(): React.CSSProperties {
  return {
    minHeight: 38,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid rgba(220,38,38,0.14)",
    background: "#FFF5F5",
    color: "#A12C2C",
    cursor: "pointer",
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
}

function labelStyle(muted: string): React.CSSProperties {
  return {
    display: "grid",
    gap: 6,
    fontSize: 12.5,
    color: muted,
    fontWeight: 700,
  };
}

function inputStyle(border: string): React.CSSProperties {
  return {
    width: "100%",
    minHeight: 44,
    boxSizing: "border-box",
    borderRadius: 12,
    border: `1px solid ${border}`,
    padding: "0 12px",
    fontSize: 14,
    background: "#fff",
  };
}

function cellBlock(isMobile: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: 4,
    minWidth: 0,
    ...(isMobile
      ? {
          padding: "0 0 2px",
        }
      : null),
  };
}

const cellLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#98A2B3",
};

function cellValue(color: string): React.CSSProperties {
  return {
    fontSize: 14,
    lineHeight: 1.35,
    color,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}

const methodPill: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  background: "#F8FAFC",
  border: "1px solid rgba(27,39,64,0.08)",
  color: "#667085",
  fontSize: 12.5,
  fontWeight: 800,
  alignItems: "center",
};

const successBox: React.CSSProperties = {
  marginBottom: 12,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(31,157,97,0.16)",
  background: "#ECF9F1",
  color: "#1F7A4D",
  fontWeight: 800,
};

const errorBox: React.CSSProperties = {
  marginBottom: 12,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(220,38,38,0.24)",
  background: "#FFF5F5",
  color: "#A12C2C",
  fontWeight: 800,
};