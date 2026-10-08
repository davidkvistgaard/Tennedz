import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleLastKmFieldHandoffFromTour,
  validateFinaleLastKmFieldHandoffFromTour} from
  '../../lib/engine/v2/finale-last-km-field-handoff.mjs';

function team(id,skill,{effort='conserve',rotate=false,
  attackAtKm=null}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender:'M',flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:skill,
    sprint:skill,leadership:60,fatigue:0})),orders:{
    captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:[`${id}-2`,`${id}-3`],preset:'balanced',
    baseline:{effort,attack:'none',chase:'ignore',
      breakWork:'cooperate',frontWork:rotate?'rotate':'sit_in'},
    phases:attackAtKm===null?[]:[{atKm:attackAtKm,
      attack:'selective',attackRiderId:`${id}-0`}]}};
}

test('v91 full-field handoff retains dropped deficits and all rider loads',()=>{
  const stage={distance_km:120,
    profile_points:[[0,100],[40,150],[80,100],[120,150]]};
  const teams=[...Array.from({length:5},(_,i)=>team(`strong-${i}`,
    90,{effort:'hard',rotate:true})),
  ...Array.from({length:10},(_,i)=>team(`weak-${i}`,
    55,{effort:'conserve'}))];
  const tour=simulateTacticalTour({stage,teams,seed:'full-field-drop',
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const source=tour.frames[118];
  const dropped=source.riderGroups.filter(row=>row.group==='dropped');
  assert.ok(dropped.length>0);
  const handoff=recordFinaleLastKmFieldHandoffFromTour(tour);
  assert.equal(handoff.sourceKm,119);
  assert.equal(handoff.startDistanceM,119000);
  assert.equal(handoff.riders.length,120);
  assert.equal(handoff.droppedRiderIds.length,dropped.length);
  for(const rider of handoff.riders){
    const original=source.riderGroups.find(row=>row.id===rider.riderId);
    assert.equal(rider.deficitSeconds,original.deficitSeconds);
    assert.equal(rider.energy,original.energy);
    assert.ok(Number.isFinite(rider.attackLoad));
  }
  assert.equal(validateFinaleLastKmFieldHandoffFromTour(tour,
    JSON.parse(JSON.stringify(handoff))),true);
  const forged=structuredClone(handoff);
  forged.riders.find(row=>row.status==='dropped').deficitSeconds=0;
  assert.throws(()=>validateFinaleLastKmFieldHandoffFromTour(tour,
    forged),/does not replay/);
});

test('handoff retains a prior named attack load and road membership',()=>{
  const stage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',75,{attackAtKm:35}),
    team('b',88,{rotate:true}),team('c',55),team('d',80)];
  teams[0].orders.phases.push({atKm:39,attack:'none'});
  const tour=simulateTacticalTour({stage,teams,
    seed:'solo-line-M',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const originalResults=structuredClone(tour.provisionalResults);
  const handoff=recordFinaleLastKmFieldHandoffFromTour(tour);
  assert.equal(handoff.riders.length,32);
  assert.ok(tour.frames.slice(35,39).some(frame=>
    frame.attackers.includes('a-0')));
  assert.ok(handoff.riders.find(row=>row.riderId==='a-0').attackLoad>0);
  assert.deepEqual(handoff.roadGroups,
    tour.frames[38].roadGroups);
  assert.deepEqual(tour.provisionalResults,originalResults);
});
