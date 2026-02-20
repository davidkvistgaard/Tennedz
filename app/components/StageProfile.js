"use client";

import { Pill } from "./ui";

function kmLabel(x) {
  return `${Math.round(x)} km`;
}

/**
 * stage snapshot example:
 * { distance_km: 150, profile_type: 'FLAT', keypoints: [{ km: 145, label: '5 km' }, ...] }
 */
export default function StageProfile({ stage }) {
  const dist = Number(stage?.distance_km ?? 0);
  const profile = stage?.profile_type || "FLAT";
  const keypoints = stage?.keypoints || [
    { km: Math.max(0, dist - 5), label: "5 km" },
    { km: Math.max(0, dist - 3), label: "3 km" },
    { km: Math.max(0, dist - 1), label: "1 km" }
  ];

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="h2" style={{ fontWeight: 1000 }}>{stage?.name || "Etape"}</div>
          <div className="small" style={{ marginTop: 4 }}>
            {dist} km · Profil: <b style={{ color: "var(--text)" }}>{profile}</b>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Pill tone="info">Keypoints</Pill>
          <Pill tone="accent">{keypoints.length}</Pill>
        </div>
      </div>

      <div className="hr" />

      {/* profile bar */}
      <div style={{ position: "relative", height: 18, borderRadius: 999, border: "1px solid var(--border)", background: "rgba(0,0,0,0.35)" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 999,
            background:
              profile === "MOUNTAIN"
                ? "linear-gradient(90deg, rgba(77,214,255,0.12), rgba(77,214,255,0.28))"
                : profile === "HILLS"
                ? "linear-gradient(90deg, rgba(124,255,107,0.10), rgba(124,255,107,0.22))"
                : "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.12))"
          }}
        />
        {keypoints.map((k, idx) => {
          const left = dist > 0 ? Math.max(0, Math.min(100, (k.km / dist) * 100)) : 0;
          return (
            <div key={idx} title={`${k.label} · ${kmLabel(k.km)}`}
              style={{
                position: "absolute",
                left: `calc(${left}% - 6px)`,
                top: -6,
                width: 12,
                height: 30,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.22)",
                background: "rgba(0,0,0,0.45)",
                boxShadow: "0 10px 20px rgba(0,0,0,0.25)"
              }}
            />
          );
        })}
      </div>

      {/* labels */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        <span className="small">0 km</span>
        <span className="small">{dist} km</span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {keypoints.map((k, idx) => (
          <Pill key={idx} tone="default">
            {k.label} · {kmLabel(k.km)}
          </Pill>
        ))}
      </div>
    </div>
  );
}
