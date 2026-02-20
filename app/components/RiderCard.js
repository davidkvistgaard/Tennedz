"use client";

import { Pill, RoleTag, StatRow } from "./ui";

function bestRole(r) {
  const s = Number(r.sprint ?? 0);
  const m = Number(r.mountain ?? 0);
  const t = Number(r.timetrial ?? 0);
  const c = Number(r.cobbles ?? 0);

  const max = Math.max(s, m, t, c);
  if (max === s) return "Sprinter";
  if (max === m) return "Klatrer";
  if (max === t) return "TT";
  if (max === c) return "Brosten";
  return "Allround";
}

function fmtNat(n) {
  if (!n) return "";
  return String(n).toUpperCase();
}

export default function RiderCard({ r, selected, onClick, disabled }) {
  const role = bestRole(r);
  const injured = r.injury_until && new Date(r.injury_until) > new Date();

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        textAlign: "left",
        borderRadius: 18,
        border: "1px solid var(--border)",
        background: selected ? "linear-gradient(90deg, rgba(124,255,107,0.20), rgba(77,214,255,0.14))" : "rgba(0,0,0,0.25)",
        color: "var(--text)",
        padding: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: injured ? 0.7 : 1
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 14 }}>
            {r.name}
            <span style={{ fontWeight: 700, opacity: 0.75, marginLeft: 8 }}>
              {r.gender === "F" ? "♀" : "♂"} {fmtNat(r.nationality)}
              {injured ? " · SKADET" : ""}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <RoleTag role={role} />
            <Pill tone={selected ? "accent" : "default"}>{selected ? "Valgt" : "Klik for at vælge"}</Pill>
          </div>
        </div>

        <div style={{ display: "grid", gap: 6, minWidth: 120 }}>
          <StatRow label="Form" value={r.form ?? 0} highlight />
          <StatRow label="Fatigue" value={r.fatigue ?? 0} />
        </div>
      </div>

      <div className="hr" style={{ margin: "12px 0" }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <StatRow label="Sprint" value={r.sprint} highlight={role === "Sprinter"} />
        <StatRow label="Mountain" value={r.mountain} highlight={role === "Klatrer"} />
        <StatRow label="TT" value={r.timetrial} highlight={role === "TT"} />
        <StatRow label="Cobbles" value={r.cobbles} highlight={role === "Brosten"} />
        <StatRow label="Endurance" value={r.endurance} />
        <StatRow label="Strength" value={r.strength} />
      </div>
    </button>
  );
}
