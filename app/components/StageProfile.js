function terrainLabel(t) {
  const x = String(t || "").toLowerCase();
  if (x.includes("mount")) return "Mountain";
  if (x.includes("hill")) return "Hills";
  if (x.includes("cobbl")) return "Cobbles";
  if (x.includes("gravel")) return "Gravel";
  return "Flat";
}

export default function StageProfile({ stage }) {
  // stage: { name, distance_km, profile (object) }
  const profile = stage?.profile || null;
  const segments = profile?.segments || [];
  const keyPoints = profile?.key_points || [];

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>{stage?.name || "Etape"}</div>
      <div style={{ marginTop: 6, opacity: 0.85 }}>
        <b>Distance:</b> {stage?.distance_km ?? "?"} km
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700 }}>Profil (segments)</div>
        {segments.length === 0 ? (
          <div style={{ opacity: 0.7, marginTop: 6 }}>Ingen segments fundet.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 8 }}>
            {segments.map((s, idx) => (
              <div key={idx} style={{ border: "1px solid #f0f0f0", borderRadius: 12, padding: 10 }}>
                <div style={{ fontWeight: 700 }}>{terrainLabel(s.terrain)}</div>
                <div style={{ opacity: 0.85 }}>Km: {s.km}</div>
                {s.wind_exposure != null ? (
                  <div style={{ opacity: 0.75, fontSize: 13 }}>Wind exposure: {Number(s.wind_exposure).toFixed(2)}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700 }}>Key points</div>
        {keyPoints.length === 0 ? (
          <div style={{ opacity: 0.7, marginTop: 6 }}>Ingen key points.</div>
        ) : (
          <ul style={{ marginTop: 6 }}>
            {keyPoints.map((p, idx) => (
              <li key={idx}>
                <b>Km {p.km}</b>: {p.name || "Point"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
