import assert from 'node:assert/strict';
import {test} from 'node:test';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from '../../lib/engine/v2/tuning.mjs';
import {orderAt} from '../../lib/engine/v2/orders.mjs';

const common={distanceKm:40,seed:'focus-1',attack:'none',chase:'all',
  rivalPlans:['attack','passive','passive']};

test('a named rival chase focus changes paid pursuit and remains replayable',()=>{
  const race=target=>{
    const prepared=prepareV91Playtest({...common,
      managerTacticalOrdersV7:[{teamId:'you',atKm:5,chaseTarget:target}]});
    const recording=simulateTacticalTour({...prepared,
      motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
    validateRecordedTour(recording);
    assert.deepEqual(recording,simulateTacticalTour({...prepared,
      motorVersion:MOTOR_EXHAUSTION_COAST_VERSION}));
    return recording;
  };
  const relevant=race('rival-1'),absent=race('rival-2');
  assert.equal(relevant.frames.filter(frame=>frame.chasers.includes('you')).length,1);
  assert.equal(absent.frames.filter(frame=>frame.chasers.includes('you')).length,0);
  assert.ok(absent.frames.some(frame=>frame.withheldChaseTeamIds.includes('you')));
  const ownReserve=recording=>recording.frames.at(-1).riderGroups
    .filter(rider=>rider.teamId==='you')
    .reduce((sum,rider)=>sum+rider.energy,0);
  assert.ok(ownReserve(absent)>ownReserve(relevant));
  assert.ok(relevant.frames.some(frame=>frame.attackers.some(id=>
    id.startsWith('rival-1'))));
});

test('a later route marker clears the rival focus without changing the chase order',()=>{
  const prepared=prepareV91Playtest({...common,managerTacticalOrdersV7:[
    {teamId:'you',atKm:5,chaseTarget:'rival-1-2',chase:'all'},
    {teamId:'you',atKm:10,chaseTarget:null}]});
  const orders=prepared.teams[0].orders;
  assert.equal(orderAt(orders,9).chaseTarget,'rival-1-2');
  assert.equal(orderAt(orders,10).chaseTarget,null);
  assert.equal(orderAt(orders,10).chase,'all');
});

test('a chase focus cannot name an own rider or an absent rival',()=>{
  for(const target of ['you-1','rival-4','rival-1-8'])assert.throws(()=>
    prepareV91Playtest({...common,managerTacticalOrdersV7:[
      {teamId:'you',atKm:5,chaseTarget:target}]}),/valid playtest settings/);
});
