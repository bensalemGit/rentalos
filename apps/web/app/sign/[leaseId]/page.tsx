"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { extractLeaseBundle } from "../../_lib/extractLease";
import type { SignatureStatusPayload } from "../../_lib/signatureStatus.types";
import { SignableCard } from "./_components/SignableCard";

const brandBlue = "#356AC3";
const brandBlueHover = "#2F5DAE";
const textStrong = "#1f2937";
const textSoft = "#64748b";
const borderSoft = "#d9dee7";
const borderSoftStrong = "#cfd7e3";
const bgSoft = "#f8fafc";


const ui = {
  card: {
    background: "#ffffff",
    border: `1px solid ${borderSoft}`,
    borderRadius: 22,
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  } as React.CSSProperties,
  hTitle: {
    fontSize: 18,
    fontWeight: 800,
    margin: 0,
    letterSpacing: -0.02,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } as React.CSSProperties,
  sub: {
    fontSize: 13,
    color: "var(--muted)",
    marginTop: 4,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } as React.CSSProperties,
};

function Badge({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral" | "primary";
  children: React.ReactNode;
}) {
  const map: any = {
    success: { bg: "rgba(22,163,74,0.11)", fg: "#2f7a4b", bd: "transparent" },
    warning: { bg: "rgba(217,119,6,0.10)", fg: "#b45309", bd: "transparent" },
    danger: { bg: "rgba(239,68,68,0.10)", fg: "#b91c1c", bd: "transparent" },
    neutral: { bg: "rgba(100,116,139,0.10)", fg: "#64748b", bd: "transparent" },
    primary: { bg: "rgba(53,106,195,0.10)", fg: brandBlue, bd: "transparent" },
  };
  const s = map[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 11px",
        borderRadius: 999,
        border: "1px solid transparent",
        background: s.bg,
        color: s.fg,
        fontWeight: 700,
        fontSize: 11.5,
        letterSpacing: -0.01,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        whiteSpace: "nowrap",
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
    borderRadius: 14,
    fontWeight: 700,
    cursor: "pointer",
    border: "1px solid var(--border)",
    transition: "background 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  const styles: any = {
    primary: {
      ...base,
      background: brandBlue,
      border: `1px solid ${brandBlue}`,
      color: "white",
      boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.08), 0 1px 2px rgba(53,106,195,0.14)",
    },
    secondary: {
      ...base,
      background: bgSoft,
      color: "#1e293b",
      border: `1px solid ${borderSoftStrong}`,
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

function Card({
  id,
  title,
  subtitle,
  right,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ ...ui.card, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div
            style={{
              fontWeight: 800,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#0f172a",
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            {sectionIcon(id)}
            <span>{title}</span>
          </div>
          {subtitle ? (
            <div
              style={{
                fontSize: 12,
                color: "#64748b",
                marginTop: 4,
                fontFamily:
                  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {right}
      </div>
      <div style={{ marginTop: 14 }}>{children}</div>
    </section>
  );
}

function InlineMenu({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginTop: 10,
        marginBottom: 12,
        border: `1px solid ${borderSoft}`,
        borderRadius: 14,
        background: bgSoft,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
        padding: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: textSoft,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {title}
      </div>

      <div style={{ display: "grid", gap: 4 }}>
        {children}
      </div>
    </div>
  );
}

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

function scrollToAnchor(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function sectionIcon(sectionId?: string) {
  const wrapStyle: React.CSSProperties = {
    width: 18,
    height: 18,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  if (sectionId === "contract") {
    return (
      <span aria-hidden="true" style={{ ...wrapStyle, color: "#6f8fb8" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M8 3h6l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M14 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M9 13h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  if (sectionId === "tenants") {
    return (
      <span aria-hidden="true" style={{ ...wrapStyle, color: "#7a6fd0" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9.5" cy="7" r="3" stroke="currentColor" strokeWidth="2" />
          <path
            d="M22 21v-2a4 4 0 0 0-3-3.87"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 4.13a3 3 0 0 1 0 5.82"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (sectionId === "guarantees") {
    return (
      <span aria-hidden="true" style={{ ...wrapStyle, color: "#7ea98b" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (sectionId === "edl-inv") {
    return (
      <span aria-hidden="true" style={{ ...wrapStyle, color: "#6f8fb8" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="6" y="4" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M9 8h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  return null;
}

const anchorTabStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d5dbe5",
  borderRadius: 12,
  padding: "8px 12px",
  fontWeight: 700,
  color: "#0f172a",
  textDecoration: "none",
  boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

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

  const [contractMenuOpen, setContractMenuOpen] = useState(false);
  const [guaranteesMenuOpen, setGuaranteesMenuOpen] = useState(false);
  const [edlMenuOpen, setEdlMenuOpen] = useState(false);

  const [showContractDetails, setShowContractDetails] = useState(false);
  const [showGuaranteesDetails, setShowGuaranteesDetails] = useState(false);
  const [showEdlInvDetails, setShowEdlInvDetails] = useState(false);
  const [showTenantsDetails, setShowTenantsDetails] = useState(false);

  // canvas unique
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const signatureDirty = useRef(false);

  const [tenantName, setTenantName] = useState("Locataire");
  const [landlordName, setLandlordName] = useState("Bailleur");

  const [sigStatus, setSigStatus] = useState<SignatureStatusPayload | null>(null);
  // ✅ Local override: permet d'utiliser immédiatement l'id d'acte renvoyé par /documents/guarantor-act
  const [guaranteeActOverride, setGuaranteeActOverride] = useState<Record<string, string>>({});
  const [loadingSigStatus, setLoadingSigStatus] = useState(false);
  const [sigStatusError, setSigStatusError] = useState<string | null>(null);

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

  const isRP = useMemo(() => {
    const k = String(leaseKind || "").toUpperCase();
    return k === "MEUBLE_RP" || k === "NU_RP";
  }, [leaseKind]);

  const hasMultipleTenants = useMemo(() => (tenants?.length || 0) > 1, [tenants]);

  const selectedTenant = useMemo(() => {
    const id = String(selectedTenantId || "").trim();
    if (!id) return null;
    return tenants.find((t) => normalizeTenantId(t) === id) || null;
  }, [tenants, selectedTenantId]);

  // keep tenantName synced when selection changes (unless user edits manually afterwards)
  useEffect(() => {
    if (selectedTenant) setTenantName(normalizeTenantName(selectedTenant));
  }, [selectedTenantId]);


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


function MenuItem({
  children,
  icon,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "10px 12px",
        borderRadius: 10,
        border: "none",
        background: "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700,
        color: disabled ? "#9ca3af" : "var(--text)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        transition: "background 120ms ease",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = "rgba(100,116,139,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          borderRadius: 999,
          border: disabled ? "1px solid rgba(148,163,184,0.16)" : "1px solid rgba(148,163,184,0.20)",
          background: disabled ? "rgba(148,163,184,0.06)" : "rgba(148,163,184,0.08)",
          color: disabled ? "#cbd5e1" : "#64748b",
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {icon || "•"}
      </span>

      <span>{children}</span>
    </button>
  );
}

function DetailToggle({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        background: "transparent",
        color: brandBlue,
        cursor: "pointer",
        fontWeight: 700,
        padding: 0,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {open ? "Masquer le détail" : "Voir le détail"}
    </button>
  );
}

function SummaryRow({
  label,
  status,
}: {
  label: string;
  status: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid rgba(226,232,240,0.7)",
      }}
    >
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div style={{ color: "var(--muted)", fontWeight: 700 }}>{status}</div>
    </div>
  );
}



    const dossier = useMemo(() => countMissingFromSignatureStatus(sigStatus), [sigStatus]);

    const contractStatusValue = sigStatus?.contract?.status || "—";

    const contractStatusTone =
      contractStatusValue === "SIGNED"
        ? "success"
        : contractStatusValue === "IN_PROGRESS" || contractStatusValue === "DRAFT"
          ? "warning"
          : "neutral";

    const contractStatusLabel =
      contractStatusValue === "SIGNED"
        ? "Signé"
        : contractStatusValue === "IN_PROGRESS"
          ? "En cours"
          : contractStatusValue === "DRAFT"
            ? "Brouillon"
            : "Non généré";

    const contractStatusChip = (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 12px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: -0.01,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          ...statusPillStyle(contractStatusTone),
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background:
              contractStatusTone === "success"
                ? "#16a34a"
                : contractStatusTone === "warning"
                  ? "#d97706"
                  : "#94a3b8",
          }}
        />
        {contractStatusLabel}
      </span>
    );

    const contractSignersSummary = (() => {
      if (!sigStatus) return "Chargement…";

      const roles: string[] = [];
      const tenantsToSign = sigStatus.contract.tenants.filter((t) => t.signatureStatus !== "SIGNED").length;

      if (tenantsToSign > 0) {
        roles.push(tenantsToSign > 1 ? `${tenantsToSign} locataires` : "locataire");
      }

      if (String(sigStatus.contract.landlord.signatureStatus || "").toUpperCase() !== "SIGNED") {
        roles.push("bailleur");
      }

      if (roles.length === 0) return "Aucune signature requise";

      return `Signatures requises : ${roles.join(", ")}`;
    })();

    const tenantsList = sigStatus?.contract?.tenants || [];

    const tenantsTotalCount = tenantsList.length;
    const tenantsSignedCount = tenantsList.filter((t) => t.signatureStatus === "SIGNED").length;
    const tenantsPendingCount = tenantsList.filter((t) => t.signatureStatus !== "SIGNED").length;

    const tenantsSummaryChip = (
      <Badge
        tone={
          !sigStatus
            ? "neutral"
            : tenantsTotalCount === 0
              ? "neutral"
              : tenantsPendingCount === 0
                ? "success"
                : "warning"
        }
      >
        {!sigStatus
          ? "Chargement…"
          : tenantsTotalCount === 0
            ? "Aucun locataire"
            : tenantsPendingCount === 0
              ? "Tous signés"
              : `${tenantsPendingCount} à signer`}
      </Badge>
    );

    const tenantsSummaryText = !sigStatus
      ? "Chargement…"
      : tenantsTotalCount === 0
        ? "Aucun locataire"
        : tenantsPendingCount === 0
          ? `${tenantsSignedCount} signataire(s), tous signés`
          : `${tenantsPendingCount} signature(s) en attente`;

    const guaranteesCount = sigStatus?.guarantees?.length || 0;
    const guaranteesUnsignedCount = sigStatus?.guarantees?.filter((g) => g.signatureStatus !== "SIGNED").length || 0;

    const guaranteesSummaryText =
      !sigStatus
        ? "Chargement…"
        : guaranteesCount === 0
          ? "Aucune garantie"
          : guaranteesUnsignedCount === 0
            ? `${guaranteesCount} garantie(s), toutes prêtes`
            : `${guaranteesUnsignedCount} garantie(s) à finaliser`;

    const packEntry = (sigStatus as any)?.packEdlInv?.entry || null;
    const packExit = (sigStatus as any)?.packEdlInv?.exit || null;

    const edlDocsFlat = sigStatus
      ? [
          sigStatus.edl?.entry,
          sigStatus.edl?.exit,
          sigStatus.inventory?.entry,
          sigStatus.inventory?.exit,
          packEntry,
          packExit,
        ].filter(Boolean)
      : [];

    const edlInvMissingCount = edlDocsFlat.filter(
      (d: any) => !d?.documentId || isMissingStatus(d?.status)
    ).length;

    const edlInvSummaryChip = (
      <Badge
        tone={
          !sigStatus ? "neutral" : edlInvMissingCount === 0 ? "success" : edlInvMissingCount <= 2 ? "warning" : "danger"
        }
      >
        {!sigStatus
          ? "Chargement…"
          : edlInvMissingCount === 0
            ? "Tout est prêt"
            : `${edlInvMissingCount} documents restants`}
      </Badge>
    );

    const packEntryStatus = humanDocStatus(packEntry?.status);
    const packExitStatus = humanDocStatus(packExit?.status);

    const edlInvDocsSummaryText = !sigStatus
      ? "Chargement…"
      : edlInvMissingCount === 0
        ? "Tous les documents sont prêts"
        : `${edlInvMissingCount} documents restants`;

  return (
    <div style={{ padding: 18, maxWidth: 1280, margin: "0 auto", display: "grid", gap: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 2,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 34,
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: -0.045,
            color: textStrong,
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}}
        >
          <span style={{ fontWeight: 800 }}>Signature</span>{" "}
          <span style={{ fontWeight: 500 }}>& Documents</span>
        </h1>

        <Btn
          variant="secondary"
          onClick={refreshAll}
          disabled={loadingSigStatus}
          style={{
            borderRadius: 16,
            padding: "10px 16px",
            background: "#f8fafc",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden="true" style={{ display: "inline-flex", lineHeight: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 12a8 8 0 1 1-2.34-5.66"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M20 4v6h-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            Rafraîchir
          </span>
        </Btn>
      </div>
      <div
        style={{
          ...ui.card,
          padding: "28px 32px",
          display: "flex",
          justifyContent: "space-between",
          gap: 24,
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: textStrong,
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            Bail #{leaseId.slice(0, 8)}…
          </div>

          <div
            style={{
              marginTop: 16,
              fontSize: 16,
              lineHeight: 1.5,
              color: "#334155",
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            <span style={{ color: "#64748b" }}>Locataire :</span>{" "}
            <span style={{ fontWeight: 800, color: "#1f2937" }}>
              {sigStatus?.contract?.tenants?.[0]?.fullName || tenants?.[0]?.full_name || "—"}
            </span>
            {" — "}
            <span style={{ color: "#64748b" }}>Statut :</span>{" "}
            <span style={{ color: "#b45309", fontWeight: 700 }}>
              {!sigStatus
                ? "Chargement…"
                : tenantsTotalCount > 0
                  ? tenantsPendingCount === 0
                    ? `Tous signés (${tenantsSignedCount}/${tenantsTotalCount})`
                    : `Signatures en attente (${tenantsSignedCount}/${tenantsTotalCount})`
                  : dossier.missing === 0
                    ? "Dossier prêt"
                    : `${dossier.missing} action(s) restante(s)`}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {!sigStatus ? (
            <Badge tone="neutral">Chargement…</Badge>
          ) : dossier.missing > 0 ? (
            <Badge tone="warning">{`${dossier.missing} action(s) à faire`}</Badge>
          ) : (
            <Badge tone="success">Dossier prêt</Badge>
          )}

          <Btn
            variant="primary"
            onClick={() => scrollToAnchor(dossier.firstAnchor)}
            disabled={!sigStatus}
            title={!sigStatus ? "Charge d’abord le statut" : ""}
            style={{
              padding: "12px 18px",
              borderRadius: 16,
              background: brandBlue,
              border: `1px solid ${brandBlue}`,
              boxShadow: "0 1px 2px rgba(53,106,195,0.18)",
            }}
          >
            Terminer le dossier
          </Btn>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
        <a href="#contract" style={anchorTabStyle}>
          Contrat
        </a>
        <a href="#tenants" style={anchorTabStyle}>
          Locataires
        </a>
        <a href="#guarantees" style={anchorTabStyle}>
          Garanties
        </a>
        <a href="#edl-inv" style={anchorTabStyle}>
          EDL & Inventaires
        </a>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `html{scroll-behavior:smooth}` }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 420px",
          gap: 16,
          alignItems: "end",
          marginTop: 4,
          marginBottom: -2,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 0.8,
            color: "#334155",
            textTransform: "uppercase",
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          Documents
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 0.8,
            color: "#334155",
            textTransform: "uppercase",
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          Signature
</div>
      </div>

      <div className="sign-grid" style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>
          {/* LEFT COLUMN START */}

      <Card
        id="contract"
        title="Contrat de location"
        subtitle="Document principal du bail"
        right={
          <button
            type="button"
            onClick={() => {
              setGuaranteesMenuOpen(false);
              setEdlMenuOpen(false);
              setContractMenuOpen((v) => !v);
            }}
            style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            color: "#94a3b8",
            padding: 2,
          }}
                    >
            ⋯
          </button>
        }
      >
          {contractMenuOpen ? (
            <InlineMenu title="Contrat">
              <MenuItem
                icon="↓"
                onClick={() => {
                  setContractMenuOpen(false);
                  downloadContractPdf();
                }}
                disabled={!contractDoc?.id}
              >
                Télécharger contrat
              </MenuItem>

              {isRP ? (
                <MenuItem
                  icon="+"
                  onClick={() => {
                    setContractMenuOpen(false);
                    generateNotice();
                  }}
                >
                  Générer notice
                </MenuItem>
              ) : null}

              {isRP ? (
                <MenuItem
                  icon="↓"
                  onClick={() => {
                    setContractMenuOpen(false);
                    downloadNoticePdf();
                  }}
                  disabled={!noticeDoc?.id}
                >
                  Télécharger notice
                </MenuItem>
              ) : null}
            </InlineMenu>
          ) : null}

          {!sigStatus && loadingSigStatus ? (
            <div style={{ marginTop: 8, fontSize: 13, color: muted }}>Chargement…</div>
          ) : null}

          {sigStatusError ? (
            <div style={{ marginTop: 8, fontSize: 13, color: "#b91c1c" }}>{sigStatusError}</div>
          ) : null}

          {sigStatus ? (
            <>
              <SignableCard
                title="Contrat de location"
                statusChip={contractStatusChip}
                subtitle={
                  <div style={{ display: "grid", gap: 6 }}>
                    <div>{contractSignersSummary}</div>
                  </div>
                }
                actions={[
                  {
                    label: "Générer PDF",
                    kind: "primary",
                    onClick: generateContract,
                  },
                  {
                    label: "Télécharger",
                    kind: "secondary",
                    disabled: !sigStatus.contract.documentId,
                    onClick: () =>
                      sigStatus.contract.documentId &&
                      downloadDoc(sigStatus.contract.documentId, sigStatus.contract.filename || "contrat.pdf"),
                  },
                  {
                    label: "Télécharger signé",
                    kind: "secondary",
                    disabled: !sigStatus.contract.signedFinalDocumentId,
                    onClick: () =>
                      sigStatus.contract.signedFinalDocumentId &&
                      downloadDoc(sigStatus.contract.signedFinalDocumentId, "contrat_SIGNE.pdf"),
                  },
                ]}
              />

              <div style={{ marginTop: 10 }}>
                <DetailToggle
                  open={showContractDetails}
                  onClick={() => setShowContractDetails((v) => !v)}
                />
              </div>

              {showContractDetails ? (
                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  {finalSignedDoc?.id ? (
                    <div style={card(border)}>
                      <h3 style={{ marginTop: 0 }}>PDF signé final</h3>
                      <div style={{ color: muted, marginBottom: 10 }}>{finalSignedDoc.filename}</div>
                      <button
                        onClick={() => downloadDoc(finalSignedDoc.id, finalSignedDoc.filename)}
                        style={btnPrimarySmall()}
                      >
                        Télécharger PDF signé
                      </button>
                    </div>
                  ) : null}

                  {packFinalV2Doc?.id ? (
                    <div style={card(border)}>
                      <h3 style={{ marginTop: 0 }}>PACK_FINAL signé (V2)</h3>
                      <div style={{ color: muted, marginBottom: 10 }}>{packFinalV2Doc.filename}</div>
                      <button
                        onClick={() => downloadDoc(packFinalV2Doc.id, packFinalV2Doc.filename)}
                        style={btnPrimarySmall()}
                      >
                        Télécharger PACK_FINAL signé
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
      </Card>
      
      {/* ========================= */}
      {/* Locataires (signature)    */}
      {/* ========================= */}
      <Card
        id="tenants"
        title="Suivi des signatures locataires"
        subtitle="Envoi et relance des liens de signature"
      >
        {!sigStatus && loadingSigStatus ? (
          <div style={{ marginTop: 8, fontSize: 13, color: muted }}>Chargement…</div>
        ) : null}

        {sigStatusError ? (
          <div style={{ marginTop: 8, fontSize: 13, color: "#b91c1c" }}>{sigStatusError}</div>
        ) : null}

        {sigStatus ? (
          <SignableCard
            title="Liens de signature"
            statusChip={tenantsSummaryChip}
            subtitle={
              <div style={{ display: "grid", gap: 6 }}>
                <div>{tenantsSummaryText}</div>
              </div>
            }
            actions={[
              {
                label: "Envoyer les liens",
                kind: "primary",
                disabled: !contractDoc?.id,
                onClick: () => sendPublicLink(false),
              },
              {
                label: "Renvoyer",
                kind: "secondary",
                disabled: !contractDoc?.id,
                onClick: () => sendPublicLink(true),
              },
            ]}
          />
        ) : null}

        <div style={{ marginTop: 10 }}>
          <DetailToggle
            open={showTenantsDetails}
            onClick={() => setShowTenantsDetails((v) => !v)}
          />
        </div>

        {showTenantsDetails ? (
          <div style={{ marginTop: 12 }}>
            {!sigStatus?.contract?.tenants?.length ? (
              <div style={{ marginTop: 8, fontSize: 13, color: muted }}>Aucun locataire.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {sigStatus.contract.tenants.map((t) => (
                  <div
                    key={t.leaseTenantId}
                    style={{ border: `1px solid ${border}`, borderRadius: 14, padding: 12 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 240 }}>
                        <div style={{ fontWeight: 800 }}>
                          {t.fullName} <span style={{ color: muted }}>({t.role || "tenant"})</span>
                        </div>

                        <div style={{ fontSize: 13, color: muted, marginTop: 6 }}>
                          Statut:{" "}
                          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                            {humanDocStatus(t.signatureStatus)}
                          </span>
                          {t.lastLink?.createdAt ? (
                            <span style={{ marginLeft: 8 }}>
                              (lien: {new Date(t.lastLink.createdAt).toLocaleString()})
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          style={btnSecondary()}
                          onClick={() => fetchSignatureStatus(leaseId)}
                        >
                          Rafraîchir statuts
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </Card>

      <Card
        id="guarantees"
        title="Garanties"
        subtitle="Actes de caution"
        right={
          <button
            type="button"
            onClick={() => {
              setContractMenuOpen(false);
              setEdlMenuOpen(false);
              setGuaranteesMenuOpen((v) => !v);
            }}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              color: "#94a3b8",
              padding: 2,
            }}
          >
            ⋯
          </button>
        }
      >
        {guaranteesMenuOpen ? (
          <InlineMenu title="Garanties">
            <MenuItem
              icon="→"
              onClick={() => {
                setGuaranteesMenuOpen(false);
                openGuarantees();
              }}
            >
              Gérer garanties
            </MenuItem>
          </InlineMenu>
        ) : null}

        {!sigStatus && loadingSigStatus ? (
          <div style={{ marginTop: 8, fontSize: 13, color: muted }}>Chargement…</div>
        ) : null}

        {sigStatusError ? (
          <div style={{ marginTop: 8, fontSize: 13, color: "#b91c1c" }}>{sigStatusError}</div>
        ) : null}

        {sigStatus ? (
          <SignableCard
            title="Garanties"
            statusChip={
              <Badge tone={guaranteesCount > 0 ? (guaranteesUnsignedCount === 0 ? "success" : "warning") : "neutral"}>
                {guaranteesCount > 0 ? `${guaranteesCount} garantie(s)` : "Aucune"}
              </Badge>
            }
            subtitle={
              <div style={{ display: "grid", gap: 6 }}>
                <div>{guaranteesSummaryText}</div>
              </div>
            }
            actions={[
              {
                label: "Gérer",
                kind: "primary",
                onClick: openGuarantees,
              },
            ]}
          />
        ) : null}

        <div style={{ marginTop: 10 }}>
          <DetailToggle
            open={showGuaranteesDetails}
            onClick={() => setShowGuaranteesDetails((v) => !v)}
          />
        </div>

        {showGuaranteesDetails ? (
          <div style={{ marginTop: 12 }}>
            {sigStatus && sigStatus.guarantees.length === 0 ? (
              <div style={{ marginTop: 8, fontSize: 13, color: muted }}>
                Aucune garantie CAUTION sélectionnée.
              </div>
            ) : null}

            {sigStatus && sigStatus.guarantees.length > 0 ? (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {sigStatus.guarantees.map((g) => {
                  const statusText =
                    g.signatureStatus === "SIGNED"
                      ? "🟢 Signé"
                      : g.signatureStatus === "IN_PROGRESS"
                        ? "🟡 En cours"
                        : g.signatureStatus === "SENT"
                          ? "🟠 Lien envoyé"
                          : "🔵 Non envoyé";

                  const linkState = !g.lastLink ? "non envoyé" : g.lastLink.consumedAt ? "consommé" : "actif";

                  const ackTenant = g.tenantId;
                  const ackRequired = Boolean(g.ack?.required);
                  const ackInfo = ackRequired ? (g.ack?.tenants || []).find((t) => t.tenantId === ackTenant) : null;
                  const ackOk = Boolean(ackInfo?.acknowledged);

                  const primaryLabel =
                    g.signatureStatus === "SIGNED"
                      ? "📤 Partager au garant"
                      : g.lastLink
                        ? "Renvoyer lien signature"
                        : "Envoyer lien signature";

                  const actId = guaranteeActOverride[g.guaranteeId] || g.actDocumentId;

                  return (
                    <SignableCard
                      key={g.guaranteeId}
                      title={`Acte de caution — ${g.guarantorFullName || "Garant"} → ${g.tenantFullName}`}
                      statusChip={
                        <span style={chip("#e5e7eb", g.signatureStatus === "SIGNED" ? "#16a34a" : "#b45309")}>
                          {statusText}
                        </span>
                      }
                      subtitle={
                        <div style={{ display: "grid", gap: 6 }}>
                          <div>
                            <strong>Lien :</strong> {linkState}
                            {g.lastLink?.createdAt ? ` • ${new Date(g.lastLink.createdAt).toLocaleString()}` : ""}
                          </div>
                          <div>
                            <strong>ACK locataire :</strong>{" "}
                            {!ackRequired ? "—" : ackOk ? "pris connaissance ✅" : "à confirmer"}
                          </div>
                        </div>
                      }
                      actions={[
                        {
                          label: primaryLabel,
                          onClick: () => {
                            if (g.signatureStatus === "SIGNED") {
                              return sendGuarantorLinkByGuarantee(g.guaranteeId, false, "SHARE_SIGNED").catch((e: any) =>
                                alert(e.message || String(e))
                              );
                            }
                            return sendGuarantorLinkByGuarantee(g.guaranteeId, false, "SIGN").catch((e: any) =>
                              alert(e.message || String(e))
                            );
                          },
                          disabled: g.signatureStatus === "SIGNED" ? !g.signedFinalDocumentId : !actId,
                        },
                        {
                          label: "Générer acte",
                          kind: "secondary",
                          disabled: Boolean(actId),
                          onClick: async () => {
                            await generateGuarantorActFor(g.guaranteeId);
                            await fetchSignatureStatus(leaseId);
                          },
                        },
                        {
                          label: "Télécharger PDF",
                          kind: "secondary",
                          disabled: !actId,
                          onClick: () => actId && downloadDoc(actId, "acte_caution.pdf"),
                        },
                        {
                          label: "ACK : Marquer comme lu",
                          kind: "secondary",
                          disabled: !ackRequired || ackOk || !g.signedFinalDocumentId,
                          onClick: () =>
                            g.signedFinalDocumentId &&
                            acknowledgeDoc(g.signedFinalDocumentId, ackTenant).catch((e: any) =>
                              alert(e.message || String(e))
                            ),
                        },
                      ]}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      {sigStatus && (
        <Card
          id="edl-inv"
          title="EDL & Inventaires"
          subtitle="Entrée, sortie et packs"
          right={
            <button
              type="button"
              onClick={() => {
                setContractMenuOpen(false);
                setGuaranteesMenuOpen(false);
                setEdlMenuOpen((v) => !v);
              }}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
                color: "#94a3b8",
                padding: 2,
              }}
            >
              ⋯
            </button>
          }
        >
          {edlMenuOpen ? (
            <InlineMenu title="EDL & Inventaires">
              <MenuItem
                icon="+"
                onClick={() => {
                  setEdlMenuOpen(false);
                  generatePack();
                }}
              >
                Générer pack (EDL + Inventaire)
              </MenuItem>

              <MenuItem
                icon="↓"
                onClick={() => {
                  setEdlMenuOpen(false);
                  downloadPackPdf();
                }}
                disabled={!packDoc?.id}
              >
                Télécharger pack
              </MenuItem>

              <MenuItem
                icon="✓"
                onClick={() => {
                  setEdlMenuOpen(false);
                  generatePackFinalV2();
                }}
              >
                Générer PACK_FINAL signé (V2)
              </MenuItem>
            </InlineMenu>
          ) : null}

          <SignableCard
            title="EDL & Inventaires"
            statusChip={edlInvSummaryChip}
            subtitle={
              <div style={{ display: "grid", gap: 2 }}>
                <SummaryRow label="Pack entrée" status={packEntryStatus} />
                <SummaryRow label="Pack sortie" status={packExitStatus} />
                <SummaryRow label="EDL / Inventaires" status={edlInvDocsSummaryText} />
              </div>
            }
            actions={[
              {
                label: "Générer PDF",
                kind: "primary",
                onClick: generatePack,
              },
              {
                label: "Télécharger",
                kind: "secondary",
                disabled: !packDoc?.id,
                onClick: downloadPackPdf,
              },
            ]}
          />

          <div style={{ marginTop: 10 }}>
            <DetailToggle
              open={showEdlInvDetails}
              onClick={() => setShowEdlInvDetails((v) => !v)}
            />
          </div>

          {showEdlInvDetails ? (
            <div style={{ marginTop: 12 }}>
              {/* ✅ Pack EDL + Inventaire (recommandé) */}
              {[packEntry, packExit]
                .filter(Boolean)
                .map((p: any) => (
                  <div
                    key={p.key || p.label}
                    style={{
                      border: `1px solid ${border}`,
                      borderRadius: 14,
                      padding: 12,
                      marginTop: 10,
                      background: "rgba(248,250,252,0.9)",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>
                      {p.label} <span style={{ color: muted, fontWeight: 700 }}>— recommandé</span>
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: muted,
                        marginTop: 6,
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>Statut:</span>
                      <Badge tone={toneFromStatus(p.status)}>{humanDocStatus(p.status)}</Badge>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                      <button
                        style={btnAction()}
                        disabled={Boolean(p.documentId)}
                        onClick={() => {
                          const phase = String(p.key || "").includes("exit") ? "exit" : "entry";
                          return generatePackEdlInv(phase as "entry" | "exit");
                        }}
                      >
                        Générer PDF
                      </button>

                      <button
                        style={btnSecondary()}
                        disabled={!p.documentId}
                        onClick={() =>
                          p.documentId && downloadDoc(p.documentId, p.filename || `${p.key || "pack_edl_inv"}.pdf`)
                        }
                      >
                        Télécharger PDF
                      </button>

                      <button
                        style={btnSecondary()}
                        disabled={!p.signedFinalDocumentId}
                        onClick={() =>
                          p.signedFinalDocumentId &&
                          downloadDoc(p.signedFinalDocumentId, `${p.key || "pack_edl_inv"}_SIGNE.pdf`)
                        }
                      >
                        Télécharger signé
                      </button>
                    </div>
                  </div>
                ))}

              {[
                sigStatus.edl?.entry,
                sigStatus.edl?.exit,
                sigStatus.inventory?.entry,
                sigStatus.inventory?.exit,
              ]
                .filter(Boolean)
                .map((d: any) => (
                  <div key={d.key} style={{ border: `1px solid ${border}`, borderRadius: 14, padding: 12, marginTop: 10 }}>
                    <div style={{ fontWeight: 800 }}>{d.label}</div>

                    <div
                      style={{
                        fontSize: 13,
                        color: muted,
                        marginTop: 6,
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>Statut:</span>
                      <Badge tone={toneFromStatus(d.status)}>{humanDocStatus(d.status)}</Badge>
                    </div>

                    <div style={{ fontSize: 13, color: muted, marginTop: 6 }}>
                      Bailleur: {d.need?.landlord?.signed ? "✅ signé" : "❌ manquant"} •
                      Locataires:{" "}
                      {(d.need?.tenants || []).filter((t: any) => !t.signed).length === 0
                        ? "✅ tous signés"
                        : "❌ manquants"}
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                      <button
                        style={btnAction()}
                        disabled={Boolean(d.documentId)}
                        onClick={() => {
                          const k = String(d.key || "");
                          if (k === "edl:entry" || k === "edl_entry") return generateEdl("entry");
                          if (k === "edl:exit" || k === "edl_exit") return generateEdl("exit");
                          if (k === "inv:entry" || k === "inv_entry") return generateInventory("entry");
                          if (k === "inv:exit" || k === "inv_exit") return generateInventory("exit");
                        }}
                      >
                        Générer PDF
                      </button>

                      <button
                        style={btnSecondary()}
                        disabled={!d.documentId}
                        onClick={() => d.documentId && downloadDoc(d.documentId, d.filename || `${d.key}.pdf`)}
                      >
                        Télécharger PDF
                      </button>

                      <button
                        style={btnSecondary()}
                        disabled={!d.signedFinalDocumentId}
                        onClick={() => d.signedFinalDocumentId && downloadDoc(d.signedFinalDocumentId, `${d.key}_SIGNE.pdf`)}
                      >
                        Télécharger signé
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          ) : null}
        </Card>
      )}
      {/* LEFT COLUMN END */}
      </div>

      {/* RIGHT COLUMN START */}
        <div
          className="sign-sticky"
          style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div
            style={{
              background: "#fff",
              border: "1px solid #d9dee7",
              borderRadius: 22,
              padding: 18,
              boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
            }}
          >
            <div style={{ height: 2 }} />

            {/* Role */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: textSoft, fontWeight: 600 }}>Signer en tant que</div>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as any);
                  clearCanvas();
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: `1px solid ${borderSoftStrong}`,
                  background: "#fff",
                  fontWeight: 700,
                  color: "#1f2937",
                  fontFamily:
                    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                <option value="LOCATAIRE">Locataire</option>
                <option value="BAILLEUR">Bailleur</option>
                <option value="GARANT">Garant</option>
              </select>
            </div>

            <div style={{ height: 10 }} />

            {/* Locataire multi */}
            {role === "LOCATAIRE" && hasMultipleTenants ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, color: textSoft, fontWeight: 600 }}>
                  Locataire signataire <span style={{ color: "#dc2626" }}>*</span>
                </div>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: `1px solid ${borderSoftStrong}`,
                    background: "#fff",
                    fontWeight: 500,
                    color: "#1f2937",
                    fontFamily:
                      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
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

            {/* Document */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: textSoft, fontWeight: 600 }}>Document à signer</div>

              {role === "GARANT" ? (
                <select
                  value={selectedGuaranteeId}
                  onChange={(e) => setSelectedGuaranteeId(e.target.value)}
                  disabled={guarantorSignables.length === 0}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: `1px solid ${borderSoftStrong}`,
                    background: "#fff",
                    fontWeight: 500,
                    color: "#1f2937",
                    fontFamily:
                      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
                  value={role === "LOCATAIRE" ? selectedTenantDocKey : selectedLandlordDocKey}
                  onChange={(e) => {
                    if (role === "LOCATAIRE") setSelectedTenantDocKey(e.target.value);
                    else setSelectedLandlordDocKey(e.target.value);
                    clearCanvas();
                  }}
                  disabled={!landlordSignables.length}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: `1px solid ${borderSoftStrong}`,
                    background: "#fff",
                    fontWeight: 500,
                    color: "#1f2937",
                    fontFamily:
                      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                  Acte non généré. Va dans “Garanties (caution)” puis clique “Générer acte”.
                </div>
              ) : null}
            </div>

            <div style={{ height: 10 }} />

            {/* Nom */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: textSoft, fontWeight: 600 }}>Nom signataire</div>
              <input
                value={role === "LOCATAIRE" ? tenantName : role === "BAILLEUR" ? landlordName : guarantorName}
                onChange={(e) => {
                  if (role === "LOCATAIRE") setTenantName(e.target.value);
                  else if (role === "BAILLEUR") setLandlordName(e.target.value);
                  else setGuarantorName(e.target.value);
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: `1px solid ${borderSoftStrong}`,
                  background: "#fff",
                  fontWeight: 500,
                  color: "#1f2937",
                  fontFamily:
                    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ height: 12 }} />

            {/* Pad */}
            <div style={{ fontSize: 12, color: textSoft, fontWeight: 600, marginBottom: 6 }}>Signature</div>

            <div
              style={{
                width: "100%",
                height: 180,
                borderRadius: 12,
                border: `1px solid ${borderSoftStrong}`,
                background: "white",
                overflow: "hidden",
              }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
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

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
              <button
                onClick={clearCanvas}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: `1px solid ${borderSoftStrong}`,
                  background: "#fff",
                  fontWeight: 700,
                  color: "#1f2937",
                  fontFamily:
                    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                Effacer
              </button>

              <button
                onClick={async () => {
                  if (role === "LOCATAIRE") await signTenantOnPlace();
                  else if (role === "BAILLEUR") await signLandlordOnPlace();
                  else await signGuarantorOnPlace();
                }}
                disabled={role === "GARANT" && !!selectedGuarantor && !selectedGuarantor.documentId}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: `1px solid ${brandBlue}`,
                  background: brandBlue,
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 500,
                  boxShadow: "0 1px 2px rgba(53,106,195,0.18)",
                  opacity: role === "GARANT" && !!selectedGuarantor && !selectedGuarantor.documentId ? 0.6 : 1,
                  fontFamily:
                    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                Signer
              </button>
            </div>

            {/* Feedback */}
            {status ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "rgba(100,116,139,0.06)",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 12, color: "var(--muted)" }}>Statut</div>
                <div style={{ marginTop: 4, fontWeight: 800 }}>{status}</div>
              </div>
            ) : null}

            {error ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(239,68,68,0.25)",
                  background: "rgba(239,68,68,0.08)",
                  color: "var(--danger)",
                  fontWeight: 800,
                }}
              >
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
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

function card(border: string) {
  return {
    border: `1px solid ${border}`,
    borderRadius: 16,
    background: "#fff",
    padding: 14,
    minWidth: 0,
  } as const;
}

function btnPrimarySmall() {
  return {
    padding: "10px 14px",
    borderRadius: 14,
    border: `1px solid ${brandBlue}`,
    background: brandBlue,
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "center" as const,
    boxShadow: "0 1px 2px rgba(53,106,195,0.18)",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } as const;
}

function btnSecondary() {
  return {
    padding: "10px 14px",
    borderRadius: 14,
    border: `1px solid ${borderSoftStrong}`,
    background: "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
    color: "#0f172a",
    boxShadow: "0 1px 1px rgba(15,23,42,0.03)",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } as const;
}

function btnAction() {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: `1px solid ${borderSoftStrong}`,
    background: "#ffffff",
    cursor: "pointer",
    fontWeight: 700,
    minWidth: 160,
    textAlign: "center" as const,
    color: "#0f172a",
    boxShadow: "0 1px 1px rgba(15,23,42,0.03)",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  } as const;
}


function statusPillStyle(tone: "success" | "warning" | "neutral") {
  if (tone === "success") {
    return {
      background: "rgba(22,163,74,0.10)",
      color: "#15803d",
      border: "1px solid transparent",
    } as const;
  }

  if (tone === "warning") {
    return {
      background: "rgba(217,119,6,0.10)",
      color: "#b45309",
      border: "1px solid transparent",
    } as const;
  }

  return {
    background: "#f1f5f9",
    color: "#64748b",
    border: "1px solid transparent",
  } as const;
}

function chip(border: string, color: string) {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: "#fff",
    color,
    fontWeight: 800,
    fontSize: 12,
  } as const;
}