import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';
import {probeLastKmNamedAttackRoadFromTour,
  validateLastKmNamedAttackRoadFromTour} from
  '../../lib/engine/v2/finale-last-km-named-attack.mjs';
import {recordFinaleSprintApproachFromTour,
  validateFinaleSprintApproachFromTour} from
  '../../lib/engine/v2/finale-sprint-approach.mjs';
import {recordFinaleSprintRunFromTour,
  validateFinaleSprintRunFromTour,
  FINALE_SPRINT_RUN_FATIGUE_VERSION} from
  '../../lib/engine/v2/finale-sprint-run.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]],
  keypoints:[{km:10,kind:'SPRINT'},{km:20,kind:'SPRINT'},
    {km:39,kind:'SPRINT'}]};
function team(index,gender){
  const id=`t${String(index).padStart(2,'0')}`;
  const skill=index===0?57:65+(index*7)%15;
  return {id,riders:Array.from({length:8},(_,riderIndex)=>({
    id:`${id}-${riderIndex}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:70,acceleration:index===0?95:70,
    sprint:50+(index*11)%51,leadership:60})),orders:{captainId:`${id}-0`,
    roadCaptainId:`${id}-1`,helperIds:[`${id}-2`],
    preset:'balanced',baseline:{effort:'conserve',
      chase:index%3===0?'all':'ignore',attack:'none',
      breakWork:'cooperate'},phases:index===0?[{atKm:39,
      attack:'selective',attackRiderId:`${id}-0`}]:[]}};
}

test('twenty-team v91 source accounts for all riders through catch and paid lead-out',()=>{
  for(const gender of ['M','F']){
    const tour=simulateTacticalTour({stage,
      teams:Array.from({length:20},(_,index)=>team(index,gender)),
      seed:`twenty-${gender}`,motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const road=probeLastKmNamedAttackRoadFromTour(tour,{teamId:'t00'});
    assert.equal(road.frames[0].attack.status,'split');
    assert.deepEqual(road.frames.map(frame=>frame.roadGroups.length),
      [1,0,0,0,0,0,0]);
    assert.equal(road.linePelotonRiderIds.length,160);
    assert.equal(road.lineRiderEnergy.length,160);
    assert.equal(validateLastKmNamedAttackRoadFromTour(tour,
      {teamId:'t00'},road),true);
    const input={attackTeamId:'t00',plans:tour.committedInputs.teams
      .map(row=>({teamId:row.id,finisherId:row.orders.captainId,
        leadOutRiderId:`${row.id}-2`}))};
    const provisionalBefore=structuredClone(tour.provisionalResults);
    const approach=recordFinaleSprintApproachFromTour(tour,input);
    assert.equal(approach.frames.length,2);
    assert.equal(approach.energyAt300M.length,160);
    assert.ok(approach.frames.every(frame=>
      frame.riderEnergy.filter(row=>row.role==='lead_out').length===20&&
      frame.riderEnergy.every(row=>row.energyAfter>=0)));
    assert.equal(validateFinaleSprintApproachFromTour(tour,input,
      approach),true);
    const sprint=recordFinaleSprintRunFromTour(tour,input);
    assert.equal(sprint.endDistanceM,40000);
    assert.equal(sprint.lineRiderEnergy.length,160);
    assert.ok(sprint.frames.every(frame=>
      frame.riderEnergy.filter(row=>row.role==='sprint').length===20&&
      frame.riderEnergy.every(row=>row.energyAfter>=0)));
    assert.ok(sprint.lineRiderEnergy.some(row=>row.gainSeconds>0));
    assert.ok(sprint.lineRiderEnergy.some(row=>row.riderId.endsWith('-0')&&
      row.gainSeconds===0));
    assert.equal(validateFinaleSprintRunFromTour(tour,input,sprint),true);
    const bounded=recordFinaleSprintRunFromTour(tour,input,{
      version:FINALE_SPRINT_RUN_FATIGUE_VERSION});
    assert.equal(bounded.lineRiderEnergy.length,160);
    assert.equal(validateFinaleSprintRunFromTour(tour,input,bounded),true);
    assert.deepEqual(tour.provisionalResults,provisionalBefore);
    const provisionalById=new Map(tour.provisionalResults.map(row=>
      [row.riderId,row]));
    const lineById=new Map(bounded.lineRiderEnergy.map(row=>
      [row.riderId,row]));
    const nominated=new Set(input.plans.map(plan=>plan.finisherId));
    const gainers=bounded.lineRiderEnergy.filter(row=>row.gainSeconds>0);
    const changedEnergy=bounded.lineRiderEnergy.filter(row=>
      row.energyAfter!==provisionalById.get(row.riderId).energy);
    const provisionalTop=tour.provisionalResults[0];
    // The kilometre result is a different model's placing and energy. It
    // cannot silently classify this short-step trace or feed its awards.
    assert.equal(provisionalTop.position,1);
    assert.equal(nominated.has(provisionalTop.riderId),false);
    assert.equal(lineById.get(provisionalTop.riderId).gainSeconds,0);
    assert.equal(gainers.length,12);
    assert.equal(changedEnergy.length,160);
    assert.ok(provisionalById.get(gainers.toSorted((a,b)=>
      b.gainSeconds-a.gainSeconds)[0].riderId).position>1);
  }
});
