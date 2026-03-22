import React from "react";
import type { SignatureOverview } from "../_types/signature-center.types";
import { CheckCircle2, ShieldCheck, Users, Clock3 } from "lucide-react";
import { HeroChip, PremiumButton, SIGN_UI } from "./signature-ui";


type SignatureHeroProps = {
  overview: SignatureOverview;
  recommendedActionLabel: string;
  canSendAllRemainingLinks: boolean;
  canStartNextOnSite: boolean;
  onSendAllRemainingLinks: () => void;
  onStartNextOnSite: () => void;
};



function getProgressTone(progressPercent: number, remainingCount: number) {
  if (remainingCount === 0) {
    return {
      track: "#E7F5EF",
      fill: "#2FA36B",
    };
  }

  if (progressPercent >= 50) {
    return {
      track: "#F4ECDD",
      fill: "linear-gradient(90deg, #D39A3A 0%, #C6892B 100%)",
    };
  }

  return {
    track: "#EEF2F7",
    fill: "linear-gradient(90deg, #7F95C8 0%, #5D78BB 100%)",
  };
}



export function SignatureHero({
  overview,
  recommendedActionLabel,
  canSendAllRemainingLinks,
  canStartNextOnSite,
  onSendAllRemainingLinks,
  onStartNextOnSite,
}: SignatureHeroProps) {
  const progressPercent = Math.max(0, Math.min(100, overview.progressPercent || 0));
  const progressWidth = `${Math.max(progressPercent, progressPercent > 0 ? 8 : 0)}%`;
  const isCompleted = overview.remainingCount === 0;
  const progressTone = getProgressTone(progressPercent, overview.remainingCount);

  return (
    <section
      style={{
        borderRadius: SIGN_UI.radius.xl,
        border: "1px solid rgba(27,39,64,0.06)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.985) 0%, rgba(251,252,254,1) 100%)",
        boxShadow: "0 2px 6px rgba(16,24,40,0.04), 0 10px 24px rgba(16,24,40,0.022)",
        padding: 24,
        fontFamily: SIGN_UI.font,
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
            "radial-gradient(circle at 14% 0%, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.18) 34%, rgba(255,255,255,0) 64%)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gap: 18,
        }}
      >
    
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "#6E7C93",
              letterSpacing: "-0.01em",
            }}
          >
            Progression : {progressPercent}%
          </div>

          <HeroChip
            icon={<Clock3 size={14} strokeWidth={2.1} />}
            label={
              isCompleted
                ? "Dossier finalisé"
                : `${overview.remainingCount} signatures restantes`
            }
            done={isCompleted}
            empty={!isCompleted && overview.remainingCount <= 0}
          />
        </div>

        <div
          style={{
            height: 6,
            background: progressTone.track,
            borderRadius: 999,
            overflow: "hidden",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.75)",
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
              boxShadow: "0 1px 4px rgba(16,24,40,0.06)",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <HeroChip
            icon={<Users size={14} strokeWidth={2.1} />}
            label={`Locataires ${overview.tenants.signed}/${overview.tenants.total}`}
            done={
              overview.tenants.total > 0 &&
              overview.tenants.signed === overview.tenants.total
            }
            empty={overview.tenants.total === 0}
          />

          <HeroChip
            icon={<ShieldCheck size={14} strokeWidth={2.1} />}
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
            icon={<CheckCircle2 size={14} strokeWidth={2.1} />}
            label={`Bailleur ${overview.landlord.signed ? "signé" : "à signer"}`}
            done={overview.landlord.signed}
          />
        </div>

        <div
          style={{
            borderTop: `1px solid ${SIGN_UI.colors.line}`,
            paddingTop: 20,
            display: "grid",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#97A3B7",
            }}
          >
            {isCompleted ? "Résumé dossier" : "Prochaine action"}
          </div>

          <div
            style={{
              fontSize: 15,
              lineHeight: 1.55,
              color: "#1B2740",
              fontWeight: 600,
              maxWidth: 920,
              letterSpacing: "-0.015em",
            }}
          >
            {isCompleted
              ? "Toutes les signatures requises ont été recueillies. Les documents finaux sont disponibles au téléchargement."
              : recommendedActionLabel}
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
              <PremiumButton
                onClick={onSendAllRemainingLinks}
                disabled={!canSendAllRemainingLinks}
                variant="primary"
              >
                Envoyer tous les liens restants
              </PremiumButton>

              <PremiumButton
                onClick={onStartNextOnSite}
                disabled={!canStartNextOnSite}
                variant="secondary"
              >
                Lancer la prochaine signature sur place
              </PremiumButton>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}