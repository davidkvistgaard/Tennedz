import {createHash} from 'node:crypto';

export const MOTOR_LAB_CHECKPOINT_ADAPTER_VERSION = 'motor-lab-checkpoints-to-pelotonia.viewer.v1-1';
export const MOTOR_LAB_CHECKPOINT_SECONDS = 8;

const finite = value => typeof value === 'number' && Number.isFinite(value);

export function motorLabCheckpointRaceId({plan, seed, routeId, orders}) {
  if (!['sprint', 'break', 'balanced', 'conserve'].includes(plan) ||
      !Number.isInteger(seed) || seed < 0 || seed > 9999 ||
      !['coast', 'ridge'].includes(routeId))
    throw new Error('Choose a valid Motor Lab plan, route and seed.');
  const orderHash = createHash('sha256').update(JSON.stringify(orders ?? {})).digest('hex').slice(0, 12);
  return `motor-lab-checkpoints-v1:${routeId}:${plan}:${seed}:${orderHash}`;
}

/**
 * Presentation-only adapter for the legacy Motor Lab recording. Every rider
 * sits on the recorded checkpoint kilometre. Group gaps stay in seconds and
 * are never converted to concurrent metres. Playback seconds are a display
 * cadence because this engine did not record elapsed time at each checkpoint.
 */
