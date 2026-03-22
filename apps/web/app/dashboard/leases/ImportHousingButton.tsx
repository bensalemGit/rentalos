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
  compact = false,
}: {
  leaseId: string;
  token: string;
  border: string;
  blue: string;
  compact?: boolean;
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

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {!isAuthed || hasData ? (
          <button style={compactGhost(border)} title={disabledTitle}>
            Import
          </button>
        ) : (
          <Link href={`/import/${leaseId}`}>
            <button style={compactGhost(border)}>Import</button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
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
            color: error ? "#C2413A" : "#7C8AA5",
            whiteSpace: "pre-wrap",
          }}
        >
          {error || status}
        </div>
      )}

      {isAuthed && hasData && (
        <div style={{ fontSize: 12.5, color: "#667085", lineHeight: 1.55, padding: "10px 12px", borderRadius: 12, border: `1px solid ${border}`, background: "#FAFBFC" }}>
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
    border: `1px solid rgba(47,99,224,0.18)`,
    background: "linear-gradient(180deg, #2F63E0 0%, #2A5BD7 100%)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(47,99,224,0.18)",
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
    color: "#243247",
    boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
  } as const;
}
function btnDisabled(border: string) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background: "rgba(27,39,64,0.04)",
    cursor: "not-allowed",
    fontWeight: 900,
    color: "#7C8AA5",
  } as const;
}


function compactGhost(border: string) {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: "#fff",
    cursor: "pointer",
    fontWeight: 800,
    color: "#243247",
    boxShadow: "none",
    minHeight: 34,
  } as const;
}
