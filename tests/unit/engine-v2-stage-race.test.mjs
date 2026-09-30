import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {classifyTacticalStage} from '../../lib/engine/v2/stage-race.mjs';
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
