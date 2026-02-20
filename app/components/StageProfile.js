"use client";

import { useMemo, useState } from "react";
import StageProfileChart from "./StageProfileChart";
import { Pill } from "./ui";

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function buildTacticMoments(stage) {
  const dist = Number(stage?.distance_km ?? 0);
  const keypoints = Array.isArray(stage?.keypoints) ? stage.keypoints : [];

  const ticks = [];
  for (let km = 0; km <= dist; km += 5) {
    ticks.push({ km, label: `${km} km`, kind: "TICK" });
  }

  const moments = uniqBy(
    [...ticks, ...keypoints.map(k => ({ km: Number(k.km), label: k.label || `${k.km} km`, kind: k.kind || "KEY" }))],
    (x) => `${x.km}:${x.kind}:${x.label}`
  )
    .filter(x => Number.isFinite(x.km))
    .sort((a, b) => a.km - b.km);

  return moments;
}

export default function StageProfile({ stage, mode = "overview" }) {
  const [selectedKm, setSelectedKm] = useState(null);

  const moments = useMemo(() => buildTacticMoments(stage), [stage]);
  const dist = Number(stage?.distance_km ?? 0);

  const selectedMoment = useMemo(() => {
    if (selectedKm == null) return null;
    // find nearest moment
    let best = null;
    let bestD = Infinity;
    for (const m of moments) {
      const d = Math.abs(m.km - selectedKm);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }, [selectedKm, moments]);

  const country = (stage?.country_code || "FR").toUpperCase();

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "start" }}>
        <div>
          <div className="h2" style={{ fontWeight: 1000 }}>{stage?.name || "Etape"}</div>
          <div className="small" style={{ marginTop: 4 }}>
            {dist} km · Land: <b style={{ color: "var(--text)" }}>{country}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Pill tone="info">{mode}</Pill>
          <Pill tone="accent">{moments.length} momenter</Pill>
        </div>
      </div>

      <div className="hr" />

      <StageProfileChart stage={stage} selectedKm={selectedKm} onSelectKm={setSelectedKm} />

      <div className="hr" />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className="small">
          Klik på profilen eller markører for at vælge et km-punkt. (Senere: her sætter vi taktik).
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Pill tone={selectedMoment?.kind === "KOM" ? "info" : selectedMoment?.kind === "COBBLES" ? "accent" : "default"}>
            {selectedMoment ? `Valgt: ${selectedMoment.label} (km ${selectedMoment.km})` : "Intet valgt"}
          </Pill>
        </div>
      </div>

      {/* Tactic moments list */}
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {moments.map((m, idx) => {
          const active = selectedMoment && m.km === selectedMoment.km && m.label === selectedMoment.label;
          return (
            <button
              key={idx}
              className="pillBtn"
              onClick={() => setSelectedKm(m.km)}
              style={{
                justifyContent: "space-between",
                background: active ? "linear-gradient(90deg, rgba(124,255,107,0.18), rgba(77,214,255,0.12))" : "rgba(0,0,0,0.25)",
                borderColor: active ? "rgba(124,255,107,0.35)" : "var(--border)"
              }}
            >
              <span style={{ fontWeight: 900 }}>{m.label}</span>
              <span className="badge" style={{ opacity: 0.9 }}>{m.kind}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
