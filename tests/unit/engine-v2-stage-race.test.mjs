import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {classifyTacticalStage,carryStageFatigue,createStageHandoff} from
  '../../lib/engine/v2/stage-race.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]],keypoints:[]};
const teams=['a','b'].map(id=>({id,riders:Array.from({length:8},(_,index)=>({
  id:`${id}${index}`,gender:'M',flat:70,strength:70,endurance:70,
  sprint:60,leadership:50,
})),orders:{captainId:`${id}0`,roadCaptainId:`${id}1`,preset:'balanced',
  baseline:{attack:'none',chase:'ignore'}}}));
const classifiedTimes=recording=>recording.provisionalResults.map(result=>({
  riderId:result.riderId,timeSeconds:result.timeSeconds,
}));

test('two stages use explicit classified times and preserve each earlier replay',()=>{
  const first=simulateTacticalTour({stage,teams,seed:'stage-series-1'});
  const firstSnapshot=structuredClone(first);
  const afterFirst=classifyTacticalStage({recording:first,stageId:'stage-1',
    classifiedTimes:classifiedTimes(first)});
  assert.deepEqual(afterFirst.completedStageIds,['stage-1']);
  const second=simulateTacticalTour({stage,teams,seed:'stage-series-2',
    classification:afterFirst});
  const secondSnapshot=structuredClone(second);
  const afterSecond=classifyTacticalStage({recording:second,stageId:'stage-2',
    classifiedTimes:classifiedTimes(second)});
  assert.deepEqual(afterSecond.completedStageIds,['stage-1','stage-2']);
  assert.deepEqual(first,firstSnapshot);
  assert.deepEqual(second,secondSnapshot);
  assert.deepEqual(second.committedInputs.classification,afterFirst);
  assert.equal(validateRecordedTour(first),true);
  assert.equal(validateRecordedTour(second),true);
  assert.throws(()=>classifyTacticalStage({recording:second,stageId:'stage-1',
    classifiedTimes:classifiedTimes(second)}),/classification stage/);
});

test('classification handoff never invents official times from provisional results',()=>{
  const recording=simulateTacticalTour({stage,teams,seed:'stage-handoff'});
  assert.throws(()=>classifyTacticalStage({recording,stageId:'stage-1'}),
    /classification stage/);
  assert.throws(()=>classifyTacticalStage({recording,stageId:'stage-1',
    classifiedTimes:classifiedTimes(recording).slice(1)}),/classification stage/);
  const invalid=structuredClone(recording);
  invalid.frames.pop();
  assert.throws(()=>classifyTacticalStage({recording:invalid,stageId:'stage-1',
    classifiedTimes:classifiedTimes(recording)}),/recording/);
});

test('stage accounting keeps the women’s event in its own race category',()=>{
  const women=structuredClone(teams);
  for(const team of women)for(const rider of team.riders)rider.gender='F';
  const recording=simulateTacticalTour({stage,teams:women,seed:'women-stage'});
  const classification=classifyTacticalStage({recording,stageId:'women-stage-1',
    classifiedTimes:classifiedTimes(recording)});
  assert.equal(classification.raceCategory,'F');
  const next=simulateTacticalTour({stage,teams:women,seed:'women-stage-2',
    classification});
  assert.equal(next.raceCategory,'F');
  assert.equal(validateRecordedTour(next),true);
});

test('costly stage work carries more fatigue while a rest day lowers the next start load',()=>{
  const longStage={distance_km:120,profile_points:[[0,100],[120,100]],keypoints:[]};
  const hard=structuredClone(teams);
  const easy=structuredClone(teams);
  hard[0].orders.baseline.effort='hard';
  easy[0].orders.baseline.effort='conserve';
  const full=simulateTacticalTour({stage:longStage,teams:hard,seed:'carried-fatigue'});
  const saved=simulateTacticalTour({stage:longStage,teams:easy,seed:'carried-fatigue'});
  const hardCarry=carryStageFatigue({recording:full});
  const easyCarry=carryStageFatigue({recording:saved});
  const rested=carryStageFatigue({recording:full,restDays:1});
  const fatigue=result=>result.teams.find(team=>team.id==='a').riders[0].fatigue;
  assert.equal(hardCarry.tuningVersion,full.tuningVersion);
  assert.ok(fatigue(hardCarry)>fatigue(easyCarry));
  assert.ok(fatigue(rested)<fatigue(hardCarry));
  assert.deepEqual(full.committedInputs.teams[0].riders[0].fatigue,0);
  const nextTeams=hardCarry.teams.map(team=>({...team,
    orders:hard.find(original=>original.id===team.id).orders}));
  const next=simulateTacticalTour({stage,teams:nextTeams,seed:'stage-after-work'});
  assert.ok(next.frames[0].riderGroups.find(rider=>rider.id==='a0').energy<
    simulateTacticalTour({stage,teams,seed:'stage-after-work'}).frames[0]
      .riderGroups.find(rider=>rider.id==='a0').energy);
  assert.equal(validateRecordedTour(next),true);
  assert.throws(()=>carryStageFatigue({recording:full,restDays:-1}),/Rest days/);
});

