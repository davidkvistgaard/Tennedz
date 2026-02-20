"use client";

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function normalizePoints(profile_points) {
  // expects [[km,elev], ...]
  const pts = Array.isArray(profile_points) ? profile_points : [];
  const cleaned = pts
    .map(p => Array.isArray(p) ? { km: Number(p[0]), elev: Number(p[1]) } : null)
    .filter(Boolean)
    .filter(p => Number.isFinite(p.km) && Number.isFinite(p.elev))
    .sort((a, b) => a.km - b.km);

  if (cleaned.length < 2) {
    return [{ km: 0, elev: 0 }, { km: 1, elev: 0 }];
  }
  return cleaned;
}

function kindColor(kind) {
  const k = String(kind || "").toUpperCase();
  if (k === "KOM") return "rgba(77,214,255,0.95)";
  if (k === "COBBLES") return "rgba(124,255,107,0.95)";
  if (k === "FINISH") return "rgba(255,255,255,0.95)";
  return "rgba(255,255,255,0.65)";
}

export default function StageProfileChart({
  stage,
  height = 140,
  onSelectKm,
  selectedKm
}) {
  const pts = normalizePoints(stage?.profile_points);
  const dist = Number(stage?.distance_km ?? pts[pts.length - 1]?.km ?? 1);

  const elevs = pts.map(p => p.elev);
  const minE = Math.min(...elevs);
  const maxE = Math.max(...elevs);
  const pad = 18;
  const w = 1000; // virtual width for SVG viewBox
  const h = height;

  const x = (km) => pad + (clamp(km, 0, dist) / dist) * (w - pad * 2);
  const y = (elev) => {
    if (maxE === minE) return h / 2;
    const t = (elev - minE) / (maxE - minE);
    return pad + (1 - t) * (h - pad * 2);
  };

  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.km).toFixed(2)} ${y(p.elev).toFixed(2)}`).join(" ");

  const keypoints = Array.isArray(stage?.keypoints) ? stage.keypoints : [];

  const selectedX = selectedKm != null ? x(selectedKm) : null;

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: "block" }}>
        {/* background */}
        <rect x="0" y="0" width={w} height={h} rx="18" fill="rgba(0,0,0,0.22)" stroke="rgba(255,255,255,0.10)" />

        {/* area fill */}
        <path
          d={`${d} L ${x(dist).toFixed(2)} ${h - pad} L ${x(0).toFixed(2)} ${h - pad} Z`}
          fill="rgba(124,255,107,0.10)"
        />

        {/* main line */}
        <path d={d} fill="none" stroke="rgba(255,255,255,0.80)" strokeWidth="2.2" />

        {/* selected km vertical */}
        {selectedX != null ? (
          <line x1={selectedX} x2={selectedX} y1={pad} y2={h - pad} stroke="rgba(77,214,255,0.75)" strokeWidth="2" />
        ) : null}

        {/* keypoint markers */}
        {keypoints.map((k, idx) => {
          const km = Number(k.km ?? 0);
          const cx = x(km);
          const cy = pad + 8;
          const color = kindColor(k.kind);

          return (
            <g key={idx} onClick={() => onSelectKm?.(km)} style={{ cursor: "pointer" }}>
              <circle cx={cx} cy={cy} r="7" fill="rgba(0,0,0,0.55)" stroke={color} strokeWidth="2" />
              <circle cx={cx} cy={cy} r="2.5" fill={color} />
            </g>
          );
        })}

        {/* click overlay for selecting km */}
        <rect
          x={pad}
          y={pad}
          width={w - pad * 2}
          height={h - pad * 2}
          fill="transparent"
          onClick={(e) => {
            if (!onSelectKm) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const px = (e.clientX - rect.left) / rect.width; // 0..1
            onSelectKm(Math.round(px * dist));
          }}
          style={{ cursor: onSelectKm ? "crosshair" : "default" }}
        />
      </svg>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <span className="small">0 km</span>
        <span className="small">
          Elev: {Math.round(minE)}–{Math.round(maxE)} m
        </span>
        <span className="small">{dist} km</span>
      </div>
    </div>
  );
}
