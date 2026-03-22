import { extractLeaseBundle } from "../../../_lib/extractLease";

export const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

export type Tenant = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
};

export type IrlIndexation = {
  enabled?: boolean;
  referenceQuarter?: string | null;
  referenceValue?: number | string | null;
};

export type LeaseTerms = {
  irlIndexation?: IrlIndexation | null;
  irl_indexation?: IrlIndexation | null;
};

export type Lease = {
  id: string;
  unit_id: string;
  tenant_id: string;
  start_date: string;
  end_date_theoretical: string;
  rent_cents: number;
  charges_cents: number;
  deposit_cents: number;
  payment_day: number;
  status: "draft" | "active" | "notice" | "ended" | string;
  created_at?: string;
  unit_code?: string;
  tenant_name?: string;
  kind?: string;
  irl_revision_date?: string | null;
  next_revision_date?: string | null;
  irl_reference_value?: string | number | null;
  irl_reference_quarter?: string | null;
  lease_terms?: LeaseTerms | null;
  leaseTerms?: LeaseTerms | null;
  irlReferenceValue?: string | number | null;
  irlReferenceQuarter?: string | null;
  keys_count?: number | null;
  keysCount?: number | null;
  lease_designation?: unknown;
  leaseDesignation?: unknown;
  lease_designation_json?: unknown;
  lease_designation_data?: unknown;
  [key: string]: any;
};

export type LeaseDetails = {
  lease: Lease;
  tenants: Array<any>;
  amounts: Array<any>;
};

export type LeaseDesignation = {
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

export type LeaseEditIrlState = {
  enabled: boolean;
  quarter: string;
  value: string;
};

export function kindLabel(k?: string) {
  const v = String(k || "MEUBLE_RP").toUpperCase();
  if (v === "MEUBLE_RP") return "Meublé (RP)";
  if (v === "NU_RP") return "Nu (RP)";
  if (v === "SAISONNIER") return "Saisonnier";
  return v;
}

export function coerceLeaseDesignation(lease: any): LeaseDesignation {
  const raw =
    lease?.lease_designation ??
    lease?.leaseDesignation ??
    lease?.lease_designation_json ??
    lease?.lease_designation_data ??
    null;

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  if (raw && typeof raw === "object") {
    return raw as LeaseDesignation;
  }

  return {};
}

export function toggleArrayValueIn(
  current: LeaseDesignation,
  key: "dependances" | "equipementsCommuns",
  value: string
): LeaseDesignation {
  const set = new Set(current[key] || []);
  if (set.has(value)) set.delete(value);
  else set.add(value);

  return {
    ...current,
    [key]: Array.from(set),
  };
}

export function hydrateLeaseIrl(leaseObj: any): LeaseEditIrlState {
  const terms = leaseObj?.lease_terms ?? leaseObj?.leaseTerms ?? leaseObj?.terms ?? {};
  const irl = terms?.irlIndexation ?? terms?.irl_indexation ?? {};

  const quarter =
    irl?.referenceQuarter ??
    leaseObj?.irl_reference_quarter ??
    leaseObj?.irlReferenceQuarter ??
    "";

  const rawValue =
    irl?.referenceValue ??
    leaseObj?.irl_reference_value ??
    leaseObj?.irlReferenceValue ??
    "";

  return {
    enabled: irl?.enabled === true,
    quarter: quarter ? String(quarter) : "",
    value: rawValue === null || rawValue === undefined ? "" : String(rawValue),
  };
}

export function hydrateLeaseDesignationState(leaseObj: any) {
  return {
    designation: coerceLeaseDesignation(leaseObj),
    keysCount: leaseObj?.keys_count ?? leaseObj?.keysCount ?? 2,
  };
}

export async function loadLeaseBundle(id: string, token: string): Promise<LeaseDetails> {
  const r = await fetch(`${API}/leases/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });

  const bundle = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw new Error(bundle?.message || JSON.stringify(bundle));
  }

  const { lease, tenants, amounts } = extractLeaseBundle(bundle);

  if (!lease?.id) {
    throw new Error("Lease bundle invalid");
  }

  return {
    lease,
    tenants,
    amounts,
  };
}