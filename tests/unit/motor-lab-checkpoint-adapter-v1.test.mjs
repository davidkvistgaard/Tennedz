import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotorLabPreview, createMotorLabPreviewSource} from
  '../../lib/engine/v2/preview.mjs';
import {adaptMotorLabCheckpointsV1,
  motorLabCheckpointRaceId, MOTOR_LAB_CHECKPOINT_SECONDS} from
  '../../lib/viewer/motor-lab-checkpoint-adapter-v1.mjs';
import {checkpointBroadcastClockV1, CHECKPOINT_FINISH_HOLD_MS} from
  '../../lib/viewer/checkpoint-broadcast-clock-v1.mjs';

function run(plan = 'sprint', routeId = 'ridge', seed = 1) {
  const source = createMotorLabPreviewSource({plan, routeId, seed});
  return {source, ...adaptMotorLabCheckpointsV1(source)};
}

test('existing Motor Lab preview keeps its public summary shape', () => {
  const summary = createMotorLabPreview({plan: 'break', seed: 1});
  assert.equal(summary.kind, 'fictional-motor-lab');
  assert.equal(summary.frames.length, 160);
  assert.equal(summary.results.length, 32);
  assert.equal(Object.hasOwn(summary, 'race'), false);
});

test('viewer adapter covers all riders from start to finish without metres from time gaps', () => {
  const {source, feed, coverage} = run();
  assert.equal(feed.schemaVersion, 'pelotonia.viewer.v1');
  assert.equal(feed.riderCategory, 'men');
  assert.equal(feed.duration, 160 * MOTOR_LAB_CHECKPOINT_SECONDS);
  assert.equal(feed.frames.length, 161);
  assert.equal(coverage.recordedRiderKilometres, 160 * 32);
  assert.equal(coverage.recordedPaidContact, false);
  assert.equal(coverage.recordedElapsedClock, false);
  assert.equal(coverage.officialResults, false);
  assert.equal(feed.results, undefined);
  assert.equal(feed.frames[0].time, 0);
  assert.equal(feed.frames.at(-1).time, feed.duration);
  for (const [index, frame] of feed.frames.entries()) {
    assert.equal(frame.time, index * MOTOR_LAB_CHECKPOINT_SECONDS);
    assert.equal(frame.positions.length, 32);
    assert.equal(new Set(frame.positions.map(row => row.riderId)).size, 32);
    assert.ok(frame.positions.every(row => row.distance === index * 1000 &&
      row.lateral === 0));
    if (!index) continue;
    const sourceFrame = source.race.frames[index - 1];
    for (const group of sourceFrame.roadGroups) {
      assert.equal(frame.gaps[group.id],
        sourceFrame.roadGroups[0].gapSeconds - group.gapSeconds);
      assert.deepEqual(new Set(frame.positions.filter(row =>
        row.groupId === group.id).map(row => row.riderId)),
      new Set(group.riderIds));
    }
    assert.equal(frame.gaps.peloton,
      sourceFrame.roadGroups[0]?.gapSeconds ?? 0);
  }
});

test('early climb drops stay solo and recorded catch returns riders to peloton', () => {
  const {source, feed} = run('sprint', 'ridge', 1);
  const climb = feed.frames[38];
  const dropped = climb.positions.find(row => row.riderId === 'r-0-0');
  assert.equal(dropped.groupId, 'dropped-r-0-0');
  assert.equal(climb.groupRoles[dropped.groupId], 'dropped');
  assert.equal(climb.gaps[dropped.groupId],
    (source.race.frames[37].roadGroups[0]?.gapSeconds ?? 0) +
      source.race.frames[37].riderGroups.find(row =>
        row.id === 'r-0-0').deficitSeconds);
  const catchKm = source.race.frames.find(frame =>
    frame.caughtBreakawayRiderIds.length)?.km;
  assert.ok(catchKm);
  for (const riderId of source.race.frames[catchKm - 1]
    .caughtBreakawayRiderIds) {
    const sourceState = source.race.frames[catchKm - 1]
      .riderGroups.find(row => row.id === riderId);
    const target = feed.frames[catchKm].positions.find(row =>
      row.riderId === riderId);
    assert.equal(target.groupId,
      sourceState.group === 'dropped' ? `dropped-${riderId}` : 'peloton');
  }
});

test('recorded events cannot reveal a future break or provisional winner', () => {
  const {source, feed} = run('break', 'coast', 1);
  const firstJoin = source.race.frames.find(frame =>
    frame.joinedBreakawayRiderIds.length);
  const early = feed.events.filter(event =>
    event.time < firstJoin.km * MOTOR_LAB_CHECKPOINT_SECONDS);
  assert.ok(early.every(event => !event.label.includes('joined the break')));
  assert.ok(feed.events.every(event =>
    event.time >= 0 && event.time <= feed.duration &&
    !event.label.includes(source.race.provisionalResults[0].name + ' wins')));
  assert.equal(feed.events.at(-1).time, feed.duration);
});

