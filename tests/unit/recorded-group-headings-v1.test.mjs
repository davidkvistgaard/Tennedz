import test from 'node:test';
import assert from 'node:assert/strict';
import {recordedGroupHeadingsV1} from
  '../../lib/viewer/recorded-group-headings-v1.mjs';

test('recorded gaps determine chase and dropped group numbers', () => {
  const ids = ['peloton', 'road-2', 'dropped-z', 'road-10',
    'road-front', 'dropped-a'];
  const positions = ids.map((groupId, index) => ({
    riderId: `r-${index}`, groupId, distance: 5000, lateral: 0,
  }));
  const gaps = {peloton: 30, 'road-2': 20, 'dropped-z': 40,
    'road-10': 10, 'road-front': 0, 'dropped-a': 50};
  const roles = {peloton: 'peloton', 'road-2': 'chase',
    'dropped-z': 'dropped', 'road-10': 'chase',
    'road-front': 'leaders', 'dropped-a': 'dropped'};
  const headings = recordedGroupHeadingsV1(positions, gaps, roles);
  assert.deepEqual(headings.map(group => group.id), [
    'road-front', 'road-10', 'road-2', 'peloton',
    'dropped-z', 'dropped-a']);
  assert.deepEqual(headings.map(group => group.label), [
    'leaders', 'chase group 1', 'chase group 2', 'peloton',
    'dropped group 1', 'dropped group 2']);
});
