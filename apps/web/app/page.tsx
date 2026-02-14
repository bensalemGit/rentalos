"use client";
import { useEffect, useState } from "react";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

async function safeJsonOrText(resp: Response) {
  const ct = resp.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await resp.json();
  return { _nonJson: true, text: await resp.text() };
}

export default function Page() {
  const [email, setEmail] = useState("admin@example.com");
  const [fullName, setFullName] = useState("Admin");
  const [password, setPassword] = useState("adminadmin");
  const [token, setToken] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  const blue = "#1f6feb";
  const border = "#e5e7eb";
  const bg = "#f6f8fa";

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) {
      setToken(t);
      window.location.href = "/dashboard";
    }
  }, []);

  async function register() {
    setMsg("");
    const r = await fetch(`${API}/auth/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fullName, password }),
    });

    const j: any = await safeJsonOrText(r);

    if (!r.ok) {
      setMsg(j?.message || j?.text || JSON.stringify(j));
      return;
    }

    if (j?._nonJson) {
      setMsg("Cloudflare Access demande une authentification (OTP). Termine l’OTP puis réessaie.");
      return;
    }

    if (j?.token) {
      localStorage.setItem("token", j.token);
      setToken(j.token);
      setMsg("Register OK ✅ Redirection…");
      window.location.href = "/dashboard";
    } else {
      setMsg("Réponse inattendue: " + JSON.stringify(j));
    }
  }

  async function login() {
    setMsg("");
    const r = await fetch(`${API}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const j: any = await safeJsonOrText(r);

    if (!r.ok) {
      setMsg(j?.message || j?.text || JSON.stringify(j));
      return;
    }

    if (j?._nonJson) {
      setMsg("Cloudflare Access demande une authentification (OTP). Termine l’OTP puis réessaie.");
      return;
    }

    if (j?.token) {
      localStorage.setItem("token", j.token);
      setToken(j.token);
      setMsg("Login OK ✅ Redirection…");
      window.location.href = "/dashboard";
    } else {
      setMsg("Réponse inattendue: " + JSON.stringify(j));
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setMsg("Logout OK");
  }

  return (
    <main style={{ padding: 16, fontFamily: "Arial", background: bg, minHeight: "100vh" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: blue,
              boxShadow: "0 0 0 4px rgba(31,111,235,0.12)",
            }}
          />
          <div style={{ fontWeight: 900, fontSize: 18 }}>RentalOS</div>
          <div style={{ color: "#6b7280", fontSize: 13 }}>Connexion</div>
        </div>

        <section style={{ border: `1px solid ${border}`, borderRadius: 14, padding: 14, background: "#fff" }}>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Accès administrateur</h1>
          <p style={{ color: "#6b7280", marginTop: 0 }}>
            Connectez-vous pour gérer logements, locataires, baux, EDL, signatures et quittances.
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label>Email<br />
              <input style={{ width: "100%" }} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>

            <label>Nom complet<br />
              <input style={{ width: "100%" }} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>

            <label>Mot de passe<br />
              <input style={{ width: "100%" }} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={register} style={primaryBtn(blue)}>Créer compte</button>
              <button onClick={login} style={primaryBtn(blue)}>Se connecter</button>
            </div>

            {msg && (
              <div style={{ padding: 10, border: `1px solid ${border}`, borderRadius: 12, background: "#fafafa" }}>
                <b>Info :</b> {msg}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function primaryBtn(blue: string) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid rgba(31,111,235,0.35)`,
    background: "rgba(31,111,235,0.10)",
    color: "#0b2a6f",
    fontWeight: 700,
    cursor: "pointer",
  } as const;
}

function secondaryBtn(border: string) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "#fff",
    cursor: "pointer",
  } as const;
}
