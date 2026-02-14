"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type EdlSession = {
  id: string;
  unit_id: string;
  lease_id: string;
  status: "entry" | "exit" | string;
  created_at?: string;
  updated_at?: string;
  source_reference_edl_id?: string | null;
};

type EdlItem = {
  id: string;
  edl_session_id: string;
  section: string;
  label: string;

  entry_condition?: string | null;
  entry_notes?: string | null;

  exit_condition?: string | null;
  exit_notes?: string | null;

  created_at?: string;
  updated_at?: string;
};

type Photo = {
  id: string;
  edl_item_id: string;
  filename: string;
  created_at?: string;
};

function fmtDate(s?: string) {
  if (!s) return "";
  return String(s).slice(0, 19).replace("T", " ");
}

const CONDITION_PRESETS = ["Neuf", "Très bon", "Bon", "Correct", "À revoir", "Dégradé", "À remplacer"];

/** ✅ Fix TS: toast kind is a strict union (no more "string not assignable") */
type ToastKind = "ok" | "err" | "warn";
type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
};

export default function EdlPage({ params }: { params: { leaseId: string } }) {
  const leaseId = params.leaseId;

  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [sessions, setSessions] = useState<EdlSession[]>([]);
  const [sessionId, setSessionId] = useState<string>("");

  const [items, setItems] = useState<EdlItem[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);

  const [photosByItem, setPhotosByItem] = useState<Record<string, Photo[]>>({});
  const [photosOpen, setPhotosOpen] = useState<Record<string, boolean>>({});

  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});

  // reference
  const [savingReference, setSavingReference] = useState(false);
  const [applyingReference, setApplyingReference] = useState(false);
  const [lastReferenceInfo, setLastReferenceInfo] = useState<{
    unitId?: string;
    referenceEdlSessionId?: string;
  } | null>(null);

  // create session mode
  const [createStatus, setCreateStatus] = useState<"entry" | "exit">("entry");

  // search
  const [q, setQ] = useState("");

  // collapses by section
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  // modal add item
  const [addOpen, setAddOpen] = useState(false);
  const [addSection, setAddSection] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addDupConfirm, setAddDupConfirm] = useState(false);
  const addLabelRef = useRef<HTMLInputElement | null>(null);

  // toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  function pushToast(t: Omit<Toast, "id" | "kind"> & { kind?: ToastKind }) {
    const id = String(Date.now()) + Math.random().toString(16).slice(2);
    const toast: Toast = { id, kind: t.kind ?? "ok", message: t.message, actionLabel: t.actionLabel, onAction: t.onAction };
    setToasts((p) => [toast, ...p].slice(0, 3));
    setTimeout(() => {
      setToasts((p) => p.filter((x) => x.id !== id));
    }, 3500);
  }

  // undo delete
  const undoTimers = useRef<Record<string, any>>({});

  const blue = "#1f6feb";
  const border = "#e5e7eb";
  const muted = "#6b7280";
  const green = "#16a34a";
  const bg = "#f7f8fb";

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  useEffect(() => {
    function onFs() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // close modal on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAddOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function loadSessions(pickSessionId?: string) {
    setError("");
    setStatus("Chargement des sessions EDL…");
    try {
      const r = await fetch(`${API}/edl/sessions?leaseId=${leaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      const j = await r.json().catch(() => []);
      const arr: EdlSession[] = Array.isArray(j) ? j : [];
      arr.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
      setSessions(arr);

      if (!arr.length) {
        setSessionId("");
        setItems([]);
      } else {
        const target = pickSessionId || sessionId || arr[0]?.id;
        if (target) setSessionId(target);
      }

      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur chargement sessions" });
    }
  }

  async function createEmptySession() {
    if (!token) return;
    setError("");
    setStatus("Création d'une session EDL…");
    setCreatingSession(true);
    try {
      const r = await fetch(`${API}/edl/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId, status: createStatus }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        pushToast({ kind: "err", message: "Erreur création session" });
        return;
      }

      const newId = j?.id || j?.edlSessionId || j?.session?.id || j?.edlSession?.id;
      setStatus("Session créée ✅");
      pushToast({ kind: "ok", message: "Session EDL créée ✅" });
      await loadSessions(newId ? String(newId) : undefined);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur réseau (création session)" });
    } finally {
      setCreatingSession(false);
    }
  }

  async function loadItems(edlSessionId: string) {
    if (!edlSessionId) return;
    setError("");
    setStatus("Chargement des items EDL…");
    try {
      const r = await fetch(`${API}/edl/items?edlSessionId=${edlSessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json().catch(() => []);
      const arr: EdlItem[] = Array.isArray(j) ? j : [];
      arr.sort((a, b) => (a.section || "").localeCompare(b.section || "") || (a.label || "").localeCompare(b.label || ""));
      setItems(arr);

      setCollapsed((prev) => {
        const next = { ...prev };
        for (const it of arr) {
          const s = it.section || "Divers";
          if (typeof next[s] === "undefined") next[s] = false;
        }
        return next;
      });

      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur chargement items" });
    }
  }

  useEffect(() => {
    if (!token) return;
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || !sessionId) return;
    loadItems(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sessionId]);

  const filteredItems = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((it) => String(it.label || "").toLowerCase().includes(qq));
  }, [items, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, EdlItem[]>();
    for (const it of filteredItems) {
      const k = it.section || "Divers";
      const arr = map.get(k) || [];
      arr.push(it);
      map.set(k, arr);
    }

    const entries = Array.from(map.entries());
    for (let i = 0; i < entries.length; i++) {
      const arr = entries[i][1];
      arr.sort((a, b) => String(a.label || "").localeCompare(String(b.label || "")));
      entries[i] = [entries[i][0], arr];
    }

    entries.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    return entries;
  }, [filteredItems]);

  const allSections = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) s.add(it.section || "Divers");
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  function existsDuplicate(section: string, label: string) {
    const sec = (section || "Divers").trim().toLowerCase();
    const lab = (label || "").trim().toLowerCase();
    if (!lab) return false;
    return items.some(
      (it) =>
        (it.section || "Divers").trim().toLowerCase() === sec &&
        (it.label || "").trim().toLowerCase() === lab
    );
  }

  async function patchItem(id: string, patch: Partial<EdlItem>) {
    setError("");
    setSavingId(id);
    try {
      const r = await fetch(`${API}/edl/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j?.message || JSON.stringify(j));
        pushToast({ kind: "err", message: "Erreur: " + String(j?.message || "patch") });
        return;
      }
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    } catch (e: any) {
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur réseau (patch)" });
    } finally {
      setSavingId(null);
    }
  }

  async function createEdlItem(payload: {
    section: string;
    label: string;
    entry_condition?: any;
    entry_notes?: any;
    exit_condition?: any;
    exit_notes?: any;
  }) {
    const r = await fetch(`${API}/edl/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      credentials: "include",
      body: JSON.stringify({
        edlSessionId: sessionId,
        edl_session_id: sessionId,
        section: payload.section,
        label: payload.label,
        entry_condition: payload.entry_condition ?? null,
        entry_notes: payload.entry_notes ?? null,
        exit_condition: payload.exit_condition ?? null,
        exit_notes: payload.exit_notes ?? null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.message || JSON.stringify(j));
    return j as any;
  }

  async function onAddSubmit() {
    if (!sessionId) return;

    const section = (addSection || "Divers").trim() || "Divers";
    const label = (addLabel || "").trim();

    if (!label) {
      pushToast({ kind: "warn", message: "Label requis" });
      return;
    }

    const isDup = existsDuplicate(section, label);
    if (isDup && !addDupConfirm) {
      setAddDupConfirm(true);
      return;
    }

    setError("");
    setStatus("");
    try {
      const created = await createEdlItem({ section, label });

      const newId = created?.id || created?.item?.id || created?.edlItem?.id;
      pushToast({ kind: "ok", message: "Item ajouté ✅" });

      if (newId) {
        setItems((prev) => {
          const next = [...prev, { id: String(newId), edl_session_id: sessionId, section, label }];
          next.sort(
            (a, b) =>
              (a.section || "").localeCompare(b.section || "") ||
              (a.label || "").localeCompare(b.label || "")
          );
          return next;
        });
      } else {
        await loadItems(sessionId);
      }

      setAddOpen(false);
      setAddSection(section);
      setAddLabel("");
      setAddDupConfirm(false);
    } catch (e: any) {
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur ajout item" });
    }
  }

  async function deleteEdlItem(it: EdlItem) {
    setError("");
    setStatus("");

    // optimistic remove
    setItems((prev) => prev.filter((x) => x.id !== it.id));

    let undone = false;
    const undoId = "undo-" + it.id;

    const timer = setTimeout(async () => {
      if (undone) return;
      try {
        const r = await fetch(`${API}/edl/items/${it.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (!r.ok) {
          await loadItems(sessionId);
          pushToast({ kind: "err", message: "Suppression: erreur serveur, rechargé." });
        }
      } catch {
        await loadItems(sessionId);
      } finally {
        delete undoTimers.current[undoId];
      }
    }, 5000);

    undoTimers.current[undoId] = timer;

    pushToast({
      kind: "warn",
      message: `Supprimé: ${it.label}`,
      actionLabel: "Annuler",
      onAction: async () => {
        if (undoTimers.current[undoId]) clearTimeout(undoTimers.current[undoId]);
        undone = true;
        delete undoTimers.current[undoId];

        try {
          const created = await createEdlItem({
            section: it.section || "Divers",
            label: it.label,
          });

          const newId = created?.id || created?.item?.id || created?.edlItem?.id;
          if (newId) {
            try {
              await patchItem(String(newId), {
                entry_condition: it.entry_condition ?? null,
                entry_notes: it.entry_notes ?? null,
                exit_condition: it.exit_condition ?? null,
                exit_notes: it.exit_notes ?? null,
              });
            } catch {}
          }

          await loadItems(sessionId);
          pushToast({ kind: "ok", message: "Restauration ✅" });
        } catch {
          await loadItems(sessionId);
          pushToast({ kind: "err", message: "Restauration: erreur, rechargé." });
        }
      },
    });
  }

  async function copyEntryToExit() {
    if (!sessionId) return;

    if (!confirm("Copier les états d\'entrée vers la sortie ?\n\nAttention : cela écrasera les états de sortie existants.")) {
      return;
    }
    setError("");
    setStatus("Copie entrée → sortie…");
    try {
      const r = await fetch(`${API}/edl/copy-entry-to-exit?leaseId=${leaseId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        pushToast({ kind: "err", message: "Erreur copie" });
        return;
      }
      setStatus("Copie effectuée ✅");
      pushToast({ kind: "ok", message: "Copie effectuée ✅" });
      await loadItems(sessionId);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur réseau (copie)" });
    }
  }

  async function saveAsUnitReferenceEdl() {
    if (!token || !sessionId) return;
    setError("");
    setStatus("Enregistrement référence logement (EDL)…");
    setSavingReference(true);
    try {
      const r = await fetch(`${API}/edl/reference?leaseId=${leaseId}&edlSessionId=${sessionId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        pushToast({ kind: "err", message: "Erreur enregistrement référence" });
        return;
      }
      setLastReferenceInfo({ unitId: j?.unitId, referenceEdlSessionId: j?.referenceEdlSessionId });
      setStatus("Référence logement (EDL) enregistrée ✅");
      pushToast({ kind: "ok", message: "Référence logement EDL ✅" });
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur réseau (référence)" });
    } finally {
      setSavingReference(false);
    }
  }

  async function applyUnitReferenceToLeaseEdl() {
    if (!token) return;
    if (!confirm("Créer une nouvelle session EDL clonée depuis la référence logement ?")) return;

    setError("");
    setStatus("Application référence logement (EDL)…");
    setApplyingReference(true);
    try {
      const r = await fetch(`${API}/edl/apply-reference?leaseId=${leaseId}&status=${createStatus}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        pushToast({ kind: "err", message: "Erreur application référence" });
        return;
      }

      const newSessionId = j?.edlSessionId || j?.sessionId || j?.edl_session_id || j?.session?.id || null;

      setStatus(`EDL réinitialisé ✅ (${j?.createdItems ?? "?"} items)`);
      pushToast({ kind: "ok", message: "EDL réinitialisé ✅" });
      await loadSessions(newSessionId ? String(newSessionId) : undefined);
      if (newSessionId) await loadItems(String(newSessionId));
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur réseau (apply référence)" });
    } finally {
      setApplyingReference(false);
    }
  }

  async function loadPhotos(edlItemId: string) {
    try {
      const r = await fetch(`${API}/edl/photos?edlItemId=${edlItemId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json().catch(() => []);
      const arr: Photo[] = Array.isArray(j) ? j : [];
      setPhotosByItem((p) => ({ ...p, [edlItemId]: arr }));
    } catch {}
  }

  async function uploadPhoto(edlItemId: string, file: File) {
    setError("");
    setStatus("Upload photo…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("edlItemId", edlItemId);
      fd.append("leaseId", leaseId);

      const r = await fetch(`${API}/edl/photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        body: fd,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        pushToast({ kind: "err", message: "Erreur upload" });
        return;
      }

      setStatus("Photo ajoutée ✅");
      pushToast({ kind: "ok", message: "Photo ajoutée ✅" });
      await loadPhotos(edlItemId);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur réseau (upload)" });
    }
  }

  async function downloadPhoto(photoId: string) {
    setError("");
    setStatus("Téléchargement…");
    try {
      const r = await fetch(`${API}/edl/photos/${photoId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!r.ok) {
        const t = await r.text();
        setStatus("");
        setError("Erreur téléchargement: " + t);
        pushToast({ kind: "err", message: "Erreur téléchargement" });
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setStatus("Téléchargé ✅");
      pushToast({ kind: "ok", message: "Téléchargé ✅" });
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur réseau (download)" });
    }
  }

  function togglePhotos(itemId: string) {
    setPhotosOpen((p) => ({ ...p, [itemId]: !p[itemId] }));
    if (!photosByItem[itemId]) loadPhotos(itemId);
  }

  function toggleNotes(itemId: string) {
    setNotesOpen((p) => ({ ...p, [itemId]: !p[itemId] }));
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  }

  function openAddModal(presetSection?: string) {
    setAddSection(presetSection || (allSections[0] || "Séjour"));
    setAddLabel("");
    setAddDupConfirm(false);
    setAddOpen(true);
    setTimeout(() => addLabelRef.current?.focus(), 50);
  }

  const gridTemplate = "minmax(240px, 1.2fr) minmax(260px, 1fr) minmax(260px, 1fr) 260px";

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: 12, background: bg, minHeight: "100vh" }}>
      {/* Toasts */}
      <div style={{ position: "fixed", right: 12, bottom: 12, zIndex: 9999, display: "grid", gap: 8, width: 360, maxWidth: "calc(100vw - 24px)" }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ border: `1px solid ${border}`, borderRadius: 14, background: "#fff", padding: 12, boxShadow: "0 10px 30px rgba(16,24,40,0.10)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={toastPill(t.kind)}>{t.kind.toUpperCase()}</span>
              <div style={{ fontWeight: 900 }}>{t.message}</div>
            </div>

            {t.actionLabel && t.onAction ? (
              <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    Promise.resolve(t.onAction?.()).finally(() => {
                      setToasts((p) => p.filter((x) => x.id !== t.id));
                    });
                  }}
                  style={btnPrimary(blue)}
                >
                  {t.actionLabel}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Add modal */}
      {addOpen && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAddOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,0.45)",
            zIndex: 9998,
            display: "grid",
            placeItems: "center",
            padding: 12,
          }}
        >
          <div style={{ width: 620, maxWidth: "100%", borderRadius: 18, background: "#fff", border: `1px solid ${border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Ajouter un item EDL</div>
              <button onClick={() => setAddOpen(false)} style={btnSecondary(border)}>✕</button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <label style={labelStyle(muted)}>
                Section
                <input
                  list="edl-sections"
                  value={addSection}
                  onChange={(e) => {
                    setAddSection(e.target.value);
                    setAddDupConfirm(false);
                  }}
                  placeholder="ex: Séjour"
                  style={inputStyle(border)}
                />
                <datalist id="edl-sections">
                  {allSections.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>

              <label style={labelStyle(muted)}>
                Désignation
                <input
                  ref={addLabelRef}
                  value={addLabel}
                  onChange={(e) => {
                    setAddLabel(e.target.value);
                    setAddDupConfirm(false);
                  }}
                  placeholder="ex: Sol"
                  style={inputStyle(border)}
                />
              </label>
            </div>

            {existsDuplicate(addSection || "Divers", addLabel) && (
              <div style={{ marginTop: 10, border: `1px solid rgba(220,38,38,0.25)`, background: "rgba(220,38,38,0.06)", color: "#7f1d1d", borderRadius: 14, padding: 10, fontWeight: 850 }}>
                ⚠️ Cet item existe déjà dans cette section.
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                  Clique “Ajouter quand même” pour forcer.
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setAddOpen(false)} style={btnSecondary(border)}>Annuler</button>
              <button onClick={onAddSubmit} style={btnPrimary(blue)}>
                {existsDuplicate(addSection || "Divers", addLabel) && !addDupConfirm ? "Ajouter quand même" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={card(border, "#fff")}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, letterSpacing: -0.2 }}>EDL</h1>
            <div style={{ color: muted, fontSize: 12 }}>Bail {leaseId.slice(0, 8)}… • sessions/items/photos</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher une désignation…"
              style={{ ...inputStyle(border), width: 280, background: "#fbfbfd" }}
            />

            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              style={{ ...inputStyle(border), width: 280, background: "#fbfbfd" }}
              title="Session"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {fmtDate(s.created_at)} • {s.status} • {s.id.slice(0, 4)}…
                </option>
              ))}
              {!sessions.length && <option value="">Aucune session</option>}
            </select>

            <button onClick={() => openAddModal()} disabled={!sessionId} style={{ ...btnPrimary(blue), opacity: sessionId ? 1 : 0.5 }}>
              + Ajouter item
            </button>

            <div style={chipGroup(border)}>
              <span style={chipLabel(muted)}>Créer</span>
              <button onClick={() => setCreateStatus("entry")} style={chip(border, createStatus === "entry")}>Entrée</button>
              <button onClick={() => setCreateStatus("exit")} style={chip(border, createStatus === "exit")}>Sortie</button>
              <button
                onClick={createEmptySession}
                disabled={creatingSession}
                style={{ ...btnPrimary(blue), opacity: creatingSession ? 0.6 : 1 }}
              >
                {creatingSession ? "Création…" : "Nouvelle session"}
              </button>
            </div>

            <button onClick={() => loadSessions()} style={btnSecondary(border)}>Rafraîchir</button>

            <button onClick={copyEntryToExit} disabled={!sessionId} style={{ ...btnPrimary(blue), opacity: sessionId ? 1 : 0.5 }}>
              Copier entrée → sortie
            </button>

            <button
              onClick={saveAsUnitReferenceEdl}
              disabled={!sessionId || savingReference}
              style={{ ...btnSecondary(border), opacity: !sessionId || savingReference ? 0.6 : 1, fontWeight: 900 }}
            >
              {savingReference ? "Enregistrement…" : "Définir référence logement"}
            </button>

            <button
              onClick={applyUnitReferenceToLeaseEdl}
              disabled={applyingReference}
              style={{ ...btnSecondary(border), opacity: applyingReference ? 0.6 : 1, fontWeight: 900 }}
            >
              {applyingReference ? "Application…" : "Réinitialiser depuis référence"}
            </button>

            <button onClick={toggleFullscreen} style={btnSecondary(border)}>
              {isFullscreen ? "Quitter plein écran" : "Plein écran"}
            </button>

            <Link href="/dashboard/leases">
              <button style={btnSecondary(border)}>Retour baux</button>
            </Link>
          </div>
        </div>

        {lastReferenceInfo?.referenceEdlSessionId && (
          <div style={{ marginTop: 10, color: muted, fontSize: 12 }}>
            Référence EDL logement :{" "}
            <b style={{ color: "#111" }}>{String(lastReferenceInfo.referenceEdlSessionId).slice(0, 8)}…</b>
            {lastReferenceInfo.unitId ? (
              <>
                {" "}
                • Unit <b style={{ color: "#111" }}>{String(lastReferenceInfo.unitId).slice(0, 8)}…</b>
              </>
            ) : null}
          </div>
        )}

        {status && <div style={{ marginTop: 10, color: green, fontWeight: 800 }}>{status}</div>}
        {error && <div style={{ marginTop: 10, color: "crimson", fontWeight: 800 }}>{error}</div>}
      </div>

      {!!sessionId && (
        <div style={{ position: "sticky", top: 8, zIndex: 20, marginTop: 12, ...card(border, "#fff"), padding: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 10, alignItems: "center" }}>
            <div style={{ color: muted, fontSize: 12, fontWeight: 900 }}>Désignation</div>
            <div style={{ textAlign: "center", fontSize: 12, fontWeight: 900 }}>Entrée</div>
            <div style={{ textAlign: "center", fontSize: 12, fontWeight: 900 }}>Sortie</div>
            <div style={{ textAlign: "right", color: muted, fontSize: 12, fontWeight: 900 }}>Actions</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {grouped.map(([section, arr]) => {
          const isCol = collapsed[section] ?? false;

          return (
            <section key={section} style={card(border, "#fff")}>
              <div
                style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", cursor: "pointer", userSelect: "none" }}
                onClick={() => setCollapsed((p) => ({ ...p, [section]: !isCol }))}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={collapseBtn(border)}>{isCol ? "▸" : "▾"}</div>
                  <div style={{ fontWeight: 950, letterSpacing: -0.1 }}>
                    {section}{" "}
                    <span style={{ color: muted, fontSize: 12, fontWeight: 800 }}>{arr.length} items</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddModal(section);
                    }}
                    style={btnSecondary(border)}
                  >
                    + Ajouter ici
                  </button>
                  <div style={{ color: muted, fontSize: 12 }}>{isCol ? "Afficher" : "Réduire"}</div>
                </div>
              </div>

              {!isCol && (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {arr.map((it) => (
                    <div key={it.id} style={{ border: `1px solid ${border}`, borderRadius: 14, background: "#fff" }}>
                      <div style={{ padding: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 10, alignItems: "center" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 950, lineHeight: 1.1 }}>{it.label}</div>
                            <div style={{ color: muted, fontSize: 11 }}>
                              {savingId === it.id ? "Enregistrement…" : it.id.slice(0, 8) + "…"}
                            </div>
                          </div>

                          <div style={cell(border)}>
                            <select
                              value={it.entry_condition || ""}
                              onChange={(e) => patchItem(it.id, { entry_condition: e.target.value })}
                              style={selectInline(border)}
                            >
                              <option value="">—</option>
                              {CONDITION_PRESETS.map((x) => (
                                <option key={x} value={x}>{x}</option>
                              ))}
                            </select>
                          </div>

                          <div style={cell(border)}>
                            <select
                              value={it.exit_condition || ""}
                              onChange={(e) => patchItem(it.id, { exit_condition: e.target.value })}
                              style={selectInline(border)}
                            >
                              <option value="">—</option>
                              {CONDITION_PRESETS.map((x) => (
                                <option key={x} value={x}>{x}</option>
                              ))}
                            </select>
                          </div>

                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                            <button onClick={() => toggleNotes(it.id)} style={btnGhost(border)}>Notes</button>
                            <button onClick={() => togglePhotos(it.id)} style={btnGhost(border)}>
                              {photosOpen[it.id] ? "Masquer photos" : "Photos"}
                            </button>
                            <label style={{ ...btnGhost(border), cursor: "pointer" }}>
                              Ajouter photo
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) uploadPhoto(it.id, f);
                                  e.currentTarget.value = "";
                                }}
                              />
                            </label>

                            <button
                              onClick={() => deleteEdlItem(it)}
                              style={{ ...btnGhost(border), borderColor: "rgba(220,38,38,0.35)", color: "#7f1d1d" }}
                              title="Supprimer (undo 5s)"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>

                        {notesOpen[it.id] && (
                          <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                            <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 10, background: "#fbfbfd" }}>
                              <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 6 }}>Notes Entrée</div>
                              <textarea
                                value={it.entry_notes || ""}
                                onChange={(e) => patchItem(it.id, { entry_notes: e.target.value })}
                                style={{ ...inputStyle(border), minHeight: 70, resize: "vertical", background: "#fff" }}
                              />
                            </div>
                            <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 10, background: "#fbfbfd" }}>
                              <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 6 }}>Notes Sortie</div>
                              <textarea
                                value={it.exit_notes || ""}
                                onChange={(e) => patchItem(it.id, { exit_notes: e.target.value })}
                                style={{ ...inputStyle(border), minHeight: 70, resize: "vertical", background: "#fff" }}
                              />
                            </div>
                          </div>
                        )}

                        {photosOpen[it.id] && (
                          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                            {(photosByItem[it.id] || []).map((p) => (
                              <div
                                key={p.id}
                                style={{
                                  border: `1px solid ${border}`,
                                  borderRadius: 12,
                                  padding: 10,
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 10,
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  background: "#fbfbfd",
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 900, wordBreak: "break-word" }}>{p.filename}</div>
                                  <div style={{ color: muted, fontSize: 12 }}>{fmtDate(p.created_at)}</div>
                                </div>
                                <button onClick={() => downloadPhoto(p.id)} style={btnPrimary(blue)}>
                                  Télécharger
                                </button>
                              </div>
                            ))}
                            {!((photosByItem[it.id] || []).length) && (
                              <div style={{ color: muted, fontSize: 12 }}>Aucune photo.</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {!items.length && (
          <section style={{ ...card(border, "#fff"), color: muted }}>
            {sessionId ? "Aucun item EDL." : "Aucun item (pas de session)."}
          </section>
        )}
      </div>
    </main>
  );
}

/* ---------- UI helpers ---------- */
function toastPill(kind: ToastKind) {
  const map: Record<ToastKind, { b: string; bg: string; c: string }> = {
    ok: { b: "rgba(22,163,74,0.25)", bg: "rgba(22,163,74,0.10)", c: "#14532d" },
    warn: { b: "rgba(245,158,11,0.30)", bg: "rgba(245,158,11,0.12)", c: "#78350f" },
    err: { b: "rgba(220,38,38,0.28)", bg: "rgba(220,38,38,0.10)", c: "#7f1d1d" },
  };
  const s = map[kind];
  return {
    fontSize: 11,
    fontWeight: 950,
    padding: "4px 8px",
    borderRadius: 999,
    border: `1px solid ${s.b}`,
    background: s.bg,
    color: s.c,
    letterSpacing: 0.4,
  } as const;
}
function card(border: string, bg: string) {
  return {
    border: `1px solid ${border}`,
    borderRadius: 18,
    background: bg,
    padding: 14,
    boxShadow: "0 8px 24px rgba(16,24,40,0.06)",
  } as const;
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
    boxSizing: "border-box" as const,
    outline: "none",
  };
}
function btnPrimary(_blue: string) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid rgba(31,111,235,0.25)`,
    background: "rgba(31,111,235,0.10)",
    color: "#0b2a6f",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 1px 0 rgba(16,24,40,0.04)",
  } as const;
}
function btnSecondary(border: string) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 1px 0 rgba(16,24,40,0.04)",
  } as const;
}
function btnGhost(border: string) {
  return {
    padding: "9px 10px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  } as const;
}
function chipGroup(border: string) {
  return {
    display: "flex",
    gap: 8,
    alignItems: "center",
    border: `1px solid ${border}`,
    borderRadius: 14,
    padding: 6,
    background: "#fff",
  } as const;
}
function chipLabel(muted: string) {
  return { color: muted, fontSize: 12, fontWeight: 900, paddingLeft: 6 } as const;
}
function chip(border: string, active: boolean) {
  return {
    padding: "8px 10px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: active ? 950 : 900,
    background: active ? "rgba(31,111,235,0.10)" : "#fff",
  } as const;
}
function collapseBtn(border: string) {
  return {
    width: 34,
    height: 34,
    borderRadius: 12,
    border: `1px solid ${border}`,
    display: "grid",
    placeItems: "center",
    background: "#fff",
    fontWeight: 950,
  } as const;
}
function cell(border: string) {
  return {
    border: `1px solid ${border}`,
    borderRadius: 14,
    padding: 6,
    background: "#fbfbfd",
  } as const;
}
function selectInline(border: string) {
  return {
    ...inputStyle(border),
    padding: "10px 10px",
    borderRadius: 12,
    background: "#fff",
  } as const;
}
