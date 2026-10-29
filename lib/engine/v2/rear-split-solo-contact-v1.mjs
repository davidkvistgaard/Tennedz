// Opt-in contact between two terrain-priced solos from one replayed split.
// The meeting is located within a named bunch turn and both riders pay only
// to that marker. No post-contact shelter or full-kilometre cap is awarded.
import {isDeepStrictEqual} from 'node:util';
import {advanceFinaleGap} from './finale-step.mjs';
import {advanceRearGroupFollowerSplitV2} from
  './rear-group-follower-split-v2.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {advanceRearSoloRoadV2,REAR_SOLO_ROAD_V2_VERSION} from
  './rear-solo-road-v2.mjs';
import {runRearSplitSoloV2} from './rear-split-solo-run-v2.mjs';

export const REAR_SPLIT_SOLO_CONTACT_V1_VERSION=
  'v2-rear-split-solo-contact-1';

export function advanceRearSplitSoloContactV1({splitInput,split,
  priorRunInput=null,priorRun=null,segment,bunchTurnPlan,soloChoices}){
  if(!isDeepStrictEqual(split,
    advanceRearGroupFollowerSplitV2(splitInput))||
    (priorRunInput===null)!==(priorRun===null)||
    (priorRunInput!==null&&!isDeepStrictEqual(priorRun,
      runRearSplitSoloV2(priorRunInput)))||
    (priorRunInput!==null&&
      (!isDeepStrictEqual(priorRunInput.splitInput,splitInput)||
       !isDeepStrictEqual(priorRunInput.split,split)))||
    !Number.isInteger(segment?.km)||
    segment.km!==(priorRun?.steps.at(-1).sourceKm??
      split.sourceV1.sourceKm)+1||
    !Array.isArray(soloChoices)||soloChoices.length!==2||
    new Set(soloChoices.map(row=>row?.riderId)).size!==2)
    throw new Error('Rear solo contact needs consecutive replayed sources.');
  const states=priorRun?.finalSoloStates??split.solos;
  if(soloChoices.some(row=>!states.some(state=>
    state.riderId===row.riderId)))
    throw new Error('Rear solo contact needs both rider decisions.');
  const riders=new Map(splitInput.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const choices=new Map(soloChoices.map(row=>[row.riderId,row]));
  const proposals=states.map(state=>{
    const choice=choices.get(state.riderId);
    return advanceRearSoloRoadV2({prior:{
      version:priorRun?REAR_SOLO_ROAD_V2_VERSION:split.version,
      riderId:state.riderId,endDistanceM:state.atDistanceM,
      behindBunchSeconds:state.behindBunchSeconds,
      energyAfter:state.energyAfter},
    rider:riders.get(state.riderId),segment,bunchTurnPlan,
    routeKilometres:splitInput.routeKilometres,
    effort:choice.effort,reason:choice.reason});
  });
  if(proposals.some(row=>row.status!=='solo_behind'||
    row.endDistanceM!==segment.km*1000)||
    proposals[0].slices.length!==proposals[1].slices.length)
    throw new Error('Rear solo contact needs both paid solo roads.');
  let gap=states[1].behindBunchSeconds-
    states[0].behindBunchSeconds;
  if(gap<=0)throw new Error('Rear solo contact needs ordered road.');
  const travelled=[];
  for(let index=0;index<proposals[0].slices.length;index++){
    const front=proposals[0].slices[index];
    const rear=proposals[1].slices[index];
    if(front.startDistanceM!==rear.startDistanceM||
      front.endDistanceM!==rear.endDistanceM||
      Math.abs(front.bunchSpeedKph-rear.bunchSpeedKph)>1e-9)
      throw new Error('Rear solo contact needs shared bunch turns.');
    const slice={startDistanceM:front.startDistanceM,
      endDistanceM:front.endDistanceM,
      lengthM:front.endDistanceM-front.startDistanceM};
    const movement=advanceFinaleGap({slice,gapSeconds:gap,
      frontSpeedKph:front.soloSpeedKph,
      chaseSpeedKph:rear.soloSpeedKph});
    if(!movement.caught){
      travelled.push({startDistanceM:slice.startDistanceM,
        endDistanceM:slice.endDistanceM,contact:false});
      gap=movement.gapSeconds;
      continue;
    }
    const atDistanceM=movement.catchDistanceM;
    const riddenM=atDistanceM-slice.startDistanceM;
    const paid=[front,rear].map((row,riderIndex)=>{
      const proposal=proposals[riderIndex];
      const rider=riders.get(proposal.riderId);
      const price=priceRearEnergyDemandV1({rider,segment,
        energyBefore:row.energyBefore,effort:proposal.effort,
        role:'solo',distanceM:riddenM});
      const previous=proposal.slices.slice(0,index).reduce(
        (sum,prior)=>sum+prior.energySpent,0);
      return {riderId:proposal.riderId,
        energyBefore:states[riderIndex].energyAfter,
        energySpent:previous+price.energyDemand,
        energyAfter:price.energyAfter,
        behindBunchSeconds:states[riderIndex].behindBunchSeconds+
          proposal.slices.slice(0,index).reduce((sum,prior)=>
            sum+(prior.endDistanceM-prior.startDistanceM)*3.6*
            (1/prior.soloSpeedKph-1/prior.bunchSpeedKph),0)+
          riddenM*3.6*(1/row.soloSpeedKph-1/row.bunchSpeedKph)};
    });
    if(Math.abs(paid[0].behindBunchSeconds-
      paid[1].behindBunchSeconds)>1e-7||
      paid.some(row=>row.behindBunchSeconds<=0))
      throw new Error('Rear solo contact did not meet behind bunch.');
    travelled.push({startDistanceM:slice.startDistanceM,
      endDistanceM:atDistanceM,contact:true});
    return {version:REAR_SPLIT_SOLO_CONTACT_V1_VERSION,
      sourceKm:segment.km,soloChoices:structuredClone(soloChoices),
      travelled,atDistanceM,paid,
      event:{kind:'rear_contact',atDistanceM,
        riderIds:paid.map(row=>row.riderId)},
      rearGroup:{riderIds:paid.map(row=>row.riderId),
        atDistanceM,behindBunchSeconds:paid[0].behindBunchSeconds,
        energyByRider:Object.fromEntries(paid.map(row=>
          [row.riderId,row.energyAfter]))},
      remainingKmUnsettled:true,officialResults:false};
  }
  throw new Error('Rear solo riders did not make paid contact.');
}

export function validateRearSplitSoloContactV1(input,recording){
  if(!isDeepStrictEqual(recording,advanceRearSplitSoloContactV1(input)))
    throw new Error('Rear solo contact differs from paid source.');
  return true;
}
