import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateFeed } from '@pelotonia/race-viewer/data';
import { illustrativeGroupLayoutFeedV1 } from
  '../../lib/viewer/illustrative-group-layout-v1.mjs';

for (const category of ['men', 'women']) {
  test(`${category} split race display separates recorded overlaps`, () => {
    const source = JSON.parse(readFileSync(new URL(
      `../../data/viewer/physical-120km-${category}-v1.json`,
      import.meta.url))).feed;
    const original = structuredClone(source);
    const display = illustrativeGroupLayoutFeedV1(source);
    assert.deepEqual(validateFeed(display), display);
    assert.deepEqual(source, original);
    for (const key of ['raceId', 'duration', 'riders', 'teams', 'events',
      'orders', 'actions', 'results', 'finish'])
      assert.deepEqual(display[key], source[key], key);
    assert.deepEqual(display.route, source.route);
    for (let index = 0; index < source.frames.length; index++) {
      const recorded = source.frames[index];
      const shown = display.frames[index];
      assert.equal(shown.time, recorded.time);
      assert.deepEqual(shown.groupRoles, recorded.groupRoles);
      assert.deepEqual(shown.gaps, recorded.gaps);
      assert.deepEqual(shown.events, recorded.events);
      const rows = new Map(recorded.positions.map(row => [row.riderId, row]));
      for (const row of shown.positions) {
        const anchor = rows.get(row.riderId);
        assert.ok(anchor);
        assert.equal(row.groupId, anchor.groupId);
        assert.ok(row.distance <= anchor.distance);
        assert.ok(anchor.distance - row.distance <= 20);
      }
    }
    const middle = display.frames[Math.floor(display.frames.length / 2)];
    assert.equal(new Set(middle.positions.map(row =>
      `${row.distance}:${row.lateral}`)).size, source.riders.length);
  });
}
