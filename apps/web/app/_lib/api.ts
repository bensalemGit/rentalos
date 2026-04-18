// app/_lib/api.ts
import type { CanonicalSignatureWorkflow } from "./canonical-signature.types";
import type { CreateCanonicalPublicLinkInput } from "./canonical-public-links.types";
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") || "/api";

// petit helper
function joinUrl(base: string, p: string) {
  const path = p.startsWith("/") ? p : `/${p}`;
  return `${base}${path}`;
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const url = joinUrl(API_BASE, path);

  const headers = new Headers(init.headers);

  // ✅ Token (client only)
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token") || localStorage.getItem("jwt") || "";
    if (token) {
      headers.set("Authorization", token.startsWith("Bearer ") ? token : `Bearer ${token}`);
    }
  }

  // JSON par défaut si body est un objet/string JSON
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const resp = await fetch(url, {
    ...init,
    headers,
    // si un jour tu passes en cookie httpOnly, ça aidera aussi
    credentials: "include",
    cache: "no-store",
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    // on renvoie un message lisible (utile pour ton UI)
    throw new Error(`API ${resp.status}: ${txt || resp.statusText}`);
  }

  // si 204
  if (resp.status === 204) return null as any;

  // tente JSON sinon texte
  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await resp.json()) as T;
  }
  return (await resp.text()) as any;
}


export async function apiFetchBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const url = joinUrl(API_BASE, path);

  const headers = new Headers(init.headers);

  // ✅ Token (client only)
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token") || localStorage.getItem("jwt") || "";
    if (token) {
      headers.set("Authorization", token.startsWith("Bearer ") ? token : `Bearer ${token}`);
    }
  }

  const resp = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`API ${resp.status}: ${txt || resp.statusText}`);
  }

  return await resp.blob();
}

export async function fetchSignatureWorkflow(
  leaseId: string,
): Promise<CanonicalSignatureWorkflow> {
  return apiFetch<CanonicalSignatureWorkflow>(
    `/signature-workflow?leaseId=${encodeURIComponent(leaseId)}`,
  );
}

export async function createCanonicalPublicLink(
  input: CreateCanonicalPublicLinkInput,
) {
  return apiFetch("/canonical-public-links", {
    method: "POST",
    body: JSON.stringify(input),
  });
}