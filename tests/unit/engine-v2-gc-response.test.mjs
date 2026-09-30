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
  assert.equal(recording.frames.some(frame=>frame.gcCounterTeamIds.includes('a')),false);
  assert.equal(validateRecordedTour(recording),true);
});

test('GC defence stays deterministic across input order and rider category',()=>{
  for(const raceCategory of ['M','F']){
    const cast=structuredClone(teams);
    for(const team of cast)for(const rider of team.riders)rider.gender=raceCategory;
    cast[0].orders.gcObjective='defend_top_ten';
    const start=startGeneralClassification({raceCategory,
      riders:cast.flatMap(team=>team.riders.map(rider=>({
        riderId:rider.id,teamId:team.id,gender:raceCategory,
      })))});
    const before=recordGeneralClassificationStage(start,{stageId:'earlier-stage',
      classifiedTimes:teams.flatMap(team=>team.riders.map(rider=>({
        riderId:rider.id,timeSeconds:faster.has(rider.id)?3590:
          rider.id==='a0'?3600:rider.id==='b0'?3602:3610,
      })))});
    const common={stage,seed:`gc-${raceCategory}`,classification:before};
    const first=simulateTacticalTour({...common,teams:cast});
    const reordered=simulateTacticalTour({...common,teams:cast.reverse().map(team=>({
      ...team,riders:team.riders.reverse(),
    }))});
    assert.deepEqual(first,reordered);
    assert.equal(validateRecordedTour(first),true);
  }
});

test('an eleventh-place leader can commit to a costly late top-ten attack',()=>{
  const challenging=structuredClone(teams);
  challenging[1].orders.gcObjective='target_top_ten';
  challenging[1].orders.baseline={attack:'none',chase:'ignore',effort:'conserve'};
  const common={stage,seed:'gc-target-test',classification};
  const active=simulateTacticalTour({...common,teams:challenging});
  const quiet=structuredClone(challenging);
  quiet[1].orders.gcObjective='stage_result';
  const passive=simulateTacticalTour({...common,teams:quiet});
  const first=active.frames.find(frame=>frame.decisions.some(decision=>
    decision.teamId==='b'&&decision.kind==='target_gc'));
  assert.ok(first);
  assert.equal(first.km,20);
  assert.ok(active.frames.some(frame=>frame.attackers.includes('b0')));
  assert.ok(active.frames.some(frame=>frame.decisions.some(decision=>
    decision.teamId==='b'&&decision.kind==='end_gc_target')));
  assert.equal(passive.frames.some(frame=>frame.attackers.includes('b0')),false);
  assert.ok(active.frames.at(-1).teamEnergy.find(row=>row.teamId==='b').mean<
    passive.frames.at(-1).teamEnergy.find(row=>row.teamId==='b').mean);
  assert.equal(validateRecordedTour(active),true);
  const tampered=structuredClone(active);
  tampered.frames[first.km-1].activeGcTargetTeamIds=[];
  assert.throws(()=>validateRecordedTour(tampered),/GC target/);
});

test('a distant GC target does not force futile attacks or override a named rider',()=>{
  const challenging=structuredClone(teams);
  challenging[1].orders.gcObjective='target_top_ten';
  challenging[1].orders.baseline={attack:'none',chase:'ignore'};
  const far=recordGeneralClassificationStage(initial,{stageId:'earlier-stage',
    classifiedTimes:teams.flatMap(team=>team.riders.map(rider=>({
      riderId:rider.id,timeSeconds:faster.has(rider.id)?3590:
        rider.id==='a0'?3600:rider.id==='b0'?3700:3610,
    })))});
  const distant=simulateTacticalTour({stage,teams:challenging,seed:'gc-target-far',
    classification:far});
  assert.equal(distant.frames.some(frame=>frame.activeGcTargetTeamIds.includes('b')),false);
  challenging[1].orders.baseline.attackRiderId='b2';
  const named=simulateTacticalTour({stage,teams:challenging,seed:'gc-target-named',
    classification});
  assert.equal(named.frames.some(frame=>frame.activeGcTargetTeamIds.includes('b')),false);
  assert.equal(validateRecordedTour(named),true);
});

test('a prepared GC team counters a nearby rival attack in the same kilometre',()=>{
  const cast=structuredClone(teams);
  cast[0].orders.gcObjective='defend_top_ten';
  cast[1].orders.gcObjective='target_top_ten';
  cast[1].orders.baseline={attack:'none',chase:'ignore',effort:'conserve'};
  for(const rider of cast[0].riders.slice(2))Object.assign(rider,{
    flat:90,strength:90,endurance:90,
  });
  const race=simulateTacticalTour({stage,teams:cast,seed:'gc-counter-test',classification});
  const counter=race.frames.find(frame=>frame.gcCounterTeamIds.includes('a'));
  assert.ok(counter,'the GC guard should counter an attack as it is launched');
  assert.ok(counter.attackers.includes('b0'));
  assert.ok(counter.chasers.includes('a'));
  assert.equal(validateRecordedTour(race),true);
  const forged=structuredClone(race);
  forged.frames[counter.km-1].gcCounterTeamIds=[];
  assert.throws(()=>validateRecordedTour(forged),/GC attack counter/);
});
