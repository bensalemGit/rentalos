"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { extractLeaseBundle } from "../../_lib/extractLease";
import type { SignatureStatusPayload } from "../../_lib/signatureStatus.types";
import { mapSignatureData } from "./_lib/mapSignatureData";
import { SignatureHero } from "./_components/SignatureHero";
import { SignerSection } from "./_components/SignerSection";
import type {
  SignerTask,
  PackFinalReadiness,
} from "./_types/signature-center.types";
import { DocumentsSection } from "./_components/DocumentsSection";
import { HistorySection, type HistoryItem } from "./_components/HistorySection";
import { SignatureSessionPanel } from "./_components/SignatureSessionPanel";
import { SIGN_UI } from "./_components/signature-ui";
import {
  fetchSignatureWorkflow,
  createCanonicalPublicLink,
} from "../../_lib/api";
import type {
  CanonicalSignatureWorkflow,
  CanonicalSignatureTask,
} from "../../_lib/canonical-signature.types";
import {
  canCreateCanonicalLink,
  toCanonicalPublicLinkInput,
} from "./_lib/canonical-link-mapper";
import { isEntryPackType } from "@app/_lib/documentTypeLabels";


const brandBlue = "#2F63E0";
const brandBlueBorder = "#2A5BD7";
const textStrong = "#1D273B";
const borderSoftStrong = "#C8D4E3";

const UI_FONT =
  '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

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


type HistoryDocument = {
  id: string;
  label: string;
  filename?: string | null;
  signedFinalDocumentId?: string | null;
};

