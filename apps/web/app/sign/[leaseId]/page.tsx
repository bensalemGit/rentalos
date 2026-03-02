"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { extractLeaseBundle } from "../../_lib/extractLease";

type TenantSigStatus = "NOT_SENT" | "SENT" | "SIGNED";
type LandlordSigStatus = "NOT_SENT" | "SENT" | "SIGNED";
type DocSigStatus = "NOT_GENERATED" | "DRAFT" | "IN_PROGRESS" | "SIGNED";
type GuaranteeSigStatus = "NOT_SENT" | "SENT" | "IN_PROGRESS" | "SIGNED";

type SignatureStatusPayload = {
  leaseId: string;
  generatedAt: string;

  contract: {
    documentId: string | null;
    filename: string | null;
    signedFinalDocumentId: string | null;
    status: DocSigStatus;
    landlord: {
      signatureStatus: LandlordSigStatus;
      lastLink: { createdAt: string; expiresAt: string | null; consumedAt: string | null } | null;
    };
    tenants: Array<{
      leaseTenantId: string;
      tenantId: string;
      role: string;
      fullName: string;
      signatureStatus: TenantSigStatus;
      lastLink: { createdAt: string; expiresAt: string | null; consumedAt: string | null } | null;
    }>;
  };

  guarantees: Array<{
    guaranteeId: string;
    leaseTenantId: string;
    tenantId: string;
    tenantFullName: string;
    guarantorFullName: string;
    guarantorEmail: string | null;
    guarantorPhone: string | null;
    actDocumentId: string | null;
    signedFinalDocumentId: string | null;
    signatureStatus: GuaranteeSigStatus;
    lastLink: { createdAt: string; expiresAt: string | null; consumedAt: string | null } | null;
    guaranteeStatus: string | null;
  }>;
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
  documentId: string;        // actDocumentId
  defaultName: string;       // guarantorFullName
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

  const guarantorCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawingGuarantor = useRef(false);

  // ✅ NEW: prevent empty signatures
  const tenantDirty = useRef(false);
  const landlordDirty = useRef(false);
  const guarantorDirty = useRef(false);


  // lease kind
  const [leaseKind, setLeaseKind] = useState("");

  // ✅ NEW: tenants list for multi-tenant signature
  const [tenants, setTenants] = useState<LeaseTenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [tenantName, setTenantName] = useState("Locataire");
  const [landlordName, setLandlordName] = useState("Bailleur");

  // confirmations
  const [tenantSigned, setTenantSigned] = useState(false);
  const [landlordSigned, setLandlordSigned] = useState(false);

  const tenantCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const landlordCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingTenant = useRef(false);
  const drawingLandlord = useRef(false);

  const [sigStatus, setSigStatus] = useState<SignatureStatusPayload | null>(null);
  const [loadingSigStatus, setLoadingSigStatus] = useState(false);
  const [sigStatusError, setSigStatusError] = useState<string | null>(null);

  const blue = "#1f6feb";
  const border = "#e5e7eb";
  const muted = "#6b7280";
  const green = "#16a34a";

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  function setupCanvas(c: HTMLCanvasElement) {
    const w = Math.min(520, window.innerWidth - 48);
    c.width = w;
    c.height = 160;
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
  }

  useEffect(() => {
    if (tenantCanvasRef.current) setupCanvas(tenantCanvasRef.current);
    if (landlordCanvasRef.current) setupCanvas(landlordCanvasRef.current);
    // ✅ NEW
    if (guarantorCanvasRef.current) setupCanvas(guarantorCanvasRef.current);
  
  }, [
    tenantCanvasRef.current,
    landlordCanvasRef.current,
    guarantorCanvasRef.current,
  ]);

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

    setTenantSigned(false);
    setLandlordSigned(false);

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


      if (signed?.id) {
        setTenantSigned(true);
        setLandlordSigned(true);
      }

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

      setStatus("Acte généré ✅");
      await loadDocs();
      await fetchSignatureStatus(leaseId);
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

  async function sendGuarantorLinkByGuarantee(guaranteeId: string, force = false) {
    const res = await fetch(`${API}/public-links/guarantor-sign/send-by-guarantee`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ guaranteeId, force }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`send-by-guarantee failed (${res.status}): ${txt}`);
    }

    await fetchSignatureStatus(leaseId);
  }

  function clearCanvas(c: HTMLCanvasElement | null) {
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    // ✅ NEW: reset dirty flags
    if (c === tenantCanvasRef.current) tenantDirty.current = false;
    if (c === landlordCanvasRef.current) landlordDirty.current = false;
    if (c === guarantorCanvasRef.current) guarantorDirty.current = false;
  }

  function dataUrl(c: HTMLCanvasElement | null) {
    if (!c) return "";
    return c.toDataURL("image/png");
  }

  function pos(e: any, c: HTMLCanvasElement) {
    const rect = c.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
  }

  function startTenant(e: any) {
    const c = tenantCanvasRef.current!;
    drawingTenant.current = true;
    const ctx = c.getContext("2d")!;
    const p = pos(e, c);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function moveTenant(e: any) {
    if (!drawingTenant.current) return;
    tenantDirty.current = true; // ✅ NEW
    const c = tenantCanvasRef.current!;
    const ctx = c.getContext("2d")!;
    const p = pos(e, c);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function endTenant() {
    drawingTenant.current = false;
  }

  function startLandlord(e: any) {
    const c = landlordCanvasRef.current!;
    drawingLandlord.current = true;
    const ctx = c.getContext("2d")!;
    const p = pos(e, c);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function moveLandlord(e: any) {
    if (!drawingLandlord.current) return;
    landlordDirty.current = true; // ✅ NEW
    const c = landlordCanvasRef.current!;
    const ctx = c.getContext("2d")!;
    const p = pos(e, c);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function endLandlord() {
    drawingLandlord.current = false;
  }

    // ✅ NEW: guarantor act canvas handlers
  function startGuarantor(e: any) {
    const c = guarantorCanvasRef.current!;
    drawingGuarantor.current = true;
    const ctx = c.getContext("2d")!;
    const p = pos(e, c);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function moveGuarantor(e: any) {
    if (!drawingGuarantor.current) return;
    guarantorDirty.current = true; // ✅ NEW
    const c = guarantorCanvasRef.current!;
    const ctx = c.getContext("2d")!;
    const p = pos(e, c);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function endGuarantor() {
    drawingGuarantor.current = false;
  }


  const hasFinal = useMemo(() => !!finalSignedDoc?.id, [finalSignedDoc]);

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
      .filter((g) => Boolean(g.actDocumentId))
      .sort((a, b) => String(a.tenantFullName || "").localeCompare(String(b.tenantFullName || "")))
      .map((g) => ({
        key: `guarantee:${g.guaranteeId}`,
        label: `Acte caution — ${String(g.guarantorFullName || g.tenantFullName || "Garant").trim()} (${String(
          g.guaranteeId,
        ).slice(0, 6)})`,
        documentId: g.actDocumentId as string,
      }));

    items.push(...acts);
    return items;
  }, [sigStatus]);

  const guarantorSignables: GuarantorSignable[] = useMemo(() => {
    const gs = Array.isArray(sigStatus?.guarantees) ? sigStatus!.guarantees : [];
    return gs
      .filter((g) => Boolean(g.actDocumentId)) // il faut l'acte généré
      .sort((a, b) =>
        String(a.guarantorFullName || "").localeCompare(String(b.guarantorFullName || ""))
      )
      .map((g) => ({
        key: g.guaranteeId,
        label: `${String(g.guarantorFullName || "Garant").trim()} (${String(g.guaranteeId).slice(0, 6)})`,
        guaranteeId: g.guaranteeId,
        documentId: g.actDocumentId as string,
        defaultName: String(g.guarantorFullName || "Garant").trim(),
      }));
  }, [sigStatus]);

  const [selectedLandlordDocKey, setSelectedLandlordDocKey] = useState<string>("contract");

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

  const selectedLandlordDoc = useMemo(() => {
    return landlordSignables.find((x) => x.key === selectedLandlordDocKey) || null;
  }, [landlordSignables, selectedLandlordDocKey]);

  async function sign(role: "LOCATAIRE" | "BAILLEUR") {
    // ✅ LOCATAIRE signe forcément le contrat (root)
    if (role === "LOCATAIRE" && !contractDoc?.id) {
      setError("Aucun contrat. Génère d’abord le contrat.");
      return;
    }

    // ✅ BAILLEUR signe le document sélectionné (contrat ou acte caution)
    const landlordDocId = role === "BAILLEUR" ? selectedLandlordDoc?.documentId : null;
    if (role === "BAILLEUR" && !landlordDocId) {
      setError("Aucun document sélectionné à signer.");
      return;
    }

    setError("");
    setStatus(role === "LOCATAIRE" ? "Signature locataire…" : "Signature bailleur…");

    const signerName = role === "LOCATAIRE" ? tenantName : landlordName;
    const signatureDataUrl =
      role === "LOCATAIRE" ? dataUrl(tenantCanvasRef.current) : dataUrl(landlordCanvasRef.current);

    const isDirty = role === "LOCATAIRE" ? tenantDirty.current : landlordDirty.current;
    if (!isDirty) {
      setStatus("");
      setError("Signature vide.");
      return;
    }

    // ✅ NEW: signerTenantId required when multiple tenants
    let signerTenantId: string | undefined = undefined;
    if (role === "LOCATAIRE") {
      if (hasMultipleTenants) {
        signerTenantId = String(selectedTenantId || "").trim();
        if (!signerTenantId) {
          setStatus("");
          setError("Sélectionne le locataire signataire (multi-locataires).");
          return;
        }
      } else {
        // single tenant: try infer from lease bundle
        const only = tenants?.[0];
        const id = only ? normalizeTenantId(only) : "";
        if (id) signerTenantId = id;
      }
    }

    try {
      const payload: any = { signerName, signerRole: role, signatureDataUrl };
      if (role === "LOCATAIRE" && signerTenantId) payload.signerTenantId = signerTenantId;

      const documentIdToSign = role === "BAILLEUR" ? landlordDocId! : contractDoc!.id;

      const r = await fetch(`${API}/documents/${documentIdToSign}/sign`, {
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

      if (role === "LOCATAIRE") {
        clearCanvas(tenantCanvasRef.current);
        setTenantSigned(true);
        setStatus("✅ Signature locataire enregistrée");
      } else {
        clearCanvas(landlordCanvasRef.current);
        setLandlordSigned(true);
        setStatus("✅ Signature bailleur enregistrée");
      }

      await loadDocs();
      await fetchSignatureStatus(leaseId);
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  async function signGuarantor() {
    if (!selectedGuarantor?.documentId) {
      setError("Aucun acte de caution sélectionné (ou acte non généré).");
      return;
    }

    setError("");
    setStatus("Signature garant…");

    const signatureDataUrl = dataUrl(guarantorCanvasRef.current);
    if (!guarantorDirty.current) {
      setStatus("");
      setError("Signature vide.");
      return;
    }

    try {
      const payload = {
        signerName: guarantorName || selectedGuarantor.defaultName,
        signerRole: "GARANT",
        signatureDataUrl,
      };

      const r = await fetch(`${API}/documents/${selectedGuarantor.documentId}/sign`, {
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

      clearCanvas(guarantorCanvasRef.current);
      guarantorDirty.current = false;

      setStatus("✅ Signature garant enregistrée");
      await loadDocs();
      await fetchSignatureStatus(leaseId);
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

  async function refreshAll() {
    await loadDocs(); // recharge les documents
    await fetchSignatureStatus(leaseId); // recharge les statuts contrat + garanties
  }

  return (
    <div style={{ padding: 18, maxWidth: 980, margin: "0 auto", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Contrat & signatures</h1>
          <div style={{ color: muted, marginTop: 6, fontSize: 13 }}>
            Bail {leaseId.slice(0, 8)}… • Contrat: {contractDoc?.id ? "OK" : "—"} • Notice:{" "}
            {noticeDoc?.id ? "OK" : isRP ? "—" : "n/a"} • Pack: {packDoc?.id ? "OK" : "—"} • PACK_FINAL_V2: {packFinalV2Doc?.id ? "OK" : "—"} • Contrat SIGNED_FINAL: {hasFinal ? "OK" : "—"}
            {hasFinal ? "OK" : "—"}
          </div>
        </div>

        <button onClick={() => refreshAll()} style={btnSecondary(border)}>
          Rafraîchir
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button onClick={generateContract} style={btnAction(border)}>
          Générer contrat
        </button>

        <button
          onClick={() => contractDoc?.id && downloadDoc(contractDoc.id, contractDoc.filename)}
          style={btnAction(border)}
          disabled={!contractDoc?.id}
        >
          Télécharger contrat
        </button>

        {isRP && (
          <>
            <button onClick={generateNotice} style={btnAction(border)}>
              Générer notice
            </button>
            <button
              onClick={() => noticeDoc?.id && downloadDoc(noticeDoc.id, noticeDoc.filename)}
              style={btnAction(border)}
              disabled={!noticeDoc?.id}
            >
              Télécharger notice
            </button>
          </>
        )}

        <button onClick={generatePack} style={btnAction(border)}>
          Générer pack
        </button>
        <button
          onClick={() => packDoc?.id && downloadDoc(packDoc.id, packDoc.filename)}
          style={btnAction(border)}
          disabled={!packDoc?.id}
        >
          Télécharger pack
        </button>

        <button onClick={generatePackFinalV2} style={btnAction(border)}>
          Générer PACK_FINAL signé (V2)
        </button>

        <button
          onClick={() => sendPublicLink(false)}
          style={btnAction(border)}
          disabled={!contractDoc?.id}
        >
          Envoyer lien locataire
        </button>

        <button
          onClick={() => sendPublicLink(true)}
          style={btnAction(border)}
          disabled={!contractDoc?.id}
        >
          Renvoyer locataire (force)
        </button>

        <button
          onClick={() => (window.location.href = `/guarantees/${leaseId}`)}
          style={btnAction(border)}
        >
          Gérer garanties
        </button>

      </div>

      <div style={card(border)}>
        <h2 style={{ marginTop: 0 }}>Contrat</h2>

        {!sigStatus && loadingSigStatus && (
          <div style={{ marginTop: 8, fontSize: 13, color: muted }}>Chargement…</div>
        )}
        {sigStatusError && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#b91c1c" }}>{sigStatusError}</div>
        )}

        {sigStatus && (
          <>
            <div style={{ fontSize: 13, color: muted }}>
              Statut document:{" "}
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {sigStatus.contract.status}
              </span>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800 }}>Locataires</div>
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                {sigStatus.contract.tenants.map((t) => (
                  <div
                    key={t.tenantId}
                    style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}
                  >
                    <div style={{ color: "#111" }}>
                      {t.fullName}{" "}
                      <span style={{ color: muted }}>
                        ({t.role || "tenant"})
                      </span>
                    </div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {t.signatureStatus}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800 }}>Bailleur</div>
              <div style={{ marginTop: 6, fontSize: 13, color: muted }}>
                Statut:{" "}
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#111" }}>
                  {sigStatus.contract.landlord.signatureStatus}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                style={btnAction(border)}
                disabled={!sigStatus.contract.documentId}
                onClick={() =>
                  sigStatus.contract.documentId &&
                  downloadDoc(sigStatus.contract.documentId, sigStatus.contract.filename || "contrat.pdf")
                }
              >
                Télécharger contrat
              </button>

              <button
                style={btnAction(border)}
                disabled={!sigStatus.contract.signedFinalDocumentId}
                onClick={() =>
                  sigStatus.contract.signedFinalDocumentId &&
                  downloadDoc(sigStatus.contract.signedFinalDocumentId, "contrat_SIGNE.pdf")
                }
              >
                Télécharger signé
              </button>

              <button
                style={btnSecondary(border)}
                onClick={() => fetchSignatureStatus(leaseId)}
              >
                Rafraîchir statuts
              </button>
            </div>
          </>
        )}
      </div>

      {status && (
        <div style={{ ...card(border), background: "rgba(31,111,235,0.05)", borderColor: "rgba(31,111,235,0.25)" }}>
          <b>{status}</b>
        </div>
      )}
      {error && (
        <div style={{ ...card(border), background: "rgba(220,38,38,0.05)", borderColor: "rgba(220,38,38,0.25)" }}>
          <b style={{ color: "#b91c1c" }}>{error}</b>
        </div>
      )}

      {finalSignedDoc?.id && (
        <div style={card(border)}>
          <h3 style={{ marginTop: 0 }}>PDF signé final</h3>
          <div style={{ color: muted, marginBottom: 10 }}>{finalSignedDoc.filename}</div>
          <button onClick={() => downloadDoc(finalSignedDoc.id, finalSignedDoc.filename)} style={btnPrimarySmall(blue)}>
            Télécharger PDF signé
          </button>
        </div>
      )}

      {packFinalV2Doc?.id && (
        <div style={card(border)}>
          <h3 style={{ marginTop: 0 }}>PACK_FINAL signé (V2)</h3>
          <div style={{ color: muted, marginBottom: 10 }}>{packFinalV2Doc.filename}</div>
          <button
            onClick={() => downloadDoc(packFinalV2Doc.id, packFinalV2Doc.filename)}
            style={btnPrimarySmall(blue)}
          >
            Télécharger PACK_FINAL signé
          </button>
        </div>
      )}

      <div style={card(border)}>
        <h2 style={{ marginTop: 0 }}>Garanties (caution)</h2>

        {!sigStatus && loadingSigStatus && <div style={{ marginTop: 8, fontSize: 13, color: muted }}>Chargement…</div>}
        {sigStatusError && <div style={{ marginTop: 8, fontSize: 13, color: "#b91c1c" }}>{sigStatusError}</div>}

        {sigStatus && sigStatus.guarantees.length === 0 && (
          <div style={{ marginTop: 8, fontSize: 13, color: muted }}>Aucune garantie CAUTION sélectionnée.</div>
        )}

        {sigStatus && sigStatus.guarantees.length > 0 && (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {sigStatus.guarantees.map((g) => (
              <div key={g.guaranteeId} style={{ border: `1px solid ${border}`, borderRadius: 14, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 240 }}>
                    <div style={{ fontWeight: 800 }}>
                      {g.guarantorFullName || "Garant"} → {g.tenantFullName}
                    </div>

                    <div style={{ fontSize: 13, color: muted, marginTop: 6 }}>
                      Statut: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{g.signatureStatus}</span>
                      {g.lastLink?.createdAt ? (
                        <span style={{ marginLeft: 8 }}>
                          (lien: {new Date(g.lastLink.createdAt).toLocaleString()})
                        </span>
                      ) : null}
                    </div>

                    {(g.guarantorEmail || g.guarantorPhone) && (
                      <div style={{ fontSize: 13, color: muted, marginTop: 6 }}>
                        {g.guarantorEmail ? <span>{g.guarantorEmail}</span> : null}
                        {g.guarantorEmail && g.guarantorPhone ? <span> • </span> : null}
                        {g.guarantorPhone ? <span>{g.guarantorPhone}</span> : null}
                      </div>
                    )}
                  </div>

                  {(() => {
                    const sendLabel =
                      g.signatureStatus === "NOT_SENT"
                        ? "Envoyer lien garant"
                        : g.signatureStatus === "SENT"
                        ? "Renvoyer lien"
                        : g.signatureStatus === "IN_PROGRESS"
                        ? "Renvoyer lien"
                        : "Lien envoyé";

                    const sendDisabled = g.signatureStatus === "SIGNED";

                    const hint =
                      g.signatureStatus === "IN_PROGRESS"
                        ? "Signature bailleur requise"
                        : g.signatureStatus === "SENT"
                        ? "En attente de signature garant"
                        : null;

                    return (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          style={btnPrimarySmall(blue)}
                          disabled={sendDisabled}
                          title={hint || undefined}
                          onClick={() =>
                            sendGuarantorLinkByGuarantee(g.guaranteeId, false).catch((e) => alert(e.message))
                          }
                        >
                          {sendLabel}
                        </button>

                        <button
                          style={btnAction(border)}
                          onClick={() => generateGuarantorActFor(g.guaranteeId)}
                        >
                          {g.actDocumentId ? "Regénérer acte" : "Générer acte"}
                        </button>
                        
                        
                        <button
                          style={btnAction(border)}
                          disabled={!g.actDocumentId}
                          onClick={() => g.actDocumentId && downloadDoc(g.actDocumentId, "acte_caution.pdf")}
                        >
                          Télécharger acte
                        </button>

                        <button
                          style={btnAction(border)}
                          disabled={!g.signedFinalDocumentId}
                          onClick={() =>
                            g.signedFinalDocumentId && downloadDoc(g.signedFinalDocumentId, "acte_caution_SIGNE.pdf")
                          }
                        >
                          Télécharger signé
                        </button>

                        <button
                          style={btnAction(border)}
                          disabled={g.signatureStatus === "SIGNED"}
                          onClick={() => sendGuarantorLinkByGuarantee(g.guaranteeId, true).catch((e) => alert(e.message))}
                        >
                          Renvoyer (force)
                        </button>

                        {hint ? <span style={{ fontSize: 12, color: muted }}>{hint}</span> : null}
                      </div>
                    );
                  })()}


                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "start" }}>
        <div style={card(border)}>
          <h2 style={{ marginTop: 0 }}>Signature locataire</h2>

          {hasMultipleTenants && (
            <div style={{ marginBottom: 10, display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: muted, fontWeight: 700 }}>Locataire signataire (obligatoire)</div>
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                style={{ ...inputStyle(border), cursor: "pointer" }}
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
              <div style={{ fontSize: 12, color: muted }}>
                L’API a besoin de l’UUID du locataire pour gérer la signature multi-locataires.
              </div>
            </div>
          )}

          <div style={labelStyle(muted)}>
            <div>Nom signataire</div>
            <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} style={inputStyle(border)} />
          </div>

          <div style={{ marginTop: 10 }}>
            <canvas
              ref={tenantCanvasRef}
              style={{ width: "100%", border: `1px solid ${border}`, borderRadius: 12, touchAction: "none" }}
              onMouseDown={startTenant}
              onMouseMove={moveTenant}
              onMouseUp={endTenant}
              onMouseLeave={endTenant}
              onTouchStart={startTenant}
              onTouchMove={moveTenant}
              onTouchEnd={endTenant}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={() => clearCanvas(tenantCanvasRef.current)} style={btnAction(border)}>
              Effacer
            </button>
            <button onClick={() => sign("LOCATAIRE")} style={btnPrimarySmall(blue)}>
              Signer
            </button>
          </div>
        </div>

        <div style={card(border)}>
          <h2 style={{ marginTop: 0 }}>Signature garant</h2>

          <label style={labelStyle(muted)}>
            Garant signataire (obligatoire)
            <select
              value={selectedGuaranteeId}
              onChange={(e) => setSelectedGuaranteeId(e.target.value)}
              disabled={!guarantorSignables.length}
              style={{ ...inputStyle(border), cursor: guarantorSignables.length ? "pointer" : "not-allowed" }}
            >
              {guarantorSignables.length === 0 ? <option value="">— Aucun acte généré —</option> : null}
              {guarantorSignables.map((g) => (
                <option key={g.key} value={g.guaranteeId}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>

          <div style={labelStyle(muted)}>
            <div>Nom signataire</div>
            <input value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} style={inputStyle(border)} />
          </div>

          <div style={{ marginTop: 10 }}>
            <canvas
              ref={guarantorCanvasRef}
              style={{ width: "100%", border: `1px solid ${border}`, borderRadius: 12, touchAction: "none" }}
              onMouseDown={startGuarantor}
              onMouseMove={moveGuarantor}
              onMouseUp={endGuarantor}
              onMouseLeave={endGuarantor}
              onTouchStart={startGuarantor}
              onTouchMove={moveGuarantor}
              onTouchEnd={endGuarantor}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                clearCanvas(guarantorCanvasRef.current);
                guarantorDirty.current = false;
              }}
              style={btnAction(border)}
            >
              Effacer
            </button>

            <button onClick={signGuarantor} style={btnPrimarySmall(blue)} disabled={!selectedGuarantor}>
              Signer
            </button>
          </div>
        </div>

        <div style={card(border)}>
          <h2 style={{ marginTop: 0 }}>Signature bailleur</h2>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: muted, fontWeight: 700, marginBottom: 6 }}>
              Document à signer
            </div>

            <select
              value={selectedLandlordDocKey}
              onChange={(e) => setSelectedLandlordDocKey(e.target.value)}
              disabled={!landlordSignables.length}
              style={{ ...inputStyle(border), cursor: landlordSignables.length ? "pointer" : "not-allowed" }}
            >
              {landlordSignables.length === 0 ? (
                <option value="">— Aucun document —</option>
              ) : null}

              {landlordSignables.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>

            <div style={{ fontSize: 12, color: muted, marginTop: 6 }}>
              Le pad ci-dessous signera le document sélectionné.
            </div>
          </div>

          <div style={labelStyle(muted)}>
            <div>Nom signataire</div>
            <input value={landlordName} onChange={(e) => setLandlordName(e.target.value)} style={inputStyle(border)} />
          </div>

          <div style={{ marginTop: 10 }}>
            <canvas
              ref={landlordCanvasRef}
              style={{ width: "100%", border: `1px solid ${border}`, borderRadius: 12, touchAction: "none" }}
              onMouseDown={startLandlord}
              onMouseMove={moveLandlord}
              onMouseUp={endLandlord}
              onMouseLeave={endLandlord}
              onTouchStart={startLandlord}
              onTouchMove={moveLandlord}
              onTouchEnd={endLandlord}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={() => clearCanvas(landlordCanvasRef.current)} style={btnAction(border)}>
              Effacer
            </button>
            <button
              onClick={() => sign("BAILLEUR")}
              style={btnPrimarySmall(blue)}
              disabled={!selectedLandlordDoc}
            >
              Signer
            </button>
          </div>
        </div>
      </div>

      <div>
        <Link href="/dashboard/leases" style={{ color: blue, fontWeight: 800 }}>
          Retour aux baux
        </Link>
      </div>
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
    boxSizing: "border-box",
  } as const;
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
    textAlign: "center" as const,
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

function btnAction(border: string) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    minWidth: 160,
    textAlign: "center" as const,
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
