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
    return <p>Der mangler en gyldig ruteprofil.</p>;
  }
  const location = routeAt(route, km),
    advice = routeAdvice(route);
  return (
    <section className="card profile-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Lær ruten at kende</p>
          <h2>{route.name}</h2>
        </div>
        <span>
          {route.distance} km · {route.ascent} hm
        </span>
      </div>
      <StageProfileChart stage={stage} selectedKm={km} onSelectKm={setKm} />
      <p className="route-advice">
        {advice.description}. Form og træthed påvirker præstationen; rating
        bruges til divisionerne.
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
        Udforsk ruten
        <input
          className="replay-range"
          aria-label="Kilometer på ruten"
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
        {terrainLabels[location.terrain]} · hældning {location.gradient} %
      </p>
    </section>
  );
}
