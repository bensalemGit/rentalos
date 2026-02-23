export type LeaseBundle = any;

export function extractLeaseBundle(bundle: LeaseBundle): {
  lease: any | null;
  tenants: any[];
  amounts: any[];
} {
  if (!bundle) return { lease: null, tenants: [], amounts: [] };

  // support { data: ... }
  if (bundle.data) bundle = bundle.data;

  // support { lease, tenants, amounts }
  if (bundle.lease) {
    return {
      lease: bundle.lease ?? null,
      tenants: Array.isArray(bundle.tenants) ? bundle.tenants : [],
      amounts: Array.isArray(bundle.amounts) ? bundle.amounts : [],
    };
  }

  // support direct lease object
  if (bundle.id) return { lease: bundle, tenants: [], amounts: [] };

  // support array [lease]
  if (Array.isArray(bundle)) return { lease: bundle[0] ?? null, tenants: [], amounts: [] };

  return { lease: null, tenants: [], amounts: [] };
}