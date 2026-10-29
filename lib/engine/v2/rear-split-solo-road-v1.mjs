// Continue two source-replayed rear-group split riders as separate paid solos.
// Any meeting with the bunch or each other needs a separate contact road.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearGroupFollowerSplitV1} from
  './rear-group-follower-split-v1.mjs';
import {advanceRearSoloRoadV1,REAR_SOLO_ROAD_VERSION} from
  './rear-solo-road-v1.mjs';

export const REAR_SPLIT_SOLO_ROAD_VERSION=
  'v2-rear-split-solo-road-1';

export function advanceRearSplitSoloRoadV1({splitInput,split,
  segment,bunchTurnPlan,soloChoices}){
  if(!isDeepStrictEqual(split,
    advanceRearGroupFollowerSplitV1(splitInput))||
    split.status!=='two_solos_behind'||
    !Number.isInteger(segment?.km)||
    segment.km!==split.sourceKm+1||
    !Array.isArray(soloChoices)||soloChoices.length!==2||
    new Set(soloChoices.map(row=>row?.riderId)).size!==2||
    soloChoices.some(row=>!split.solos.some(solo=>
      solo.riderId===row.riderId)))
    throw new Error('Split solos need exact paid source and two decisions.');
  const riderById=new Map(splitInput.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const choiceById=new Map(soloChoices.map(row=>[row.riderId,row]));
  const steps=split.solos.map(solo=>{
    const choice=choiceById.get(solo.riderId);
    const prior={version:REAR_SOLO_ROAD_VERSION,
      riderId:solo.riderId,status:'solo_behind',
      endDistanceM:solo.atDistanceM,
      behindBunchSeconds:solo.behindBunchSeconds,
      energyAfter:solo.energyAfter};
    return advanceRearSoloRoadV1({prior,
      rider:riderById.get(solo.riderId),segment,bunchTurnPlan,
      effort:choice.effort,reason:choice.reason});
  });
  if(steps.some(step=>step.status!=='solo_behind'||
    step.endDistanceM!==segment.km*1000)||
    steps[0].behindBunchSeconds>=steps[1].behindBunchSeconds)
    throw new Error('Split solos need a separate physical contact road.');
  return {version:REAR_SPLIT_SOLO_ROAD_VERSION,
    sourceKm:segment.km,
    sourceSplitVersion:split.version,
    soloChoices:structuredClone(soloChoices),steps,
    soloStates:steps.map(step=>({riderId:step.riderId,
      atDistanceM:step.endDistanceM,
      behindBunchSeconds:step.behindBunchSeconds,
      energyAfter:step.energyAfter})),
    officialResults:false};
}

export function validateRearSplitSoloRoadV1(input,recording){
  if(!isDeepStrictEqual(recording,
    advanceRearSplitSoloRoadV1(input)))
    throw new Error('Split solo road differs from paid source.');
  return true;
}
