"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarRange,
  Home,
  Users,
  Wallet,
} from "lucide-react";

import LeaseEditHeader from "../../_components/LeaseEditHeader";
import LeaseGuaranteesSection from "../../_components/LeaseGuaranteesSection";
import LeaseTenantsSection from "../../_components/LeaseTenantsSection";
import LeaseAmountsSection from "../../_components/LeaseAmountsSection";
import LeaseDesignationSection from "../../_components/LeaseDesignationSection";

import {
  API,
  kindLabel,
  loadLeaseBundle,
  hydrateLeaseIrl,
  hydrateLeaseDesignationState,
  toggleArrayValueIn,
} from "../../_lib/leaseEdit";

export default function LeaseEditPage() {
  const params = useParams();
  const router = useRouter();
  const leaseId = params?.leaseId as string;

  const [token, setToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingDesignation, setSavingDesignation] = useState(false);
  const [savingAmounts, setSavingAmounts] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [lease, setLease] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [amounts, setAmounts] = useState<any[]>([]);
  const [allTenants, setAllTenants] = useState<any[]>([]);

  const [designation, setDesignation] = useState<any>({});
  const [keysCount, setKeysCount] = useState<string>("");

  const [irl, setIrl] = useState({
    enabled: false,
    quarter: "",
    value: "",
  });

  const [amountForm, setAmountForm] = useState({
    effectiveDate: "",
    rentCents: "",
    chargesCents: "",
    depositCents: "",
    paymentDay: "",
  });

  const [newTenantId, setNewTenantId] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("token");
    setToken(t);
  }, []);

  async function loadLeaseDetails(currentToken: string) {
    const data = await loadLeaseBundle(leaseId, currentToken);

    setLease(data.lease);
    setTenants(data.tenants || []);
    setAmounts(data.amounts || []);

    const d = hydrateLeaseDesignationState(data.lease);
    setDesignation(d.designation);
    setKeysCount(
      d.keysCount === null || d.keysCount === undefined ? "" : String(d.keysCount)
    );

    setIrl(hydrateLeaseIrl(data.lease));

    setAmountForm({
      effectiveDate: "",
      rentCents: String((data.lease?.rent_cents || 0) / 100),
      chargesCents: String((data.lease?.charges_cents || 0) / 100),
      depositCents: String((data.lease?.deposit_cents || 0) / 100),
      paymentDay: String(data.lease?.payment_day || 5),
    });
  }

  async function loadSelectableTenants(currentToken: string) {
    const r = await fetch(`${API}/tenants`, {
      headers: { Authorization: `Bearer ${currentToken}` },
      credentials: "include",
    });

    const j = await r.json().catch(() => []);
    setAllTenants(Array.isArray(j) ? j : []);
  }

  useEffect(() => {
    if (!token || !leaseId) return;

    (async () => {
      try {
        setLoading(true);
        setError("");
        setStatus("");

        await Promise.all([
          loadLeaseDetails(token),
          loadSelectableTenants(token),
        ]);
      } catch (e: any) {
        console.error(e);
        setError(String(e?.message || e || "Erreur chargement bail"));
      } finally {
        setLoading(false);
      }
    })();
  }, [token, leaseId]);

  const mainTenant = useMemo(
    () => tenants.find((t) => t.role === "principal"),
    [tenants]
  );

  const coTenants = useMemo(
    () => tenants.filter((t) => t.role !== "principal"),
    [tenants]
  );

  const currentTenantIds = useMemo(() => {
    const set = new Set<string>();
    tenants.forEach((t: any) => set.add(String(t.id)));
    return set;
  }, [tenants]);

  const selectableTenants = useMemo(() => {
    return allTenants.filter((t) => !currentTenantIds.has(String(t.id)));
  }, [allTenants, currentTenantIds]);

  async function refreshAll() {
    if (!token) return;
    await loadLeaseDetails(token);
    await loadSelectableTenants(token);
  }

  async function saveDesignation() {
    if (!token || !lease) return;

    if (irl.enabled && (!irl.quarter.trim() || !irl.value.trim())) {
      setError("Le trimestre et la valeur IRL sont obligatoires quand l’IRL est activé.");
      setStatus("");
      return;
    }

    if (irl.enabled) {
      const parsedIrlValue = Number(irl.value);
      if (!Number.isFinite(parsedIrlValue) || parsedIrlValue <= 0) {
        setError("La valeur IRL doit être un nombre valide supérieur à 0.");
        setStatus("");
        return;
      }
    }

    try {
      setSavingDesignation(true);
      setError("");
      setStatus("Enregistrement de la désignation…");

      const r = await fetch(`${API}/leases/${lease.id}/designation`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          leaseDesignation: designation,
          keysCount: keysCount === "" ? null : Number(keysCount),
          irlReferenceQuarter: irl.quarter.trim() || null,
          irlReferenceValue: irl.value.trim() ? Number(irl.value) : null,
          irlEnabled: irl.enabled,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.message || JSON.stringify(j));
      }

      await refreshAll();
      setStatus("Désignation enregistrée ✅");
      setTimeout(() => setStatus(""), 2200);
    } catch (e: any) {
      setError(String(e?.message || e));
      setStatus("");
    } finally {
      setSavingDesignation(false);
    }
  }

  async function addCoTenant() {
    if (!token || !lease) return;
    if (!newTenantId) {
      setError("Choisir un co-locataire.");
      return;
    }

    try {
      setSavingTenant(true);
      setError("");
      setStatus("Ajout du co-locataire…");

      const r = await fetch(`${API}/leases/${lease.id}/tenants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          tenantId: newTenantId,
          role: "cotenant",
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.message || JSON.stringify(j));
      }

      setNewTenantId("");
      await refreshAll();
      setStatus("Co-locataire ajouté ✅");
      setTimeout(() => setStatus(""), 2200);
    } catch (e: any) {
      setError(String(e?.message || e));
      setStatus("");
    } finally {
      setSavingTenant(false);
    }
  }

  async function removeCoTenant(id: string) {
    if (!token || !lease) return;
    if (!confirm("Retirer ce co-locataire du bail ?")) return;

    try {
      setSavingTenant(true);
      setError("");
      setStatus("Suppression du co-locataire…");

      const r = await fetch(`${API}/leases/${lease.id}/tenants/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.message || JSON.stringify(j));
      }

      await refreshAll();
      setStatus("Co-locataire retiré ✅");
      setTimeout(() => setStatus(""), 2200);
    } catch (e: any) {
      setError(String(e?.message || e));
      setStatus("");
    } finally {
      setSavingTenant(false);
    }
  }

  async function addAmountsRow() {
    if (!token || !lease) return;

    if (!amountForm.effectiveDate) {
      setError("Date d’effet obligatoire.");
      return;
    }

    try {
      setSavingAmounts(true);
      setError("");
      setStatus("Enregistrement des montants…");

      const r = await fetch(`${API}/leases/${lease.id}/amounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          effectiveDate: amountForm.effectiveDate,
          rentCents: Math.round(Number(amountForm.rentCents || 0) * 100),
          chargesCents: Math.round(Number(amountForm.chargesCents || 0) * 100),
          depositCents: Math.round(Number(amountForm.depositCents || 0) * 100),
          paymentDay: Number(amountForm.paymentDay || 1),
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.message || JSON.stringify(j));
      }

      await refreshAll();
      setStatus("Montants enregistrés ✅");
      setTimeout(() => setStatus(""), 2200);
    } catch (e: any) {
      setError(String(e?.message || e));
      setStatus("");
    } finally {
      setSavingAmounts(false);
    }
  }

  function fillAmountsFromRow(row: any) {
    setAmountForm({
      effectiveDate: row.effective_date?.slice(0, 10) || "",
      rentCents: String((row.rent_cents || 0) / 100),
      chargesCents: String((row.charges_cents || 0) / 100),
      depositCents: String((row.deposit_cents || 0) / 100),
      paymentDay: String(row.payment_day || 5),
    });
    setStatus("Formulaire pré-rempli. Corrige puis enregistre.");
    setTimeout(() => setStatus(""), 1800);
  }

  if (loading) {
    return (
      <main style={pageShell}>
        <div style={contentWrap}>
          <div style={cardStyle}>
            <div style={{ color: "#667085" }}>Chargement du bail…</div>
          </div>
        </div>
      </main>
    );
  }

  if (!lease) {
    return (
      <main style={pageShell}>
        <div style={contentWrap}>
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, color: "#17233A" }}>Bail introuvable</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={pageShell}>
      <div style={contentWrap}>
        <LeaseEditHeader
          title="Modifier le bail"
          subtitle={`${lease.unit_code || lease.unit_id || "Logement"} — ${
            mainTenant?.full_name ||
            mainTenant?.tenant_name ||
            lease.tenant_name ||
            "Locataire principal"
          }`}
          kindLabel={kindLabel(lease.kind)}
          status={lease.status}
          statusLabel={
            lease.status === "notice"
              ? "Préavis"
              : lease.status === "active"
              ? "Actif"
              : lease.status === "draft"
              ? "Brouillon"
              : lease.status
          }
          onBack={() => router.push("/dashboard/leases")}
          onSave={saveDesignation}
          saving={savingDesignation}
        />

        {status ? <div style={successAlertStyle}>{status}</div> : null}
        {error ? <div style={errorAlertStyle}>{error}</div> : null}

        <section style={summaryGridStyle}>
          <SummaryCard
            icon={<Home size={16} />}
            label="Logement"
            value={lease.unit_code || lease.unit_id || "—"}
            detail={lease.unit_label || lease.unit_name || ""}
          />
          <SummaryCard
            icon={<Users size={16} />}
            label="Locataire principal"
            value={mainTenant?.full_name || mainTenant?.tenant_name || lease.tenant_name || "—"}
            detail={mainTenant?.email || ""}
          />
          <SummaryCard
            icon={<CalendarRange size={16} />}
            label="Dates du bail"
            value={`${String(lease.start_date || "").slice(0, 10)} → ${String(
              lease.end_date_theoretical || ""
            ).slice(0, 10)}`}
            detail=""
          />
          <SummaryCard
            icon={<Wallet size={16} />}
            label="Montants actuels"
            value={`${((lease.rent_cents || 0) / 100).toFixed(0)} € + ${(
              (lease.charges_cents || 0) / 100
            ).toFixed(0)} €`}
            detail={`Dépôt ${(lease.deposit_cents || 0) / 100} €`}
          />
        </section>

        <LeaseDesignationSection
          designation={designation}
          setDesignation={setDesignation}
          keysCount={keysCount}
          setKeysCount={setKeysCount}
          irl={irl}
          setIrl={setIrl}
          toggleArrayValueIn={toggleArrayValueIn}
          onSave={saveDesignation}
          saving={savingDesignation}
        />

        <LeaseTenantsSection
          mainTenant={mainTenant}
          coTenants={coTenants}
          selectableTenants={selectableTenants}
          newTenantId={newTenantId}
          setNewTenantId={setNewTenantId}
          onAddCoTenant={addCoTenant}
          onRemoveCoTenant={removeCoTenant}
          savingTenant={savingTenant}
        />

        <LeaseAmountsSection
          amountForm={amountForm}
          setAmountForm={setAmountForm}
          onSubmit={addAmountsRow}
          onFillFromRow={fillAmountsFromRow}
          amounts={amounts}
          saving={savingAmounts}
        />
        <LeaseGuaranteesSection leaseId={lease.id} />
      </div>
    </main>
  );
}


function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryIconStyle}>{icon}</div>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{value}</div>
      {detail ? <div style={summaryDetailStyle}>{detail}</div> : null}
    </div>
  );
}


const pageShell: React.CSSProperties = {
  minHeight: "100vh",
  background: "#F6F8FC",
  padding: "32px 24px 56px",
};

const contentWrap: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  display: "grid",
  gap: 18,
};

const successAlertStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(31,157,97,0.16)",
  background: "#ECF9F1",
  color: "#1F9D61",
  fontWeight: 700,
};

const errorAlertStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(220,38,38,0.18)",
  background: "#FFF5F7",
  color: "#A12C52",
  fontWeight: 700,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const summaryCardStyle: React.CSSProperties = {
  border: "1px solid rgba(27,39,64,0.06)",
  borderRadius: 20,
  background: "#fff",
  padding: 18,
  boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
};

const summaryIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  background: "#EEF4FF",
  color: "#3467EB",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 12,
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#8D99AE",
  fontWeight: 700,
  marginBottom: 8,
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: 16,
  color: "#17233A",
  fontWeight: 800,
  lineHeight: 1.3,
};

const summaryDetailStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "#667085",
  lineHeight: 1.5,
};

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(27,39,64,0.06)",
  borderRadius: 24,
  background: "#fff",
  padding: 22,
  boxShadow: "0 10px 30px rgba(16,24,40,0.05)",
};