test('three stages carry separate GC and rider condition without rewriting old races',()=>{
  const longStage={distance_km:120,profile_points:[[0,100],[120,100]],keypoints:[]};
  const hardTeams=structuredClone(teams);
  hardTeams[0].orders.baseline.effort='hard';
  const standings=[];
  const recordings=[];
  let nextTeams=structuredClone(hardTeams);
  let classification=null;
  for(let index=0;index<3;index++){
    const recording=simulateTacticalTour({stage:longStage,teams:nextTeams,
      seed:`three-stage-${index}`,classification});
    recordings.push(structuredClone(recording));
    const before=structuredClone(recording);
    const handoff=createStageHandoff({recording,stageId:`stage-${index+1}`,
      classifiedTimes:classifiedTimes(recording),restDays:index===1?1:0});
    classification=handoff.classification;
    standings.push(structuredClone(classification));
    nextTeams=handoff.condition.teams.map(team=>({...team,
      orders:structuredClone(hardTeams.find(original=>original.id===team.id).orders)}));
    assert.deepEqual(recording,before);
    assert.equal(validateRecordedTour(recording),true);
  }
  assert.deepEqual(classification.completedStageIds,['stage-1','stage-2','stage-3']);
  assert.deepEqual(recordings[1].committedInputs.classification,standings[0]);
  assert.deepEqual(recordings[2].committedInputs.classification,standings[1]);
  assert.ok(recordings[1].committedInputs.teams[0].riders[0].fatigue>0);
  assert.deepEqual(recordings[1].committedInputs.teams[0].riders[0].fatigue,
    carryStageFatigue({recording:recordings[0]}).teams[0].riders[0].fatigue);
  assert.deepEqual(recordings[2].committedInputs.teams[0].riders[0].fatigue,
    carryStageFatigue({recording:recordings[1],restDays:1}).teams[0].riders[0].fatigue);
  assert.equal(validateRecordedTour(recordings[0]),true);
});

test('a stage handoff requires classified results before carrying its condition',()=>{
  const recording=simulateTacticalTour({stage,teams,seed:'stage-handoff-explicit'});
  const before=structuredClone(recording);
  assert.throws(()=>createStageHandoff({recording,stageId:'first'}),
    /classification stage/);
  assert.throws(()=>createStageHandoff({recording,stageId:'first',
    classifiedTimes:classifiedTimes(recording),restDays:-1}),/Rest days/);
  assert.deepEqual(recording,before);
});

test('stage accounting rejects impossible energy hidden in a recorded kilometre',()=>{
  const tired=structuredClone(teams);
  tired[0].riders[0].fatigue=50;
  const recording=simulateTacticalTour({stage,teams:tired,seed:'energy-integrity'});
  assert.equal(validateRecordedTour(recording),true);
  const overCapacity=structuredClone(recording);
  overCapacity.frames[0].riderGroups.find(rider=>rider.id==='a0').energy=80.1;
  assert.throws(()=>createStageHandoff({recording:overCapacity,stageId:'first',
    classifiedTimes:classifiedTimes(recording)}),/recorded rider state/);
  const impossibleRecovery=structuredClone(recording);
  const first=impossibleRecovery.frames[0].riderGroups.find(rider=>rider.id==='a0');
  impossibleRecovery.frames[1].riderGroups.find(rider=>rider.id==='a0').energy=
    +(first.energy+1).toFixed(3);
  impossibleRecovery.frames[1].recoveredRiderIds.push('a0');
  assert.throws(()=>carryStageFatigue({recording:impossibleRecovery}),
    /recorded rider state/);
  const impossibleLoss=structuredClone(recording);
  impossibleLoss.frames[0].riderGroups.find(rider=>rider.id==='a0').energy=0;
  assert.throws(()=>carryStageFatigue({recording:impossibleLoss}),
    /recorded rider state/);
  const falseSummary=structuredClone(recording);
  falseSummary.frames[0].teamEnergy[0].mean++;
  assert.throws(()=>carryStageFatigue({recording:falseSummary}),
    /team metrics/);
  const falsePace=structuredClone(recording);
  falsePace.frames[0].teamPace[0].meanAbility=Infinity;
  assert.throws(()=>carryStageFatigue({recording:falsePace}),
    /team metrics/);
});

test('historical replays cannot silently acquire current stage-fatigue tuning',()=>{
  const recording=simulateTacticalTour({stage,teams,seed:'historical-condition'});
  const historical=structuredClone(recording);
  historical.tuningVersion='v2-prototype-52';
  assert.equal(validateRecordedTour(historical),true);
  assert.throws(()=>carryStageFatigue({recording:historical}),/tuning versions/);
  assert.throws(()=>createStageHandoff({recording:historical,stageId:'first',
    classifiedTimes:classifiedTimes(historical)}),/tuning versions/);
  assert.equal(validateRecordedTour(recording),true);
});
