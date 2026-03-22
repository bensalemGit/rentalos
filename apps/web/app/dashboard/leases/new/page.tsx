"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, RefreshCw } from "lucide-react";

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

type Tenant = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
};

type GuaranteeDraftType = "NONE" | "CAUTION" | "VISALE";

type GuaranteeDraft = {
  type: GuaranteeDraftType;
  guarantorFullName: string;
  guarantorEmail: string;
  guarantorPhone: string;
  visaleReference: string;
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

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

function emptyGuaranteeDraft(): GuaranteeDraft {
  return {
    type: "NONE",
    guarantorFullName: "",
    guarantorEmail: "",
    guarantorPhone: "",
    visaleReference: "",
  };
}

export default function NewLeasePage() {
  const router = useRouter();

  const [token, setToken] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [unitId, setUnitId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [coTenantIds, setCoTenantIds] = useState<string[]>([]);
  const [newCoTenantIdCreate, setNewCoTenantIdCreate] = useState("");

  const [guaranteeByTenantId, setGuaranteeByTenantId] = useState<Record<string, GuaranteeDraft>>({});

  const [startDate, setStartDate] = useState("");
  const [endDateTheoretical, setEndDateTheoretical] = useState("");

  const [rent, setRent] = useState<number>(950);
  const [charges, setCharges] = useState<number>(50);
  type LeaseChargesMode = "FORFAIT" | "PROVISION";
  const [chargesMode, setChargesMode] = useState<LeaseChargesMode>("FORFAIT");

  const [deposit, setDeposit] = useState<number>(1900);
  const [paymentDay, setPaymentDay] = useState<number>(5);

  const [kind, setKind] = useState<string>("MEUBLE_RP");

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

  const [keysCount, setKeysCount] = useState<number | "">(2);
  const [irlQuarter, setIrlQuarter] = useState<string>("");
  const [irlValue, setIrlValue] = useState<string>("");
  const [irlEnabledCreate, setIrlEnabledCreate] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  function ensureGuaranteeDraft(idLike: string) {
    const id = String(idLike || "").trim();
    if (!id) return;
    setGuaranteeByTenantId((prev) => {
      if (prev[id]) return prev;
      return { ...prev, [id]: emptyGuaranteeDraft() };
    });
  }

  function updateGuaranteeDraft(idLike: string, patch: Partial<GuaranteeDraft>) {
    const id = String(idLike || "").trim();
    if (!id) return;
    setGuaranteeByTenantId((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || emptyGuaranteeDraft()), ...patch },
    }));
  }

  useEffect(() => {
    setCoTenantIds((prev) => prev.filter((id) => id && id !== tenantId));
    setNewCoTenantIdCreate("");
    ensureGuaranteeDraft(tenantId);
  }, [tenantId]);

  function prefillDesignationFromUnit(u: Unit | undefined) {
    if (!u) return;

    const floorLabel =
      u.floor === null || u.floor === undefined ? "" : u.floor === 0 ? "RDC" : `Étage ${u.floor}`;

    setDesignation((prev) => ({
      ...prev,
      batiment: u.building_name || prev.batiment || "Bâtiment principal",
      porte: u.code || prev.porte || "",
      etagePrecision: floorLabel || prev.etagePrecision || "",
      consistance: u.label || prev.consistance || "",
    }));
  }

  async function loadInitialData() {
    setError("");
    setStatus("Chargement…");
    try {
      const [u, t] = await Promise.all([
        fetch(`${API}/units`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }).then((r) => r.json()),
        fetch(`${API}/tenants`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }).then((r) => r.json()),
      ]);

      const unitsArr: Unit[] = Array.isArray(u) ? u : [];
      const tenantsArr: Tenant[] = Array.isArray(t) ? t : [];

      setUnits(unitsArr);
      setTenants(tenantsArr);

      if (!unitId && unitsArr[0]?.id) {
        setUnitId(unitsArr[0].id);
        prefillDesignationFromUnit(unitsArr[0]);
      }

      if (!tenantId && tenantsArr[0]?.id) {
        setTenantId(tenantsArr[0].id);
      }

      if (!startDate) {
        setStartDate(new Date().toISOString().slice(0, 10));
      }

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
    if (token) loadInitialData();
  }, [token]);

  useEffect(() => {
    const u = units.find((x) => x.id === unitId);
    prefillDesignationFromUnit(u);
  }, [unitId]);

  useEffect(() => {
    if (kind === "SAISONNIER") {
      setGuaranteeByTenantId({});
    }
  }, [kind]);

  const createTenantsList = useMemo(() => {
    const list: Array<{ id: string; full_name: string; email?: string | null; role: string }> = [];

    const main = tenants.find((t) => t.id === tenantId);
    if (main) list.push({ ...main, role: "principal" });

    for (const id of coTenantIds) {
      const t = tenants.find((x) => x.id === id);
      if (t) list.push({ ...t, role: "cotenant" });
    }

    return list;
  }, [tenants, tenantId, coTenantIds]);

  useEffect(() => {
    createTenantsList.forEach((t) => ensureGuaranteeDraft(t.id));
  }, [createTenantsList]);

  async function createGuaranteesAfterLeaseCreated(newLeaseId: string, allowedTenantIds: string[]) {
    const allowed = new Set((allowedTenantIds || []).map((x) => String(x).trim()).filter(Boolean));

    const entries = (Object.entries(guaranteeByTenantId) as Array<[string, GuaranteeDraft]>).filter(
      ([tenantId]) => allowed.has(String(tenantId).trim())
    );

    for (const [tenantId, g] of entries) {
      if (!g || g.type === "NONE") continue;

      if (g.type === "CAUTION") {
        const full = String(g.guarantorFullName || "").trim();
        const em = String(g.guarantorEmail || "").trim();
        if (!full || !em) throw new Error(`Caution: nom/email manquants pour le locataire ${tenantId}`);

        const gr = await fetch(`${API}/guarantees`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          credentials: "include",
          body: JSON.stringify({
            leaseId: newLeaseId,
            tenantId,
            type: "CAUTION",
            selected: true,
            guarantorFullName: full,
            guarantorEmail: em,
            guarantorPhone: String(g.guarantorPhone || "").trim() || null,
          }),
        });

        const gj = await gr.json().catch(() => ({}));
        if (!gr.ok) throw new Error(gj?.message || JSON.stringify(gj));
      }

      if (g.type === "VISALE") {
        const ref = String(g.visaleReference || "").trim();
        if (!ref) throw new Error(`Visale: référence manquante pour le locataire ${tenantId}`);

        const vr = await fetch(`${API}/guarantees`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          credentials: "include",
          body: JSON.stringify({
            leaseId: newLeaseId,
            tenantId,
            type: "VISALE",
            selected: true,
            visaleReference: ref,
          }),
        });

        const vj = await vr.json().catch(() => ({}));
        if (!vr.ok) throw new Error(vj?.message || JSON.stringify(vj));
      }
    }
  }

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
      coTenantIds,
      startDate,
      endDateTheoretical,
      rentCents: Math.round((rent || 0) * 100),
      chargesCents: Math.round((charges || 0) * 100),
      chargesMode,
      depositCents: Math.round((deposit || 0) * 100),
      paymentDay: paymentDay || 5,
      kind,
      leaseDesignation: designation,
      keysCount: keysCount === "" ? null : Number(keysCount),
      irlReferenceQuarter: irlQuarter || null,
      irlReferenceValue: irlValue ? Number(irlValue) : null,
      irlEnabled: irlEnabledCreate,
    };

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

      const createdLeaseId =
        j?.lease?.id || j?.leaseId || j?.id || j?.created?.id || null;

      if (!createdLeaseId) {
        setStatus("");
        setError("Bail créé mais id introuvable dans la réponse API.");
        return;
      }

      try {
        await createGuaranteesAfterLeaseCreated(createdLeaseId, [tenantId, ...coTenantIds]);
      } catch (e: any) {
        console.error(e);
        setStatus("");
        setError(
          `Bail créé ✅ (id=${createdLeaseId}) mais création des garanties échouée : ${String(
            e?.message || e
          )}`
        );
      }

      setGuaranteeByTenantId({});
      router.push("/dashboard/leases");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  return (
    <main style={pageShell}>
      <div style={contentWrap}>
        <div style={topBarStyle}>
          <button onClick={() => router.push("/dashboard/leases")} style={ghostButtonStyle}>
            <ArrowLeft size={16} />
            Retour aux baux
          </button>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={loadInitialData} style={ghostButtonStyle}>
              <RefreshCw size={14} />
              Rafraîchir
            </button>
          </div>
        </div>

        <section style={heroStyle}>
          <div>
            <div style={eyebrowStyle}>Création</div>
            <h1 style={pageTitleStyle}>Nouveau bail</h1>
            <p style={pageSubtitleStyle}>
              Création complète d’un bail avec désignation, co-locataires, IRL et garanties.
            </p>
          </div>
        </section>

        {status ? <div style={successAlertStyle}>{status}</div> : null}
        {error ? <div style={errorAlertStyle}>{error}</div> : null}

        <section style={cardStyle}>
          <div style={sectionTitleRowStyle}>
            <h2 style={sectionTitleStyle}>Informations principales</h2>
          </div>

          <div style={grid3Style}>
            <Field label="Type de location">
              <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle}>
                <option value="MEUBLE_RP">Meublé (résidence principale)</option>
                <option value="NU_RP">Nu (résidence principale)</option>
                <option value="SAISONNIER">Saisonnier</option>
              </select>
            </Field>

            <Field label="Logement">
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={inputStyle}>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} — {u.label}
                    {u.building_name ? ` (${u.building_name})` : ""}
                    {u.project_name ? ` • ${u.project_name}` : ""}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Locataire principal">
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} style={inputStyle}>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                    {t.email ? ` — ${t.email}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={subCardStyle}>
            <div style={subSectionTitleStyle}>Co-locataires (optionnel)</div>
            <div style={subSectionTextStyle}>
              Ajoute un ou plusieurs co-locataires dès la création.
            </div>

            <div style={inlineRowStyle}>
              <select
                value={newCoTenantIdCreate}
                onChange={(e) => setNewCoTenantIdCreate(e.target.value)}
                style={{ ...inputStyle, minWidth: 320 }}
              >
                <option value="">Ajouter un co-locataire…</option>
                {tenants
                  .filter((t) => t.id !== tenantId)
                  .filter((t) => !coTenantIds.includes(t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} {t.email ? `— ${t.email}` : ""}
                    </option>
                  ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  const id = String(newCoTenantIdCreate || "").trim();
                  if (!id) return;
                  setCoTenantIds((prev) => Array.from(new Set([...prev, id])));
                  ensureGuaranteeDraft(id);
                  setNewCoTenantIdCreate("");
                }}
                style={secondaryButtonStyle}
              >
                Ajouter
              </button>
            </div>

            {!!coTenantIds.length && (
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {coTenantIds.map((id) => {
                  const t = tenants.find((x) => x.id === id);
                  return (
                    <div key={id} style={listRowStyle}>
                      <div>
                        <div style={listTitleStyle}>{t?.full_name || id}</div>
                        <div style={listMetaStyle}>cotenant</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCoTenantIds((prev) => prev.filter((x) => x !== id))}
                        style={dangerButtonStyle}
                      >
                        Retirer
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={grid2Style}>
            <Field label="Date début">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
            </Field>

            <Field label="Fin (entrée/sortie pour saisonnier)">
              <input
                type="date"
                value={endDateTheoretical}
                onChange={(e) => setEndDateTheoretical(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          <div style={grid5Style}>
            <Field label="Loyer (€)">
              <input type="number" value={rent} onChange={(e) => setRent(Number(e.target.value))} style={inputStyle} />
            </Field>

            <Field label="Charges (€)">
              <input type="number" value={charges} onChange={(e) => setCharges(Number(e.target.value))} style={inputStyle} />
            </Field>

            <Field label="Mode de charges">
              <div style={radioWrapStyle}>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="chargesMode"
                    checked={chargesMode === "FORFAIT"}
                    onChange={() => setChargesMode("FORFAIT")}
                  />
                  Forfait
                </label>
                <label style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="chargesMode"
                    checked={chargesMode === "PROVISION"}
                    onChange={() => setChargesMode("PROVISION")}
                  />
                  Provision
                </label>
              </div>
            </Field>

            <Field label="Dépôt (€)">
              <input type="number" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} style={inputStyle} />
            </Field>

            <Field label="Jour paiement">
              <input type="number" value={paymentDay} onChange={(e) => setPaymentDay(Number(e.target.value))} style={inputStyle} />
            </Field>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={sectionTitleRowStyle}>
            <h2 style={sectionTitleStyle}>Désignation (contrat)</h2>
          </div>

          <div style={grid3Style}>
            <Field label="Bâtiment">
              <input value={designation.batiment || ""} onChange={(e) => setDesignation((p) => ({ ...p, batiment: e.target.value }))} style={inputStyle} />
            </Field>

            <Field label="Porte / Lot">
              <input value={designation.porte || ""} onChange={(e) => setDesignation((p) => ({ ...p, porte: e.target.value }))} style={inputStyle} />
            </Field>

            <Field label="Précision étage">
              <input value={designation.etagePrecision || ""} onChange={(e) => setDesignation((p) => ({ ...p, etagePrecision: e.target.value }))} style={inputStyle} />
            </Field>

            <Field label="Type de bien">
              <select
                value={designation.typeBien || "appartement"}
                onChange={(e) => setDesignation((p) => ({ ...p, typeBien: e.target.value as any }))}
                style={inputStyle}
              >
                <option value="appartement">Appartement</option>
                <option value="maison">Maison</option>
              </select>
            </Field>

            <Field label="Usage mixte">
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={Boolean(designation.usageMixte)}
                  onChange={(e) => setDesignation((p) => ({ ...p, usageMixte: e.target.checked }))}
                />
                <span>Habitation + pro</span>
              </label>
            </Field>

            <Field label="Consistance">
              <input value={designation.consistance || ""} onChange={(e) => setDesignation((p) => ({ ...p, consistance: e.target.value }))} style={inputStyle} />
            </Field>

            <Field label="Descriptif">
              <input value={designation.description || ""} onChange={(e) => setDesignation((p) => ({ ...p, description: e.target.value }))} style={inputStyle} />
            </Field>

            <Field label="Chauffage">
              <select
                value={designation.chauffageType || "électrique individuel"}
                onChange={(e) => setDesignation((p) => ({ ...p, chauffageType: e.target.value }))}
                style={inputStyle}
              >
                <option value="électrique individuel">Électrique individuel</option>
                <option value="gaz individuel">Gaz individuel</option>
                <option value="collectif">Collectif</option>
                <option value="pompe à chaleur">Pompe à chaleur</option>
                <option value="autre">Autre</option>
              </select>
            </Field>

            <Field label="Eau chaude">
              <select
                value={designation.eauChaudeType || "ballon électrique"}
                onChange={(e) => setDesignation((p) => ({ ...p, eauChaudeType: e.target.value }))}
                style={inputStyle}
              >
                <option value="ballon électrique">Ballon électrique</option>
                <option value="chaudière gaz">Chaudière gaz</option>
                <option value="collectif">Collectif</option>
                <option value="autre">Autre</option>
              </select>
            </Field>

            <Field label="Nombre de clés remises">
              <input
                type="number"
                value={keysCount}
                onChange={(e) => setKeysCount(e.target.value === "" ? "" : Number(e.target.value))}
                style={inputStyle}
              />
            </Field>

            <Field label="IRL activé">
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={irlEnabledCreate}
                  onChange={(e) => setIrlEnabledCreate(e.target.checked)}
                />
                <span>Activer la révision IRL</span>
              </label>
            </Field>

            <Field label="IRL — Trimestre">
              <input value={irlQuarter} onChange={(e) => setIrlQuarter(e.target.value)} style={inputStyle} disabled={!irlEnabledCreate} />
            </Field>

            <Field label="IRL — Valeur">
              <input value={irlValue} onChange={(e) => setIrlValue(e.target.value)} style={inputStyle} disabled={!irlEnabledCreate} />
            </Field>
          </div>

          <div style={grid2Style}>
            <div style={subCardStyle}>
              <div style={subSectionTitleStyle}>Dépendances</div>
              {["cave", "parking", "garage", "jardin", "terrasse", "balcon"].map((x) => (
                <label key={x} style={checkListItemStyle}>
                  <input
                    type="checkbox"
                    checked={(designation.dependances || []).includes(x)}
                    onChange={() => setDesignation((p) => toggleArrayValueIn(p, "dependances", x))}
                  />
                  <span style={{ textTransform: "capitalize" }}>{x}</span>
                </label>
              ))}
            </div>

            <div style={subCardStyle}>
              <div style={subSectionTitleStyle}>Équipements communs</div>
              {["interphone", "digicode", "ascenseur", "antenne TV", "fibre"].map((x) => (
                <label key={x} style={checkListItemStyle}>
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
        </section>

        {kind !== "SAISONNIER" && (
          <section style={cardStyle}>
            <div style={sectionTitleRowStyle}>
              <h2 style={sectionTitleStyle}>Garanties (optionnel)</h2>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {createTenantsList.map((t) => {
                const g = guaranteeByTenantId[t.id] || emptyGuaranteeDraft();

                return (
                  <div key={t.id} style={subCardStyle}>
                    <div style={listTitleStyle}>
                      {t.full_name} <span style={{ color: "#667085", fontWeight: 600 }}>({t.role})</span>
                    </div>

                    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                      <Field label="Type de garantie">
                        <select
                          value={g.type}
                          onChange={(e) => updateGuaranteeDraft(t.id, { type: e.target.value as GuaranteeDraftType })}
                          style={inputStyle}
                        >
                          <option value="NONE">Aucune</option>
                          <option value="CAUTION">Caution / garant</option>
                          <option value="VISALE">Visale</option>
                        </select>
                      </Field>

                      {g.type === "CAUTION" && (
                        <div style={grid3Style}>
                          <Field label="Nom garant *">
                            <input
                              value={g.guarantorFullName}
                              onChange={(e) => updateGuaranteeDraft(t.id, { guarantorFullName: e.target.value })}
                              style={inputStyle}
                            />
                          </Field>

                          <Field label="Email garant *">
                            <input
                              value={g.guarantorEmail}
                              onChange={(e) => updateGuaranteeDraft(t.id, { guarantorEmail: e.target.value })}
                              style={inputStyle}
                            />
                          </Field>

                          <Field label="Téléphone">
                            <input
                              value={g.guarantorPhone}
                              onChange={(e) => updateGuaranteeDraft(t.id, { guarantorPhone: e.target.value })}
                              style={inputStyle}
                            />
                          </Field>
                        </div>
                      )}

                      {g.type === "VISALE" && (
                        <Field label="Référence Visale *">
                          <input
                            value={g.visaleReference}
                            onChange={(e) => updateGuaranteeDraft(t.id, { visaleReference: e.target.value })}
                            style={inputStyle}
                          />
                        </Field>
                      )}
                    </div>
                  </div>
                );
              })}

              {createTenantsList.length === 0 && (
                <div style={emptyStateStyle}>Choisis d’abord un locataire principal.</div>
              )}
            </div>
          </section>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={createLease} style={primaryButtonStyle}>
            <Plus size={16} />
            Créer le bail
          </button>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={fieldStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </label>
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

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const ghostButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid rgba(27,39,64,0.08)",
  background: "#fff",
  color: "#243247",
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid rgba(52,103,235,0.10)",
  background: "#3467EB",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(52,103,235,0.16)",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(27,39,64,0.08)",
  background: "#fff",
  color: "#243247",
  fontWeight: 700,
  cursor: "pointer",
};

const heroStyle: React.CSSProperties = {
  border: "1px solid rgba(27,39,64,0.06)",
  borderRadius: 24,
  background: "linear-gradient(180deg, #FCFDFF 0%, #F7F9FD 100%)",
  padding: "24px 24px 22px",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#8D99AE",
  fontWeight: 800,
  marginBottom: 8,
};

const pageTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 38,
  lineHeight: 1.02,
  letterSpacing: "-0.04em",
  color: "#17233A",
  fontWeight: 900,
};

const pageSubtitleStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 15,
  color: "#667085",
  lineHeight: 1.6,
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

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(27,39,64,0.06)",
  borderRadius: 24,
  background: "#fff",
  padding: 22,
  boxShadow: "0 10px 30px rgba(16,24,40,0.05)",
};

const subCardStyle: React.CSSProperties = {
  border: "1px solid rgba(27,39,64,0.06)",
  borderRadius: 18,
  padding: 16,
  background: "#FCFDFF",
};

const sectionTitleRowStyle: React.CSSProperties = {
  marginBottom: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  color: "#17233A",
  fontWeight: 900,
};

const subSectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#17233A",
  fontWeight: 800,
  marginBottom: 8,
};

const subSectionTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#667085",
  marginBottom: 12,
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#667085",
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(27,39,64,0.08)",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  background: "#fff",
};

const grid2Style: React.CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  marginTop: 16,
};

const grid3Style: React.CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const grid5Style: React.CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  marginTop: 16,
};

const checkboxRowStyle: React.CSSProperties = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  color: "#243247",
  fontSize: 14,
};

const inlineRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const radioWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 18,
  flexWrap: "wrap",
  minHeight: 44,
  alignItems: "center",
};

const radioLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: "#667085",
  fontSize: 14,
};

const checkListItemStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  marginBottom: 8,
  color: "#243247",
  fontSize: 14,
};

const listRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  border: "1px solid rgba(27,39,64,0.06)",
  borderRadius: 14,
  padding: 12,
  background: "#fff",
};

const listTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#17233A",
};

const listMetaStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#667085",
  marginTop: 4,
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(220,38,38,0.18)",
  background: "#FFF5F7",
  color: "#A12C52",
  cursor: "pointer",
  fontWeight: 800,
};

const emptyStateStyle: React.CSSProperties = {
  border: "1px dashed rgba(27,39,64,0.12)",
  borderRadius: 16,
  padding: 16,
  color: "#667085",
  background: "#FCFDFF",
};