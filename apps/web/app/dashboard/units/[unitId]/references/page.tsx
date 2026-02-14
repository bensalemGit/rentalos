"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

export default function UnitReferencesPage({
  params,
}: {
  params: { unitId: string };
}) {
  const unitId = params.unitId;

  const [token, setToken] = useState("");
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const border = "#e5e7eb";
  const muted = "#6b7280";
  const green = "#16a34a";
  const bg = "#f7f8fb";

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  const load = useCallback(async () => {
    setError("");
    setStatus("Chargement…");

    if (!token) {
      setStatus("");
      setError("Non authentifié (token manquant).");
      setData(null);
      return;
    }

    const ctrl = new AbortController();

    try {
      const url = `${API}/unit-references/preview?unitId=${encodeURIComponent(
        unitId
      )}`;

      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        cache: "no-store",
        signal: ctrl.signal,
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        setStatus("");
        setError(j?.message || JSON.stringify(j));
        setData(null);
        return;
      }

      setData(j);
      setStatus("");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setStatus("");
      setError(String(e?.message || e));
      setData(null);
    }

    return () => ctrl.abort();
  }, [token, unitId]);

  useEffect(() => {
    if (!token) return;
    load();
  }, [token, load]);

  // ---- shape API réelle ----
  const reference = data?.reference || {};
  const edlSessionId = reference?.referenceEdlSessionId || null;
  const invSessionId = reference?.referenceInventorySessionId || null;

  const edlItems: any[] = Array.isArray(data?.edl?.items) ? data.edl.items : [];
  const invLines: any[] = Array.isArray(data?.inventory?.lines)
    ? data.inventory.lines
    : [];

  const edlSectionsCount = useMemo(() => {
    const s = new Set<string>();
    for (const it of edlItems) s.add(String(it.section || "Divers"));
    return s.size;
  }, [edlItems]);

  const invCategoriesCount = useMemo(() => {
    const s = new Set<string>();
    for (const ln of invLines) s.add(String(ln.category || "Divers"));
    return s.size;
  }, [invLines]);

  const edlPreview = useMemo(() => edlItems.slice(0, 12), [edlItems]);
  const invPreview = useMemo(() => invLines.slice(0, 12), [invLines]);

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: 12,
        background: bg,
        minHeight: "100vh",
      }}
    >
      <div style={card(border)}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 22, letterSpacing: -0.2 }}>
              Références logement
            </h1>
            <div style={{ color: muted, fontSize: 12 }}>
              Unit {unitId.slice(0, 8)}… • aperçu + contrôle avant initialisation
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={load} style={btnSecondary(border)}>
              Rafraîchir
            </button>
            <Link href="/dashboard/units">
              <button style={btnSecondary(border)}>Retour logements</button>
            </Link>
          </div>
        </div>

        {status && (
          <div style={{ marginTop: 10, color: green, fontWeight: 900 }}>
            {status}
          </div>
        )}
        {error && (
          <div style={{ marginTop: 10, color: "crimson", fontWeight: 900 }}>
            {error}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gap: 12,
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        {/* EDL */}
        <section style={card(border)}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 950 }}>EDL — Référence</div>
            <span style={pill(border)}>
              {edlSessionId
                ? `Session ${String(edlSessionId).slice(0, 8)}…`
                : "Aucune"}
            </span>
          </div>

          <div
            style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}
          >
            <span style={miniStat(border)}>{edlSectionsCount} sections</span>
            <span style={miniStat(border)}>{edlItems.length} items</span>
          </div>

          <div
            style={{
              marginTop: 12,
              borderTop: `1px solid ${border}`,
              paddingTop: 12,
            }}
          >
            <div
              style={{
                fontWeight: 900,
                fontSize: 12,
                color: muted,
                marginBottom: 8,
              }}
            >
              Preview (12)
            </div>

            {edlPreview.map((x: any, idx: number) => (
              <div key={idx} style={row(border)}>
                <div style={{ fontWeight: 900, minWidth: 0 }}>
                  <div
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {x.label || "—"}
                  </div>
                  <div style={{ color: muted, fontSize: 11 }}>
                    {x.section || "Divers"}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  <span style={tag(border)}>
                    Entrée: {x.entry_condition || "—"}
                  </span>
                  <span style={tag(border)}>
                    Sortie: {x.exit_condition || "—"}
                  </span>
                </div>
              </div>
            ))}

            {!edlSessionId && (
              <div style={{ color: muted, fontSize: 12 }}>
                Aucune référence EDL définie.
              </div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <button
              style={{ ...btnSecondary(border), width: "100%" }}
              disabled
              title="On fait l’écran d’édition juste après"
            >
              Éditer la référence EDL (à venir)
            </button>
          </div>
        </section>

        {/* INVENTAIRE */}
        <section style={card(border)}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 950 }}>Inventaire — Référence</div>
            <span style={pill(border)}>
              {invSessionId
                ? `Session ${String(invSessionId).slice(0, 8)}…`
                : "Aucune"}
            </span>
          </div>

          <div
            style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}
          >
            <span style={miniStat(border)}>{invCategoriesCount} catégories</span>
            <span style={miniStat(border)}>{invLines.length} lignes</span>
          </div>

          <div
            style={{
              marginTop: 12,
              borderTop: `1px solid ${border}`,
              paddingTop: 12,
            }}
          >
            <div
              style={{
                fontWeight: 900,
                fontSize: 12,
                color: muted,
                marginBottom: 8,
              }}
            >
              Preview (12)
            </div>

            {invPreview.map((x: any, idx: number) => (
              <div key={idx} style={row(border)}>
                <div style={{ fontWeight: 900, minWidth: 0 }}>
                  <div
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {x.label || x.name || "—"}
                  </div>
                  <div style={{ color: muted, fontSize: 11 }}>
                    {x.category || "Divers"}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  <span style={tag(border)}>
                    Entrée: {x.entry_state || "—"} • {x.entry_qty ?? "—"}
                  </span>
                  <span style={tag(border)}>
                    Sortie: {x.exit_state || "—"} • {x.exit_qty ?? "—"}
                  </span>
                </div>
              </div>
            ))}

            {!invSessionId && (
              <div style={{ color: muted, fontSize: 12 }}>
                Aucune référence Inventaire définie.
              </div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <button
              style={{ ...btnSecondary(border), width: "100%" }}
              disabled
              title="On fait l’écran d’édition juste après"
            >
              Éditer la référence Inventaire (à venir)
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ---- UI helpers ---- */
function card(border: string) {
  return {
    border: `1px solid ${border}`,
    borderRadius: 18,
    background: "#fff",
    padding: 14,
    boxShadow: "0 8px 24px rgba(16,24,40,0.06)",
  } as const;
}
function btnSecondary(border: string) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 1px 0 rgba(16,24,40,0.04)",
  } as const;
}
function pill(border: string) {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    fontSize: 12,
    fontWeight: 900,
    background: "#fbfbfd",
  } as const;
}
function miniStat(border: string) {
  return {
    padding: "6px 10px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    fontSize: 12,
    fontWeight: 900,
    background: "#fbfbfd",
  } as const;
}
function row(border: string) {
  return {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    border: `1px solid ${border}`,
    borderRadius: 14,
    padding: 10,
    background: "#fbfbfd",
    marginBottom: 8,
  } as const;
}
function tag(border: string) {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    fontSize: 12,
    fontWeight: 900,
    background: "#fff",
  } as const;
}
