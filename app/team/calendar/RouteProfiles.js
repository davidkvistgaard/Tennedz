"use client";

import { useEffect, useState } from "react";
import StageProfileChart from "../../components/StageProfileChart";
import { normalizeRoute, routeAt } from "../../../lib/race/route.mjs";

export default function RouteProfiles({ race }) {
  const [profiles, setProfiles] = useState(null);
  const [stageNo, setStageNo] = useState(race.available[0]);
  const [distance, setDistance] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/calendar-route-profiles/2027/race-${race.index}.json`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error("Profile request failed.");
        return response.json();
      })
      .then(setProfiles)
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [race.index]);

  if (error) return <p role="alert">Could not load the route profiles. Close and reopen this race to retry.</p>;
  if (!profiles) return <p role="status">Loading route profiles…</p>;

  const profile = profiles.find(item => item.no === stageNo);
  if (!profile) return <p role="status">This stage profile is pending.</p>;

  const stage = { name: race.name, distance_km: profile.km, profile_points: profile.points, keypoints: profile.markers };
  const route = normalizeRoute(stage);
  const position = routeAt(route, distance);
  const format = value => value.toLocaleString("en-GB", { maximumFractionDigits: 1 });
  const stageRace = race.format === "stage";

  return <div className="programme-profile">
    {stageRace && <div className="programme-stages" role="group" aria-label="Stage profiles">
      {Array.from({length: Math.max(race.expected_stages ?? 0, ...race.available)}, (_, index) => index + 1).map(number => {
        const available = race.available.includes(number);
        return <button type="button" key={number} aria-pressed={number === stageNo}
          aria-label={available ? `Stage ${number}` : `Stage ${number}, profile pending`}
          disabled={!available} onClick={() => { setStageNo(number); setDistance(0); }}>{number}</button>;
      })}
    </div>}
    <h4>{stageRace ? `Stage ${stageNo} elevation profile` : "Elevation profile"}</h4>
    <p className="programme-profile-note">
      {profile.year} route reference · {profile.type === "image"
        ? "Approximate chart trace"
        : profile.publishedKm ? "Calibrated to published distance" : "GPX distance awaiting verification"}
    </p>
    <StageProfileChart stage={stage} height={190} selectedKm={distance} onSelectKm={setDistance}/>
    <label className="programme-scrubber">
      <span>Distance along the profile</span>
      <input type="range" min="0" max={profile.km} step="any" value={distance}
        onChange={event => setDistance(Number(event.target.value))}/>
      <output>{format(position.km)} km · {position.elevation} m</output>
    </label>
    <a href={profile.source} target="_blank" rel="noreferrer">Route source ↗</a>
  </div>;
}
