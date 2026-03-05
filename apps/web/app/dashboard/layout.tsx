"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

function hasToken() {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("token");
}

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/projects", label: "Projets" },
  { href: "/dashboard/buildings", label: "Immeubles" },
  { href: "/dashboard/units", label: "Logements" },
  { href: "/dashboard/tenants", label: "Locataires" },
  { href: "/dashboard/leases", label: "Baux" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOk(hasToken());
  }, []);

  const activeHref = useMemo(() => {
    const hit = NAV.find((n) => pathname === n.href || pathname?.startsWith(n.href + "/"));
    return hit?.href || "/dashboard";
  }, [pathname]);

  if (!ok) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div
          style={{
            width: "min(520px, 100%)",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: 18,
            boxShadow: "var(--shadow)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Accès admin</div>
          <div style={{ color: "var(--muted)", marginBottom: 14 }}>Vous devez être connecté.</div>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--primary)",
              color: "white",
              fontWeight: 800,
            }}
          >
            Aller à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "280px 1fr" }}>
      {/* Sidebar */}
      <aside
        style={{
          background: "var(--card)",
          borderRight: "1px solid var(--border)",
          padding: 16,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "auto",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: 0.2 }}>
            Rental<span style={{ color: "var(--primary)" }}>OS</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Admin • PROD</div>
        </div>

        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800, marginBottom: 10 }}>
          Navigation
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {NAV.map((n) => {
            const active = n.href === activeHref;
            return (
              <Link
                key={n.href}
                href={n.href}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: active ? "rgba(37,99,235,0.10)" : "white",
                  color: active ? "var(--primary)" : "var(--text)",
                  fontWeight: 800,
                  boxShadow: "var(--shadow)",
                }}
              >
                {n.label}
              </Link>
            );
          })}
        </div>

        <div style={{ height: 14 }} />

        <button
          onClick={() => {
            localStorage.removeItem("token");
            window.location.href = "/";
          }}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "white",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          Déconnexion
        </button>

        <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted)" }}>
          France — location meublée
        </div>
      </aside>

      {/* Content */}
      <main style={{ padding: 24 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>
      </main>
    </div>
  );
}