// app/components/StageProfileChart.js
"use client";

// Simple SVG stage profile chart.
// Supports:
// - stage.profile.elevation_points: [{ km, alt }]  (if you later add real data)
// - fallback: synth elevation curve from segments terrain (flat/hills/mountain/cobbles)
// - markers from stage.profile.key_points: [{ km, name, type }]

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function normalizeKeyType(t) {
  const x = String(t || "").toLowerCase();
  if (x.includes("sprint")) return "SPRINT";
  if (x.includes("kom") || x.includes("climb") || x.includes("mount")) return "CLIMB";
  if (x.includes("cobbl") || x.includes("pave") || x.includes("sector")) return "COBBLES";
  if (x.includes("gravel")) return "GRAVEL";
  return "POINT";
}

function terrainWeight(terrain) {
  const t = String(terrain || "").toLowerCase();
  if (t.includes("mount")) return 3.0;
  if (t.includes("hill")) return 1.8;
  if (t.includes("cobbl")) return 0.8;
  if (t.includes("gravel")) return 0.9;
  return 0.3; // flat
}

// Build fallback elevation points from segments
function buildSyntheticElevation(distanceKm, segments) {
  const pts = [];
  const total = Math.max(1, Math.round(distanceKm));
  let km = 0;
  let alt = 50; // baseline
  const segs = Array.isArray(segments) ? segments : [];

  // Expand segments into per-km weights
  const weights = [];
  let covered = 0;
  for (const s of segs) {
    const len = Math.max(1, Math.round(Number(s.km) || 0));
    const w = terrainWeight(s.terrain);
    for (let i = 0; i < len; i++) weights.push(w);
    covered += len;
  }
  // If segments don't cover full distance, pad as flat
  while (weights.length < total) weights.push(terrainWeight("flat"));
  // If too long, trim
  weights.length = total;

  // Make a smooth-ish curve
  for (km = 0; km <= total; km++) {
    const idx = clamp(km, 0, total - 1);
    const w = weights[idx] ?? 0.3;

    // deterministic “noise” based on km for variety (no randomness)
    const noise = Math.sin(km * 0.35) * 4 + Math.sin(km * 0.11) * 2;

    // altitude delta: hills/mountain create bigger bumps
    const delta = w * (6 + Math.sin(km * 0.22) * 5) + noise;

    alt = clamp(alt + delta * 0.35, 10, 600);
    pts.push({ km, alt });
  }
  return pts;
}

// Convert points to SVG path
function toPath(points, width, height, padding = 18) {
  if (!points || points.length < 2) return "";

  const minKm = points[0].km;
  const maxKm = points[points.length - 1].km;

  let minAlt = Infinity;
  let maxAlt = -Infinity;
  for (const p of points) {
    minAlt = Math.min(minAlt, p.alt);
    maxAlt = Math.max(maxAlt, p.alt);
  }
  // prevent flat line
  if (maxAlt - minAlt < 1) maxAlt = minAlt + 1;

  const x = (km) => {
    const t = (km - minKm) / (maxKm - minKm);
    return padding + t * (width - padding * 2);
  };
  const y = (alt) => {
    const t = (alt - minAlt) / (maxAlt - minAlt);
    return height - padding - t * (height - padding * 2);
  };

  let d = `M ${x(points[0].km).toFixed(2)} ${y(points[0].alt).toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${x(points[i].km).toFixed(2)} ${y(points[i].alt).toFixed(2)}`;
  }
  return { d, x, y, minAlt, maxAlt, minKm, maxKm };
}

function Marker({ x, y, label, kind }) {
  const shape = (() => {
    if (kind === "SPRINT") return { text: "S", bg: "#111", fg: "white" };
    if (kind === "CLIMB") return { text: "▲", bg: "#111", fg: "white" };
    if (kind === "COBBLES") return { text: "C", bg: "#111", fg: "white" };
    if (kind === "GRAVEL") return { text: "G", bg: "#111", fg: "white" };
    return { text: "•", bg: "#111", fg: "white" };
  })();

  return (
    <g>
      <circle cx={x} cy={y} r="7" fill={shape.bg} />
      <text x={x} y={y + 4} fontSize="10" textAnchor="middle" fill={shape.fg} fontWeight="700">
        {shape.text}
      </text>
      {label ? (
        <text x={x} y={y - 10} fontSize="11" textAnchor="middle" fill="#111">
          {label}
        </text>
      ) : null}
    </g>
  );
}

