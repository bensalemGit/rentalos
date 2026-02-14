"use client";
import { useEffect, useMemo, useState } from "react";

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
  created_at: string;
};

export default function BuildingsPage() {
  const [token, setToken] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);

  const [projectFilter, setProjectFilter] = useState<string>("all");

  // create form
  const [projectId, setProjectId] = useState<string>("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const blue = "#1f6feb";
  const border = "#e5e7eb";
  const muted = "#6b7280";

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  async function loadAll() {
    setError("");
    setStatus("Chargement…");
    try {
      const [p, b] = await Promise.all([
        fetch(`${API}/projects`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" }).then((r) => r.json()),
        fetch(`${API}/buildings`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" }).then((r) => r.json()),
      ]);

      const pArr: Project[] = Array.isArray(p) ? p : [];
      const bArr: Building[] = Array.isArray(b) ? b : [];

      setProjects(pArr);
      setBuildings(bArr);

      if (!projectId && pArr[0]?.id) setProjectId(pArr[0].id);

      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    if (token) loadAll();
  }, [token]);

  const filtered = useMemo(() => {
    if (projectFilter === "all") return buildings;
    return buildings.filter((x) => x.project_id === projectFilter);
  }, [buildings, projectFilter]);

  async function createBuilding() {
    setError("");
    setStatus("Création…");
    if (!projectId) {
      setStatus("");
      setError("Choisis un projet.");
      return;
    }
    if (!name.trim()) {
      setStatus("");
      setError("Nom d’immeuble obligatoire (ex: Sougy1).");
      return;
    }
    if (!address.trim()) {
      setStatus("");
      setError("Adresse obligatoire.");
      return;
    }

    try {
      const r = await fetch(`${API}/buildings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          name: name.trim(),
          address: address.trim(),
          notes: notes.trim() || null,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }

      setStatus("Immeuble créé ✅");
      setName("");
      setAddress("");
      setNotes("");
      setShowCreate(false);
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
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Immeubles</h1>
          <div style={{ color: muted }}>
            Regrouper les logements d’un même immeuble (ex: Sougy1..4) à l’intérieur d’un projet.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, minWidth: 240 }}
            title="Filtrer par projet"
          >
            <option value="all">Tous les projets</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <button onClick={() => setShowCreate((v) => !v)} style={btnPrimarySmall(blue)}>
            {showCreate ? "Fermer" : "Créer un immeuble"}
          </button>
          <button onClick={loadAll} style={btnSecondary(border)}>Rafraîchir</button>
        </div>
      </div>

      {status && <p style={{ color: "#0a6" }}>{status}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {showCreate && (
        <section style={{ marginTop: 14, border: `1px solid ${border}`, borderRadius: 16, background: "#fff", padding: 14 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Nouvel immeuble</h2>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <label style={labelStyle(muted)}>
              Projet *<br />
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={inputStyle(border)}>
                <option value="">(choisir)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>

            <label style={labelStyle(muted)}>
              Nom * (ex: Sougy1)<br />
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle(border)} />
            </label>

            <label style={labelStyle(muted)}>
              Adresse *<br />
              <input value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle(border)} />
            </label>
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={labelStyle(muted)}>
              Notes (ex: 1 appart en travaux)<br />
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ ...inputStyle(border), resize: "vertical" }}
              />
            </label>
          </div>

          <div style={{ marginTop: 10 }}>
            <button onClick={createBuilding} style={btnPrimaryWide(blue)}>Créer</button>
          </div>
        </section>
      )}

      <section style={{ marginTop: 14 }}>
        <div style={{ color: muted, fontSize: 12, marginBottom: 8 }}>
          {filtered.length} immeuble(s)
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((b) => (
            <div key={b.id} style={{ border: `1px solid ${border}`, borderRadius: 16, background: "#fff", padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontWeight: 900, fontSize: 16 }}>{b.name}</span>
                    <span style={chip(border, "#0b2a6f")}>{b.project_name || b.project_id}</span>
                  </div>
                  <div style={{ marginTop: 6, color: "#374151" }}>{b.address}</div>
                  {b.notes && <div style={{ marginTop: 6, color: muted, fontSize: 12 }}>{b.notes}</div>}
                </div>
              </div>
            </div>
          ))}

          {!filtered.length && (
            <div style={{ border: `1px dashed ${border}`, borderRadius: 16, padding: 14, color: muted, background: "#fff" }}>
              Aucun immeuble pour ce filtre.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function labelStyle(muted: string) {
  return { display: "grid", gap: 6, fontSize: 12, color: muted, minWidth: 0 } as const;
}
function inputStyle(border: string) {
  return { padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, width: "100%", minWidth: 0, boxSizing: "border-box" } as const;
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
