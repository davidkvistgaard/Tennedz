// Consecutive paid solo kilometres after a source-replayed two-rider split.
// A meeting with the bunch or between solos stops before an unsupported road.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearGroupFollowerSplitV1} from
  './rear-group-follower-split-v1.mjs';
import {advanceRearSplitSoloRoadV1} from
  './rear-split-solo-road-v1.mjs';
import {advanceRearSoloRoadV1,REAR_SOLO_ROAD_VERSION} from
  './rear-solo-road-v1.mjs';

export const REAR_SPLIT_SOLO_RUN_VERSION=
  'v2-rear-split-solo-run-1';

export function runRearSplitSoloV1({splitInput,split,kilometres}){
  if(!isDeepStrictEqual(split,
    advanceRearGroupFollowerSplitV1(splitInput))||
    split.status!=='two_solos_behind'||
    !Array.isArray(kilometres)||!kilometres.length||
    kilometres[0]?.segment?.km!==split.sourceKm+1)
    throw new Error('Split solo run needs replayed paid split and route.');
  const riderById=new Map(splitInput.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const steps=[];
  let states=split.solos;
  let priorKm=split.sourceKm;
  for(const kilometre of kilometres){
    const {segment,bunchTurnPlan,soloChoices}=kilometre;
    if(!Number.isInteger(segment?.km)||segment.km!==priorKm+1||
      !Array.isArray(soloChoices)||soloChoices.length!==2||
      new Set(soloChoices.map(row=>row?.riderId)).size!==2||
      soloChoices.some(row=>!states.some(state=>
        state.riderId===row.riderId)))
      throw new Error('Split solo run needs consecutive rider decisions.');
    const step=steps.length===0?
      advanceRearSplitSoloRoadV1({splitInput,split,
        segment,bunchTurnPlan,soloChoices}):null;
    const paid=step??(()=>{
      const choices=new Map(soloChoices.map(row=>[row.riderId,row]));
      const roads=states.map(state=>{
        const choice=choices.get(state.riderId);
        return advanceRearSoloRoadV1({prior:{
          version:REAR_SOLO_ROAD_VERSION,
          riderId:state.riderId,status:'solo_behind',
          endDistanceM:state.atDistanceM,
          behindBunchSeconds:state.behindBunchSeconds,
          energyAfter:state.energyAfter},
        rider:riderById.get(state.riderId),segment,bunchTurnPlan,
        effort:choice.effort,reason:choice.reason});
      });
      if(roads.some(row=>row.status!=='solo_behind'||
        row.endDistanceM!==segment.km*1000)||
        roads[0].behindBunchSeconds>=roads[1].behindBunchSeconds)
        throw new Error('Split solo run needs a separate contact road.');
      return {sourceKm:segment.km,
        soloChoices:structuredClone(soloChoices),steps:roads,
        soloStates:roads.map(row=>({riderId:row.riderId,
          atDistanceM:row.endDistanceM,
          behindBunchSeconds:row.behindBunchSeconds,
          energyAfter:row.energyAfter}))};
    })();
    steps.push(paid);
    states=paid.soloStates;
    priorKm=segment.km;
  }
  return {version:REAR_SPLIT_SOLO_RUN_VERSION,
    sourceKm:split.sourceKm,steps,finalSoloStates:states,
    officialResults:false};
}

export function validateRearSplitSoloRunV1(input,recording){
  if(!isDeepStrictEqual(recording,runRearSplitSoloV1(input)))
    throw new Error('Split solo run differs from paid source.');
  return true;
}
