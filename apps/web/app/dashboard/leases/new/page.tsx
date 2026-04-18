"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeEuro,
  CalendarDays,
  Check,
  ChevronRight,
  Home,
  Plus,
  RefreshCw,
  Shield,
  User,
  Users,
} from "lucide-react";
import { Plus_Jakarta_Sans } from "next/font/google";

type Unit = {
  id: string;
  code: string;
  label: string;
  address_line1: string;
  city: string;
  postal_code: string;
  surface_m2: number;
  floor: number | null;
  project_id?: string | null;
  project_name?: string | null;
  building_name?: string | null;
};

type Tenant = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
};

type GuaranteeDraftType = "NONE" | "CAUTION" | "VISALE";
type LeaseChargesMode = "FORFAIT" | "PROVISION";
type StepKey = "context" | "occupants" | "financial" | "designation" | "guarantees";

type GuaranteeDraft = {
  type: GuaranteeDraftType;
  guarantorFullName: string;
  guarantorEmail: string;
  guarantorPhone: string;
  visaleReference: string;
};

type LeaseDesignation = {
  batiment?: string;
  porte?: string;
  etagePrecision?: string;
  typeBien?: "appartement" | "maison";
  usageMixte?: boolean;
  consistance?: string;
  description?: string;
  chauffageType?: string;
  eauChaudeType?: string;
  dependances?: string[];
  equipementsCommuns?: string[];
};

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

const uiFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const COLORS = {
  primary: "#1F5EDC",
  primaryDark: "#25457A",
  accent: "#20C7C7",

  primarySoft: "#EEF4FF",
  primarySofter: "#F5F8FF",
  accentSoft: "#E9FBFB",

  text: "#182133",
  textSoft: "#667085",
  textMuted: "#7F89A2",

  border: "rgba(24,34,52,0.08)",
  borderSoft: "rgba(24,34,52,0.06)",

  bgPage: "#F5F7FB",
  bgSurface: "#FFFFFF",
  bgSurfaceAlt: "#F8FBFF",
};

function emptyGuaranteeDraft(): GuaranteeDraft {
  return {
    type: "NONE",
    guarantorFullName: "",
    guarantorEmail: "",
    guarantorPhone: "",
    visaleReference: "",
  };
}

