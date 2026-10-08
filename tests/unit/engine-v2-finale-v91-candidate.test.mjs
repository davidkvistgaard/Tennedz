import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleRotationV91CandidateFromTour,
  validateFinaleRotationV91CandidateFromTour} from
  '../../lib/engine/v2/finale-rotation-v91-candidate.mjs';

function team(id,skill,{attack=false,rotate=false,chase='ignore',
  attackAtKm,fatigue=0,effort='steady',gender='M'}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:id==='a'?90:70,
    sprint:70,leadership:60,fatigue})),orders:{
    captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:[`${id}-2`,`${id}-3`],preset:'balanced',
    baseline:{effort,chase,attack:'none',breakWork:'cooperate',
      frontWork:rotate?'rotate':'sit_in'},
    phases:attack?[{atKm:attackAtKm,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

test('one read-only candidate binds all measured narrow v91 outcomes',()=>{
  const cases=[
    {distanceKm:40,skill:56,b:95,c:95,effort:'conserve',
      seed:'contained-rotation-M',branch:'contained'},
    {distanceKm:180,skill:70,fatigue:40,
      seed:'fatigue-180',branch:'caught'},
    {distanceKm:40,skill:60,
      seed:'attack-with-rotation-M',branch:'first_catch'},
    {distanceKm:180,skill:65,
      seed:'second-catch-M-all',branch:'second_catch'},
    {distanceKm:40,skill:65,
      seed:'attack-with-rotation-M',branch:'late_catch'},
    {distanceKm:40,skill:67,
      seed:'scan-40',branch:'penultimate_catch'},
    {distanceKm:40,skill:68,
      seed:'scan-40',branch:'final_contact'},
    {distanceKm:40,skill:75,
      seed:'solo-line-M',branch:'surviving_solo'}];
  for(const row of cases)for(const gender of ['M','F']){
    const stage={distance_km:row.distanceKm,
      profile_points:[[0,100],[row.distanceKm,100]],
      keypoints:[{km:row.distanceKm-1,kind:'SPRINT'}]};
    const tour=simulateTacticalTour({stage,teams:[
      team('a',row.skill,{attack:true,
        attackAtKm:row.distanceKm-1,fatigue:row.fatigue,
        effort:row.effort,gender}),
      team('b',row.b??88,{rotate:true,gender}),
      team('c',row.c??55,{rotate:row.branch!=='contained',
        chase:'all',gender}),
      team('d',80,{rotate:true,gender})],
    seed:row.seed.replaceAll('-M',`-${gender}`),
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const oldResults=structuredClone(tour.provisionalResults);
    const input={attackTeamId:'a',tier:3,divisionIndex:1,
      divisionCount:1,plans:['a','b','c','d'].map(teamId=>({
        teamId,finisherId:`${teamId}-0`,leadOutRiderId:null}))};
    const candidate=recordFinaleRotationV91CandidateFromTour(tour,input);
    assert.equal(candidate.branch,row.branch);
    assert.equal(candidate.line.endDistanceM,row.distanceKm*1000);
    assert.equal(candidate.line.lineRiderEnergy.length,32);
    assert.equal(candidate.bounds.riders.length,32);
    assert.equal(candidate.pointBounds.riders.length,32);
    assert.equal(candidate.resultStatus,'unclassified');
    assert.equal(candidate.pointsStatus,'withheld');
    assert.equal(candidate.canCommitAwards,false);
    assert.deepEqual(candidate.pointBounds.awardRows,[]);
    assert.equal(candidate.planStatus,
      ['final_contact','surviving_solo'].includes(row.branch)?
        'recorded_unapplied':'applied');
    if(candidate.planStatus==='recorded_unapplied'){
      const changedPlan={...input,plans:input.plans.map(plan=>
        plan.teamId==='b'?{...plan,finisherId:'b-2'}:plan)};
      const changed=recordFinaleRotationV91CandidateFromTour(tour,
        changedPlan);
      assert.notDeepEqual(changed.plan,candidate.plan);
      assert.deepEqual(changed.line,candidate.line);
      assert.deepEqual(changed.bounds,candidate.bounds);
    }
    assert.equal(validateFinaleRotationV91CandidateFromTour(tour,input,
      JSON.parse(JSON.stringify(candidate))),true);
    assert.throws(()=>validateFinaleRotationV91CandidateFromTour(tour,
      input,{...candidate,branch:'fabricated'}),/does not replay/);
    assert.deepEqual(tour.provisionalResults,oldResults);
  }
});
