import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {normalizeOrders} from '../../lib/engine/v2/orders.mjs';
import {resolveTacticalKilometre} from '../../lib/engine/v2/tactics.mjs';
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

test('a GC defender keeps its leader back during an unnamed attack but honours a named move',()=>{
  const make=(id,gcObjective,attackRiderId)=>{
    const riderIds=Array.from({length:8},(_,index)=>`${id}${index}`);
    return {id,riders:riderIds.map((riderId,index)=>({id:riderId,gender:'M',
      flat:index===0?100:60,strength:index===0?100:60,
      acceleration:index===0?100:60,endurance:70})),
    orders:normalizeOrders({captainId:riderIds[0],roadCaptainId:riderIds[1],
      gcObjective,preset:'balanced',baseline:{attack:'selective',chase:'ignore',
        ...(attackRiderId===undefined?{}:{attackRiderId})}},
    {riderIds,distanceKm:40}),
    energy:Object.fromEntries(riderIds.map(riderId=>[riderId,100])),
    attackLoad:Object.fromEntries(riderIds.map(riderId=>[riderId,0])),
    activeLeaderId:riderIds[0]};
  };
  const opponent=make('b','stage_result');
  opponent.orders.baseline.attack='none';
  const attempt=defender=>resolveTacticalKilometre({teams:[defender,opponent],
    km:20,distanceKm:40}).attackers[0].riderId;
  assert.equal(attempt(make('a','stage_result')),'a0');
  assert.notEqual(attempt(make('a','defend_top_ten')),'a0');
  assert.equal(attempt(make('a','defend_top_ten','a0')),'a0');
});

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

test('a GC challenger can attack behind a teammate already in the break',()=>{
  const cast=structuredClone(teams);
  cast[1].orders.gcObjective='target_top_ten';
  cast[1].orders.baseline={attack:'none',chase:'ignore',effort:'conserve'};
  cast[1].orders.phases=[
    {atKm:10,attack:'selective',attackRiderId:'b2'},
    {atKm:20,attack:'none',attackRiderId:null},
  ];
  Object.assign(cast[1].riders[2],{flat:95,strength:95,endurance:95});
  const route={...stage,keypoints:[{km:11,kind:'SPRINT'},{km:21,kind:'SPRINT'}]};
  const race=simulateTacticalTour({stage:route,teams:cast,
    seed:'gc-target-with-teammate-ahead',classification});
  assert.ok(race.frames[10].breakawayRiderIds.includes('b2'));
  assert.ok(race.frames[19].breakawayRiderIds.includes('b2'));
  assert.ok(race.frames[20].attackers.includes('b0'));
  assert.equal(validateRecordedTour(race),true);
});

