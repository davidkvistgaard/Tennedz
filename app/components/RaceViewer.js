"use client";
import { commentaryText } from "../../lib/race/commentary.mjs";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import RaceScene from "./RaceScene";
import StageProfileChart from "./StageProfileChart";
import RiderAvatar from "./RiderAvatar";
import {
  formatGap,
  nextMoment,
  replayFrame,
  visibleMoments,
} from "../../lib/race/replay.mjs";
import { routeAt, terrainLabels } from "../../lib/race/route.mjs";
import { useAuth } from "./AuthProvider";

export default function RaceViewer({ run, teamId }) {
  const replay = run.replay,
    distance = replay.route.distance;
  const storageKey = `pelotonia-replay-v1:${run.event_id}:${run.division_index}`;
  const { session } = useAuth();
  const own = replay.roster.filter((r) => r.team_id === teamId),
    captain = own.find((r) => r.captain);
  const [km, setKm] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [focusId, setFocusId] = useState(captain?.id || null);
  const [restored, setRestored] = useState(false),
    [resumeAt, setResumeAt] = useState(0);
  const saved = useRef(0);
  useEffect(() => {
    try {
      const value = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(value) && value > 0)
        setResumeAt(Math.min(value, distance));
    } catch {}
    setRestored(true);
  }, [storageKey, distance]);
  useEffect(() => {
    if (!playing) return;
    let previous = null,
      handle;
    const step = (time) => {
      if (previous !== null) {
        const delta = Math.min((time - previous) / 1000, 0.1);
        setKm((current) =>
          Math.min(distance, current + (delta * speed * distance) / 180),
        );
      }
      previous = time;
      handle = requestAnimationFrame(step);
    };
    handle = requestAnimationFrame(step);
    return () => cancelAnimationFrame(handle);
  }, [playing, speed, distance]);
  useEffect(() => {
    if (km >= distance) setPlaying(false);
    if (
      restored &&
      (Math.abs(km - saved.current) > 1 || km === distance) &&
      km > 0
    ) {
      try {
        localStorage.setItem(storageKey, String(km));
        if (km === distance)
          localStorage.setItem(`pelotonia-watched:${run.event_id}`, "true");
      } catch {}
      saved.current = km;
    }
  }, [km, distance, storageKey, restored, run.event_id]);
  const frame = useMemo(() => replayFrame(replay, km), [replay, km]);
  const moments = useMemo(() => visibleMoments(replay, km), [replay, km]);
  const terrain = routeAt(replay.route, km),
    finished = km >= distance;
  const currentRider = own.find((r) => r.id === focusId) || captain;
  const portrait = (session?.riders || []).find(
    (r) => r.id === currentRider?.id,
  );
  const focusGroup = frame.groups.find((g) =>
    g.riders.includes(currentRider?.id),
  );
  function jump(value) {
    setKm(Math.max(0, Math.min(distance, value)));
  }
  return (
    <div className="replay-layout">
      <section className="replay-main">
        <div className="race-titlebar">
          <div>
            <p className="eyebrow">
              {finished ? "Finished" : "Race day · replay"} · Division{" "}
              {run.division_index}
            </p>
            <h1>{replay.route.name}</h1>
          </div>
          <div className="distance-display">
            <strong>{Math.max(0, distance - km).toFixed(1)}</strong>
            <span>km to go</span>
          </div>
        </div>
        <div className="race-conditions">
          <span>{terrainLabels[terrain.terrain]}</span>
          <span>{replay.weather?.temp_c ?? "—"} °C</span>
          <span>Wind {replay.weather?.wind_kph ?? "—"} km/h</span>
          <span>
            {Number(replay.weather?.precipitation_mm) > 0
              ? "Rain on the route"
              : "Dry conditions"}
          </span>
        </div>
        <RaceScene
          frame={frame}
          roster={replay.roster}
          teamId={teamId}
          focusId={focusId}
          weather={replay.weather}
          finished={finished}
        />
        <section className="replay-controls" aria-label="Playback">
          <div className="control-row">
            <button
              className="btn primary"
              onClick={() => {
                if (finished) jump(0);
                setPlaying(!playing);
              }}
            >
              {playing ? "Pause" : finished ? "Watch again" : "▶ Play"}
            </button>
            <button
              className="btn"
              onClick={() => jump(nextMoment(replay, km))}
              disabled={finished}
            >
              Next moment →
            </button>
            <label className="speed-control">
              Tempo
              <select
                aria-label="Playback speed"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value={1}>1×</option>
                <option value={2}>2×</option>
                <option value={4}>4×</option>
                <option value={8}>8×</option>
              </select>
            </label>
            <button
              className="text-button"
              onClick={() => {
                setPlaying(false);
                jump(0);
              }}
            >
              From the start
            </button>
          </div>
          {resumeAt > 0 && km === 0 && (
            <button
              className="text-button resume-button"
              onClick={() => {
                jump(resumeAt);
                setResumeAt(0);
              }}
            >
              Resume from your last viewing · km {resumeAt.toFixed(1)}
            </button>
          )}
          <label className="sr-only" htmlFor="replay-position">
            Playback position
          </label>
          <input
            id="replay-position"
            className="replay-range"
            type="range"
            min="0"
            max={distance}
            step="0.1"
            value={km}
            onChange={(e) => jump(Number(e.target.value))}
            aria-valuetext={`Kilometre ${km.toFixed(1)} of ${distance}`}
          />
          <div className="control-footnote">
            <span>Start</span>
            <span>The whole race has been calculated. You control only the playback.</span>
            <span>Finish</span>
          </div>
        </section>
        <section className="card profile-panel">
          <div className="panel-heading">
            <h2>The road to the finish</h2>
            <span>
              {replay.route.ascent.toLocaleString("en-GB")} m of climbing
            </span>
          </div>
          <StageProfileChart
            stage={run.stage_snapshot}
            selectedKm={km}
            onSelectKm={jump}
          />
        </section>
        <section className="card commentary-panel">
          <div className="panel-heading">
            <h2>Race commentary</h2>
            <span>{moments.length} moments</span>
          </div>
          <ol className="race-feed">
            {moments
              .slice(-6)
              .reverse()
              .map((moment, i) => (
                <li key={moment.id} className={i === 0 ? "latest" : ""}>
                  <span className="feed-km">
                    {moment.km.toFixed(0)}
                    <small>km</small>
                  </span>
                  <p>{commentaryText(moment.text)}</p>
                  {moment.rider_ids?.some((id) =>
                    own.some((r) => r.id === id),
                  ) && <span className="own-chip">Your team</span>}
                </li>
              ))}
          </ol>
        </section>
        {finished && (
          <section className="card finish-panel">
            <p className="eyebrow">The race is decided</p>
            <h2>
              {
                replay.roster.find((r) => r.id === replay.finish[0]?.rider_id)
                  ?.name
              }{" "}
              wins
            </h2>
            <p>
              {captain
                ? `Your captain ${captain.name} finishes in position ${replay.finish.find((r) => r.rider_id === captain.id)?.position}.`
                : "See the division placings and points."}
            </p>
            <Link
              className="btn primary"
              href={`/team/results/${run.event_id}?division=${run.division_index}`}
            >
              View results and points →
            </Link>
          </section>
        )}
      </section>
      <aside className="replay-sidebar">
        <section className="card captain-panel">
          <p className="eyebrow">
            {currentRider?.captain ? "Your captain" : "Your focus"}
          </p>
          {currentRider ? (
            <>
              <RiderAvatar
                rider={
                  portrait || {
                    id: currentRider.id,
                    name: currentRider.name,
                    gender: currentRider.gender,
                    nationality: currentRider.nationality,
                  }
                }
                size={112}
              />
              <h2>{currentRider.name}</h2>
              <p className="captain-gap">
                {focusGroup?.gap > 0.5
                  ? formatGap(focusGroup.gap)
                  : "With the leaders"}
              </p>
              <p className="small">
                {focusGroup?.riders.length || 0} riders in the group
              </p>
            </>
          ) : (
            <p>
              Your team is not competing in this division. You are watching as
              a spectator.
            </p>
          )}
          <button className="text-button" onClick={() => setFocusId(null)}>
            Show all groups
          </button>
        </section>
        {!!own.length && (
          <section className="card roster-panel">
            <div className="panel-heading">
              <h2>Your team</h2>
              <span>{own.length} riders</span>
            </div>
            {own.map((r) => {
              const group = frame.groups.find((g) => g.riders.includes(r.id));
              return (
                <button
                  className={`replay-rider ${focusId === r.id ? "active" : ""}`}
                  key={r.id}
                  onClick={() => setFocusId(r.id)}
                  aria-pressed={focusId === r.id}
                >
                  <span className="rider-dot">{r.captain ? "★" : "●"}</span>
                  <span>
                    {r.name}
                    <small>{r.captain ? "Captain" : "Rider"}</small>
                  </span>
                  <strong>
                    {group?.gap > 0.5 ? formatGap(group.gap) : "Front"}
                  </strong>
                </button>
              );
            })}
          </section>
        )}
        <section className="card groups-panel">
          <div className="panel-heading">
            <h2>On the road</h2>
            <span>{frame.groups.length} groups</span>
          </div>
          {frame.groups.slice(0, 8).map((g, i) => (
            <div className="group-row" key={i}>
              <span>{i === 0 ? "Leaders" : `Group ${i + 1}`}</span>
              <strong>{g.riders.length}</strong>
              <span>{i === 0 ? "—" : formatGap(g.gap)}</span>
            </div>
          ))}
          {frame.groups.length > 8 && (
            <p className="small">
              + {frame.groups.length - 8} groups further back
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
