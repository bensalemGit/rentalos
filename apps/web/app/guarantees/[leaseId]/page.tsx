"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  FileSignature,
  Mail,
  RefreshCw,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type GuaranteeType = "CAUTION" | "VISALE";
type GuaranteeStatus =
  | "DRAFT"
  | "READY"
  | "SENT"
  | "SIGNED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

type Guarantee = {
  id: string;
  lease_id: string;
  lease_tenant_id: string;

  type: GuaranteeType;
  status: GuaranteeStatus;
  selected: boolean;
  rank: number | null;

  guarantor_full_name: string | null;
  guarantor_email: string | null;
  guarantor_phone: string | null;
  guarantor_address: string | null;

  visale_reference: string | null;
  visale_validated_at: string | null;

  guarantor_act_document_id: string | null;
  signed_final_document_id: string | null;

  created_at: string;
  updated_at: string;

  // joins returned by API listByLease
  tenant_id?: string;
  role?: string;
  tenant_full_name?: string;
  tenant_email?: string;
};

type LeaseTenant = {
  id: string; // lease_tenant_id
  tenant_id: string;
  role?: string | null;
  tenant_full_name?: string | null;
  tenant_email?: string | null;
};

type GuaranteeEditDraft = {
  guarantor_full_name?: string;
  guarantor_email?: string;
  guarantor_phone?: string;
  guarantor_address?: string;
  visale_reference?: string;
};

function friendlyError(msg: string) {
  const m = String(msg || "").toLowerCase();
  if (m.includes("only one selected")) return "Une seule garantie peut être sélectionnée par locataire.";
  if (m.includes("invalid guarantee type")) return "Type de garantie invalide.";
  if (m.includes("missing")) return "Champs manquant.";
  return msg || "Erreur";
}
const blue = "#3467EB";
const border = "rgba(27,39,64,0.08)";
const cardBorder = "rgba(27,39,64,0.06)";
const shellBg = "#F6F8FC";
const title = "#17233A";
const muted = "#667085";
const softText = "#8D99AE";

function roleLabel(role?: string | null) {
  const v = String(role || "").toLowerCase();

  if (v === "principal") return "Locataire principal";
  if (v === "cotenant") return "Colocataire";
  if (v === "co_tenant") return "Colocataire";

  return v || "Locataire";
}

function guaranteeTypeLabel(type?: string | null) {
  const v = String(type || "").toUpperCase();

  if (v === "CAUTION") return "Caution";
  if (v === "VISALE") return "VISALE";

  return v || "Garantie";
}

function guaranteeStatusLabel(status?: string | null) {
  const v = String(status || "").toUpperCase();

  if (v === "DRAFT") return "Brouillon";
  if (v === "READY") return "Prête";
  if (v === "SENT") return "Envoyée";
  if (v === "SIGNED") return "Signée";
  if (v === "REJECTED") return "Rejetée";
  if (v === "EXPIRED") return "Expirée";
  if (v === "CANCELLED") return "Annulée";

  return v || "—";
}

