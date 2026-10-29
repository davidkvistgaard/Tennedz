// Read-only source-replayed audit of rider transitions behind the bunch.
// A checkpoint deficit is not a physical position or proof of rear contact.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRaceDynamicsRecording} from
  '../lib/engine/v2/replay-race-dynamics-v94.mjs';
import {generatePlaytestStageProfile} from
  '../lib/engine/v2/playtest-stage-generator.mjs';
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {prepareV94RivalIntent} from
  '../lib/engine/v2/playtest-rival-intent-v94.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {MOTOR_RACE_DYNAMICS_VERSION} from
  '../lib/engine/v2/tuning.mjs';

const generated=process.argv.includes('--generated-profile');
const requestedSeeds=process.argv.find(arg=>arg.startsWith('--seeds='));
const seedCount=requestedSeeds?Number(requestedSeeds.slice(8)):
  generated?2:8;
if(!Number.isInteger(seedCount)||seedCount<1||seedCount>24)
  throw new Error('Rear-entry audit seeds must be between 1 and 24.');

function generatedRecording(seed,terrain,fatigue){
  const raceSeed=`rear-entry-generated-${seed}-${terrain}-${fatigue}`;
  const prepared=prepareV91Playtest({distanceKm:260,teamCount:20,
    terrain:'custom',fatigue,attack:'none',chase:'selective',seed:raceSeed,
    profileHeightsM:generatePlaytestStageProfile({distanceKm:260,
      style:terrain,seed:raceSeed})});
  const plan=prepareV94RivalIntent({prepared,format:'one_day',
    controlTempoVersion:2,opportunisticSpecialistVersion:2,
    frontRotationVersion:1});
  const recording=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:plan.teams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:{...plan.raceContext,controlPursuitVersion:2,
      roadGroupPaceVersion:3,chaseTurnVersion:1,
      bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1,
      frontObservationVersion:2,frontExhaustionVersion:4},
    rivalIntent:plan.intent});
  validateRecordedTour(recording);
  replayRaceDynamicsRecording(recording);
  return recording;
}

const summary={profile:generated?'generated':'legacy',
  cases:0,refusedCases:0,refusals:[],newDrops:0,
  fromBunchWorkSameKm:0,
  fromBunchWorkPreviousKm:0,caughtBreakSameKm:0,
  caughtBreakPreviousKm:0,onClimbKmDrops:0,
  droppedWithWorkedBunchTurn:0,droppedWithoutWorkedBunchTurn:0,
  examples:[]};
for(let seed=1;seed<=seedCount;seed++)for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30]){
    let recording;
    try{
      recording=generated?generatedRecording(seed,terrain,fatigue):
        createV94RaceDynamicsPreview({format:'one_day',
          settings:{distanceKm:260,teamCount:20,attack:'none',
            chase:'selective',
            seed:`rear-entry-holdout-${seed}-${terrain}-${fatigue}`,
            terrain,fatigue}}).recording;
    }catch(error){
      if(!generated||!String(error.message).includes(
        'Combined fresh attack and paid pursuit'))throw error;
      summary.refusedCases++;
      summary.refusals.push({seed,terrain,fatigue,
        message:String(error.message)});
      continue;
    }
    replayRaceDynamicsRecording(recording);
    summary.cases++;
    for(let index=1;index<recording.frames.length;index++){
      const prior=recording.frames[index-1],frame=recording.frames[index];
      const priorDropped=new Set(prior.riderGroups.filter(row=>
        row.group==='dropped').map(row=>row.id));
      const currentWorkers=new Set([...(frame.paidBunchPace?.riderIds??[]),
        ...frame.hardBunchWorkRiderIds,...frame.steadyBunchWorkRiderIds]);
      const priorWorkers=new Set([...(prior.paidBunchPace?.riderIds??[]),
        ...prior.hardBunchWorkRiderIds,...prior.steadyBunchWorkRiderIds]);
      for(const rider of frame.riderGroups.filter(row=>
        row.group==='dropped'&&!priorDropped.has(row.id))){
        summary.newDrops++;
        if(frame.pelotonFrontTurnPlan?.status==='worked')
          summary.droppedWithWorkedBunchTurn++;
        else summary.droppedWithoutWorkedBunchTurn++;
        if(currentWorkers.has(rider.id))summary.fromBunchWorkSameKm++;
        if(priorWorkers.has(rider.id))summary.fromBunchWorkPreviousKm++;
        if(frame.caughtBreakawayRiderIds.includes(rider.id))
          summary.caughtBreakSameKm++;
        if(prior.caughtBreakawayRiderIds.includes(rider.id))
          summary.caughtBreakPreviousKm++;
        if(frame.terrain==='climb'||frame.terrain==='mountain')
          summary.onClimbKmDrops++;
        if(summary.examples.length<12)summary.examples.push({seed,terrain,
          fatigue,km:frame.km,kmTerrain:frame.terrain,riderId:rider.id,
          deficitSeconds:rider.deficitSeconds,
          priorDeficitSeconds:prior.riderGroups.find(row=>
            row.id===rider.id)?.deficitSeconds??null,
          bunchWorkSameKm:currentWorkers.has(rider.id),
          caughtSameKm:frame.caughtBreakawayRiderIds.includes(rider.id)});
      }
    }
  }
console.log(JSON.stringify(summary));
