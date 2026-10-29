// Read-only counterfactual on genuinely steep generated mountain segments.
// These are not rear positions in the current recorded tour.
import {generatePlaytestStageProfile} from
  '../lib/engine/v2/playtest-stage-generator.mjs';
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {prepareV94RivalIntent} from
  '../lib/engine/v2/playtest-rival-intent-v94.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {replayRaceDynamicsRecording} from
  '../lib/engine/v2/replay-race-dynamics-v94.mjs';
import {MOTOR_RACE_DYNAMICS_VERSION} from
  '../lib/engine/v2/tuning.mjs';
import {advanceRearDetachmentV1,validateRearDetachmentV1} from
  '../lib/engine/v2/rear-detachment-v1.mjs';

const summary={races:0,refusedRaces:0,eligibleRiderKm:0,
  climbKm:0,paidClimbKm:0,terrainCounts:{},
  stillAttached:0,unresolvedWheelGap:0,paidSoloGap:0,
  soloRecordedPeloton:0,soloRecordedDropped:0,
  gapOver1:0,gapOver3:0,gapOver5:0,
  unpayable:0,examples:[]};
for(const seed of [1,2])for(const fatigue of [0,30]){
  const terrain='mountain';
  const raceSeed=`detachment-source-${seed}-${fatigue}`;
  const prepared=prepareV91Playtest({distanceKm:260,teamCount:20,
    terrain:'custom',fatigue,attack:'none',chase:'selective',seed:raceSeed,
    profileHeightsM:generatePlaytestStageProfile({distanceKm:260,
      style:terrain,seed:raceSeed})});
  const plan=prepareV94RivalIntent({prepared,format:'one_day',
    controlTempoVersion:2,opportunisticSpecialistVersion:2,
    frontRotationVersion:1});
  let recording;
  try{
    recording=simulateTacticalTour({stage:prepared.stage,
      weather:prepared.weather,teams:plan.teams,seed:prepared.seed,
      motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
      raceContext:{...plan.raceContext,controlPursuitVersion:2,
        roadGroupPaceVersion:3,chaseTurnVersion:1,
        bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1,
        frontObservationVersion:2,frontExhaustionVersion:4},
      rivalIntent:plan.intent});
    validateRecordedTour(recording);
    replayRaceDynamicsRecording(recording);
  }catch(error){
    if(!String(error.message).includes('Combined fresh attack and paid pursuit'))
      throw error;
    summary.refusedRaces++;
    continue;
  }
  summary.races++;
  for(const segment of recording.route.kilometres)
    summary.terrainCounts[segment.terrain]=
      (summary.terrainCounts[segment.terrain]??0)+1;
  const riders=new Map(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  for(let index=1;index<recording.frames.length;index++){
    const frame=recording.frames[index],prior=recording.frames[index-1];
    const segment=recording.route.kilometres[index];
    const plan=frame.pelotonFrontTurnPlan;
    if(segment.terrain==='climb')summary.climbKm++;
    if(segment.terrain!=='climb'||plan?.status!=='worked')continue;
    summary.paidClimbKm++;
    const workers=new Set(plan.turns.map(turn=>turn.leaderRiderId));
    for(const row of prior.riderGroups){
      if(row.group!=='peloton'||workers.has(row.id))continue;
      summary.eligibleRiderKm++;
      try{
        const input={rider:riders.get(row.id),segment,energy:row.energy,
          bunchTurnPlan:plan,stageNumber:1,stageCount:1};
        const entry=advanceRearDetachmentV1(input);
        validateRearDetachmentV1(input,entry);
        if(entry.behindBunchSeconds>0){
          if(entry.status==='solo_behind'){
            summary.paidSoloGap++;
            const recorded=frame.riderGroups.find(rider=>
              rider.id===row.id)?.group;
            if(recorded==='peloton')summary.soloRecordedPeloton++;
            if(recorded==='dropped')summary.soloRecordedDropped++;
          }
          else summary.unresolvedWheelGap++;
          if(entry.behindBunchSeconds>1)summary.gapOver1++;
          if(entry.behindBunchSeconds>3)summary.gapOver3++;
          if(entry.behindBunchSeconds>5)summary.gapOver5++;
          if(summary.examples.length<8)summary.examples.push({seed,fatigue,
            km:segment.km,riderId:row.id,
            gapSeconds:entry.behindBunchSeconds,
            recordedGroup:frame.riderGroups.find(rider=>
              rider.id===row.id)?.group});
        }else summary.stillAttached++;
      }catch(error){
        if(!String(error.message).includes('within-kilometre coast clock'))
          throw error;
        summary.unpayable++;
      }
    }
  }
}
console.log(JSON.stringify(summary));
