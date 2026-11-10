import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFeed, createSampler, labelRaceGroups, raceGroups,
  resultsAt } from '@pelotonia/race-viewer/data';
import { simulateStage } from '../../lib/engine/simulateStage.js';
import { adaptGuidedReplayV1 } from '../../lib/viewer/guided-replay-adapter-v1.mjs';
import { illustrativeGroupLayoutFeedV2 } from
  '../../lib/viewer/illustrative-group-layout-v2.mjs';
import { withRecordedAppearanceV1 } from
  '../../lib/viewer/recorded-appearance-v1.mjs';
import { teamKitOptions, defaultKit, CLUB_PALETTES } from
  '../../lib/riders/club-kit.mjs';
import { guidedSceneryV1 } from '../../lib/viewer/guided-scenery-v1.mjs';

const stage = { name: 'Recorded hills', distance_km: 40, tags: ['HILLS'],
  profile_points: [[0, 20], [20, 180], [40, 30]] };

function rider(index, gender) {
  return { id: `${gender}-${index}`, name: `Rider ${index}`, gender,
    sprint: 45 + index % 10, flat: 50, hills: 50, mountain: 50,
    cobbles: 50, endurance: 55, strength: 50, wind: 50,
    form: 60, fatigue: 0 };
}

function actualReplay(category, count) {
  const gender = category === 'women' ? 'F' : 'M';
  const teams = Array.from({ length: count / 8 }, (_, team) => ({
    id: `team-${team}`, name: `Team ${team}`,
    riders: Array.from({ length: 8 }, (_, i) => rider(team * 8 + i, gender)),
  }));
  return simulateStage({ stage, teamsWithRiders: teams,
    seed: `viewer-guided-${category}-${count}` }).replay;
}

for (const category of ['men', 'women']) {
  for (const count of [32, 144, 160]) {
    test(`actual guided ${category} replay adapts all ${count} riders without spatial gaps`, () => {
      const replay = actualReplay(category, count);
      const before = JSON.stringify(replay);
      const { feed, coverage } = adaptGuidedReplayV1(replay,
        { raceId: `${category}-${count}` });
      validateFeed(feed);
      assert.equal(feed.riderCategory, category);
      assert.equal(feed.riders.length, count);
      assert.equal(feed.results.entries.length, count);
      assert.equal(coverage.exactSimultaneousRiderMetres, false);
      assert.equal(coverage.sourceKitCount, 0);
      for (let index = 0; index < feed.frames.length; index++) {
        const source = replay.frames[index], frame = feed.frames[index];
        assert.equal(frame.time, source.elapsed_sec);
        assert.equal(frame.positions.length, count);
        assert.deepEqual(Object.values(frame.gaps), source.groups.map(g => g.gap));
        assert.ok(frame.positions.every(row => row.distance === source.km * 1000 &&
          row.lateral === 0));
      }
      const sampler = createSampler(feed);
      assert.equal(sampler(feed.duration / 2).positions.length, count);
      assert.equal(resultsAt(feed, feed.duration - 0.01), null);
      assert.deepEqual(resultsAt(feed, feed.duration).entries,
        feed.results.entries);
      assert.ok(feed.events.filter(e => e.label.startsWith('Finish!'))
        .every(e => e.time === feed.duration));
      assert.equal(JSON.stringify(replay), before);
      const display = illustrativeGroupLayoutFeedV2(feed);
      validateFeed(display);
      assert.deepEqual(display.frames[0], feed.frames[0]);
      for (let index = 1; index < display.frames.length; index++) {
        const original = feed.frames[index], visual = display.frames[index];
        assert.deepEqual(visual.gaps, original.gaps);
        assert.deepEqual(visual.groupRoles, original.groupRoles);
        assert.equal(visual.time, original.time);
        assert.ok(visual.positions.every(row => row.distance <=
          original.positions.find(p => p.riderId === row.riderId).distance));
      }
      assert.ok(display.frames[1].positions.some((row, index) =>
        row.lateral !== feed.frames[1].positions[index].lateral));
      if (count === 160) {
        const scenic = guidedSceneryV1(display);
        validateFeed(scenic);
        assert.equal(scenic.synthetic, false);
        assert.deepEqual(scenic.frames, display.frames);
        assert.deepEqual(scenic.results, display.results);
        assert.deepEqual(scenic.events, display.events);
        assert.deepEqual(scenic.route.points, display.route.points);
        assert.ok(scenic.landmarks.length > 0);
      }
    });
  }
}

