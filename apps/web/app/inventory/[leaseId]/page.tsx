"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type InvSession = {
  id: string;
  unit_id: string;
  lease_id: string;
  status: "entry" | "exit" | string;
  created_at?: string;
  updated_at?: string;
  source_reference_inventory_id?: string | null;
};

type InvLine = {
  id: string;
  inventory_session_id: string;
  catalog_item_id: string;

  entry_qty?: number | null;
  entry_state?: string | null;
  entry_notes?: string | null;

  exit_qty?: number | null;
  exit_state?: string | null;
  exit_notes?: string | null;

  category?: string | null;
  label?: string | null;
  default_qty?: number | null;

  catalog_label?: string | null;
  catalog_default_qty?: number | null;

  unit?: string | null;
};

function fmtDate(s?: string) {
  if (!s) return "";
  return String(s).slice(0, 19).replace("T", " ");
}

const CONDITION_PRESETS = ["Neuf", "Très bon", "Bon", "Correct", "À revoir", "Dégradé", "À remplacer", "OK"];

/** ✅ Fix TS: toast kind union */
type ToastKind = "ok" | "err" | "warn";
type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
};

export default function InventoryPage({ params }: { params: { leaseId: string } }) {
  const leaseId = params.leaseId;

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [sessions, setSessions] = useState<InvSession[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const sessionIdRef = useRef<string>("");
  const userPickedSessionRef = useRef(false);

  const [lines, setLines] = useState<InvLine[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [copying, setCopying] = useState(false);
  
  const [savingReference, setSavingReference] = useState(false);
  const [applyingReference, setApplyingReference] = useState(false);
  const [lastReferenceInfo, setLastReferenceInfo] = useState<{
    unitId?: string;
    referenceInventorySessionId?: string;
  } | null>(null);

  const [referenceInfo, setReferenceInfo] = useState<{
    referenceInventorySessionId: string | null;
    updated_at?: string | null;
  } | null>(null);

  const hasReference = Boolean(referenceInfo?.referenceInventorySessionId);

  const [createStatus, setCreateStatus] = useState<"entry" | "exit">("entry");
  const [q, setQ] = useState("");

  type ViewMode = "COMPARE" | "ENTRY" | "EXIT";
  const [viewMode, setViewMode] = useState<ViewMode>("COMPARE");

  const showEntry = viewMode !== "EXIT";
  const showExit = viewMode !== "ENTRY";

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);

  // modal add line
  const [addOpen, setAddOpen] = useState(false);
  const [addCategory, setAddCategory] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addUnit, setAddUnit] = useState("piece");
  const [addQty, setAddQty] = useState<number>(1);
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

  // diff modal
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState("");
  const [diffRows, setDiffRows] = useState<
    Array<{
      key: string;
      category: string;
      label: string;
      unit: string | null;
      kind: "added" | "removed" | "changed" | string;
      entry_qty: number | null;
      entry_state: string | null;
      entry_notes: string | null;
      exit_qty: number | null;
      exit_state: string | null;
      exit_notes: string | null;
    }>
  >([]);

  // undo
  const undoTimers = useRef<Record<string, any>>({});

  const blue = "#2F63E0";
  const border = "rgba(27,39,64,0.08)";
  const muted = "#7C8AA5";
  const green = "#2FA36B";
  const bg = "#F5F7FB";

  useEffect(() => {
    sessionIdRef.current = sessionId || "";
  }, [sessionId]);

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

  function getLabel(ln: InvLine) {
    return ln.label ?? ln.catalog_label ?? null;
  }
  function getCategory(ln: InvLine) {
    return ln.category ?? "Divers";
  }

  const allCategories = useMemo(() => {
    const s = new Set<string>();
    for (const ln of lines) s.add(getCategory(ln));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [lines]);

  function existsDuplicate(cat: string, label: string) {
    const c = (cat || "Divers").trim().toLowerCase();
    const l = (label || "").trim().toLowerCase();
    if (!l) return false;
    return lines.some(
      (ln) =>
        getCategory(ln).trim().toLowerCase() === c &&
        String(getLabel(ln) || "").trim().toLowerCase() === l
    );
  }

  async function loadSessions(pickSessionId?: string) {
    setError("");
    setStatus("Chargement des sessions inventaire…");
    try {
      const r = await fetch(`${API}/inventory/sessions?leaseId=${leaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        setSessions([]);
        setSessionId("");
        setLines([]);
        pushToast({ kind: "err", message: "Erreur chargement sessions" });
        return;
      }

      const arr: InvSession[] = Array.isArray(j) ? j : [];
      arr.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
      setSessions(arr);

      if (!arr.length) {
        sessionIdRef.current = "";
        userPickedSessionRef.current = false;
        setSessionId("");
        setLines([]);
      } else {
        let target = pickSessionId ? String(pickSessionId) : "";

        if (!target) {
          const preferred = sessionIdRef.current || sessionId;
          const stillExists = preferred && arr.some((s) => s.id === preferred);
          if (userPickedSessionRef.current && stillExists) target = preferred;
        }

        if (!target) {
          const preferred = sessionIdRef.current || sessionId;
          const stillExists = preferred && arr.some((s) => s.id === preferred);
          if (stillExists) target = preferred;
        }

        if (!target) target = arr[0]?.id;

        if (target) {
          sessionIdRef.current = target;
          setSessionId(target);

          // ✅ bonus: auto vue selon le status
          // (ici on ne peut pas utiliser `sessions` state, mais `arr` est dispo)
          const s = arr.find((x) => x.id === target);
          const st = String(s?.status || "").toLowerCase();
          if (st === "exit") setViewMode("EXIT");
          else if (st === "entry") setViewMode("ENTRY");

        }
      }

      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
      setSessions([]);
      setSessionId("");
      setLines([]);
      pushToast({ kind: "err", message: "Erreur réseau (sessions)" });
    }
  }

  async function loadReference() {
    try {
      const r = await fetch(`${API}/inventory/reference?leaseId=${leaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        cache: "no-store",
      });

      if (!r.ok) {
        setReferenceInfo(null);
        return;
      }

      const j = await r.json().catch(() => ({} as any));
      setReferenceInfo({
        referenceInventorySessionId: j?.referenceInventorySessionId ?? null,
        updated_at: j?.updated_at ?? null,
      });
    } catch {
      setReferenceInfo(null);
    }
  }

  async function createEmptySession() {
    if (!token) return;
    setError("");
    setStatus("Création d'une session inventaire…");
    setCreatingSession(true);

    try {
      const r = await fetch(`${API}/inventory/sessions`, {
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

      const newId = j?.id || j?.inventorySessionId || j?.session?.id || j?.inventorySession?.id;
      setStatus("Session créée ✅");
      pushToast({ kind: "ok", message: "Session inventaire créée ✅" });
      await loadSessions(newId ? String(newId) : undefined);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur réseau (création session)" });
    } finally {
      setCreatingSession(false);
    }
  }

  async function loadLines(inventorySessionId: string) {
    if (!inventorySessionId) return;
    setError("");
    setStatus("Chargement des lignes inventaire…");
    try {
      const r = await fetch(`${API}/inventory/lines?inventorySessionId=${inventorySessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        setLines([]);
        pushToast({ kind: "err", message: "Erreur chargement lignes" });
        return;
      }

      const arr: InvLine[] = Array.isArray(j) ? j : [];
      setLines(arr);

      setCollapsed((prev) => {
        const next = { ...prev };
        for (let i = 0; i < arr.length; i++) {
          const c = getCategory(arr[i]);
          if (typeof next[c] === "undefined") next[c] = false;
        }
        return next;
      });

      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
      setLines([]);
      pushToast({ kind: "err", message: "Erreur réseau (lignes)" });
    }
  }

  async function openDiffModal() {
    const sid = sessionIdRef.current || sessionId;
    if (!sid) return;

    setDiffOpen(true);
    setDiffLoading(true);
    setDiffError("");
    setDiffRows([]);

    try {
      const r = await fetch(`${API}/inventory/sessions/${sid}/diff`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      const j = await r.json().catch(() => ({} as any));
      if (!r.ok) {
        throw new Error(j?.message || "Erreur diff inventaire");
      }

      setDiffRows(Array.isArray(j?.rows) ? j.rows : []);
    } catch (e: any) {
      setDiffError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur chargement différences" });
    } finally {
      setDiffLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;

    // Guard: ne jamais appeler l'API si l'URL n'a pas un UUID
    if (!UUID_RE.test(leaseId)) {
      setStatus("");
      setError(`URL invalide: leaseId="${leaseId}" (uuid attendu)`);
      setSessions([]);
      setSessionId("");
      setLines([]);
      return;
    }

    setError("");
    loadSessions();
    loadReference();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, leaseId]);

  useEffect(() => {
    if (!token || !sessionId) return;
    loadLines(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    syncViewModeWithSession(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sessions]);

  async function patchLine(id: string, patch: Partial<InvLine>) {
    setError("");
    setSavingId(id);
    try {
      const r = await fetch(`${API}/inventory/lines/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify(patch),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j?.message || JSON.stringify(j));
        pushToast({ kind: "err", message: "Erreur patch ligne" });
        return;
      }

      setLines((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    } catch (e: any) {
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur réseau (patch)" });
    } finally {
      setSavingId(null);
    }
  }

  async function createInventoryLine(payload: { category: string; label: string; unit: string; qty: number }) {
    const sid = sessionIdRef.current || sessionId;
    if (!sid) throw new Error("Session inventaire manquante");
    const r = await fetch(`${API}/inventory/lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      credentials: "include",
      body: JSON.stringify({
        inventorySessionId: sid,
        inventory_session_id: sid,
        category: payload.category,
        name: payload.label,
        label: payload.label,
        unit: payload.unit,
        default_qty: payload.qty,
        defaultQty: payload.qty,
        entry_qty: payload.qty,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.message || JSON.stringify(j));
    return j as any;
  }

  async function deleteInventoryLine(line: InvLine) {
    setError("");
    setStatus("");

    setLines((prev) => prev.filter((x) => x.id !== line.id));

    let undone = false;
    const undoId = "undo-" + line.id;

    const sidAtDelete = sessionIdRef.current || sessionId;
    const timer = setTimeout(async () => {
      if (undone) return;
      try {
        const r = await fetch(`${API}/inventory/lines/${line.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (!r.ok) {
          await loadLines(sidAtDelete);
          pushToast({ kind: "err", message: "Suppression: erreur serveur, rechargé." });
        }
      } catch {
        await loadLines(sidAtDelete);
      } finally {
        delete undoTimers.current[undoId];
      }
    }, 5000);

    undoTimers.current[undoId] = timer;

    pushToast({
      kind: "warn",
      message: `Supprimé: ${String(getLabel(line) || "ligne")}`,
      actionLabel: "Annuler",
      onAction: async () => {
        if (undoTimers.current[undoId]) clearTimeout(undoTimers.current[undoId]);
        undone = true;
        delete undoTimers.current[undoId];

        try {
          const category = getCategory(line);
          const label = String(getLabel(line) || "");
          const unit = String(line.unit || "piece");
          const qty = Number(line.entry_qty ?? line.default_qty ?? 1);

          const created = await createInventoryLine({ category, label, unit, qty });
          const newId = created?.id || created?.line?.id || created?.inventoryLine?.id;

          if (newId) {
            try {
              await patchLine(String(newId), {
                entry_qty: line.entry_qty ?? qty,
                entry_state: line.entry_state ?? "OK",
                entry_notes: line.entry_notes ?? null,
                exit_qty: line.exit_qty ?? 0,
                exit_state: line.exit_state ?? (line.entry_state ?? "OK"),
                exit_notes: line.exit_notes ?? null,
              });
            } catch {}
          }

          await loadLines(sidAtDelete);
          pushToast({ kind: "ok", message: "Restauration ✅" });
        } catch {
          await loadLines(sidAtDelete);
          pushToast({ kind: "err", message: "Restauration: erreur, rechargé." });
        }
      },
    });
  }

  async function onAddSubmit() {
    if (!sessionId) return;

    const category = (addCategory || "Divers").trim() || "Divers";
    const label = (addLabel || "").trim();
    const unit = (addUnit || "piece").trim() || "piece";
    const qty = Number.isFinite(addQty) ? Math.max(0, Number(addQty)) : 1;

    if (!label) {
      pushToast({ kind: "warn", message: "Désignation requise" });
      return;
    }

    const isDup = existsDuplicate(category, label);
    if (isDup && !addDupConfirm) {
      setAddDupConfirm(true);
      return;
    }

    try {
      await createInventoryLine({ category, label, unit, qty });
      pushToast({ kind: "ok", message: "Ligne ajoutée ✅" });

      await loadLines(sessionId);

      setAddOpen(false);
      setAddDupConfirm(false);
      setAddLabel("");
      setAddQty(1);
      setAddUnit("piece");
      setAddCategory(category);
    } catch (e: any) {
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur ajout ligne" });
    }
  }

  async function copyEntryToExit() {
    if (copying) return;

    try {
      if (!token) throw new Error("Non connecté (token manquant).");
      setCopying(true);

      // 1) sessions fraîches (ne pas dépendre de `sessions` React)
      const rSess = await fetch(`${API}/inventory/sessions?leaseId=${leaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const jSess = await rSess.json().catch(() => []);
      if (!rSess.ok) throw new Error(jSess?.message || "Impossible de charger les sessions (inventory).");

      const fresh: InvSession[] = Array.isArray(jSess) ? jSess : [];
      fresh.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

      // 2) exit existante ?
      let exitSessionId = fresh.find((s) => s.status === "exit")?.id;

      // 3) sinon créer une exit (FETCH DIRECT, pas createStatus)
      if (!exitSessionId) {
        const rCreate = await fetch(`${API}/inventory/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          credentials: "include",
          body: JSON.stringify({ leaseId, status: "exit" }),
        });

        const jCreate = await rCreate.json().catch(() => ({}));
        if (!rCreate.ok) {
          throw new Error(jCreate?.message || "Impossible de créer la session sortie (inventory).");
        }

        exitSessionId =
          jCreate?.id ||
          jCreate?.inventorySessionId ||
          jCreate?.sessionId ||
          jCreate?.session?.id ||
          jCreate?.inventorySession?.id;

        // fallback: re-fetch sessions et repick
        if (!exitSessionId) {
          const rSess2 = await fetch(`${API}/inventory/sessions?leaseId=${leaseId}`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          });
          const jSess2 = await rSess2.json().catch(() => []);
          const fresh2: InvSession[] = Array.isArray(jSess2) ? jSess2 : [];
          fresh2.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
          exitSessionId = fresh2.find((s) => s.status === "exit")?.id;
        }
      }

      if (!exitSessionId) throw new Error("Aucune session sortie disponible (inventory).");

      // 4) bascule UI
      sessionIdRef.current = exitSessionId;
      userPickedSessionRef.current = true;
      setSessionId(exitSessionId);
      setViewMode("EXIT");

      // 5) nouvel endpoint ciblé
      const rCopy = await fetch(`${API}/inventory/sessions/${exitSessionId}/copy-from-entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!rCopy.ok) {
        const t = await rCopy.text().catch(() => "");
        throw new Error(t || "Copie entrée → sortie impossible (inventory).");
      }

      // 6) reload lines
      await loadLines(exitSessionId);

      pushToast({ kind: "ok", message: "Copie entrée → sortie ✅" });
    } catch (e: any) {
      console.error(e);
      pushToast({ kind: "err", message: e?.message || "Erreur copie entrée → sortie (inventory)" });
    } finally {
      setCopying(false);
    }
  }

  async function saveAsUnitReferenceInventory() {
    if (!token) return;

    const sid = sessionIdRef.current || sessionId;
    if (!sid) return;
    setError("");
    setStatus("Enregistrement référence logement (Inventaire)…");
    setSavingReference(true);
    try {
      const r = await fetch(`${API}/inventory/reference?leaseId=${leaseId}&inventorySessionId=${sid}`, {
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
      setLastReferenceInfo({ unitId: j?.unitId, referenceInventorySessionId: j?.referenceInventorySessionId });
      await loadReference();
      const msg =
        j?.mode === "update_reference"
          ? "Référence logement mise à jour depuis la sortie ✅"
          : "Référence logement définie ✅";

      setStatus(msg);
      pushToast({ kind: "ok", message: msg });
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur réseau (référence)" });
    } finally {
      setSavingReference(false);
    }
  }

  async function bootstrapEntryFromReferenceInventory() {
    if (!token) return;

    setError("");
    setStatus("Création de l'entrée depuis la référence logement…");
    setApplyingReference(true);

    try {
      const r = await fetch(`${API}/inventory/apply-reference?leaseId=${leaseId}&status=entry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        pushToast({ kind: "err", message: "Impossible de créer l'entrée depuis la référence" });
        return;
      }

      const newSessionId =
        j?.id ||
        j?.inventorySessionId ||
        j?.sessionId ||
        j?.inventory_session_id ||
        j?.session?.id ||
        j?.inventorySession?.id ||
        null;

      pushToast({ kind: "ok", message: "Entrée créée depuis la référence ✅" });

      await loadSessions(newSessionId ? String(newSessionId) : undefined);
      await loadReference();

      const targetId = newSessionId ? String(newSessionId) : sessionIdRef.current || "";

      if (targetId) {
        sessionIdRef.current = targetId;
        userPickedSessionRef.current = true;
        setSessionId(targetId);
        setViewMode("ENTRY");
        await loadLines(targetId);
      }
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur réseau (bootstrap référence)" });
    } finally {
      setApplyingReference(false);
      setStatus("");
    }
  }

  async function applyUnitReferenceToLeaseInventory() {
    if (!token) return;
    if (!confirm("Créer une nouvelle session inventaire clonée depuis la référence logement ?")) return;

    setError("");
    setStatus("Application référence logement (Inventaire)…");
    setApplyingReference(true);
    try {
        const status = viewMode === "EXIT" ? "exit" : "entry";

        const r = await fetch(`${API}/inventory/apply-reference?leaseId=${leaseId}&status=${status}`, {
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

      const newSessionId =
        j?.id ||
        j?.inventorySessionId ||
        j?.sessionId ||
        j?.inventory_session_id ||
        j?.session?.id ||
        j?.inventorySession?.id ||
        null;

      await loadSessions(newSessionId ? String(newSessionId) : undefined);

      // reload reference badge state (if any)
      await loadReference();

      const targetId = newSessionId ? String(newSessionId) : "";

      if (targetId) {
        sessionIdRef.current = targetId;
        userPickedSessionRef.current = true;
        setSessionId(targetId);
        setViewMode(status === "exit" ? "EXIT" : "ENTRY");
        await loadLines(targetId);
      } else {
        // fallback: si l'API ne renvoie pas d'id
        const rSess = await fetch(`${API}/inventory/sessions?leaseId=${leaseId}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        const jSess = await rSess.json().catch(() => []);
        const fresh: InvSession[] = Array.isArray(jSess) ? jSess : [];
        fresh.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

        const picked = fresh.find((s) => s.status === status)?.id;
        if (picked) {
          sessionIdRef.current = picked;
          userPickedSessionRef.current = true;
          setSessionId(picked);
          setViewMode(status === "exit" ? "EXIT" : "ENTRY");
          await loadLines(picked);
        }
      }
      
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
      pushToast({ kind: "err", message: "Erreur réseau (apply référence)" });
    } finally {
      setApplyingReference(false);
    }
  }

  function toggleNotes(id: string) {
    setNotesOpen((p) => ({ ...p, [id]: !p[id] }));
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  }

  function openAddModal(presetCategory?: string) {
    setAddCategory(presetCategory || (allCategories[0] || "Séjour"));
    setAddLabel("");
    setAddUnit("piece");
    setAddQty(1);
    setAddDupConfirm(false);
    setAddOpen(true);
    setTimeout(() => addLabelRef.current?.focus(), 50);
  }

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return lines;
    return lines.filter((ln) => String(getLabel(ln) || "").toLowerCase().includes(qq));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, q]);

  const grouped = useMemo(() => {
    const groups: { [k: string]: InvLine[] } = {};
    for (let i = 0; i < filtered.length; i++) {
      const ln = filtered[i];
      const c = getCategory(ln);
      if (!groups[c]) groups[c] = [];
      groups[c].push(ln);
    }

    const cats = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    const out: Array<[string, InvLine[]]> = [];
    for (let i = 0; i < cats.length; i++) {
      const k = cats[i];
      const arr = groups[k];
      arr.sort((a, b) => String(getLabel(a) || "").localeCompare(String(getLabel(b) || "")));
      out.push([k, arr]);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const gridTemplate =
    "minmax(240px, 1.2fr) " +
    (showEntry ? "minmax(260px, 1fr) " : "") +
    (showExit ? "minmax(260px, 1fr) " : "") +
    "260px";


  function syncViewModeWithSession(nextSessionId: string, list: InvSession[] = sessions) {
    const s = list.find((x) => x.id === nextSessionId);
    if (!s) return;

    const st = String(s.status || "").toLowerCase();
    if (st === "exit") setViewMode("EXIT");
    else if (st === "entry") setViewMode("ENTRY");
  }

  return (
    <main style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 28px 40px", background: bg, minHeight: "100vh", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif" }}>
      {/* Toasts */}
      <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 9999, display: "grid", gap: 8, width: 360, maxWidth: "calc(100vw - 40px)" }}>
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
          <div style={{ width: 720, maxWidth: "100%", borderRadius: 18, background: "#fff", border: `1px solid ${border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Ajouter une ligne inventaire</div>
              <button onClick={() => setAddOpen(false)} style={btnSecondary(border)}>✕</button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <label style={labelStyle(muted)}>
                Catégorie
                <input
                  list="inv-cats"
                  value={addCategory}
                  onChange={(e) => {
                    setAddCategory(e.target.value);
                    setAddDupConfirm(false);
                  }}
                  placeholder="ex: Chambre"
                  style={inputStyle(border)}
                />
                <datalist id="inv-cats">
                  {allCategories.map((c) => (
                    <option key={c} value={c} />
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
                  placeholder="ex: Armoire"
                  style={inputStyle(border)}
                />
              </label>

              <label style={labelStyle(muted)}>
                Unité
                <input value={addUnit} onChange={(e) => setAddUnit(e.target.value)} placeholder="piece" style={inputStyle(border)} />
              </label>

              <label style={labelStyle(muted)}>
                Quantité (par défaut)
                <input type="number" value={addQty} onChange={(e) => setAddQty(Number(e.target.value))} style={inputStyle(border)} />
              </label>
            </div>

            {existsDuplicate(addCategory || "Divers", addLabel) && (
              <div style={{ marginTop: 10, border: `1px solid rgba(220,38,38,0.25)`, background: "rgba(220,38,38,0.06)", color: "#7f1d1d", borderRadius: 14, padding: 10, fontWeight: 850 }}>
                ⚠️ Cette désignation existe déjà dans cette catégorie.
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                  Clique “Ajouter quand même” pour forcer.
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setAddOpen(false)} style={btnSecondary(border)}>Annuler</button>
              <button onClick={onAddSubmit} style={btnPrimary(blue)}>
                {existsDuplicate(addCategory || "Divers", addLabel) && !addDupConfirm ? "Ajouter quand même" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff modal */}
      {diffOpen && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDiffOpen(false);
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
          <div
            style={{
              width: 980,
              maxWidth: "100%",
              borderRadius: 18,
              background: "#fff",
              border: `1px solid ${border}`,
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              padding: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Différences Inventaire (Entrée ↔ Sortie)</div>
              <button onClick={() => setDiffOpen(false)} style={btnSecondary(border)}>
                ✕
              </button>
            </div>

            <div style={{ marginTop: 10, color: muted, fontSize: 12 }}>
              Session sélectionnée : <b style={{ color: "#111" }}>{(sessionIdRef.current || sessionId).slice(0, 8)}…</b>
            </div>

            {diffLoading && (
              <div style={{ marginTop: 12, color: muted, fontWeight: 900 }}>Chargement…</div>
            )}
            {diffError && (
              <div style={{ marginTop: 12, color: "crimson", fontWeight: 900 }}>{diffError}</div>
            )}

            {!diffLoading && !diffError && (
              <div style={{ marginTop: 12 }}>
                {!diffRows.length ? (
                  <div style={{ color: muted, fontWeight: 900 }}>Aucune différence ✅</div>
                ) : (
                  <div style={{ display: "grid", gap: 8, maxHeight: "65vh", overflow: "auto", paddingRight: 4 }}>
                    {diffRows.map((r) => (
                      <div
                        key={r.key}
                        style={{
                          border: `1px solid ${border}`,
                          borderRadius: 14,
                          padding: 10,
                          background: "#fbfbfd",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 950 }}>
                              {r.category} • {r.label} {r.unit ? <span style={{ color: muted, fontWeight: 800 }}>({r.unit})</span> : null}
                            </div>
                            <div style={{ color: muted, fontSize: 12 }}>{r.key}</div>
                          </div>
                          <span style={diffPill(r.kind as any)}>{String(r.kind).toUpperCase()}</span>
                        </div>

                        <div style={{ marginTop: 10, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                          <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 10, background: "#fff" }}>
                            <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 6 }}>Entrée</div>
                            <div style={{ fontSize: 12, color: muted }}>
                              <b style={{ color: "#111" }}>Qté:</b> {r.entry_qty ?? "—"} • <b style={{ color: "#111" }}>État:</b> {r.entry_state ?? "—"}
                            </div>
                            <div style={{ fontSize: 12, color: muted, marginTop: 6, whiteSpace: "pre-wrap" }}>
                              <b style={{ color: "#111" }}>Notes:</b> {r.entry_notes ?? "—"}
                            </div>
                          </div>

                          <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 10, background: "#fff" }}>
                            <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 6 }}>Sortie</div>
                            <div style={{ fontSize: 12, color: muted }}>
                              <b style={{ color: "#111" }}>Qté:</b> {r.exit_qty ?? "—"} • <b style={{ color: "#111" }}>État:</b> {r.exit_state ?? "—"}
                            </div>
                            <div style={{ fontSize: 12, color: muted, marginTop: 6, whiteSpace: "pre-wrap" }}>
                              <b style={{ color: "#111" }}>Notes:</b> {r.exit_notes ?? "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setDiffOpen(false)} style={btnSecondary(border)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={card(border, "#fff")}>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.05, letterSpacing: "-0.03em", color: "#1F2A3C" }}>Inventaire</h1>
              <div style={{ color: muted, fontSize: 14, lineHeight: 1.6 }}>Bail {leaseId.slice(0, 8)}… · mobilier, quantité et états</div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={chipGroup(border)}>
                <span style={chipLabel(muted)}>Vue</span>
                <button onClick={() => setViewMode("COMPARE")} style={chip(border, viewMode === "COMPARE")}>Comparatif</button>
                <button onClick={() => setViewMode("ENTRY")} style={chip(border, viewMode === "ENTRY")}>Entrée</button>
                <button onClick={() => setViewMode("EXIT")} style={chip(border, viewMode === "EXIT")}>Sortie</button>
              </div>
              <Link href="/dashboard/leases"><button style={btnSecondary(border)}>Retour baux</button></Link>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 0.9fr)" }}>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ border: `1px solid ${border}`, borderRadius: 18, background: "#FAFBFC", padding: 14 }}>
                <div style={{ color: "#8D99AE", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 900, marginBottom: 10 }}>Navigation</div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "minmax(0, 1fr) 280px auto" }}>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une désignation…" style={{ ...inputStyle(border), background: "#fff" }} />
                  <select value={sessionId} onChange={(e) => { const v = e.target.value; userPickedSessionRef.current = true; sessionIdRef.current = v; setSessionId(v); syncViewModeWithSession(v); }} style={{ ...inputStyle(border), background: "#fff" }} title="Session">
                    {sessions.map((s) => (<option key={s.id} value={s.id}>{fmtDate(s.created_at)} · {s.status} · {s.id.slice(0, 4)}…</option>))}
                    {!sessions.length && <option value="">Aucune session</option>}
                  </select>
                  <button onClick={() => openAddModal()} disabled={!sessionId} style={{ ...btnPrimary(blue), opacity: sessionId ? 1 : 0.5 }}>Ajouter ligne</button>
                </div>
              </div>

              <div style={{ border: `1px solid ${border}`, borderRadius: 18, background: "#FAFBFC", padding: 14 }}>
                <div style={{ color: "#8D99AE", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 900, marginBottom: 10 }}>Sessions</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button onClick={() => setCreateStatus("entry")} style={chip(border, createStatus === "entry")}>Entrée</button>
                  <button onClick={() => setCreateStatus("exit")} style={chip(border, createStatus === "exit")}>Sortie</button>
                  <button onClick={createEmptySession} disabled={creatingSession} style={{ ...btnPrimary(blue), opacity: creatingSession ? 0.6 : 1 }}>{creatingSession ? "Création…" : "Nouvelle session"}</button>
                  {viewMode !== "EXIT" && <button onClick={copyEntryToExit} disabled={!sessionId || copying} style={{ ...btnSecondary(border), opacity: !sessionId || copying ? 0.5 : 1 }}>{copying ? "Copie…" : "Copier entrée → sortie"}</button>}
                  <button onClick={() => loadSessions()} style={btnSecondary(border)}>Rafraîchir</button>
                  <button onClick={toggleFullscreen} style={btnSecondary(border)}>{isFullscreen ? "Quitter plein écran" : "Plein écran"}</button>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ border: `1px solid ${border}`, borderRadius: 18, background: "#FAFBFC", padding: 14 }}>
                <div style={{ color: "#8D99AE", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 900, marginBottom: 10 }}>Référence logement</div>
                <div style={{ color: muted, fontSize: 13, lineHeight: 1.6 }}>
                  {hasReference ? <>Référence active · <b style={{ color: "#1F2A3C" }}>{String(referenceInfo?.referenceInventorySessionId || "").slice(0, 8)}…</b></> : <>Aucune référence définie</>}
                </div>
                {lastReferenceInfo?.referenceInventorySessionId && (
                  <div style={{ marginTop: 8, color: muted, fontSize: 12 }}>Dernière référence logement · <b style={{ color: "#1F2A3C" }}>{String(lastReferenceInfo.referenceInventorySessionId).slice(0, 8)}…</b></div>
                )}
                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={saveAsUnitReferenceInventory} disabled={!sessionId || savingReference} style={{ ...btnSecondary(border), opacity: !sessionId || savingReference ? 0.6 : 1 }}>{savingReference ? "Enregistrement…" : "Définir référence"}</button>
                  <button onClick={applyUnitReferenceToLeaseInventory} disabled={applyingReference || !hasReference} style={{ ...btnSecondary(border), opacity: applyingReference || !hasReference ? 0.6 : 1 }} title={!hasReference ? "Aucune référence logement définie" : ""}>{applyingReference ? "Application…" : "Réinitialiser"}</button>
                  <button onClick={openDiffModal} disabled={!sessionId} style={{ ...btnSecondary(border), opacity: sessionId ? 1 : 0.6 }}>Différences</button>
                </div>
                {sessions.length === 0 && hasReference && (
                  <div style={{ marginTop: 12 }}>
                    <button onClick={bootstrapEntryFromReferenceInventory} disabled={applyingReference} style={{ ...btnPrimary(blue), opacity: applyingReference ? 0.6 : 1 }}>{applyingReference ? "Création…" : "Créer entrée depuis référence"}</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {status && <div style={{ marginTop: 10, color: green, fontWeight: 800 }}>{status}</div>}
        {error && <div style={{ marginTop: 10, color: "crimson", fontWeight: 800 }}>{error}</div>}
      </div>

      {!!sessionId && (
        <div style={{ position: "sticky", top: 8, zIndex: 20, marginTop: 12, ...card(border, "#fff"), padding: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 10, alignItems: "center" }}>
            <div style={{ color: muted, fontSize: 12, fontWeight: 900 }}>Désignation</div>
            {showEntry && <div style={{ textAlign: "center", fontSize: 12, fontWeight: 900 }}>Entrée</div>}
            {showExit && <div style={{ textAlign: "center", fontSize: 12, fontWeight: 900 }}>Sortie</div>}
            <div style={{ textAlign: "right", color: muted, fontSize: 12, fontWeight: 900 }}>Actions</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {grouped.map(([cat, arr]) => {
          const isCol = collapsed[cat] ?? false;

          return (
            <section key={cat} style={card(border, "#fff")}>
              <div
                style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", cursor: "pointer", userSelect: "none" }}
                onClick={() => setCollapsed((p) => ({ ...p, [cat]: !isCol }))}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={collapseBtn(border)}>{isCol ? "▸" : "▾"}</div>
                  <div style={{ fontWeight: 950, letterSpacing: -0.1 }}>
                    {cat}{" "}
                    <span style={{ color: muted, fontSize: 12, fontWeight: 800 }}>{arr.length} lignes</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddModal(cat);
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
                  {arr.map((ln) => {
                    const label = getLabel(ln);
                    const entryQty = Number(ln.entry_qty ?? 0);
                    const exitQty = Number(ln.exit_qty ?? 0);
                    const entryState = String(ln.entry_state ?? "");
                    const exitState = String(ln.exit_state ?? "");

                    return (
                      <div key={ln.id} style={{ border: `1px solid ${border}`, borderRadius: 18, background: "#fff", boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
                        <div style={{ padding: 14 }}>
                          <div style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 10, alignItems: "center" }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 950, lineHeight: 1.1 }}>
                                {label ? label : `Item ${String(ln.catalog_item_id || ln.id).slice(0, 8)}…`}
                              </div>
                              <div style={{ color: muted, fontSize: 11 }}>
                                {savingId === ln.id ? "Enregistrement…" : ln.id.slice(0, 8) + "…"}
                              </div>
                            </div>

                            {showEntry && (
                              <div style={cell(border)}>
                                <div style={{ display: "grid", gridTemplateColumns: "86px 1fr", gap: 8 }}>
                                  <input
                                    type="number"
                                    value={entryQty}
                                    onChange={(e) => patchLine(ln.id, { entry_qty: Number(e.target.value) })}
                                    style={{ ...inputStyle(border), padding: "10px 10px", background: "#fff" }}
                                  />
                                  <select
                                    value={entryState || ""}
                                    onChange={(e) => patchLine(ln.id, { entry_state: e.target.value })}
                                    style={{ ...inputStyle(border), padding: "10px 10px", background: "#fff" }}
                                  >
                                    <option value="">—</option>
                                    {CONDITION_PRESETS.map((x) => (
                                      <option key={x} value={x}>
                                        {x}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}

                            {showExit && (
                              <div style={cell(border)}>
                                <div style={{ display: "grid", gridTemplateColumns: "86px 1fr", gap: 8 }}>
                                  <input
                                    type="number"
                                    value={exitQty}
                                    onChange={(e) => patchLine(ln.id, { exit_qty: Number(e.target.value) })}
                                    style={{ ...inputStyle(border), padding: "10px 10px", background: "#fff" }}
                                  />
                                  <select
                                    value={exitState || ""}
                                    onChange={(e) => patchLine(ln.id, { exit_state: e.target.value })}
                                    style={{ ...inputStyle(border), padding: "10px 10px", background: "#fff" }}
                                  >
                                    <option value="">—</option>
                                    {CONDITION_PRESETS.map((x) => (
                                      <option key={x} value={x}>
                                        {x}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                              <button onClick={() => toggleNotes(ln.id)} style={btnGhost(border)}>Notes</button>
                              <button
                                onClick={() => deleteInventoryLine(ln)}
                                style={{ ...btnGhost(border), borderColor: "rgba(220,38,38,0.35)", color: "#7f1d1d" }}
                                title="Supprimer (undo 5s)"
                              >
                                Supprimer
                              </button>
                            </div>
                          </div>

                          {notesOpen[ln.id] && (
                            <div
                              style={{
                                marginTop: 10,
                                display: "grid",
                                gap: 10,
                                gridTemplateColumns: showEntry && showExit ? "1fr 1fr" : "1fr",
                              }}
                            >
                              {showEntry && (
                                <div
                                  style={{
                                    border: `1px solid ${border}`,
                                    borderRadius: 12,
                                    padding: 10,
                                    background: "#fbfbfd",
                                  }}
                                >
                                  <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 6 }}>
                                    Notes Entrée
                                  </div>
                                  <textarea
                                    value={ln.entry_notes || ""}
                                    onChange={(e) => patchLine(ln.id, { entry_notes: e.target.value })}
                                    style={{
                                      ...inputStyle(border),
                                      minHeight: 70,
                                      resize: "vertical",
                                      background: "#fff",
                                    }}
                                  />
                                </div>
                              )}

                              {showExit && (
                                <div
                                  style={{
                                    border: `1px solid ${border}`,
                                    borderRadius: 12,
                                    padding: 10,
                                    background: "#fbfbfd",
                                  }}
                                >
                                  <div style={{ fontWeight: 900, fontSize: 12, marginBottom: 6 }}>
                                    Notes Sortie
                                  </div>
                                  <textarea
                                    value={ln.exit_notes || ""}
                                    onChange={(e) => patchLine(ln.id, { exit_notes: e.target.value })}
                                    style={{
                                      ...inputStyle(border),
                                      minHeight: 70,
                                      resize: "vertical",
                                      background: "#fff",
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {!lines.length && (
          <section style={{ ...card(border, "#fff"), color: muted }}>
            {sessionId ? "Aucune ligne." : "Aucune ligne (pas de session)."}
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

function diffPill(kind: "added" | "removed" | "changed" | string) {
  const k = String(kind || "").toLowerCase();
  const map: Record<string, { b: string; bg: string; c: string }> = {
    added: { b: "rgba(22,163,74,0.25)", bg: "rgba(22,163,74,0.10)", c: "#14532d" },
    removed: { b: "rgba(220,38,38,0.28)", bg: "rgba(220,38,38,0.10)", c: "#7f1d1d" },
    changed: { b: "rgba(245,158,11,0.30)", bg: "rgba(245,158,11,0.12)", c: "#78350f" },
  };
  const s = map[k] || map.changed;
  return {
    fontSize: 11,
    fontWeight: 950,
    padding: "4px 8px",
    borderRadius: 999,
    border: `1px solid ${s.b}`,
    background: s.bg,
    color: s.c,
    letterSpacing: 0.4,
    whiteSpace: "nowrap",
  } as const;
}

function card(border: string, bg: string) {
  return {
    border: `1px solid ${border}`,
    borderRadius: 24,
    background: bg,
    padding: 18,
    boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
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
    background: "#FAFBFC",
    color: "#243247",
    boxShadow: "none",
  };
}
function btnPrimary(_blue: string) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid rgba(47,99,224,0.18)`,
    background: "linear-gradient(180deg, #2F63E0 0%, #2A5BD7 100%)",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(47,99,224,0.18)",
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
    color: "#243247",
    boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
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
    color: "#243247",
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
    background: "rgba(27,39,64,0.02)",
  } as const;
}
function chipLabel(muted: string) {
  return { color: muted, fontSize: 12, fontWeight: 900, paddingLeft: 6 } as const;
}
function chip(border: string, active: boolean) {
  return {
    padding: "8px 10px",
    borderRadius: 12,
    border: `1px solid ${active ? "rgba(47,99,224,0.16)" : border}` ,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: active ? 950 : 900,
    background: active ? "#EEF4FF" : "#fff",
    color: active ? "#2F63E0" : "#243247",
  } as const;
}
function collapseBtn(border: string) {
  return {
    width: 34,
    height: 34,
    borderRadius: 12,
    border: `1px solid ${border}` ,
    display: "grid",
    placeItems: "center",
    background: "#FAFBFC",
    fontWeight: 950,
    color: "#243247",
  } as const;
}
function cell(border: string) {
  return {
    border: `1px solid ${border}` ,
    borderRadius: 14,
    padding: 8,
    background: "#F8FAFC",
  } as const;
}
