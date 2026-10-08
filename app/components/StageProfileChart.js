"use client";
import { useId } from "react";
import { normalizeRoute, routeAt, clamp } from "../../lib/race/route.mjs";

export default function StageProfileChart({
  stage,
  height = 145,
  onSelectKm,
  selectedKm,
}) {
  const id = useId().replace(/:/g, "");
  let route;
  try {
    route = normalizeRoute(stage);
  } catch {
    return <p className="small">The route profile is not available yet.</p>;
  }
  const min = Math.min(...route.points.map((p) => p[1])),
    max = Math.max(...route.points.map((p) => p[1]));
  const x = (km) => 22 + (km / route.distance) * 956,
    y = (elevation) =>
      height -
      25 -
      ((elevation - min) / Math.max(80, max - min)) * (height - 62);
  const line = route.points
      .map(([km, e], i) => `${i ? "L" : "M"}${x(km)} ${y(e)}`)
      .join(" "),
    position = selectedKm == null ? null : clamp(selectedKm, 0, route.distance);
  const selected = position == null ? null : routeAt(route, position);
  return (
    <div className="stage-chart">
      <svg
        viewBox={`0 0 1000 ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`${route.distance} kilometer, ${route.ascent} m of climbing. ${selected ? `Position ${position.toFixed(1)} km, ${selected.elevation} metres above sea level.` : ""}`}
      >
        <defs>
          <linearGradient id={`profile-${id}`} x2="0" y2="1">
            <stop stopColor="#a3b78e" />
            <stop offset="1" stopColor="#e6ecd9" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1="22"
            x2="978"
            y1={height - 25 - t * (height - 50)}
            y2={height - 25 - t * (height - 50)}
            stroke="#e7e6d8"
            strokeDasharray="3 7"
          />
        ))}
        <path
          d={`${line}L978 ${height - 24}H22Z`}
          fill={`url(#profile-${id})`}
        />
        <path d={line} stroke="#567549" strokeWidth="2.5" fill="none" />
        {route.keypoints.map((k, i) => (
          <g key={i}>
            <line
              x1={x(k.km)}
              x2={x(k.km)}
              y1="16"
              y2={y(routeAt(route, k.km).elevation)}
              stroke="#919c77"
              strokeDasharray="2 4"
            />
            <circle
              cx={x(k.km)}
              cy="17"
              r="5"
              fill={
                k.kind === "FINISH"
                  ? "#b18b36"
                  : k.kind === "COBBLES"
                    ? "#86745f"
                    : "#71855e"
              }
            />
          </g>
        ))}
        {selected && (
          <g>
            <line
              x1={x(position)}
              x2={x(position)}
              y1="13"
              y2={height - 22}
              stroke="#b38730"
              strokeWidth="2"
            />
            <circle
              cx={x(position)}
              cy={y(selected.elevation)}
              r="5"
              fill="#d4b259"
              stroke="#fffdf6"
              strokeWidth="2"
            />
          </g>
        )}
        {onSelectKm && (
          <rect
            x="22"
            y="0"
            width="956"
            height={height}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onSelectKm(
                clamp(
                  ((event.clientX - rect.left) / rect.width) * route.distance,
                  0,
                  route.distance,
                ),
              );
            }}
          />
        )}
      </svg>
      <div className="profile-scale">
        <span>Start · 0 km</span>
        <span>
          {min}–{max} m above sea level
        </span>
        <span>{route.distance} km · Finish</span>
      </div>
    </div>
  );
}
