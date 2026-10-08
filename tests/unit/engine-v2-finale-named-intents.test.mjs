import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleLastKmNamedIntentsFromTour,
  validateFinaleLastKmNamedIntentsFromTour} from
  '../../lib/engine/v2/finale-last-km-named-intents.mjs';
import {recordFinaleRotationV91CandidateFromTour} from
  '../../lib/engine/v2/finale-rotation-v91-candidate.mjs';

function team(id,skill,gender,{attackAtKm=null,
  chase='ignore',rotate=false,effort='steady'}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:id==='a'?90:70,
    sprint:70,leadership:60,fatigue:0})),orders:{
    captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:[`${id}-2`,`${id}-3`],preset:'balanced',
    baseline:{effort,chase,attack:'none',breakWork:'cooperate',
      frontWork:rotate?'rotate':'sit_in'},
    phases:attackAtKm===null?[]:[{atKm:attackAtKm,
      attack:'selective',attackRiderId:`${id}-0`}]}};
}

test('two independent named attacks remain eligible without invented road moves',()=>{
  const stage={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  for(const gender of ['M','F']){
    const teams=[team('a',75,gender,{attackAtKm:39}),
      team('b',88,gender,{attackAtKm:39,rotate:true}),
      team('c',55,gender,{chase:'selective'}),
      team('d',80,gender,{rotate:true})];
    const tour=simulateTacticalTour({stage,teams,
      seed:`two-named-intents-${gender}`,
      motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const original=structuredClone(tour.provisionalResults);
    const intents=recordFinaleLastKmNamedIntentsFromTour(tour);
    assert.deepEqual(intents.eligibleNamedRiderIds,['a-0','b-0']);
    assert.deepEqual(intents.named.map(row=>row.decision),
      ['eligible','eligible']);
    assert.deepEqual(intents.unresolvedSelectiveChaseTeamIds,['c']);
    assert.equal(intents.roadOutcomeStatus,'unresolved');
    assert.equal(validateFinaleLastKmNamedIntentsFromTour(tour,
      JSON.parse(JSON.stringify(intents))),true);
    const forged=structuredClone(intents);
    forged.named[1].canEnterRoadContest=false;
    assert.throws(()=>validateFinaleLastKmNamedIntentsFromTour(tour,
      forged),/do not replay/);
    assert.throws(()=>recordFinaleRotationV91CandidateFromTour(tour,{
      attackTeamId:'a',tier:3,divisionIndex:1,divisionCount:1,
      plans:teams.map(row=>({teamId:row.id,
        finisherId:`${row.id}-0`,leadOutRiderId:null}))}),
    /needs one named attack/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('a named rider already dropped is recorded as blocked',()=>{
  const stage={distance_km:120,
    profile_points:[[0,100],[40,150],[80,100],[120,150]],
    keypoints:[{km:119,kind:'SPRINT'}]};
  const teams=[...Array.from({length:5},(_,i)=>team(`strong-${i}`,
    90,'M',{effort:'hard',rotate:true})),
  ...Array.from({length:10},(_,i)=>team(`weak-${i}`,
    55,'M',i===0?{attackAtKm:119,effort:'conserve'}:
      {effort:'conserve'}))];
  const tour=simulateTacticalTour({stage,teams,seed:'full-field-drop',
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const intents=recordFinaleLastKmNamedIntentsFromTour(tour);
  assert.deepEqual(intents.eligibleNamedRiderIds,[]);
  assert.equal(intents.named.length,1);
  assert.equal(intents.named[0].riderId,'weak-0-0');
  assert.equal(intents.named[0].sourceStatus,'dropped');
  assert.equal(intents.named[0].decision,'dropped');
  assert.equal(intents.named[0].canEnterRoadContest,false);
});

test('a lingering named phase is recorded without inventing a due attack',()=>{
  const stage={distance_km:41,
    profile_points:[[0,100],[41,100]]};
  const teams=[team('a',75,'M',{attackAtKm:36}),
    team('b',88,'M'),team('c',55,'M'),team('d',80,'M')];
  const tour=simulateTacticalTour({stage,teams,
    seed:'named-phase-not-due',
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const intents=recordFinaleLastKmNamedIntentsFromTour(tour);
  assert.equal(intents.named.length,1);
  assert.equal(intents.named[0].decision,'not_due');
  assert.deepEqual(intents.eligibleNamedRiderIds,[]);
  assert.equal(intents.named[0].sourcePendingKind,null);
});
