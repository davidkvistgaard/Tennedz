import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest, createV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {orderAt} from '../../lib/engine/v2/orders.mjs';
import {createV93CoastedPlaytest, validateV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

const base = {distanceKm: 40, terrain: 'flat', teamCount: 4, gender: 'M',
  effort: 'conserve', attack: 'none', chase: 'all', seed: 'sample-flat-finish'};
const phases = [
  {teamId: 'you', atKm: 10, effort: 'hard'},
  {teamId: 'you', atKm: 20, effort: 'steady'},
];

test('separate v3 guided effort timeline applies two orders after their markers', () => {
  const prepared = prepareV91Playtest({...base, managerTacticalOrdersV3: phases});
  const own = prepared.teams.find(team => team.id === 'you');
  assert.equal(orderAt(own.orders, 9).effort, 'conserve');
  assert.equal(orderAt(own.orders, 10).effort, 'hard');
  assert.equal(orderAt(own.orders, 19).effort, 'hard');
  assert.equal(orderAt(own.orders, 20).effort, 'steady');
  assert.deepEqual(prepared.settings.managerTacticalOrdersV3, phases);
  assert.equal(prepared.settings.managerTacticalOrdersV2, undefined);
  const race = createV91Playtest({...base, managerTacticalOrdersV3: phases});
  assert.deepEqual(race.recording.committedInputs.teams.find(team =>
    team.id === 'you').orders.phases.map(row => row.atKm), [10, 20]);
});

test('v3 multiple markers preserve earlier frames and pay changed energy later', () => {
  const baseline = createV93CoastedPlaytest(base);
  const changedSettings = {...base, managerTacticalOrdersV3: phases};
  const changed = createV93CoastedPlaytest(changedSettings);
  assert.equal(validateV93CoastedPlaytest(changedSettings, {}, changed), true);
  assert.deepEqual(changed.recording.frames.slice(0, 10),
    baseline.recording.frames.slice(0, 10));
  assert.ok(changed.recording.frames.slice(10).some((frame, index) =>
    frame.teamEnergy.find(row => row.teamId === 'you').mean !==
    baseline.recording.frames[index + 10].teamEnergy.find(row =>
      row.teamId === 'you').mean));
  assert.equal(changed.individualLine.conditionalCrossings.length, 32);
});

test('v3 rejects duplicate, off-grid, alien and mixed older effort orders', () => {
  const duplicate = [...phases, {...phases[0]}];
  for (const orders of [duplicate,
    [{teamId: 'you', atKm: 11, effort: 'hard'}],
    [{teamId: 'alien', atKm: 10, effort: 'hard'}]]) {
    assert.throws(() => prepareV91Playtest({...base,
      managerTacticalOrdersV3: orders}), /valid playtest settings/);
  }
  assert.throws(() => prepareV91Playtest({...base,
    managerTacticalOrdersV3: phases, managerTacticalOrdersV2:
      [{teamId: 'you', atKm: 15, effort: 'hard'}]}), /valid playtest settings/);
  assert.throws(() => prepareV91Playtest({...base,
    managerTacticalOrdersV3: phases, managerFinaleOrders:
      [{teamId: 'you', atKm: 35, effort: 'hard'}]}), /valid playtest settings/);
});

test('v3 accepts an earlier additional marker alongside the default final 5 km marker', () => {
  const reversed = [
    {teamId: 'you', atKm: 35, effort: 'hard'},
    {teamId: 'you', atKm: 10, effort: 'steady'},
  ];
  const changedSettings = {...base, managerTacticalOrdersV3: reversed};
  const prepared = prepareV91Playtest(changedSettings);
  const own = prepared.teams.find(team => team.id === 'you');
  assert.deepEqual(own.orders.phases.map(row => row.atKm), [10, 35]);
  assert.equal(orderAt(own.orders, 9).effort, 'conserve');
  assert.equal(orderAt(own.orders, 10).effort, 'steady');
  assert.equal(orderAt(own.orders, 35).effort, 'hard');
  const race = createV93CoastedPlaytest(changedSettings);
  assert.equal(validateV93CoastedPlaytest(changedSettings, {}, race), true);
  assert.equal(race.individualLine.conditionalCrossings.length, 32);
});
