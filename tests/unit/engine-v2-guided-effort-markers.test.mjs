import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest, createV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {orderAt} from '../../lib/engine/v2/orders.mjs';
import {createV93CoastedPlaytest, validateV93CoastedPlaytest} from '../../lib/engine/v2/playtest-v93-coasted.mjs';

const base = {distanceKm: 40, terrain: 'flat', teamCount: 4, gender: 'M',
  effort: 'conserve', attack: 'none', chase: 'ignore', seed: 'five-km-effort-v2'};

test('v2 guided effort switches after a chosen 5 km marker and preserves prior order', () => {
  const prepared = prepareV91Playtest({...base, managerTacticalOrdersV2:
    [{teamId: 'you', atKm: 15, effort: 'hard'}]});
  const own = prepared.teams.find(team => team.id === 'you');
  assert.equal(orderAt(own.orders, 14).effort, 'conserve');
  assert.equal(orderAt(own.orders, 15).effort, 'hard');
  assert.deepEqual(prepared.settings.managerTacticalOrdersV2,
    [{teamId: 'you', atKm: 15, effort: 'hard'}]);
  assert.equal(prepared.settings.managerFinaleOrders, undefined);
});

test('recorded v2 guided effort changes at the chosen marker, not earlier', () => {
  const race = createV91Playtest({...base, managerTacticalOrdersV2:
    [{teamId: 'you', atKm: 15, effort: 'hard'}]});
  const phases = race.recording.committedInputs.teams.find(team => team.id === 'you').orders.phases;
  assert.deepEqual(phases.map(phase => phase.atKm), [15]);
  assert.equal(race.recording.frames.length, 40);
});

test('v2 guided effort rejects off-grid markers and mixed legacy fields', () => {
  assert.throws(() => prepareV91Playtest({...base, managerTacticalOrdersV2:
    [{teamId: 'you', atKm: 16, effort: 'hard'}]}), /valid playtest settings/);
  assert.throws(() => prepareV91Playtest({...base, managerTacticalOrdersV2:
    [{teamId: 'you', atKm: 15, effort: 'hard'}], managerFinaleOrders:
    [{teamId: 'you', atKm: 35, effort: 'steady'}]}), /valid playtest settings/);
});

test('bounded v93 race pays the 15 km order only after the marker', () => {
  const settings = {...base, chase: 'all', seed: 'sample-flat-finish'};
  const baseline = createV93CoastedPlaytest(settings);
  const changedSettings = {...settings, managerTacticalOrdersV2:
    [{teamId: 'you', atKm: 15, effort: 'hard'}]};
  const changed = createV93CoastedPlaytest(changedSettings);
  assert.equal(validateV93CoastedPlaytest(changedSettings, {}, changed), true);
  assert.deepEqual(changed.recording.frames.slice(0, 15),
    baseline.recording.frames.slice(0, 15));
  assert.ok(changed.recording.frames.slice(15).some((frame, index) =>
    frame.teamEnergy.find(row => row.teamId === 'you').mean !==
    baseline.recording.frames[index + 15].teamEnergy
      .find(row => row.teamId === 'you').mean));
  assert.equal(changed.individualLine.conditionalCrossings.length, 32);
});
