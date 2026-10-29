// Consecutive terrain-priced solos from a replayed rear-group split.
// Both riders decide and pay again every kilometre; meetings still refuse.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearGroupFollowerSplitV2} from
  './rear-group-follower-split-v2.mjs';
import {advanceRearSoloRoadV2,REAR_SOLO_ROAD_V2_VERSION} from
  './rear-solo-road-v2.mjs';

export const REAR_SPLIT_SOLO_RUN_V2_VERSION=
  'v2-rear-split-solo-run-2';

export function runRearSplitSoloV2({splitInput,split,kilometres}){
  if(!isDeepStrictEqual(split,
    advanceRearGroupFollowerSplitV2(splitInput))||
    !Array.isArray(kilometres)||!kilometres.length||
    kilometres[0]?.segment?.km!==split.sourceV1.sourceKm+1)
    throw new Error('Terrain split run needs replayed paid source.');
  const riders=new Map(splitInput.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  let states=split.solos;
  let nextKm=split.sourceV1.sourceKm+1;
  const steps=[];
  for(const kilometre of kilometres){
    const {segment,bunchTurnPlan,soloChoices}=kilometre??{};
    if(segment?.km!==nextKm||
      !Array.isArray(soloChoices)||soloChoices.length!==2||
      new Set(soloChoices.map(row=>row?.riderId)).size!==2||
      soloChoices.some(row=>!states.some(state=>
        state.riderId===row.riderId)))
      throw new Error('Terrain split run needs two consecutive decisions.');
    const byChoice=new Map(soloChoices.map(row=>[row.riderId,row]));
    const riderRoads=states.map(state=>{
      const choice=byChoice.get(state.riderId);
      return advanceRearSoloRoadV2({prior:{
        version:steps.length?REAR_SOLO_ROAD_V2_VERSION:split.version,
        riderId:state.riderId,
        endDistanceM:state.atDistanceM,
        behindBunchSeconds:state.behindBunchSeconds,
        energyAfter:state.energyAfter},
      rider:riders.get(state.riderId),segment,bunchTurnPlan,
      routeKilometres:splitInput.routeKilometres,
      effort:choice.effort,reason:choice.reason});
    });
    if(riderRoads.some(row=>row.status!=='solo_behind'||
      row.endDistanceM!==segment.km*1000)||
      riderRoads[0].slices.length!==riderRoads[1].slices.length||
      riderRoads[0].slices.some((slice,index)=>
        slice.behindBunchSeconds>=
          riderRoads[1].slices[index].behindBunchSeconds))
      throw new Error('Terrain split run needs a paid contact road.');
    states=riderRoads.map(row=>({riderId:row.riderId,
      atDistanceM:row.endDistanceM,
      behindBunchSeconds:row.behindBunchSeconds,
      energyAfter:row.energyAfter}));
    steps.push({sourceKm:nextKm,
      soloChoices:structuredClone(soloChoices),riderRoads,
      soloStates:states});
    nextKm++;
  }
  return {version:REAR_SPLIT_SOLO_RUN_V2_VERSION,
    sourceKm:split.sourceV1.sourceKm,steps,
    finalSoloStates:states,officialResults:false};
}

export function validateRearSplitSoloRunV2(input,recording){
  if(!isDeepStrictEqual(recording,runRearSplitSoloV2(input)))
    throw new Error('Terrain split solo run differs from paid source.');
  return true;
}
