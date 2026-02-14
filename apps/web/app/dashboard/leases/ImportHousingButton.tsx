"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type Session = { id: string; created_at?: string; status?: string };

function fmtDate(s?: string) {
  if (!s) return "";
  return String(s).slice(0, 19).replace("T", " ");
}

export default function ImportHousingButton({
  leaseId,
  token,
  border,
  blue,
}: {
  leaseId: string;
  token: string;
  border: string;
  blue: string;
}) {
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [edlSessions, setEdlSessions] = useState<Session[]>([]);
  const [invSessions, setInvSessions] = useState<Session[]>([]);

  const isAuthed = useMemo(() => !!token, [token]);

  async function load() {
    if (!leaseId || !token) return;
    setError("");
    setStatus("Vérif…");
    try {
      const [edlR, invR] = await Promise.all([
        fetch(`${API}/edl/sessions?leaseId=${leaseId}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }),
        fetch(`${API}/inventory/sessions?leaseId=${leaseId}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        }),
      ]);

      const edlJ = await edlR.json().catch(() => []);
      const invJ = await invR.json().catch(() => []);

      const edlArr: Session[] = Array.isArray(edlJ) ? edlJ : [];
      const invArr: Session[] = Array.isArray(invJ) ? invJ : [];

      edlArr.sort((a, b) =>
        String(b.created_at || "").localeCompare(String(a.created_at || ""))
      );
      invArr.sort((a, b) =>
        String(b.created_at || "").localeCompare(String(a.created_at || ""))
      );

      setEdlSessions(edlArr);
      setInvSessions(invArr);
      setStatus("");
    } catch (e: any) {
      setStatus("");
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaseId, token]);

  const hasData = edlSessions.length > 0 || invSessions.length > 0;

  const disabledTitle = hasData
    ? "Import bloqué (EDL/Inventaire existent déjà) — mode block_if_data"
    : !isAuthed
      ? "Non connecté"
      : "";

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {!isAuthed || hasData ? (
          <button style={btnDisabled(border)} title={disabledTitle}>
            Importer modèle logement
          </button>
        ) : (
          <Link href={`/import/${leaseId}`}>
            <button style={btnPrimarySmall(blue)}>
              Importer modèle logement
            </button>
          </Link>
        )}

        <button
          onClick={load}
          style={btnSecondary(border)}
          title="Re-vérifier EDL/Inventaire"
        >
          Vérifier
        </button>
      </div>

      {(status || error) && (
        <div
          style={{
            fontSize: 12,
            color: error ? "crimson" : "#6b7280",
            whiteSpace: "pre-wrap",
          }}
        >
          {error || status}
        </div>
      )}

      {isAuthed && hasData && (
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          Déjà présent :
          {edlSessions[0]?.id && (
            <>
              {" "}
              EDL <b>{fmtDate(edlSessions[0]?.created_at)}</b> •{" "}
              {String(edlSessions[0]?.status || "")} •{" "}
              {edlSessions[0].id.slice(0, 8)}…
            </>
          )}
          {invSessions[0]?.id && (
            <>
              {" "}
              | Inventaire <b>{fmtDate(invSessions[0]?.created_at)}</b> •{" "}
              {String(invSessions[0]?.status || "")} •{" "}
              {invSessions[0].id.slice(0, 8)}…
            </>
          )}
        </div>
      )}
    </div>
  );
}

function btnPrimarySmall(blue: string) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid rgba(31,111,235,0.35)`,
    background: "rgba(31,111,235,0.10)",
    color: "#0b2a6f",
    fontWeight: 900,
    cursor: "pointer",
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
  } as const;
}
function btnDisabled(border: string) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "rgba(0,0,0,0.03)",
    cursor: "not-allowed",
    fontWeight: 900,
    color: "#6b7280",
  } as const;
}
