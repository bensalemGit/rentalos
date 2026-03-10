import React from "react";
import type { SignatureOverview } from "../_types/signature-center.types";
import {
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Users,
  Clock3,
} from "lucide-react";

type SignatureHeroProps = {
  overview: SignatureOverview;
  recommendedActionLabel: string;
  canSendAllRemainingLinks: boolean;
  canStartNextOnSite: boolean;
  onSendAllRemainingLinks: () => void;
  onStartNextOnSite: () => void;
  onRefresh?: () => void;
};

const FONT =
  '"Manrope", "Inter", "Segoe UI", ui-sans-serif, system-ui, sans-serif';

const COLORS = {
  navyStrong: "#18243D",
  navySoft: "#6A7890",
  navyMuted: "#9AA7BA",

  border: "rgba(26, 39, 66, 0.055)",

  blue: "#5C81E4",
  green: "#59A37A",
  amber: "#C48A36",
};

function getProgressTone(progressPercent: number, remainingCount: number) {
  if (remainingCount === 0) {
    return {
      track: "rgba(89, 163, 122, 0.11)",
      fill: "linear-gradient(90deg, #67B287 0%, #4F9C70 100%)",
    };
  }

  if (progressPercent >= 50) {
    return {
      track: "rgba(26, 39, 66, 0.05)",
      fill: "linear-gradient(90deg, #F0C978 0%, #E7B66A 48%, #DD9D61 100%)",
    };
  }

  return {
    track: "rgba(26, 39, 66, 0.05)",
    fill: "linear-gradient(90deg, #E6BE69 0%, #E8CB8A 58%, #EBDCB5 100%)",
  };
}

function getChipTone(done: boolean, empty = false) {
  if (empty) {
    return {
      bg: "rgba(120, 136, 165, 0.12)",
      text: "#6D7D96",
      icon: "#97A6BE",
    };
  }

  if (done) {
    return {
      bg: "rgba(85, 186, 120, 0.16)",
      text: "#3F9B63",
      icon: "#46AE6E",
    };
  }

  return {
    bg: "rgba(226, 156, 56, 0.16)",
    text: "#C98420",
    icon: "#DB9830",
  };
}

function HeroChip({
  icon,
  label,
  done,
  empty = false,
}: {
  icon: React.ReactNode;
  label: string;
  done: boolean;
  empty?: boolean;
}) {
  const tone = getChipTone(done, empty);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minHeight: 38,
        padding: "0 16px",
        borderRadius: 999,
        background: tone.bg,
        color: tone.text,
        border: "1px solid rgba(255,255,255,0.55)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.74)",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "-0.012em",
        whiteSpace: "nowrap",
        fontFamily: FONT,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: tone.icon,
        }}
      >
        {icon}
      </span>
      <span>{label}</span>
    </span>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        appearance: "none",
        border: "none",
        borderRadius: 18,
        height: 50,
        padding: "0 24px",
        background: disabled
          ? "#EEF2F7"
          : "linear-gradient(180deg, #6A90EB 0%, #557ADD 100%)",
        color: disabled ? "#9AA6BC" : "#FFFFFF",
        fontSize: 14.5,
        fontWeight: 600,
        letterSpacing: "-0.018em",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled
          ? "none"
          : "0 10px 20px rgba(85,122,221,0.11), inset 0 1px 0 rgba(255,255,255,0.16)",
        fontFamily: FONT,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        appearance: "none",
        border: `1px solid ${disabled ? "#D7DFEA" : "rgba(26,39,66,0.08)"}`,
        borderRadius: 18,
        height: 50,
        padding: "0 24px",
        background: "rgba(255,255,255,0.84)",
        color: disabled ? "#9AA6BC" : COLORS.navyStrong,
        fontSize: 14.5,
        fontWeight: 600,
        letterSpacing: "-0.018em",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: "0 4px 10px rgba(31,41,64,0.022)",
        fontFamily: FONT,
      }}
    >
      {children}
    </button>
  );
}

