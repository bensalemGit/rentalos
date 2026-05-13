"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  BadgeCheck,
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import {
  documentTypeLabel,
  isSignedFinalDocument,
  getDocumentKind,
} from "@app/_lib/documentTypeLabels";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type Doc = {
  id: string;
  type: string;
  filename: string;
  created_at?: string;
  parent_document_id?: string | null;
  signed_final_document_id?: string | null;
};

type GuaranteeItem = {
  id?: string;
  type?: string;
  selected?: boolean;
  lease_tenant_id?: string | null;
  leaseTenantId?: string | null;
  guarantor_act_document_id?: string | null;
  guarantorActDocumentId?: string | null;
  guarantor_full_name?: string | null;
  guarantorFullName?: string | null;
  guarantor_name?: string | null;
  guarantorName?: string | null;
  tenant_name?: string | null;
  tenantName?: string | null;
  role?: string | null;
};

type LeaseTenant = {
  id?: string;
  role?: string | null;
  tenant_name?: string | null;
  tenantName?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  first_name?: string | null;
  firstName?: string | null;
  last_name?: string | null;
  lastName?: string | null;
};

type Phase = "entry" | "exit";

type RowItem = {
  label: string;
  type: string;
  multiple?: boolean;
  regen?: (() => void | Promise<void>) | undefined;
  send?: (() => void | Promise<void>) | undefined;
  sendLabel?: string;
};