test('race identity changes with orders and shared playback has a finish hold', () => {
  const base = {plan: 'sprint', seed: 1, routeId: 'coast'};
  assert.notEqual(motorLabCheckpointRaceId({...base, orders: {attack: 'none'}}),
    motorLabCheckpointRaceId({...base, orders: {attack: 'repeated'}}));
  const duration = 160 * MOTOR_LAB_CHECKPOINT_SECONDS;
  const cycleMs = duration * 1000 + CHECKPOINT_FINISH_HOLD_MS;
  const a = checkpointBroadcastClockV1(duration, cycleMs * 4 + 2000);
  const b = checkpointBroadcastClockV1(duration, cycleMs * 4 + 5000);
  assert.equal(a.clock.serverEpochMs, b.clock.serverEpochMs);
  assert.equal(a.clock.paused, false);
  const finish = checkpointBroadcastClockV1(duration,
    cycleMs * 4 + duration * 1000 + 1);
  assert.equal(finish.clock.position, duration);
  assert.equal(finish.clock.paused, true);
});

test('selected team order reaches the motor before adaptation', () => {
  const base = {plan: 'sprint', routeId: 'ridge', seed: 1};
  const standard = createMotorLabPreviewSource(base);
  const ordered = createMotorLabPreviewSource({...base,
    orders: {attackPosture: 'repeated'}});
  assert.equal(ordered.race.committedInputs.teams[0].orders.baseline.attack,
    'repeated');
  assert.notDeepEqual(ordered.race.provisionalResults,
    standard.race.provisionalResults);
  assert.notEqual(adaptMotorLabCheckpointsV1(ordered).feed.raceId,
    adaptMotorLabCheckpointsV1(standard).feed.raceId);
});

test('break attack order is shown only with its recorded outcome', () => {
  const input = {routeId: 'ridge', seed: 1,
    orders: {breakAttackMarker: '40'}};
  const successful = run('break', input.routeId, input.seed);
  const breakSource = createMotorLabPreviewSource({...input, plan: 'break'});
  const breakFeed = adaptMotorLabCheckpointsV1(breakSource).feed;
  const breakKm = breakSource.race.frames.find(frame =>
    frame.splitAttacks.some(attack => attack.status === 'split')).km;
  assert.ok(breakFeed.events.some(event => event.time === breakKm * 8 &&
    event.label.includes('got clear from the break')));
  assert.ok(!successful.feed.events.some(event =>
    event.label.includes('got clear from the break')));

  const blockedSource = createMotorLabPreviewSource({...input, plan: 'sprint'});
  const blockedFeed = adaptMotorLabCheckpointsV1(blockedSource).feed;
  const blockedKm = blockedSource.race.frames.find(frame =>
    frame.blockedBreakAttacks.some(attack =>
      attack.reason === 'not_in_break')).km;
  assert.ok(blockedFeed.events.some(event => event.time === blockedKm * 8 &&
    event.label.includes('did not start: not in the break')));
  assert.ok(!blockedFeed.events.some(event =>
    event.label.includes('got clear from the break')));
});

test('a rider recorded in a chase group is not announced as joining the lead break', () => {
  const source = createMotorLabPreviewSource({plan: 'break',
    routeId: 'coast', seed: 1});
  const frame = source.race.frames.find(row =>
    row.joinedBreakawayRiderIds.length && row.roadGroups.length === 1 &&
    row.roadGroups[0].riderIds.length > 1 &&
    row.roadGroups[0].gapSeconds > 0);
  assert.ok(frame);
  const chaseRiderId = frame.joinedBreakawayRiderIds[0];
  const front = frame.roadGroups[0];
  front.riderIds = front.riderIds.filter(id => id !== chaseRiderId);
  frame.roadGroups.push({id: 'recorded-chase-fixture',
    riderIds: [chaseRiderId], teamIds: ['team-0'],
    gapSeconds: front.gapSeconds / 2});
  const feed = adaptMotorLabCheckpointsV1(source).feed;
  const event = feed.events.find(row => row.time === frame.km * 8 &&
    row.riderId === chaseRiderId);
  assert.ok(event?.label.includes('joined a recorded chase group'));
  assert.equal(feed.frames[frame.km].groupRoles['recorded-chase-fixture'],
    'chase');
});

test('multiple plans, seeds and routes produce complete source-derived feeds', () => {
  for (const routeId of ['coast', 'ridge'])
    for (const plan of ['sprint', 'break', 'balanced', 'conserve'])
      for (const seed of [0, 1, 37]) {
        const {source, feed} = run(plan, routeId, seed);
        assert.equal(feed.frames.length, source.race.route.distanceKm + 1);
        assert.equal(feed.frames.at(-1).positions.length, 32);
      }
});
