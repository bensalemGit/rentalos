"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { extractLeaseBundle } from "../../_lib/extractLease";
import type { SignatureStatusPayload } from "../../_lib/signatureStatus.types";
import { SignableCard } from "./_components/SignableCard";
import { mapSignatureData } from "./_lib/mapSignatureData";
import { SignatureHero } from "./_components/SignatureHero";
import { SignerSection } from "./_components/SignerSection";
import type { SignerTask } from "./_types/signature-center.types";
import { DocumentsSection } from "./_components/DocumentsSection";
import { HistorySection, type HistoryItem } from "./_components/HistorySection";
import { SIGN_UI, PremiumButton } from "./_components/signature-ui";


const brandBlue = "#4D7DE0";
const brandBlueHover = "#4474D7";
const brandBlueBorder = "#3567C8";

const textStrong = "#1D273B";
const textSoft = "#667085";
const textMuted = "#98A2B3";

const borderSoft = "#D9E2EC";
const borderSoftStrong = "#C8D4E3";
const borderUltraSoft = "#E8EEF5";

const bgSoft = "#F7F9FC";
const panelBg = "#FBFCFE";

const successBg = "#EAF6EE";
const successBorder = "#CEE6D5";
const successText = "#4C9A70";

const warningBg = "#FBF1E4";
const warningBorder = "#EBCFA8";
const warningText = "#B7791F";

const neutralBg = "#F7F8FB";
const neutralBorder = "#D8E1EC";
const neutralText = "#66758F";

const dangerBg = "#FCEAEA";
const dangerBorder = "#F2CFCF";
const dangerText = "#C35B5B";

const UI_FONT =
  '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const ui = {
  card: {
    background: "linear-gradient(180deg, #FFFFFF 0%, #FCFDFF 100%)",
    border: `1px solid ${borderSoft}`,
    borderRadius: 22,
    boxShadow: "0 4px 14px rgba(31,41,64,0.03), 0 1px 3px rgba(31,41,64,0.012)",
    transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
  } as React.CSSProperties,
  hTitle: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
    letterSpacing: -0.03,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } as React.CSSProperties,
  sub: {
    fontSize: 13.5,
    color: textSoft,
    marginTop: 4,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } as React.CSSProperties,
};


const heroHeaderButtonStyle: React.CSSProperties = {
  appearance: "none",
  border: `1px solid ${SIGN_UI.colors.cardBorder}`,
  background: "#FFFFFF",
  borderRadius: 14,
  height: 40,
  padding: "0 16px",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
  color: SIGN_UI.colors.textStrong,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  boxShadow: SIGN_UI.shadows.soft,
  fontFamily: UI_FONT,
};

function Badge({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral" | "primary";
  children: React.ReactNode;
}) {
  const map: Record<string, React.CSSProperties> = {
    success: {
      background: "#EAF7F1",
      color: "#147A55",
      border: "none",
    },
    warning: {
      background: "#FBF2E6",
      color: "#B7791F",
      border: "none",
    },
    danger: {
      background: "#FCECEC",
      color: "#C45A5A",
      border: "none",
    },
    neutral: {
      background: "#F3F6FA",
      color: "#66758F",
      border: "none",
    },
    primary: {
      background: "#EEF4FF",
      color: "#4D6FD6",
      border: "none",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 34,
        padding: "0 14px",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 12.5,
        letterSpacing: -0.01,
        whiteSpace: "nowrap",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.34)",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        ...map[tone],
      }}
    >
      {children}
    </span>
  );
}

const Btn = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant: "primary" | "secondary" | "ghost";
  }
>(function Btn({ variant, children, ...rest }, ref) {
  const base: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 15,
    fontWeight: 700,
    cursor: "pointer",
    border: `1px solid ${borderSoft}`,
    transition: "background 140ms ease, box-shadow 140ms ease, border-color 140ms ease, transform 140ms ease",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  const styles: any = {
    primary: {
      ...base,
      background: `linear-gradient(180deg, ${brandBlue} 0%, ${brandBlueBorder} 100%)`,
      border: `1px solid ${brandBlueBorder}`,
      color: "white",
      boxShadow: "0 10px 22px rgba(61,115,229,0.22), inset 0 1px 0 rgba(255,255,255,0.14)",
    },
    secondary: {
      ...base,
      background: "#ffffff",
      color: "#243041",
      border: `1px solid ${borderSoftStrong}`,
      boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
    },
    ghost: {
      ...base,
      background: "transparent",
      color: "#356AE6",
      border: "1px solid transparent",
    },
  };

  return (
    <button ref={ref} {...rest} style={{ ...(styles[variant] || styles.secondary), ...(rest.style || {}) }}>
      {children}
    </button>
  );
});


function toneFromStatus(s?: string) {
  const v = String(s || "").toUpperCase();
  if (v.includes("SIGNED")) return "success";
  if (v.includes("IN_PROGRESS")) return "warning";
  if (v.includes("GENERATED")) return "primary";
  if (v.includes("NOT") || v.includes("DRAFT")) return "neutral";
  if (v.includes("MISSING") || v.includes("ERROR")) return "danger";
  return "neutral";
}

function isMissingStatus(s?: string) {
  const v = String(s || "").toUpperCase();
  return v === "NOT_GENERATED" || v === "DRAFT" || v === "MISSING" || v === "NOT_SENT" || v === "NONE";
}

function humanDocStatus(s?: string) {
  const v = String(s || "").toUpperCase();

  if (v === "NOT_GENERATED") return "Non généré";
  if (v === "DRAFT") return "Brouillon";
  if (v === "MISSING") return "Manquant";
  if (v === "NOT_SENT") return "Non envoyé";
  if (v === "NONE") return "—";
  if (v.includes("SIGNED")) return "Signé";
  if (v.includes("IN_PROGRESS")) return "En cours";
  if (v.includes("GENERATED")) return "Généré";

  return s || "—";
}

function countMissingFromSignatureStatus(sigStatus: any) {
  if (!sigStatus) return { missing: 0, label: "—", firstAnchor: "contract" as const };

  const missing: { anchor: "contract" | "tenants" | "guarantees" | "edl-inv"; msg: string }[] = [];

  // Contrat
  const contractStatus = String(sigStatus?.contract?.status || "").toUpperCase();
  if (contractStatus !== "SIGNED") {
    missing.push({ anchor: "contract", msg: "Contrat à finaliser" });
  }

  // Locataires
  const tenants = sigStatus?.contract?.tenants || [];
  const tenantsUnsigned = Array.isArray(tenants)
    ? tenants.filter((t: any) => String(t.signatureStatus || "").toUpperCase() !== "SIGNED")
    : [];
  if (tenantsUnsigned.length > 0) {
    missing.push({ anchor: "tenants", msg: `${tenantsUnsigned.length} signature(s) locataire manquante(s)` });
  }

  // Garanties
  const guarantees = Array.isArray(sigStatus?.guarantees) ? sigStatus.guarantees : [];
  const guaranteesMissing = guarantees.filter((g: any) => String(g.signatureStatus || "").toUpperCase() !== "SIGNED");
  if (guaranteesMissing.length > 0) {
    missing.push({ anchor: "guarantees", msg: `${guaranteesMissing.length} garantie(s) non signée(s)` });
  }

  // EDL/Inv/Packs
  const edlDocs = [sigStatus?.edl?.entry, sigStatus?.edl?.exit].filter(Boolean);
  const invDocs = [sigStatus?.inventory?.entry, sigStatus?.inventory?.exit].filter(Boolean);
  const packEdlInvDocs = [(sigStatus as any)?.packEdlInv?.entry, (sigStatus as any)?.packEdlInv?.exit].filter(Boolean);

  const edlInvMissing = [...edlDocs, ...invDocs, ...packEdlInvDocs].filter(
    (d: any) => !d?.documentId || isMissingStatus(d?.status)
  );
  if (edlInvMissing.length > 0) {
    missing.push({ anchor: "edl-inv", msg: `${edlInvMissing.length} doc(s) EDL/Inventaire à faire` });
  }

  const missingCount = missing.length;
  const firstAnchor = missingCount > 0 ? missing[0].anchor : ("contract" as const);


  const label =
    missingCount === 0 ? "Tout est prêt" : missingCount === 1 ? missing[0].msg : `${missingCount} actions à faire`;

  return { missing: missingCount, label, firstAnchor };
}


const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type Doc = {
  id: string;
  type: string;
  filename: string;
  created_at: string;
  parent_document_id?: string | null;
  signed_final_document_id?: string | null; // ✅ add
};

