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

function Badge({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  children: React.ReactNode;
}) {
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
  compact = false,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: compact ? 14 : 16,
        boxShadow: "var(--shadow)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: compact ? 16 : 14, lineHeight: 1.15 }}>
            {title}
          </div>
          {subtitle ? (
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4, lineHeight: 1.3 }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {right}
      </div>

      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
  compact = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "warning" | "danger" | "neutral";
  compact?: boolean;
}) {
  return (
    <Card
      compact={compact}
      title={label}
      subtitle={hint}
      right={
        !compact && tone ? (
          <Badge tone={tone}>
            {tone === "success" ? "OK" : tone === "warning" ? "À surveiller" : tone === "danger" ? "Action" : "Info"}
          </Badge>
        ) : undefined
      }
    >
      <div
        style={{
          fontSize: compact ? 34 : 28,
          fontWeight: 950,
          letterSpacing: -0.5,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [unitsCount, setUnitsCount] = useState(0);
  const [tenantsCount, setTenantsCount] = useState(0);
  const [leases, setLeases] = useState<Lease[]>([]);

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();

    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
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
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 12 : 16, minWidth: 0 }}>
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: isMobile ? 14 : 16,
          boxShadow: "var(--shadow)",
          display: "flex",
          alignItems: isMobile ? "stretch" : "center",
          justifyContent: "space-between",
          gap: 12,
          flexDirection: isMobile ? "column" : "row",
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 22 : 18, fontWeight: 950 }}>Dashboard</div>
          <div style={{ color: "var(--muted)", fontSize: isMobile ? 14 : 13, marginTop: 4, lineHeight: 1.35 }}>
            Vue d’ensemble — indicateurs clés • {ym}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {loading ? <Badge tone="neutral">Chargement…</Badge> : <Badge tone="success">Système OK</Badge>}

          <button
            onClick={load}
            style={{
              minHeight: 44,
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "white",
              cursor: "pointer",
              fontWeight: 900,
              color: "var(--primary)",
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))",
          gap: isMobile ? 10 : 12,
          minWidth: 0,
        }}
      >
        <Kpi compact={isMobile} label="Baux actifs" value={String(activeLeases.length)} hint={`Total: ${leases.length}`} tone={activeLeases.length > 0 ? "success" : "neutral"} />
        <Kpi compact={isMobile} label="Logements" value={String(unitsCount)} hint="Unités enregistrées" tone="neutral" />
        <Kpi compact={isMobile} label="Locataires" value={String(tenantsCount)} hint="Contacts locataires" tone="neutral" />
        <Kpi compact={isMobile} label="Quittances" value="—" hint={`Mois ${ym}`} tone="warning" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 420px",
          gap: isMobile ? 12 : 16,
          alignItems: "start",
          minWidth: 0,
        }}
      >
        <Card
          compact={isMobile}
          title="Baux récents"
          subtitle="Accès rapide aux dossiers"
          right={
            <Link
              href="/dashboard/leases"
              style={{
                minHeight: 40,
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "white",
                fontWeight: 900,
                color: "var(--primary)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Voir tous
            </Link>
          }
        >
          {isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {leasesSorted.slice(0, 6).map((l) => {
                const tone = l.status === "ended" ? "neutral" : "success";

                return (
                  <div
                    key={l.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 12,
                      background: "white",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ fontWeight: 950, fontSize: 18, lineHeight: 1.1 }}>
                        {l.unit_code || l.unit_id || l.id.slice(0, 8)}
                      </div>
                      <Badge tone={tone as any}>{l.status || "—"}</Badge>
                    </div>

                    <div style={{ color: "var(--muted)", fontSize: 13 }}>
                      Début : <b style={{ color: "var(--text)" }}>{fmtDate(l.start_date)}</b>
                      {" · "}
                      Fin : <b style={{ color: "var(--text)" }}>{fmtDate(l.end_date)}</b>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                      <Link
                        href={`/sign/${l.id}`}
                        style={{
                          minHeight: 44,
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid rgba(37,99,235,0.18)",
                          background: "rgba(37,99,235,0.10)",
                          color: "var(--primary)",
                          fontWeight: 950,
                          textAlign: "center",
                          textDecoration: "none",
                        }}
                      >
                        Signatures
                      </Link>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <Link
                          href={`/edl/${l.id}`}
                          style={{
                            minHeight: 44,
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "white",
                            fontWeight: 900,
                            textAlign: "center",
                            textDecoration: "none",
                            color: "inherit",
                          }}
                        >
                          EDL
                        </Link>

                        <Link
                          href={`/inventory/${l.id}`}
                          style={{
                            minHeight: 44,
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            background: "white",
                            fontWeight: 900,
                            textAlign: "center",
                            textDecoration: "none",
                            color: "inherit",
                          }}
                        >
                          Inventaire
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}

              {leasesSorted.length === 0 ? (
                <div style={{ padding: 12, color: "var(--muted)" }}>Aucun bail.</div>
              ) : null}
            </div>
          ) : (
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
                          <Link href={`/edl/${l.id}`} style={smallLinkStyle}>
                            EDL
                          </Link>
                          <Link href={`/inventory/${l.id}`} style={smallLinkStyle}>
                            Inventaire
                          </Link>
                          <Link
                            href={`/sign/${l.id}`}
                            style={{
                              ...smallLinkStyle,
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
          )}

          <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 12, lineHeight: 1.35 }}>
            Astuce : utilise “Signatures” pour générer / signer Contrat + Pack EDL/Inventaire.
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <Card compact={isMobile} title="Actions rapides" subtitle="Les liens les plus utiles">
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              <QuickLink href="/dashboard/leases">Gérer les baux</QuickLink>
              <QuickLink href="/dashboard/units">Gérer les logements</QuickLink>
              <QuickLink href="/dashboard/tenants">Gérer les locataires</QuickLink>
            </div>
          </Card>

          <Card compact={isMobile} title="À venir (v1+)" subtitle="On branchera ça via un endpoint agrégé">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <RowSoon label="Loyers en retard" />
              <RowSoon label="Revenus du mois" />
              <RowSoon label="Entrées/sorties à 30 jours" />
            </div>
          </Card>

          <Card compact={isMobile} title="Historique" subtitle="Rapide aperçu">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Badge tone="success">{activeLeases.length} actifs</Badge>
              <Badge tone="neutral">{endedLeases.length} clôturés</Badge>
              <Badge tone="neutral">{leases.length} total</Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const smallLinkStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "white",
  fontWeight: 900,
  textDecoration: "none",
  color: "inherit",
};

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        minHeight: 44,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "white",
        fontWeight: 950,
        textDecoration: "none",
        color: "inherit",
        display: "flex",
        alignItems: "center",
      }}
    >
      {children}
    </Link>
  );
}

function RowSoon({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
      <div style={{ color: "var(--muted)" }}>{label}</div>
      <Badge tone="warning">Soon</Badge>
    </div>
  );
}