import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateFeed } from '@pelotonia/race-viewer/data';
import { illustrativeGroupLayoutFeedV3 } from
  '../../lib/viewer/illustrative-group-layout-v3.mjs';

for (const category of ['men', 'women']) {
  test(`${category} split race display separates recorded overlaps`, () => {
    const source = JSON.parse(readFileSync(new URL(
      `../../data/viewer/physical-120km-${category}-v1.json`,
      import.meta.url))).feed;
    const original = structuredClone(source);
    const display = illustrativeGroupLayoutFeedV3(source);
    assert.deepEqual(validateFeed(display), display);
    assert.deepEqual(source, original);
    for (const key of ['raceId', 'duration', 'riders', 'teams', 'events',
      'orders', 'actions', 'results', 'finish'])
      assert.deepEqual(display[key], source[key], key);
    assert.deepEqual(display.route, source.route);
    const finishM = source.route.profile.samples.at(-1)[0];
    for (let index = 0; index < source.frames.length; index++) {
      const recorded = source.frames[index];
      const shown = display.frames[index];
      assert.equal(shown.time, recorded.time);
      assert.deepEqual(shown.groupRoles, recorded.groupRoles);
      assert.deepEqual(shown.gaps, recorded.gaps);
      assert.deepEqual(shown.events, recorded.events);
      const rows = new Map(recorded.positions.map(row => [row.riderId, row]));
      const anchors = new Map();
      const shownMinimums = new Map();
      for (const row of recorded.positions)
        anchors.set(row.groupId, Math.max(
          anchors.get(row.groupId) ?? 0, row.distance));
      for (const row of shown.positions) {
        const anchor = rows.get(row.riderId);
        assert.ok(anchor);
        assert.equal(row.groupId, anchor.groupId);
        assert.ok(row.distance <= anchor.distance);
        assert.ok(anchor.distance - row.distance <= 20);
        if (anchor.distance === finishM)
          assert.equal(row.distance, finishM,
            `A recorded finisher moved behind the line in frame ${index}`);
        shownMinimums.set(row.groupId, Math.min(
          shownMinimums.get(row.groupId) ?? Infinity, row.distance));
      }
      for (const [groupId, distance] of anchors)
        for (const [otherId, otherDistance] of anchors)
          if (groupId !== otherId && distance > otherDistance)
            assert.ok(shownMinimums.get(groupId) >= otherDistance,
              `Display crossed a recorded group at frame ${index}`);
    }
    const middle = display.frames[Math.floor(display.frames.length / 2)];
    assert.equal(new Set(middle.positions.map(row =>
      `${row.distance}:${row.lateral}`)).size, source.riders.length);
  });

  test(`${category} default recording displays the full peloton`, () => {
    const source = JSON.parse(readFileSync(new URL(
      `../../data/viewer/physical-40km-${category}-v1.json`,
      import.meta.url))).feed;
    const original = structuredClone(source);
    const display = illustrativeGroupLayoutFeedV3(source);
    assert.deepEqual(validateFeed(display), display);
    assert.deepEqual(source, original);
    assert.deepEqual(display.events, source.events);
    assert.deepEqual(display.results, source.results);
    assert.deepEqual(display.finish, source.finish);
    const finishM = source.route.profile.samples.at(-1)[0];
    const recordedFinish = source.frames.at(-1).positions;
    const shownFinish = display.frames.at(-1).positions;
    for (let index = 0; index < recordedFinish.length; index++)
      if (recordedFinish[index].distance === finishM)
        assert.equal(shownFinish[index].distance, finishM);
    const middleIndex = Math.floor(display.frames.length / 2);
    const middle = display.frames[middleIndex];
    assert.deepEqual(middle.groupRoles, source.frames[middleIndex].groupRoles);
    assert.equal(new Set(middle.positions.map(row =>
      `${row.distance}:${row.lateral}`)).size, source.riders.length);
  });
}
