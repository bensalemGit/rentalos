"use client";

type TenantLike = {
  id: string;
  full_name?: string;
  tenant_name?: string;
  email?: string | null;
  phone?: string | null;
};

type Props = {
  mainTenant?: TenantLike | null;
  coTenants: TenantLike[];
  selectableTenants: TenantLike[];
  newTenantId: string;
  setNewTenantId: (value: string) => void;
  onAddCoTenant: () => void;
  onRemoveCoTenant: (id: string) => void;
  savingTenant?: boolean;
};

export default function LeaseTenantsSection({
  mainTenant,
  coTenants,
  selectableTenants,
  newTenantId,
  setNewTenantId,
  onAddCoTenant,
  onRemoveCoTenant,
  savingTenant = false,
}: Props) {
  return (
    <SectionCard
      title="Locataires"
      subtitle="Locataire principal, co-locataires actuels, ajout et suppression."
    >
      <div style={tenantGridStyle}>
        <div style={tenantCardStyle}>
          <div style={tenantCardLabelStyle}>Locataire principal</div>
          <div style={tenantCardTitleStyle}>
            {mainTenant?.full_name || mainTenant?.tenant_name || "—"}
          </div>
          <div style={tenantCardMetaStyle}>
            {mainTenant?.email || "—"}
            {mainTenant?.phone ? ` • ${mainTenant.phone}` : ""}
          </div>
        </div>

        {coTenants.map((t) => (
          <div key={t.id} style={tenantRowStyle}>
            <div>
              <div style={tenantRowNameStyle}>{t.full_name || t.tenant_name}</div>
              <div style={tenantRowMetaStyle}>
                {t.email || "—"}
                {t.phone ? ` • ${t.phone}` : ""}
              </div>
            </div>

            <button
              onClick={() => onRemoveCoTenant(t.id)}
              disabled={savingTenant}
              style={dangerButtonStyle}
            >
              Retirer
            </button>
          </div>
        ))}

        {!coTenants.length && (
          <div style={emptyStateStyle}>Aucun co-locataire pour le moment.</div>
        )}
      </div>

      <div style={dividerStyle} />

      <div style={inlineFormRowStyle}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <Field label="Ajouter un co-locataire">
            <select
              value={newTenantId}
              onChange={(e) => setNewTenantId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Choisir un locataire…</option>
              {selectableTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                  {t.email ? ` — ${t.email}` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <button
          onClick={onAddCoTenant}
          disabled={savingTenant}
          style={secondaryPrimaryButtonStyle}
        >
          {savingTenant ? "Ajout…" : "Ajouter"}
        </button>
      </div>
    </SectionCard>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={cardStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <h2 style={sectionTitleStyle}>{title}</h2>
          {subtitle ? <p style={sectionSubtitleStyle}>{subtitle}</p> : null}
        </div>
      </div>
      <div style={{ display: "grid", gap: 18 }}>{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={fieldStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </label>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(27,39,64,0.06)",
  borderRadius: 24,
  background: "#fff",
  padding: 22,
  boxShadow: "0 10px 30px rgba(16,24,40,0.05)",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  lineHeight: 1.1,
  letterSpacing: "-0.03em",
  color: "#17233A",
  fontWeight: 900,
};

const sectionSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 14,
  color: "#667085",
  lineHeight: 1.6,
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#667085",
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(27,39,64,0.08)",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  background: "#fff",
};

const tenantGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const tenantCardStyle: React.CSSProperties = {
  border: "1px solid rgba(27,39,64,0.06)",
  borderRadius: 18,
  padding: 16,
  background: "#F9FBFF",
};

const tenantCardLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#8D99AE",
  fontWeight: 700,
  marginBottom: 6,
};

const tenantCardTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#17233A",
};

const tenantCardMetaStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "#667085",
};

const tenantRowStyle: React.CSSProperties = {
  border: "1px solid rgba(27,39,64,0.06)",
  borderRadius: 16,
  padding: 14,
  background: "#fff",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const tenantRowNameStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: "#17233A",
};

const tenantRowMetaStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "#667085",
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: "rgba(27,39,64,0.08)",
};

const inlineFormRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "end",
  flexWrap: "wrap",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(220,38,38,0.18)",
  background: "#FFF5F7",
  color: "#A12C52",
  cursor: "pointer",
  fontWeight: 800,
};

const secondaryPrimaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(47,99,224,0.16)",
  background: "#EEF4FF",
  color: "#3467EB",
  fontWeight: 800,
  cursor: "pointer",
};

const emptyStateStyle: React.CSSProperties = {
  border: "1px dashed rgba(27,39,64,0.12)",
  borderRadius: 16,
  padding: 16,
  color: "#667085",
  background: "#FCFDFF",
};