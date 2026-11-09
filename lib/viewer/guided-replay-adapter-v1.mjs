import { CLUB_PALETTES, KIT_PATTERNS } from '../riders/club-kit.mjs';

export const GUIDED_REPLAY_ADAPTER_VERSION = 'guided-replay-to-pelotonia.viewer.v1-1';

const finite = value => typeof value === 'number' && Number.isFinite(value);

function eventTime(frames, km) {
  if (km <= 0) return 0;
  for (let i = 1; i < frames.length; i++) {
    const before = frames[i - 1], after = frames[i];
    if (km <= after.km) {
      const fraction = (km - before.km) / (after.km - before.km);
      return before.elapsed_sec + fraction * (after.elapsed_sec - before.elapsed_sec);
    }
  }
  return frames.at(-1).elapsed_sec;
}

/**
 * Display-only conversion of the stored recovery-engine replay. Its groups and
 * seconds are copied from the recording. Every rider is placed at the recorded
 * checkpoint kilometre; the recording supplies neither simultaneous metres
 * between groups nor lanes/order within a group.
 */
export function adaptGuidedReplayV1(replay, { raceId, kitsByTeam = {} } = {}) {
  if (replay?.version !== 1 || !Array.isArray(replay.frames) ||
      replay.frames.length < 2 || !Array.isArray(replay.roster) ||
      !Array.isArray(replay.finish))
    throw new Error('A complete version 1 guided replay is required.');
  const totalKm = replay.route?.distance;
  if (!finite(totalKm) || totalKm <= 0 || !raceId)
    throw new Error('A recorded route and race ID are required.');
  const first = replay.frames[0], last = replay.frames.at(-1);
  if (first.km !== 0 || first.elapsed_sec !== 0 ||
      last.km !== totalKm || !finite(last.elapsed_sec) || last.elapsed_sec <= 0)
    throw new Error('The recording must cover start through finish.');
  const riderIds = new Set(replay.roster.map(r => r.id));
  if (riderIds.size !== replay.roster.length || riderIds.size < 1 ||
      riderIds.size > 160)
    throw new Error('The viewer supports one to 160 unique riders.');
  const categories = new Set(replay.roster.map(r => r.gender));
  if (categories.size !== 1 || !['M', 'F'].includes([...categories][0]))
    throw new Error('The guided replay must contain one gender category.');
  const recordedKits = replay.appearance?.version === 1 &&
    replay.appearance.teams && typeof replay.appearance.teams === 'object'
    ? replay.appearance.teams : {};
  const teamNames = new Map(replay.roster.map(r => [r.team_id, r.team_name]));
  const teams = [...teamNames].map(([id, name]) => {
    const kit = recordedKits[id] ?? kitsByTeam[id];
    const palette = kit && CLUB_PALETTES[kit.palette];
    const pattern = kit && KIT_PATTERNS[kit.pattern];
    return { id, name, color: palette?.primary ?? '#596f65',
      accent: palette?.accent ?? '#ecede0', pattern: 'paths',
      paths: pattern ? [...pattern.paths] : [] };
  });
  const riders = replay.roster.map((r, index) => ({
    id: r.id, name: r.name, teamId: r.team_id, number: index + 1,
  }));
  let previousKm = -1, previousTime = -1;
  const frames = replay.frames.map(frame => {
    if (!finite(frame.km) || frame.km <= previousKm || frame.km > totalKm ||
        !finite(frame.elapsed_sec) || frame.elapsed_sec <= previousTime ||
        !Array.isArray(frame.groups))
      throw new Error('Recorded checkpoints must advance in kilometre and time.');
    previousKm = frame.km;
    previousTime = frame.elapsed_sec;
    const present = new Set();
    const positions = [], gaps = {}, groupRoles = {};
    const peloton = frame.groups.reduce((best, group, index) =>
      group.riders.length > frame.groups[best]?.riders.length ? index : best, 0);
    frame.groups.forEach((group, index) => {
      if (!finite(group.gap) || group.gap < 0 || !Array.isArray(group.riders))
        throw new Error('A recorded group has invalid data.');
      const groupId = `group-${String(index + 1).padStart(4, '0')}`;
      gaps[groupId] = group.gap;
      groupRoles[groupId] = index === peloton ? 'peloton' :
        index < peloton ? (index === 0 ? 'leaders' : 'chase') : 'dropped';
      for (const riderId of group.riders) {
        if (!riderIds.has(riderId) || present.has(riderId))
          throw new Error('Each recorded rider must occur once per checkpoint.');
        present.add(riderId);
        positions.push({ riderId, distance: frame.km * 1000,
          lateral: 0, groupId });
      }
    });
    if (present.size !== riderIds.size)
      throw new Error('A recorded checkpoint is missing riders.');
    return { time: frame.elapsed_sec, positions, gaps, groupRoles };
  });
  if (replay.finish.length !== riderIds.size ||
      new Set(replay.finish.map(r => r.rider_id)).size !== riderIds.size ||
      replay.finish.some(r => !riderIds.has(r.rider_id) ||
        !Number.isInteger(r.position) || !finite(r.time_sec)))
    throw new Error('Recorded finish results must cover the field.');
  const profile = replay.route.points;
  if (!Array.isArray(profile) || profile.length < 2 ||
      profile.some(point => !Array.isArray(point) ||
        point.length !== 2 || point.some(value => !finite(value))))
    throw new Error('Recorded elevation samples are required.');
  const feed = {
    schemaVersion: 'pelotonia.viewer.v1', raceId,
    title: replay.route.name, riderCategory: categories.has('F') ? 'women' : 'men',
    duration: last.elapsed_sec,
    route: { label: 'Schematic distance axis — geography unavailable',
      points: [[0, 0, 0], [0, 0, totalKm * 1000]],
      distanceStations: [0, totalKm * 1000], interpolation: 'polyline', width: 6,
      profile: { schemaVersion: 'pelotonia.route-profile.v1',
        samples: profile.map(([km, height]) => [km * 1000, height]) } },
    finish: { routeFraction: 1 }, teams, riders, frames,
    events: (replay.events ?? []).map(event => ({
      time: eventTime(replay.frames, event.km),
      // The recorded English copy is authoritative. A viewer event type would
      // replace it with generated commentary in the rendering package.
      label: event.text,
      ...(event.rider_ids?.length === 1 && riderIds.has(event.rider_ids[0])
        ? { riderId: event.rider_ids[0] } : {}),
    })).sort((a, b) => a.time - b.time),
    results: { publishedAt: last.elapsed_sec,
      entries: replay.finish.map(result => ({ riderId: result.rider_id,
        status: 'finished', rank: result.position, elapsed: result.time_sec,
        gap: result.time_sec - replay.finish[0].time_sec })) },
  };
  return { version: GUIDED_REPLAY_ADAPTER_VERSION, feed,
    coverage: { riderCount: riders.length, boundaryFrames: frames.length,
      recordedGroupGaps: true, exactSimultaneousRiderMetres: false,
      recordedLanesAndOrder: false, canonicalGeography: false,
      sourceKitCount: teams.filter(team => !!(recordedKits[team.id] ??
        kitsByTeam[team.id])).length,
      officialResults: true } };
}