export default function StageProfileChart({ stage, height = 220 }) {
  const distanceKm = Number(stage?.distance_km ?? stage?.distanceKm ?? 0) || 0;
  const profile = stage?.profile || {};
  const segments = profile?.segments || [];
  const keyPoints = profile?.key_points || [];

  const elevation = Array.isArray(profile?.elevation_points) && profile.elevation_points.length >= 2
    ? profile.elevation_points.map((p) => ({ km: Number(p.km), alt: Number(p.alt) }))
    : buildSyntheticElevation(distanceKm, segments);

  const width = 980; // internal viewbox width
  const vpH = height;
  const padding = 18;

  const geom = toPath(elevation, width, vpH, padding);
  if (!geom) return null;

  // Build area under line
  const areaD = `${geom.d} L ${geom.x(geom.maxKm).toFixed(2)} ${(vpH - padding).toFixed(2)} L ${geom.x(geom.minKm).toFixed(2)} ${(vpH - padding).toFixed(2)} Z`;

  // Axis ticks: every 10 km (or 20 if long)
  const tickStep = distanceKm > 200 ? 20 : 10;
  const ticks = [];
  for (let km = 0; km <= Math.round(distanceKm); km += tickStep) ticks.push(km);

  const markers = (keyPoints || [])
    .map((p) => ({
      km: Number(p.km),
      name: String(p.name || ""),
      kind: normalizeKeyType(p.type || p.kind || p.name)
    }))
    .filter((m) => Number.isFinite(m.km));

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800 }}>{stage?.name || "Etapeprofil"}</div>
        <div style={{ opacity: 0.75 }}><b>{distanceKm}</b> km</div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${vpH}`}
        width="100%"
        height={vpH}
        style={{ marginTop: 10, display: "block", borderRadius: 12, background: "white" }}
      >
        {/* grid */}
        {[0.25, 0.5, 0.75].map((t, idx) => {
          const yy = vpH - padding - t * (vpH - padding * 2);
          return <line key={idx} x1={padding} x2={width - padding} y1={yy} y2={yy} stroke="#f0f0f0" />;
        })}

        {/* area */}
        <path d={areaD} fill="#9ad84b" opacity="0.9" stroke="none" />
        {/* line */}
        <path d={geom.d} fill="none" stroke="#2a2a2a" strokeWidth="2" />

        {/* x axis */}
        <line x1={padding} x2={width - padding} y1={vpH - padding} y2={vpH - padding} stroke="#111" strokeWidth="1" />

        {/* ticks */}
        {ticks.map((km) => {
          const xx = geom.x(km);
          return (
            <g key={km}>
              <line x1={xx} x2={xx} y1={vpH - padding} y2={vpH - padding + 6} stroke="#111" />
              <text x={xx} y={vpH - 2} fontSize="11" textAnchor="middle" fill="#111">
                {km}
              </text>
            </g>
          );
        })}

        {/* markers */}
        {markers.map((m, idx) => {
          const xx = geom.x(clamp(m.km, geom.minKm, geom.maxKm));
          // place marker slightly above line at that km
          // find nearest point
          const nearest = elevation[Math.round(clamp(m.km, 0, elevation.length - 1))] || elevation[0];
          const yy = geom.y(nearest.alt) - 2;

          const label = m.kind === "CLIMB" ? `${m.km} km` : ""; // keep minimal for MVP
          return <Marker key={idx} x={xx} y={yy} label={label} kind={m.kind} />;
        })}
      </svg>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
        *MVP: Kurven er syntetisk fra segments (senere kan vi bruge rigtige elevation_points fra GPX).
      </div>
    </div>
  );
}