type LeaseTenant = {
  tenant_id?: string; // some endpoints may return tenant_id
  id?: string; // or id
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  role?: "principal" | "cotenant" | string;
};

type LandlordSignable = {
  key: string; // "contract" | "guarantee:<id>"
  label: string;
  documentId: string;
};

type GuarantorSignable = {
  key: string;               // guaranteeId
  label: string;             // "Jean Dupont (xxxxxx)"
  guaranteeId: string;
  documentId: string | null; // actDocumentId (peut être null)
  defaultName: string;       // guarantorFullName
  hasAct: boolean;           // actDocumentId != null
};

type HistoryDocument = {
  id: string;
  label: string;
  filename?: string | null;
  signedFinalDocumentId?: string | null;
};


function buildHistoryItems(tasks: SignerTask[], docs: HistoryDocument[]): HistoryItem[] {
  const items: Array<HistoryItem & { sortKey: number }> = [];

  tasks.forEach((task) => {
    if (task.hasActiveLink && task.activeLinkCreatedAt) {
      const time = new Date(task.activeLinkCreatedAt).getTime();

      items.push({
        id: `link:${task.id}`,
        dateLabel: new Date(task.activeLinkCreatedAt).toLocaleDateString(),
        title: `Lien envoyé à ${task.displayName}`,
        subtitle: `${task.documentLabel} • ${task.roleLabel}`,
        sortKey: Number.isNaN(time) ? 0 : time,
      });
    }

    if (task.status === "SIGNED") {
      items.push({
        id: `signed:${task.id}`,
        dateLabel: "Récent",
        title: `${task.displayName} a signé`,
        subtitle: `${task.documentLabel} • ${task.roleLabel}`,
        sortKey: 8_000_000_000_000,
      });
    }

    if (task.requiresPreparation) {
      items.push({
        id: `prepare:${task.id}`,
        dateLabel: "À faire",
        title:
          task.kind === "GUARANTOR"
            ? `Acte à préparer pour ${task.displayName}`
            : `Contrat à préparer pour ${task.displayName}`,
        subtitle: task.preparationLabel || undefined,
        sortKey: 9_000_000_000_000,
      });
    }
  });

  docs.forEach((doc) => {
    if (doc.signedFinalDocumentId) {
      items.push({
        id: `doc:${doc.id}`,
        dateLabel: "Disponible",
        title: `${doc.label} signé disponible`,
        subtitle: doc.filename || undefined,
        sortKey: 7_000_000_000_000,
      });
    }
  });

  return items
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 8)
    .map(({ sortKey, ...item }) => item);
}

export default function SignPage({ params }: { params: { leaseId: string } }) {
  const leaseId = params.leaseId;
  const [token, setToken] = useState("");

  const [docs, setDocs] = useState<Doc[]>([]);
  const [contractDoc, setContractDoc] = useState<Doc | null>(null);
  const [finalSignedDoc, setFinalSignedDoc] = useState<Doc | null>(null);

  // notice + pack
  const [noticeDoc, setNoticeDoc] = useState<Doc | null>(null);
  const [packDoc, setPackDoc] = useState<Doc | null>(null);

  // ✅ NEW: guarantor act doc + signature
  const [guarantorName, setGuarantorName] = useState("Garant");

  // ✅ NEW: pack final v2
  const [packFinalV2Doc, setPackFinalV2Doc] = useState<Doc | null>(null);

  // lease kind
  const [leaseKind, setLeaseKind] = useState("");

  // ✅ NEW: tenants list for multi-tenant signature
  const [tenants, setTenants] = useState<LeaseTenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // ✅ NEW: panneau signature unique (droite)
  const [role, setRole] = useState<"LOCATAIRE" | "BAILLEUR" | "GARANT">("LOCATAIRE");


  const [showLegacyPanelForm, setShowLegacyPanelForm] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(true);

  // canvas unique
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const signatureDirty = useRef(false);
  const signaturePanelRef = useRef<HTMLDivElement | null>(null);


  const [tenantName, setTenantName] = useState("Locataire");
  const [landlordName, setLandlordName] = useState("Bailleur");

  const [sigStatus, setSigStatus] = useState<SignatureStatusPayload | null>(null);
  // ✅ Local override: permet d'utiliser immédiatement l'id d'acte renvoyé par /documents/guarantor-act
  const [guaranteeActOverride, setGuaranteeActOverride] = useState<Record<string, string>>({});
  const [loadingSigStatus, setLoadingSigStatus] = useState(false);
  const [sigStatusError, setSigStatusError] = useState<string | null>(null);

  const [pendingModeSwitchTask, setPendingModeSwitchTask] = useState<SignerTask | null>(null);

  const [sessionDraft, setSessionDraft] = useState({
    open: false,
    signerTaskId: null as string | null,
    signerKind: null as "TENANT" | "GUARANTOR" | "LANDLORD" | null,
    signerName: "",
    roleLabel: "",
    documentId: null as string | null,
    documentLabel: "",
    tenantId: undefined as string | undefined,
    guaranteeId: undefined as string | undefined,
  });


  const blue = "#1d4ed8";
  const border = "#e5e7eb";
  const muted = "#6b7280";

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);


function setupCanvasHiDpi(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // Taille CSS visible
  const cssW = Math.max(1, Math.floor(rect.width));
  const cssH = Math.max(1, Math.floor(rect.height));

  // Taille interne réelle (pixels)
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Toutes les coords qu'on va utiliser seront en pixels CSS
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#111";
}

function getCanvasPoint(canvas: HTMLCanvasElement, e: any) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  return { x, y }; // coords en pixels CSS
}

useEffect(() => {
  const c = canvasRef.current;
  if (!c) return;

  const apply = () => setupCanvasHiDpi(c);
  apply();

  const onResize = () => apply();
  window.addEventListener("resize", onResize);

  return () => window.removeEventListener("resize", onResize);
}, []);


