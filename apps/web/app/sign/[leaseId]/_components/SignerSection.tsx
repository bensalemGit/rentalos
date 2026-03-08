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

const textStrong = "#172033";
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
    <section style={{ display: "grid", gap: 14 }}>
      {tasks.length === 0 ? (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #dde3ec",
            borderRadius: 20,
            padding: 18,
            color: textSoft,
            fontFamily:
              'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          Aucun signataire à afficher.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 18,
            alignItems: "start",
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