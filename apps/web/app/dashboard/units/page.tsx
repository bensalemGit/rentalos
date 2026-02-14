"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";


const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type Project = { id: string; name: string; kind: string };

type Building = {
  id: string;
  project_id: string;
  project_name?: string;
  name: string;
  address: string;
  notes: string | null;
};

type Unit = {
  id: string;
  code: string;
  label: string;
  address_line1: string;
  city: string;
  postal_code: string;
  surface_m2: string | number;
  floor: string | number;
  created_at: string;

  project_id?: string | null;
  project_name?: string | null;

  building_id?: string | null;
  building_name?: string | null;
};

export default function UnitsPage() {
  const [token, setToken] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);

  // filters
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [buildingFilter, setBuildingFilter] = useState<string>("all");

  // create form
  const [projectId, setProjectId] = useState<string>("");
  const [buildingId, setBuildingId] = useState<string>("");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [surfaceM2, setSurfaceM2] = useState<number>(0);
  const [floor, setFloor] = useState<number>(0);

  // edit modal
  const [editing, setEditing] = useState<Unit | null>(null);
  const [editProjectId, setEditProjectId] = useState<string>("");
  const [editBuildingId, setEditBuildingId] = useState<string>("");

  const blue = "#1f6feb";
  const border = "#e5e7eb";
  const muted = "#6b7280";

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  async function loadProjects() {
    const r = await fetch(`${API}/projects`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    const j = await r.json();
    const arr = Array.isArray(j) ? j : [];
    setProjects(arr);

    if (!projectId && arr.length) setProjectId(arr[0].id);
  }

  async function loadBuildings() {
    const r = await fetch(`${API}/buildings`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    const j = await r.json();
    const arr = Array.isArray(j) ? j : [];
    setBuildings(arr);

    if (!buildingId && projectId) {
      const b = arr.find((x: any) => x.project_id === projectId);
      if (b?.id) setBuildingId(b.id);
    }
  }

  async function loadUnits() {
    const r = await fetch(`${API}/units`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j?.id ? [j] : []);
    setUnits(arr);
  }

  async function loadAll() {
    setError("");
    setStatus("Chargement…");
    try {
      await Promise.all([loadProjects(), loadBuildings(), loadUnits()]);
      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    if (token) loadAll();
  }, [token]);

  // --- BONUS helper: suggest prefix from building name ---
  function suggestPrefix(buildingName: string) {
    const n = (buildingName || "").trim();

    // Special case: Sougy1..Sougy9 => SOU1-
    const m = n.match(/sougy\s*([0-9]+)/i);
    if (m?.[1]) return `SOU${m[1]}-`;

    // Fallback: first 6 letters (alnum) upper + '-'
    const cleaned = n
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    return cleaned ? `${cleaned}-` : "";
  }

  // Create: when project changes, default building in that project
  useEffect(() => {
    if (!projectId) return;
    const b = buildings.find((x) => x.project_id === projectId);
    if (b?.id) setBuildingId(b.id);
    else setBuildingId("");
  }, [projectId]);

  // ✅ BONUS: when building changes, prefill code prefix if code is empty
  useEffect(() => {
    if (!buildingId) return;
    if (code.trim() !== "") return; // don't overwrite if user typed
    const b = buildings.find((x) => x.id === buildingId);
    if (!b) return;
    const prefix = suggestPrefix(b.name);
    if (prefix) setCode(prefix);
  }, [buildingId]);

  // Edit: when edit project changes, adjust edit building
  useEffect(() => {
    if (!editing) return;
    if (!editProjectId) {
      setEditBuildingId("");
      return;
    }
    const b = buildings.find((x) => x.project_id === editProjectId);
    if (b?.id) setEditBuildingId(b.id);
    else setEditBuildingId("");
  }, [editProjectId, editing]);

  const buildingsForProject = useMemo(() => {
    if (!projectId) return buildings;
    return buildings.filter((b) => b.project_id === projectId);
  }, [buildings, projectId]);

  const buildingFilterOptions = useMemo(() => {
    if (projectFilter === "all") return buildings;
    if (projectFilter === "none") return [];
    return buildings.filter((b) => b.project_id === projectFilter);
  }, [buildings, projectFilter]);

  const filtered = useMemo(() => {
    let arr = units;

    if (projectFilter !== "all") {
      if (projectFilter === "none") arr = arr.filter((u) => !u.project_id);
      else arr = arr.filter((u) => u.project_id === projectFilter);
    }

    if (buildingFilter !== "all") {
      if (buildingFilter === "none") arr = arr.filter((u) => !u.building_id);
      else arr = arr.filter((u) => u.building_id === buildingFilter);
    }

    const s = q.trim().toLowerCase();
    if (!s) return arr;
    return arr.filter((u) =>
      [
        u.code,
        u.label,
        u.address_line1,
        u.city,
        u.postal_code,
        u.project_name,
        u.building_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [units, q, projectFilter, buildingFilter]);

  async function createUnit() {
    setStatus("Création…");
    setError("");

    if (!code.trim() || !label.trim()) {
      setStatus("");
      setError("Code et libellé sont obligatoires.");
      return;
    }

    try {
      const r = await fetch(`${API}/units`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          code: code.trim(),
          label: label.trim(),
          addressLine1: addressLine1.trim() || "—",
          city: city.trim() || "—",
          postalCode: postalCode.trim() || "—",
          surfaceM2: Number(surfaceM2 || 0),
          floor: Number(floor || 0),
          projectId: projectId || null,
          buildingId: buildingId || null,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }

      setStatus("Logement créé ✅");
      setCode(""); setLabel(""); setAddressLine1(""); setCity(""); setPostalCode(""); setSurfaceM2(0); setFloor(0);
      setShowCreate(false);
      await loadUnits();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  function openEdit(u: Unit) {
    setEditing(u);
    setEditProjectId(u.project_id || "");
    setEditBuildingId(u.building_id || "");
  }

  async function saveEdit() {
    if (!editing) return;
    setStatus("Enregistrement…");
    setError("");

    try {
      const r = await fetch(`${API}/units/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          code: editing.code,
          label: editing.label,
          addressLine1: editing.address_line1,
          city: editing.city,
          postalCode: editing.postal_code,
          surfaceM2: Number(editing.surface_m2 || 0),
          floor: Number(editing.floor || 0),
          projectId: editProjectId || null,
          buildingId: editBuildingId || null,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }

      setStatus("Logement modifié ✅");
      setEditing(null);
      await loadUnits();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Logements</h1>
          <div style={{ color: muted }}>
            Filtrer par Projet/Immeuble, et création avec auto-préfixe de code selon l’immeuble.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={projectFilter}
            onChange={(e) => {
              const v = e.target.value;
              setProjectFilter(v);
              setBuildingFilter("all");
            }}
            style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, minWidth: 220 }}
            title="Filtrer par projet"
          >
            <option value="all">Tous les projets</option>
            <option value="none">Sans projet</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, minWidth: 220 }}
            title="Filtrer par immeuble"
          >
            <option value="all">Tous les immeubles</option>
            <option value="none">Sans immeuble</option>
            {buildingFilterOptions.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <input
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, minWidth: 260 }}
          />

          <button onClick={() => setShowCreate((v) => !v)} style={btnPrimarySmall(blue)}>
            {showCreate ? "Fermer" : "Créer un logement"}
          </button>

          <button onClick={loadAll} style={btnSecondary(border)}>Rafraîchir</button>
        </div>
      </div>

      {status && <p style={{ color: "#0a6" }}>{status}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {showCreate && (
        <section style={{ marginTop: 14, border: `1px solid ${border}`, borderRadius: 16, background: "#fff", padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Nouveau logement</h2>
            <span style={{ color: muted, fontSize: 12 }}>Choisis l’immeuble : le code se propose automatiquement</span>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <label style={labelStyle(muted)}>
              Projet<br />
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={inputStyle(border)}>
                <option value="">(aucun)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>

            <label style={labelStyle(muted)}>
              Immeuble<br />
              <select value={buildingId} onChange={(e) => setBuildingId(e.target.value)} style={inputStyle(border)}>
                <option value="">(aucun)</option>
                {buildingsForProject.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>

            <Field label="Code (auto-proposé) *" value={code} setValue={setCode} />
            <Field label="Libellé (ex: Studio) *" value={label} setValue={setLabel} />
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <Field label="Adresse" value={addressLine1} setValue={setAddressLine1} />
            <Field label="Ville" value={city} setValue={setCity} />
            <Field label="Code postal" value={postalCode} setValue={setPostalCode} />
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <NumField label="Surface (m²)" value={surfaceM2} setValue={setSurfaceM2} />
            <NumField label="Étage" value={floor} setValue={setFloor} />
            <div style={{ display: "flex", alignItems: "end" }}>
              <button onClick={createUnit} style={btnPrimaryWide(blue)}>Créer</button>
            </div>
          </div>
        </section>
      )}

      <section style={{ marginTop: 14 }}>
        <div style={{ color: muted, fontSize: 12, marginBottom: 8 }}>
          {filtered.length} logement(s)
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((u) => (
            <div key={u.id} style={{ border: `1px solid ${border}`, borderRadius: 16, background: "#fff", padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 900, fontSize: 16 }}>{u.code}</span>
                    <span style={{ color: muted }}>{u.label}</span>

                    <span style={chip(border, u.project_name ? "#0b2a6f" : muted)}>
                      {u.project_name ? `Projet: ${u.project_name}` : "Sans projet"}
                    </span>

                    <span style={chip(border, u.building_name ? "#0b2a6f" : muted)}>
                      {u.building_name ? `Immeuble: ${u.building_name}` : "Sans immeuble"}
                    </span>
                  </div>

                  <div style={{ marginTop: 6, color: "#374151", fontSize: 13 }}>
                    {u.address_line1}, {u.postal_code} {u.city}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <Chip text={`${u.surface_m2} m²`} />
                  <Chip text={`Étage ${u.floor}`} />
				    <Link href={`/dashboard/units/${u.id}/references`}>
					  <button style={btnSecondary(border)}>Références</button>
					</Link>
                  <button onClick={() => openEdit(u)} style={btnSecondary(border)}>Modifier</button>
                </div>
              </div>
            </div>
          ))}

          {!filtered.length && (
            <div style={{ border: `1px dashed ${border}`, borderRadius: 16, padding: 14, color: muted, background: "#fff" }}>
              Aucun logement pour ce filtre.
            </div>
          )}
        </div>
      </section>

      {/* EDIT MODAL */}
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
            zIndex: 50,
          }}
          onClick={() => setEditing(null)}
        >
          <div
            style={{ background: "#fff", width: "min(920px, 100%)", borderRadius: 16, padding: 14, border: `1px solid ${border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Modifier logement</div>
                <div style={{ color: muted, fontSize: 12 }}>{editing.id}</div>
              </div>
              <button onClick={() => setEditing(null)} style={btnSecondary(border)}>Fermer</button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              <label style={labelStyle(muted)}>
                Projet<br />
                <select value={editProjectId} onChange={(e) => setEditProjectId(e.target.value)} style={inputStyle(border)}>
                  <option value="">(aucun)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>

              <label style={labelStyle(muted)}>
                Immeuble<br />
                <select value={editBuildingId} onChange={(e) => setEditBuildingId(e.target.value)} style={inputStyle(border)}>
                  <option value="">(aucun)</option>
                  {buildings.filter((b) => !editProjectId || b.project_id === editProjectId).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>

              <Field label="Code *" value={editing.code} setValue={(v) => setEditing({ ...editing, code: v })} />
              <Field label="Libellé *" value={editing.label} setValue={(v) => setEditing({ ...editing, label: v })} />
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              <Field label="Adresse" value={editing.address_line1} setValue={(v) => setEditing({ ...editing, address_line1: v })} />
              <Field label="Ville" value={editing.city} setValue={(v) => setEditing({ ...editing, city: v })} />
              <Field label="Code postal" value={editing.postal_code} setValue={(v) => setEditing({ ...editing, postal_code: v })} />
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <NumField label="Surface (m²)" value={Number(editing.surface_m2 || 0)} setValue={(v) => setEditing({ ...editing, surface_m2: v })} />
              <NumField label="Étage" value={Number(editing.floor || 0)} setValue={(v) => setEditing({ ...editing, floor: v })} />
              <div />
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

function labelStyle(muted: string) {
  return { display: "grid", gap: 6, fontSize: 12, color: muted, minWidth: 0 } as const;
}
function inputStyle(border: string) {
  return { padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, width: "100%", minWidth: 0, boxSizing: "border-box" } as const;
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
function NumField({ label, value, setValue }: { label: string; value: number; setValue: (v: number) => void }) {
  const border = "#e5e7eb";
  const muted = "#6b7280";
  return (
    <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, color: muted }}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, boxSizing: "border-box", width: "100%" }}
      />
    </label>
  );
}
function Chip({ text }: { text: string }) {
  const border = "#e5e7eb";
  return (
    <span style={{ fontSize: 12, color: "#374151", padding: "6px 10px", borderRadius: 999, border: `1px solid ${border}`, background: "#f9fafb" }}>
      {text}
    </span>
  );
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