export default function LeaseDocumentsPage({ params }: { params: { leaseId: string } }) {
  const leaseId = params.leaseId;

  const [token, setToken] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [hasGuarantor, setHasGuarantor] = useState<boolean | null>(null);

  const [guaranteeItems, setGuaranteeItems] = useState<GuaranteeItem[]>([]);
  const [leaseTenants, setLeaseTenants] = useState<LeaseTenant[]>([]);

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  async function refresh() {
    if (!token) return;
    setError("");
    setStatus("Chargement…");

    try {
      try {
        const guaranteesRes = await fetch(`${API}/guarantees?leaseId=${encodeURIComponent(leaseId)}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
          cache: "no-store",
        });

        const guaranteesJson = await guaranteesRes.json().catch(() => ({}));

        const items = Array.isArray(guaranteesJson?.items) ? guaranteesJson.items : [];
        const tenants = Array.isArray(guaranteesJson?.tenants) ? guaranteesJson.tenants : [];

        setGuaranteeItems(items);
        setLeaseTenants(tenants);

        setHasGuarantor(
          items.some(
            (g: GuaranteeItem) =>
              String(g?.type || "").toUpperCase() === "CAUTION" && g?.selected === true,
          ),
        );
      } catch {
        setGuaranteeItems([]);
        setLeaseTenants([]);
        setHasGuarantor(false);
      }

      const r = await fetch(`${API}/documents?leaseId=${leaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        cache: "no-store",
      });

      const j = await r.json().catch(() => []);
      if (!r.ok) throw new Error(j?.message || JSON.stringify(j));

      setDocs(Array.isArray(j) ? j : []);
      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, leaseId]);

  function latest(type: string) {
    return (
      docs
        .filter((d) => d.type === type && !isSignedFinalDocument(d))
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0] || null
    );
  }

  function allLatestByType(type: string) {
    return docs
      .filter((d) => d.type === type && !isSignedFinalDocument(d))
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }

  const rows = useMemo(
    () => ({
      entryTenant: [
        { label: documentTypeLabel("CONTRAT"), type: "CONTRAT", regen: () => generateContract(true) },
        { label: documentTypeLabel("EDL_ENTREE"), type: "EDL_ENTREE", regen: () => generateEdl("entry", true) },
        { label: documentTypeLabel("INVENTAIRE_ENTREE"), type: "INVENTAIRE_ENTREE", regen: () => generateInventory("entry", true) },
        { label: documentTypeLabel("NOTICE"), type: "NOTICE", regen: undefined },
        {
          label: documentTypeLabel("PACK_FINAL"),
          type: "PACK_FINAL",
          regen: generatePackEntry,
        },
      ] as RowItem[],
      entryGuarantor: [
        {
          label: documentTypeLabel("GUARANTOR_ACT"),
          type: "GUARANTOR_ACT",
          multiple: true,
          regen: undefined,
        },
      ] as RowItem[],
      amendments: [
        {
          label: "Avenant",
          type: "AVENANT",
          multiple: true,
          regen: undefined,
        },
        {
          label: "Avenant IRL",
          type: "AVENANT_IRL",
          multiple: true,
          regen: undefined,
        },
      ] as RowItem[],
      exitTenant: [
        { label: documentTypeLabel("EDL_SORTIE"), type: "EDL_SORTIE", regen: () => generateEdl("exit", true) },
        { label: documentTypeLabel("INVENTAIRE_SORTIE"), type: "INVENTAIRE_SORTIE", regen: () => generateInventory("exit", true) },
        { label: documentTypeLabel("ATTESTATION_SORTIE"), type: "ATTESTATION_SORTIE", regen: generateExitCertificate },
        {
          label: documentTypeLabel("PACK_EDL_INV_SORTIE"),
          type: "PACK_EDL_INV_SORTIE",
          regen: generateExitPack,
        },
      ] as RowItem[],
    }),
    [docs, token],
  );

  async function postJson(path: string, body: any, success: string) {
    setError("");
    setStatus("Traitement en cours…");

    try {
      const r = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || JSON.stringify(j));

      setStatus(success);
      await refresh();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  function generateContract(force = true) {
    return postJson(`/documents/contract${force ? "?force=true" : ""}`, { leaseId }, "Contrat regénéré ✅");
  }

  function generateEdl(phase: Phase, force = true) {
    return postJson(`/documents/edl`, { leaseId, phase, force }, `EDL ${phase === "entry" ? "entrée" : "sortie"} regénéré ✅`);
  }

  function generateInventory(phase: Phase, force = true) {
    return postJson(`/documents/inventory`, { leaseId, phase, force }, `Inventaire ${phase === "entry" ? "entrée" : "sortie"} regénéré ✅`);
  }

  function generatePackEntry() {
    return postJson(`/documents/pack-final`, { leaseId }, "Pack entrée généré ✅");
  }

  function generateExitCertificate() {
    return postJson(`/documents/exit-certificate`, { leaseId }, "Attestation sortie générée ✅");
  }

  function generateExitPack() {
    return postJson(`/documents/exit-pack`, { leaseId }, "Pack sortie généré ✅");
  }

  function generateGuarantorAct(guaranteeId: string) {
    return postJson(
      `/documents/guarantor-act`,
      { leaseId, guaranteeId },
      "Acte de caution regénéré ✅"
    );
  }

  function sendEntryPack() {
    return postJson(`/documents/send-entry-pack`, { leaseId }, "Pack entrée envoyé aux locataires ✅");
  }

  function sendExitDocuments() {
    return postJson(`/documents/send-exit-documents`, { leaseId }, "Documents de sortie envoyés aux locataires ✅");
  }

  function sendGuarantorActs() {
    return postJson(`/documents/send-guarantor-acts`, { leaseId }, "Actes de caution envoyés aux garants ✅");
  }

  async function downloadDoc(doc: Doc) {
    const r = await fetch(`${API}/documents/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });

    if (!r.ok) {
      setError(await r.text());
      return;
    }

    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  function roleLabel(role?: string | null) {
    const v = String(role || "").toLowerCase();
    if (v === "principal") return "locataire principal";
    if (v === "cotenant") return "colocataire";
    if (v === "co_tenant") return "colocataire";
    return v || "";
  }

  function tenantName(t?: LeaseTenant | null) {
    if (!t) return "";

    const direct = t.tenant_name || t.tenantName || t.full_name || t.fullName || "";
    if (direct) return String(direct);

    return `${t.first_name || t.firstName || ""} ${t.last_name || t.lastName || ""}`.trim();
  }

  function guaranteeDocumentId(g: GuaranteeItem) {
    return g.guarantor_act_document_id || g.guarantorActDocumentId || "";
  }

  function guaranteeLeaseTenantId(g: GuaranteeItem) {
    return g.lease_tenant_id || g.leaseTenantId || "";
  }

  function guaranteeForDoc(doc: Doc) {
    return guaranteeItems.find((g) => guaranteeDocumentId(g) === doc.id) || null;
  }

  function guaranteeDisplayLabel(doc: Doc, idx: number) {
    const guarantee = guaranteeForDoc(doc);

    if (!guarantee) return `Acte de caution ${idx + 1}`;

    const guarantorName =
      guarantee.guarantor_full_name ||
      guarantee.guarantorFullName ||
      guarantee.guarantor_name ||
      guarantee.guarantorName ||
      "";

    const tenant =
      leaseTenants.find((t) => t.id === guaranteeLeaseTenantId(guarantee)) || null;

    const tenantLabel =
      tenantName(tenant) ||
      guarantee.tenant_name ||
      guarantee.tenantName ||
      roleLabel(tenant?.role || guarantee.role);

    if (guarantorName && tenantLabel) return `Acte de caution ${idx + 1} — ${guarantorName} pour ${tenantLabel}`;
    if (tenantLabel) return `Acte de caution ${idx + 1} — ${tenantLabel}`;
    if (guarantorName) return `Acte de caution ${idx + 1} — ${guarantorName}`;

    return `Acte de caution ${idx + 1}`;
  }

  function availableCount(items: RowItem[]) {
    return items.filter((item) => {
      if (item.multiple) return allLatestByType(item.type).length > 0;
      return !!latest(item.type);
    }).length;
  }

  function DocumentLine({ item, doc, idx }: { item: RowItem; doc: Doc | null; idx?: number }) {
    const isCaution = getDocumentKind(item.type) === "GUARANTOR_ACT";
    const noGuarantor = isCaution && hasGuarantor === false;
    const signedId = doc?.signed_final_document_id;
    const guarantee = doc && isCaution ? guaranteeForDoc(doc) : null;

    const title =
      doc && isCaution && idx != null
        ? guaranteeDisplayLabel(doc, idx)
        : idx != null
          ? `${item.label} ${idx + 1}`
          : item.label;

    return (
      <div className="document-row" style={row}>
        <div style={docLeft}>
          <div style={docIconWrap(doc ? "#EAF7EF" : "#FFF7ED")}>
            {doc ? <CheckCircle2 size={17} color="#16803C" /> : <FileText size={17} color="#B45309" />}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={docTitle}>{title}</div>
            <div style={docSub}>
              {noGuarantor ? "Aucune garantie prévue sur ce bail" : doc ? doc.filename : "Non généré"}
            </div>
          </div>
        </div>

        <div className="document-actions" style={actions}>
          <span style={noGuarantor ? neutralPill : doc ? okPill : emptyPill}>
            {noGuarantor ? "Aucune garantie" : doc ? "Disponible" : "Manquant"}
          </span>

          {doc && (
            <button title="Télécharger" aria-label="Télécharger" style={iconBtn} onClick={() => downloadDoc(doc)}>
              <Download size={15} />
            </button>
          )}

          {signedId && doc && (
            <button
              title="Télécharger le PDF signé"
              aria-label="Télécharger le PDF signé"
              style={signedIconBtn}
              onClick={() =>
                downloadDoc({
                  ...doc,
                  id: signedId,
                  filename: `${item.label}_SIGNE.pdf`,
                })
              }
            >
              <BadgeCheck size={15} />
            </button>
          )}

          {guarantee?.id && (
            <button
              title="Regénérer l’acte de caution"
              aria-label="Regénérer l’acte de caution"
              style={regenIconBtn}
              onClick={() => generateGuarantorAct(guarantee.id!)}
            >
              <RotateCcw size={15} />
            </button>
          )}

          {item.regen && !isCaution && (
            <button title="Regénérer" aria-label="Regénérer" style={regenIconBtn} onClick={item.regen}>
              <RotateCcw size={15} />
            </button>
          )}
        </div>
      </div>
    );
  }

  function LibraryPanel({
    tone,
    icon,
    title,
    subtitle,
    items,
    headerAction,
  }: {
    tone: "entry" | "exit" | "guarantor";
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    items: RowItem[];
    headerAction?: React.ReactNode;
  }) {
    const isGuarantorPanel = tone === "guarantor";
    const done = isGuarantorPanel ? guarantorActsCount : availableCount(items);
    const total = isGuarantorPanel ? guarantorActsCount : items.length;

    return (
      <section style={panel}>
        <div style={panelAccent(tone)} />

        <div style={panelHeader}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0 }}>
            <div style={panelIcon(tone)}>{icon}</div>
            <div style={{ minWidth: 0 }}>
              <h2 style={h2}>{title}</h2>
              <p style={muted}>{subtitle}</p>
            </div>
          </div>

          <div style={panelRight}>
            <span style={miniCount}>{done}/{total}</span>
            {headerAction}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {items.flatMap((item) => {
            const itemDocs = item.multiple
              ? allLatestByType(item.type)
              : ([latest(item.type)].filter(Boolean) as Doc[]);

            if (item.multiple && itemDocs.length > 0) {
              return itemDocs.map((doc, idx) => (
                <DocumentLine key={doc.id} item={item} doc={doc} idx={idx} />
              ));
            }

            return [<DocumentLine key={item.type} item={item} doc={itemDocs[0] || null} />];
          })}
        </div>
      </section>
    );
  }

  const guarantorActsCount = allLatestByType("GUARANTOR_ACT").length;
  const entryTenantDocsCount = rows.entryTenant.length;
  const entryTenantAvailableCount = rows.entryTenant.filter((item) => {
    if (item.multiple) return allLatestByType(item.type).length > 0;
    return !!latest(item.type);
  }).length;

  const guarantorDocsCount = allLatestByType("GUARANTOR_ACT").length;

  const exitTenantDocsCount = rows.exitTenant.length;
  const exitTenantAvailableCount = rows.exitTenant.filter((item) => {
    if (item.multiple) return allLatestByType(item.type).length > 0;
    return !!latest(item.type);
  }).length;

  const entryTotalAvailableCount = entryTenantAvailableCount + guarantorDocsCount;
  const entryTotalExpectedCount =
    entryTenantDocsCount + (hasGuarantor === true ? guarantorDocsCount : 0);

  return (
    <main style={page}>
      <header style={hero}>
        <div style={heroTop}>
          <div>
            <div style={eyebrow}>Bibliothèque documentaire</div>
            <h1 style={h1}>Documents du bail</h1>
            <p style={heroMuted}>
              Bail {leaseId.slice(0, 8)}… · documents d’entrée, de sortie, packs et PDFs signés
            </p>
          </div>

          <div style={topActions}>
            <button onClick={refresh} style={secondaryBtn}>
              <RefreshCw size={15} /> Rafraîchir
            </button>

            <Link href={`/dashboard/leases/${leaseId}/edit`}>
              <button style={secondaryBtn}>Retour au bail</button>
            </Link>

            <Link href={`/dashboard/leases`}>
              <button style={secondaryBtn}>Tous les baux</button>
            </Link>
          </div>
        </div>

        <div style={heroStats}>
          <div style={statCard}>
            <FolderOpen size={18} color="#2F63E0" />
            <div>
              <div style={statValue}>{entryTotalAvailableCount}/{entryTotalExpectedCount}</div>
              <div style={statLabel}>documents entrée</div>
            </div>
          </div>

          <div style={statCard}>
            <Archive size={18} color="#7C3AED" />
            <div>
              <div style={statValue}>{exitTenantAvailableCount}/{exitTenantDocsCount}</div>
              <div style={statLabel}>documents sortie</div>
            </div>
          </div>

          <div style={statCard}>
            <ShieldCheck size={18} color="#027A48" />
            <div>
              <div style={statValue}>{hasGuarantor ? guarantorActsCount : "—"}</div>
              <div style={statLabel}>actes garants</div>
            </div>
          </div>
        </div>

        <div className="hero-send-row" style={heroSendRow}>
          <div style={heroSendLeft}>
            {latest("PACK_FINAL") && (
              <button style={heroSendBtn} onClick={sendEntryPack}>
                <Send size={16} /> Envoyer pack entrée
              </button>
            )}

            {hasGuarantor === true && guarantorActsCount > 0 && (
              <button style={heroSendBtn} onClick={sendGuarantorActs}>
                <Send size={16} /> Envoyer actes aux garants
              </button>
            )}
          </div>

          <div className="hero-send-right" style={heroSendRight}>
            {latest("PACK_EDL_INV_SORTIE") && (
              <button style={heroSendBtnPurple} onClick={sendExitDocuments}>
                <Send size={16} /> Envoyer documents de sortie
              </button>
            )}
          </div>
        </div>


      </header>

      {status && <div style={successBox}>{status}</div>}
      {error && <div style={errorBox}>{error}</div>}

      <div style={grid}>
        <div style={{ display: "grid", gap: 16 }}>
          <LibraryPanel
            tone="entry"
            icon={<FolderOpen size={20} />}
            title="Entrée locataires"
            subtitle="Contrat, EDL entrée, inventaire, notice et pack final d’entrée."
            items={rows.entryTenant}
          />

          <LibraryPanel
            tone="entry"
            icon={<FileText size={20} />}
            title="Avenants"
            subtitle="Avenants du bail, prêts à télécharger et signer."
            items={rows.amendments}
          />

          {hasGuarantor === true && (
            <LibraryPanel
              tone="guarantor"
              icon={<ShieldCheck size={20} />}
              title="Entrée garants"
              subtitle="Actes de caution rattachés au bail, prêts à transmettre aux garants."
              items={rows.entryGuarantor}
            />
          )}
        </div>

        <LibraryPanel
          tone="exit"
          icon={<Archive size={20} />}
          title="Sortie locataires"
          subtitle="EDL sortie, inventaire sortie, attestation et pack de sortie."
          items={rows.exitTenant}
        />
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 760px) {
              .document-row {
                grid-template-columns: 1fr !important;
                align-items: stretch !important;
              }

              .document-actions {
                justify-content: stretch !important;
                flex-wrap: wrap !important;
              }

              .document-actions button,
              .document-actions span {
                flex: 1 1 auto;
                justify-content: center;
              }

              .hero-send-row {
                grid-template-columns: 1fr !important;
              }

              .hero-send-right {
                justify-content: stretch !important;
              }
              
              .hero-send-row button {
                width: 100%;
              }
            }
          `,
        }}
      />
    </main>
  );
}