test('guided group strip follows recorded gaps when source groups arrive out of order', () => {
  const source = actualReplay('men', 160);
  const replay = structuredClone(source);
  const checkpoint = replay.frames.find(frame => frame.groups.length > 1 &&
    frame.groups.some(group => group.gap !== frame.groups[0].gap));
  assert.ok(checkpoint, 'The generated race needs a split checkpoint.');
  checkpoint.groups.reverse();
  const { feed } = adaptGuidedReplayV1(replay, { raceId: 'shuffled-groups' });
  const frame = feed.frames.find(row => row.time === checkpoint.elapsed_sec);
  const expectedGaps = checkpoint.groups.map(group => group.gap)
    .sort((a, b) => a - b);
  assert.deepEqual(Object.values(frame.gaps), expectedGaps);
  assert.deepEqual(labelRaceGroups(raceGroups(frame.positions),
    frame.groupRoles).map(group => frame.gaps[group.id]), expectedGaps);
  assert.equal(Object.values(frame.gaps)[0], 0);
  assert.deepEqual(new Set(frame.positions.map(row => row.riderId)),
    new Set(source.roster.map(row => row.id)));
  assert.deepEqual(feed.results.entries.map(row => row.riderId),
    source.finish.map(row => row.rider_id));
  assert.deepEqual(source.frames.find(row =>
    row.elapsed_sec === checkpoint.elapsed_sec).groups,
  [...checkpoint.groups].reverse());
});

test('recorded team appearance survives later selection changes without altering sport data', () => {
  const replay = actualReplay('women', 32);
  const options = teamKitOptions('team-0');
  const saved = { palette: options.palettes[1], pattern: options.patterns[1] };
  const output = { engine_version: 'unchanged', divisions: [
    { index: 1, results: replay.finish, replay }] };
  const before = JSON.stringify(output);
  const recorded = withRecordedAppearanceV1(output, [
    { team_id: 'team-0', ...saved }]);
  assert.equal(JSON.stringify(output), before);
  assert.deepEqual(recorded.divisions[0].replay.frames, replay.frames);
  assert.deepEqual(recorded.divisions[0].results, output.divisions[0].results);
  assert.deepEqual(recorded.divisions[0].replay.appearance.teams['team-0'], saved);
  assert.deepEqual(recorded.divisions[0].replay.appearance.teams['team-1'],
    defaultKit('team-1'));
  const adapted = adaptGuidedReplayV1(recorded.divisions[0].replay,
    { raceId: 'recorded-kit', kitsByTeam: { 'team-0': defaultKit('team-0') } });
  assert.equal(adapted.coverage.sourceKitCount, 4);
  assert.equal(adapted.feed.teams.find(team => team.id === 'team-0').color,
    CLUB_PALETTES[saved.palette].primary);
  validateFeed(adapted.feed);
});

test('adapter refuses missing riders and mixed categories', () => {
  const replay = actualReplay('men', 32);
  replay.frames[1].groups[0].riders.pop();
  assert.throws(() => adaptGuidedReplayV1(replay, { raceId: 'bad' }),
    /missing riders/);
  const mixed = actualReplay('women', 32);
  mixed.roster[0].gender = 'M';
  assert.throws(() => adaptGuidedReplayV1(mixed, { raceId: 'mixed' }),
    /one gender category/);
});
