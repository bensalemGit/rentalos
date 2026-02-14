"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ImportHousingButton from "./ImportHousingButton";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type Unit = {
  id: string;
  code: string;
  label: string;
  address_line1: string;
  city: string;
  postal_code: string;
  surface_m2: number;
  floor: number | null;
  project_name?: string | null;
  building_name?: string | null;
};

type Tenant = { id: string; full_name: string; email?: string | null; phone?: string | null };

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
};

type LeaseDetails = {
  lease: any;
  tenants: Array<any>;
  amounts: Array<any>;
};

type LeaseDesignation = {
  batiment?: string;
  porte?: string;
  etagePrecision?: string;
  typeBien?: "appartement" | "maison";
  usageMixte?: boolean;
  consistance?: string;
  description?: string;
  chauffageType?: string;
  eauChaudeType?: string;
  dependances?: string[];
  equipementsCommuns?: string[];
};

function kindLabel(k?: string) {
  const v = String(k || "MEUBLE_RP").toUpperCase();
  if (v === "MEUBLE_RP") return "Meublé (RP)";
  if (v === "NU_RP") return "Nu (RP)";
  if (v === "SAISONNIER") return "Saisonnier";
  return v;
}

function coerceLeaseDesignation(lease: any): LeaseDesignation {
  // Being defensive: depending on DB / API naming.
  const raw =
    lease?.lease_designation ??
    lease?.leaseDesignation ??
    lease?.lease_designation_json ??
    lease?.lease_designation_data ??
    null;

  // If stored as stringified JSON in DB at some point.
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === "object") return raw as LeaseDesignation;
  return {};
}