const page: React.CSSProperties = {
  maxWidth: 1220,
  margin: "0 auto",
  padding: 20,
  display: "grid",
  gap: 16,
  fontFamily: "Inter, ui-sans-serif, system-ui",
  background:
    "radial-gradient(circle at 20% 0%, rgba(47,99,224,0.10), transparent 34%), linear-gradient(180deg,#F7F9FD 0%,#F3F6FB 100%)",
  minHeight: "100vh",
};

const hero: React.CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(255,255,255,0.78))",
  border: "1px solid rgba(27,39,64,0.08)",
  borderRadius: 28,
  padding: 22,
  display: "grid",
  gap: 18,
  boxShadow: "0 24px 80px rgba(31,42,60,0.08)",
};

const heroTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const heroStats: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 10,
};

const heroSendRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 16,
  alignItems: "center",
};

const heroSendLeft: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const heroSendRight: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const heroSendBtn: React.CSSProperties = {
  border: "1px solid rgba(2,122,72,0.18)",
  background: "linear-gradient(180deg,#ECFDF3 0%,#DFF8EA 100%)",
  color: "#027A48",
  borderRadius: 16,
  padding: "13px 14px",
  fontWeight: 950,
  cursor: "pointer",
  display: "inline-flex",
  gap: 9,
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 10px 24px rgba(2,122,72,0.10)",
};

