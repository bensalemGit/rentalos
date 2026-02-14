"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

function hasToken() {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("token");
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setOk(hasToken());
  }, []);

  if (!ok) {
    return (
      <main style={{ padding: 16, fontFamily: "Arial" }}>
        <h1>Accès admin</h1>
        <p>Vous devez être connecté.</p>
        <Link href="/"><button>Aller à la connexion</button></Link>
      </main>
    );
  }

  const blue = "#1f6feb";
  const bg = "#f6f8fa";
  const border = "#e5e7eb";
  const green = "#16a34a";

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Arial", background: bg }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 270,
          background: "#fff",
          borderRight: `1px solid ${border}`,
          padding: 14,
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: blue,
                boxShadow: "0 0 0 4px rgba(31,111,235,0.12)",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <div style={{ fontWeight: 900, letterSpacing: 0.2, fontSize: 16 }}>RentalOS</div>
              <div style={{ color: "#6b7280", fontSize: 12 }}>Admin</div>
            </div>
          </div>

          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: green,
              border: `1px solid rgba(22,163,74,0.35)`,
              background: "rgba(22,163,74,0.10)",
              padding: "4px 8px",
              borderRadius: 999,
            }}
            title="Environnement de production"
          >
            PROD
          </div>
        </div>

        <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 10 }}>
          Navigation
        </div>

        <nav style={{ display: "grid", gap: 10 }}>
          <Link href="/dashboard/projects">
            <button style={navBtnStyle(blue)}>Projets</button>
          </Link>
		  <Link href="/dashboard/buildings">
			<button style={navBtnStyle(blue)}>Immeubles</button>
		  </Link>
		  <Link href="/dashboard/units">
            <button style={navBtnStyle(blue)}>Logements</button>
          </Link>
          <Link href="/dashboard/tenants">
            <button style={navBtnStyle(blue)}>Locataires</button>
          </Link>
          <Link href="/dashboard/leases">
            <button style={navBtnStyle(blue)}>Baux</button>
          </Link>
        </nav>

        <div style={{ marginTop: 16, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              window.location.href = "/";
            }}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${border}`,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Déconnexion
          </button>
        </div>

        <div style={{ marginTop: 10, color: "#9ca3af", fontSize: 12 }}>
          France — location meublée
        </div>
      </aside>

      {/* Content */}
      <section style={{ flex: 1, padding: 18 }}>
        {children}
      </section>
    </div>
  );
}

function navBtnStyle(blue: string) {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    textAlign: "left" as const,
    fontWeight: 650,
    boxShadow: "0 1px 1px rgba(0,0,0,0.03)",
    outlineColor: blue,
  };
}
