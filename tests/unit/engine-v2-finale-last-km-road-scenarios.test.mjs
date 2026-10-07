import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';
import {probeLastKmNamedAttackRoadFromTour,
  validateLastKmNamedAttackRoadFromTour} from
  '../../lib/engine/v2/finale-last-km-named-attack.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]],
  keypoints:[{km:10,kind:'SPRINT'},{km:20,kind:'SPRINT'},
    {km:39,kind:'SPRINT'}]};
function team(id,skill,gender,chase,attack){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:id==='a'?90:70,
    sprint:50,leadership:60})),orders:{captainId:`${id}-0`,
    roadCaptainId:`${id}-1`,helperIds:[`${id}-2`],preset:'balanced',
    baseline:{effort:'conserve',chase,attack:'none',
      breakWork:'cooperate'},phases:attack?[{atKm:39,
      attack:'selective',attackRiderId:`${id}-0`}]:[]}};
}

test('independent v91 managers reach the line with recorded solo and catch branches',()=>{
  for(const gender of ['M','F'])for(const scenario of [
    {attacker:90,defender:60,chase:'ignore',survives:true},
    {attacker:60,defender:80,chase:'all',survives:false},
  ]){
    const tour=simulateTacticalTour({stage,teams:[
      team('a',scenario.attacker,gender,'ignore',true),
      team('b',scenario.defender,gender,scenario.chase,false)],
    seed:`last-km-road-${gender}-${scenario.attacker}-${scenario.defender}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const trace=probeLastKmNamedAttackRoadFromTour(tour,{teamId:'a'});
    assert.equal(trace.frames.length,7);
    assert.equal(trace.frames[0].attack.status,'split');
    assert.equal(trace.lineRoadGroups.length,Number(scenario.survives));
    assert.equal(trace.linePelotonRiderIds.length,
      scenario.survives?15:16);
    assert.equal(trace.lineRiderEnergy.length,16);
    assert.equal(trace.frames.at(-1).endDistanceM,40000);
    assert.equal(validateLastKmNamedAttackRoadFromTour(tour,
      {teamId:'a'},trace),true);
    if(scenario.chase==='all'){
      assert.ok(trace.frames.some(frame=>frame.chaseRiderId==='b-2'));
      assert.ok(trace.frames.some(frame=>frame.riderEnergy.some(row=>
        row.riderId==='b-2'&&row.role==='pull'&&row.energySpent>0)));
    }
  }
});
