"use client";
import { useEffect, useState } from "react";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

export default function DashboardPage() {
  const [token, setToken] = useState("");
  const [kpi, setKpi] = useState({
    units: 0,
    tenants: 0,
    leasesActive: 0,
    leasesTotal: 0,
    receiptsInfo: "—",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const headers: any = { Authorization: `Bearer ${token}` };

        const [u, t, l] = await Promise.all([
          fetch(`${API}/units`, { headers, credentials: "include" }).then((r) => r.json()),
          fetch(`${API}/tenants`, { headers, credentials: "include" }).then((r) => r.json()),
          fetch(`${API}/leases`, { headers, credentials: "include" }).then((r) => r.json()),
        ]);

        const units = Array.isArray(u) ? u.length : (u?.id ? 1 : 0);
        const tenants = Array.isArray(t) ? t.length : 0;
        const leases = Array.isArray(l) ? l : [];

        const leasesTotal = leases.length;
        const leasesActive = leases.filter((x: any) => x.status !== "ended").length;

        // receipts KPI (optional: depends on API, so we keep it safe)
        const now = new Date();
        const ym = `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
        const receiptsInfo = `Quittances: ${ym} (à venir)`;

        setKpi({ units, tenants, leasesActive, leasesTotal, receiptsInfo });
      } catch (e: any) {
        setError(String(e?.message || e));
      }
    })();
  }, [token]);

  const brandBlue = "#1f6feb";
  const bgCard = "#ffffff";
  const border = "#e5e7eb";
  const okGreen = "#16a34a";

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <div style={{ color: "#6b7280", marginTop: 6 }}>
            Vue d’ensemble — indicateurs clés (MVP)
          </div>
        </div>
        <div style={{ color: okGreen, fontWeight: 600 }}>
          ● Système OK
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, border: `1px solid ${border}`, borderRadius: 12, background: "#fff" }}>
          <b style={{ color: "crimson" }}>Erreur:</b> {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
        <KpiCard title="Logements" value={String(kpi.units)} accent={brandBlue} />
        <KpiCard title="Locataires" value={String(kpi.tenants)} accent={brandBlue} />
        <KpiCard title="Baux actifs" value={`${kpi.leasesActive}`} accent={brandBlue} subtitle={`Total: ${kpi.leasesTotal}`} />
        <KpiCard title="Quittances" value="MVP" accent={brandBlue} subtitle={kpi.receiptsInfo} />
      </div>

      <div style={{ marginTop: 14, border: `1px solid ${border}`, borderRadius: 14, background: bgCard, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>À prévoir (v1)</h2>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#374151" }}>
          <li>Relance automatique quittance (mensuelle) + email</li>
          <li>Suivi paiements (reçus / en retard)</li>
          <li>Tableau “entrées / sorties” à 30 jours</li>
          <li>Export comptable (CSV)</li>
        </ul>
      </div>
    </main>
  );
}

function KpiCard(props: { title: string; value: string; accent: string; subtitle?: string }) {
  const border = "#e5e7eb";
  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 14, background: "#fff", padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6b7280", fontSize: 13 }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: props.accent }} />
        <b>{props.title}</b>
      </div>
      <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800 }}>{props.value}</div>
      {props.subtitle && <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>{props.subtitle}</div>}
    </div>
  );
}
