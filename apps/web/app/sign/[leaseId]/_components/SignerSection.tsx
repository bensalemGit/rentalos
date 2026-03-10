import React, { useEffect, useRef } from "react";
import type { SignerTask } from "../_types/signature-center.types";
import { SignerCard } from "./SignerCard";

type SignerSectionProps = {
  tasks: SignerTask[];
  activeTaskId: string | null;
  enableAutoScroll: boolean;
  onStartOnSite: (task: SignerTask) => void;
  onSendEmail: (task: SignerTask) => void;
  onResendEmail: (task: SignerTask) => void;
  onDownloadSigned: (task: SignerTask) => void;
  onPrepare: (task: SignerTask) => void;
};

const textSoft = "#667085";

export function SignerSection({
  tasks,
  activeTaskId,
  enableAutoScroll,
  onStartOnSite,
  onSendEmail,
  onResendEmail,
  onDownloadSigned,
  onPrepare,
}: SignerSectionProps) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!enableAutoScroll) return;
    if (!activeTaskId) return;

    const node = cardRefs.current[activeTaskId];
    if (!node) return;

    const id = window.setTimeout(() => {
      node.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 60);

    return () => window.clearTimeout(id);
  }, [activeTaskId, enableAutoScroll]);

  return (
    <section
      style={{
        display: "grid",
        gap: 20,
        alignItems: "start",
        alignContent: "start",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {tasks.length === 0 ? (
        <div
          style={{
            background: "linear-gradient(180deg,#FFFFFF 0%,#FCFDFF 100%)",
            border: "1px solid rgba(26,39,66,0.06)",
            borderRadius: 24,
            padding: 20,
            color: textSoft,
            boxShadow: "0 8px 18px rgba(31,41,64,0.028)",
          }}
        >
          Aucun signataire à afficher.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: enableAutoScroll ? "repeat(2, minmax(0, 1fr))" : "1fr",
            gap: 18,
            alignItems: "stretch",
            alignContent: "start",
            gridAutoRows: enableAutoScroll ? "1fr" : "auto",
          }}
        >
          {tasks.map((task) => (
            <SignerCard
              key={task.id}
              ref={(node) => {
                cardRefs.current[task.id] = node;
              }}
              task={task}
              isActive={activeTaskId === task.id}
              onStartOnSite={onStartOnSite}
              onSendEmail={onSendEmail}
              onResendEmail={onResendEmail}
              onDownloadSigned={onDownloadSigned}
              onPrepare={onPrepare}
            />
          ))}
        </div>
      )}
    </section>
  );
}