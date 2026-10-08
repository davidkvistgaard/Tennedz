import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleRotationV91CandidateFromTour} from
  '../../lib/engine/v2/finale-rotation-v91-candidate.mjs';
import {probeFinaleRotationSoloFirstTimingFromTour,
  validateFinaleRotationSoloFirstTimingFromTour} from
  '../../lib/engine/v2/finale-rotation-solo-first-timing.mjs';
import {pointsForDivisionResult} from
  '../../lib/calendar/points.mjs';

function team(id,skill,gender,{attack=false,rotate=false,
  chase='ignore'}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:id==='a'?90:70,
    sprint:70,leadership:60,fatigue:0})),orders:{
    captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:[`${id}-2`,`${id}-3`],preset:'balanced',
    baseline:{effort:'steady',chase,attack:'none',
      breakWork:'cooperate',frontWork:rotate?'rotate':'sit_in'},
    phases:attack?[{atKm:39,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

test('a paid solo line proves only the first rider and relative time',()=>{
  const stage={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  for(const gender of ['M','F']){
    const teams=[team('a',75,gender,{attack:true}),
      team('b',88,gender,{rotate:true}),
      team('c',55,gender,{rotate:true,chase:'all'}),
      team('d',80,gender,{rotate:true})];
    const tour=simulateTacticalTour({stage,teams,
      seed:`solo-line-${gender}`,
      motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const input={attackTeamId:'a',tier:3,divisionIndex:1,
      divisionCount:1,plans:teams.map(row=>({teamId:row.id,
        finisherId:`${row.id}-0`,leadOutRiderId:null}))};
    const result=probeFinaleRotationSoloFirstTimingFromTour(tour,input);
    assert.equal(result.firstRiderId,'a-0');
    assert.ok(result.gapAtLineSeconds>0);
    assert.ok(result.firstRiderElapsedSecondsFromLastKmStart>0);
    assert.ok(result.firstRiderElapsedSecondsFromLastKmStart<
      result.bunchElapsedSecondsFromLastKmStart);
    assert.ok(Math.abs(result.bunchElapsedSecondsFromLastKmStart-
      result.firstRiderElapsedSecondsFromLastKmStart-
      result.gapAtLineSeconds)<1e-7);
    assert.equal(result.remainingRiderCount,31);
    assert.equal(result.remainingPlacesUnresolved,true);
    assert.equal(result.canCommitAwards,false);
    const candidate=recordFinaleRotationV91CandidateFromTour(tour,input);
    const firstPoints=candidate.pointBounds.riders.find(row=>
      row.riderId===result.firstRiderId);
    assert.equal(firstPoints.firstPossiblePlace,1);
    assert.equal(firstPoints.lastPossiblePlace,1);
    assert.equal(firstPoints.minPossiblePoints,
      pointsForDivisionResult({tier:3,resultType:'ONE_DAY',placing:1,
        multiplier:candidate.pointBounds.multiplier}));
    assert.equal(firstPoints.maxPossiblePoints,
      firstPoints.minPossiblePoints);
    assert.deepEqual(candidate.pointBounds.awardRows,[]);
    const otherFinisher={...input,plans:input.plans.map(plan=>
      plan.teamId==='a'?{...plan,finisherId:'a-2'}:plan)};
    assert.deepEqual(probeFinaleRotationSoloFirstTimingFromTour(tour,
      otherFinisher),result);
    assert.equal(validateFinaleRotationSoloFirstTimingFromTour(tour,input,
      JSON.parse(JSON.stringify(result))),true);
    assert.throws(()=>validateFinaleRotationSoloFirstTimingFromTour(tour,
      input,{...result,gapAtLineSeconds:0}),/does not replay/);
  }
});

test('first-rider timing refuses a merged line',()=>{
  const stage={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',60,'M',{attack:true}),
    team('b',88,'M',{rotate:true}),
    team('c',55,'M',{rotate:true,chase:'all'}),
    team('d',80,'M',{rotate:true})];
  const tour=simulateTacticalTour({stage,teams,
    seed:'attack-with-rotation-M',
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const input={attackTeamId:'a',tier:3,divisionIndex:1,
    divisionCount:1,plans:teams.map(row=>({teamId:row.id,
      finisherId:`${row.id}-0`,leadOutRiderId:null}))};
  assert.throws(()=>probeFinaleRotationSoloFirstTimingFromTour(tour,input),
    /needs a surviving solo branch/);
});
