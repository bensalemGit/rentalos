"use client";
import { useEffect, useState } from "react";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type Project = {
  id: string;
  name: string;
  kind: string;
  notes: string | null;
  created_at: string;
};

type Member = {
  id: string;
  project_id: string;
  full_name: string;
  role: string;
  share_pct: number | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export default function ProjectsPage() {
  const [token, setToken] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // create
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("indivision");
  const [notes, setNotes] = useState("");

  // member add
  const [mName, setMName] = useState("");
  const [mRole, setMRole] = useState("indivisaire");
  const [mShare, setMShare] = useState<number>(25);

  const blue = "#1f6feb";
  const border = "#e5e7eb";
  const muted = "#6b7280";

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  async function loadProjects() {
    setError("");
    setStatus("Chargement…");
    try {
      const r = await fetch(`${API}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json();
      setProjects(Array.isArray(j) ? j : []);
      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function loadMembers(projectId: string) {
    setError("");
    try {
      const r = await fetch(`${API}/projects/${projectId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json();
      setMembers(Array.isArray(j) ? j : []);
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    if (token) loadProjects();
  }, [token]);

  async function createProject() {
    setError("");
    setStatus("Création…");
    if (!name.trim()) {
      setStatus("");
      setError("Nom du projet obligatoire.");
      return;
    }
    try {
      const r = await fetch(`${API}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), kind, notes: notes.trim() || null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Projet créé ✅");
      setName(""); setNotes(""); setKind("indivision");
      setShowCreate(false);
      await loadProjects();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function addMember() {
    if (!selected) return;
    setError("");
    setStatus("Ajout membre…");
    if (!mName.trim()) {
      setStatus("");
      setError("Nom du membre obligatoire.");
      return;
    }
    try {
      const r = await fetch(`${API}/projects/${selected.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ fullName: mName.trim(), role: mRole, sharePct: mShare }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Membre ajouté ✅");
      setMName("");
      await loadMembers(selected.id);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Projets</h1>
          <div style={{ color: muted }}>Indivision / Couple / Groupe propriétaire. Sert à classer les logements.</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setShowCreate((v) => !v)} style={btnPrimarySmall(blue)}>
            {showCreate ? "Fermer" : "Créer un projet"}
          </button>
          <button onClick={loadProjects} style={btnSecondary(border)}>Rafraîchir</button>
        </div>
      </div>

      {status && <p style={{ color: "#0a6" }}>{status}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {showCreate && (
        <section style={{ marginTop: 14, border: `1px solid ${border}`, borderRadius: 16, background: "#fff", padding: 14 }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Nouveau projet</h2>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <label style={labelStyle(muted)}>
              Nom *<br />
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle(border)} />
            </label>

            <label style={labelStyle(muted)}>
              Type<br />
              <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle(border)}>
                <option value="indivision">Indivision</option>
                <option value="couple">Couple</option>
                <option value="societe">Société</option>
                <option value="autre">Autre</option>
              </select>
            </label>
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={labelStyle(muted)}>
              Notes<br />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle(border), resize: "vertical" }} />
            </label>
          </div>

          <div style={{ marginTop: 10 }}>
            <button onClick={createProject} style={btnPrimaryWide(blue)}>Créer</button>
          </div>
        </section>
      )}

      <section style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {projects.map((p) => (
          <div key={p.id} style={{ border: `1px solid ${border}`, borderRadius: 16, background: "#fff", padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{p.name}</div>
                <div style={{ color: muted, fontSize: 12 }}>{p.kind}{p.notes ? ` • ${p.notes}` : ""}</div>
              </div>

              <button
                onClick={() => {
                  setSelected(p);
                  loadMembers(p.id);
                }}
                style={btnSecondary(border)}
              >
                Membres
              </button>
            </div>
          </div>
        ))}

        {!projects.length && (
          <div style={{ border: `1px dashed ${border}`, borderRadius: 16, background: "#fff", padding: 14, color: muted }}>
            Aucun projet. Clique “Créer un projet”.
          </div>
        )}
      </section>

      {selected && (
        <section style={{ marginTop: 14, border: `1px solid ${border}`, borderRadius: 16, background: "#fff", padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900 }}>Membres — {selected.name}</div>
              <div style={{ color: muted, fontSize: 12 }}>Optionnel (utile pour indivision)</div>
            </div>
            <button onClick={() => { setSelected(null); setMembers([]); }} style={btnSecondary(border)}>Fermer</button>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <label style={labelStyle(muted)}>
              Nom *<br />
              <input value={mName} onChange={(e) => setMName(e.target.value)} style={inputStyle(border)} />
            </label>
            <label style={labelStyle(muted)}>
              Rôle<br />
              <input value={mRole} onChange={(e) => setMRole(e.target.value)} style={inputStyle(border)} />
            </label>
            <label style={labelStyle(muted)}>
              Quote-part (%)<br />
              <input type="number" value={mShare} onChange={(e) => setMShare(Number(e.target.value))} style={inputStyle(border)} />
            </label>
            <div style={{ display: "flex", alignItems: "end" }}>
              <button onClick={addMember} style={btnPrimaryWide(blue)}>Ajouter</button>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {members.map((m) => (
              <div key={m.id} style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 10 }}>
                <b>{m.full_name}</b> — {m.role} {m.share_pct != null ? `(${m.share_pct}%)` : ""}
              </div>
            ))}
            {!members.length && <div style={{ color: muted }}>Aucun membre.</div>}
          </div>
        </section>
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
function btnPrimarySmall(blue: string) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid rgba(31,111,235,0.35)`,
    background: "rgba(31,111,235,0.10)",
    color: "#0b2a6f",
    fontWeight: 800,
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
    fontWeight: 700,
  } as const;
}
