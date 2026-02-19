// app/components/StageProfile.js
"use client";

import StageProfileChart from "./StageProfileChart";

function uniqSorted(nums) {
  const set = new Set(nums.filter((n) => Number.isFinite(n)));
  return [...set].sort((a, b) => a - b);
}

function normalizeKeyType(t) {
  const x = String(t || "").toLowerCase();
  if (x.includes("sprint")) return "Sprint";
  if (x.includes("kom") || x.includes("climb") || x.includes("mount")) return "Climb";
  if (x.includes("cobbl") || x.includes("pave") || x.includes("sector")) return "Cobbles";
  if (x.includes("gravel")) return "Gravel";
  return "Point";
}

export default function StageProfile({ stage }) {
  const profile = stage?.profile || {};
  const distanceKm = Number(stage?.distance_km ?? 0) || 0;
  const keyPoints = Array.isArray(profile?.key_points) ? profile.key_points : [];

  // Tactic points:
  // - every 5 km
  // - all key points
  // - finale: 5 / 3 / 1 / 0 km to go
  const every5 = [];
  for (let km = 0; km <= Math.round(distanceKm); km += 5) every5.push(km);

  const keyKms = keyPoints.map((p) => Number(p.km));
  const finale = [
    Math.max(0, Math.round(distanceKm - 5)),
    Math.max(0, Math.round(distanceKm - 3)),
    Math.max(0, Math.round(distanceKm - 1)),
    Math.round(distanceKm)
  ];

  const tacticPoints = uniqSorted([...every5, ...keyKms, ...finale]).filter((km) => km >= 0 && km <= Math.round(distanceKm));

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <StageProfileChart stage={stage} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
          <div style={{ fontWeight: 800 }}>Key points</div>
          {keyPoints.length === 0 ? (
            <div style={{ marginTop: 8, opacity: 0.7 }}>Ingen key points endnu.</div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {keyPoints
                .slice()
                .sort((a, b) => Number(a.km) - Number(b.km))
                .map((p, idx) => (
                  <div key={idx} style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 10 }}>
                    <div style={{ fontWeight: 800 }}>
                      Km {p.km} · {normalizeKeyType(p.type || p.kind || p.name)}
                    </div>
                    <div style={{ opacity: 0.85 }}>{p.name || "Point"}</div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
          <div style={{ fontWeight: 800 }}>Taktik-punkter (MVP)</div>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Her viser vi steder, hvor man kan sætte/ændre taktik. (Vi binder det til rigtige “orders” senere.)
          </div>

          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tacticPoints.map((km) => {
              const isFinal = km >= Math.round(distanceKm - 5);
              return (
                <span
                  key={km}
                  title={isFinal ? "Finale-zone" : "Taktikpunkt"}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid #ddd",
                    background: isFinal ? "#111" : "white",
                    color: isFinal ? "white" : "black",
                    fontSize: 13,
                    fontWeight: 700
                  }}
                >
                  {km} km
                </span>
              );
            })}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
            *Finale-zone (sidste 5 km) bliver senere til: positionering → tog → spurt.
          </div>
        </div>
      </div>
    </div>
  );
}