function toggleArrayValueIn(
  current: LeaseDesignation,
  key: "dependances" | "equipementsCommuns",
  value: string
): LeaseDesignation {
  const set = new Set(current[key] || []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return { ...current, [key]: Array.from(set) };
}

export default function LeasesPage() {
  const [token, setToken] = useState("");

  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showArchives, setShowArchives] = useState(false);

  // -------------------------
  // CREATE FORM
  // -------------------------
  const [unitId, setUnitId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDateTheoretical, setEndDateTheoretical] = useState("");

  const [rent, setRent] = useState<number>(950);
  const [charges, setCharges] = useState<number>(50);
  type LeaseChargesMode = 'FORFAIT' | 'PROVISION';
  const [chargesMode, setChargesMode] = useState<LeaseChargesMode>('FORFAIT');

  const [deposit, setDeposit] = useState<number>(1900);
  const [paymentDay, setPaymentDay] = useState<number>(5);

  const [kind, setKind] = useState<string>("MEUBLE_RP");

  // guarantor optional (RP only)
  const [useGuarantor, setUseGuarantor] = useState(false);
  const [gName, setGName] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [gAddress, setGAddress] = useState("");

  // designation (contract) at creation
  const [designation, setDesignation] = useState<LeaseDesignation>({
    batiment: "Bâtiment principal",
    porte: "",
    etagePrecision: "",
    typeBien: "appartement",
    usageMixte: false,
    consistance: "",
    description: "",
    chauffageType: "électrique individuel",
    eauChaudeType: "ballon électrique",
    dependances: [],
    equipementsCommuns: ["interphone"],
  });

  // ✅ keys + IRL reference (creation)
  const [keysCount, setKeysCount] = useState<number | "">(2);
  const [irlQuarter, setIrlQuarter] = useState<string>("");
  const [irlValue, setIrlValue] = useState<string>("");

  // -------------------------
  // EDIT MODAL
  // -------------------------
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [details, setDetails] = useState<LeaseDetails | null>(null);

  const [editDesignation, setEditDesignation] = useState<LeaseDesignation>({});
  const [editKeysCount, setEditKeysCount] = useState<number | "">(2);
  const [editIrlQuarter, setEditIrlQuarter] = useState<string>("");
  const [editIrlValue, setEditIrlValue] = useState<string>("");

  const [newCoTenantId, setNewCoTenantId] = useState<string>("");

  // amounts form (UPSERT by date)
  const [amountDate, setAmountDate] = useState<string>("");
  const [amountRent, setAmountRent] = useState<number>(0);
  const [amountCharges, setAmountCharges] = useState<number>(0);
  const [amountDeposit, setAmountDeposit] = useState<number>(0);
  const [amountPayDay, setAmountPayDay] = useState<number>(5);

  const blue = "#1f6feb";
  const border = "#e5e7eb";
  const muted = "#6b7280";

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  function prefillDesignationFromUnit(u: Unit | undefined) {
    if (!u) return;

    const floorLabel =
      u.floor === null || u.floor === undefined ? "" : u.floor === 0 ? "RDC" : `Étage ${u.floor}`;

    // We only prefill the fields that "Units" already owns; we DO NOT wipe the arrays.
    setDesignation((prev) => ({
      ...prev,
      batiment: u.building_name || prev.batiment || "Bâtiment principal",
      porte: u.code || prev.porte || "",
      etagePrecision: floorLabel || prev.etagePrecision || "",
      consistance: u.label || prev.consistance || "",
    }));
  }

  async function loadAll() {
    setError("");
    setStatus("Chargement…");
    try {
      const [u, t, l] = await Promise.all([
        fetch(`${API}/units`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" }).then((r) =>
          r.json()
        ),
        fetch(`${API}/tenants`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" }).then((r) =>
          r.json()
        ),
        fetch(`${API}/leases`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" }).then((r) =>
          r.json()
        ),
      ]);

      const unitsArr: Unit[] = Array.isArray(u) ? u : [];
      const tenantsArr: Tenant[] = Array.isArray(t) ? t : [];
      const leasesArr: Lease[] = Array.isArray(l) ? l : [];

      setUnits(unitsArr);
      setTenants(tenantsArr);
      setLeases(leasesArr);

      if (!unitId && unitsArr[0]?.id) {
        setUnitId(unitsArr[0].id);
        prefillDesignationFromUnit(unitsArr[0]);
      }
      if (!tenantId && tenantsArr[0]?.id) setTenantId(tenantsArr[0].id);

      if (!startDate) setStartDate(new Date().toISOString().slice(0, 10));
      if (!endDateTheoretical) {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        d.setDate(d.getDate() - 1);
        setEndDateTheoretical(d.toISOString().slice(0, 10));
      }

      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    if (token) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // when unit changes, prefill designation
  useEffect(() => {
    const u = units.find((x) => x.id === unitId);
    prefillDesignationFromUnit(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  // guarantor only for RP kinds
  useEffect(() => {
    if (kind === "SAISONNIER") {
      setUseGuarantor(false);
      setGName("");
      setGEmail("");
      setGPhone("");
      setGAddress("");
    }
  }, [kind]);

  async function createLease() {
    setError("");
    setStatus("Création du bail…");

    if (!unitId || !tenantId) {
      setStatus("");
      setError("Veuillez sélectionner un logement et un locataire.");
      return;
    }

  const payload: any = {
    unitId,
    tenantId,
    startDate,
    endDateTheoretical,

    rentCents: Math.round((rent || 0) * 100),
    chargesCents: Math.round((charges || 0) * 100),
    chargesMode, // ✅ IMPORTANT

    depositCents: Math.round((deposit || 0) * 100),
    paymentDay: paymentDay || 5,
    kind,
    leaseDesignation: designation,

    // ✅ keys + IRL (inchangé)
    keysCount: keysCount === "" ? null : Number(keysCount),
    irlReferenceQuarter: irlQuarter || null,
    irlReferenceValue: irlValue ? Number(irlValue) : null,

    // ✅ garant classique (si tu as ces states)
    //guarantorFullName: guarantorFullName || null,
    //guarantorEmail: guarantorEmail || null,
    //guarantorPhone: guarantorPhone || null,
    //guarantorAddress: guarantorAddress || null,
  };



    // guarantor optional (only RP)
    if (kind !== "SAISONNIER" && useGuarantor) {
      payload.guarantorFullName = gName.trim() || null;
      payload.guarantorEmail = gEmail.trim() || null;
      payload.guarantorPhone = gPhone.trim() || null;
      payload.guarantorAddress = gAddress.trim() || null;
    }

    try {
      const r = await fetch(`${API}/leases`, {
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

      // (keys/IRL already sent in POST payload)

      setStatus("Bail créé ✅");
      setShowCreate(false);

      // reset guarantor
      setUseGuarantor(false);
      setGName("");
      setGEmail("");
      setGPhone("");
      setGAddress("");

      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

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

  async function sendTenantLink(id: string) {
    setError("");
    setStatus("Envoi du lien locataire…");
    try {
      const r = await fetch(`${API}/public-links/tenant-sign/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId: id, ttlHours: 48 }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus(`Email envoyé à ${j.sentTo} ✅ (lien copié)`);
      try {
        await navigator.clipboard.writeText(j.publicUrl);
      } catch {}
      alert(`Email envoyé à ${j.sentTo}\nLien (copié):\n${j.publicUrl}`);
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

  // ---------- EDIT MODAL ----------
  async function openEditLease(l: Lease) {
    setEditingLease(l);
    setDetails(null);
    setNewCoTenantId("");

    // Reset amounts quick form
    setAmountDate("");
    setAmountRent((l.rent_cents || 0) / 100);
    setAmountCharges((l.charges_cents || 0) / 100);
    setAmountDeposit((l.deposit_cents || 0) / 100);
    setAmountPayDay(l.payment_day || 5);

    // Reset designation section while loading
    setEditDesignation({});
    setEditKeysCount(2);
    setEditIrlQuarter("");
    setEditIrlValue("");

    setError("");
    setStatus("Chargement bail…");

    try {
      const r = await fetch(`${API}/leases/${l.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setDetails(j);

      // ✅ hydrate edit designation & meta from API response
      const lease = j?.lease || {};
      setEditDesignation(coerceLeaseDesignation(lease));
      setEditKeysCount(lease?.keys_count ?? lease?.keysCount ?? 2);
      setEditIrlQuarter(String(lease?.irl_reference_quarter ?? lease?.irlReferenceQuarter ?? ""));
      const v = lease?.irl_reference_value ?? lease?.irlReferenceValue ?? "";
      setEditIrlValue(v === null || v === undefined ? "" : String(v));

      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function refreshLeaseDetails() {
    if (!editingLease) return;
    const r = await fetch(`${API}/leases/${editingLease.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setDetails(j);

      // keep modal in sync (if something changed server-side)
      const lease = j?.lease || {};
      setEditDesignation(coerceLeaseDesignation(lease));
      setEditKeysCount(lease?.keys_count ?? lease?.keysCount ?? 2);
      setEditIrlQuarter(String(lease?.irl_reference_quarter ?? lease?.irlReferenceQuarter ?? ""));
      const v = lease?.irl_reference_value ?? lease?.irlReferenceValue ?? "";
      setEditIrlValue(v === null || v === undefined ? "" : String(v));
    }
  }

  async function saveDesignation() {
    if (!editingLease) return;
    setError("");
    setStatus("Enregistrement désignation…");

    try {
      const r = await fetch(`${API}/leases/${editingLease.id}/designation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          leaseDesignation: editDesignation,
          keysCount: editKeysCount === "" ? null : Number(editKeysCount),
          irlReferenceQuarter: editIrlQuarter || null,
          irlReferenceValue: editIrlValue ? Number(editIrlValue) : null,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }

      setStatus("Désignation enregistrée ✅");
      await refreshLeaseDetails();
      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function addCoTenant() {
    if (!editingLease) return;
    if (!newCoTenantId) {
      setError("Choisir un co-locataire.");
      return;
    }
    setError("");
    setStatus("Ajout co-locataire…");
    try {
      const r = await fetch(`${API}/leases/${editingLease.id}/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ tenantId: newCoTenantId, role: "cotenant" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Co-locataire ajouté ✅");
      setNewCoTenantId("");
      await refreshLeaseDetails();
      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function removeCoTenant(tenantIdToRemove: string) {
    if (!editingLease) return;
    if (!confirm("Retirer ce co-locataire du bail ?")) return;

    setError("");
    setStatus("Suppression co-locataire…");
    try {
      const r = await fetch(`${API}/leases/${editingLease.id}/tenants/${tenantIdToRemove}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Co-locataire retiré ✅");
      await refreshLeaseDetails();
      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function addAmountsRow() {
    if (!editingLease) return;

    if (!amountDate) {
      setError("Date d’effet obligatoire.");
      return;
    }

    setError("");
    setStatus("Enregistrement des montants…");

    try {
      const r = await fetch(`${API}/leases/${editingLease.id}/amounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          effectiveDate: amountDate,
          rentCents: Math.round((amountRent || 0) * 100),
          chargesCents: Math.round((amountCharges || 0) * 100),
          // Optionnel: tu peux aussi exposer le mode dans la modale "Montants" plus tard
          // chargesMode,

          depositCents: Math.round((amountDeposit || 0) * 100),
          paymentDay: amountPayDay || 5,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }

      setStatus("Montants enregistrés ✅");
      await refreshLeaseDetails();
      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  function fillAmountsFromRow(a: any) {
    setAmountDate(String(a.effective_date).slice(0, 10));
    setAmountRent((a.rent_cents || 0) / 100);
    setAmountCharges((a.charges_cents || 0) / 100);
    setAmountDeposit((a.deposit_cents || 0) / 100);
    setAmountPayDay(a.payment_day || 5);
    setStatus("Formulaire pré-rempli (corriger puis Enregistrer)");
  }

  const currentTenantIds = useMemo(() => {
    const set = new Set<string>();
    details?.tenants?.forEach((t: any) => set.add(t.id));
    return set;
  }, [details]);

  const selectableTenants = useMemo(() => {
    return tenants.filter((t) => !currentTenantIds.has(t.id));
  }, [tenants, currentTenantIds]);

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Baux</h1>
          <div style={{ color: muted }}>
            Création avec type + garant optionnel + désignation contractuelle. Modifier bail actif : désignation + co-locataires + montants.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setShowCreate((v) => !v)} style={btnPrimarySmall(blue)}>
            {showCreate ? "Fermer" : "Créer un bail"}
          </button>
          <button onClick={loadAll} style={btnSecondary(border)}>
            Rafraîchir
          </button>
        </div>
      </div>

      {status && <p style={{ marginTop: 10, color: "#0a6" }}>{status}</p>}
      {error && <p style={{ marginTop: 10, color: "crimson" }}>{error}</p>}

      {showCreate && (
        <section style={{ marginTop: 14, border: `1px solid ${border}`, borderRadius: 16, background: "#fff", padding: 14 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Nouveau bail</h2>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            <label style={labelStyle(muted)}>
              Type de location
              <br />
              <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle(border)}>
                <option value="MEUBLE_RP">Meublé (résidence principale)</option>
                <option value="NU_RP">Nu (résidence principale)</option>
                <option value="SAISONNIER">Saisonnier</option>
              </select>
            </label>

            <label style={labelStyle(muted)}>
              Logement
              <br />
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={inputStyle(border)}>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} — {u.label}
                    {u.building_name ? ` (${u.building_name})` : ""}
                    {u.project_name ? ` • ${u.project_name}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle(muted)}>
              Locataire principal
              <br />
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} style={inputStyle(border)}>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                    {t.email ? ` — ${t.email}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            <label style={labelStyle(muted)}>
              Date début
              <br />
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle(border)} />
            </label>
            <label style={labelStyle(muted)}>
              Fin (entrée/sortie pour saisonnier)
              <br />
              <input
                type="date"
                value={endDateTheoretical}
                onChange={(e) => setEndDateTheoretical(e.target.value)}
                style={inputStyle(border)}
              />
            </label>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <label style={labelStyle(muted)}>
              Loyer (€)
              <br />
              <input type="number" value={rent} onChange={(e) => setRent(Number(e.target.value))} style={inputStyle(border)} />
            </label>
            <label style={labelStyle(muted)}>
              Charges (€)
              <br />
              <input type="number" value={charges} onChange={(e) => setCharges(Number(e.target.value))} style={inputStyle(border)} />
            </label>

            <div style={{ display: 'flex', gap: 18, marginTop: 6, marginBottom: 4, color: muted }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="chargesMode"
                  checked={chargesMode === 'FORFAIT'}
                  onChange={() => setChargesMode('FORFAIT')}
                />
                Forfait (non régularisable)
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="radio"
                  name="chargesMode"
                  checked={chargesMode === 'PROVISION'}
                  onChange={() => setChargesMode('PROVISION')}
                />
                Provision (régularisation annuelle)
              </label>
            </div>
            <label style={labelStyle(muted)}>
              Dépôt (€)
              <br />
              <input type="number" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} style={inputStyle(border)} />
            </label>
            <label style={labelStyle(muted)}>
              Jour paiement
              <br />
              <input
                type="number"
                value={paymentDay}
                onChange={(e) => setPaymentDay(Number(e.target.value))}
                style={inputStyle(border)}
              />
            </label>
          </div>

          {/* Désignation (contrat) */}
          <div style={{ marginTop: 12, border: `1px solid ${border}`, borderRadius: 16, padding: 12, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 900 }}>Désignation (contrat)</div>
                <div style={{ color: muted, fontSize: 12 }}>Pré-rempli automatiquement depuis le logement. Ajuste ce qui manque (terrain).</div>
              </div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              <label style={labelStyle(muted)}>
                Bâtiment
                <br />
                <input
                  value={designation.batiment || ""}
                  onChange={(e) => setDesignation((p) => ({ ...p, batiment: e.target.value }))}
                  style={inputStyle(border)}
                />
              </label>
              <label style={labelStyle(muted)}>
                Porte / Lot
                <br />
                <input value={designation.porte || ""} onChange={(e) => setDesignation((p) => ({ ...p, porte: e.target.value }))} style={inputStyle(border)} />
              </label>
              <label style={labelStyle(muted)}>
                Précision étage
                <br />
                <input
                  value={designation.etagePrecision || ""}
                  onChange={(e) => setDesignation((p) => ({ ...p, etagePrecision: e.target.value }))}
                  style={inputStyle(border)}
                />
              </label>
              <label style={labelStyle(muted)}>
                Type de bien
                <br />
                <select
                  value={designation.typeBien || "appartement"}
                  onChange={(e) => setDesignation((p) => ({ ...p, typeBien: e.target.value as any }))}
                  style={inputStyle(border)}
                >
                  <option value="appartement">Appartement</option>
                  <option value="maison">Maison</option>
                </select>
              </label>
              <label style={labelStyle(muted)}>
                Usage mixte (habitation + pro)
                <br />
                <input
                  type="checkbox"
                  checked={Boolean(designation.usageMixte)}
                  onChange={(e) => setDesignation((p) => ({ ...p, usageMixte: e.target.checked }))}
                />
              </label>

              <label style={labelStyle(muted)}>
                Consistance (ex: T2 – 1 chambre)
                <br />
                <input
                  value={designation.consistance || ""}
                  onChange={(e) => setDesignation((p) => ({ ...p, consistance: e.target.value }))}
                  style={inputStyle(border)}
                />
              </label>
              <label style={labelStyle(muted)}>
                Descriptif (optionnel)
                <br />
                <input
                  value={designation.description || ""}
                  onChange={(e) => setDesignation((p) => ({ ...p, description: e.target.value }))}
                  style={inputStyle(border)}
                />
              </label>

              <label style={labelStyle(muted)}>
                Chauffage
                <br />
                <select
                  value={designation.chauffageType || "électrique individuel"}
                  onChange={(e) => setDesignation((p) => ({ ...p, chauffageType: e.target.value }))}
                  style={inputStyle(border)}
                >
                  <option value="électrique individuel">Électrique individuel</option>
                  <option value="gaz individuel">Gaz individuel</option>
                  <option value="collectif">Collectif</option>
                  <option value="pompe à chaleur">Pompe à chaleur</option>
                  <option value="autre">Autre</option>
                </select>
              </label>

              <label style={labelStyle(muted)}>
                Eau chaude
                <br />
                <select
                  value={designation.eauChaudeType || "ballon électrique"}
                  onChange={(e) => setDesignation((p) => ({ ...p, eauChaudeType: e.target.value }))}
                  style={inputStyle(border)}
                >
                  <option value="ballon électrique">Ballon électrique</option>
                  <option value="chaudière gaz">Chaudière gaz</option>
                  <option value="collectif">Collectif</option>
                  <option value="autre">Autre</option>
                </select>
              </label>

              <label style={labelStyle(muted)}>
                Nombre de clés remises
                <br />
                <input
                  type="number"
                  value={keysCount}
                  onChange={(e) => setKeysCount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="ex: 2"
                  style={inputStyle(border)}
                />
              </label>

              <label style={labelStyle(muted)}>
                IRL — Trimestre de référence
                <br />
                <input value={irlQuarter} onChange={(e) => setIrlQuarter(e.target.value)} placeholder="ex: T3 2025" style={inputStyle(border)} />
              </label>

              <label style={labelStyle(muted)}>
                IRL — Valeur de référence
                <br />
                <input value={irlValue} onChange={(e) => setIrlValue(e.target.value)} placeholder="ex: 142.06" style={inputStyle(border)} />
              </label>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 10 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Dépendances</div>
                {["cave", "parking", "garage", "jardin", "terrasse", "balcon"].map((x) => (
                  <label key={x} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={(designation.dependances || []).includes(x)}
                      onChange={() => setDesignation((p) => toggleArrayValueIn(p, "dependances", x))}
                    />
                    <span style={{ textTransform: "capitalize" }}>{x}</span>
                  </label>
                ))}
              </div>

              <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 10 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Équipements communs</div>
                {["interphone", "digicode", "ascenseur", "antenne TV", "fibre"].map((x) => (
                  <label key={x} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={(designation.equipementsCommuns || []).includes(x)}
                      onChange={() => setDesignation((p) => toggleArrayValueIn(p, "equipementsCommuns", x))}
                    />
                    <span>{x}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Garant optionnel RP */}
          {kind !== "SAISONNIER" && (
            <div style={{ marginTop: 12, border: `1px solid ${border}`, borderRadius: 16, padding: 12, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>Garant / caution (optionnel)</div>
                  <div style={{ color: muted, fontSize: 12 }}>Si vous souhaitez ajouter un garant au contrat.</div>
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 800 }}>
                  <input type="checkbox" checked={useGuarantor} onChange={(e) => setUseGuarantor(e.target.checked)} />
                  Activer
                </label>
              </div>

              {useGuarantor && (
                <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                  <label style={labelStyle(muted)}>
                    Nom complet
                    <br />
                    <input value={gName} onChange={(e) => setGName(e.target.value)} style={inputStyle(border)} />
                  </label>
                  <label style={labelStyle(muted)}>
                    Email
                    <br />
                    <input value={gEmail} onChange={(e) => setGEmail(e.target.value)} style={inputStyle(border)} />
                  </label>
                  <label style={labelStyle(muted)}>
                    Téléphone
                    <br />
                    <input value={gPhone} onChange={(e) => setGPhone(e.target.value)} style={inputStyle(border)} />
                  </label>
                  <label style={labelStyle(muted)}>
                    Adresse
                    <br />
                    <input value={gAddress} onChange={(e) => setGAddress(e.target.value)} style={inputStyle(border)} />
                  </label>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <button onClick={createLease} style={btnPrimaryWide(blue)}>
              Créer le bail
            </button>
          </div>
        </section>
      )}

      {/* Active */}
      <section style={{ marginTop: 14 }}>
        <div style={{ color: muted, fontSize: 12, marginBottom: 8 }}>{activeLeases.length} bail(aux) actif(s)</div>

        <div style={{ display: "grid", gap: 10 }}>
          {activeLeases.map((l) => (
            <div key={l.id} style={{ border: `1px solid ${border}`, borderRadius: 16, background: "#fff", padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontWeight: 900 }}>{l.unit_code || l.unit_id}</span>
                    <span>— {l.tenant_name || l.tenant_id}</span>
                    <span style={chip(border, "#0b2a6f")}>{kindLabel(l.kind)}</span>
                    <span style={statusChip(l.status, border)}>{l.status}</span>
                  </div>
                  <div style={{ marginTop: 6, color: muted, fontSize: 12 }}>
                    {String(l.start_date).slice(0, 10)} → {String(l.end_date_theoretical).slice(0, 10)}
                  </div>
                  <div style={{ color: muted, fontSize: 12 }}>
                    Loyer: {(l.rent_cents / 100).toFixed(2)} € • Charges: {(l.charges_cents / 100).toFixed(2)} € • Dépôt:{" "}
                    {(l.deposit_cents / 100).toFixed(2)} € • Paiement J{l.payment_day}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
                  <ImportHousingButton
                    leaseId={l.id}
                    token={token}
                    border={border}
                    blue={blue}
                  />

                  {l.status === "draft" && <button onClick={() => activateLease(l.id)} style={btnPrimarySmall(blue)}>Activer</button>}

                  {(l.status === "active" || l.status === "notice") && (
                    <>
                      {l.status === "active" ? (
                        <button onClick={() => setNoticeLease(l.id)} style={btnSecondary(border)}>Préavis</button>
                      ) : (
                        <button onClick={() => cancelNoticeLease(l.id)} style={btnSecondary(border)}>Annuler préavis</button>
                      )}
                      <button onClick={() => closeLease(l.id)} style={btnDanger(border)}>Clôturer</button>
                      <button onClick={() => openEditLease(l)} style={btnSecondary(border)}>Modifier</button>
                    </>
                  )}

                                    <Link href={`/edl/${l.id}`}><button style={btnAction(border)}>EDL</button></Link>
                  <Link href={`/inventory/${l.id}`}><button style={btnAction(border)}>Inventaire</button></Link>
                  <Link href={`/sign/${l.id}`}><button style={btnAction(border)}>Contrat + signatures</button></Link>
                  <button onClick={() => sendTenantLink(l.id)} style={btnPrimarySmall(blue)}>Envoyer lien locataire</button>
                </div>
              </div>
            </div>
          ))}

          {!activeLeases.length && (
            <div style={{ border: `1px dashed ${border}`, borderRadius: 16, padding: 14, color: muted, background: "#fff" }}>Aucun bail actif.</div>
          )}
        </div>

        {/* Archives */}
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setShowArchives((v) => !v)} style={btnSecondary(border)}>
            {showArchives ? "Masquer" : "Afficher"} les archives ({endedLeases.length})
          </button>

          {showArchives && (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {endedLeases.map((l) => (
                <div key={l.id} style={{ border: `1px solid ${border}`, borderRadius: 16, background: "#fff", padding: 14, opacity: 0.95 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontWeight: 900 }}>{l.unit_code || l.unit_id}</span>
                        <span>— {l.tenant_name || l.tenant_id}</span>
                        <span style={chip(border, "#0b2a6f")}>{kindLabel(l.kind)}</span>
                        <span style={statusChip(l.status, border)}>{l.status}</span>
                        <span style={chip(border, "#16a34a")}>Clôturé ✅</span>
                      </div>
                      <div style={{ marginTop: 6, color: muted, fontSize: 12 }}>
                        {String(l.start_date).slice(0, 10)} → {String(l.end_date_theoretical).slice(0, 10)}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
                      <ImportHousingButton
                        leaseId={l.id}
                        token={token}
                        border={border}
                        blue={blue}
                      />
                      
                                            <Link href={`/edl/${l.id}`}><button style={btnAction(border)}>EDL</button></Link>
                      <Link href={`/inventory/${l.id}`}><button style={btnAction(border)}>Inventaire</button></Link>
                      <Link href={`/sign/${l.id}`}><button style={btnAction(border)}>Contrat + signatures</button></Link>
                    </div>
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

      {/* MODAL EDIT */}
      {editingLease && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            // allow scrolling when the modal content is taller than the viewport
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "24px 16px",
            zIndex: 50,
          }}
          onClick={() => {
            setEditingLease(null);
            setDetails(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "min(1000px, 100%)",
              margin: "0 auto",
              boxSizing: "border-box",
              borderRadius: 16,
              padding: 14,
              border: `1px solid ${border}`,
              // inner scroll (keyboard/trackpad) + outer scroll (page) both work
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Modifier bail</div>
                <div style={{ color: muted, fontSize: 12 }}>{editingLease.id}</div>
              </div>
              <button
                onClick={() => {
                  setEditingLease(null);
                  setDetails(null);
                }}
                style={btnSecondary(border)}
              >
                Fermer
              </button>
            </div>

            {!details && <div style={{ marginTop: 12, color: muted }}>Chargement…</div>}

            {details && (
              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {/* ✅ DESIGNATION (editable) */}
                <section style={{ border: `1px solid ${border}`, borderRadius: 16, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>Désignation (contrat)</div>
                      <div style={{ color: muted, fontSize: 12 }}>Modifiable a posteriori (repris dans le contrat PDF).</div>
                    </div>
                    <button onClick={saveDesignation} style={btnPrimarySmall(blue)}>Enregistrer</button>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                    <label style={labelStyle(muted)}>
                      Bâtiment
                      <br />
                      <input
                        value={editDesignation.batiment || ""}
                        onChange={(e) => setEditDesignation((p) => ({ ...p, batiment: e.target.value }))}
                        style={inputStyle(border)}
                      />
                    </label>

                    <label style={labelStyle(muted)}>
                      Porte / Lot
                      <br />
                      <input
                        value={editDesignation.porte || ""}
                        onChange={(e) => setEditDesignation((p) => ({ ...p, porte: e.target.value }))}
                        style={inputStyle(border)}
                      />
                    </label>

                    <label style={labelStyle(muted)}>
                      Précision étage
                      <br />
                      <input
                        value={editDesignation.etagePrecision || ""}
                        onChange={(e) => setEditDesignation((p) => ({ ...p, etagePrecision: e.target.value }))}
                        style={inputStyle(border)}
                      />
                    </label>

                    <label style={labelStyle(muted)}>
                      Type de bien
                      <br />
                      <select
                        value={editDesignation.typeBien || "appartement"}
                        onChange={(e) => setEditDesignation((p) => ({ ...p, typeBien: e.target.value as any }))}
                        style={inputStyle(border)}
                      >
                        <option value="appartement">Appartement</option>
                        <option value="maison">Maison</option>
                      </select>
                    </label>

                    <label style={labelStyle(muted)}>
                      Usage mixte
                      <br />
                      <input
                        type="checkbox"
                        checked={Boolean(editDesignation.usageMixte)}
                        onChange={(e) => setEditDesignation((p) => ({ ...p, usageMixte: e.target.checked }))}
                      />
                    </label>

                    <label style={labelStyle(muted)}>
                      Consistance
                      <br />
                      <input
                        value={editDesignation.consistance || ""}
                        onChange={(e) => setEditDesignation((p) => ({ ...p, consistance: e.target.value }))}
                        style={inputStyle(border)}
                      />
                    </label>

                    <label style={labelStyle(muted)}>
                      Descriptif (optionnel)
                      <br />
                      <input
                        value={editDesignation.description || ""}
                        onChange={(e) => setEditDesignation((p) => ({ ...p, description: e.target.value }))}
                        style={inputStyle(border)}
                      />
                    </label>

                    <label style={labelStyle(muted)}>
                      Chauffage
                      <br />
                      <input
                        value={editDesignation.chauffageType || ""}
                        onChange={(e) => setEditDesignation((p) => ({ ...p, chauffageType: e.target.value }))}
                        style={inputStyle(border)}
                      />
                    </label>

                    <label style={labelStyle(muted)}>
                      Eau chaude
                      <br />
                      <input
                        value={editDesignation.eauChaudeType || ""}
                        onChange={(e) => setEditDesignation((p) => ({ ...p, eauChaudeType: e.target.value }))}
                        style={inputStyle(border)}
                      />
                    </label>

                    <label style={labelStyle(muted)}>
                      Nombre de clés remises
                      <br />
                      <input
                        type="number"
                        value={editKeysCount}
                        onChange={(e) => setEditKeysCount(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="ex: 2"
                        style={inputStyle(border)}
                      />
                    </label>

                    <label style={labelStyle(muted)}>
                      IRL — Trimestre de référence
                      <br />
                      <input value={editIrlQuarter} onChange={(e) => setEditIrlQuarter(e.target.value)} placeholder="ex: T3 2025" style={inputStyle(border)} />
                    </label>

                    <label style={labelStyle(muted)}>
                      IRL — Valeur de référence
                      <br />
                      <input value={editIrlValue} onChange={(e) => setEditIrlValue(e.target.value)} placeholder="ex: 142.06" style={inputStyle(border)} />
                    </label>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                    <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 10 }}>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>Dépendances</div>
                      {["cave", "parking", "garage", "jardin", "terrasse", "balcon"].map((x) => (
                        <label key={x} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                          <input
                            type="checkbox"
                            checked={(editDesignation.dependances || []).includes(x)}
                            onChange={() => setEditDesignation((p) => toggleArrayValueIn(p, "dependances", x))}
                          />
                          <span style={{ textTransform: "capitalize" }}>{x}</span>
                        </label>
                      ))}
                    </div>

                    <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 10 }}>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>Équipements communs</div>
                      {["interphone", "digicode", "ascenseur", "antenne TV", "fibre"].map((x) => (
                        <label key={x} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                          <input
                            type="checkbox"
                            checked={(editDesignation.equipementsCommuns || []).includes(x)}
                            onChange={() => setEditDesignation((p) => toggleArrayValueIn(p, "equipementsCommuns", x))}
                          />
                          <span>{x}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </section>

                {/* LOCATAIRES */}
                <section style={{ border: `1px solid ${border}`, borderRadius: 16, padding: 12 }}>
                  <div style={{ fontWeight: 900 }}>Locataires</div>

                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <select value={newCoTenantId} onChange={(e) => setNewCoTenantId(e.target.value)} style={{ ...inputStyle(border), minWidth: 280 }}>
                      <option value="">Ajouter un co-locataire…</option>
                      {selectableTenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                          {t.email ? ` — ${t.email}` : ""}
                        </option>
                      ))}
                    </select>
                    <button onClick={addCoTenant} style={btnPrimarySmall(blue)}>Ajouter</button>
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {details.tenants.map((t: any) => (
                      <div
                        key={t.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 10,
                          alignItems: "center",
                          border: `1px solid ${border}`,
                          borderRadius: 12,
                          padding: 10,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ fontWeight: 900 }}>{t.full_name}</span>
                            <span style={chip(border, t.role === "principal" ? "#16a34a" : "#6b7280")}>{t.role}</span>
                          </div>
                          <div style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                            {(t.email || "—")}
                            {t.phone ? ` • ${t.phone}` : ""}
                          </div>
                        </div>

                        {t.role !== "principal" && (
                          <button onClick={() => removeCoTenant(t.id)} style={btnDanger(border)}>
                            Retirer
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* MONTANTS */}
                <section style={{ border: `1px solid ${border}`, borderRadius: 16, padding: 12 }}>
                  <div style={{ fontWeight: 900 }}>Évolution des montants</div>

                  <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                    <label style={labelStyle(muted)}>
                      Date d’effet *
                      <br />
                      <input type="date" value={amountDate} onChange={(e) => setAmountDate(e.target.value)} style={inputStyle(border)} />
                    </label>

                    <label style={labelStyle(muted)}>
                      Loyer (€)
                      <br />
                      <input type="number" value={amountRent} onChange={(e) => setAmountRent(Number(e.target.value))} style={inputStyle(border)} />
                    </label>

                    <label style={labelStyle(muted)}>
                      Charges (€)
                      <br />
                      <input type="number" value={amountCharges} onChange={(e) => setAmountCharges(Number(e.target.value))} style={inputStyle(border)} />
                    </label>

                    <label style={labelStyle(muted)}>
                      Dépôt (€)
                      <br />
                      <input type="number" value={amountDeposit} onChange={(e) => setAmountDeposit(Number(e.target.value))} style={inputStyle(border)} />
                    </label>

                    <label style={labelStyle(muted)}>
                      Jour paiement
                      <br />
                      <input type="number" value={amountPayDay} onChange={(e) => setAmountPayDay(Number(e.target.value))} style={inputStyle(border)} />
                    </label>

                    <div style={{ display: "flex", alignItems: "end" }}>
                      <button onClick={addAmountsRow} style={btnPrimaryWide(blue)}>
                        Enregistrer
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                    {details.amounts.map((a: any) => (
                      <div key={a.id} style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <div style={{ fontWeight: 900 }}>À partir du {String(a.effective_date).slice(0, 10)}</div>
                          <button onClick={() => fillAmountsFromRow(a)} style={btnSecondary(border)}>
                            Corriger
                          </button>
                        </div>
                        <div style={{ color: muted, fontSize: 12 }}>
                          Loyer {(a.rent_cents / 100).toFixed(2)} € • Charges {(a.charges_cents / 100).toFixed(2)} € • Dépôt {(a.deposit_cents / 100).toFixed(2)} € • Paiement J{a.payment_day}
                        </div>
                      </div>
                    ))}
                    {!details.amounts.length && <div style={{ color: muted }}>Aucune ligne.</div>}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
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
    fontWeight: 900,
    cursor: "pointer",
  } as const;
}
function btnPrimaryWide(blue: string) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid rgba(31,111,235,0.35)`,
    background: "rgba(31,111,235,0.10)",
    color: "#0b2a6f",
    fontWeight: 900,
    cursor: "pointer",
    width: "fit-content",
  } as const;
}
function btnSecondary(border: string) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 800,
  } as const;
}
function btnAction(border: string) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 800,
    minWidth: 130,
    textAlign: "center" as const,
  } as const;
}
function btnDanger(border: string) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid rgba(220,38,38,0.35)`,
    background: "rgba(220,38,38,0.08)",
    color: "#7f1d1d",
    cursor: "pointer",
    fontWeight: 900,
    minWidth: 110,
    textAlign: "center" as const,
  } as const;
}
function chip(border: string, color: string) {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: "#fff",
    color,
    fontWeight: 900,
    fontSize: 12,
  } as const;
}
function statusChip(status: string, border: string) {
  const map: Record<string, string> = {
    draft: "#6b7280",
    active: "#1f6feb",
    notice: "#b45309",
    ended: "#16a34a",
  };
  return chip(border, map[status] || "#374151");
}
