"use client";

export function SectionHeader({ title, subtitle, right }) {
  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "space-between", flexWrap: "wrap", alignItems: "end" }}>
      <div>
        <div className="h2" style={{ fontWeight: 1000 }}>{title}</div>
        {subtitle ? <div className="small" style={{ marginTop: 4 }}>{subtitle}</div> : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

export function Pill({ children, tone = "default" }) {
  const style =
    tone === "accent"
      ? { borderColor: "rgba(124,255,107,0.35)", background: "rgba(124,255,107,0.10)", color: "var(--text)" }
      : tone === "info"
      ? { borderColor: "rgba(77,214,255,0.35)", background: "rgba(77,214,255,0.10)", color: "var(--text)" }
      : tone === "danger"
      ? { borderColor: "rgba(255,77,77,0.35)", background: "rgba(255,77,77,0.10)", color: "var(--text)" }
      : {};

  return (
    <span className="badge" style={{ ...style }}>
      {children}
    </span>
  );
}

export function StatRow({ label, value, highlight = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span className="small">{label}</span>
      <span style={{ fontWeight: highlight ? 1000 : 800, color: highlight ? "var(--accent)" : "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}

export function RoleTag({ role }) {
  const tone =
    role === "Sprinter" ? "accent" :
    role === "Klatrer" ? "info" :
    role === "TT" ? "info" :
    role === "Brosten" ? "accent" :
    "default";

  return <Pill tone={tone}>{role}</Pill>;
}