test('a GC defender can stop its forward helper and chase a real top-ten threat',()=>{
  const cast=structuredClone(teams);
  cast[0].orders.gcObjective='defend_top_ten';
  cast[0].orders.baseline={attack:'none',chase:'ignore',effort:'conserve'};
  cast[0].orders.phases=[
    {atKm:10,attack:'selective',attackRiderId:'a2'},
    {atKm:20,attack:'none',attackRiderId:null},
  ];
  Object.assign(cast[0].riders[2],{flat:95,strength:95,endurance:95});
  cast[1].orders.baseline={attack:'none',chase:'ignore',effort:'conserve'};
  cast[1].orders.phases=[{atKm:20,attack:'selective',attackRiderId:'b0'}];
  Object.assign(cast[1].riders[0],{flat:100,strength:100,endurance:100});
  const route={...stage,keypoints:[{km:11,kind:'SPRINT'},{km:21,kind:'SPRINT'}]};
  const race=simulateTacticalTour({stage:route,teams:cast,
    seed:'gc-defence-with-helper-ahead',classification});
  assert.ok(race.frames[19].breakawayRiderIds.includes('a2'));
  assert.ok(race.frames[20].attackers.includes('b0'));
  const response=race.frames.find(frame=>frame.activeGcResponseTeamIds.includes('a')&&
    frame.breakawayRiderIds.includes('a2'));
  assert.ok(response);
  assert.ok(response.chasers.includes('a'));
  assert.ok(!response.pullRiderIds.includes('a2'));
  assert.equal(validateRecordedTour(race),true);
  const falseWork=structuredClone(race);
  falseWork.frames[response.km-1].pullRiderIds.push('a2');
  assert.throws(()=>validateRecordedTour(falseWork),/break work/);
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

test('one GC team cannot automatically contain three coordinated challengers',()=>{
  const cast=structuredClone(teams);
  cast[0].orders.gcObjective='defend_top_ten';
  for(const rider of cast[0].riders.slice(2))Object.assign(rider,{
    flat:85,strength:85,endurance:85,
  });
  for(const id of ['c','d']){
    const other=structuredClone(cast[1]);
    other.id=id;
    other.riders=other.riders.map(rider=>({...rider,id:rider.id.replace('b',id)}));
    other.orders={...other.orders,captainId:`${id}0`,roadCaptainId:`${id}1`};
    cast.push(other);
  }
  for(const team of cast.slice(1)){
    team.orders.gcObjective='target_top_ten';
    team.orders.baseline={attack:'none',chase:'ignore',effort:'conserve'};
    Object.assign(team.riders[0],{flat:90,strength:90,endurance:90});
  }
  const field=cast.flatMap(team=>team.riders.map(rider=>({
    riderId:rider.id,teamId:team.id,gender:'M',
  })));
  const start=startGeneralClassification({raceCategory:'M',riders:field});
  const fast=new Set([...cast[0].riders.slice(1).map(rider=>rider.id),'b1','b2']);
  const before=recordGeneralClassificationStage(start,{stageId:'earlier-stage',
    classifiedTimes:field.map(rider=>({riderId:rider.riderId,
      timeSeconds:fast.has(rider.riderId)?3590:
        rider.riderId==='a0'?3600:
          rider.riderId==='b0'?3602:
            rider.riderId==='c0'?3603:
              rider.riderId==='d0'?3604:3610,
    }))});
  const race=simulateTacticalTour({stage,teams:cast,seed:'three-gc-challengers',
    classification:before});
  const attack=race.frames.find(frame=>['b0','c0','d0'].every(id=>
    frame.attackers.includes(id)));
  assert.ok(attack,'the three challengers should attack together');
  assert.ok(attack.gcCounterTeamIds.includes('a'));
  assert.ok(attack.chasers.includes('a'));
  assert.ok(attack.joinedBreakawayRiderIds.length>0,
    'a single team should not erase all three attacks');
  assert.equal(validateRecordedTour(race),true);
});

test('a caught GC challenger may try again while the defender counters both moves',()=>{
  const cast=structuredClone(teams);
  cast[0].orders.gcObjective='defend_top_ten';
  cast[1].orders.gcObjective='target_top_ten';
  cast[1].orders.baseline={attack:'none',chase:'ignore',effort:'conserve'};
  Object.assign(cast[0].riders[0],{flat:85,strength:85,endurance:85});
  Object.assign(cast[1].riders[0],{flat:70,strength:70,endurance:70});
  for(const rider of cast[0].riders.slice(2))Object.assign(rider,{
    flat:75,strength:75,endurance:75,
  });
  const race=simulateTacticalTour({stage,teams:cast,seed:'paired-gc-9',classification});
  assert.ok(race.frames[19].joinedBreakawayRiderIds.includes('b0'));
  assert.ok(race.frames.slice(20,30).some(frame=>frame.caughtBreakawayRiderIds.includes('b0')));
  assert.ok(race.frames[39].attackers.includes('b0'));
  assert.ok(race.frames[19].gcCounterTeamIds.includes('a'));
  assert.ok(race.frames[39].gcCounterTeamIds.includes('a'));
  assert.equal(race.frames.at(-1).breakawayRiderIds.includes('b0'),false);
  assert.equal(validateRecordedTour(race),true);
});