function normalizeMention(s: string) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[€.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMentionValid(input: string, expected: string) {
  const a = normalizeMention(input);
  const e = normalizeMention(expected);

  if (!a || !e) return false;

  const requiredFragments = [
    "en me portant caution solidaire",
    "dans la limite de la somme",
    "couvrant le paiement du principal",
    "penalites ou interets de retard",
    "je m'engage a rembourser au bailleur",
    "sur mes revenus et mes biens",
    "je reconnais avoir parfaitement connaissance",
    "nature et de l'etendue de mon engagement",
  ];

  const hasRequiredFragments = requiredFragments.every((fragment) =>
    a.includes(normalizeMention(fragment))
  );

  const expectedAmountMatch = e.match(/somme de ([0-9 ]+)/);
  const expectedAmount = expectedAmountMatch?.[1]?.replace(/\s+/g, "");

  const actualHasAmount = expectedAmount
    ? a.replace(/\s+/g, "").includes(expectedAmount)
    : true;

  return hasRequiredFragments && actualHasAmount;
}

function formatEurosFromCents(cents: number) {
  return `${(Number(cents || 0) / 100).toFixed(2)} €`;
}



function compactHistoryName(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return parts.slice(0, 2).join(" ");
}

function compactHistoryDocumentLabel(label?: string) {
  const value = String(label || "").trim();
  if (!value) return "Document";

  if (/contrat/i.test(value)) return "Contrat";
  if (/acte/i.test(value)) return "Acte";
  if (/pack final/i.test(value)) return "Pack final";
  if (/pack/i.test(value)) return "Pack";
  if (/notice/i.test(value)) return "Notice";
  return value;
}

function buildHistoryItems(tasks: SignerTask[], docs: HistoryDocument[]): HistoryItem[] {
  const items: Array<HistoryItem & { sortKey: number }> = [];

  tasks.forEach((task) => {
    const actor = compactHistoryName(task.displayName);
    const docLabel = compactHistoryDocumentLabel(task.documentLabel);

    if (task.hasActiveLink && task.activeLinkCreatedAt) {
      const time = new Date(task.activeLinkCreatedAt).getTime();

      items.push({
        id: `link:${task.id}`,
        dateLabel: new Date(task.activeLinkCreatedAt).toLocaleDateString(),
        title: `Lien envoyé à ${actor}`,
        subtitle: docLabel,
        sortKey: Number.isNaN(time) ? 0 : time,
      });
    }

    if (task.status === "SIGNED") {
      items.push({
        id: `signed:${task.id}`,
        dateLabel: "Récent",
        title: `${actor} a signé`,
        subtitle: docLabel,
        sortKey: 8_000_000_000_000,
      });
    }

    if (task.requiresPreparation) {
      items.push({
        id: `prepare:${task.id}`,
        dateLabel: "À faire",
        title:
          task.kind === "GUARANTOR"
            ? `Acte à préparer · ${actor}`
            : `Contrat à préparer · ${actor}`,
        subtitle: undefined,
        sortKey: 9_000_000_000_000,
      });
    }
  });

  docs.forEach((doc) => {
    const docLabel = compactHistoryDocumentLabel(doc.label);
    if (doc.signedFinalDocumentId) {
      items.push({
        id: `doc:${doc.id}`,
        dateLabel: "Disponible",
        title: `${docLabel} signé`,
        subtitle: undefined,
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

  const [packFinalReadiness, setPackFinalReadiness] = useState<PackFinalReadiness | null>(null);
  const [loadingPackFinalReadiness, setLoadingPackFinalReadiness] = useState(false);
  const [packFinalReadinessError, setPackFinalReadinessError] = useState<string | null>(null);

  // lease kind
  const [leaseKind, setLeaseKind] = useState("");

  // ✅ NEW: tenants list for multi-tenant signature
  const [tenants, setTenants] = useState<LeaseTenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // ✅ NEW: panneau signature unique (droite)
  const [isWideScreen, setIsWideScreen] = useState(true);

  // canvas unique
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const signatureDirty = useRef(false);
  const [isSignatureDirty, setIsSignatureDirty] = useState(false);
  const signaturePanelRef = useRef<HTMLDivElement | null>(null);


  const [tenantName, setTenantName] = useState("Locataire");
  const [landlordName, setLandlordName] = useState("Bailleur");

  const [leaseFinancials, setLeaseFinancials] = useState({
    rentCents: 0,
    chargesCents: 0,
    durationMonths: 12,
  });

  const [sigStatus, setSigStatus] = useState<SignatureStatusPayload | null>(null);
  const [canonicalWorkflow, setCanonicalWorkflow] =
    useState<CanonicalSignatureWorkflow | null>(null);
  const [loadingCanonicalWorkflow, setLoadingCanonicalWorkflow] = useState(false);
  const [canonicalWorkflowError, setCanonicalWorkflowError] = useState<string | null>(null);
  // ✅ Local override: permet d'utiliser immédiatement l'id d'acte renvoyé par /documents/guarantor-act
  const [guaranteeActOverride, setGuaranteeActOverride] = useState<Record<string, string>>({});
  const [loadingSigStatus, setLoadingSigStatus] = useState(false);
  const [sigStatusError, setSigStatusError] = useState<string | null>(null);

  const [pendingModeSwitchTask, setPendingModeSwitchTask] = useState<SignerTask | null>(null);
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);
  const [onsiteGuarantorMention, setOnsiteGuarantorMention] = useState("");
 
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

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);


function setupCanvasHiDpi(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.style.touchAction = "none";

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
  if (!sessionDraft.open) return;

  let cleanup: (() => void) | undefined;

  const id = window.setTimeout(() => {
    const c = canvasRef.current;
    if (!c) return;

    const apply = () => setupCanvasHiDpi(c);
    apply();

    const observer = new ResizeObserver(apply);
    observer.observe(c);

    window.addEventListener("resize", apply);

    cleanup = () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, 50);

  return () => {
    window.clearTimeout(id);
    cleanup?.();
  };
}, [sessionDraft.open, sessionDraft.signerTaskId]);


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
      const leaseTerms = (lease as any)?.lease_terms || {};
      const durationMonths = Number(leaseTerms?.durationMonths || 12);
      const rentCents = Number((lease as any)?.rent_cents || 0);
      const chargesCents = Number((lease as any)?.charges_cents || 0);

      setLeaseFinancials({
        rentCents,
        chargesCents,
        durationMonths,
      });
      const resolvedLandlordName = String(
        (lease as any)?.landlord_name ||
          (lease as any)?.landlordName ||
          (lease as any)?.landlord?.name ||
          (lease as any)?.project_landlord_name ||
          ""
      ).trim();

      if (resolvedLandlordName) {
        setLandlordName(resolvedLandlordName);
      }
      
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

      setPackDoc(null);

      // ✅ PACK_FINAL V2 (signé) : doc type PACK_FINAL dont filename contient PACK_FINAL_V2
      const packFinalV2 =
        arr
          .filter((d: any) => isEntryPackType(d.type) && String(d.filename || "").includes("PACK_FINAL_V2"))
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

    loadDocs();
    fetchSignatureStatus(leaseId).catch(() => {});
    fetchCanonicalWorkflow(leaseId).catch(() => {});
    fetchPackFinalReadiness(leaseId).catch(() => {});
  }, [token, leaseId]);


async function generateExitCertificate() {
  setError("");
  setStatus("Génération attestation de sortie…");

  try {
    const r = await fetch(`${API}/documents/exit-certificate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      body: JSON.stringify({ leaseId }),
    });

    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      setStatus("");
      setError(j?.message || JSON.stringify(j));
      return;
    }

    setStatus("Attestation générée ✅");
    await refreshAll();
  } catch (e: any) {
    setStatus("");
    setError(String(e?.message || e));
  }
}

async function generateExitPack() {
  setError("");
  setStatus("Génération pack sortie…");

  try {
    const r = await fetch(`${API}/documents/exit-pack`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      body: JSON.stringify({ leaseId }),
    });

    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      setStatus("");
      setError(j?.message || JSON.stringify(j));
      return;
    }

    setStatus("Pack sortie généré ✅");
    await refreshAll();
  } catch (e: any) {
    setStatus("");
    setError(String(e?.message || e));
  }
}

async function generateContract(force = false) {
  setError("");

  const shouldForce =
    force ||
    Boolean(contractDoc?.id && !finalSignedDoc?.id);

  if (shouldForce && contractDoc?.id && !finalSignedDoc?.id) {
    const ok = window.confirm(
      "Un contrat existe déjà. Voulez-vous le régénérer avec les dernières données du bail ?\n\n" +
      "Possible uniquement si aucune signature n’a encore été enregistrée."
    );

    if (!ok) return;
  }

  setStatus(shouldForce ? "Régénération du contrat…" : "Génération du contrat…");

  try {
    const r = await fetch(
      `${API}/documents/contract${shouldForce ? "?force=true" : ""}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId }),
      }
    );

    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      setStatus("");
      setError(j?.message || JSON.stringify(j));
      return;
    }

    setStatus(shouldForce ? "Contrat régénéré ✅" : "Contrat généré ✅");
    await refreshAll();
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
      await refreshAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function generateEdl(phase: "entry" | "exit", force = false) {
    setError("");
    setStatus(
      `${force ? "Régénération" : "Génération"} EDL ${phase === "entry" ? "entrée" : "sortie"}…`
    );

    try {
      const r = await fetch(`${API}/documents/edl`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId, phase, force }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }

      setStatus(force ? "EDL régénéré ✅" : "EDL généré ✅");
      await refreshAll();
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function generateInventory(phase: "entry" | "exit", force = false) {
    setError("");
    setStatus(
      `${force ? "Régénération" : "Génération"} inventaire ${phase === "entry" ? "entrée" : "sortie"}…`
    );

    try {
      const r = await fetch(`${API}/documents/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ leaseId, phase, force }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        return;
      }

      setStatus(force ? "Inventaire régénéré ✅" : "Inventaire généré ✅");
      await refreshAll();
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
      await refreshAll();
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
      await refreshAll();
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
      await refreshAll();
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

  function closeSessionDraft() {
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


function findCanonicalTaskForLegacyTask(task: SignerTask): CanonicalSignatureTask | null {
  const tasks = canonicalWorkflow?.tasks ?? [];

  // CONTRAT / LOCATAIRE
  if (task.kind === "TENANT" && task.documentLabel === "Contrat de location" && task.tenantId) {
    return (
      tasks.find(
        (t) =>
          t.documentType === "LEASE_CONTRACT" &&
          t.signerRole === "TENANT" &&
          t.phase === "ENTRY" &&
          t.signerRef.kind === "TENANT" &&
          t.signerRef.tenantId === task.tenantId,
      ) || null
    );
  }

  // CONTRAT / BAILLEUR
  if (task.kind === "LANDLORD" && task.documentLabel === "Contrat de location") {
    return (
      tasks.find(
        (t) =>
          t.documentType === "LEASE_CONTRACT" &&
          t.signerRole === "LANDLORD" &&
          t.phase === "ENTRY",
      ) || null
    );
  }

  // ACTE DE CAUTION / BAILLEUR
  if (task.kind === "LANDLORD" && task.documentLabel === "Acte de caution") {
    return (
      tasks.find(
        (t) =>
          t.documentType === "GUARANTEE_ACT" &&
          t.signerRole === "LANDLORD" &&
          t.phase === "ENTRY" &&
          t.signerRef.kind === "LANDLORD" &&
          t.signerRef.guaranteeId === task.guaranteeId,
      ) || null
    );
  }

  // EDL ENTREE / LOCATAIRE
  if (task.kind === "TENANT" && task.documentLabel === "EDL entrée" && task.tenantId) {
    return (
      tasks.find(
        (t) =>
          t.documentType === "EDL_ENTRY" &&
          t.signerRole === "TENANT" &&
          t.phase === "ENTRY" &&
          t.signerRef.kind === "TENANT" &&
          t.signerRef.tenantId === task.tenantId,
      ) || null
    );
  }

  // INVENTAIRE ENTREE / LOCATAIRE
  if (task.kind === "TENANT" && task.documentLabel === "Inventaire entrée" && task.tenantId) {
    return (
      tasks.find(
        (t) =>
          t.documentType === "INVENTORY_ENTRY" &&
          t.signerRole === "TENANT" &&
          t.phase === "ENTRY" &&
          t.signerRef.kind === "TENANT" &&
          t.signerRef.tenantId === task.tenantId,
      ) || null
    );
  }

  // INVENTAIRE ENTREE / BAILLEUR
  if (task.kind === "LANDLORD" && task.documentLabel === "Inventaire entrée") {
    return (
      tasks.find(
        (t) =>
          t.documentType === "INVENTORY_ENTRY" &&
          t.signerRole === "LANDLORD" &&
          t.phase === "ENTRY",
      ) || null
    );
  }

  // ACTE DE CAUTION / GARANT
  if (task.kind === "GUARANTOR" && task.guaranteeId) {
    return (
      tasks.find(
        (t) =>
          t.documentType === "GUARANTEE_ACT" &&
          t.signerRole === "GUARANTOR" &&
          t.signerRef.kind === "GUARANTOR" &&
          t.signerRef.guaranteeId === task.guaranteeId,
      ) || null
    );
  }

  // EDL ENTREE / BAILLEUR
  if (task.kind === "LANDLORD" && task.documentLabel === "EDL entrée") {
    return (
      tasks.find(
        (t) =>
          t.documentType === "EDL_ENTRY" &&
          t.signerRole === "LANDLORD" &&
          t.phase === "ENTRY",
      ) || null
    );
  }

  // INVENTAIRE ENTREE / BAILLEUR
  if (task.kind === "LANDLORD" && task.documentLabel === "Inventaire entrée") {
    return (
      tasks.find(
        (t) =>
          t.documentType === "INVENTORY_ENTRY" &&
          t.signerRole === "LANDLORD" &&
          t.phase === "ENTRY",
      ) || null
    );
  }

  // EDL SORTIE / LOCATAIRE
  if (task.kind === "TENANT" && task.documentLabel === "EDL sortie" && task.tenantId) {
    return (
      tasks.find(
        (t) =>
          t.documentType === "EDL_EXIT" &&
          t.signerRole === "TENANT" &&
          t.phase === "EXIT" &&
          t.signerRef.kind === "TENANT" &&
          t.signerRef.tenantId === task.tenantId,
      ) || null
    );
  }

  // EDL SORTIE / BAILLEUR
  if (task.kind === "LANDLORD" && task.documentLabel === "EDL sortie") {
    return (
      tasks.find(
        (t) =>
          t.documentType === "EDL_EXIT" &&
          t.signerRole === "LANDLORD" &&
          t.phase === "EXIT",
      ) || null
    );
  }

  // INVENTAIRE SORTIE / LOCATAIRE
  if (task.kind === "TENANT" && task.documentLabel === "Inventaire sortie" && task.tenantId) {
    return (
      tasks.find(
        (t) =>
          t.documentType === "INVENTORY_EXIT" &&
          t.signerRole === "TENANT" &&
          t.phase === "EXIT" &&
          t.signerRef.kind === "TENANT" &&
          t.signerRef.tenantId === task.tenantId,
      ) || null
    );
  }

  // INVENTAIRE SORTIE / BAILLEUR
  if (task.kind === "LANDLORD" && task.documentLabel === "Inventaire sortie") {
    return (
      tasks.find(
        (t) =>
          t.documentType === "INVENTORY_EXIT" &&
          t.signerRole === "LANDLORD" &&
          t.phase === "EXIT",
      ) || null
    );
  }

  return null;
}

async function trySendCanonicalLink(task: SignerTask, force = false): Promise<boolean> {
  const canonicalTask = findCanonicalTaskForLegacyTask(task);
  if (!canonicalTask) return false;

  if (!canCreateCanonicalLink(canonicalTask)) return false;

  const input = toCanonicalPublicLinkInput(canonicalTask, force);
  if (!input) return false;

  await createCanonicalPublicLink(input);
  await fetchCanonicalWorkflow(leaseId);
  await fetchSignatureStatus(leaseId);

  return true;
}

async function sendSignatureLink(task: SignerTask) {
  try {
    const usedCanonical = await trySendCanonicalLink(task, false);
    if (usedCanonical) {
      setUiInfo(`Lien envoyé ✅ (${task.displayName})`);
      return;
    }
  } catch (e: any) {
    setUiError(String(e?.message || e));
    return;
  }

  if (task.documentLabel === "EDL entrée") {
    if (task.kind === "TENANT") {
      await sendEdlEntryTenantLinks(false);
      return;
    }
    if (task.kind === "LANDLORD") {
      await sendEdlEntryLandlordLink(false);
      return;
    }
  }

  if (task.documentLabel === "Inventaire entrée") {
    if (task.kind === "TENANT") {
      await sendInventoryEntryTenantLinks(false);
      return;
    }
  }

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
  try {
    const usedCanonical = await trySendCanonicalLink(task, true);
    if (usedCanonical) {
      setUiInfo(`Lien renvoyé ✅ (${task.displayName})`);
      return;
    }
  } catch (e: any) {
    setUiError(String(e?.message || e));
    return;
  }

  if (task.documentLabel === "EDL entrée") {
    if (task.kind === "TENANT") {
      await sendEdlEntryTenantLinks(true);
      return;
    }
    if (task.kind === "LANDLORD") {
      await sendEdlEntryLandlordLink(true);
      return;
    }
  }

  if (task.documentLabel === "Inventaire entrée") {
    if (task.kind === "TENANT") {
      await sendInventoryEntryTenantLinks(true);
      return;
    }
  }

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
  try {
    setUiInfo("Envoi des liens restants…");

    const canonicalTasks = canonicalWorkflow?.tasks ?? [];

    const tasksToSend = canonicalTasks.filter((task) => {
      if (!task.documentId) return false;
      if (task.signatureStatus === "SIGNED") return false;
      if (task.signatureStatus === "BLOCKED") return false;
      if (!task.canSendLink && !task.canResendLink) return false;

      return true;
    });

    let sentCount = 0;
    let skippedCount = 0;

    for (const task of tasksToSend) {
      const force =
        task.publicLinkStatus === "ACTIVE" ||
        task.publicLinkStatus === "EXPIRED";

      const input = toCanonicalPublicLinkInput(task, force);

      if (!input || !canCreateCanonicalLink(task)) {
        skippedCount += 1;
        continue;
      }

      try {
        await createCanonicalPublicLink(input);
        sentCount += 1;
      } catch (e) {
        console.warn("[sendAllRemainingLinks] skipped", task.id, e);
        skippedCount += 1;
      }
    }

    await refreshAll();

    setUiInfo(`Liens envoyés ✅ (${sentCount} envoyé(s), ${skippedCount} ignoré(s))`);

    alert(
      `✅ ${sentCount} lien(s) envoyé(s)\n` +
      `⏭️ ${skippedCount} ignoré(s)`
    );
  } catch (e: any) {
    setUiError(String(e?.message || e));
  }
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

  if (activeSessionIsGuarantor) {
    const expected = activeSessionRequiredGuarantorMention.trim();
    const actual = onsiteGuarantorMention.trim();

    if (!isMentionValid(actual, expected)) {
      setError("La mention de caution est incomplète ou incorrecte.");
      return;
    }
  }

  const signerRole =
    sessionDraft.signerKind === "TENANT"
      ? "LOCATAIRE"
      : sessionDraft.signerKind === "LANDLORD"
        ? "BAILLEUR"
        : "GARANT";

  try {
    setIsSubmittingSession(true);

    await signDocOnPlace({
      documentId: sessionDraft.documentId,
      signerRole,
      signerName: sessionDraft.signerName,
      signerTenantId: sessionDraft.tenantId,
      optimisticGuaranteeId: sessionDraft.guaranteeId,
    });

    setOnsiteGuarantorMention("");

    closeSessionDraft();
  } finally {
    setIsSubmittingSession(false);
  }
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

  async function fetchCanonicalWorkflow(currentLeaseId: string) {
    setLoadingCanonicalWorkflow(true);
    setCanonicalWorkflowError(null);

    try {
      const data = await fetchSignatureWorkflow(currentLeaseId);
      setCanonicalWorkflow(data);
    } catch (e: any) {
      setCanonicalWorkflowError(String(e?.message || e));
    } finally {
      setLoadingCanonicalWorkflow(false);
    }
  }


  async function fetchPackFinalReadiness(currentLeaseId: string) {
    setLoadingPackFinalReadiness(true);
    setPackFinalReadinessError(null);

    try {
      const res = await fetch(
        `${API}/documents/pack-final/readiness?leaseId=${currentLeaseId}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        },
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`pack-final/readiness failed (${res.status}): ${txt}`);
      }

      const data = (await res.json()) as PackFinalReadiness;
      setPackFinalReadiness(data);
      setPackFinalReadinessError(null);
    } catch (e: any) {
      const message = String(e?.message || e);
      console.error("[PACK FINAL READINESS ERROR]", message);
      setPackFinalReadiness(null);
      setPackFinalReadinessError(message);
    } finally {
      setLoadingPackFinalReadiness(false);
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
  setIsSignatureDirty(false);
}

function dataUrl(c: HTMLCanvasElement | null) {
  if (!c) return "";
    return c.toDataURL("image/png");
}

function onPointerDown(e: any) {
  e.preventDefault?.();
  const c = canvasRef.current;
  if (!c) return;

  drawing.current = true;
  signatureDirty.current = true;
  setIsSignatureDirty(true);

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
  e.preventDefault?.();
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
      landlordName,
    });
  }, [leaseId, sigStatus, tenants, docs, guaranteeActOverride, landlordName]);

  const { overview, signerTasks, documents } = signatureCenter;

  console.log(
    "[SIGNER TASKS RUNTIME]",
    signerTasks.map((t) => ({
      id: t.id,
      kind: t.kind,
      label: t.documentLabel,
      tenantId: (t as any).tenantId || null,
      hasSubTasks: Array.isArray((t as any).subTasks) ? (t as any).subTasks.length : 0,
    })),
  );