export function SignatureHero({
  overview,
  recommendedActionLabel,
  canSendAllRemainingLinks,
  canStartNextOnSite,
  onSendAllRemainingLinks,
  onStartNextOnSite,
  onRefresh,
}: SignatureHeroProps) {
  const progressPercent = Math.max(0, Math.min(100, overview.progressPercent || 0));
  const progressWidth = `${Math.max(progressPercent, progressPercent > 0 ? 9 : 0)}%`;
  const isCompleted = overview.remainingCount === 0;
  const progressTone = getProgressTone(progressPercent, overview.remainingCount);

  return (
    <section
      style={{
        borderRadius: 32,
        border: `1px solid ${COLORS.border}`,
        background:
         "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(252,253,255,0.99) 100%)",
        boxShadow:
          "0 8px 18px rgba(31,41,64,0.022), 0 2px 6px rgba(31,41,64,0.012)",
        padding: 28,
        fontFamily: FONT,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 14% 0%, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.22) 32%, rgba(255,255,255,0) 62%)",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
          marginBottom: 22,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 520px" }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#4F6FD3",
              marginBottom: 14,
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}
          >
            Signature du bail
          </div>

          <div
            style={{
              margin: 0,
              fontSize: 28,
              lineHeight: 1.06,
              letterSpacing: "-0.04em",
              fontWeight: 700,
              color: COLORS.navyStrong,
              wordBreak: "break-word",
            }}
          >
            <span>{overview.leaseLabel}</span>
            <span style={{ color: "#B4BED0", fontWeight: 500 }}> — </span>
            <span style={{ fontWeight: 700 }}>{overview.primaryTenantName}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <HeroChip
            icon={<Clock3 size={14} strokeWidth={2.15} />}
            label={isCompleted ? "Dossier finalisé" : `${overview.remainingCount} signatures restantes`}
            done={isCompleted}
            empty={!isCompleted && overview.remainingCount <= 0}
          />

          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              style={{
                appearance: "none",
                border: `1px solid rgba(26,39,66,0.08)`,
                background: "rgba(255,255,255,0.84)",
                borderRadius: 16,
                height: 44,
                padding: "0 16px",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                color: COLORS.navyStrong,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 10px rgba(31,41,64,0.022)",
                fontFamily: FONT,
              }}
            >
              <RefreshCw size={14} strokeWidth={2.05} />
              <span>Rafraîchir</span>
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 580px)",
            alignItems: "center",
            gap: 22,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              minWidth: 0,
            }}
          >
            <HeroChip
              icon={<Users size={14} strokeWidth={2.15} />}
              label={`Locataires ${overview.tenants.signed}/${overview.tenants.total}`}
              done={overview.tenants.total > 0 && overview.tenants.signed === overview.tenants.total}
              empty={overview.tenants.total === 0}
            />

            <HeroChip
              icon={<ShieldCheck size={14} strokeWidth={2.15} />}
              label={
                overview.guarantors.total > 0
                  ? `Garanties ${overview.guarantors.signed}/${overview.guarantors.total}`
                  : "Aucune garantie"
              }
              done={
                overview.guarantors.total > 0 &&
                overview.guarantors.signed === overview.guarantors.total
              }
              empty={overview.guarantors.total === 0}
            />

            <HeroChip
              icon={<CheckCircle2 size={14} strokeWidth={2.15} />}
              label={`Bailleur ${overview.landlord.signed ? "signé" : "à signer"}`}
              done={overview.landlord.signed}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              alignItems: "center",
              gap: 14,
              justifySelf: "end",
              width: "100%",
            }}
          >
            <div>
              <div
                style={{
                  height: 7,
                  background: progressTone.track,
                  borderRadius: 999,
                  overflow: "hidden",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
                }}
              >
                <div
                  style={{
                    width: progressWidth,
                    minWidth: progressPercent > 0 ? 10 : 0,
                    height: "100%",
                    borderRadius: 999,
                    background: progressTone.fill,
                    transition: "width 220ms ease",
                    boxShadow: "0 1px 3px rgba(16,24,40,0.04)",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#73819A",
                whiteSpace: "nowrap",
                letterSpacing: "-0.014em",
              }}
            >
              Progression : {progressPercent}%
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: `1px solid rgba(26,39,66,0.05)`,
          paddingTop: 22,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 380px" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.11em",
              textTransform: "uppercase",
              color: "#A2ACBC",
              marginBottom: 14,
            }}
          >
            {isCompleted ? "Résumé dossier" : "Prochaine action recommandée"}
          </div>

          <div
            style={{
              fontSize: 16.5,
              lineHeight: 1.58,
              color: COLORS.navyStrong,
              fontWeight: 800,
              maxWidth: 820,
            }}
          >
            {isCompleted
              ? "Toutes les signatures requises ont été recueillies. Les documents finaux sont disponibles au téléchargement."
              : recommendedActionLabel}
          </div>
        </div>

        {!isCompleted ? (
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <PrimaryButton
              onClick={onSendAllRemainingLinks}
              disabled={!canSendAllRemainingLinks}
            >
              Envoyer tous les liens restants
            </PrimaryButton>

            <SecondaryButton
              onClick={onStartNextOnSite}
              disabled={!canStartNextOnSite}
            >
              Lancer la prochaine signature sur place
            </SecondaryButton>
          </div>
        ) : null}
      </div>
    </section>
  );
}