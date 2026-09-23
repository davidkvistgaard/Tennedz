"use client";
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
              {finished ? "I mål" : "Løbsdag · afspilning"} · Division{" "}
              {run.division_index}
            </p>
            <h1>{replay.route.name}</h1>
          </div>
          <div className="distance-display">
            <strong>{Math.max(0, distance - km).toFixed(1)}</strong>
            <span>km til mål</span>
          </div>
        </div>
        <div className="race-conditions">
          <span>{terrainLabels[terrain.terrain]}</span>
          <span>{replay.weather?.temp_c ?? "—"} °C</span>
          <span>Vind {replay.weather?.wind_kph ?? "—"} km/t</span>
          <span>
            {Number(replay.weather?.precipitation_mm) > 0
              ? "Regn på ruten"
              : "Tørt føre"}
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
        <section className="replay-controls" aria-label="Afspilning">
          <div className="control-row">
            <button
              className="btn primary"
              onClick={() => {
                if (finished) jump(0);
                setPlaying(!playing);
              }}
            >
              {playing ? "Pause" : finished ? "Se igen" : "▶ Afspil"}
            </button>
            <button
              className="btn"
              onClick={() => jump(nextMoment(replay, km))}
              disabled={finished}
            >
              Næste øjeblik →
            </button>
            <label className="speed-control">
              Tempo
              <select
                aria-label="Afspilningshastighed"
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
              Fra start
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
              Fortsæt fra din sidste visning · km {resumeAt.toFixed(1)}
            </button>
          )}
          <label className="sr-only" htmlFor="replay-position">
            Position i afspilningen
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
            aria-valuetext={`Kilometer ${km.toFixed(1)} af ${distance}`}
          />
          <div className="control-footnote">
            <span>Start</span>
            <span>Hele løbet er beregnet. Du styrer kun visningen.</span>
            <span>Mål</span>
          </div>
        </section>
        <section className="card profile-panel">
          <div className="panel-heading">
            <h2>Vejen til mål</h2>
            <span>
              {replay.route.ascent.toLocaleString("da-DK")} højdemeter
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
            <h2>Fra løbet</h2>
            <span>{moments.length} hændelser</span>
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
                  <p>{moment.text}</p>
                  {moment.rider_ids?.some((id) =>
                    own.some((r) => r.id === id),
                  ) && <span className="own-chip">Dit hold</span>}
                </li>
              ))}
          </ol>
        </section>
        {finished && (
          <section className="card finish-panel">
            <p className="eyebrow">Løbet er afgjort</p>
            <h2>
              {
                replay.roster.find((r) => r.id === replay.finish[0]?.rider_id)
                  ?.name
              }{" "}
              vinder
            </h2>
            <p>
              {captain
                ? `Din kaptajn ${captain.name} slutter som nr. ${replay.finish.find((r) => r.rider_id === captain.id)?.position}.`
                : "Se placeringer og point fra divisionen."}
            </p>
            <Link
              className="btn primary"
              href={`/team/results/${run.event_id}?division=${run.division_index}`}
            >
              Se resultat og point →
            </Link>
          </section>
        )}
      </section>
      <aside className="replay-sidebar">
        <section className="card captain-panel">
          <p className="eyebrow">
            {currentRider?.captain ? "Din kaptajn" : "Dit fokus"}
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
                  : "Med helt fremme"}
              </p>
              <p className="small">
                {focusGroup?.riders.length || 0} ryttere i gruppen
              </p>
            </>
          ) : (
            <p>
              Dit hold deltager ikke i denne division. Du følger løbet som
              tilskuer.
            </p>
          )}
          <button className="text-button" onClick={() => setFocusId(null)}>
            Vis alle grupper
          </button>
        </section>
        {!!own.length && (
          <section className="card roster-panel">
            <div className="panel-heading">
              <h2>Dit hold</h2>
              <span>{own.length} ryttere</span>
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
                    <small>{r.captain ? "Kaptajn" : "Rytter"}</small>
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
            <h2>På vejen</h2>
            <span>{frame.groups.length} grupper</span>
          </div>
          {frame.groups.slice(0, 8).map((g, i) => (
            <div className="group-row" key={i}>
              <span>{i === 0 ? "Fronten" : `Gruppe ${i + 1}`}</span>
              <strong>{g.riders.length}</strong>
              <span>{i === 0 ? "—" : formatGap(g.gap)}</span>
            </div>
          ))}
          {frame.groups.length > 8 && (
            <p className="small">
              + {frame.groups.length - 8} grupper længere tilbage
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
