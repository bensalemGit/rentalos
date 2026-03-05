"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type Lease = {
  id: string;
  unit_code?: string;
  unit_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  created_at?: string;
  tenant_names?: string;
};

function fmtDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString("fr-FR");
}

function Badge({ tone, children }: { tone: "success" | "warning" | "danger" | "neutral"; children: any }) {
  const map: Record<string, { bg: string; fg: string; bd: string }> = {
    success: { bg: "rgba(22,163,74,0.12)", fg: "var(--success)", bd: "rgba(22,163,74,0.25)" },
    warning: { bg: "rgba(245,158,11,0.14)", fg: "var(--warning)", bd: "rgba(245,158,11,0.25)" },
    danger: { bg: "rgba(239,68,68,0.12)", fg: "var(--danger)", bd: "rgba(239,68,68,0.25)" },
    neutral: { bg: "rgba(100,116,139,0.10)", fg: "var(--muted)", bd: "rgba(100,116,139,0.22)" },
  };
  const s = map[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${s.bd}`,
        background: s.bg,
        color: s.fg,
        fontWeight: 800,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 16,
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 14 }}>{title}</div>
          {subtitle ? <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{subtitle}</div> : null}
        </div>
        {right}
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "success" | "warning" | "danger" | "neutral" }) {
  return (
    <Card
      title={label}
      subtitle={hint}
      right={tone ? <Badge tone={tone}>{tone === "success" ? "OK" : tone === "warning" ? "À surveiller" : tone === "danger" ? "Action" : "Info"}</Badge> : undefined}
    >
      <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: -0.5 }}>{value}</div>
    </Card>
  );
}

export default function DashboardPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [unitsCount, setUnitsCount] = useState(0);
  const [tenantsCount, setTenantsCount] = useState(0);
  const [leases, setLeases] = useState<Lease[]>([]);

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const headers: any = { Authorization: `Bearer ${token}` };
      const [u, t, l] = await Promise.all([
        fetch(`${API}/units`, { headers, credentials: "include" }).then((r) => r.json()),
        fetch(`${API}/tenants`, { headers, credentials: "include" }).then((r) => r.json()),
        fetch(`${API}/leases`, { headers, credentials: "include" }).then((r) => r.json()),
      ]);

      setUnitsCount(Array.isArray(u) ? u.length : u?.id ? 1 : 0);
      setTenantsCount(Array.isArray(t) ? t.length : 0);
      setLeases(Array.isArray(l) ? l : []);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const leasesSorted = useMemo(() => {
    return [...leases].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }, [leases]);

  const activeLeases = useMemo(() => leasesSorted.filter((x) => x.status !== "ended"), [leasesSorted]);
  const endedLeases = useMemo(() => leasesSorted.filter((x) => x.status === "ended"), [leasesSorted]);

  const now = new Date();
  const ym = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 16,
          boxShadow: "var(--shadow)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 950 }}>Dashboard</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Vue d’ensemble — indicateurs clés • {ym}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {loading ? <Badge tone="neutral">Chargement…</Badge> : <Badge tone="success">Système OK</Badge>}
          <button
            onClick={load}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "white",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.22)",
            borderRadius: "var(--radius)",
            padding: 14,
            color: "var(--danger)",
            fontWeight: 800,
          }}
        >
          Erreur: {error}
        </div>
      ) : null}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <Kpi label="Baux actifs" value={String(activeLeases.length)} hint={`Total: ${leases.length}`} tone={activeLeases.length > 0 ? "success" : "neutral"} />
        <Kpi label="Logements" value={String(unitsCount)} hint="Unités enregistrées" tone="neutral" />
        <Kpi label="Locataires" value={String(tenantsCount)} hint="Contacts locataires" tone="neutral" />
        <Kpi label="Quittances" value="—" hint={`Mois ${ym} (v1)`} tone="warning" />
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 16, alignItems: "start" }}>
        {/* Left: Leases table */}
        <Card
          title="Baux récents"
          subtitle="Accès rapide aux dossiers"
          right={
            <Link
              href="/dashboard/leases"
              style={{
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "white",
                fontWeight: 900,
                color: "var(--primary)",
              }}
            >
              Voir tous
            </Link>
          }
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, color: "var(--muted)" }}>
                  <th style={{ padding: "10px 8px" }}>Logement</th>
                  <th style={{ padding: "10px 8px" }}>Début</th>
                  <th style={{ padding: "10px 8px" }}>Fin</th>
                  <th style={{ padding: "10px 8px" }}>Statut</th>
                  <th style={{ padding: "10px 8px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leasesSorted.slice(0, 8).map((l) => {
                  const tone = l.status === "ended" ? "neutral" : "success";
                  return (
                    <tr key={l.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 8px", fontWeight: 900 }}>
                        {l.unit_code || l.unit_id || l.id.slice(0, 8)}
                      </td>
                      <td style={{ padding: "10px 8px" }}>{fmtDate(l.start_date)}</td>
                      <td style={{ padding: "10px 8px" }}>{fmtDate(l.end_date)}</td>
                      <td style={{ padding: "10px 8px" }}>
                        <Badge tone={tone as any}>{l.status || "—"}</Badge>
                      </td>
                      <td style={{ padding: "10px 8px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Link
                          href={`/edl/${l.id}`}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "white",
                            fontWeight: 900,
                          }}
                        >
                          EDL
                        </Link>
                        <Link
                          href={`/inventory/${l.id}`}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "white",
                            fontWeight: 900,
                          }}
                        >
                          Inventaire
                        </Link>
                        <Link
                          href={`/sign/${l.id}`}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "rgba(37,99,235,0.10)",
                            color: "var(--primary)",
                            fontWeight: 950,
                          }}
                        >
                          Signatures
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {leasesSorted.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 12, color: "var(--muted)" }}>
                      Aucun bail.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 12 }}>
            Astuce : utilise “Signatures” pour générer / signer Contrat + Pack EDL/Inventaire.
          </div>
        </Card>

        {/* Right: Quick actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Card title="Actions rapides" subtitle="Les liens les plus utiles">
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              <Link
                href="/dashboard/leases"
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "white",
                  fontWeight: 950,
                }}
              >
                Gérer les baux
              </Link>
              <Link
                href="/dashboard/units"
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "white",
                  fontWeight: 950,
                }}
              >
                Gérer les logements
              </Link>
              <Link
                href="/dashboard/tenants"
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "white",
                  fontWeight: 950,
                }}
              >
                Gérer les locataires
              </Link>
            </div>
          </Card>

          <Card title="À venir (v1+)" subtitle="On branchera ça via un endpoint agrégé">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ color: "var(--muted)" }}>Loyers en retard</div>
                <Badge tone="warning">Soon</Badge>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ color: "var(--muted)" }}>Revenus du mois</div>
                <Badge tone="warning">Soon</Badge>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ color: "var(--muted)" }}>Entrées/sorties à 30 jours</div>
                <Badge tone="warning">Soon</Badge>
              </div>
            </div>
          </Card>

          <Card title="Historique" subtitle="Rapide aperçu">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Badge tone="success">{activeLeases.length} actifs</Badge>
              <Badge tone="neutral">{endedLeases.length} clôturés</Badge>
              <Badge tone="neutral">{leases.length} total</Badge>
            </div>
          </Card>
        </div>
      </div>

      {/* Responsive hint */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 1100px){
              ._dash_grid{grid-template-columns:1fr!important}
            }
          `,
        }}
      />
    </div>
  );
}