function groupTasksBySigner(tasks: SignerTask[]) {
  const map = new Map<string, SignerTask[]>();

  for (const task of tasks) {
    let key = "";

    if (task.kind === "TENANT") {
      key = `tenant:${task.tenantId}`;
    } else if (task.kind === "LANDLORD") {
      key = "landlord";
    } else if (task.kind === "GUARANTOR") {
      key = `guarantor:${task.guaranteeId}`;
    }

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key)!.push(task);
  }

  function pickMainTask(group: SignerTask[]) {
    return (
      group.find((t) => t.status === "READY" && !t.isBlocked) ||
      group.find((t) => t.status === "IN_PROGRESS" && !t.isBlocked) ||
      group.find((t) => t.status === "LINK_SENT" && !t.isBlocked) ||
      group.find((t) => t.requiresPreparation) ||
      group.find((t) => t.documentLabel === "Contrat de location") ||
      group[0]
    );
  }

  return Array.from(map.entries()).map(([key, group]) => {
    const mainTask = pickMainTask(group);

    return {
      key,
      tasks: group,
      mainTask,
    };
  });
}

  const signerGroups = groupTasksBySigner(signerTasks);

  console.log(
    "[SIGNER GROUPS RUNTIME]",
    signerGroups.map((g) => ({
      key: g.key,
      mainTaskId: g.mainTask.id,
      mainTaskLabel: g.mainTask.documentLabel,
      taskIds: g.tasks.map((t) => t.id),
      taskLabels: g.tasks.map((t) => t.documentLabel),
    })),
  );

  const displayTasks = signerGroups.flatMap((group) => {
  const main = group.mainTask;
  const sub = group.tasks.filter((t) => t.id !== main.id);

  return [
    {
      ...main,
      subTasks: sub,
    } as SignerTask,
    ...sub,
  ];
});

  const signerCards = signerGroups.map((group) => {
    const main = group.mainTask;
    const sub = group.tasks.filter((t) => t.id !== main.id);

    return {
      ...main,
      subTasks: sub,
    } as SignerTask;
  });

  const historyItems = useMemo(() => {
  return buildHistoryItems(signerTasks, documents);
}, [signerTasks, documents]);

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
  }, [selectedTenant]);

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

    if (signerRole === "GARANT") {
      if (!isMentionValid(onsiteGuarantorMention, activeSessionRequiredGuarantorMention)) {
        setStatus("");
        setError("La mention de caution est incomplète ou incorrecte.");
        return;
      }
    }

    if (signerRole === "GARANT") {
      payload.guarantorMention = onsiteGuarantorMention.trim();
      payload.guarantorMentionRequired = activeSessionRequiredGuarantorMention.trim();
      payload.guarantorMentionMatched = isMentionValid(
        onsiteGuarantorMention,
        activeSessionRequiredGuarantorMention
      );
    }
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

    await refreshAll();
  } catch (e: any) {
    setStatus("");
    setError(String(e?.message || e));
  }
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

  async function sendEdlEntryTenantLinks(force = false) {
    setStatus(force ? "Renvoi (force) des liens EDL entrée locataires…" : "Envoi des liens EDL entrée locataires…");
    setError("");

    try {
      const r = await fetch(`${API}/public-links/edl-entry/tenant/send`, {
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

      setStatus(`✅ ${j.sentCount || 0} lien(s) EDL entrée locataire envoyé(s)`);
      await fetchSignatureStatus(leaseId);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function sendInventoryEntryTenantLinks(force = false) {
    setStatus(
      force
        ? "Renvoi (force) des liens inventaire entrée locataires…"
        : "Envoi des liens inventaire entrée locataires…",
    );
    setError("");

    try {
      const r = await fetch(`${API}/public-links/inventory-entry/tenant/send`, {
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

      setStatus(`✅ ${j.sentCount || 0} lien(s) inventaire entrée locataire envoyé(s)`);
      await fetchSignatureStatus(leaseId);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }
  


  async function sendEdlEntryLandlordLink(force = false) {
    setStatus(force ? "Renvoi (force) du lien bailleur EDL entrée…" : "Envoi du lien bailleur EDL entrée…");
    setError("");

    try {
      const r = await fetch(`${API}/public-links/edl-entry/landlord/send`, {
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

      setStatus("✅ Lien bailleur EDL entrée envoyé");
      await fetchSignatureStatus(leaseId);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function refreshAll() {
    await loadDocs();
    await fetchSignatureStatus(leaseId);
    await fetchCanonicalWorkflow(leaseId);
    await fetchPackFinalReadiness(leaseId);
  }

  function openGuarantees() {
    window.location.href = `/guarantees/${leaseId}`;
  }


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


console.log(
  "[SIGNER SECTION INPUT]",
  signerGroups.map((group) => {
    const main = group.mainTask;
    const siblingSubTasks = group.tasks.filter((t) => t.id !== main.id);
    const existingSubTasks = Array.isArray((main as any).subTasks) ? (main as any).subTasks : [];

    return {
      key: group.key,
      mainTaskId: main.id,
      mainTaskLabel: main.documentLabel,
      existingSubTasks: existingSubTasks.map((t: any) => ({
        id: t.id,
        label: t.documentLabel,
        status: t.status,
      })),
      siblingSubTasks: siblingSubTasks.map((t) => ({
        id: t.id,
        label: t.documentLabel,
        status: t.status,
      })),
    };
  }),
);

const flatTasksForSession = signerTasks.flatMap((task) => [
  task,
  ...(((task as any).subTasks || []) as SignerTask[]),
]);

const activeSessionTask =
  flatTasksForSession.find((t) => t.id === sessionDraft.signerTaskId) || null;

const activeSessionIsGuarantor =
  String(activeSessionTask?.kind || "").toUpperCase() === "GUARANTOR";

const activeSessionGuaranteedTenantName = String(
  activeSessionTask?.tenantLabel || "le locataire"
)
  .replace(/^Garant pour\s+/i, "")
  .trim();

const activeSessionGuaranteeCapCents =
  leaseFinancials.durationMonths * (leaseFinancials.rentCents + leaseFinancials.chargesCents);

const activeSessionGuaranteeCapText = formatEurosFromCents(activeSessionGuaranteeCapCents);

const activeSessionRequiredGuarantorMention = activeSessionTask
  ? `En me portant caution solidaire de ${activeSessionGuaranteedTenantName || "le locataire"}, dans la limite de la somme de ${activeSessionGuaranteeCapText} couvrant le paiement du principal, des intérêts et, le cas échéant, des pénalités ou intérêts de retard, et pour la durée définie au présent acte, je m'engage à rembourser au bailleur les sommes dues sur mes revenus et mes biens si ${activeSessionGuaranteedTenantName || "le locataire"} n'y satisfait pas lui-même.

Je reconnais avoir parfaitement connaissance de la nature et de l'étendue de mon engagement.`
  : "";

const activeSessionGuarantorMentionValid =
  !activeSessionIsGuarantor ||
  isMentionValid(onsiteGuarantorMention, activeSessionRequiredGuarantorMention);

console.log("[PACK FINAL READINESS PAGE]", {
  packFinalReadiness,
  loadingPackFinalReadiness,
  hasPackFinal: Boolean(packFinalV2Doc),
});
    
  return (
    <div
      style={{
        padding: isWideScreen ? 32 : 20,
        maxWidth: 1280,
        width: "100%",
        margin: "0 auto",
        display: "grid",
        gap: 24,
        background: `linear-gradient(180deg, ${SIGN_UI.colors.pageBgTop} 0%, ${SIGN_UI.colors.pageBgBottom} 100%)`,
        borderRadius: 28,
        boxSizing: "border-box",
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
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                flexWrap: "wrap",
                minWidth: 0,
                fontFamily: UI_FONT,
              }}
            >
              <span
                style={{
                  fontSize: 24,
                  lineHeight: 1.12,
                  letterSpacing: "-0.04em",
                  fontWeight: 800,
                  color: SIGN_UI.colors.textStrong,
                  wordBreak: "break-word",
                }}
              >
                {overview.leaseLabel}
              </span>

              <span
                style={{
                  color: "#BCC6D6",
                  fontWeight: 500,
                  fontSize: 22,
                  lineHeight: 1,
                }}
              >
                —
              </span>

              <span
                style={{
                  color: "#5F7090",
                  fontWeight: 500,
                  fontSize: 16,
                  lineHeight: 1.35,
                  letterSpacing: "-0.01em",
                  wordBreak: "break-word",
                }}
              >
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
            boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
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
          gridTemplateColumns: isWideScreen ? "minmax(0,1fr) 380px" : "1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
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
            onRegenerateContract={() => generateContract(true)}
            onRegenerateEdlEntry={() => generateEdl("entry", true)}
            onRegenerateInventoryEntry={() => generateInventory("entry", true)}
            onRegenerateEdlExit={() => generateEdl("exit", true)}
            onRegenerateInventoryExit={() => generateInventory("exit", true)}
          />
        </div>

                <div
                  ref={signaturePanelRef}
                  className="sign-sticky"
                  style={{
                    position: isWideScreen ? "sticky" : "static",
                    top: isWideScreen ? 12 : "auto",
                    display: "grid",
                    gap: 20,
                    alignSelf: "start",
                    minWidth: 0,
                    marginTop: 0,
                  }}
                >
                  <SignatureSessionPanel
                    task={activeSessionTask}
                    onClose={closeSessionDraft}
                    onClear={clearCanvas}
                    onConfirm={confirmSessionDraftSignature}
                    canvasRef={canvasRef}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    isSubmitting={isSubmittingSession}
                    isSignatureDirty={isSignatureDirty}
                    guarantorMention={onsiteGuarantorMention}
                    onGuarantorMentionChange={setOnsiteGuarantorMention}
                    requiredGuarantorMention={activeSessionRequiredGuarantorMention}
                    guarantorMentionValid={activeSessionGuarantorMentionValid}
                  />

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
              borderRadius: 24,
              border: "1px solid #dde3ec",
              boxShadow: "0 18px 42px rgba(16,24,40,0.12), 0 4px 14px rgba(16,24,40,0.05)",
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