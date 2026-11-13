import test from 'node:test';
import assert from 'node:assert/strict';
import {planBunchFrontTurnsV1} from
  '../../lib/engine/v2/bunch-front-turns-v1.mjs';
import {riderKilometreEffect} from '../../lib/engine/v2/physiology.mjs';
import {TUNING} from '../../lib/engine/v2/tuning.mjs';

const segment={km:1,terrain:'flat',gradientPct:0,surface:'road',
  exposed:false,weather:{temperatureC:16,windKph:0,rainMm:0}};
const team={id:'a',energy:{'a-1':70,'a-2':60},riders:[
  {id:'a-1',flat:80,endurance:70,strength:75,timetrial:70},
  {id:'a-2',flat:70,endurance:70,strength:75,timetrial:70}]};
const skills=team.riders.map(row=>riderKilometreEffect(row,segment,
  {phase:'cruise',energy:team.energy[row.id],exposed:false}).ability);
const paidPace={teamId:'a',effort:'hard',riderIds:['a-1','a-2'],
  ability:(skills[0]+skills[1])/2+
    TUNING.groups.frontPaceAdjustmentPoints.hard};

test('one front position rotates while the other named helper shelters',()=>{
  const first=planBunchFrontTurnsV1({paidPace,teams:[team],segment,km:1});
  assert.deepEqual(first.turns.map(row=>[row.leaderRiderId,row.startM,
    row.endM]),[['a-1',0,500],['a-2',500,1000]]);
  assert.deepEqual(first.extraEnergyCosts.map(row=>row.extraCost),[.15,.15]);
  assert.equal(first.ability,paidPace.ability);
  const second=planBunchFrontTurnsV1({paidPace,teams:[team],
    segment:{...segment,km:2},km:2});
  assert.equal(second.turns[0].leaderRiderId,'a-2');
  assert.throws(()=>planBunchFrontTurnsV1({paidPace:{...paidPace,
    ability:paidPace.ability+2},teams:[team],segment,km:1}),/differs/);
});

test('a named front worker must have enough reserve for the exposed share',()=>{
  const exhausted={...team,energy:{...team.energy,'a-1':.1}};
  const ability=exhausted.riders.map(row=>riderKilometreEffect(row,segment,
    {phase:'cruise',energy:exhausted.energy[row.id],
      exposed:false}).ability);
  assert.throws(()=>planBunchFrontTurnsV1({paidPace:{...paidPace,
    ability:(ability[0]+ability[1])/2+
      TUNING.groups.frontPaceAdjustmentPoints.hard},
  teams:[exhausted],segment,km:1}),/cannot pay/);
});