export default function GuaranteesPage({ params }: { params: { leaseId: string } }) {
  const leaseId = params.leaseId;

  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [items, setItems] = useState<Guarantee[]>([]);
  const [leaseTenants, setLeaseTenants] = useState<LeaseTenant[]>([]);

  // create form per lease_tenant_id
  const [draftByLt, setDraftByLt] = useState<Record<string, any>>({});

  // edit draft per guaranteeId (UI instant)
  const [editById, setEditById] = useState<Record<string, GuaranteeEditDraft>>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});

  // debounce infra
  const patchTimersRef = useRef<Record<string, any>>({});
  const patchQueueRef = useRef<Record<string, any>>({});

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  async function apiFetch(path: string, init?: RequestInit) {
    const r = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
      credentials: "include",
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.message || JSON.stringify(j));
    return j;
  }

  async function load() {
    if (!token) return;
    setError("");
    setStatus("Chargement…");

    try {
      const guaranteesRes = await apiFetch(
        `/guarantees?leaseId=${encodeURIComponent(leaseId)}`,
        { method: "GET" }
      );

      const apiItems = Array.isArray(guaranteesRes?.items) ? guaranteesRes.items : [];
      const apiTenants = Array.isArray(guaranteesRes?.tenants) ? guaranteesRes.tenants : [];

      setItems(apiItems);
      setLeaseTenants(apiTenants);

      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(friendlyError(String(e?.message || e)));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // cleanup timers on unmount
  useEffect(() => {
    return () => {
      for (const k of Object.keys(patchTimersRef.current)) clearTimeout(patchTimersRef.current[k]);
    };
  }, []);

  const tenants = useMemo((): LeaseTenant[] => {
    if (leaseTenants.length > 0) return leaseTenants;

    const map = new Map<string, LeaseTenant>();

    for (const g of items) {
      const ltId = String(g.lease_tenant_id || "").trim();
      if (!ltId) continue;

      if (!map.has(ltId)) {
        map.set(ltId, {
          id: ltId,
          tenant_id: String(g.tenant_id || ""),
          role: g.role || null,
          tenant_full_name: g.tenant_full_name || null,
          tenant_email: g.tenant_email || null,
        });
      }
    }

    return Array.from(map.values());
  }, [leaseTenants, items]);

  const itemsByLeaseTenant = useMemo(() => {
    const obj: Record<string, Guarantee[]> = {};
    for (const g of items) {
      const lt = String(g.lease_tenant_id || "").trim();
      if (!lt) continue;
      if (!obj[lt]) obj[lt] = [];
      obj[lt].push(g);
    }
    for (const k of Object.keys(obj)) {
      obj[k].sort((a, b) => {
        if (!!a.selected !== !!b.selected) return a.selected ? -1 : 1;
        return String(b.created_at).localeCompare(String(a.created_at));
      });
    }
    return obj;
  }, [items]);


  async function sendGuarantorLinkByGuarantee(guaranteeId: string, force = false) {
    setError("");
    setStatus(force ? "Renvoi (force) du lien garant…" : "Envoi du lien garant…");

    try {
      const j = await apiFetch(`/public-links/guarantor-sign/send-by-guarantee`, {
        method: "POST",
        body: JSON.stringify({ leaseId, guaranteeId, ttlHours: 48, force }),
      });

      const email = j?.sentTo || j?.email ? String(j?.sentTo || j?.email) : "—";
      const url = j?.publicUrl || j?.url ? String(j?.publicUrl || j?.url) : "—";
      const expires = j?.expiresAt ? String(j.expiresAt).slice(0, 19) : null;

      if (j?.sent === true) {
        setStatus("✅ Lien garant envoyé");
        alert(`✅ Lien garant envoyé\n\nTo: ${email}\nURL: ${url}\nExpire: ${expires || "—"}`);
        return;
      }

      const reason = String(j?.reason || "");

      // Cas: déjà signé
      if (reason === "already_signed") {
        setStatus("✅ Aucun envoi : déjà signé");
        alert(
          `✅ Aucun envoi : le garant a déjà signé.\n\n` +
            `To: ${email}\n` +
            `Document: ${String(j?.documentId || j?.signedDocumentId || j?.guarantorActDocumentId || "—")}`
        );
        return;
      }

      // Cas: lien déjà actif
      if (reason === "active_link_exists") {
        const activeExp = j?.activeExpiresAt ? String(j.activeExpiresAt).slice(0, 19) : "—";
        setStatus("ℹ️ Aucun envoi : lien déjà actif");
        alert(`ℹ️ Aucun envoi : un lien est déjà actif.\n\nTo: ${email}\nExpire: ${activeExp}\nURL: ${url}`);
        return;
      }

      // Fallback propre (au lieu de "OK")
      setStatus("ℹ️ Aucun envoi.");
      alert(`ℹ️ Aucun envoi.\n\nTo: ${email}\nReason: ${reason || "—"}`);
    } catch (e: any) {
      setStatus("");
      setError(friendlyError(String(e?.message || e)));
    }
  }

  function getEditValue(id: string, field: keyof GuaranteeEditDraft, fallback: string) {
    const v = editById[id]?.[field];
    return v !== undefined ? v : fallback;
  }

  async function patchGuaranteeNoReload(id: string, patch: any) {
    setError("");
    setSavingById((p) => ({ ...p, [id]: true }));

    try {
      await apiFetch(`/guarantees/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });

      // update local items (no full reload)
      setItems((prev) =>
        prev.map((g) => {
          if (g.id !== id) return g;
          return {
            ...g,
            ...(patch.guarantorFullName !== undefined ? { guarantor_full_name: patch.guarantorFullName || null } : {}),
            ...(patch.guarantorEmail !== undefined ? { guarantor_email: patch.guarantorEmail || null } : {}),
            ...(patch.guarantorPhone !== undefined ? { guarantor_phone: patch.guarantorPhone || null } : {}),
            ...(patch.guarantorAddress !== undefined ? { guarantor_address: patch.guarantorAddress || null } : {}),
            ...(patch.visaleReference !== undefined ? { visale_reference: patch.visaleReference || null } : {}),
            updated_at: new Date().toISOString(),
          };
        })
      );

      // clean local draft keys patched
      setEditById((prev) => {
        const cur = { ...(prev[id] || {}) };
        if (patch.guarantorFullName !== undefined) delete cur.guarantor_full_name;
        if (patch.guarantorEmail !== undefined) delete cur.guarantor_email;
        if (patch.guarantorPhone !== undefined) delete cur.guarantor_phone;
        if (patch.guarantorAddress !== undefined) delete cur.guarantor_address;
        if (patch.visaleReference !== undefined) delete cur.visale_reference;

        const next = { ...prev };
        if (Object.keys(cur).length === 0) delete next[id];
        else next[id] = cur;
        return next;
      });
    } catch (e: any) {
      setError(friendlyError(String(e?.message || e)));
    } finally {
      setSavingById((p) => ({ ...p, [id]: false }));
    }
  }

  function debouncePatch(id: string, patch: any, delayMs = 450) {
    patchQueueRef.current[id] = { ...(patchQueueRef.current[id] || {}), ...patch };

    const prevTimer = patchTimersRef.current[id];
    if (prevTimer) clearTimeout(prevTimer);

    patchTimersRef.current[id] = setTimeout(async () => {
      const merged = patchQueueRef.current[id];
      delete patchQueueRef.current[id];
      if (!merged || Object.keys(merged).length === 0) return;
      await patchGuaranteeNoReload(id, merged);
    }, delayMs);
  }

  function ensureDraft(leaseTenantId: string) {
    setDraftByLt((prev) => {
      if (prev[leaseTenantId]) return prev;
      return {
        ...prev,
        [leaseTenantId]: {
          type: "CAUTION" as GuaranteeType,
          selected: true,
          guarantorFullName: "",
          guarantorEmail: "",
          guarantorPhone: "",
          guarantorAddress: "",
          visaleReference: "",
        },
      };
    });
  }

  function updateDraft(leaseTenantId: string, patch: any) {
    setDraftByLt((prev) => ({
      ...prev,
      [leaseTenantId]: { ...(prev[leaseTenantId] || {}), ...patch },
    }));
  }

  async function createGuarantee(leaseTenantId: string) {
    setError("");
    setStatus("Création…");
    try {
      const d = draftByLt[leaseTenantId] || {};
      const type: GuaranteeType = String(d.type || "CAUTION").toUpperCase() as GuaranteeType;
      const payload: any = {
        leaseId,
        leaseTenantId,
        type,
        selected: d.selected === true,
      };

      if (type === "CAUTION") {
        payload.guarantorFullName = String(d.guarantorFullName || "").trim();
        payload.guarantorEmail = String(d.guarantorEmail || "").trim();
        payload.guarantorPhone = String(d.guarantorPhone || "").trim() || null;
        payload.guarantorAddress = String(d.guarantorAddress || "").trim() || null;
        if (!payload.guarantorFullName || !payload.guarantorEmail) {
          throw new Error("Pour CAUTION, nom + email du garant sont requis.");
        }
      } else {
        payload.visaleReference = String(d.visaleReference || "").trim();
        if (!payload.visaleReference) throw new Error("Pour VISALE, la référence est requise.");
      }

      await apiFetch(`/guarantees`, { method: "POST", body: JSON.stringify(payload) });

      setStatus("✅ Garantie créée");
      setDraftByLt((prev) => {
        const next = { ...prev };
        delete next[leaseTenantId];
        return next;
      });
      await load(); // ok de reload sur create

    } catch (e: any) {
      setStatus("");
      setError(friendlyError(String(e?.message || e)));
    }
  }

  async function selectGuarantee(id: string) {
    setError("");
    setStatus("Sélection…");
    try {
      await apiFetch(`/guarantees/${encodeURIComponent(id)}/select`, { method: "POST" });
      setStatus("✅ Sélection mise à jour");
      await load(); // ok de reload sur select (peut changer plusieurs lignes)
    } catch (e: any) {
      setStatus("");
      setError(friendlyError(String(e?.message || e)));
    }
  }

  async function removeGuarantee(id: string) {
    if (!confirm("Supprimer cette garantie ?")) return;
    setError("");
    setStatus("Suppression…");
    try {
      await apiFetch(`/guarantees/${encodeURIComponent(id)}`, { method: "DELETE" });
      setStatus("✅ Supprimée");
      await load(); // ok de reload sur delete
    } catch (e: any) {
      setStatus("");
      setError(friendlyError(String(e?.message || e)));
    }
  }

  const hasAny = items.length > 0;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 1180,
        boxSizing: "border-box",
        margin: "0 auto",
        padding: "32px 36px 56px",
        background: shellBg,
        minHeight: "100vh",
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
          marginBottom: 18,
        }}
      >
        <div>
          <h1
            style={{
              marginTop: 0,
              marginBottom: 8,
              fontSize: 34,
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
              color: title,
              fontWeight: 900,
            }}
          >
            Garanties du bail
          </h1>

          <p style={{ margin: 0, fontSize: 15, color: muted, lineHeight: 1.65 }}>
            Gestion des cautions et garanties VISALE par locataire.
          </p>

          <div style={{ marginTop: 10, fontSize: 13, color: softText, fontWeight: 700 }}>
            {tenants.length} locataire(s) · {items.length} garantie(s)
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={load} style={btnSecondary()}>
            <RefreshCw size={14} strokeWidth={2.1} />
            Rafraîchir
          </button>

          <Link href={`/dashboard/leases/${leaseId}/edit`}>
            <button style={btnSecondary()}>
              <ArrowLeft size={14} strokeWidth={2.1} />
              Retour bail
            </button>
          </Link>
        </div>
      </div>

      {status && (
        <div
          style={{
            ...card(),
            borderColor: "rgba(31,111,235,0.25)",
            background: "rgba(31,111,235,0.05)",
          }}
        >
          <b>{status}</b>
        </div>
      )}
      {error && (
        <div
          style={{
            ...card(),
            borderColor: "rgba(220,38,38,0.25)",
            background: "rgba(220,38,38,0.05)",
          }}
        >
          <b style={{ color: "#b91c1c" }}>{error}</b>
        </div>
      )}

      {!hasAny && (
        <div style={card()}>
          <b>ℹ️ Aucune garantie pour le moment</b>
          <div style={{ marginTop: 6, color: "#6b7280", fontSize: 13 }}>
            Tu peux ajouter une caution ou une garantie VISALE pour chaque locataire ci-dessous.
          </div>
        </div>
      )}

      {tenants.length === 0 && (
        <div style={card()}>
          <b>Aucun locataire trouvé pour ce bail.</b>
          <div style={{ marginTop: 6, color: "#6b7280", fontSize: 13 }}>
            Impossible d’ajouter une garantie tant que les locataires du bail ne sont pas remontés par l’API.
          </div>
        </div>
      )}

      {tenants.map((lt) => {
        const list = itemsByLeaseTenant[lt.id] || [];
        const selected = list.find((x) => x.selected);

        return (
          <section key={lt.id} style={{ marginTop: 14 }}>
            <div style={card()}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 16,
                        background: "#EEF4FF",
                        color: blue,
                        border: "1px solid rgba(47,99,224,0.10)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <UserRound size={20} strokeWidth={2.1} />
                    </div>

                    <div>
                      <div style={{ fontWeight: 900, fontSize: 18, color: title, letterSpacing: "-0.03em" }}>
                        {lt.tenant_full_name || "Locataire"}
                      </div>

                      <div style={{ color: muted, fontSize: 13, marginTop: 4 }}>
                        {roleLabel(lt.role)} · {lt.tenant_email || "email non renseigné"}
                      </div>
                    </div>
                  </div>

                  <div style={{ color: muted, fontSize: 13, marginTop: 10 }}>
                    Garantie sélectionnée :{" "}
                    <b>
                      {selected
                        ? guaranteeTypeLabel(selected.type)
                        : "aucune"}
                    </b>
                    {selected && String(selected.type).toUpperCase() === "VISALE" && (
                      <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>
                        ℹ️ VISALE sélectionné : pas d’acte de caution à signer (pas de lien garant).
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => ensureDraft(lt.id)} style={btnAction()}>
                    <Shield size={14} strokeWidth={2.1} />
                    Ajouter une garantie
                  </button>

                  <button
                    onClick={() => selected?.id && sendGuarantorLinkByGuarantee(selected.id, false)}
                    style={btnAction()}
                    disabled={!selected?.id || String(selected.type).toUpperCase() === "VISALE"}
                    title={
                      !selected?.id
                        ? "Aucune garantie sélectionnée"
                        : String(selected.type).toUpperCase() === "VISALE"
                        ? "VISALE : pas d'acte de caution à signer"
                        : ""
                    }
                  >
                    <Mail size={14} strokeWidth={2.1} />
                    Envoyer lien garant
                  </button>

                  <button
                    onClick={() => selected?.id && sendGuarantorLinkByGuarantee(selected.id, true)}
                    style={btnAction()}
                    disabled={!selected?.id || String(selected.type).toUpperCase() === "VISALE"}
                    title={
                      !selected?.id
                        ? "Aucune garantie sélectionnée"
                        : String(selected.type).toUpperCase() === "VISALE"
                        ? "VISALE : pas d'acte de caution à signer"
                        : ""
                    }
                  >
                    <Mail size={14} strokeWidth={2.1} />
                    Renvoyer lien
                  </button>
                </div>
              </div>

              {/* Create form (IMPORTANT: ici pas de variable g !) */}
              {draftByLt[lt.id] && (
                <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, alignItems: "center" }}>
                    <div style={labelMuted()}>Type</div>
                    <select
                      value={draftByLt[lt.id].type}
                      onChange={(e) => updateDraft(lt.id, { type: e.target.value })}
                      style={input()}
                    >
                      <option value="CAUTION">CAUTION</option>
                      <option value="VISALE">VISALE</option>
                    </select>

                    <div style={labelMuted()}>Sélectionner</div>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={draftByLt[lt.id].selected === true}
                        onChange={(e) => updateDraft(lt.id, { selected: e.target.checked })}
                      />
                      <span style={{ color: "#111", fontSize: 13 }}>
                        Mettre cette garantie comme sélectionnée (désélectionne les autres)
                      </span>
                    </label>
                  </div>

                  {String(draftByLt[lt.id].type).toUpperCase() === "CAUTION" ? (
                    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                      <div style={labelMuted()}>Nom garant *</div>
                      <input
                        value={draftByLt[lt.id].guarantorFullName || ""}
                        onChange={(e) => updateDraft(lt.id, { guarantorFullName: e.target.value })}
                        style={input()}
                        placeholder="Ex: Dupont Jean"
                      />

                      <div style={labelMuted()}>Email garant *</div>
                      <input
                        value={draftByLt[lt.id].guarantorEmail || ""}
                        onChange={(e) => updateDraft(lt.id, { guarantorEmail: e.target.value })}
                        style={input()}
                        placeholder="garant@test.com"
                      />

                      <div style={labelMuted()}>Téléphone (optionnel)</div>
                      <input
                        value={draftByLt[lt.id].guarantorPhone || ""}
                        onChange={(e) => updateDraft(lt.id, { guarantorPhone: e.target.value })}
                        style={input()}
                        placeholder="06…"
                      />

                      <div style={labelMuted()}>Adresse garant *</div>
                      <input
                        value={draftByLt[lt.id].guarantorAddress || ""}
                        onChange={(e) => updateDraft(lt.id, { guarantorAddress: e.target.value })}
                        style={input()}
                        placeholder="Adresse complète du garant"
                      />
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                      <div style={labelMuted()}>Référence VISALE *</div>
                      <input
                        value={draftByLt[lt.id].visaleReference || ""}
                        onChange={(e) => updateDraft(lt.id, { visaleReference: e.target.value })}
                        style={input()}
                        placeholder="VISALE-123"
                      />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                    <button onClick={() => createGuarantee(lt.id)} style={btnPrimary()}>
                      Créer
                    </button>
                    <button
                      onClick={() =>
                        setDraftByLt((prev) => {
                          const n = { ...prev };
                          delete n[lt.id];
                          return n;
                        })
                      }
                      style={btnSecondary()}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {/* Existing list */}
              <div style={{ marginTop: 12 }}>
                {list.length === 0 ? (
                  <div style={{ color: "#6b7280", fontSize: 13 }}>Aucune garantie pour ce locataire.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {list.map((g) => (
                      <div
                        key={g.id}
                        style={{
                          border: `1px solid ${g.selected ? "rgba(22,163,74,0.35)" : "#e5e7eb"}`,
                          background: g.selected ? "rgba(22,163,74,0.06)" : "#fff",
                          borderRadius: 14,
                          padding: 12,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 900, color: title, display: "inline-flex", alignItems: "center", gap: 8 }}>
                              {g.type === "CAUTION" ? (
                                <FileSignature size={16} strokeWidth={2.1} />
                              ) : (
                                <BadgeCheck size={16} strokeWidth={2.1} />
                              )}
                              {guaranteeTypeLabel(g.type)}
                            </div>

                            <span style={statusPill(g.status)}>
                              {guaranteeStatusLabel(g.status)}
                            </span>

                            {g.selected && (
                              <span style={selectedPill()}>
                                Sélectionnée
                              </span>
                            )}

                            {g.type === "CAUTION" && g.guarantor_act_document_id && (
                              <span style={docReadyPill()}>
                                Acte généré
                              </span>
                            )}
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {!g.selected && (
                              <button onClick={() => selectGuarantee(g.id)} style={btnAction()}>
                                <BadgeCheck size={14} strokeWidth={2.1} />
                                Sélectionner
                              </button>
                            )}
                            <button onClick={() => removeGuarantee(g.id)} style={btnDanger()}>
                              <Trash2 size={14} strokeWidth={2.1} />
                              Supprimer
                            </button>
                          </div>
                        </div>

                        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                          {g.type === "CAUTION" ? (
                            <>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "160px 1fr",
                                  gap: 10,
                                  alignItems: "center",
                                }}
                              >
                                <div style={labelMuted()}>Nom garant</div>
                                <input
                                  value={String(getEditValue(g.id, "guarantor_full_name", g.guarantor_full_name || ""))}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setEditById((prev) => ({
                                      ...prev,
                                      [g.id]: { ...(prev[g.id] || {}), guarantor_full_name: v },
                                    }));
                                    debouncePatch(g.id, { guarantorFullName: v });
                                  }}
                                  style={input()}
                                />
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "160px 1fr",
                                  gap: 10,
                                  alignItems: "center",
                                }}
                              >
                                <div style={labelMuted()}>Email garant</div>
                                <input
                                  value={String(getEditValue(g.id, "guarantor_email", g.guarantor_email || ""))}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setEditById((prev) => ({
                                      ...prev,
                                      [g.id]: { ...(prev[g.id] || {}), guarantor_email: v },
                                    }));
                                    debouncePatch(g.id, { guarantorEmail: v });
                                  }}
                                  style={input()}
                                />
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "160px 1fr",
                                  gap: 10,
                                  alignItems: "center",
                                }}
                              >
                                <div style={labelMuted()}>Téléphone</div>
                                <input
                                  value={String(getEditValue(g.id, "guarantor_phone", g.guarantor_phone || ""))}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setEditById((prev) => ({
                                      ...prev,
                                      [g.id]: { ...(prev[g.id] || {}), guarantor_phone: v },
                                    }));
                                    debouncePatch(g.id, { guarantorPhone: v });
                                  }}
                                  style={input()}
                                />
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "160px 1fr",
                                  gap: 10,
                                  alignItems: "center",
                                }}
                              >
                                <div style={labelMuted()}>Adresse garant</div>
                                <input
                                  value={String(getEditValue(g.id, "guarantor_address", g.guarantor_address || ""))}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setEditById((prev) => ({
                                      ...prev,
                                      [g.id]: { ...(prev[g.id] || {}), guarantor_address: v },
                                    }));
                                    debouncePatch(g.id, { guarantorAddress: v });
                                  }}
                                  style={input()}
                                />
                              </div>


                            </>
                          ) : (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "160px 1fr",
                                gap: 10,
                                alignItems: "center",
                              }}
                            >
                              <div style={labelMuted()}>Référence VISALE</div>
                              <input
                                value={String(getEditValue(g.id, "visale_reference", g.visale_reference || ""))}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setEditById((prev) => ({
                                    ...prev,
                                    [g.id]: { ...(prev[g.id] || {}), visale_reference: v },
                                  }));
                                  debouncePatch(g.id, { visaleReference: v });
                                }}
                                style={input()}
                              />
                            </div>
                          )}

                          <div style={{ color: softText, fontSize: 12, fontWeight: 600 }}>
                            Dernière mise à jour : {String(g.updated_at).slice(0, 10)}
                            {savingById[g.id] && <span style={{ marginLeft: 8 }}>Sauvegarde…</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}

function card() {
  return {
    border: `1px solid ${cardBorder}`,
    borderRadius: 20,
    background: "#fff",
    padding: 18,
    marginTop: 14,
    boxShadow: "0 10px 30px rgba(16,24,40,0.05)",
  } as const;
}

function input() {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    width: "100%",
    boxSizing: "border-box" as const,
    background: "#fff",
    color: title,
  } as const;
}

function labelMuted() {
  return { fontSize: 12, color: muted, fontWeight: 800 } as const;
}

function btnSecondary() {
  return {
    padding: "10px 14px",
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
  } as const;
}

function btnAction() {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "#F8FAFC",
    cursor: "pointer",
    fontWeight: 800,
    minWidth: 160,
    textAlign: "center" as const,
    color: "#243247",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  } as const;
}

function btnPrimary() {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(52,103,235,0.16)",
    background: blue,
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 8px 18px rgba(52,103,235,0.16)",
  } as const;
}

function btnDanger() {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(220,38,38,0.20)",
    background: "#FFF5F5",
    color: "#A12C2C",
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  } as const;
}

function statusPill(status?: string | null) {
  const v = String(status || "").toUpperCase();

  if (v === "SIGNED") {
    return {
      padding: "5px 10px",
      borderRadius: 999,
      border: "1px solid rgba(31,157,97,0.16)",
      background: "#ECF9F1",
      color: "#1F7A4D",
      fontSize: 12,
      fontWeight: 800,
    } as const;
  }

  if (v === "SENT" || v === "READY") {
    return {
      padding: "5px 10px",
      borderRadius: 999,
      border: "1px solid rgba(52,103,235,0.16)",
      background: "#EEF4FF",
      color: blue,
      fontSize: 12,
      fontWeight: 800,
    } as const;
  }

  if (v === "REJECTED" || v === "EXPIRED" || v === "CANCELLED") {
    return {
      padding: "5px 10px",
      borderRadius: 999,
      border: "1px solid rgba(220,38,38,0.20)",
      background: "#FFF5F5",
      color: "#A12C2C",
      fontSize: 12,
      fontWeight: 800,
    } as const;
  }

  return {
    padding: "5px 10px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: "#F8FAFC",
    color: muted,
    fontSize: 12,
    fontWeight: 800,
  } as const;
}

function selectedPill() {
  return {
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid rgba(31,157,97,0.16)",
    background: "#ECF9F1",
    color: "#1F7A4D",
    fontSize: 12,
    fontWeight: 800,
  } as const;
}

function docReadyPill() {
  return {
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid rgba(52,103,235,0.16)",
    background: "#EEF4FF",
    color: blue,
    fontSize: 12,
    fontWeight: 800,
  } as const;
}