import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {startGeneralClassification,recordGeneralClassificationStage} from
  '../../lib/engine/v2/classification.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]],keypoints:[]};
const teams=['a','b'].map(id=>({id,riders:Array.from({length:8},(_,index)=>({
  id:`${id}${index}`,gender:'M',flat:70,strength:70,endurance:70,
  sprint:60,leadership:index===1?100:50,
})),orders:{captainId:`${id}0`,roadCaptainId:`${id}1`,
  preset:id==='a'?'protect':'aggressive',baseline:id==='a'?{
    chase:'ignore',attack:'none',effort:'conserve',
  }:{attackRiderId:'b0',attack:'repeated',effort:'hard'}}}));
const faster=new Set(['a1','a2','a3','a4','a5','a6','a7','b1','b2']);
const initial=startGeneralClassification({raceCategory:'M',riders:teams.flatMap(team=>
  team.riders.map(rider=>({riderId:rider.id,teamId:team.id,gender:'M'})))});
const classification=recordGeneralClassificationStage(initial,{stageId:'earlier-stage',
  classifiedTimes:teams.flatMap(team=>team.riders.map(rider=>({
    riderId:rider.id,timeSeconds:faster.has(rider.id)?3590:
      rider.id==='a0'?3600:rider.id==='b0'?3602:3610,
  })))});

test('a committed top-ten objective reacts to a real GC threat and remains replayable',()=>{
  const defending=structuredClone(teams);
  defending[0].orders.gcObjective='defend_top_ten';
  const common={stage,seed:'gc-defense-test',classification};
  const guarded=simulateTacticalTour({...common,teams:defending});
  const passive=simulateTacticalTour({...common,teams});
  const first=guarded.frames.find(frame=>frame.decisions.some(decision=>
    decision.teamId==='a'&&decision.kind==='chase_gc'));
  assert.ok(first,'the rival attack should endanger the prior tenth place');
  assert.ok(first.activeGcResponseTeamIds.includes('a'));
  assert.ok(first.chasers.includes('a'));
  assert.equal(passive.frames.some(frame=>frame.activeGcResponseTeamIds.includes('a')),false);
  assert.ok(guarded.frames.at(-1).teamEnergy.find(row=>row.teamId==='a').mean<
    passive.frames.at(-1).teamEnergy.find(row=>row.teamId==='a').mean);
  assert.equal(validateRecordedTour(guarded),true);
  const tampered=structuredClone(guarded);
  tampered.frames[first.km-1].activeGcResponseTeamIds=[];
  assert.throws(()=>validateRecordedTour(tampered),/GC response/);
});

test('GC defence requires a completed classification matching the race roster',()=>{
  const defending=structuredClone(teams);
  defending[0].orders.gcObjective='defend_top_ten';
  assert.throws(()=>simulateTacticalTour({stage,teams:defending,seed:'missing'}),
    /completed classification/);
  assert.throws(()=>simulateTacticalTour({stage,teams:defending,seed:'wrong',
    classification:{...classification,raceCategory:'F'}}),/GC classification/);
});

test('the same break does not trigger a GC chase when its rider cannot reach the top ten',()=>{
  const defending=structuredClone(teams);
  defending[0].orders.gcObjective='defend_top_ten';
  const harmless=recordGeneralClassificationStage(initial,{stageId:'earlier-stage',
    classifiedTimes:teams.flatMap(team=>team.riders.map(rider=>({
      riderId:rider.id,timeSeconds:faster.has(rider.id)?3590:
        rider.id==='a0'?3600:rider.id==='b0'?3700:3610,
    })))});
  const recording=simulateTacticalTour({stage,teams:defending,seed:'gc-defense-test',
    classification:harmless});
  assert.ok(recording.frames.some(frame=>frame.breakawayRiderIds.includes('b0')));
  assert.equal(recording.frames.some(frame=>frame.decisions.some(decision=>
    decision.kind==='chase_gc')),false);
  assert.equal(validateRecordedTour(recording),true);
});