const heroSendBtnPurple: React.CSSProperties = {
  ...heroSendBtn,
  border: "1px solid rgba(124,58,237,0.18)",
  background: "linear-gradient(180deg,#F4F0FF 0%,#EEE7FF 100%)",
  color: "#6D28D9",
  boxShadow: "0 10px 24px rgba(124,58,237,0.10)",
};

const statCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.72)",
  border: "1px solid rgba(27,39,64,0.08)",
  borderRadius: 18,
  padding: 12,
  display: "flex",
  gap: 10,
  alignItems: "center",
};

const statValue: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 950,
  color: "#1F2A3C",
  lineHeight: 1,
};

const statLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#7C8AA5",
  fontWeight: 800,
  marginTop: 3,
};

const eyebrow = {
  fontSize: 12,
  fontWeight: 950,
  color: "#2F63E0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.09em",
};

const h1 = {
  margin: "7px 0 4px",
  fontSize: 31,
  letterSpacing: "-0.05em",
  color: "#182235",
};

const h2 = {
  margin: 0,
  fontSize: 18,
  letterSpacing: "-0.03em",
  color: "#1F2A3C",
};

const muted = {
  margin: 0,
  color: "#7C8AA5",
  fontSize: 13.5,
  lineHeight: 1.5,
};

const heroMuted = {
  ...muted,
  maxWidth: 620,
};

const topActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 16,
};
const panel: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(27,39,64,0.08)",
  borderRadius: 26,
  padding: 16,
  display: "grid",
  gap: 14,
  boxShadow: "0 14px 45px rgba(31,42,60,0.06)",
};

const panelAccent = (tone: "entry" | "exit" | "guarantor"): React.CSSProperties => ({
  position: "absolute",
  inset: "0 0 auto 0",
  height: 4,
  background:
    tone === "entry"
      ? "linear-gradient(90deg,#2F63E0,#7EA6FF)"
      : tone === "exit"
        ? "linear-gradient(90deg,#7C3AED,#C4B5FD)"
        : "linear-gradient(90deg,#027A48,#86EFAC)",
});

const panelHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const panelRight: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap",
};

const panelIcon = (tone: "entry" | "exit" | "guarantor"): React.CSSProperties => ({
  width: 42,
  height: 42,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  color: tone === "entry" ? "#2F63E0" : tone === "exit" ? "#7C3AED" : "#027A48",
  background:
    tone === "entry"
      ? "#EEF4FF"
      : tone === "exit"
        ? "#F4F0FF"
        : "#ECFDF3",
});

const miniCount: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#F6F8FC",
  border: "1px solid rgba(27,39,64,0.08)",
  color: "#42526B",
  fontSize: 12,
  fontWeight: 950,
};

