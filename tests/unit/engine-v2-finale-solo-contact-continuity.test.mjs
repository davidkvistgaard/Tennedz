import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {decideFinaleRotationSoloOutcomeFromTour} from
  '../../lib/engine/v2/finale-rotation-solo-slice.mjs';
import {decideLastKmRotationOutcomeFromTour,
  validateLastKmRotationOutcomeFromTour} from
  '../../lib/engine/v2/finale-last-km-rotation-outcome.mjs';

function team(id,skill,{attack=false,rotate=false,chase='ignore',
  gender='M',attackAtKm,fatigue=0}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:id==='a'?90:70,
    sprint:70,leadership:60,fatigue})),orders:{captainId:`${id}-0`,
    roadCaptainId:`${id}-1`,helperIds:[`${id}-2`,`${id}-3`],
    preset:'balanced',baseline:{effort:'steady',chase,
      attack:'none',breakWork:'cooperate',
      frontWork:rotate?'rotate':'sit_in'},
    phases:attack?[{atKm:attackAtKm,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

const branchOrder=['first_catch','second_catch','late_catch',
  'penultimate_catch','final_contact','surviving_solo'];

test('a stronger solo delays contact across recorded long-route fields',()=>{
  for(const gender of ['M','F'])for(const distanceKm of [40,180,300]){
    const stage={distance_km:distanceKm,
      profile_points:[[0,100],[distanceKm,100]],
      keypoints:[{km:distanceKm-1,kind:'SPRINT'}]};
    let previousBranch=-1,previousContact=0,seenCatch=false;
    let seenSurvival=false;
    for(let skill=65;skill<=74;skill++){
      const tour=simulateTacticalTour({stage,teams:[
        team('a',skill,{attack:true,gender,
          attackAtKm:distanceKm-1}),
        team('b',88,{rotate:true,gender}),
        team('c',55,{rotate:true,chase:'all',gender}),
        team('d',80,{rotate:true,gender})],
      seed:`scan-${distanceKm}`,motorVersion:MOTOR_ATTACK_TRACE_VERSION});
      const outcome=decideFinaleRotationSoloOutcomeFromTour(tour,{
        attackTeamId:'a'});
      const branchIndex=branchOrder.indexOf(outcome.branch);
      assert.ok(branchIndex>=previousBranch,
        `${gender} ${distanceKm} km skill ${skill} moved contact earlier`);
      if(outcome.catchDistanceM===null){
        assert.equal(outcome.branch,'surviving_solo');
        seenSurvival=true;
      }else{
        assert.ok(outcome.catchDistanceM>previousContact,
          `${gender} ${distanceKm} km skill ${skill} moved contact backwards`);
        assert.ok(outcome.catchDistanceM>distanceKm*1000-500&&
          outcome.catchDistanceM<distanceKm*1000);
        previousContact=outcome.catchDistanceM;
        seenCatch=true;
      }
      previousBranch=branchIndex;
    }
    assert.ok(seenCatch&&seenSurvival);
  }
});

test('start fatigue moves contact earlier or refuses an earlier unmodeled catch',()=>{
  for(const {distanceKm,skill,expected} of [
    {distanceKm:40,skill:70,
      expected:['surviving_solo','late_catch','first_catch']},
    {distanceKm:300,skill:75,
      expected:['surviving_solo','late_catch','first_catch']}]){
    const stage={distance_km:distanceKm,
      profile_points:[[0,100],[distanceKm,100]],
      keypoints:[{km:distanceKm-1,kind:'SPRINT'}]};
    const decisions=[];
    for(const fatigue of [0,20,40]){
      const tour=simulateTacticalTour({stage,teams:[
        team('a',skill,{attack:true,attackAtKm:distanceKm-1,
          fatigue}),
        team('b',88,{rotate:true}),
        team('c',55,{rotate:true,chase:'all'}),
        team('d',80,{rotate:true})],
      seed:`fatigue-${distanceKm}`,
      motorVersion:MOTOR_ATTACK_TRACE_VERSION});
      decisions.push(decideFinaleRotationSoloOutcomeFromTour(tour,{
        attackTeamId:'a'}));
    }
    assert.deepEqual(decisions.map(row=>row.branch),expected);
    assert.ok(decisions[1].catchDistanceM>
      decisions[2].catchDistanceM);
  }
  const distanceKm=180;
  const stage={distance_km:distanceKm,
    profile_points:[[0,100],[distanceKm,100]],
    keypoints:[{km:179,kind:'SPRINT'}]};
  const tired=simulateTacticalTour({stage,teams:[
    team('a',70,{attack:true,attackAtKm:179,fatigue:40}),
    team('b',88,{rotate:true}),
    team('c',55,{rotate:true,chase:'all'}),
    team('d',80,{rotate:true})],
  seed:'fatigue-180',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.throws(()=>decideFinaleRotationSoloOutcomeFromTour(tired,{
    attackTeamId:'a'}),/needs a merged-work continuation rule/);
});

test('the measured 500 m handoff routes fatigue to solo or caught',()=>{
  const distanceKm=180;
  const stage={distance_km:distanceKm,
    profile_points:[[0,100],[distanceKm,100]],
    keypoints:[{km:179,kind:'SPRINT'}]};
  for(const fatigue of [0,20,40,60]){
    const tour=simulateTacticalTour({stage,teams:[
      team('a',70,{attack:true,attackAtKm:179,fatigue}),
      team('b',88,{rotate:true}),
      team('c',55,{rotate:true,chase:'all'}),
      team('d',80,{rotate:true})],
    seed:'fatigue-180',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const input={teamId:'a'};
    const decision=decideLastKmRotationOutcomeFromTour(tour,input);
    assert.equal(decision.branch,fatigue>=40?'caught':'solo');
    assert.equal(decision.handoffDistanceM,179500);
    assert.equal(decision.roadGroupCount,fatigue>=40?0:1);
    assert.equal(decision.pelotonRiderCount,fatigue>=40?32:31);
    assert.equal(decision.riderEnergyCount,32);
    assert.equal(validateLastKmRotationOutcomeFromTour(tour,input,
      JSON.parse(JSON.stringify(decision))),true);
    assert.throws(()=>validateLastKmRotationOutcomeFromTour(tour,input,
      {...decision,branch:'contained'}),/does not replay/);
  }
  const containedStage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const attacker=team('a',56,{attack:true,attackAtKm:39});
  attacker.orders.baseline.effort='conserve';
  const contained=simulateTacticalTour({stage:containedStage,
    teams:[attacker,team('b',95,{rotate:true}),
      team('c',95,{chase:'all'}),team('d',80,{rotate:true})],
    seed:'contained-rotation-M',
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const decision=decideLastKmRotationOutcomeFromTour(contained,{
    teamId:'a'});
  assert.equal(decision.branch,'contained');
  assert.equal(decision.roadGroupCount,0);
  assert.equal(decision.pelotonRiderCount,32);
});
