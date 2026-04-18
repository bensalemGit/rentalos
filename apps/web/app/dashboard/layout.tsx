"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Building2,
  FolderOpen,
  Home,
  LayoutDashboard,
  LogOut,
  Users,
  FileText,
} from "lucide-react";

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
  { href: "/dashboard/leases", label: "Baux", icon: FileText },
];

const SHELL = {
  bg: "#F5F7FB",
  sidebarBg: "#FFFFFF",
  surface: "#FFFFFF",
  text: "#1C2740",
  muted: "#7C8AA5",
  border: "rgba(27,39,64,0.08)",
  borderSoft: "rgba(27,39,64,0.06)",
  primary: "#1F5EDC",
  primaryDark: "#1E3F8F",
  primarySoft: "#EEF4FF",
  accent: "#20C7C7",
};

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
            background: "#fff",
            border: `1px solid ${SHELL.border}`,
            borderRadius: 22,
            padding: 22,
            boxShadow: "0 18px 40px rgba(15,23,42,0.06)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: SHELL.text }}>
            Accès admin
          </div>
          <div style={{ color: SHELL.muted, marginBottom: 14 }}>Vous devez être connecté.</div>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(31,94,220,0.14)",
              background: "linear-gradient(135deg, #1F5EDC 0%, #20C7C7 100%)",
              color: "white",
              fontWeight: 800,
              boxShadow: "0 12px 24px rgba(31,94,220,0.18)",
            }}
          >
            Aller à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "264px 1fr",
        background: SHELL.bg,
      }}
    >
      <aside
        style={{
          background: SHELL.sidebarBg,
          borderRight: `1px solid ${SHELL.border}`,
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <RentalosLogo />
          </div>
          <div style={{ fontSize: 12, color: SHELL.muted, paddingLeft: 4 }}>Admin · PROD</div>
        </div>

        <div style={{ fontSize: 12, color: SHELL.muted, fontWeight: 800, marginTop: 6 }}>
          Navigation
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                  padding: "13px 14px",
                  borderRadius: 16,
                  border: active ? "1px solid rgba(31,94,220,0.08)" : "1px solid transparent",
                  background: active ? "#EEF4FF" : "transparent",
                  color: active ? "#1E4FD6" : "#1F2A3C",
                  fontWeight: active ? 800 : 700,
                  boxShadow: active ? "0 6px 18px rgba(31,94,220,0.06)" : "none",
                  transition: "all .18s ease",
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
              borderRadius: 16,
              border: `1px solid ${SHELL.border}`,
              background: "#fff",
              cursor: "pointer",
              fontWeight: 800,
              color: "#1F2A3C",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: "0 4px 12px rgba(16,24,40,0.03)",
            }}
          >
            <LogOut size={18} strokeWidth={2.1} />
            Déconnexion
          </button>

          <div style={{ fontSize: 12, color: SHELL.muted, paddingLeft: 4 }}>
            France — location meublée
          </div>
        </div>
      </aside>

      <main style={{ padding: 28 }}>
        <div style={{ maxWidth: 1500, margin: "0 auto" }}>{children}</div>
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
        width: 118,
        height: "auto",
        objectFit: "contain",
      }}
    />
  );
}