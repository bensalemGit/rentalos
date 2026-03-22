"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Building2, FolderOpen, Home, LayoutDashboard, LogOut, Users } from "lucide-react";

function hasToken() {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("token");
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projets", icon: FolderOpen },
  { href: "/dashboard/buildings", label: "Immeubles", icon: Building2 },
  { href: "/dashboard/units", label: "Logements", icon: Home },
  { href: "/dashboard/tenants", label: "Locataires", icon: Users },
  { href: "/dashboard/leases", label: "Baux", icon: FolderOpen },
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
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "280px 1fr", background: "#F6F8FC" }}>
      <aside
        style={{
          background: "#fff",
          borderRight: "1px solid rgba(27,39,64,0.08)",
          padding: 20,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <RentalosLogo />
          </div>
          <div style={{ fontSize: 12, color: "#7C8AA5", paddingLeft: 4 }}>Admin · PROD</div>
        </div>

        <div style={{ fontSize: 12, color: "#7C8AA5", fontWeight: 800, marginTop: 6 }}>Navigation</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {NAV.map((n) => {
            const active = n.href === activeHref;
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid transparent",
                  background: active ? "#EEF4FF" : "transparent",
                  color: active ? "#1E4FD6" : "#1F2A3C",
                  fontWeight: active ? 900 : 700,
                  boxShadow: "none",
                }}
              >
                <Icon size={18} strokeWidth={2.1} />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", display: "grid", gap: 12 }}>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              window.location.href = "/";
            }}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(27,39,64,0.10)",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 800,
              color: "#1F2A3C",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
            }}
          >
            <LogOut size={18} strokeWidth={2.1} />
            Déconnexion
          </button>

          <div style={{ fontSize: 12, color: "#7C8AA5", paddingLeft: 4 }}>France — location meublée</div>
        </div>
      </aside>

      <main style={{ padding: 24 }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>{children}</div>
      </main>
    </div>
  );
}

function RentalosLogo() {
  return (
    <img
      src="/rentalos-logo.png"
      alt="Rentalos"
      style={{
        display: "block",
        width: 108,
        height: "auto",
        objectFit: "contain",
      }}
    />
  );
}
