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
import {MOTOR_RACE_DYNAMICS_VERSION,TUNING} from
  '../lib/engine/v2/tuning.mjs';
import {advanceRearUnpayableClimbV1} from
  '../lib/engine/v2/rear-unpayable-climb-v1.mjs';
import {advanceRearPaceClimbSplitV1} from
  '../lib/engine/v2/rear-pace-climb-split-v1.mjs';
import {riderKilometreEffect} from
  '../lib/engine/v2/physiology.mjs';

const generated=process.argv.includes('--generated-profile');
const unpayable=process.argv.includes('--unpayable-climb');
const paceClimb=process.argv.includes('--pace-climb');
const onset=process.argv.includes('--onset');
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
  priorPositiveDeficitDrops:0,priorZeroDeficitDrops:0,
  droppedWithWorkedBunchTurn:0,droppedWithoutWorkedBunchTurn:0,
  ...(unpayable?{climbSnapshotTransitions:0,
    cannotFundHardHold:0,soloRoadAccepted:0,
    soloRoadDetached:0,soloRoadUnresolved:0,
    soloRoadRefusals:{}}:{}),
  ...(paceClimb?{paceClimbSnapshots:0,
    priorZeroDeficitSnapshots:0,
    paceLossAccepted:0,paceLossDetached:0,
    paceLossUnresolved:0,paceLossRefusals:{}}:{}),
  ...(onset?{firstPositiveClimbDeficits:0,
    firstPositivePaceAccepted:0,firstPositivePaceRefusals:{},
    firstPositiveSingleTurn:0,firstPositiveSplitAtKmStart:0,
    firstPositiveWithinHalfSecond:0,
    firstPositiveMismatchSumSeconds:0,
    firstPositiveMismatchMinSeconds:null,
    firstPositiveMismatchMaxSeconds:0,
    firstPositiveExamples:[]}:{}),
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
    const sourceRiders=new Map(recording.committedInputs.teams.flatMap(
      team=>team.riders.map(rider=>[rider.id,rider])));
    for(let index=1;index<recording.frames.length;index++){
      const prior=recording.frames[index-1],frame=recording.frames[index];
      const priorDropped=new Set(prior.riderGroups.filter(row=>
        row.group==='dropped').map(row=>row.id));
      const currentWorkers=new Set([...(frame.paidBunchPace?.riderIds??[]),
        ...frame.hardBunchWorkRiderIds,...frame.steadyBunchWorkRiderIds]);
      const priorWorkers=new Set([...(prior.paidBunchPace?.riderIds??[]),
        ...prior.hardBunchWorkRiderIds,...prior.steadyBunchWorkRiderIds]);
      if(onset&&frame.terrain==='climb'&&
        frame.pelotonFrontTurnPlan?.status==='worked'){
        const priorById=new Map(prior.riderGroups.map(row=>[row.id,row]));
        for(const rider of frame.riderGroups){
          const before=priorById.get(rider.id);
          if(before?.group!=='peloton'||
            before.deficitSeconds!==0||
            rider.deficitSeconds<=0)continue;
          summary.firstPositiveClimbDeficits++;
          if(frame.pelotonFrontTurnPlan.turns.length===1)
            summary.firstPositiveSingleTurn++;
          try{
            const candidate=advanceRearPaceClimbSplitV1({
              rider:sourceRiders.get(rider.id),
              segment:recording.route.kilometres[frame.km-1],
              energy:before.energy,
              bunchTurnPlan:frame.pelotonFrontTurnPlan,
              stageNumber:1,stageCount:1,
              soloEffort:'conserve',soloReason:'finish_safely'});
            summary.firstPositivePaceAccepted++;
            if(candidate.splitDistanceM===(frame.km-1)*1000)
              summary.firstPositiveSplitAtKmStart++;
            const mismatch=Math.abs(candidate.behindBunchSeconds-
              rider.deficitSeconds);
            if(mismatch<=.5)summary.firstPositiveWithinHalfSecond++;
            summary.firstPositiveMismatchSumSeconds+=mismatch;
            summary.firstPositiveMismatchMinSeconds=
              summary.firstPositiveMismatchMinSeconds===null?mismatch:
                Math.min(summary.firstPositiveMismatchMinSeconds,mismatch);
            summary.firstPositiveMismatchMaxSeconds=Math.max(
              summary.firstPositiveMismatchMaxSeconds,mismatch);
            if(summary.firstPositiveExamples.length<8)
              summary.firstPositiveExamples.push({seed,terrain,fatigue,
                km:frame.km,riderId:rider.id,
                checkpointDeficitSeconds:rider.deficitSeconds,
                paidSplitDeficitSeconds:candidate.behindBunchSeconds,
                splitDistanceM:candidate.splitDistanceM});
          }catch(error){
            const reason=String(error.message);
            summary.firstPositivePaceRefusals[reason]=
              (summary.firstPositivePaceRefusals[reason]??0)+1;
          }
        }
      }
      for(const rider of frame.riderGroups.filter(row=>
        row.group==='dropped'&&!priorDropped.has(row.id))){
        summary.newDrops++;
        const priorDeficit=prior.riderGroups.find(row=>
          row.id===rider.id)?.deficitSeconds;
        if(priorDeficit>0)summary.priorPositiveDeficitDrops++;
        else if(priorDeficit===0)summary.priorZeroDeficitDrops++;
        else throw new Error('Rear entry is missing its prior rider deficit.');
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
        if((unpayable||paceClimb)&&frame.terrain==='climb'&&
          prior.riderGroups.some(row=>row.id===rider.id&&
            row.group==='peloton')&&
          frame.pelotonFrontTurnPlan?.status==='worked'){
          const sourceRider=sourceRiders.get(rider.id);
          const sourceSegment=recording.route.kilometres[frame.km-1];
          const priorRow=prior.riderGroups.find(row=>
            row.id===rider.id);
          const priorEnergy=priorRow.energy;
          if(paceClimb){
            summary.paceClimbSnapshots++;
            if(priorRow.deficitSeconds===0)
              summary.priorZeroDeficitSnapshots++;
            try{
              const candidate=advanceRearPaceClimbSplitV1({
                rider:sourceRider,segment:sourceSegment,
                energy:priorEnergy,
                bunchTurnPlan:frame.pelotonFrontTurnPlan,
                stageNumber:1,stageCount:1,
                soloEffort:'conserve',soloReason:'finish_safely'});
              summary.paceLossAccepted++;
              if(candidate.status==='solo_behind')
                summary.paceLossDetached++;
              else summary.paceLossUnresolved++;
            }catch(error){
              const reason=String(error.message);
              summary.paceLossRefusals[reason]=
                (summary.paceLossRefusals[reason]??0)+1;
            }
          }
          if(unpayable){
            summary.climbSnapshotTransitions++;
            const effect=riderKilometreEffect(sourceRider,
            sourceSegment,{phase:'cruise',energy:priorEnergy,
              exposed:sourceSegment.exposed});
            const hardHoldCost=TUNING.effortCost.hard*
            effect.energyCostMultiplier*.8;
            if(priorEnergy<hardHoldCost){
              summary.cannotFundHardHold++;
              try{
                const candidate=advanceRearUnpayableClimbV1({
                  rider:sourceRider,segment:sourceSegment,
                  energy:priorEnergy,
                  bunchTurnPlan:frame.pelotonFrontTurnPlan,
                  stageNumber:1,stageCount:1});
                summary.soloRoadAccepted++;
                if(candidate.status==='solo_behind')
                  summary.soloRoadDetached++;
                else summary.soloRoadUnresolved++;
              }catch(error){
                const reason=String(error.message);
                summary.soloRoadRefusals[reason]=
                  (summary.soloRoadRefusals[reason]??0)+1;
              }
            }
          }
        }
        if(summary.examples.length<12)summary.examples.push({seed,terrain,
          fatigue,km:frame.km,kmTerrain:frame.terrain,riderId:rider.id,
          deficitSeconds:rider.deficitSeconds,
          priorDeficitSeconds:priorDeficit,
          bunchWorkSameKm:currentWorkers.has(rider.id),
          caughtSameKm:frame.caughtBreakawayRiderIds.includes(rider.id)});
      }
    }
  }
console.log(JSON.stringify(summary));
