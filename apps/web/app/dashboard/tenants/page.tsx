"use client";
import { useEffect, useMemo, useState } from "react";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type Tenant = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  birth_place: string | null;
  current_address: string | null;
  created_at: string;
};

type Lease = {
  id: string;
  tenant_id: string;
  unit_id: string;
  status: string; // draft|active|notice|ended
  unit_code?: string;
  tenant_name?: string;
};

export default function TenantsPage() {
  const [token, setToken] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // toggle create
  const [showCreate, setShowCreate] = useState(false);

  // toggle former tenants
  const [showFormer, setShowFormer] = useState(false);

  const blue = "#1f6feb";
  const border = "#e5e7eb";
  const muted = "#6b7280";

  // create form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [currentAddress, setCurrentAddress] = useState("");

  // edit modal
  const [editing, setEditing] = useState<Tenant | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  async function loadAll() {
    setError("");
    setStatus("Chargement…");
    try {
      const [t, l] = await Promise.all([
        fetch(`${API}/tenants`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" }).then((r) => r.json()),
        fetch(`${API}/leases`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" }).then((r) => r.json()),
      ]);

      setTenants(Array.isArray(t) ? t : []);
      setLeases(Array.isArray(l) ? l : []);
      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    if (token) loadAll();
  }, [token]);

  const leaseStatusByTenant = useMemo(() => {
    // tenantId -> Set(status)
    const map = new Map<string, Set<string>>();
    for (const l of leases) {
      const set = map.get(l.tenant_id) || new Set<string>();
      set.add(String(l.status || "").toLowerCase());
      map.set(l.tenant_id, set);
    }
    return map;
  }, [leases]);

  function isCurrentTenant(tenantId: string) {
    const set = leaseStatusByTenant.get(tenantId);
    if (!set) return false;
    return set.has("active") || set.has("notice");
  }

  const filteredTenants = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return tenants;
    return tenants.filter((t) =>
      [t.full_name, t.email, t.phone].filter(Boolean).join(" ").toLowerCase().includes(s)
    );
  }, [tenants, q]);

  const currentTenants = useMemo(() => {
    return filteredTenants.filter((t) => isCurrentTenant(t.id));
  }, [filteredTenants, leaseStatusByTenant]);

  const formerTenants = useMemo(() => {
    return filteredTenants.filter((t) => !isCurrentTenant(t.id));
  }, [filteredTenants, leaseStatusByTenant]);

  async function createTenant() {
    setError("");
    setStatus("Création…");
    if (!fullName.trim()) {
      setStatus("");
      setError("Nom complet obligatoire.");
      return;
    }
    try {
      const r = await fetch(`${API}/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          birthDate: birthDate || null,
          birthPlace: birthPlace.trim() || null,
          currentAddress: currentAddress.trim() || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Locataire créé ✅");
      setFullName(""); setEmail(""); setPhone(""); setBirthDate(""); setBirthPlace(""); setCurrentAddress("");
      setShowCreate(false);
      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setError("");
    setStatus("Enregistrement…");
    try {
      const r = await fetch(`${API}/tenants/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          fullName: editing.full_name,
          email: editing.email,
          phone: editing.phone,
          birthDate: editing.birth_date,
          birthPlace: editing.birth_place,
          currentAddress: editing.current_address,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Modifications enregistrées ✅");
      setEditing(null);
      await loadAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Locataires</h1>
          <div style={{ color: muted }}>
            Actuels = bail <b>active</b> ou <b>notice</b>. Anciens = uniquement ended (ou aucun bail).
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, minWidth: 260 }}
          />
          <button onClick={() => setShowCreate((v) => !v)} style={btnPrimarySmall(blue)}>
            {showCreate ? "Fermer" : "Créer un locataire"}
          </button>
          <button onClick={loadAll} style={btnSecondary(border)}>Rafraîchir</button>
        </div>
      </div>

      {status && <p style={{ color: "#0a6" }}>{status}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {/* Create card */}
      {showCreate && (
        <section style={{ marginTop: 14, border: `1px solid ${border}`, borderRadius: 16, background: "#fff", padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Nouveau locataire</h2>
            <span style={{ color: muted, fontSize: 12 }}>MVP (champs optionnels sauf le nom)</span>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <Field label="Nom complet *" value={fullName} setValue={setFullName} />
            <Field label="Email" value={email} setValue={setEmail} />
            <Field label="Téléphone" value={phone} setValue={setPhone} />
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <DateField label="Date de naissance" value={birthDate} setValue={setBirthDate} />
            <Field label="Lieu de naissance" value={birthPlace} setValue={setBirthPlace} />
            <div style={{ display: "flex", alignItems: "end" }}>
              <button onClick={createTenant} style={btnPrimaryWide(blue)}>Créer</button>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 12, color: muted }}>Adresse actuelle</span>
              <textarea
                rows={2}
                value={currentAddress}
                onChange={(e) => setCurrentAddress(e.target.value)}
                style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, resize: "vertical", boxSizing: "border-box", width: "100%" }}
              />
            </label>
          </div>
        </section>
      )}

      {/* Current tenants */}
      <section style={{ marginTop: 14 }}>
        <div style={{ color: muted, fontSize: 12, marginBottom: 8 }}>
          {currentTenants.length} locataire(s) actuel(s)
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {currentTenants.map((t) => (
            <TenantCard key={t.id} t={t} border={border} muted={muted} setEditing={setEditing} isCurrent />
          ))}

          {!currentTenants.length && (
            <div style={{ border: `1px dashed ${border}`, borderRadius: 16, padding: 14, color: muted, background: "#fff" }}>
              Aucun locataire actuel.
            </div>
          )}
        </div>

        {/* Former tenants (collapsible) */}
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setShowFormer((v) => !v)} style={btnSecondary(border)}>
            {showFormer ? "Masquer" : "Afficher"} les anciens ({formerTenants.length})
          </button>

          {showFormer && (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {formerTenants.map((t) => (
                <TenantCard key={t.id} t={t} border={border} muted={muted} setEditing={setEditing} isCurrent={false} />
              ))}
              {!formerTenants.length && (
                <div style={{ border: `1px dashed ${border}`, borderRadius: 16, padding: 14, color: muted, background: "#fff" }}>
                  Aucun ancien locataire.
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Edit modal */}
      {editing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 16,
          }}
          onClick={() => setEditing(null)}
        >
          <div
            style={{ background: "#fff", width: "min(860px, 100%)", borderRadius: 16, padding: 14, border: `1px solid ${border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Modifier</div>
                <div style={{ color: muted, fontSize: 12 }}>{editing.id}</div>
              </div>
              <button onClick={() => setEditing(null)} style={btnSecondary(border)}>Fermer</button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              <Field label="Nom complet" value={editing.full_name} setValue={(v) => setEditing({ ...editing, full_name: v })} />
              <Field label="Email" value={editing.email || ""} setValue={(v) => setEditing({ ...editing, email: v || null })} />
              <Field label="Téléphone" value={editing.phone || ""} setValue={(v) => setEditing({ ...editing, phone: v || null })} />
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              <DateField label="Date de naissance" value={(editing.birth_date || "").slice(0, 10)} setValue={(v) => setEditing({ ...editing, birth_date: v || null })} />
              <Field label="Lieu de naissance" value={editing.birth_place || ""} setValue={(v) => setEditing({ ...editing, birth_place: v || null })} />
              <div />
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: muted }}>Adresse actuelle</span>
                <textarea
                  rows={2}
                  value={editing.current_address || ""}
                  onChange={(e) => setEditing({ ...editing, current_address: e.target.value || null })}
                  style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, resize: "vertical", boxSizing: "border-box", width: "100%" }}
                />
              </label>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button onClick={saveEdit} style={btnPrimarySmall(blue)}>Enregistrer</button>
              <button onClick={() => setEditing(null)} style={btnSecondary(border)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function TenantCard({ t, border, muted, setEditing, isCurrent }: any) {
  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 16, background: "#fff", padding: 14, opacity: isCurrent ? 1 : 0.95 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 900, fontSize: 16 }}>{t.full_name}</span>
            <span style={{ color: muted }}>{t.email || "—"}</span>
            <span style={chip(border, isCurrent ? "#16a34a" : "#6b7280")}>
              {isCurrent ? "Actuel" : "Ancien"}
            </span>
          </div>
          <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={chip(border, "#374151")}>{t.phone || "Téléphone —"}</span>
            <span style={chip(border, "#374151")}>
              {t.birth_date ? `Naissance: ${String(t.birth_date).slice(0, 10)}` : "Naissance —"}
            </span>
          </div>
        </div>

        <button onClick={() => setEditing(t)} style={btnSecondary(border)}>Modifier</button>
      </div>

      {t.current_address && (
        <div style={{ marginTop: 10, color: "#374151", fontSize: 13 }}>
          <b style={{ color: muted }}>Adresse:</b> {t.current_address}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, setValue }: { label: string; value: string; setValue: (v: string) => void }) {
  const border = "#e5e7eb";
  const muted = "#6b7280";
  return (
    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, color: muted }}>{label}</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, boxSizing: "border-box", width: "100%" }}
      />
    </label>
  );
}
function DateField({ label, value, setValue }: { label: string; value: string; setValue: (v: string) => void }) {
  const border = "#e5e7eb";
  const muted = "#6b7280";
  return (
    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, color: muted }}>{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, boxSizing: "border-box", width: "100%" }}
      />
    </label>
  );
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
