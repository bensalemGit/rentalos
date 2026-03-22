"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type ImportResult =
  | {
      ok: true;
      leaseId: string;
      unitId?: string;
      template?: { code: string; duplex: boolean; variants: string[] };
      mode?: "block_if_data" | "merge";
      edlSessionId?: string;
      inventorySessionId?: string;
      counts?: { edlItems: number; inventoryItems: number };

      // compat ancien format si jamais
      typology?: string;
      furnished?: boolean;
      duplex?: boolean;
      variants?: string[];
      edl?: { sessionId: string; itemsCount: number };
      inventory?: { sessionId: string; itemsCount: number };
    }
  | { ok?: false; message?: string; [k: string]: any };

const TYPOLOGIES = ["STUDIO", "T1", "T2", "T3", "T4", "T5", "T6"];

const VARIANTS = [
  "BALCON",
  "TERRASSE",
  "JARDIN",
  "PARKING",
  "GARAGE",
  "CAVE",
  "BUANDERIE",
  "CUISINE_EQUIPEE",
];

export default function ImportHousingPage({ params }: { params: { leaseId: string } }) {
  const leaseId = params.leaseId;

  const [token, setToken] = useState("");
  const [typology, setTypology] = useState("T2");
  const [furnished, setFurnished] = useState(true);
  const [duplex, setDuplex] = useState(false);
  const [variants, setVariants] = useState<string[]>([]);
  const [mode, setMode] = useState<"block_if_data" | "merge">("block_if_data");

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const border = "rgba(27,39,64,0.08)";
  const muted = "#667085";
  const blue = "#2F63E0";
  const green = "#2FA36B";
  const amber = "#C58A2B";

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  const isAuthed = useMemo(() => !!token, [token]);

  const templatePreview = useMemo(() => {
    const duplexLabel = duplex ? "Duplex" : "Non-duplex";
    const vars = variants.length ? variants.join(", ") : "Aucune";
    return `Template: ${typology} (${duplexLabel}) • Variants: ${vars}`;
  }, [typology, duplex, variants]);

  function toggleVariant(v: string) {
    setVariants((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  async function doImport() {
    setError("");
    setResult(null);
    setStatus("Import en cours…");

    try {
      const r = await fetch(`${API}/import/housing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          leaseId,
          typology,
          furnished,
          duplex,
          variants,
          mode,
        }),
      });

      const j = (await r.json().catch(() => ({}))) as any;

      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        setResult(j);
        return;
      }

      setResult({ ok: true, ...j });
      setStatus("Import terminé ✅");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  const resolvedTemplateText = useMemo(() => {
    if (!result || !("ok" in result) || !result.ok) return null;

    // nouveau format (ImportService DB-driven)
    if (result.template) {
      const duplexLabel = result.template.duplex ? "Duplex" : "Non-duplex";
      const vars = (result.template.variants || []).length ? result.template.variants.join(", ") : "Aucune";
      return `Template: ${String(result.template.code || "").toUpperCase()} (${duplexLabel}) • Variants: ${vars}`;
    }

    // ancien format
    const duplexLabel = (result as any).duplex ? "Duplex" : "Non-duplex";
    const vars = ((result as any).variants || []).length ? (result as any).variants.join(", ") : "Aucune";
    const t = (result as any).typology || typology;
    return `Template: ${String(t).toUpperCase()} (${duplexLabel}) • Variants: ${vars}`;
  }, [result, typology]);

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 24px 48px", minHeight: "100vh", background: "#F6F8FC", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.05, letterSpacing: "-0.03em", color: "#1F2A3C" }}>Importer modèle logement</h1>
          <div style={{ color: muted, marginTop: 6 }}>
            Bail <b>{leaseId.slice(0, 8)}…</b> • Génère <b>EDL</b> + <b>Inventaire</b> depuis templates DB (base + variantes)
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Link href={`/edl/${leaseId}`}>
            <button style={btnSecondary(border)}>Ouvrir EDL</button>
          </Link>
          <Link href={`/inventory/${leaseId}`}>
            <button style={btnSecondary(border)}>Ouvrir Inventaire</button>
          </Link>
          <Link href="/dashboard/leases">
            <button style={btnSecondary(border)}>Retour baux</button>
          </Link>
        </div>
      </div>

      {!isAuthed && (
        <div style={{ marginTop: 12, border: `1px solid ${border}`, borderRadius: 16, background: "#fff", padding: 12 }}>
          <div style={{ fontWeight: 900, color: "crimson" }}>Non connecté</div>
          <div style={{ color: muted, marginTop: 6 }}>
            Le token n’est pas trouvé dans localStorage. Connecte-toi via l’app puis reviens ici.
          </div>
        </div>
      )}

      <section style={{ marginTop: 18, border: `1px solid ${border}`, borderRadius: 24, background: "#fff", padding: 24, boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Paramètres import</div>

        {/* Preview clair demandé */}
        <div
          style={{
            border: `1px solid ${border}`,
            borderRadius: 16,
            padding: 14,
            background: "#FAFBFC",
            fontWeight: 800,
            color: "#111827",
            marginBottom: 12,
          }}
        >
          {templatePreview}
        </div>

        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <label style={labelStyle(muted)}>
            Typologie
            <select value={typology} onChange={(e) => setTypology(e.target.value)} style={inputStyle(border)}>
              {TYPOLOGIES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle(muted)}>
            Mode sécurité
            <select value={mode} onChange={(e) => setMode(e.target.value as any)} style={inputStyle(border)}>
              <option value="block_if_data">block_if_data (recommandé)</option>
              <option value="merge">merge (ajout sans écraser — nécessite uniques OK)</option>
            </select>
          </label>

          <label style={{ ...labelStyle(muted), display: "flex", gap: 10, alignItems: "center" as const }}>
            <input type="checkbox" checked={furnished} onChange={(e) => setFurnished(e.target.checked)} />
            Meublé (info seulement)
          </label>

          <label style={{ ...labelStyle(muted), display: "flex", gap: 10, alignItems: "center" as const }}>
            <input type="checkbox" checked={duplex} onChange={(e) => setDuplex(e.target.checked)} />
            Duplex
          </label>
        </div>

        {/* Warning merge demandé */}
        {mode === "merge" && (
          <div
            style={{
              marginTop: 12,
              border: `1px solid rgba(245,158,11,0.35)`,
              background: "rgba(245,158,11,0.08)",
              padding: 10,
              borderRadius: 12,
              color: "#7c2d12",
              fontWeight: 800,
            }}
          >
            ⚠️ Mode <b>merge</b> = ajout sans écraser. Requiert des contraintes uniques en DB pour ignorer proprement les doublons.
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Variantes</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {VARIANTS.map((v) => {
              const on = variants.includes(v);
              return (
                <button
                  key={v}
                  onClick={() => toggleVariant(v)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: `1px solid ${on ? "rgba(47,99,224,0.16)" : border}`,
                    background: on ? "#EEF4FF" : "#fff",
                    color: on ? "#2F63E0" : "#243247",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {on ? "✓ " : ""}{v}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button disabled={!isAuthed} onClick={doImport} style={btnPrimary(blue, !isAuthed)}>
            Lancer l’import
          </button>
          <div style={{ color: muted, fontSize: 12 }}>
            {mode === "block_if_data" ? (
              <>✅ En <b>block_if_data</b>, l’import refuse si des sessions EDL/Inventaire existent déjà.</>
            ) : (
              <>🟧 En <b>merge</b>, on ajoute sans écraser (si uniques OK).</>
            )}
          </div>
        </div>

        {status && <p style={{ marginTop: 10, color: green }}>{status}</p>}
        {error && <p style={{ marginTop: 10, color: "crimson", whiteSpace: "pre-wrap" }}>{error}</p>}
      </section>

      {result && (
        <section style={{ marginTop: 18, border: `1px solid ${border}`, borderRadius: 24, background: "#fff", padding: 24, boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Résultat</div>

          {"ok" in result && result.ok ? (
            <div style={{ display: "grid", gap: 8 }}>
              {resolvedTemplateText && (
                <div style={{ color: "#111827", fontWeight: 900 }}>
                  {resolvedTemplateText}
                </div>
              )}

              {/* Nouveau format */}
              {result.counts ? (
                <>
                  <div>
                    ✅ EDL: <b>{result.counts.edlItems}</b> items • session <code>{result.edlSessionId}</code>
                  </div>
                  <div>
                    ✅ Inventaire: <b>{result.counts.inventoryItems}</b> lignes • session <code>{result.inventorySessionId}</code>
                  </div>
                </>
              ) : (
                /* Ancien format */
                <>
                  <div>✅ EDL: <b>{(result as any).edl?.itemsCount}</b> items • session <code>{(result as any).edl?.sessionId}</code></div>
                  <div>✅ Inventaire: <b>{(result as any).inventory?.itemsCount}</b> lignes • session <code>{(result as any).inventory?.sessionId}</code></div>
                </>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                <Link href={`/edl/${leaseId}`}>
                  <button style={btnSecondary(border)}>Voir EDL</button>
                </Link>
                <Link href={`/inventory/${leaseId}`}>
                  <button style={btnSecondary(border)}>Voir Inventaire</button>
                </Link>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: muted }}>
                💡 Prochaine étape terrain : ajout/suppression d’items directement dans la session (sans modifier le template DB).
              </div>
            </div>
          ) : (
            <pre style={{ margin: 0, fontSize: 12, color: muted, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </section>
      )}
    </main>
  );
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
function btnPrimary(blue: string, disabled: boolean) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid rgba(47,99,224,0.18)`,
    background: disabled ? "rgba(27,39,64,0.04)" : "linear-gradient(180deg, #2F63E0 0%, #2A5BD7 100%)",
    color: disabled ? "#98A2B3" : "#fff",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 2px 6px rgba(47,99,224,0.18)",
  } as const;
}
function btnSecondary(border: string) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 800,
    color: "#243247",
    boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
  } as const;
}
