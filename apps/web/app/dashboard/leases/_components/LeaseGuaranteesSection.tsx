"use client";

import Link from "next/link";
import { Shield } from "lucide-react";

type Props = {
  leaseId: string;
};

export default function LeaseGuaranteesSection({ leaseId }: Props) {
  return (
    <section style={sectionStyle}>
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>Garanties</div>
          <div style={subtitleStyle}>
            La gestion des garanties (par locataire) se fait sur une page dédiée.
          </div>
        </div>

        <Link href={`/guarantees/${leaseId}`}>
          <button style={buttonStyle}>
            <Shield size={14} />
            Gérer les garanties
          </button>
        </Link>
      </div>
    </section>
  );
}

const sectionStyle: React.CSSProperties = {
  border: "1px solid rgba(27,39,64,0.06)",
  borderRadius: 20,
  background: "#fff",
  padding: 18,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const titleStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#17233A",
};

const subtitleStyle: React.CSSProperties = {
  color: "#667085",
  fontSize: 13,
  marginTop: 4,
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(52,103,235,0.10)",
  background: "#3467EB",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};