useEffect(() => {
  if (!sessionDraft.open) return;
  if (!signaturePanelRef.current) return;

  if (isWideScreen) return;

  const id = window.setTimeout(() => {
    signaturePanelRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 80);

  return () => window.clearTimeout(id);
}, [sessionDraft.open, sessionDraft.signerTaskId, isWideScreen]);


useEffect(() => {
  const apply = () => {
    setIsWideScreen(window.innerWidth >= 1100);
  };

  apply();
  window.addEventListener("resize", apply);

  return () => window.removeEventListener("resize", apply);
}, []);

  function normalizeTenantId(t: LeaseTenant): string {
    return String(t.tenant_id || t.id || "").trim();
  }

  function normalizeTenantName(t: LeaseTenant): string {
    return String(t.full_name || "").trim() || "Locataire";
  }

  async function loadLeaseBundle() {
    try {
      const r = await fetch(`${API}/leases/${leaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      
      
      
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return;

      const { lease, tenants } = extractLeaseBundle(j);
      
      // ✅ NEW: guarantor name (optional)
      const gName =
        String((lease as any)?.guarantor_full_name || (lease as any)?.guarantorFullName || "").trim();
      if (gName) setGuarantorName(gName);

      setLeaseKind(String(lease?.kind || ""));

      const tArr: LeaseTenant[] = Array.isArray(tenants) ? (tenants as LeaseTenant[]) : [];
      setTenants(tArr);

      
      
      
      // default selection = principal tenant if exists, otherwise first
      const principal =
        tArr.find((x) => String(x.role || "").toLowerCase() === "principal") ||
        tArr[0];
      const principalId = principal ? normalizeTenantId(principal) : "";
      if (principalId) setSelectedTenantId(principalId);

      // default tenantName from selected
      const principalName = principal ? normalizeTenantName(principal) : "Locataire";
      setTenantName(principalName);
    } catch {
      // ignore
    }
  }

  async function loadDocs() {
    setError("");
    setStatus("Chargement…");

    try {
      // load lease bundle (kind + tenants)
      await loadLeaseBundle();

      const r = await fetch(`${API}/documents?leaseId=${leaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const j = await r.json();
      const arr: Doc[] = Array.isArray(j) ? j : [];
      setDocs(arr);

      const contract =
        arr
          .filter((d: any) => d.type === "CONTRAT" && !d.parent_document_id)
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] ||
        null;
      setContractDoc(contract);

      // ✅ SIGNED_FINAL (contrat) : d'abord par parent_document_id, sinon fallback
      const signedByParent =
        contract?.id
          ? arr
              .filter(
                (d: any) =>
                  (d.filename || "").includes("SIGNED_FINAL") && d.parent_document_id === contract.id
              )
              .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null
          : null;

      const signedFallback =
        signedByParent
          ? null
          : arr
              .filter(
                (d: any) =>
                  (d.filename || "").includes("SIGNED_FINAL") &&
                  (d.type === "CONTRAT" || String(d.filename || "").toUpperCase().includes("CONTRAT"))
              )
              .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;

      const signed = signedByParent || signedFallback;
      setFinalSignedDoc(signed);

      const notice =
        arr
          .filter((d: any) => d.type === "NOTICE")
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] ||
        null;
      setNoticeDoc(notice);

      const pack =
        arr
          .filter((d: any) => d.type === "PACK")
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] ||
        null;
      setPackDoc(pack);

      // ✅ PACK_FINAL V2 (signé) : doc type PACK_FINAL dont filename contient PACK_FINAL_V2
      const packFinalV2 =
        arr
          .filter((d: any) => d.type === "PACK_FINAL" && String(d.filename || "").includes("PACK_FINAL_V2"))
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0] ||
        null;

      setPackFinalV2Doc(packFinalV2);

      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    if (!token) return;
    if (!leaseId) return;

    loadDocs(); // gère déjà ses erreurs
    fetchSignatureStatus(leaseId).catch(() => {}); // safety
  }, [token, leaseId]);


  async function generateContract() {
    setError("");
    setStatus("Génération du contrat…");
    try {
      const r = await fetch(`${API}/documents/contract`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Contrat généré ✅");
      await loadDocs();
      await fetchSignatureStatus(leaseId);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function generateNotice() {
    setError("");
    setStatus("Génération de la notice…");
    try {
      const r = await fetch(`${API}/documents/notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Notice générée ✅");
      await loadDocs();
      await fetchSignatureStatus(leaseId);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function generateEdl(phase: "entry" | "exit") {
    setError("");
    setStatus(`Génération EDL ${phase === "entry" ? "entrée" : "sortie"}…`);
    try {
      const r = await fetch(`${API}/documents/edl`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId, phase }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("EDL généré ✅");
      await loadDocs();
      await fetchSignatureStatus(leaseId);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function generateInventory(phase: "entry" | "exit") {
    setError("");
    setStatus(`Génération inventaire ${phase === "entry" ? "entrée" : "sortie"}…`);
    try {
      const r = await fetch(`${API}/documents/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId, phase }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Inventaire généré ✅");
      await loadDocs();
      await fetchSignatureStatus(leaseId);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function generatePackEdlInv(phase: "entry" | "exit") {
    setError("");
    setStatus(`Génération du pack EDL+Inventaire (${phase === "entry" ? "entrée" : "sortie"})…`);
    try {
      const r = await fetch(`${API}/documents/pack-edl-inv`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId, phase }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Pack EDL+Inventaire généré ✅");
      await loadDocs();
      await fetchSignatureStatus(leaseId);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }


  async function generateGuarantorActFor(guaranteeId: string) {
    setError("");
    setStatus("Génération de l'acte de cautionnement…");

    try {
      const r = await fetch(`${API}/documents/guarantor-act`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId, guaranteeId }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }

      const newDocId = String(j?.document?.id || "").trim();
      if (!newDocId) {
        setStatus("");
        setError("Acte généré mais document.id est manquant dans la réponse API.");
        return;
      }

      // ✅ override local: l'UI doit débloquer la signature même si /signature-status est en retard
      setGuaranteeActOverride((prev) => ({ ...prev, [guaranteeId]: newDocId }));

      // ✅ optimistic update: on met à jour sigStatus tout de suite
      setSigStatus((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          guarantees: prev.guarantees.map((g) =>
            g.guaranteeId === guaranteeId ? { ...g, actDocumentId: newDocId } : g
          ),
        };
      });

      // ✅ refresh docs (pour activer Télécharger acte etc.)
      await loadDocs();

      // ⚠️ IMPORTANT: signature-status peut être "stale" => ne doit PAS casser l'optimistic update
      // Donc on le fait en best-effort, sans écraser si l'API renvoie encore actDocumentId=null
      fetchSignatureStatus(leaseId).catch(() => {});

      setStatus("Acte généré ✅");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function generatePack() {
    setError("");
    setStatus("Génération du pack PDF…");
    try {
      const r = await fetch(`${API}/documents/pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("Pack généré ✅");
      await loadDocs();
      await fetchSignatureStatus(leaseId);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function generatePackFinalV2() {
    setError("");
    setStatus("Génération du PACK_FINAL_V2…");
    try {
      const r = await fetch(`${API}/documents/pack-final`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }
      setStatus("PACK_FINAL_V2 généré ✅");
      await loadDocs();
      await fetchSignatureStatus(leaseId);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
}

  async function downloadDoc(documentId: string, filename?: string) {
    setError("");
    setStatus("Téléchargement…");
    const r = await fetch(`${API}/documents/${documentId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (!r.ok) {
      const t = await r.text();
      setStatus("");
      setError("Erreur téléchargement: " + t);
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `document_${documentId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus("Téléchargé ✅");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  function downloadContractPdf() {
    if (!contractDoc?.id) return;
    downloadDoc(contractDoc.id, contractDoc.filename);
  }

  function downloadNoticePdf() {
    if (!noticeDoc?.id) return;
    downloadDoc(noticeDoc.id, noticeDoc.filename);
  }

  function downloadPackPdf() {
    if (!packDoc?.id) return;
    downloadDoc(packDoc.id, packDoc.filename);
  }

  function openOnSiteSession(task: SignerTask) {
    setSessionDraft({
      open: true,
      signerTaskId: task.id,
      signerKind: task.kind,
      signerName: task.displayName,
      roleLabel: task.roleLabel,
      documentId: task.documentId,
      documentLabel: task.documentLabel,
      tenantId: task.tenantId,
      guaranteeId: task.guaranteeId,
    });
    setShowLegacyPanelForm(false);
    clearCanvas();
  }

  function startOnSiteSignature(task: SignerTask) {
    if (task.hasActiveLink && task.status !== "SIGNED") {
      setPendingModeSwitchTask(task);
      return;
    }

    openOnSiteSession(task);
  }

  function confirmModeSwitchToOnSite() {
    if (!pendingModeSwitchTask) return;

    openOnSiteSession(pendingModeSwitchTask);
    setPendingModeSwitchTask(null);
  }

  function cancelModeSwitchToOnSite() {
    setPendingModeSwitchTask(null);
  }

async function sendSignatureLink(task: SignerTask) {
  if (task.kind === "TENANT") {
    setUiInfo(`Envoi des liens locataires depuis le bail… (${task.displayName})`);
    await sendPublicLink(false);
    return;
  }

  if (task.kind === "GUARANTOR" && task.guaranteeId) {
    setUiInfo(`Envoi du lien garant… (${task.displayName})`);
    await sendGuarantorLinkByGuarantee(task.guaranteeId, false, "SIGN");
    return;
  }

  if (task.kind === "LANDLORD") {
    await sendLandlordLink(false);
    return;
  }
}

async function resendSignatureLink(task: SignerTask) {
  if (task.kind === "TENANT") {
    setUiInfo(`Renvoi des liens locataires depuis le bail… (${task.displayName})`);
    await sendPublicLink(true);
    return;
  }

  if (task.kind === "GUARANTOR" && task.guaranteeId) {
    setUiInfo(`Renvoi du lien garant… (${task.displayName})`);
    await sendGuarantorLinkByGuarantee(task.guaranteeId, true, "SIGN");
    return;
  }

  if (task.kind === "LANDLORD") {
    await sendLandlordLink(true);
    return;
  }
}


function setUiInfo(message: string) {
  setError("");
  setStatus(message);
}

function setUiError(message: string) {
  setStatus("");
  setError(message);
}


async function sendAllRemainingLinks() {
  setUiInfo("Envoi des liens restants…");
  const remainingTasks = signerTasks.filter(
    (task) =>
      task.status !== "SIGNED" &&
      task.status !== "NOT_REQUIRED" &&
      !task.requiresPreparation
  );

  const hasTenantTasks = remainingTasks.some((task) => task.kind === "TENANT");
  const guarantorTasks = remainingTasks.filter(
    (task) => task.kind === "GUARANTOR" && task.guaranteeId
  );
  const hasLandlordTask = remainingTasks.some((task) => task.kind === "LANDLORD");

  if (hasTenantTasks) {
    await sendPublicLink(false);
  }

  for (const task of guarantorTasks) {
    if (task.guaranteeId) {
      await sendGuarantorLinkByGuarantee(task.guaranteeId, false, "SIGN");
    }
  }

  if (hasLandlordTask) {
    await sendLandlordLink(false);
  }

  setUiInfo("Liens envoyés ✅");
  await refreshAll();
}

function startNextOnSite() {
  const nextTask =
    signerTasks.find((task) => task.status === "READY" && task.kind === "TENANT") ||
    signerTasks.find((task) => task.status === "READY" && task.kind === "GUARANTOR") ||
    signerTasks.find((task) => task.status === "READY" && task.kind === "LANDLORD") ||
    null;

  if (!nextTask) {
    setUiError("Aucune signature sur place disponible pour le moment.");
    return;
  }

  startOnSiteSignature(nextTask);
}

async function downloadSignedArtifact(task: SignerTask) {
  if (!task.signedFinalDocumentId) {
    setUiError("Aucun document signé disponible.");
    return;
  }

  await downloadDoc(
    task.signedFinalDocumentId,
    task.signedFinalFilename || `${task.displayName}_SIGNE.pdf`,
  );
}

async function prepareSignerTask(task: SignerTask) {
  if (task.kind === "GUARANTOR" && task.guaranteeId) {
    setUiInfo(`Préparation de l’acte pour ${task.displayName}…`);
    await generateGuarantorActFor(task.guaranteeId);
    await refreshAll();
    return;
  }

  if (task.kind === "TENANT" || task.kind === "LANDLORD") {
    setUiInfo("Préparation du contrat…");
    await generateContract();
    await refreshAll();
  }
}

async function downloadDocumentResource(doc: { id: string; filename?: string | null; label: string }) {
  await downloadDoc(doc.id, doc.filename || `${doc.label}.pdf`);
}

async function downloadSignedDocumentResource(doc: {
  signedFinalDocumentId?: string | null;
  label: string;
}) {
  if (!doc.signedFinalDocumentId) return;

  await downloadDoc(doc.signedFinalDocumentId, `${doc.label}_SIGNE.pdf`);
}

async function confirmSessionDraftSignature() {
  if (!sessionDraft.open || !sessionDraft.documentId || !sessionDraft.signerKind) {
    return;
  }

  const signerRole =
    sessionDraft.signerKind === "TENANT"
      ? "LOCATAIRE"
      : sessionDraft.signerKind === "LANDLORD"
        ? "BAILLEUR"
        : "GARANT";

  await signDocOnPlace({
    documentId: sessionDraft.documentId,
    signerRole,
    signerName: sessionDraft.signerName,
    signerTenantId: sessionDraft.tenantId,
    optimisticGuaranteeId: sessionDraft.guaranteeId,
  });

  setSessionDraft({
    open: false,
    signerTaskId: null,
    signerKind: null,
    signerName: "",
    roleLabel: "",
    documentId: null,
    documentLabel: "",
    tenantId: undefined,
    guaranteeId: undefined,
  });
}

  async function fetchSignatureStatus(currentLeaseId: string) {
    setLoadingSigStatus(true);
    setSigStatusError(null);

    try {
      const res = await fetch(`${API}/signature-status?leaseId=${currentLeaseId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`signature-status failed (${res.status}): ${txt}`);
      }

      const data = (await res.json()) as SignatureStatusPayload;
      setSigStatus(data);
    } catch (e: any) {
      setSigStatusError(String(e?.message || e));
    } finally {
      setLoadingSigStatus(false);
    }
  }

  async function sendGuarantorLinkByGuarantee(
    guaranteeId: string,
    force = false,
    mode: "SIGN" | "SHARE_SIGNED" = "SIGN"
  ) {
    const res = await fetch(`${API}/public-links/guarantor-sign/send-by-guarantee`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({
        guaranteeId,
        force,
        mode,
        channel: "email",
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`send-by-guarantee failed (${res.status}): ${txt}`);
    }

    await fetchSignatureStatus(leaseId);
  }


  async function sendLandlordLink(force = false) {
    setError("");
    setStatus(force ? "Renvoi du lien bailleur…" : "Envoi du lien bailleur…");

    try {
      const r = await fetch(`${API}/public-links/landlord-sign/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          leaseId,
          ttlHours: 48,
          force,
        }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }

      setStatus(force ? "Lien bailleur renvoyé ✅" : "Lien bailleur envoyé ✅");
      await fetchSignatureStatus(leaseId);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function acknowledgeDoc(documentId: string, tenantId: string) {
    const res = await fetch(`${API}/documents/${documentId}/acknowledge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ tenantId }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`acknowledge failed (${res.status}): ${txt}`);
    }

    // refresh status
    await fetchSignatureStatus(leaseId);
  }

function clearCanvas() {
  const c = canvasRef.current;
  if (!c) return;

  const ctx = c.getContext("2d");
  if (!ctx) return;

  // Clear en pixels internes
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);

  // Re-setup transform + styles
  setupCanvasHiDpi(c);

  signatureDirty.current = false;
}

  function dataUrl(c: HTMLCanvasElement | null) {
    if (!c) return "";
    return c.toDataURL("image/png");
  }

function onPointerDown(e: any) {
  const c = canvasRef.current;
  if (!c) return;

  drawing.current = true;
  signatureDirty.current = true;

  try {
    (e.currentTarget as HTMLCanvasElement)?.setPointerCapture?.(e.pointerId);
  } catch {}

  const ctx = c.getContext("2d");
  if (!ctx) return;

  const p = getCanvasPoint(c, e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
}

function onPointerMove(e: any) {
  if (!drawing.current) return;

  const c = canvasRef.current;
  if (!c) return;

  const ctx = c.getContext("2d");
  if (!ctx) return;

  signatureDirty.current = true;

  const p = getCanvasPoint(c, e);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

function onPointerUp(e: any) {
  const c = canvasRef.current;
  if (!c) return;

  try {
    (e.currentTarget as HTMLCanvasElement)?.releasePointerCapture?.(e.pointerId);
  } catch {}

  drawing.current = false;
}

  const signatureCenter = useMemo(() => {
    return mapSignatureData({
      leaseId,
      sigStatus,
      tenants,
      docs,
      guaranteeActOverride,
    });
  }, [leaseId, sigStatus, tenants, docs, guaranteeActOverride]);

  const { overview, signerTasks, documents } = signatureCenter;

  const historyItems = useMemo(() => {
  return buildHistoryItems(signerTasks, documents);
}, [signerTasks, documents]);

  const isRP = useMemo(() => {
    const k = String(leaseKind || "").toUpperCase();
    return k === "MEUBLE_RP" || k === "NU_RP";
  }, [leaseKind]);



  const hasMultipleTenants = useMemo(() => (tenants?.length || 0) > 1, [tenants]);
  const dossier = useMemo(() => countMissingFromSignatureStatus(sigStatus), [sigStatus]);

  const selectedTenant = useMemo(() => {
    const id = String(selectedTenantId || "").trim();
    if (!id) return null;
    return tenants.find((t) => normalizeTenantId(t) === id) || null;
  }, [tenants, selectedTenantId]);

  // keep tenantName synced when selection changes (unless user edits manually afterwards)
  useEffect(() => {
    if (selectedTenant) setTenantName(normalizeTenantName(selectedTenant));
  }, [selectedTenant]);



  // ✅ Patch 4.A — documents signables par le bailleur (contrat + actes caution)
  const landlordSignables: LandlordSignable[] = useMemo(() => {
    const items: LandlordSignable[] = [];

    const contractDocId = sigStatus?.contract?.documentId;
    if (contractDocId) {
      items.push({
        key: "contract",
        label: "Contrat",
        documentId: contractDocId,
      });
    }

    const guarantees = Array.isArray(sigStatus?.guarantees) ? sigStatus!.guarantees : [];
    const acts = guarantees
      .filter((g) => Boolean(guaranteeActOverride[g.guaranteeId] || g.actDocumentId))
      .sort((a, b) => String(a.tenantFullName || "").localeCompare(String(b.tenantFullName || "")))
      .map((g) => ({
        key: `guarantee:${g.guaranteeId}`,
        label: `Acte caution — ${String(g.guarantorFullName || g.tenantFullName || "Garant").trim()} (${String(
          g.guaranteeId,
        ).slice(0, 6)})`,
        documentId: (guaranteeActOverride[g.guaranteeId] || g.actDocumentId) as string,
      }));

    items.push(...acts);
    // ✅ NEW: EDL & Inventaires (entrée/sortie)
    const edlEntryId = sigStatus?.edl?.entry?.documentId;
    if (edlEntryId) items.push({ key: "edl_entry", label: "EDL entrée", documentId: edlEntryId });

    const invEntryId = sigStatus?.inventory?.entry?.documentId;
    if (invEntryId) items.push({ key: "inv_entry", label: "Inventaire entrée", documentId: invEntryId });

    const edlExitId = sigStatus?.edl?.exit?.documentId;
    if (edlExitId) items.push({ key: "edl_exit", label: "EDL sortie", documentId: edlExitId });

    const invExitId = sigStatus?.inventory?.exit?.documentId;
    if (invExitId) items.push({ key: "inv_exit", label: "Inventaire sortie", documentId: invExitId });

    // ✅ NEW: Pack EDL+Inventaire (entrée/sortie)
    const packEntryId = (sigStatus as any)?.packEdlInv?.entry?.documentId;
    if (packEntryId) {
      items.push({
        key: "pack_edl_inv_entry",
        label: "Pack EDL+Inventaire (entrée)",
        documentId: packEntryId,
      });
    }

    const packExitId = (sigStatus as any)?.packEdlInv?.exit?.documentId;
    if (packExitId) {
      items.push({
        key: "pack_edl_inv_exit",
        label: "Pack EDL+Inventaire (sortie)",
        documentId: packExitId,
      });
    }
    
    return items;
  }, [sigStatus, guaranteeActOverride]);

  const guarantorSignables: GuarantorSignable[] = useMemo(() => {
    const gs = Array.isArray(sigStatus?.guarantees) ? sigStatus!.guarantees : [];

    return gs
      .slice()
      .sort((a, b) =>
        String(a.guarantorFullName || "").localeCompare(String(b.guarantorFullName || ""))
      )
      .map((g) => {
        const overrideDocId = guaranteeActOverride[g.guaranteeId];
        const effectiveDocId = overrideDocId || g.actDocumentId;

        return {
          key: g.guaranteeId,
          label: `${String(g.guarantorFullName || "Garant").trim()} (${String(g.guaranteeId).slice(0, 6)})`,
          guaranteeId: g.guaranteeId,
          documentId: effectiveDocId, // peut être null
          defaultName: String(g.guarantorFullName || "Garant").trim(),
          hasAct: Boolean(effectiveDocId),
        };
      });
  }, [sigStatus, guaranteeActOverride]);

  const [selectedLandlordDocKey, setSelectedLandlordDocKey] = useState<string>("contract");
  const [selectedTenantDocKey, setSelectedTenantDocKey] = useState<string>("contract");

  const [selectedGuaranteeId, setSelectedGuaranteeId] = useState("");

  const selectedGuarantor = useMemo(
    () => guarantorSignables.find((g) => g.guaranteeId === selectedGuaranteeId) || null,
    [guarantorSignables, selectedGuaranteeId]
  );

  // nom garant: on va le pré-remplir avec le garant choisi
  useEffect(() => {
    if (!selectedGuaranteeId && guarantorSignables.length) {
      setSelectedGuaranteeId(guarantorSignables[0].guaranteeId);
    }
  }, [guarantorSignables, selectedGuaranteeId]);

  useEffect(() => {
    if (selectedGuarantor) {
      setGuarantorName(selectedGuarantor.defaultName || "Garant");
    }
  }, [selectedGuarantor]);

  // garde une sélection valide après refresh des statuts
  useEffect(() => {
    if (!landlordSignables.length) return;

  const stillThere = landlordSignables.some((x) => x.key === selectedLandlordDocKey);
    if (!stillThere) {
      const hasContract = landlordSignables.some((x) => x.key === "contract");
      setSelectedLandlordDocKey(hasContract ? "contract" : landlordSignables[0].key);
      return;
    }

    // si "contract" mais pas dispo → fallback premier acte
    if (selectedLandlordDocKey === "contract" && !landlordSignables.some((x) => x.key === "contract")) {
      setSelectedLandlordDocKey(landlordSignables[0].key);
    }
  }, [landlordSignables, selectedLandlordDocKey]);

  // ✅ NEW: garde une sélection valide côté locataire
  useEffect(() => {
    if (!landlordSignables.length) return;

    const stillThere = landlordSignables.some((x) => x.key === selectedTenantDocKey);
    if (!stillThere) {
      const hasContract = landlordSignables.some((x) => x.key === "contract");
      setSelectedTenantDocKey(hasContract ? "contract" : landlordSignables[0].key);
      return;
    }

    if (selectedTenantDocKey === "contract" && !landlordSignables.some((x) => x.key === "contract")) {
      setSelectedTenantDocKey(landlordSignables[0].key);
    }
  }, [landlordSignables, selectedTenantDocKey]);

  const selectedLandlordDoc = useMemo(() => {
    return landlordSignables.find((x) => x.key === selectedLandlordDocKey) || null;
  }, [landlordSignables, selectedLandlordDocKey]);

  const selectedTenantDoc = useMemo(() => {
    return landlordSignables.find((x) => x.key === selectedTenantDocKey) || null;
  }, [landlordSignables, selectedTenantDocKey]);

async function signDocOnPlace(args: {
  documentId: string;
  signerRole: "LOCATAIRE" | "BAILLEUR" | "GARANT";
  signerName: string;
  signerTenantId?: string;
  optimisticGuaranteeId?: string; // pour l'UI garant
}) {
  const { documentId, signerRole, signerName, signerTenantId, optimisticGuaranteeId } = args;

  setError("");
  setStatus(
    signerRole === "LOCATAIRE"
      ? "Signature locataire…"
      : signerRole === "BAILLEUR"
        ? "Signature bailleur…"
        : "Signature garant…"
  );

  if (!signatureDirty.current) {
    setStatus("");
    setError("Signature vide.");
    return;
  }

  const signatureDataUrl = dataUrl(canvasRef.current);

  try {
    const payload: any = { signerName, signerRole, signatureDataUrl };
    if (signerTenantId) payload.signerTenantId = signerTenantId;

    const r = await fetch(`${API}/documents/${documentId}/sign`, {
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

    // ✅ optimistic UI garant
    if (signerRole === "GARANT" && optimisticGuaranteeId) {
      setSigStatus((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          guarantees: prev.guarantees.map((g) =>
            g.guaranteeId === optimisticGuaranteeId ? { ...g, signatureStatus: "IN_PROGRESS" } : g
          ),
        };
      });
    }

    clearCanvas();
    setStatus("✅ Signature enregistrée");

    await loadDocs();
    await fetchSignatureStatus(leaseId);
  } catch (e: any) {
    setStatus("");
    setError(String(e?.message || e));
  }
}

async function signTenantOnPlace() {
  const docId = selectedTenantDoc?.documentId;
  if (!docId) {
    setError("Aucun document sélectionné à signer (locataire).");
    return;
  }

  // ✅ signerTenantId si multi-locataires
  let signerTenantId: string | undefined = undefined;
  if (hasMultipleTenants) {
    signerTenantId = String(selectedTenantId || "").trim();
    if (!signerTenantId) {
      setError("Sélectionne le locataire signataire (multi-locataires).");
      return;
    }
  } else {
    const only = tenants?.[0];
    const id = only ? normalizeTenantId(only) : "";
    if (id) signerTenantId = id;
  }

  return signDocOnPlace({
    documentId: docId,
    signerRole: "LOCATAIRE",
    signerName: tenantName || "Locataire",
    signerTenantId,
  });
}

async function signLandlordOnPlace() {
  const docId = selectedLandlordDoc?.documentId;
  if (!docId) {
    setError("Aucun document sélectionné à signer (bailleur).");
    return;
  }

  return signDocOnPlace({
    documentId: docId,
    signerRole: "BAILLEUR",
    signerName: landlordName || "Bailleur",
  });
}

async function signGuarantorOnPlace() {
  const docId = selectedGuarantor?.documentId;
  if (!docId || !selectedGuarantor) {
    setError("Acte non généré : génère l’acte pour permettre la signature sur place.");
    return;
  }

  return signDocOnPlace({
    documentId: docId,
    signerRole: "GARANT",
    signerName: guarantorName || selectedGuarantor.defaultName || "Garant",
    optimisticGuaranteeId: selectedGuarantor.guaranteeId,
  });
}
  async function sendPublicLink(force = false) {
    setError("");
    setStatus(force ? "Renvoi (force) des liens locataires…" : "Envoi des liens locataires…");

    try {
      const r = await fetch(`${API}/public-links/tenant-sign/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId, ttlHours: 48, force }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }

      const sentEmails = Array.isArray(j?.sent) ? j.sent.map((x: any) => x.email).filter(Boolean) : [];
      const skippedEmails = Array.isArray(j?.skipped) ? j.skipped.map((x: any) => x.email).filter(Boolean) : [];

      setStatus(`✅ ${j.sentCount || 0} envoyé(s) • ${j.skippedCount || 0} ignoré(s)`);

      alert(
        `✅ ${j.sentCount || 0} email(s) envoyé(s)\n` +
          `⏭️ ${j.skippedCount || 0} ignoré(s) (lien actif)\n\n` +
          `Envoyés:\n${sentEmails.join("\n") || "—"}\n\n` +
          `Ignorés:\n${skippedEmails.join("\n") || "—"}`
      );
      await fetchSignatureStatus(leaseId);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function refreshAll() {
    await loadDocs(); // recharge les documents
    await fetchSignatureStatus(leaseId); // recharge les statuts contrat + garanties
  }

  function openGuarantees() {
    window.location.href = `/guarantees/${leaseId}`;
  }



const isSessionDriven = sessionDraft.open;
const showManualPanel = !isSessionDriven && showLegacyPanelForm;
const showPanelEmptyState = !isSessionDriven && !showLegacyPanelForm;

function getRecommendedActionLabel(tasks: SignerTask[]): string {
  const firstToPrepare = tasks.find((task) => task.requiresPreparation);
  if (firstToPrepare) {
    if (firstToPrepare.kind === "GUARANTOR") {
      return `Préparez l’acte de caution pour ${firstToPrepare.displayName}.`;
    }

    return "Préparez le contrat pour lancer les signatures locataires et bailleur.";
  }

  const firstReadyTenant = tasks.find(
    (task) => task.kind === "TENANT" && task.status === "READY" && task.canSignOnSite
  );
  if (firstReadyTenant) {
    return `Lancez la signature sur place de ${firstReadyTenant.displayName} ou envoyez-lui un lien sécurisé.`;
  }

  const firstReadyGuarantor = tasks.find(
    (task) => task.kind === "GUARANTOR" && task.status === "READY" && task.canSignOnSite
  );
  if (firstReadyGuarantor) {
    return `Faites signer ${firstReadyGuarantor.displayName} pour finaliser la caution.`;
  }

  const firstReadyLandlord = tasks.find(
    (task) => task.kind === "LANDLORD" && task.status === "READY" && task.canSignOnSite
  );
  if (firstReadyLandlord) {
    return "La signature du bailleur peut être lancée sur place ou par lien sécurisé.";
  }

  const firstLinkSent = tasks.find((task) => task.status === "LINK_SENT");
  if (firstLinkSent) {
    return `Envoyez ou relancez le lien de signature de ${firstLinkSent.displayName}.`;
  }

  const firstInProgress = tasks.find((task) => task.status === "IN_PROGRESS");
  if (firstInProgress) {
    return `Suivez la signature en cours de ${firstInProgress.displayName}.`;
  }

  const remainingActionable = tasks.find(
    (task) => task.status !== "SIGNED" && task.status !== "NOT_REQUIRED"
  );
  if (remainingActionable) {
    return "Le dossier est prêt : finalisez les dernières signatures en attente.";
  }

  return "Le dossier est entièrement prêt et signé.";
}

const recommendedActionLabel = getRecommendedActionLabel(signerTasks);

const canSendAllRemainingLinks = signerTasks.some(
  (task) =>
    task.status !== "SIGNED" &&
    task.status !== "NOT_REQUIRED" &&
    !task.requiresPreparation &&
    task.canSendEmailLink
);

const canStartNextOnSite = signerTasks.some(
  (task) => task.status === "READY" && task.canSignOnSite
);

const panelRoleValue = isSessionDriven
  ? sessionDraft.signerKind === "TENANT"
    ? "LOCATAIRE"
    : sessionDraft.signerKind === "LANDLORD"
      ? "BAILLEUR"
      : "GARANT"
  : role;

const panelSignerNameValue = isSessionDriven
  ? sessionDraft.signerName
  : role === "LOCATAIRE"
    ? tenantName
    : role === "BAILLEUR"
      ? landlordName
      : guarantorName;

const panelDocumentLabel = isSessionDriven
  ? sessionDraft.documentLabel
  : role === "GARANT"
    ? selectedGuarantor?.label || "Document garant"
    : role === "LOCATAIRE"
      ? selectedTenantDoc?.label || "Contrat"
      : selectedLandlordDoc?.label || "Contrat";

const flatFieldStyle: React.CSSProperties = {
  width: "100%",
  height: 42,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid #D6DFEB",
  background: "#FFFFFF",
  fontWeight: 400,
  fontSize: 14,
  color: "#1F2A3C",
  boxShadow: "none",
  fontFamily: UI_FONT,
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
  boxSizing: "border-box",
};
      
  return (
    <div
      style={{
        padding: 22,
        maxWidth: 1280,
        margin: "0 auto",
        display: "grid",
        gap: 18,
        background: `linear-gradient(180deg, ${SIGN_UI.colors.pageBgTop} 0%, ${SIGN_UI.colors.pageBgBottom} 100%)`,
        borderRadius: 28,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 720px" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: SIGN_UI.colors.blue,
              marginBottom: 10,
              letterSpacing: "-0.01em",
              fontFamily: SIGN_UI.font,
            }}
          >
            Signature du bail
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 24,
                lineHeight: 1.12,
                letterSpacing: "-0.04em",
                fontWeight: 800,
                color: SIGN_UI.colors.textStrong,
                wordBreak: "break-word",
                fontFamily: UI_FONT,
              }}
            >
              <span>{overview.leaseLabel}</span>
              <span style={{ color: "#B7C0CF", fontWeight: 500 }}> — </span>
              <span style={{ color: SIGN_UI.colors.textSoft, fontWeight: 600 }}>
                {overview.primaryTenantName}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={refreshAll}
          style={{
            appearance: "none",
            border: `1px solid ${SIGN_UI.colors.cardBorder}`,
            background: "linear-gradient(180deg, #FFFFFF 0%, #FBFCFE 100%)",
            borderRadius: 14,
            height: 40,
            padding: "0 16px",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
            color: SIGN_UI.colors.textStrong,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 2px 6px rgba(31,41,64,0.04)",
            fontFamily: SIGN_UI.font,
            flexShrink: 0,
          }}
        >
          <RefreshCw size={14} strokeWidth={2.05} />
          <span>Rafraîchir</span>
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isWideScreen ? "minmax(0, 1fr) 372px" : "1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 16,
            minWidth: 0,
          }}
        >
    

          <SignatureHero
            overview={overview}
            recommendedActionLabel={recommendedActionLabel}
            canSendAllRemainingLinks={canSendAllRemainingLinks}
            canStartNextOnSite={canStartNextOnSite}
            onSendAllRemainingLinks={sendAllRemainingLinks}
            onStartNextOnSite={startNextOnSite}
          />

          <SignerSection
            tasks={signerTasks}
            activeTaskId={sessionDraft.signerTaskId}
            enableAutoScroll={isWideScreen}
            onStartOnSite={startOnSiteSignature}
            onSendEmail={sendSignatureLink}
            onResendEmail={resendSignatureLink}
            onDownloadSigned={downloadSignedArtifact}
            onPrepare={prepareSignerTask}
          />

          <DocumentsSection
            documents={documents}
            onDownloadDocument={downloadDocumentResource}
            onDownloadSignedDocument={downloadSignedDocumentResource}
          />
        </div>

        <div
          ref={signaturePanelRef}
          className="sign-sticky"
          style={{
            position: isWideScreen ? "sticky" : "static",
            top: isWideScreen ? 12 : "auto",
            display: "grid",
            gap: 18,
            alignSelf: "start",
            minWidth: 0,
            marginTop: 0,
          }}
        >
  <div
    style={{
      background: SIGN_UI.colors.cardBg,
      border: `1px solid ${SIGN_UI.colors.cardBorder}`,
      borderRadius: 22,
      padding: 18,
      boxShadow: SIGN_UI.shadows.card,
      fontFamily: UI_FONT,
      WebkitFontSmoothing: "antialiased",
      MozOsxFontSmoothing: "grayscale",
    }}
  >
            <div
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: "#1C2434",
                letterSpacing: -0.015,
                marginBottom: 6,
                fontFamily: UI_FONT,
              }}
            >
              {isSessionDriven ? "Session de signature" : "Poste de signature"}
</div>

            <div
              style={{
                marginBottom: 16,
                fontSize: 13.5,
                lineHeight: 1.65,
                color: "#6B7688",
                fontWeight: 400,
                fontFamily: UI_FONT,
              }}
            >
              {isSessionDriven
                ? "Vérifiez l’identité du signataire puis recueillez sa signature."
                : "Ouvrez une session guidée depuis un signataire, ou utilisez le mode manuel."}
            </div>

            {showPanelEmptyState ? (
              <div
                style={{
                  marginTop: 10,
                  marginBottom: 16,
                  padding: 16,
                  borderRadius: 18,
                  border: "1px solid #DCE4F0",
                  background: "linear-gradient(180deg, #FCFDFF 0%, #F5F7FB 100%)",
                  boxShadow: "0 8px 18px rgba(31,41,64,0.035), inset 0 1px 0 rgba(255,255,255,0.82)",
                  display: "grid",
                  gap: 14,
                  fontFamily: UI_FONT,
                }}
              >
                <div
                  style={{
                    fontSize: 15.5,
                    fontWeight: 600,
                    color: "#172033",
                    letterSpacing: -0.015,
                    lineHeight: 1.25,
                  }}
                >
                  Commencez par choisir un signataire
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "64px minmax(0,1fr)",
                    gap: 14,
                    alignItems: "start",
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 14,
                      background: "linear-gradient(180deg,#DDF5F4 0%,#C7ECE9 100%)",
                      border: "1px solid rgba(155,206,202,0.95)",
                      boxShadow: "0 6px 16px rgba(31,41,64,0.08)",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {/* document */}
                    <div
                      style={{
                        width: 30,
                        height: 36,
                        borderRadius: 7,
                        background: "#FFFDF9",
                        border: "1.5px solid #98C7C3",
                        position: "relative",
                        boxShadow: "0 2px 6px rgba(31,41,64,0.08)",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 7,
                          left: 6,
                          width: 17,
                          height: 2.5,
                          borderRadius: 999,
                          background: "#7FA8C8",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: 13,
                          left: 6,
                          width: 13,
                          height: 2.5,
                          borderRadius: 999,
                          background: "#7FA8C8",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: 19,
                          left: 6,
                          width: 10,
                          height: 2.5,
                          borderRadius: 999,
                          background: "#7FA8C8",
                        }}
                      />
                    </div>

                    {/* check */}
                    <div
                      style={{
                        position: "absolute",
                        right: 8,
                        bottom: 11,
                        width: 18,
                        height: 10,
                        borderLeft: "4px solid #D98A4C",
                        borderBottom: "4px solid #D98A4C",
                        transform: "rotate(-45deg)",
                        borderRadius: 2,
                      }}
                    />
                  </div>

                  <div
                    style={{
                      fontSize: 13.5,
                      lineHeight: 1.72,
                      color: "#6B7688",
                      fontWeight: 400,
                    }}
                  >
                    Sélectionnez un locataire, un garant ou le bailleur dans la section
                    signataires pour ouvrir une session guidée de signature sur place.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowLegacyPanelForm(true)}
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 16px",
                    borderRadius: 12,
                    border: "1px solid #D6DFEB",
                    background: "#FFFFFF",
                    color: "#2A3345",
                    fontWeight: 500,
                    fontSize: 14,
                    cursor: "pointer",
                    boxShadow: "0 3px 8px rgba(31,41,64,0.04)",
                    fontFamily: UI_FONT,
                  }}
                >
                  Ouvrir le mode manuel
                </button>
              </div>
            ) : null}

            {isSessionDriven ? (
              <div
                style={{
                  marginTop: 10,
                  marginBottom: 16,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid #D9E6FB",
                  background: "#F5F9FF",
                  display: "grid",
                  gap: 4,
                  fontFamily: UI_FONT,
                }}
              >
               <div
                style={{
                  fontSize: 11,
                  color: "#7B8799",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: 0.04,
                }}
              >
                Session guidée active
              </div>

                <div style={{ fontSize: 15.5, fontWeight: 600, color: "#172033", letterSpacing: -0.01 }}>
                  {sessionDraft.signerName}
                </div>

                <div style={{ fontSize: 13, color: "#6B7688", lineHeight: 1.6, fontWeight: 400 }}>
                  {sessionDraft.roleLabel} • {sessionDraft.documentLabel}
                </div>
              </div>
            ) : null}

            {isSessionDriven || showManualPanel ? (
              <>
                {showManualPanel ? (
                  <div style={{ marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLegacyPanelForm(false);
                        clearCanvas();
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 14,
                        border: `1px solid ${borderSoftStrong}`,
                        background: "#fff",
                        color: "#243041",
                        fontWeight: 500,
                        cursor: "pointer",
                        fontFamily: UI_FONT,
                      }}
                    >
                      Quitter le mode manuel
                    </button>
                  </div>
                ) : null}

                {!isSessionDriven ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#8A94A6",
                        fontWeight: 500,
                        letterSpacing: 0.04,
                        textTransform: "uppercase",
                      }}
                    >
                      Signer en tant que
                    </div>
                    <select
                      value={panelRoleValue}
                      disabled={isSessionDriven}
                      onChange={(e) => {
                        if (isSessionDriven) return;
                        setRole(e.target.value as any);
                        clearCanvas();
                      }}
                      style={flatFieldStyle}
                    >
                      <option value="LOCATAIRE">Locataire</option>
                      <option value="BAILLEUR">Bailleur</option>
                      <option value="GARANT">Garant</option>
                    </select>
                  </div>
                ) : null}

                <div style={{ height: 10 }} />

                {!isSessionDriven && role === "LOCATAIRE" && hasMultipleTenants ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#8A94A6",
                        fontWeight: 500,
                        letterSpacing: 0.04,
                        textTransform: "uppercase",
                      }}
                    >
                      Locataire signataire <span style={{ color: "#dc2626" }}>*</span>
                    </div>
                    <select
                      value={selectedTenantId}
                      onChange={(e) => setSelectedTenantId(e.target.value)}
                      style={{ ...flatFieldStyle, height: 38 }}
                    >
                      <option value="">— Sélectionner —</option>
                      {tenants.map((t) => {
                        const id = normalizeTenantId(t);
                        const label = `${normalizeTenantName(t)}${t.role ? ` (${t.role})` : ""}`;
                        return (
                          <option key={id || label} value={id}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : null}

                <div style={{ height: 10 }} />

                {!isSessionDriven ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#8A94A6",
                        fontWeight: 500,
                        letterSpacing: 0.04,
                        textTransform: "uppercase",
                      }}
                    >
                      Document à signer
                    </div>

                    {role === "GARANT" ? (
                      <select
                        value={isSessionDriven ? sessionDraft.guaranteeId || "" : selectedGuaranteeId}
                        onChange={(e) => {
                          if (isSessionDriven) return;
                          setSelectedGuaranteeId(e.target.value);
                        }}
                        disabled={isSessionDriven || guarantorSignables.length === 0}
                        style={{
                          ...flatFieldStyle,
                          height: 38,
                          cursor: guarantorSignables.length ? "pointer" : "not-allowed",
                        }}
                      >
                        {guarantorSignables.length === 0 ? <option value="">— Aucun garant —</option> : null}
                        {guarantorSignables.map((g) => (
                          <option key={g.key} value={g.guaranteeId}>
                            {g.label}
                            {g.hasAct ? "" : " — (acte non généré)"}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={
                          isSessionDriven
                            ? sessionDraft.signerKind === "TENANT"
                              ? sessionDraft.signerTaskId || ""
                              : sessionDraft.signerKind === "LANDLORD"
                                ? sessionDraft.signerTaskId || ""
                                : ""
                            : role === "LOCATAIRE"
                              ? selectedTenantDocKey
                              : selectedLandlordDocKey
                        }
                        onChange={(e) => {
                          if (isSessionDriven) return;
                          if (role === "LOCATAIRE") setSelectedTenantDocKey(e.target.value);
                          else setSelectedLandlordDocKey(e.target.value);
                          clearCanvas();
                        }}
                        disabled={isSessionDriven || !landlordSignables.length}
                        style={{
                          ...flatFieldStyle,
                          height: 42,
                          cursor: landlordSignables.length ? "pointer" : "not-allowed",
                        }}
                      >
                        {landlordSignables.length === 0 ? <option value="">— Aucun document —</option> : null}
                        {landlordSignables.map((d) => (
                          <option key={d.key} value={d.key}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {role === "GARANT" && selectedGuarantor && !selectedGuarantor.documentId ? (
                      <div style={{ fontSize: 12, color: textSoft, marginTop: 6 }}>
                        Acte non généré. Va dans “Garanties (caution)” puis clique “Générer acte”.
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div style={{ height: 10 }} />

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#8A94A6",
                      fontWeight: 500,
                      letterSpacing: 0.04,
                      textTransform: "uppercase",
                    }}
                  >
                    Nom affiché sur la signature
                  </div>
                  <input
                    value={panelSignerNameValue}
                    onChange={(e) => {
                      if (isSessionDriven) {
                        setSessionDraft((prev) => ({
                          ...prev,
                          signerName: e.target.value,
                        }));
                        return;
                      }

                      if (role === "LOCATAIRE") setTenantName(e.target.value);
                      else if (role === "BAILLEUR") setLandlordName(e.target.value);
                      else setGuarantorName(e.target.value);
                    }}
                    style={{ ...flatFieldStyle, height: 38 }}
                  />
                </div>

                <div style={{ height: 12 }} />

                <div
                  style={{
                    fontSize: 11,
                    color: "#8A94A6",
                    fontWeight: 500,
                    letterSpacing: 0.04,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Signature manuscrite
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#8A94A6",
                      fontWeight: 500,
                      letterSpacing: 0.04,
                      textTransform: "uppercase",
                    }}
                  >
                    Document concerné
                  </div>
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: "#F8FAFC",
                      border: "1px solid #E5EBF3",
                      fontWeight: 500,
                      fontSize: 14,
                      color: "#243041",
                      fontFamily: UI_FONT,
                    }}
                  >
                    {panelDocumentLabel}
                  </div>
                </div>

                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: 220,
                    borderRadius: 18,
                    border: isSessionDriven ? "1px solid #CFE0FF" : "1px solid #D6DFEB",
                    background: "linear-gradient(180deg, #FFFFFF 0%, #F8FBFF 100%)",
                    boxShadow: "inset 0 1px 2px rgba(15,23,42,0.03)",
                    overflow: "hidden",
                  }}
                >
                  {!signatureDirty.current ? (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                        color: "#9AA5B5",
                        fontSize: 13.5,
                        fontWeight: 400,
                        zIndex: 1,
                        fontFamily: UI_FONT,
                      }}
                    >
                      Le signataire signe ici
                    </div>
                  ) : null}

                  <canvas
                    ref={canvasRef}
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "block",
                      position: "relative",
                      zIndex: 2,
                      touchAction: "none",
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onPointerLeave={onPointerUp}
                  />
                </div>

                <div style={{ height: 12 }} />

                <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
                  <button
                    onClick={clearCanvas}
                    style={{
                      flex: 1,
                      height: 42,
                      padding: "0 16px",
                      borderRadius: 12,
                      border: "1px solid #D6DFEB",
                      background: "#FFFFFF",
                      fontWeight: 500,
                      fontSize: 14,
                      color: "#2D3A52",
                      boxShadow: "none",
                      fontFamily: UI_FONT,
                    }}
                  >
                    Effacer
                  </button>

                  <button
                    onClick={async () => {
                      if (isSessionDriven) {
                        await confirmSessionDraftSignature();
                        return;
                      }

                      if (role === "LOCATAIRE") await signTenantOnPlace();
                      else if (role === "BAILLEUR") await signLandlordOnPlace();
                      else await signGuarantorOnPlace();
                    }}
                    disabled={role === "GARANT" && !!selectedGuarantor && !selectedGuarantor.documentId}
                    style={{
                      flex: 1,
                      height: 42,
                      padding: "0 16px",
                      borderRadius: 12,
                      border: "none",
                      background: "linear-gradient(180deg, #4E7CE8 0%, #3567D6 100%)",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                      letterSpacing: -0.01,
                      boxShadow: "0 8px 18px rgba(53,103,214,0.22)",
                      opacity: role === "GARANT" && !!selectedGuarantor && !selectedGuarantor.documentId ? 0.6 : 1,
                      fontFamily: UI_FONT,
                    }}
                  >
                    {isSessionDriven ? "Confirmer la signature" : "Signer"}
                  </button>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12.5,
                    lineHeight: 1.6,
                    color: "#6B7688",
                    fontWeight: 400,
                    fontFamily: UI_FONT,
                  }}
                >
                  La signature sera horodatée et enregistrée dans le dossier locatif.
                </div>

                {isSessionDriven ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSessionDraft({
                        open: false,
                        signerTaskId: null,
                        signerKind: null,
                        signerName: "",
                        roleLabel: "",
                        documentId: null,
                        documentLabel: "",
                        tenantId: undefined,
                        guaranteeId: undefined,
                      });
                      clearCanvas();
                    }}
                    style={{
                      width: "100%",
                      height: 42,
                      marginTop: 12,
                      padding: "0 16px",
                      borderRadius: 14,
                      border: `1px solid ${borderSoftStrong}`,
                      background: "#fff",
                      color: "#243041",
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: UI_FONT,
                    }}
                  >
                    Terminer cette session
                  </button>
                ) : null}
              </>
            ) : null}

            {status ? (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 10px",
                  borderRadius: 10,
                  background:
                    status.includes("✅") || status.toLowerCase().includes("télécharg")
                      ? "#F3FAF5"
                      : "#F8FAFC",
                  color:
                    status.includes("✅") || status.toLowerCase().includes("télécharg")
                      ? "#2F6B4F"
                      : "#475467",
                  fontSize: 12.5,
                  fontWeight: 500,
                  lineHeight: 1.4,
                  fontFamily: UI_FONT,
                }}
              >
                {status.replace("✅ ", "✓ ")}
              </div>
            ) : null}

            {error ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(239,68,68,0.18)",
                  background: "rgba(239,68,68,0.06)",
                  color: "#b42318",
                  display: "grid",
                  gap: 4,
                  fontFamily: UI_FONT,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 12 }}>Erreur</div>
                <div style={{ fontWeight: 500, lineHeight: 1.5 }}>{error}</div>
              </div>
            ) : null}
          </div>
          <HistorySection items={historyItems} />
        </div>
      </div>

      {pendingModeSwitchTask ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#ffffff",
              borderRadius: 22,
              border: "1px solid #dde3ec",
              boxShadow: "0 20px 48px rgba(31,41,64,0.14), 0 6px 18px rgba(31,41,64,0.07)",
              padding: 24,
              display: "grid",
              gap: 16,
              fontFamily: UI_FONT,
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 500,
                  color: textStrong,
                  letterSpacing: -0.03,
                }}
              >
                Basculer en signature sur place ?
              </div>

              <div style={{ fontSize: 14.5, lineHeight: 1.65, color: "#334155" }}>
                Un lien de signature est déjà actif pour{" "}
                <strong style={{ color: textStrong }}>{pendingModeSwitchTask.displayName}</strong>.
                Passer en signature sur place rendra ce lien obsolète pour ce document.
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(245,158,11,0.22)",
                  background: "rgba(255,247,237,0.9)",
                  color: "#9a3412",
                  fontSize: 13.5,
                  lineHeight: 1.55,
                }}
              >
                Document concerné :{" "}
                <strong style={{ color: "#7c2d12" }}>{pendingModeSwitchTask.documentLabel}</strong>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={cancelModeSwitchToOnSite}
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: `1px solid ${borderSoftStrong}`,
                  background: "#ffffff",
                  color: "#243041",
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily:
                    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={confirmModeSwitchToOnSite}
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: `1px solid ${brandBlueBorder}`,
                  background: `linear-gradient(180deg, ${brandBlue} 0%, ${brandBlueBorder} 100%)`,
                  color: "#ffffff",
                  fontWeight: 500,
                  cursor: "pointer",
                  boxShadow: "0 10px 22px rgba(61,115,229,0.22), inset 0 1px 0 rgba(255,255,255,0.12)",
                  fontFamily:
                    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style
        dangerouslySetInnerHTML={{
          __html: `
            html{scroll-behavior:smooth}

            @media (max-width: 1100px){
              .sign-grid { grid-template-columns: 1fr !important; }
              .sign-sticky { position: static !important; top:auto !important; }
            }
          `,
        }}
      />
    </div>
  );
}