const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 8,
  alignItems: "center",
  border: "1px solid rgba(27,39,64,0.08)",
  borderRadius: 16,
  padding: "9px 10px",
  background: "linear-gradient(180deg,#FFFFFF 0%,#FBFCFE 100%)",
  minHeight: 58,
  overflow: "hidden",
};

const docLeft: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  gap: 11,
  alignItems: "center",
};

const docIconWrap = (background: string): React.CSSProperties => ({
  width: 34,
  height: 34,
  borderRadius: 13,
  background,
  display: "grid",
  placeItems: "center",
  flex: "0 0 auto",
});

const docTitle = {
  fontWeight: 950,
  color: "#243247",
  fontSize: 14,
};

const docSub: React.CSSProperties = {
  color: "#7C8AA5",
  fontSize: 12,
  marginTop: 3,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "100%",
};

const actions: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 6,
  flexWrap: "nowrap",
  minWidth: 0,
};

const secondaryBtn: React.CSSProperties = {
  border: "1px solid rgba(27,39,64,0.10)",
  background: "#fff",
  borderRadius: 13,
  padding: "10px 12px",
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  gap: 8,
  alignItems: "center",
  boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
};

const linkBtn: React.CSSProperties = {
  ...secondaryBtn,
  padding: "8px 10px",
  fontSize: 12,
  color: "#2F63E0",
  whiteSpace: "nowrap",
};

const iconBtn: React.CSSProperties = {
  ...secondaryBtn,
  width: 34,
  height: 34,
  padding: 0,
  justifyContent: "center",
  color: "#2F63E0",
  flex: "0 0 auto",
};

const signedIconBtn: React.CSSProperties = {
  ...iconBtn,
  color: "#027A48",
  background: "#ECFDF3",
};

const regenIconBtn: React.CSSProperties = {
  ...iconBtn,
  background: "#EEF4FF",
  color: "#2F63E0",
};

const regenBtn: React.CSSProperties = {
  ...secondaryBtn,
  padding: "7px 9px",
  fontSize: 11.5,
  background: "#EEF4FF",
  color: "#2F63E0",
  whiteSpace: "nowrap",
};

const sendBtn: React.CSSProperties = {
  ...secondaryBtn,
  padding: "8px 10px",
  fontSize: 11.5,
  background: "#ECFDF3",
  color: "#027A48",
  whiteSpace: "nowrap",
  flex: "0 0 auto",
};

const okPill: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(22,163,74,0.10)",
  color: "#14532d",
  fontSize: 11,
  fontWeight: 950,
};

const emptyPill: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(245,158,11,0.12)",
  color: "#78350f",
  fontSize: 11,
  fontWeight: 950,
};

const neutralPill: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(100,116,139,0.10)",
  color: "#475569",
  fontSize: 11,
  fontWeight: 950,
};

const successBox: React.CSSProperties = {
  padding: 13,
  borderRadius: 16,
  background: "#F3FAF5",
  color: "#166534",
  fontWeight: 900,
  border: "1px solid rgba(22,101,52,0.10)",
};

const errorBox: React.CSSProperties = {
  padding: 13,
  borderRadius: 16,
  background: "rgba(239,68,68,0.06)",
  color: "#b42318",
  fontWeight: 900,
  border: "1px solid rgba(180,35,24,0.10)",
};