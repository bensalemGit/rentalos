"use client";

type LeaseDesignation = {
  batiment?: string;
  porte?: string;
  etagePrecision?: string;
  typeBien?: string;
  usageMixte?: boolean;
  consistance?: string;
  description?: string;
  chauffageType?: string;
  eauChaudeType?: string;
  dependances?: string[];
  equipementsCommuns?: string[];
};

type IrlState = {
  enabled: boolean;
  quarter: string;
  value: string;
};

type Props = {
  designation: LeaseDesignation;
  setDesignation: (value: any) => void;
  keysCount: string;
  setKeysCount: (value: string) => void;
  irl: IrlState;
  setIrl: (value: any) => void;
  toggleArrayValueIn: (
    current: LeaseDesignation,
    key: "dependances" | "equipementsCommuns",
    value: string
  ) => LeaseDesignation;
  onSave: () => void;
  saving?: boolean;
};

export default function LeaseDesignationSection({
  designation,
  setDesignation,
  keysCount,
  setKeysCount,
  irl,
  setIrl,
  toggleArrayValueIn,
  onSave,
  saving = false,
}: Props) {
  return (
    <SectionCard
      title="Contrat / Désignation"
      subtitle="Tous les champs contractuels, organisés par sous-groupes pour une lecture plus claire."
      rightAction={
        <button
          onClick={onSave}
          disabled={saving}
          style={secondaryPrimaryButtonStyle}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      }
    >
      <SubSection title="Localisation du lot">
        <div style={formGrid3}>
          <Field label="Bâtiment">
            <input
              value={designation.batiment || ""}
              onChange={(e) =>
                setDesignation((prev: LeaseDesignation) => ({
                  ...prev,
                  batiment: e.target.value,
                }))
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Porte / lot">
            <input
              value={designation.porte || ""}
              onChange={(e) =>
                setDesignation((prev: LeaseDesignation) => ({
                  ...prev,
                  porte: e.target.value,
                }))
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Précision étage">
            <input
              value={designation.etagePrecision || ""}
              onChange={(e) =>
                setDesignation((prev: LeaseDesignation) => ({
                  ...prev,
                  etagePrecision: e.target.value,
                }))
              }
              style={inputStyle}
            />
          </Field>
        </div>
      </SubSection>

      <SubSection title="Nature du bien">
        <div style={formGrid3}>
          <Field label="Type de bien">
            <select
              value={designation.typeBien || "appartement"}
              onChange={(e) =>
                setDesignation((prev: LeaseDesignation) => ({
                  ...prev,
                  typeBien: e.target.value,
                }))
              }
              style={inputStyle}
            >
              <option value="appartement">Appartement</option>
              <option value="maison">Maison</option>
            </select>
          </Field>

          <Field label="Usage mixte">
            <label style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={Boolean(designation.usageMixte)}
                onChange={(e) =>
                  setDesignation((prev: LeaseDesignation) => ({
                    ...prev,
                    usageMixte: e.target.checked,
                  }))
                }
              />
              <span>Habitation + usage professionnel</span>
            </label>
          </Field>

          <Field label="Nombre de clés remises">
            <input
              type="number"
              value={keysCount}
              onChange={(e) => setKeysCount(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>
      </SubSection>

      <SubSection title="Description">
        <div style={formGrid2}>
          <Field label="Consistance">
            <input
              value={designation.consistance || ""}
              onChange={(e) =>
                setDesignation((prev: LeaseDesignation) => ({
                  ...prev,
                  consistance: e.target.value,
                }))
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Descriptif">
            <input
              value={designation.description || ""}
              onChange={(e) =>
                setDesignation((prev: LeaseDesignation) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Chauffage">
            <select
              value={designation.chauffageType || "électrique individuel"}
              onChange={(e) =>
                setDesignation((prev: LeaseDesignation) => ({
                  ...prev,
                  chauffageType: e.target.value,
                }))
              }
              style={inputStyle}
            >
              <option value="électrique individuel">Électrique individuel</option>
              <option value="gaz individuel">Gaz individuel</option>
              <option value="collectif">Collectif</option>
              <option value="pompe à chaleur">Pompe à chaleur</option>
              <option value="autre">Autre</option>
            </select>
          </Field>

          <Field label="Eau chaude">
            <select
              value={designation.eauChaudeType || "ballon électrique"}
              onChange={(e) =>
                setDesignation((prev: LeaseDesignation) => ({
                  ...prev,
                  eauChaudeType: e.target.value,
                }))
              }
              style={inputStyle}
            >
              <option value="ballon électrique">Ballon électrique</option>
              <option value="chaudière gaz">Chaudière gaz</option>
              <option value="collectif">Collectif</option>
              <option value="autre">Autre</option>
            </select>
          </Field>
        </div>
      </SubSection>

      <div style={dualBoxGridStyle}>
        <ChoiceBox
          title="Dépendances"
          items={["cave", "parking", "garage", "jardin", "terrasse", "balcon"]}
          selected={designation.dependances || []}
          onToggle={(value) =>
            setDesignation((prev: LeaseDesignation) =>
              toggleArrayValueIn(prev, "dependances", value)
            )
          }
        />

        <ChoiceBox
          title="Équipements communs"
          items={["interphone", "digicode", "ascenseur", "antenne TV", "fibre"]}
          selected={designation.equipementsCommuns || []}
          onToggle={(value) =>
            setDesignation((prev: LeaseDesignation) =>
              toggleArrayValueIn(prev, "equipementsCommuns", value)
            )
          }
        />
      </div>

      <SubSection title="IRL">
        <div style={formGrid3}>
          <Field label="Activation">
            <label style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={irl.enabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIrl((prev: IrlState) => ({
                    ...prev,
                    enabled: checked,
                    quarter: checked ? prev.quarter : "",
                    value: checked ? prev.value : "",
                  }));
                }}
              />
              <span>Activer la révision IRL</span>
            </label>
          </Field>

          <Field label="Trimestre de référence">
            <input
              value={irl.quarter}
              onChange={(e) =>
                setIrl((prev: IrlState) => ({
                  ...prev,
                  quarter: e.target.value,
                }))
              }
              placeholder="ex: T3 2025"
              style={inputStyle}
              disabled={!irl.enabled}
            />
          </Field>

          <Field label="Valeur de référence">
            <input
              value={irl.value}
              onChange={(e) =>
                setIrl((prev: IrlState) => ({
                  ...prev,
                  value: e.target.value,
                }))
              }
              placeholder="ex: 142.06"
              style={inputStyle}
              disabled={!irl.enabled}
            />
          </Field>
        </div>
      </SubSection>
    </SectionCard>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
}) {
  return (
    <section style={cardStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <h2 style={sectionTitleStyle}>{title}</h2>
          {subtitle ? <p style={sectionSubtitleStyle}>{subtitle}</p> : null}
        </div>
        {rightAction ? <div>{rightAction}</div> : null}
      </div>
      <div style={{ display: "grid", gap: 18 }}>{children}</div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={subSectionStyle}>
      <div style={subSectionTitleStyle}>{title}</div>
      {children}
    </div>
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

function ChoiceBox({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div style={choiceBoxStyle}>
      <div style={choiceBoxTitleStyle}>{title}</div>
      <div style={choiceListStyle}>
        {items.map((item) => (
          <label key={item} style={choiceItemStyle}>
            <input
              type="checkbox"
              checked={selected.includes(item)}
              onChange={() => onToggle(item)}
            />
            <span style={{ textTransform: "capitalize" }}>{item}</span>
          </label>
        ))}
      </div>
    </div>
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

const subSectionStyle: React.CSSProperties = {
  border: "1px solid rgba(27,39,64,0.06)",
  borderRadius: 18,
  padding: 16,
  background: "#FCFDFF",
};

const subSectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#17233A",
  fontWeight: 800,
  marginBottom: 14,
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

const checkboxRowStyle: React.CSSProperties = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  color: "#243247",
  fontSize: 14,
};

const formGrid2: React.CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
};

const formGrid3: React.CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const dualBoxGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
};

const choiceBoxStyle: React.CSSProperties = {
  border: "1px solid rgba(27,39,64,0.06)",
  borderRadius: 18,
  padding: 16,
  background: "#FCFDFF",
};

const choiceBoxTitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#17233A",
  fontWeight: 800,
  marginBottom: 12,
};

const choiceListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const choiceItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#243247",
  fontSize: 14,
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