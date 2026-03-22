"use client";

type AmountRow = {
  id?: string;
  effective_date?: string;
  rent_cents?: number;
  charges_cents?: number;
  deposit_cents?: number;
  payment_day?: number;
};

type AmountForm = {
  effectiveDate: string;
  rentCents: string;
  chargesCents: string;
  depositCents: string;
  paymentDay: string;
};

type Props = {
  amountForm: AmountForm;
  setAmountForm: (fn: (prev: AmountForm) => AmountForm) => void;
  onSubmit: () => void;
  onFillFromRow: (row: AmountRow) => void;
  amounts: AmountRow[];
  saving?: boolean;
};

export default function LeaseAmountsSection({
  amountForm,
  setAmountForm,
  onSubmit,
  onFillFromRow,
  amounts,
  saving = false,
}: Props) {
  return (
    <SectionCard
      title="Montants"
      subtitle="Ajout ou correction via préremplissage, avec historique clair des dates d’effet."
    >
      <div style={formGrid5}>
        <Field label="Date d’effet">
          <input
            type="date"
            value={amountForm.effectiveDate}
            onChange={(e) =>
              setAmountForm((prev) => ({
                ...prev,
                effectiveDate: e.target.value,
              }))
            }
            style={inputStyle}
          />
        </Field>

        <Field label="Loyer (€)">
          <input
            type="number"
            value={amountForm.rentCents}
            onChange={(e) =>
              setAmountForm((prev) => ({
                ...prev,
                rentCents: e.target.value,
              }))
            }
            style={inputStyle}
          />
        </Field>

        <Field label="Charges (€)">
          <input
            type="number"
            value={amountForm.chargesCents}
            onChange={(e) =>
              setAmountForm((prev) => ({
                ...prev,
                chargesCents: e.target.value,
              }))
            }
            style={inputStyle}
          />
        </Field>

        <Field label="Dépôt (€)">
          <input
            type="number"
            value={amountForm.depositCents}
            onChange={(e) =>
              setAmountForm((prev) => ({
                ...prev,
                depositCents: e.target.value,
              }))
            }
            style={inputStyle}
          />
        </Field>

        <Field label="Jour de paiement">
          <input
            type="number"
            value={amountForm.paymentDay}
            onChange={(e) =>
              setAmountForm((prev) => ({
                ...prev,
                paymentDay: e.target.value,
              }))
            }
            style={inputStyle}
          />
        </Field>
      </div>

      <div style={{ marginTop: 16 }}>
        <button
          onClick={onSubmit}
          disabled={saving}
          style={secondaryPrimaryButtonStyle}
        >
          {saving ? "Enregistrement…" : "Enregistrer les montants"}
        </button>
      </div>

      <div style={historyListStyle}>
        {amounts.map((a, i) => (
          <div key={a.id || i} style={historyRowStyle}>
            <div>
              <div style={historyDateStyle}>
                À partir du {String(a.effective_date || "").slice(0, 10)}
              </div>
              <div style={historyMetaStyle}>
                Loyer {((a.rent_cents || 0) / 100).toFixed(2)} € • Charges{" "}
                {((a.charges_cents || 0) / 100).toFixed(2)} € • Dépôt{" "}
                {((a.deposit_cents || 0) / 100).toFixed(2)} € • Paiement J
                {a.payment_day}
              </div>
            </div>

            <button
              onClick={() => onFillFromRow(a)}
              style={ghostInlineButtonStyle}
            >
              Préremplir
            </button>
          </div>
        ))}

        {!amounts.length && (
          <div style={emptyStateStyle}>Aucune ligne d’historique.</div>
        )}
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
  marginBottom: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  fontWeight: 900,
  color: "#17233A",
};

const sectionSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 14,
  color: "#667085",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
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
};

const formGrid5: React.CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const historyListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 18,
};

const historyRowStyle: React.CSSProperties = {
  border: "1px solid rgba(27,39,64,0.06)",
  borderRadius: 16,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
};

const historyDateStyle: React.CSSProperties = {
  fontWeight: 800,
};

const historyMetaStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#667085",
};

const ghostInlineButtonStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(27,39,64,0.08)",
  background: "#fff",
};

const secondaryPrimaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  background: "#EEF4FF",
  color: "#3467EB",
  fontWeight: 800,
};

const emptyStateStyle: React.CSSProperties = {
  padding: 16,
  color: "#667085",
};