"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeEuro,
  CalendarDays,
  FileSignature,
  Home,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UsersRound,
  WalletCards,
  TrendingUp,
} from "lucide-react";

const API =
  typeof window !== "undefined"
    ? window.location.origin + "/api"
    : "https://app.rentalos.fr/api";

type LeaseDetails = {
  lease?: any;
  tenants?: any[];
  amounts?: any[];
};

type TenantOption = {
  id: string;
  full_name?: string;
  fullName?: string;
  email?: string | null;
  phone?: string | null;
};

export default function NewAmendmentPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const leaseId = String(params?.leaseId || "");
  const type = searchParams.get("type") || "ADD_TENANT";

  const [token, setToken] = useState("");
  const [data, setData] = useState<LeaseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [effectiveDate, setEffectiveDate] = useState("");
  const [allTenants, setAllTenants] = useState<TenantOption[]>([]);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [tenantSearch, setTenantSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [extraChargesCents, setExtraChargesCents] = useState("7000");
  const [irlApplyDate, setIrlApplyDate] = useState("");
  const [irlApplyQuarter, setIrlApplyQuarter] = useState("");
  const [irlApplyValue, setIrlApplyValue] = useState("");

  const lease = data?.lease;
  const tenants = data?.tenants || [];
  const isIrl = String(type).toUpperCase() === "AVENANT_IRL";

  const existingTenantIds = useMemo(() => {
    return new Set(
      tenants
        .map((t: any) => String(t.tenant_id || t.id || "").trim())
        .filter(Boolean),
    );
  }, [tenants]);

  const availableTenants = useMemo(() => {
    const q = tenantSearch.trim().toLowerCase();

    return allTenants
      .filter((t) => !existingTenantIds.has(String(t.id)))
      .filter((t) => {
        if (!q) return true;
        const name = String(t.full_name || t.fullName || "").toLowerCase();
        const email = String(t.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 20);
  }, [allTenants, existingTenantIds, tenantSearch]);

  const selectedTenant = useMemo(() => {
    return allTenants.find((t) => String(t.id) === selectedTenantId) || null;
  }, [allTenants, selectedTenantId]);


  const rentCents = Number(lease?.rent_cents || 0);
  const chargesCents = Number(lease?.charges_cents || 0);
  const depositCents = Number(lease?.deposit_cents || 0);
  const paymentDay = Number(lease?.payment_day || 5);
  const extra = Number(extraChargesCents || 0);
  const newCharges = chargesCents + extra;

  useEffect(() => {
    setToken(localStorage.getItem("token") || "");
  }, []);

  useEffect(() => {
    if (!token || !leaseId) return;

    const today = new Date().toISOString().slice(0, 10);
    setEffectiveDate((v) => v || today);

    // Important UX :
    // Sur une création d’avenant, les “charges actuelles” doivent être
    // la base en vigueur aujourd’hui, pas le montant futur à la date d’effet.
    load();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, leaseId]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const r = await fetch(`${API}/leases/${leaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        cache: "no-store",
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || JSON.stringify(j));

      setData(j);

      if (isIrl) {

        const loadedLease = j?.lease || j;

        const defaultIrlDate =
          (loadedLease?.next_revision_date
            ? String(loadedLease.next_revision_date).slice(0, 10)
            : "") ||
          (loadedLease?.nextRevisionDate
            ? String(loadedLease.nextRevisionDate).slice(0, 10)
            : "") ||
          (loadedLease?.irl_revision_date
            ? String(loadedLease.irl_revision_date).slice(0, 10)
            : "") ||
          (loadedLease?.irlRevisionDate
            ? String(loadedLease.irlRevisionDate).slice(0, 10)
            : "") ||
          addOneYear(loadedLease?.start_date || loadedLease?.startDate) ||
          new Date().toISOString().slice(0, 10);

        setIrlApplyDate(defaultIrlDate);
      }

      const tenantsRes = await fetch(`${API}/tenants`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        cache: "no-store",
      });

      const tenantsJson = await tenantsRes.json().catch(() => []);
      const tenantsArr = Array.isArray(tenantsJson)
        ? tenantsJson
        : Array.isArray(tenantsJson?.value)
          ? tenantsJson.value
          : Array.isArray(tenantsJson?.items)
            ? tenantsJson.items
            : [];

      setAllTenants(tenantsArr);


    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setError("");
    setStatus("");

    if (isIrl) {
      if (!irlApplyDate) return setError("Date de révision obligatoire.");
      if (!irlApplyQuarter.trim()) return setError("Trimestre IRL obligatoire. Exemple : T4 2026.");

      const irlNewValue = Number(String(irlApplyValue || "").replace(",", "."));
      if (!Number.isFinite(irlNewValue) || irlNewValue <= 0) {
        return setError("Valeur IRL invalide.");
      }

      setBusy(true);

      try {
        setStatus("Application de la révision IRL…");

        const applyRes = await fetch(`${API}/leases/${leaseId}/irl/apply`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: JSON.stringify({
            revisionDate: irlApplyDate,
            irlNewQuarter: irlApplyQuarter.trim(),
            irlNewValue,
          }),
        });

        const applyTxt = await applyRes.text().catch(() => "");
        const applyJson = applyTxt
          ? await Promise.resolve().then(() => JSON.parse(applyTxt)).catch(() => ({ message: applyTxt }))
          : {};

        if (!applyRes.ok) {
          throw new Error(applyJson?.message || applyTxt || `Erreur application IRL ${applyRes.status}`);
        }

        setStatus("Révision appliquée, génération de l’avenant IRL…");

        const avenantRes = await fetch(`${API}/leases/${leaseId}/irl/avenant`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: JSON.stringify({
            revisionDate: irlApplyDate,
          }),
        });

        const avenantTxt = await avenantRes.text().catch(() => "");
        const avenantJson = avenantTxt
          ? await Promise.resolve().then(() => JSON.parse(avenantTxt)).catch(() => ({ message: avenantTxt }))
          : {};

        if (!avenantRes.ok) {
          throw new Error(avenantJson?.message || avenantTxt || `Erreur génération avenant IRL ${avenantRes.status}`);
        }

        setStatus("Avenant IRL généré ✅");

        router.push(`/dashboard/leases/${leaseId}/amendments`);
        return;
      } catch (e: any) {
        setError(String(e?.message || e));
        return;
      } finally {
        setBusy(false);
      }
    }

    if (!selectedTenantId || !selectedTenant) {
      return setError("Sélectionne un locataire existant.");
    }
    if (!effectiveDate) return setError("Date d’effet obligatoire.");
    if (!Number.isFinite(extra) || extra < 0) return setError("Charges complémentaires invalides.");

    setBusy(true);

    try {
      const r = await fetch(`${API}/leases/${leaseId}/amendments/add-tenant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          effectiveDate,
          tenantId: selectedTenantId,
          tenant: {
            id: selectedTenantId,
            fullName: String(selectedTenant.full_name || selectedTenant.fullName || "").trim(),
            email: selectedTenant.email || null,
            phone: selectedTenant.phone || null,
          },
          rentCents,
          previousChargesCents: chargesCents,
          extraChargesCentsPerTenant: extra,
          newChargesCents: newCharges,
          depositCents,
          paymentDay,
        }),
      });

      const txt = await r.text().catch(() => "");
      const j = txt ? await Promise.resolve().then(() => JSON.parse(txt)).catch(() => ({ message: txt })) : {};

      if (!r.ok) throw new Error(j?.message || txt || `Erreur API ${r.status}`);

      const amendmentId = j?.amendment?.id;

      if (!amendmentId) {
        throw new Error("Avenant créé mais amendment.id manquant.");
      }

      setStatus("Avenant créé, génération du PDF…");

      const generateRes = await fetch(
        `${API}/leases/${leaseId}/amendments/${amendmentId}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: JSON.stringify({ force: true }),
        },
      );

      const generatedTxt = await generateRes.text().catch(() => "");
      const generated = generatedTxt ? JSON.parse(generatedTxt) : {};

      if (!generateRes.ok) {
        throw new Error(generated?.message || generatedTxt || `Erreur génération PDF ${generateRes.status}`);
      }

      const docId =
        generated?.document?.id ||
        generated?.document_id ||
        generated?.amendment?.document_id;

      if (!docId) {
        throw new Error("PDF généré mais document.id introuvable.");
      }

      setStatus("Avenant généré ✅ Redirection signature…");

      router.push(`/sign/${leaseId}?documentId=${docId}`);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const title = "#17233A";
  const muted = "#667085";
  const soft = "#8D99AE";
  const blue = "#3467EB";
  const border = "rgba(27,39,64,0.08)";

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top right, rgba(52,103,235,0.10), transparent 34%), #F6F8FC",
        padding: "clamp(18px, 4vw, 42px)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <button onClick={() => router.push("/dashboard/leases")} style={backBtn(border)}>
          <ArrowLeft size={17} />
          Retour aux baux
        </button>

        <section
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
            gap: 18,
          }}
          className="amendment-grid"
        >
          <div style={heroCard()}>
            <div style={eyebrow(soft)}>
              <Sparkles size={15} />
              {isIrl ? "RÉVISION IRL" : "AVENANT"}
            </div>

            <h1 style={{ margin: "10px 0 8px", fontSize: 36, lineHeight: 1, color: title, letterSpacing: "-0.055em" }}>
              {isIrl ? "Appliquer une révision IRL" : "Générer un avenant"}
            </h1>

            <p style={{ margin: 0, color: muted, lineHeight: 1.65, maxWidth: 680 }}>
              {isIrl
                ? "Applique la révision annuelle du loyer et génère l’avenant IRL PDF, sans parcours de signature."
                : "Crée un avenant propre, prêt à signer, pour ajouter un colocataire au bail existant."}
            </p>

            <div style={{ marginTop: 22, display: "grid", gap: 12 }}>
              <InfoLine icon={<Home size={18} />} label="Logement" value={lease?.unit_code || leaseId} />
              <InfoLine icon={<UsersRound size={18} />} label="Locataires actuels" value={`${tenants.length || "—"} signataire(s)`} />
              <InfoLine icon={<CalendarDays size={18} />} label="Bail" value={`${fmtDate(lease?.start_date)} → ${fmtDate(lease?.end_date_theoretical)}`} />
            </div>
          </div>

          <div style={summaryCard()}>
            <div style={premiumIcon(blue)}>
              {isIrl ? <TrendingUp size={24} /> : <FileSignature size={24} />}
            </div>
            <h2 style={{ margin: "14px 0 6px", color: title, letterSpacing: "-0.035em" }}>
              {isIrl ? "Révision IRL" : "Ajout locataire"}
            </h2>
            <p style={{ margin: 0, color: muted, lineHeight: 1.55, fontSize: 14 }}>
              {isIrl
                ? "La révision mettra à jour le loyer du bail et générera un avenant IRL transmissible aux locataires."
                : "L’avenant mettra à jour les signataires et les charges à compter de la date d’effet."}
            </p>

            <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
              <MoneyLine label="Loyer actuel" value={`${euro(rentCents)} €`} />

              {isIrl ? (
                <>
                  <MoneyLine label="IRL référence" value={irlRefLabel(lease)} />
                  <MoneyLine label="Prochaine révision" value={irlApplyDate || "—"} strong />
                </>
              ) : (
                <>
                  <MoneyLine label="Charges actuelles" value={`${euro(chargesCents)} €`} />
                  <MoneyLine label="Nouvelles charges" value={`${euro(newCharges)} €`} strong />
                </>
              )}
            </div>
          </div>
        </section>

        <section style={formCard(border)}>
          {loading ? (
            <div style={{ padding: 34, color: muted, display: "flex", gap: 10, alignItems: "center" }}>
              <Loader2 size={18} className="spin" />
              Chargement du bail…
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={eyebrow(soft)}>
                    {isIrl ? <TrendingUp size={15} /> : <UserPlus size={15} />}
                    TYPE D’AVENANT
                  </div>
                  <h2 style={{ margin: "8px 0 0", color: title, letterSpacing: "-0.035em" }}>
                    {isIrl ? "Révision IRL" : "Ajout locataire"}
                  </h2>
                </div>

                <div style={pill(blue)}>
                  {isIrl ? <TrendingUp size={16} /> : <ShieldCheck size={16} />}
                  {isIrl ? "Sans signature" : "Signature multi-parties"}
                </div>
              </div>

              {error && <div style={alertBox("danger")}>{error}</div>}
              {status && <div style={alertBox("success")}>{status}</div>}

              {isIrl ? (
                  <>
                <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }} className="form-grid">
                  <Field label="Date de révision *">
                    <input
                      type="date"
                      value={irlApplyDate}
                      onChange={(e) => setIrlApplyDate(e.target.value)}
                      style={input(border)}
                    />
                  </Field>

                  <Field label="Nouveau trimestre IRL *">
                    <input
                      value={irlApplyQuarter}
                      onChange={(e) => setIrlApplyQuarter(e.target.value)}
                      placeholder="ex: T4 2026"
                      style={input(border)}
                    />
                  </Field>

                  <Field label="Nouvelle valeur IRL *">
                    <input
                      value={irlApplyValue}
                      onChange={(e) => setIrlApplyValue(e.target.value)}
                      placeholder="ex: 144.64"
                      style={input(border)}
                    />
                  </Field>
                </div>
                  <IrlPreview
                    muted={muted}
                    border={border}
                    lease={lease}
                    newValueRaw={irlApplyValue}
                  />
                </>      
              ) : (
                
                <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="form-grid">
                  <Field label="Date d’effet *">
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      style={input(border)}
                    />
                  </Field>

                  <Field label="Charges complémentaires mensuelles (centimes)">
                    <input value={extraChargesCents} onChange={(e) => setExtraChargesCents(e.target.value)} style={input(border)} />
                  </Field>

                  <Field label="Locataire à ajouter *">
                    <div style={{ position: "relative" }}>
                      <input
                        value={tenantSearch}
                        onFocus={() => {
                          setTenantDropdownOpen(true);
                        }}
                        onBlur={() => {
                          window.setTimeout(() => {
                            setTenantDropdownOpen(false);
                          }, 150);
                        }}
                        onChange={(e) => {
                          setTenantSearch(e.target.value);
                          setSelectedTenantId("");
                          setTenantDropdownOpen(true);
                        }}
                        placeholder="Rechercher un locataire existant..."
                        style={input(border)}
                      />

                      {tenantDropdownOpen && (
                        <div style={tenantDropdownStyle(border)}>
                          {availableTenants.map((t) => {
                            const name = String(t.full_name || t.fullName || "Locataire");
                            const email = String(t.email || "");

                            return (
                              <button
                                key={t.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setSelectedTenantId(t.id);
                                  setTenantSearch(email ? `${name} — ${email}` : name);
                                  setTenantDropdownOpen(false);
                                }}
                                style={tenantChoiceButton(border, selectedTenantId === t.id)}
                              >
                                <b>{name}</b>
                                {email ? <span style={{ color: "#667085" }}>{email}</span> : null}
                              </button>
                            );
                          })}

                          {!availableTenants.length && (
                            <div style={{ padding: 12, color: "#8D99AE", fontSize: 13, fontWeight: 700 }}>
                              Aucun locataire disponible.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Field>
                </div>
              )}

              {!isIrl && (
                <div style={previewBox()}>
                  <div style={previewItem()}>
                    <BadgeEuro size={18} />
                    <span>Charges : {euro(chargesCents)} € → <b>{euro(newCharges)} €</b></span>
                  </div>
                  <div style={previewItem()}>
                    <WalletCards size={18} />
                    <span>Dépôt : <b>{euro(depositCents)} €</b></span>
                  </div>
                  <div style={previewItem()}>
                    <CalendarDays size={18} />
                    <span>Échéance : jour <b>{paymentDay}</b></span>
                  </div>
                </div>
                )}

              <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
                <button onClick={() => router.back()} style={secondaryBtn(border)} disabled={busy}>
                  Annuler
                </button>
                <button onClick={submit} style={primaryBtn(blue)} disabled={busy}>
                  {busy ? <Loader2 size={17} className="spin" /> : <Plus size={17} />}
                  {isIrl ? "Appliquer et générer l’avenant IRL" : "Générer l’avenant"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .amendment-grid {
            grid-template-columns: 1fr !important;
          }
          .form-grid {
            grid-template-columns: 1fr !important;
          }
        }
        .spin {
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}

function fmtDate(v?: string) {
  return v ? String(v).slice(0, 10) : "—";
}

function euro(cents: number) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 8, color: "#667085", fontSize: 12, fontWeight: 800 }}>
      {label}
      {children}
    </label>
  );
}

function InfoLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div style={miniIcon()}>{icon}</div>
      <div>
        <div style={{ fontSize: 12, color: "#8D99AE", fontWeight: 800 }}>{label}</div>
        <div style={{ color: "#17233A", fontWeight: 900 }}>{value}</div>
      </div>
    </div>
  );
}

function MoneyLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
      <span style={{ color: "#667085" }}>{label}</span>
      <b style={{ color: strong ? "#3467EB" : "#17233A" }}>{value}</b>
    </div>
  );
}

function backBtn(border: string): React.CSSProperties {
  return {
    border: `1px solid ${border}`,
    background: "#fff",
    borderRadius: 12,
    padding: "10px 14px",
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    fontWeight: 900,
    color: "#243247",
    cursor: "pointer",
  };
}

function heroCard(): React.CSSProperties {
  return {
    borderRadius: 28,
    padding: 28,
    background: "#fff",
    border: "1px solid rgba(27,39,64,0.07)",
    boxShadow: "0 22px 60px rgba(16,24,40,0.08)",
  };
}

function summaryCard(): React.CSSProperties {
  return {
    borderRadius: 28,
    padding: 26,
    background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFF 100%)",
    border: "1px solid rgba(52,103,235,0.12)",
    boxShadow: "0 22px 60px rgba(52,103,235,0.10)",
  };
}

function formCard(border: string): React.CSSProperties {
  return {
    marginTop: 18,
    borderRadius: 28,
    padding: "clamp(18px, 3vw, 28px)",
    background: "#fff",
    border: `1px solid ${border}`,
    boxShadow: "0 22px 60px rgba(16,24,40,0.08)",
  };
}

function eyebrow(color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color,
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.08em",
  };
}

function premiumIcon(blue: string): React.CSSProperties {
  return {
    width: 54,
    height: 54,
    borderRadius: 19,
    background: "#EEF4FF",
    color: blue,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 14px 30px rgba(52,103,235,0.16)",
  };
}

function miniIcon(): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: "#F3F6FF",
    color: "#3467EB",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}

function input(border: string): React.CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    border: `1px solid ${border}`,
    borderRadius: 15,
    padding: "13px 14px",
    outline: "none",
    background: "#FBFCFE",
    color: "#17233A",
    fontWeight: 750,
  };
}

function pill(blue: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 13px",
    borderRadius: 999,
    background: "#EEF4FF",
    color: blue,
    fontWeight: 900,
    fontSize: 13,
  };
}

function previewBox(): React.CSSProperties {
  return {
    marginTop: 18,
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    background: "#F8FAFC",
    border: "1px solid rgba(27,39,64,0.06)",
  };
}

function previewItem(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#243247",
    fontWeight: 800,
    fontSize: 13,
  };
}

function alertBox(mode: "danger" | "success"): React.CSSProperties {
  return {
    marginTop: 16,
    padding: "12px 14px",
    borderRadius: 16,
    border: mode === "danger" ? "1px solid rgba(220,38,38,0.22)" : "1px solid rgba(31,157,97,0.18)",
    background: mode === "danger" ? "#FFF5F5" : "#ECF9F1",
    color: mode === "danger" ? "#A12C2C" : "#1F7A4D",
    fontWeight: 900,
  };
}

function secondaryBtn(border: string): React.CSSProperties {
  return {
    border: `1px solid ${border}`,
    background: "#fff",
    color: "#243247",
    borderRadius: 16,
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function primaryBtn(blue: string): React.CSSProperties {
  return {
    border: "1px solid rgba(52,103,235,0.12)",
    background: blue,
    color: "#fff",
    borderRadius: 16,
    padding: "12px 18px",
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 9,
    boxShadow: "0 14px 30px rgba(52,103,235,0.22)",
  };
}

function tenantChoiceButton(border: string, selected: boolean): React.CSSProperties {
  return {
    border: selected ? "1px solid rgba(52,103,235,0.35)" : `1px solid ${border}`,
    background: selected ? "#EEF4FF" : "#fff",
    color: "#17233A",
    borderRadius: 12,
    padding: "11px 12px",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    cursor: "pointer",
    textAlign: "left",
    fontWeight: 800,
  };
}

function tenantDropdownStyle(border: string): React.CSSProperties {
  return {
    position: "absolute",
    zIndex: 50,
    top: "calc(100% + 8px)",
    left: 0,
    right: 0,
    maxHeight: 260,
    overflowY: "auto",
    border: `1px solid ${border}`,
    borderRadius: 16,
    background: "#fff",
    boxShadow: "0 18px 42px rgba(16,24,40,0.14)",
    padding: 8,
    display: "grid",
    gap: 6,
  };
}

function addOneYear(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function IrlPreview({
  lease,
  newValueRaw,
  muted,
  border,
}: {
  lease: any;
  newValueRaw: string;
  muted: string;
  border: string;
}) {
  const currentRent = Number(lease?.rent_cents || 0) / 100;

  const terms = lease?.lease_terms ?? lease?.leaseTerms ?? null;

  const refValue =
    terms?.irlIndexation?.referenceValue ??
    terms?.irl_indexation?.referenceValue ??
    lease?.irl_reference_value ??
    lease?.irlReferenceValue ??
    null;

  const refNum = Number(refValue);
  const newNum = Number(String(newValueRaw || "").replace(",", "."));

  const canCompute =
    Number.isFinite(refNum) &&
    refNum > 0 &&
    Number.isFinite(newNum) &&
    newNum > 0 &&
    currentRent > 0;

  const coef = canCompute ? newNum / refNum : null;
  const nextRent = canCompute ? Math.round(currentRent * coef! * 100) / 100 : null;

  return (
    <div
      style={{
        marginTop: 18,
        border: `1px solid ${border}`,
        borderRadius: 18,
        padding: 16,
        background: "#fff",
      }}
    >
      <div style={{ fontWeight: 950, marginBottom: 8, color: "#17233A" }}>
        Aperçu (calcul attendu)
      </div>

      <div style={{ color: muted, fontSize: 13, display: "grid", gap: 6 }}>
        <div>Loyer actuel (contrat) : <b>{currentRent.toFixed(2)} €</b></div>
        <div>IRL référence : <b>{Number.isFinite(refNum) ? refNum : "—"}</b></div>
        <div>IRL nouveau : <b>{Number.isFinite(newNum) ? newNum : "—"}</b></div>

        {canCompute ? (
          <>
            <div>Coefficient : <b>{coef!.toFixed(6)}</b></div>
            <div>Nouveau loyer attendu : <b>{nextRent!.toFixed(2)} €</b></div>
            <div style={{ marginTop: 6 }}>
              Le backend peut arrondir au centime / gérer des règles spécifiques.
            </div>
          </>
        ) : (
          <div style={{ marginTop: 6 }}>
            Renseigne la valeur IRL pour afficher le calcul.
          </div>
        )}
      </div>
    </div>
  );
}

function irlRefLabel(lease: any) {
  const terms = lease?.lease_terms ?? lease?.leaseTerms ?? null;

  const refValue =
    terms?.irlIndexation?.referenceValue ??
    terms?.irl_indexation?.referenceValue ??
    lease?.irl_reference_value ??
    lease?.irlReferenceValue ??
    null;

  const refQuarter =
    terms?.irlIndexation?.referenceQuarter ??
    terms?.irl_indexation?.referenceQuarter ??
    lease?.irl_reference_quarter ??
    lease?.irlReferenceQuarter ??
    "";

  if (!refValue) return "—";
  return refQuarter ? `${refValue} · ${refQuarter}` : String(refValue);
}