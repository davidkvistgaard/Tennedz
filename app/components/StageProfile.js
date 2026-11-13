"use client";
import { useState } from "react";
import StageProfileChart from "./StageProfileChart";
import {
  normalizeRoute,
  routeAdvice,
  routeAt,
  terrainLabels,
} from "../../lib/race/route.mjs";

export default function StageProfile({ stage }) {
  const [km, setKm] = useState(0);
  let route;
  try {
    route = normalizeRoute(stage);
  } catch {
    return <p>A valid route profile is missing.</p>;
  }
  const location = routeAt(route, km),
    advice = routeAdvice(route);
  return (
    <section className="card profile-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Get to know the route</p>
          <h2>{route.name}</h2>
        </div>
        <span>
          {route.distance} km · {route.ascent} hm
        </span>
      </div>
      <StageProfileChart stage={stage} selectedKm={km} onSelectKm={setKm} />
      <p className="route-advice">
        {advice.description}. Form and fatigue affect performance; rating
        determines divisions.
      </p>
      <div className="route-keypoints">
        {route.keypoints.map((point, i) => (
          <button
            key={i}
            className="pillBtn"
            aria-pressed={km === point.km}
            onClick={() => setKm(point.km)}
          >
            {point.label}
            <span>{point.km} km</span>
          </button>
        ))}
      </div>
      <label className="small">
        Explore the route
        <input
          className="replay-range"
          aria-label="Kilometre on the route"
          type="range"
          min="0"
          max={route.distance}
          step="1"
          value={km}
          onChange={(e) => setKm(Number(e.target.value))}
        />
      </label>
      <p className="small">
        Km {km.toFixed(1)} · {location.elevation} m ·{" "}
        {terrainLabels[location.terrain]} · gradient {location.gradient} %
      </p>
    </section>
  );
}
