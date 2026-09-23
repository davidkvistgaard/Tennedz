import { clamp, normalizeRoute, routeAt } from "./route.mjs";

export const REPLAY_VERSION = 1;
export function groupAtGaps(gaps, threshold = 5) {
  const sorted = gaps
      .slice()
      .sort((a, b) => a.gap - b.gap || a.id.localeCompare(b.id)),
    groups = [];
  for (const rider of sorted) {
    let group = groups.at(-1);
    if (!group || rider.gap - group.gap > threshold) {
      group = { gap: Math.round(rider.gap * 10) / 10, riders: [] };
      groups.push(group);
    }
    group.riders.push(rider.id);
  }
  return groups;
}

// This is part of the SERVER simulation, not a browser reconstruction. The
// recovery engine models strategic phases, not continuous wheel-to-wheel physics.
// Recorded gaps resolve to its exact finish times. Old runs are never rerolled.
export function recordReplay({
  stage,
  weather,
  riders,
  results,
  breakIds,
  breakSurvives,
  splitIds,
  splitGap,
  feed,
}) {
  const route = normalizeRoute(stage),
    distance = route.distance;
  const attackKm = Math.min(8, distance * 0.1),
    splitKm = Math.min(60, distance * 0.48),
    resolveKm = Math.max(attackKm + 1, distance - 12);
  const finalGaps = new Map(
    results.map((r) => [r.rider_id, r.time_sec - results[0].time_sec]),
  );
  const breakSet = new Set(breakIds),
    splitSet = new Set(splitIds);
  const pelotonGap = results
    .filter((r) => !breakSet.has(r.rider_id))
    .reduce((min, r) => Math.min(min, finalGaps.get(r.rider_id)), Infinity);
  const kms = new Set([
    0,
    distance,
    attackKm,
    splitKm,
    resolveKm,
    ...route.keypoints.map((k) => k.km),
    ...feed.map((f) => f.km),
  ]);
  for (let km = 2; km < distance; km += 2) kms.add(km);
  const frames = [...kms]
    .sort((a, b) => a - b)
    .map((km) => {
      const progress = km / distance,
        finale = clamp((km - (distance - 5)) / 5, 0, 1);
      let lead = 0;
      if (breakIds.length && km >= attackKm) {
        if (km < resolveKm) {
          const phase = (km - attackKm) / (resolveKm - attackKm);
          lead = breakSurvives
            ? 15 + phase * Math.max(30, pelotonGap)
            : 15 + Math.sin(phase * Math.PI) * 95;
        } else if (breakSurvives) lead = pelotonGap;
      }
      const gaps = riders.map((r) => {
        let gap = breakSet.has(r.rider_id) ? 0 : lead;
        if (splitSet.has(r.rider_id) && km >= splitKm)
          gap += splitGap * clamp((km - splitKm) / 8, 0, 1);
        if (km >= resolveKm) {
          const late = clamp((km - resolveKm) / (distance - resolveKm), 0, 1);
          gap = gap * (1 - late) + finalGaps.get(r.rider_id) * late;
        }
        if (km === distance) gap = finalGaps.get(r.rider_id);
        return { id: r.rider_id, gap: Math.max(0, gap) };
      });
      const min = Math.min(...gaps.map((g) => g.gap));
      gaps.forEach((g) => (g.gap -= min));
      return {
        km: Math.round(km * 100) / 100,
        elapsed_sec: Math.round(results[0].time_sec * progress),
        terrain: routeAt(route, km).terrain,
        groups: groupAtGaps(gaps, finale === 1 ? 0.01 : 5),
      };
    });
  return {
    version: REPLAY_VERSION,
    route,
    weather,
    frames,
    roster: riders.map((r) => ({
      id: r.rider_id,
      name: r.rider_name,
      team_id: r.team_id,
      team_name: r.team_name,
      gender: r.gender,
      captain: r.is_captain,
      nationality: r.raw.nationality || null,
    })),
    events: feed.map((event, i) => ({
      ...event,
      id: `moment-${i}`,
      kind: event.kind || "race",
    })),
    finish: results.map(
      ({ rider_id, position, time_sec, gap_text, team_id }) => ({
        rider_id,
        position,
        time_sec,
        gap_text,
        team_id,
      }),
    ),
  };
}

export function replayFrame(replay, km) {
  const frames = replay?.frames || [];
  if (!frames.length) return null;
  let lo = 0,
    hi = frames.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (frames[mid].km <= km) lo = mid;
    else hi = mid - 1;
  }
  return frames[lo];
}
export function visibleMoments(replay, km) {
  return (replay?.events || []).filter((e) => e.km <= km);
}
export function nextMoment(replay, km) {
  return (
    replay.events.find((e) => e.km > km + 0.01)?.km ?? replay.route.distance
  );
}
export function formatGap(seconds) {
  if (seconds < 0.5) return "Samme tid";
  const rounded = Math.round(seconds);
  return rounded < 60
    ? `+${rounded} s`
    : `+${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}