export function adaptMotorLabCheckpointsV1(source) {
  const {race, scenario, plan, seed, routeId, orders} = source ?? {};
  const raceId = motorLabCheckpointRaceId({plan, seed, routeId, orders});
  const distanceKm = race?.route?.distanceKm;
  const riderRows = scenario?.teams?.flatMap(team => team.riders.map(rider =>
    ({...rider, teamId: team.id}))) ?? [];
  const riderIds = new Set(riderRows.map(rider => rider.id));
  const riderNames = new Map(riderRows.map(rider => [rider.id, rider.name]));
  if (!Number.isInteger(distanceKm) || distanceKm < 1 ||
      !Array.isArray(race?.frames) || race.frames.length !== distanceKm ||
      !Array.isArray(race.route.kilometres) ||
      race.route.kilometres.length !== distanceKm ||
      !riderIds.size || riderIds.size !== riderRows.length ||
      riderIds.size > 160 || race.raceCategory !== 'M')
    throw new Error('A complete single-category Motor Lab recording is required.');
  const teamColors = ['#b48439', '#527458', '#768a8f', '#765773'];
  const teams = scenario.teams.map((team, index) => ({
    id: team.id, name: team.name, color: teamColors[index % teamColors.length],
    accent: '#f2eee0', pattern: 'paths', paths: [],
  }));
  const riders = riderRows.map((rider, index) => ({
    id: rider.id, name: rider.name, teamId: rider.teamId,
    number: index + 1,
  }));
  const firstHeight = race.route.kilometres[0].startM;
  const profile = [[0, firstHeight], ...race.route.kilometres.map(row =>
    [row.km * 1000, row.endM])];
  if (profile.some(([distance, height], index) =>
    !finite(distance) || !finite(height) ||
    (index > 0 && distance !== index * 1000)))
    throw new Error('Motor Lab route checkpoints are incomplete.');

  const start = {
    time: 0,
    positions: riders.map(rider => ({riderId: rider.id, distance: 0,
      lateral: 0, groupId: 'peloton'})),
    gaps: {peloton: 0}, groupRoles: {peloton: 'peloton'},
  };
  let previousStates = new Map(riders.map(rider => [rider.id, 'peloton']));
  const events = [];
  const frames = [start];
  for (let index = 0; index < race.frames.length; index++) {
    const frame = race.frames[index];
    if (frame.km !== index + 1 || !Array.isArray(frame.riderGroups) ||
        frame.riderGroups.length !== riders.length ||
        !Array.isArray(frame.roadGroups))
      throw new Error('Motor Lab rider checkpoints must cover every kilometre.');
    const states = new Map();
    for (const row of frame.riderGroups) {
      if (!riderIds.has(row.id) || states.has(row.id) ||
          !['breakaway', 'peloton', 'dropped'].includes(row.group) ||
          !finite(row.deficitSeconds) || row.deficitSeconds < 0)
        throw new Error('Invalid or duplicate Motor Lab rider state.');
      states.set(row.id, row);
    }
    const sortedRoadGroups = [...frame.roadGroups].sort((a, b) =>
      b.gapSeconds - a.gapSeconds);
    const leadGap = sortedRoadGroups[0]?.gapSeconds ?? 0;
    if (!finite(leadGap) || leadGap < 0)
      throw new Error('Invalid Motor Lab lead gap.');
    const membership = new Map();
    const gaps = {peloton: leadGap};
    const groupRoles = {peloton: 'peloton'};
    sortedRoadGroups.forEach((group, groupIndex) => {
      if (typeof group.id !== 'string' || !group.id ||
          !finite(group.gapSeconds) || group.gapSeconds < 0 ||
          !Array.isArray(group.riderIds) || !group.riderIds.length)
        throw new Error('Invalid recorded road group.');
      groupRoles[group.id] = groupIndex === 0 ? 'leaders' : 'chase';
      gaps[group.id] = Math.max(0, leadGap - group.gapSeconds);
      for (const riderId of group.riderIds) {
        if (!riderIds.has(riderId) || membership.has(riderId) ||
            states.get(riderId)?.group !== 'breakaway')
          throw new Error('Road-group membership disagrees with rider state.');
        membership.set(riderId, group.id);
      }
    });
    const positions = riders.map(rider => {
      const state = states.get(rider.id);
      if (!state) throw new Error('A Motor Lab checkpoint is missing a rider.');
      let groupId;
      if (state.group === 'breakaway') {
        groupId = membership.get(rider.id);
        if (!groupId) throw new Error('Break rider lacks a recorded road group.');
      } else if (state.group === 'dropped') {
        // The legacy recording has no paid contact between dropped riders.
        // Keep each one solo even when their deficits happen to match.
        groupId = `dropped-${rider.id}`;
        groupRoles[groupId] = 'dropped';
        gaps[groupId] = leadGap + state.deficitSeconds;
      } else {
        groupId = 'peloton';
        if (membership.has(rider.id))
          throw new Error('A peloton rider also belongs to a road group.');
      }
      return {riderId: rider.id, distance: frame.km * 1000,
        lateral: 0, groupId};
    });
    const time = frame.km * MOTOR_LAB_CHECKPOINT_SECONDS;
    const name = id => riderNames.get(id) ?? id;
    for (const riderId of frame.joinedBreakawayRiderIds ?? []) {
      if (!membership.has(riderId))
        throw new Error('A recorded break join lacks road-group membership.');
      const role = groupRoles[membership.get(riderId)];
      events.push({time, label: role === 'chase'?
        `${name(riderId)} joined a recorded chase group`:
        `${name(riderId)} joined the break`,
        riderId});
    }
    for (const riderId of frame.caughtBreakawayRiderIds ?? []) {
      if (states.get(riderId)?.group === 'breakaway')
        throw new Error('A caught rider still appears in the break.');
      events.push({time, label: `${name(riderId)} was caught`, riderId});
    }
    for (const attack of frame.splitAttacks ?? []) {
      if (!riderIds.has(attack.riderId))
        throw new Error('A recorded break attack references an unknown rider.');
      const outcome = {
        split: 'got clear from the break',
        joined_group_ahead: 'reached the group ahead',
        contained: 'attacked from the break but was contained',
        exhausted: 'tried to attack from the break but was exhausted',
        solo_break: 'could not split from the break while already solo',
        not_in_break: 'could not attack from the break while outside it',
      }[attack.status];
      if (outcome) events.push({time,
        label: `${name(attack.riderId)} ${outcome}`, riderId: attack.riderId});
    }
    for (const blocked of frame.blockedBreakAttacks ?? []) {
      if (!riderIds.has(blocked.riderId))
        throw new Error('A blocked break attack references an unknown rider.');
      const reason = {
        not_in_break: 'not in the break',
        group_formed_this_km: 'the group had just formed',
        another_break_attack: 'another attack was selected',
        road_group_limit: 'the road-group limit was reached',
        not_leading_group: 'the rider was not in the leading group',
        not_selected: 'it was not selected',
      }[blocked.reason];
      if (reason) events.push({time,
        label: `${name(blocked.riderId)}’s break move did not start: ${reason}`,
        riderId: blocked.riderId});
    }
    for (const rider of riders) {
      const state = states.get(rider.id);
      if (state.group === 'dropped' &&
          previousStates.get(rider.id) !== 'dropped')
        events.push({time, label: `${rider.name} lost contact with the peloton`,
          riderId: rider.id});
    }
    if (frame.formedChaseGroupId &&
        groupRoles[frame.formedChaseGroupId] === 'chase')
      events.push({time, label: 'A recorded chase group formed',
        groupId: frame.formedChaseGroupId});
    frames.push({time, positions, gaps, groupRoles});
    previousStates = new Map([...states].map(([id, row]) => [id, row.group]));
  }
  const duration = distanceKm * MOTOR_LAB_CHECKPOINT_SECONDS;
  events.push({time: duration,
    label: 'Finish checkpoint reached. Model classification is provisional.'});
  const feed = {
    schemaVersion: 'pelotonia.viewer.v1', raceId,
    title: `Motor Lab ${race.routeName} · experimental checkpoint replay`,
    riderCategory: 'men', duration,
    route: {label: 'Schematic distance axis — geography unavailable',
      points: [[0, 0, 0], [0, 0, distanceKm * 1000]],
      distanceStations: [0, distanceKm * 1000],
      interpolation: 'polyline', width: 6,
      profile: {schemaVersion: 'pelotonia.route-profile.v1', samples: profile}},
    finish: {routeFraction: 1}, teams, riders, frames, events,
  };
  return {
    version: MOTOR_LAB_CHECKPOINT_ADAPTER_VERSION, feed,
    coverage: {
      riderCount: riders.length, boundaryFrames: frames.length,
      recordedRiderKilometres: riders.length * distanceKm,
      recordedGroupGaps: true, exactSimultaneousRiderMetres: false,
      recordedGroupRoles: false, recordedLanesAndOrder: false,
      recordedElapsedClock: false, presentationSecondsPerKm:
        MOTOR_LAB_CHECKPOINT_SECONDS,
      recordedPaidContact: false, canonicalGeography: false,
      officialResults: false, provisionalModelClassification: true,
      sourceEngineVersion: race.version,
      sourceTuningVersion: race.tuningVersion,
    },
  };
}