function toggleArrayValueIn(
  current: LeaseDesignation,
  key: "dependances" | "equipementsCommuns",
  value: string
): LeaseDesignation {
  const set = new Set(current[key] || []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return { ...current, [key]: Array.from(set) };
}

function PremiumSectionIcon({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div style={premiumSectionIconWrapStyle}>{children}</div>;
}

function SectionContextIcon() {
  return (
    <PremiumSectionIcon>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4.5 10.25L12 4.75L19.5 10.25"
          stroke="#2A7BEF"
          strokeWidth="2.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7 9.8V18.5H17V9.8"
          stroke="#2A7BEF"
          strokeWidth="2.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 12.75H14V16H10V12.75Z"
          stroke="#2A7BEF"
          strokeWidth="2.45"
          strokeLinejoin="round"
        />
      </svg>
    </PremiumSectionIcon>
  );
}

function SectionOccupantsIcon() {
  return (
    <PremiumSectionIcon>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="2.75" stroke="#2A7BEF" strokeWidth="2.45" />
        <path
          d="M7.2 18C7.95 15.95 9.63 14.8 12 14.8C14.37 14.8 16.05 15.95 16.8 18"
          stroke="#2A7BEF"
          strokeWidth="2.45"
          strokeLinecap="round"
        />
      </svg>
    </PremiumSectionIcon>
  );
}

function SectionFinanceIcon() {
  return (
    <PremiumSectionIcon>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M16.3 6.7C15.45 6.02 14.48 5.65 13.3 5.65C10.55 5.65 8.73 7.26 8.15 9.9H15.95"
          stroke="#2A7BEF"
          strokeWidth="2.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15.7 16.95C14.88 17.56 13.94 17.9 12.82 17.9C10.08 17.9 8.27 16.31 7.68 13.7H15.2"
          stroke="#2A7BEF"
          strokeWidth="2.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M6.75 9.9H5.1" stroke="#2A7BEF" strokeWidth="2.45" strokeLinecap="round" />
        <path d="M6.1 13.7H4.45" stroke="#2A7BEF" strokeWidth="2.45" strokeLinecap="round" />
      </svg>
    </PremiumSectionIcon>
  );
}

function SectionShieldIcon() {
  return (
    <PremiumSectionIcon>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 4.7L17.35 6.9V11.35C17.35 14.8 15.2 17.55 12 18.95C8.8 17.55 6.65 14.8 6.65 11.35V6.9L12 4.7Z"
          stroke="#2A7BEF"
          strokeWidth="2.45"
          strokeLinejoin="round"
        />
        <path
          d="M10.4 11.8L11.65 13.05L14.2 10.5"
          stroke="#2A7BEF"
          strokeWidth="2.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </PremiumSectionIcon>
  );
}

export default function NewLeasePage() {
  const router = useRouter();

  const [token, setToken] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isCompact, setIsCompact] = useState(false);
  const [activeStep, setActiveStep] = useState<StepKey>("context");

  const [landlordReadiness, setLandlordReadiness] = useState<{
    ready: boolean;
    projectId: string;
    missing: string[];
    landlord: {
      name?: string;
      address?: string;
      email?: string;
      phone?: string;
    } | null;
  } | null>(null);

  const [loadingLandlordReadiness, setLoadingLandlordReadiness] = useState(false);

  const [unitId, setUnitId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [coTenantIds, setCoTenantIds] = useState<string[]>([]);
  const [newCoTenantIdCreate, setNewCoTenantIdCreate] = useState("");
  const [guaranteeByTenantId, setGuaranteeByTenantId] = useState<Record<string, GuaranteeDraft>>(
    {}
  );

  const [startDate, setStartDate] = useState("");
  const [endDateTheoretical, setEndDateTheoretical] = useState("");

  const [rent, setRent] = useState<number>(950);
  const [charges, setCharges] = useState<number>(50);
  const [chargesMode, setChargesMode] = useState<LeaseChargesMode>("FORFAIT");
  const [deposit, setDeposit] = useState<number>(1900);
  const [paymentDay, setPaymentDay] = useState<number>(5);
  const [kind, setKind] = useState<string>("MEUBLE_RP");

  const [designation, setDesignation] = useState<LeaseDesignation>({
    batiment: "Bâtiment principal",
    porte: "",
    etagePrecision: "",
    typeBien: "appartement",
    usageMixte: false,
    consistance: "",
    description: "",
    chauffageType: "électrique individuel",
    eauChaudeType: "ballon électrique",
    dependances: [],
    equipementsCommuns: ["interphone"],
  });

  const [keysCount, setKeysCount] = useState<number | "">(2);
  const [irlQuarter, setIrlQuarter] = useState<string>("");
  const [irlValue, setIrlValue] = useState<string>("");
  const [irlEnabledCreate, setIrlEnabledCreate] = useState(false);

  const contextRef = useRef<HTMLElement | null>(null);
  const occupantsRef = useRef<HTMLElement | null>(null);
  const financialRef = useRef<HTMLElement | null>(null);
  const designationRef = useRef<HTMLElement | null>(null);
  const guaranteesRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  useEffect(() => {
    const onResize = () => setIsCompact(window.innerWidth < 1280);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const refs: Array<[StepKey, React.RefObject<HTMLElement | null>]> = [
      ["context", contextRef],
      ["occupants", occupantsRef],
      ["financial", financialRef],
      ["designation", designationRef],
      ["guarantees", guaranteesRef],
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (!visible.length) return;
        const found = refs.find(([, ref]) => ref.current === visible[0].target);
        if (found) setActiveStep(found[0]);
      },
      {
        rootMargin: "-18% 0px -55% 0px",
        threshold: [0.15, 0.35, 0.55],
      }
    );

    refs.forEach(([, ref]) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, [kind]);

  function ensureGuaranteeDraft(idLike: string) {
    const id = String(idLike || "").trim();
    if (!id) return;
    setGuaranteeByTenantId((prev) => {
      if (prev[id]) return prev;
      return { ...prev, [id]: emptyGuaranteeDraft() };
    });
  }

  function updateGuaranteeDraft(idLike: string, patch: Partial<GuaranteeDraft>) {
    const id = String(idLike || "").trim();
    if (!id) return;
    setGuaranteeByTenantId((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || emptyGuaranteeDraft()), ...patch },
    }));
  }

  useEffect(() => {
    setCoTenantIds((prev) => prev.filter((id) => id && id !== tenantId));
    setNewCoTenantIdCreate("");
    ensureGuaranteeDraft(tenantId);
  }, [tenantId]);

  function prefillDesignationFromUnit(u: Unit | undefined) {
    if (!u) return;

    const floorLabel =
      u.floor === null || u.floor === undefined ? "" : u.floor === 0 ? "Étage 0" : `Étage ${u.floor}`;

    setDesignation((prev) => ({
      ...prev,
      batiment: u.building_name || prev.batiment || "Bâtiment principal",
      porte: u.code || prev.porte || "",
      etagePrecision: floorLabel || prev.etagePrecision || "",
      consistance: u.label || prev.consistance || "",
    }));
  }

  async function loadLandlordReadinessForProject(projectId: string) {
    if (!token || !projectId) {
      setLandlordReadiness(null);
      return;
    }

    setLoadingLandlordReadiness(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/landlord/readiness`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        cache: "no-store",
      });

      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setLandlordReadiness(null);
        return;
      }

      setLandlordReadiness(j);
    } finally {
      setLoadingLandlordReadiness(false);
    }
  }

  async function loadInitialData() {
    setError("");
    setStatus("Chargement…");
    try {
      const [u, t] = await Promise.all([
        fetch(`${API}/units`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }).then((r) => r.json()),
        fetch(`${API}/tenants`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }).then((r) => r.json()),
      ]);

      const unitsArr: Unit[] = Array.isArray(u) ? u : [];
      const tenantsArr: Tenant[] = Array.isArray(t) ? t : [];

      setUnits(unitsArr);
      setTenants(tenantsArr);

      if (!unitId && unitsArr[0]?.id) {
        setUnitId(unitsArr[0].id);
        prefillDesignationFromUnit(unitsArr[0]);
      }

      if (!tenantId && tenantsArr[0]?.id) {
        setTenantId(tenantsArr[0].id);
      }

      if (!startDate) {
        setStartDate(new Date().toISOString().slice(0, 10));
      }

      if (!endDateTheoretical) {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        d.setDate(d.getDate() - 1);
        setEndDateTheoretical(d.toISOString().slice(0, 10));
      }

      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    if (token) loadInitialData();
  }, [token]);

  useEffect(() => {
    const u = units.find((x) => x.id === unitId);
    prefillDesignationFromUnit(u);

    const projectId = String(u?.project_id || "").trim();
    if (!projectId) {
      setLandlordReadiness(null);
      return;
    }

    loadLandlordReadinessForProject(projectId);
  }, [unitId, units, token]);

  useEffect(() => {
    if (kind === "SAISONNIER") {
      setGuaranteeByTenantId({});
    }
  }, [kind]);

  const createTenantsList = useMemo(() => {
    const list: Array<{ id: string; full_name: string; email?: string | null; role: string }> = [];
    const main = tenants.find((t) => t.id === tenantId);
    if (main) list.push({ ...main, role: "principal" });
    for (const id of coTenantIds) {
      const t = tenants.find((x) => x.id === id);
      if (t) list.push({ ...t, role: "cotenant" });
    }
    return list;
  }, [tenants, tenantId, coTenantIds]);

  useEffect(() => {
    createTenantsList.forEach((t) => ensureGuaranteeDraft(t.id));
  }, [createTenantsList]);

  const selectedUnit = useMemo(() => units.find((u) => u.id === unitId) || null, [units, unitId]);
  const selectedMainTenant = useMemo(
    () => tenants.find((t) => t.id === tenantId) || null,
    [tenants, tenantId]
  );

  const landlordReady = landlordReadiness?.ready === true;
  const landlordMissing = landlordReadiness?.missing || [];

  const draftSummary = useMemo(() => {
    const rentValue = Number(rent || 0);
    const chargesValue = Number(charges || 0);
    return {
      unitLabel: selectedUnit ? `${selectedUnit.code} — ${selectedUnit.label}` : "Aucun logement sélectionné",
      tenantLabel: selectedMainTenant?.full_name || "Aucun locataire principal",
      leaseKindLabel:
        kind === "MEUBLE_RP" ? "Meublé (RP)" : kind === "NU_RP" ? "Nu (RP)" : "Saisonnier",
      amountLabel: `${rentValue.toFixed(0)} € + ${chargesValue.toFixed(0)} €`,
      coTenantCount: coTenantIds.length,
    };
  }, [selectedUnit, selectedMainTenant, kind, rent, charges, coTenantIds]);

  const completedSteps = useMemo<Record<StepKey, boolean>>(
    () => ({
      context: Boolean(kind && unitId && tenantId),
      occupants: true,
      financial: Boolean(
        startDate && endDateTheoretical && Number.isFinite(rent) && Number.isFinite(charges)
      ),
      designation: Boolean(designation.batiment || designation.porte || designation.consistance),
      guarantees:
        kind === "SAISONNIER"
          ? true
          : createTenantsList.every((t) => {
              const g = guaranteeByTenantId[t.id] || emptyGuaranteeDraft();
              if (g.type === "NONE") return true;
              if (g.type === "CAUTION") {
                return Boolean(g.guarantorFullName.trim() && g.guarantorEmail.trim());
              }
              if (g.type === "VISALE") {
                return Boolean(g.visaleReference.trim());
              }
              return false;
            }),
    }),
    [
      kind,
      unitId,
      tenantId,
      startDate,
      endDateTheoretical,
      rent,
      charges,
      designation,
      createTenantsList,
      guaranteeByTenantId,
    ]
  );

  async function createGuaranteesAfterLeaseCreated(newLeaseId: string, allowedTenantIds: string[]) {
    const allowed = new Set((allowedTenantIds || []).map((x) => String(x).trim()).filter(Boolean));

    const entries = (Object.entries(guaranteeByTenantId) as Array<[string, GuaranteeDraft]>).filter(
      ([tenantId]) => allowed.has(String(tenantId).trim())
    );

    for (const [tenantId, g] of entries) {
      if (!g || g.type === "NONE") continue;

      if (g.type === "CAUTION") {
        const full = String(g.guarantorFullName || "").trim();
        const em = String(g.guarantorEmail || "").trim();
        if (!full || !em) throw new Error(`Caution: nom/email manquants pour le locataire ${tenantId}`);

        const gr = await fetch(`${API}/guarantees`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          credentials: "include",
          body: JSON.stringify({
            leaseId: newLeaseId,
            tenantId,
            type: "CAUTION",
            selected: true,
            guarantorFullName: full,
            guarantorEmail: em,
            guarantorPhone: String(g.guarantorPhone || "").trim() || null,
          }),
        });

        const gj = await gr.json().catch(() => ({}));
        if (!gr.ok) throw new Error(gj?.message || JSON.stringify(gj));
      }

      if (g.type === "VISALE") {
        const ref = String(g.visaleReference || "").trim();
        if (!ref) throw new Error(`Visale: référence manquante pour le locataire ${tenantId}`);

        const vr = await fetch(`${API}/guarantees`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          credentials: "include",
          body: JSON.stringify({
            leaseId: newLeaseId,
            tenantId,
            type: "VISALE",
            selected: true,
            visaleReference: ref,
          }),
        });

        const vj = await vr.json().catch(() => ({}));
        if (!vr.ok) throw new Error(vj?.message || JSON.stringify(vj));
      }
    }
  }

  async function createLease() {
    setError("");
    setStatus("Création du bail…");

    if (landlordReadiness && !landlordReadiness.ready) {
      setError(`Bailleur projet incomplet : ${landlordReadiness.missing.join(", ")}`);
      setStatus("");
      return;
    }

    if (!unitId || !tenantId) {
      setStatus("");
      setError("Veuillez sélectionner un logement et un locataire.");
      return;
    }

    if (irlEnabledCreate && (!irlQuarter.trim() || !irlValue.trim())) {
      setStatus("");
      setError("Le trimestre et la valeur IRL sont obligatoires quand l’IRL est activé.");
      return;
    }

    if (irlEnabledCreate) {
      const parsedIrlValue = Number(irlValue);
      if (!Number.isFinite(parsedIrlValue) || parsedIrlValue <= 0) {
        setStatus("");
        setError("La valeur IRL doit être un nombre valide supérieur à 0.");
        return;
      }
    }

    const payload: any = {
      unitId,
      tenantId,
      coTenantIds,
      startDate,
      endDateTheoretical,
      rentCents: Math.round((rent || 0) * 100),
      chargesCents: Math.round((charges || 0) * 100),
      chargesMode,
      depositCents: Math.round((deposit || 0) * 100),
      paymentDay: paymentDay || 5,
      kind,
      leaseDesignation: designation,
      keysCount: keysCount === "" ? null : Number(keysCount),
      irlReferenceQuarter: irlQuarter.trim() || null,
      irlReferenceValue: irlValue.trim() ? Number(irlValue) : null,
      irlEnabled: irlEnabledCreate,
    };

    try {
      const r = await fetch(`${API}/leases`, {
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

      const createdLeaseId = j?.lease?.id || j?.leaseId || j?.id || j?.created?.id || null;
      if (!createdLeaseId) {
        setStatus("");
        setError("Bail créé mais id introuvable dans la réponse API.");
        return;
      }

      try {
        await createGuaranteesAfterLeaseCreated(createdLeaseId, [tenantId, ...coTenantIds]);
      } catch (e: any) {
        console.error(e);
        setStatus("");
        setError(
          `Bail créé ✅ (id=${createdLeaseId}) mais création des garanties échouée : ${String(
            e?.message || e
          )}`
        );
      }

      setGuaranteeByTenantId({});
      router.push("/dashboard/leases");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  function scrollToStep(step: StepKey) {
    const map: Record<StepKey, HTMLElement | null> = {
      context: contextRef.current,
      occupants: occupantsRef.current,
      financial: financialRef.current,
      designation: designationRef.current,
      guarantees: guaranteesRef.current,
    };
    map[step]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const completedCount = Object.values(completedSteps).filter(Boolean).length;

  const sidebar = (
  <aside style={rightRailStyle(isCompact)}>
    <div style={railUnifiedCardStyle}>
      <div style={railSectionStyle}>
        <div style={railOverlineStyle}>Progression</div>
        <div style={railTitleStyle}>Création guidée</div>

        <div style={railCompactStepsStyle}>
          <RailStep
            title="Contexte"
            isActive={activeStep === "context"}
            isDone={completedSteps.context}
            isLast={false}
            onClick={() => scrollToStep("context")}
          />
          <RailStep
            title="Occupants"
            isActive={activeStep === "occupants"}
            isDone={completedSteps.occupants}
            isLast={false}
            onClick={() => scrollToStep("occupants")}
          />
          <RailStep
            title="Financier"
            isActive={activeStep === "financial"}
            isDone={completedSteps.financial}
            isLast={false}
            onClick={() => scrollToStep("financial")}
          />
          <RailStep
            title="Désignation"
            isActive={activeStep === "designation"}
            isDone={completedSteps.designation}
            isLast={kind === "SAISONNIER"}
            onClick={() => scrollToStep("designation")}
          />
          {kind !== "SAISONNIER" ? (
            <RailStep
              title="Garanties"
              isActive={activeStep === "guarantees"}
              isDone={completedSteps.guarantees}
              isLast={true}
              onClick={() => scrollToStep("guarantees")}
            />
          ) : null}
        </div>
      </div>

      <div style={railSideCardStyle}>
        <div style={railSideCardTitleStyle}>Résumé du bail</div>

        <div style={railBigHomeRowStyle}>
          <div style={railHomeIconWrapStyle}>
            <Home size={26} strokeWidth={2.1} />
          </div>
          <div>
            <div style={railBigHomeTitleStyle}>{selectedUnit?.label || "Appartement T2"}</div>
            <div style={railBigHomeMetaStyle}>{selectedUnit?.city || "Adresse à confirmer"}</div>
          </div>
        </div>

        <div style={railFactsListStyle}>
          <div style={railFactRowStyle}>
            <span style={railFactIconStyle}><User size={14} /></span>
            <span>{1 + coTenantIds.length} locataire{1 + coTenantIds.length > 1 ? "s" : ""}</span>
          </div>
          <div style={railFactRowStyle}>
            <span style={railFactIconStyle}><BadgeEuro size={14} /></span>
            <span>{`${Number(rent || 0) + Number(charges || 0)} €/mois`}</span>
          </div>
        </div>
      </div>

      <div style={railQualityCardStyle}>
        <div style={railQualityTopStyle}>
          <span style={railQualityDotStyle}>✓</span>
          <span style={railQualityTitleStyle}>Qualité du dossier</span>
        </div>
        <div style={railQualitySubStyle}>{completedCount} étape{completedCount > 1 ? "s" : ""} remplie{completedCount > 1 ? "s" : ""}</div>
      </div>

      <div style={railSideCardStyle}>
        <div style={railSideCardTitleStyle}>Résumé du bail</div>

        <SummaryLine icon={<Home size={14} />} label="Logement" value={draftSummary.unitLabel} />
        <SummaryLine icon={<User size={14} />} label="Locataire" value={draftSummary.tenantLabel} />
        <SummaryLine
          icon={<Users size={14} />}
          label="Occupants"
          value={`${1 + coTenantIds.length} personne${1 + coTenantIds.length > 1 ? "s" : ""}`}
        />
        <SummaryLine icon={<BadgeEuro size={14} />} label="Montant" value={draftSummary.amountLabel} />
        <SummaryLine
          icon={<CalendarDays size={14} />}
          label="Période"
          value={`${startDate || "—"} → ${endDateTheoretical || "—"}`}
        />
      </div>

      <button onClick={createLease} style={railPrimaryButtonStyle}>
        Créer le bail
      </button>
    </div>
  </aside>
);

  return (
    <main className={uiFont.className} style={pageShellStyle}>
      <div style={pageInnerStyle}>
        <div style={topBarStyle}>
          <button onClick={() => router.push("/dashboard/leases")} style={softButtonStyle}>
            <ArrowLeft size={15} /> Retour aux baux
          </button>
          <button onClick={loadInitialData} style={softButtonStyle}>
            <RefreshCw size={14} /> Rafraîchir
          </button>
        </div>

        

        <div style={mainLayoutStyle(isCompact)}>
          <div style={leftColumnStyle}>
          <section style={pageTitleBlockStyle}>
            <div style={heroEyebrowStyle}>Création de bail</div>
            <h1 style={heroTitleStyle}>Créer un nouveau bail</h1>

            <div style={heroIdentityLineStyle}>
              <span style={heroIdentityPrimaryStyle}>{draftSummary.unitLabel}</span>
              <span style={heroIdentityDividerStyle}>•</span>
              <span style={heroIdentitySecondaryStyle}>
                {selectedUnit?.city || selectedUnit?.postal_code || "Adresse à confirmer"}
              </span>
            </div>
          </section>

          {status ? <div style={successAlertStyle}>{status}</div> : null}
          {error ? <div style={errorAlertStyle}>{error}</div> : null}
          {loadingLandlordReadiness ? (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: "#fff",
                color: COLORS.textSoft,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Vérification du bailleur du projet…
            </div>
          ) : landlordReadiness && !landlordReady ? (
            <div
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 14,
                border: "1px solid rgba(239,68,68,0.18)",
                background: "rgba(239,68,68,0.05)",
                color: "#B42318",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700 }}>Bailleur projet incomplet</div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                Le bail peut être préparé, mais le parcours documentaire et la signature bailleur
                resteront bloqués tant que ces champs ne sont pas complétés :
                <b> {landlordMissing.join(", ")}</b>
              </div>
              <a
                href={`/dashboard/projects/${landlordReadiness.projectId}/settings/landlord`}
                style={{
                  color: COLORS.primary,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Ouvrir la fiche bailleur du projet →
              </a>
            </div>
          ) : landlordReadiness && landlordReady ? (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(49,132,90,0.16)",
                background: "rgba(49,132,90,0.05)",
                color: "#166534",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Bailleur projet prêt ✅
            </div>
          ) : null}
            <section style={heroRibbonShellStyle}>
              <div style={heroRibbonStyle}>
                <div style={heroRibbonLeftStyle}>
                  <div style={heroRibbonIconPlateStyle}>
                    <SectionContextIcon />
                  </div>

                  <div style={heroRibbonAmountStyle}>{draftSummary.amountLabel}</div>

                  <div style={heroRibbonChevronStyle}>›</div>

                  <div style={heroRibbonDatesStyle}>
                    <div>{startDate || "—"}</div>
                    <div>{endDateTheoretical || "—"}</div>
                  </div>
                </div>

                <button type="button" style={heroRibbonButtonStyle}>
                  <Home size={15} />
                  Résumé du bail
                </button>
              </div>
            </section>
            <StepSection
              refEl={contextRef}
              number="01"
              title="Contexte du bail"
              icon={<SectionContextIcon />}
              accent
            >
              <div style={fieldsGrid3Style}>
                <Field label="Type de location">
                  <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle}>
                    <option value="MEUBLE_RP">Meublé (résidence principale)</option>
                    <option value="NU_RP">Nu (résidence principale)</option>
                    <option value="SAISONNIER">Saisonnier</option>
                  </select>
                </Field>

                <Field label="Logement">
                  <select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={inputStyle}>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} — {u.label}
                        {u.building_name ? ` (${u.building_name})` : ""}
                        {u.project_name ? ` • ${u.project_name}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Locataire principal">
                  <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} style={inputStyle}>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                        {t.email ? ` — ${t.email}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </StepSection>

            <StepSection
              refEl={occupantsRef}
              number="02"
              title="Occupants"
              icon={<SectionOccupantsIcon />}
            >
              <div style={inlineAddStyle(isCompact)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Field label="Ajouter un co-locataire">
                    <select
                      value={newCoTenantIdCreate}
                      onChange={(e) => setNewCoTenantIdCreate(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Rechercher ou sélectionner un locataire…</option>
                      {tenants
                        .filter((t) => t.id !== tenantId)
                        .filter((t) => !coTenantIds.includes(t.id))
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name} {t.email ? `— ${t.email}` : ""}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const id = String(newCoTenantIdCreate || "").trim();
                    if (!id) return;
                    setCoTenantIds((prev) => Array.from(new Set([...prev, id])));
                    ensureGuaranteeDraft(id);
                    setNewCoTenantIdCreate("");
                  }}
                  style={addInlineButtonStyle}
                >
                  Ajouter
                </button>
              </div>

              {coTenantIds.length > 0 ? (
                <div style={chipsGridStyle}>
                  {coTenantIds.map((id) => {
                    const t = tenants.find((x) => x.id === id);
                    return (
                      <div key={id} style={tenantChipRowStyle}>
                        <div style={tenantChipIdentityStyle}>
                          <div style={tenantAvatarStyle}>
                            {(t?.full_name || "?").slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div style={chipTitleStyle}>{t?.full_name || id}</div>
                            <div style={chipSubStyle}>Co-locataire</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCoTenantIds((prev) => prev.filter((x) => x !== id))}
                          style={dangerTextButtonStyle}
                        >
                          Retirer
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={emptyStateStyle}>Aucun co-locataire pour l’instant.</div>
              )}
            </StepSection>

            <StepSection
              refEl={financialRef}
              number="03"
              title="Conditions financières"
              icon={<SectionFinanceIcon />}
              accent
            >
              <div style={fieldsGrid2Style}>
                <Field label="Date de début">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Date de fin">
                  <input
                    type="date"
                    value={endDateTheoretical}
                    onChange={(e) => setEndDateTheoretical(e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </div>

              <div style={financeGridStyle}>
                <Field label="Loyer (€)">
                  <input type="number" value={rent} onChange={(e) => setRent(Number(e.target.value))} style={inputStyle} />
                </Field>
                <Field label="Charges (€)">
                  <input
                    type="number"
                    value={charges}
                    onChange={(e) => setCharges(Number(e.target.value))}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Mode de charges">
                  <div style={segmentedStyle}>
                    <button
                      type="button"
                      style={chargesMode === "FORFAIT" ? segmentActiveStyle : segmentStyle}
                      onClick={() => setChargesMode("FORFAIT")}
                    >
                      Forfait
                    </button>
                    <button
                      type="button"
                      style={chargesMode === "PROVISION" ? segmentActiveStyle : segmentStyle}
                      onClick={() => setChargesMode("PROVISION")}
                    >
                      Provision
                    </button>
                  </div>
                </Field>
                <Field label="Dépôt (€)">
                  <input
                    type="number"
                    value={deposit}
                    onChange={(e) => setDeposit(Number(e.target.value))}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Jour de paiement">
                  <input
                    type="number"
                    value={paymentDay}
                    onChange={(e) => setPaymentDay(Number(e.target.value))}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </StepSection>

            <div style={sectionSeparatorStyle}>Informations avancées</div>

            <div style={advancedSectionsStackStyle}>
              <StepSection
                refEl={designationRef}
                number="04"
                title="Désignation"
                icon={<SectionShieldIcon />}
                subtle
              >
                <div style={fieldsGrid3AdvancedStyle}>
                  <Field label="Bâtiment">
                    <input
                      value={designation.batiment || ""}
                      onChange={(e) => setDesignation((p) => ({ ...p, batiment: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Porte / Lot">
                    <input
                      value={designation.porte || ""}
                      onChange={(e) => setDesignation((p) => ({ ...p, porte: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Précision étage">
                    <input
                      value={designation.etagePrecision || ""}
                      onChange={(e) => setDesignation((p) => ({ ...p, etagePrecision: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>
                </div>

                <div style={fieldsGrid3AdvancedStyle}>
                  <Field label="Type de bien">
                    <select
                      value={designation.typeBien || "appartement"}
                      onChange={(e) =>
                        setDesignation((p) => ({ ...p, typeBien: e.target.value as "appartement" | "maison" }))
                      }
                      style={inputStyle}
                    >
                      <option value="appartement">Appartement</option>
                      <option value="maison">Maison</option>
                    </select>
                  </Field>

                  <Field label="Consistance">
                    <input
                      value={designation.consistance || ""}
                      onChange={(e) => setDesignation((p) => ({ ...p, consistance: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Descriptif">
                    <input
                      value={designation.description || ""}
                      onChange={(e) => setDesignation((p) => ({ ...p, description: e.target.value }))}
                      style={inputStyle}
                    />
                  </Field>
                </div>

                <div style={fieldsGrid3AdvancedStyle}>
                  <Field label="Usage mixte">
                    <label style={checkboxRowStyle}>
                      <input
                        type="checkbox"
                        checked={Boolean(designation.usageMixte)}
                        onChange={(e) => setDesignation((p) => ({ ...p, usageMixte: e.target.checked }))}
                      />
                      <span>Habitation + pro</span>
                    </label>
                  </Field>

                  <Field label="Chauffage">
                    <select
                      value={designation.chauffageType || "électrique individuel"}
                      onChange={(e) => setDesignation((p) => ({ ...p, chauffageType: e.target.value }))}
                      style={inputStyle}
                    >
                      <option value="électrique individuel">Électrique individuel</option>
                      <option value="gaz individuel">Gaz individuel</option>
                      <option value="collectif">Collectif</option>
                      <option value="pompe à chaleur">Pompe à chaleur</option>
                      <option value="autre">Autre</option>
                    </select>
                  </Field>

                  <Field label="Eau chaude">
                    <select
                      value={designation.eauChaudeType || "ballon électrique"}
                      onChange={(e) => setDesignation((p) => ({ ...p, eauChaudeType: e.target.value }))}
                      style={inputStyle}
                    >
                      <option value="ballon électrique">Ballon électrique</option>
                      <option value="chaudière gaz">Chaudière gaz</option>
                      <option value="collectif">Collectif</option>
                      <option value="autre">Autre</option>
                    </select>
                  </Field>
                </div>

                <div style={fieldsGrid3AdvancedStyle}>
                  <Field label="Nombre de clés remises">
                    <input
                      type="number"
                      value={keysCount}
                      onChange={(e) => setKeysCount(e.target.value === "" ? "" : Number(e.target.value))}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Source">
                    <input
                      value="Pré-rempli depuis le logement sélectionné"
                      readOnly
                      style={{ ...inputStyle, color: "#78839B", background: "#FBFCFF" }}
                    />
                  </Field>
                  <div />
                </div>

                <div style={subtleInlinePanelStyle}>
                  <div style={subtleInlineHeaderStyle}>
                    <div style={subtleInlineTitleStyle}>Révision IRL</div>
                    <label style={checkboxRowStyle}>
                      <input
                        type="checkbox"
                        checked={irlEnabledCreate}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIrlEnabledCreate(checked);
                          if (!checked) {
                            setIrlQuarter("");
                            setIrlValue("");
                          }
                        }}
                      />
                      <span>Activer</span>
                    </label>
                  </div>

                  <div style={fieldsGrid2Style}>
                    <Field label="Trimestre">
                      <input
                        value={irlQuarter}
                        onChange={(e) => setIrlQuarter(e.target.value)}
                        placeholder="ex: T3 2025"
                        style={inputStyle}
                        disabled={!irlEnabledCreate}
                      />
                    </Field>
                    <Field label="Valeur">
                      <input
                        value={irlValue}
                        onChange={(e) => setIrlValue(e.target.value)}
                        placeholder="ex: 142.06"
                        style={inputStyle}
                        disabled={!irlEnabledCreate}
                      />
                    </Field>
                  </div>
                </div>

                <div style={fieldsGrid2Style}>
                  <div style={subtleInlinePanelStyle}>
                    <div style={subtleInlineTitleStyle}>Dépendances</div>
                    {["cave", "parking", "garage", "jardin", "terrasse", "balcon"].map((x) => (
                      <label key={x} style={checkRowStyle}>
                        <input
                          type="checkbox"
                          checked={(designation.dependances || []).includes(x)}
                          onChange={() => setDesignation((p) => toggleArrayValueIn(p, "dependances", x))}
                        />
                        <span style={{ textTransform: "capitalize" }}>{x}</span>
                      </label>
                    ))}
                  </div>

                  <div style={subtleInlinePanelStyle}>
                    <div style={subtleInlineTitleStyle}>Équipements communs</div>
                    {["interphone", "digicode", "ascenseur", "antenne TV", "fibre"].map((x) => (
                      <label key={x} style={checkRowStyle}>
                        <input
                          type="checkbox"
                          checked={(designation.equipementsCommuns || []).includes(x)}
                          onChange={() =>
                            setDesignation((p) => toggleArrayValueIn(p, "equipementsCommuns", x))
                          }
                        />
                        <span>{x}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </StepSection>

              {kind !== "SAISONNIER" && (
                <StepSection
                  refEl={guaranteesRef}
                  number="05"
                  title="Garanties"
                  icon={<SectionShieldIcon />}
                  subtle
                >
                  <div style={guaranteesStackStyle}>
                    {createTenantsList.map((t, index) => {
                      const g = guaranteeByTenantId[t.id] || emptyGuaranteeDraft();
                      return (
                        <div key={t.id} style={guaranteeRowStyle(index === 0)}>
                          <div style={guaranteeRowHeaderStyle}>
                            <div>
                              <div style={chipTitleStyle}>{t.full_name}</div>
                              <div style={chipSubStyle}>
                                {t.role === "principal" ? "Locataire principal" : "Co-locataire"}
                              </div>
                            </div>
                            <div style={rowStatusTextStyle}>
                              {g.type === "NONE" ? "Aucune garantie" : g.type}
                            </div>
                          </div>

                          <Field label="Type de garantie">
                            <select
                              value={g.type}
                              onChange={(e) =>
                                updateGuaranteeDraft(t.id, { type: e.target.value as GuaranteeDraftType })
                              }
                              style={inputStyle}
                            >
                              <option value="NONE">Aucune</option>
                              <option value="CAUTION">Caution / garant</option>
                              <option value="VISALE">Visale</option>
                            </select>
                          </Field>

                          {g.type === "CAUTION" && (
                            <div style={fieldsGrid2Style}>
                              <Field label="Nom garant *">
                                <input
                                  value={g.guarantorFullName}
                                  onChange={(e) =>
                                    updateGuaranteeDraft(t.id, { guarantorFullName: e.target.value })
                                  }
                                  style={inputStyle}
                                />
                              </Field>
                              <Field label="Email garant *">
                                <input
                                  value={g.guarantorEmail}
                                  onChange={(e) =>
                                    updateGuaranteeDraft(t.id, { guarantorEmail: e.target.value })
                                  }
                                  style={inputStyle}
                                />
                              </Field>
                              <Field label="Téléphone">
                                <input
                                  value={g.guarantorPhone}
                                  onChange={(e) =>
                                    updateGuaranteeDraft(t.id, { guarantorPhone: e.target.value })
                                  }
                                  style={inputStyle}
                                />
                              </Field>
                            </div>
                          )}

                          {g.type === "VISALE" && (
                            <Field label="Référence Visale *">
                              <input
                                value={g.visaleReference}
                                onChange={(e) =>
                                  updateGuaranteeDraft(t.id, { visaleReference: e.target.value })
                                }
                                style={inputStyle}
                              />
                            </Field>
                          )}
                        </div>
                      );
                    })}

                    {createTenantsList.length === 0 && (
                      <div style={emptyStateStyle}>Choisis d’abord un locataire principal.</div>
                    )}
                  </div>
                </StepSection>
              )}
            </div>
          </div>

          {!isCompact && sidebar}
        </div>

        {isCompact ? sidebar : null}

      </div>
    </main>
  );
}

function StepSection({
  refEl,
  title,
  icon,
  children,
  subtle = false,
  accent = false,
}: {
  refEl: React.RefObject<HTMLElement | null>;
  number?: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  subtle?: boolean;
  accent?: boolean;
}) {
  return (
    <section ref={refEl} style={stepShellStyle(subtle, accent)}>
      <div style={stepContentStyle}>
        {icon ? (
          <div style={sectionHeaderStyle}>
            {icon}
            <div style={sectionHeaderTitleStyle}>{title}</div>
          </div>
        ) : null}

        {children}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={fieldWrapStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </label>
  );
}

function RailStep({
  title,
  isActive,
  isDone,
  isLast,
  onClick,
}: {
  title: string;
  isActive: boolean;
  isDone: boolean;
  isLast: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={railStepButtonStyle(isActive)}>
      <span style={railStepVisualWrapStyle}>
        <span style={railStepDotStyle(isActive, isDone)}>
          {isDone ? <Check size={11} /> : <ChevronRight size={11} />}
        </span>
        {!isLast ? <span style={railStepConnectorStyle} /> : null}
      </span>
      <span style={railStepTextStyle(isActive)}>{title}</span>
    </button>
  );
}

function SummaryLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div style={summaryLineStyle}>
      <div style={summaryLabelWrapStyle}>
        <span style={summaryIconStyle}>{icon}</span>
        <span>{label}</span>
      </div>
      <div style={summaryValueStyle}>{value}</div>
    </div>
  );
}

const pageShellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "transparent",
  color: COLORS.text,
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
};

const pageInnerStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const mainLayoutStyle = (isCompact: boolean): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: isCompact ? "1fr" : "minmax(0, 1fr) 320px",
  gap: 14,
  alignItems: "start",
});

const leftColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
};

const rightRailStyle = (isCompact: boolean): React.CSSProperties => ({
  display: "grid",
  gap: 14,
  position: isCompact ? "static" : "sticky",
  top: isCompact ? 0 : 20,
  alignSelf: "start",
  transform: isCompact ? "none" : "translateY(24px)",
  overflow: "visible",
});

const heroStyle: React.CSSProperties = {
  borderRadius: 32,
  padding: 22,
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(210,221,241,0.72)",
  boxShadow:
    "0 18px 40px rgba(20, 37, 63, 0.05), inset 0 1px 0 rgba(255,255,255,0.72)",
  backdropFilter: "blur(12px)",
};


const heroEyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#2C67E5",
  fontWeight: 700,
  marginBottom: 10,
};

const heroTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 64,
  lineHeight: 0.97,
  letterSpacing: "-0.055em",
  fontWeight: 700,
  color: "#24457A",
};

const heroIdentityLineStyle: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const heroIdentityPrimaryStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  color: "#25457A",
};

const heroIdentityDividerStyle: React.CSSProperties = {
  fontSize: 16,
  color: "#9AA6BD",
};

const heroIdentitySecondaryStyle: React.CSSProperties = {
  fontSize: 16,
  color: "#7F8FB0",
  fontWeight: 500,
};

const heroMetricPillStyle: React.CSSProperties = {
  height: 34,
  padding: "0 12px",
  borderRadius: 999,
  border: `1px solid ${COLORS.border}`,
  background: "#FFFFFF",
  display: "inline-flex",
  alignItems: "center",
  fontSize: 12,
  color: COLORS.primaryDark,
  fontWeight: 700,
};

const heroRibbonStyle: React.CSSProperties = {
  marginTop: 14,
  borderRadius: 24,
  padding: "14px 16px",
  background: "rgba(250, 252, 255, 0.96)",
  border: "1px solid rgba(205, 218, 241, 0.82)",
  boxShadow:
    "0 14px 28px rgba(36,69,122,0.05), inset 0 1px 0 rgba(255,255,255,0.88)",
  backdropFilter: "blur(14px)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const heroRibbonLeftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  minHeight: 46,
};

const heroRibbonIconStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const heroRibbonIconPlateStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  background: "linear-gradient(135deg, #EEF4FF 0%, #E9FBFB 100%)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const heroRibbonAmountStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#24457A",
  letterSpacing: "-0.015em",
};

const heroRibbonChevronStyle: React.CSSProperties = {
  fontSize: 22,
  color: "#A5B2C8",
  lineHeight: 1,
  transform: "translateY(-1px)",
};

const heroRibbonDatesStyle: React.CSSProperties = {
  display: "grid",
  gap: 1,
  fontSize: 11,
  fontWeight: 600,
  color: "#7383A4",
  lineHeight: 1.35,
};

const heroRibbonButtonStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 14,
  border: "1px solid rgba(199, 214, 238, 0.9)",
  background: "rgba(255,255,255,0.92)",
  color: "#25457A",
  padding: "0 16px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(36,69,122,0.03)",
};

const railUnifiedCardStyle: React.CSSProperties = {
  borderRadius: 28,
  padding: 16,
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(210,221,241,0.78)",
  boxShadow:
    "0 18px 40px rgba(20,37,63,0.045), inset 0 1px 0 rgba(255,255,255,0.74)",
  backdropFilter: "blur(12px)",
  display: "grid",
  gap: 12,
  overflow: "clip",
  position: "relative",
  isolation: "isolate",
};

const railSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const railDividerStyle: React.CSSProperties = {
  height: 1,
  background: "rgba(31,94,220,0.08)",
};

const railOverlineStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: COLORS.primary,
  fontWeight: 800,
};

const railTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: COLORS.primaryDark,
};

const railCompactStepsStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  marginTop: 2,
};

const railStepVisualWrapStyle: React.CSSProperties = {
  position: "relative",
  width: 24,
  minWidth: 24,
  height: 34,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
};

const railStepConnectorStyle: React.CSSProperties = {
  position: "absolute",
  top: 24,
  bottom: -16,
  left: "50%",
  width: 2,
  transform: "translateX(-50%)",
  background: "linear-gradient(180deg, rgba(209,221,241,0.95) 0%, rgba(231,238,250,0.9) 100%)",
  borderRadius: 999,
};

const railStepButtonStyle = (isActive: boolean): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "24px minmax(0,1fr)",
  gap: 12,
  alignItems: "start",
  padding: "8px 10px",
  borderRadius: 14,
  border: "1px solid transparent",
  background: isActive ? "rgba(238,244,255,0.92)" : "transparent",
  cursor: "pointer",
  textAlign: "left",
  position: "relative",
});

const railStepDotStyle = (isActive: boolean, isDone: boolean): React.CSSProperties => ({
  width: 24,
  height: 24,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 10,
  fontWeight: 700,
  color: isDone ? "#22C6C6" : isActive ? "#2A7BEF" : "#9AABC6",
  background: isDone || isActive ? "#F3F8FF" : "#F7FAFD",
  border: "1px solid rgba(207,219,239,0.8)",
});

const railStepTextStyle = (isActive: boolean): React.CSSProperties => ({
  fontSize: 14,
  color: isActive ? COLORS.primaryDark : COLORS.textSoft,
  fontWeight: isActive ? 700 : 500,
});

const railPrimaryButtonStyle: React.CSSProperties = {
  height: 56,
  width: "100%",
  minWidth: 0,
  borderRadius: 18,
  border: "none",
  outline: "none",
  background: "linear-gradient(135deg, #2567E8 0%, #2FC7C9 100%)",
  color: "#FFFFFF",
  padding: "0 18px",
  display: "block",
  fontSize: 17,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 18px 34px rgba(37,103,232,0.22)",
  appearance: "none",
  WebkitAppearance: "none",
  boxSizing: "border-box",
  position: "relative",
  zIndex: 2,
};

const pageTitleBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 0,
  padding: "8px 6px 0 4px",
};

const heroRibbonShellStyle: React.CSSProperties = {
  borderRadius: 24,
};

const railSideCardStyle: React.CSSProperties = {
  borderRadius: 20,
  padding: 14,
  background: "#FBFCFF",
  border: "1px solid rgba(31,94,220,0.08)",
  display: "grid",
  gap: 12,
  overflow: "hidden",
};

const railSideCardTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: COLORS.primaryDark,
  letterSpacing: "-0.02em",
};

const railBigHomeRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const railHomeIconWrapStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 14,
  background: "linear-gradient(135deg, #EEF4FF 0%, #E9FBFB 100%)",
  color: COLORS.primary,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const railBigHomeTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: COLORS.primaryDark,
};

const railBigHomeMetaStyle: React.CSSProperties = {
  marginTop: 2,
  fontSize: 13,
  color: "#7A88A3",
};

const railFactsListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const railFactRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 14,
  color: COLORS.primaryDark,
  fontWeight: 600,
};

const railFactIconStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#7F89A2",
};

const railQualityCardStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: 14,
  background: "#FBFCFF",
  border: "1px solid rgba(31,94,220,0.08)",
  display: "grid",
  gap: 6,
};

const railQualityTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const railQualityDotStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 999,
  background: "#20C7C7",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 800,
};

const railQualityTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: COLORS.primaryDark,
};

const railQualitySubStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#7A88A3",
  fontWeight: 600,
};

const stepShellStyle = (_subtle: boolean, accent: boolean): React.CSSProperties => ({
  borderRadius: 26,
  overflow: "hidden",
  background: "rgba(255,255,255,0.97)",
  border: accent
    ? "1px solid rgba(208,220,242,0.84)"
    : "1px solid rgba(214,223,240,0.76)",
  boxShadow:
    "0 14px 30px rgba(20,37,63,0.04), inset 0 1px 0 rgba(255,255,255,0.72)",
  backdropFilter: "blur(12px)",
});

const stepContentStyle: React.CSSProperties = {
  padding: 26,
  display: "grid",
  gap: 18,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  marginBottom: 12,
};

const sectionHeaderTitleStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  color: "#24457A",
  letterSpacing: "-0.03em",
  lineHeight: 1.08,
};

const premiumSectionIconWrapStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  transform: "translateY(1px)",
  color: "#2A7BEF",
};

const fieldWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#7283A6",
  fontWeight: 600,
  letterSpacing: "0.015em",
  marginLeft: 2,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  borderRadius: 14,
  border: "1px solid rgba(198, 213, 238, 0.95)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,250,255,0.98) 100%)",
  padding: "0 15px",
  fontSize: 14,
  color: "#243A5F",
  fontWeight: 500,
  outline: "none",
  boxSizing: "border-box",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.92), 0 6px 14px rgba(37,69,122,0.035)",
  appearance: "none",
  WebkitAppearance: "none",
  transition: "border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
};

const fieldsGrid2Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: 14,
};

const fieldsGrid3Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: 16,
};

const fieldsGrid3AdvancedStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const financeGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
};

const inlineAddStyle = (isCompact: boolean): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: isCompact ? "1fr" : "minmax(0, 1fr) auto",
  gap: 12,
  alignItems: "end",
});

const addInlineButtonStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 14,
  border: "1px solid rgba(209,220,240,0.92)",
  background: "rgba(255,255,255,0.96)",
  color: "#25457A",
  padding: "0 16px",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(20,37,63,0.03)",
};

const chipsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const tenantChipRowStyle: React.CSSProperties = {
  borderTop: "1px solid rgba(24,34,52,0.06)",
  paddingTop: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "center",
  flexWrap: "wrap",
};

const tenantChipIdentityStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const tenantAvatarStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 999,
  background: "linear-gradient(135deg, #1F5EDC 0%, #20C7C7 100%)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 10px 18px rgba(31,94,220,0.16)",
};

const chipTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#182133",
};

const chipSubStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#667085",
  marginTop: 4,
};

const emptyStateStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px dashed rgba(24,34,52,0.09)",
  background: "#FCFDFF",
  padding: 12,
  color: "#667085",
  fontSize: 13,
};

const segmentedStyle: React.CSSProperties = {
  minHeight: 46,
  borderRadius: 14,
  background: "linear-gradient(180deg, #F7FAFE 0%, #F2F6FC 100%)",
  border: "1px solid rgba(203,216,239,0.92)",
  padding: 4,
  display: "flex",
  gap: 4,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)",
};

const segmentStyle: React.CSSProperties = {
  flex: 1,
  borderRadius: 10,
  border: "1px solid transparent",
  background: "transparent",
  color: "#7A8AAA",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 140ms ease",
};

const segmentActiveStyle: React.CSSProperties = {
  ...segmentStyle,
  background: "linear-gradient(180deg, #FFFFFF 0%, #FBFDFF 100%)",
  color: "#25457A",
  border: "1px solid rgba(201,215,239,0.95)",
  boxShadow: "0 6px 14px rgba(36,69,122,0.07)",
};

const sectionSeparatorStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#8A93A5",
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  fontWeight: 800,
  padding: "2px 4px 0",
};

const advancedSectionsStackStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const subtleInlinePanelStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: 14,
  background: "linear-gradient(180deg, #FCFDFF 0%, #F9FBFE 100%)",
  border: "1px solid rgba(214,223,240,0.82)",
  display: "grid",
  gap: 12,
};

const subtleInlineHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const subtleInlineTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#182133",
};

const checkboxRowStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  minHeight: 42,
  color: "#344054",
  fontSize: 14,
};

const checkRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#344054",
  fontSize: 14,
};

const guaranteesStackStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const guaranteeRowStyle = (isFirst: boolean): React.CSSProperties => ({
  borderTop: isFirst ? "none" : "1px solid rgba(24,34,52,0.05)",
  paddingTop: isFirst ? 0 : 12,
  display: "grid",
  gap: 12,
});

const guaranteeRowHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const rowStatusTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#667085",
  fontWeight: 650,
};

const summaryLineStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "86px minmax(0, 1fr)",
  gap: 10,
  alignItems: "start",
};

const summaryLabelWrapStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  color: "#667085",
  fontSize: 12,
  fontWeight: 650,
};

const summaryIconStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#7F89A2",
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: "#182133",
  fontWeight: 600,
};

const softButtonStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 12,
  border: "1px solid rgba(209,220,240,0.92)",
  background: "rgba(255,255,255,0.94)",
  color: "#25457A",
  padding: "0 13px",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(20,37,63,0.03)",
};

const dangerTextButtonStyle: React.CSSProperties = {
  height: 34,
  borderRadius: 10,
  border: "1px solid rgba(190,24,93,0.10)",
  background: "#FFF6F8",
  color: "#A12C52",
  padding: "0 10px",
  display: "inline-flex",
  alignItems: "center",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const successAlertStyle: React.CSSProperties = {
  borderRadius: 14,
  padding: "13px 15px",
  background: "#F1FEFE",
  color: "#0F8B8D",
  border: "1px solid rgba(32,199,199,0.16)",
  fontWeight: 700,
};

const errorAlertStyle: React.CSSProperties = {
  borderRadius: 14,
  padding: "13px 15px",
  background: "#FFF3F6",
  color: "#A12C52",
  border: "1px solid rgba(161,44,82,0.10)",
  fontWeight: 700,
};