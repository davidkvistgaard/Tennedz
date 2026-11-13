// Source-replayed, turn-by-turn meeting of two separated rear solos. Unlike
// V1, a rider only needs enough energy to reach the actual contact marker.
import {isDeepStrictEqual} from 'node:util';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {advanceFinaleGap} from './finale-step.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {advanceRearGroupFollowerSplitV2} from
  './rear-group-follower-split-v2.mjs';
import {runRearSplitSoloV2} from './rear-split-solo-run-v2.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_SPLIT_SOLO_CONTACT_V2_VERSION=
  'v2-rear-split-solo-contact-2';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Rear solo contact has invalid pace.');
  return 3600/seconds;
};

export function advanceRearSplitSoloContactV2({splitInput,split,
  priorRunInput=null,priorRun=null,segment,bunchTurnPlan,soloChoices}){
  if(!isDeepStrictEqual(split,
    advanceRearGroupFollowerSplitV2(splitInput))||
    (priorRunInput===null)!==(priorRun===null)||
    (priorRunInput!==null&&
      (!isDeepStrictEqual(priorRun,
        runRearSplitSoloV2(priorRunInput))||
       !isDeepStrictEqual(priorRunInput.splitInput,splitInput)||
       !isDeepStrictEqual(priorRunInput.split,split)))||
    segment?.km!==(priorRun?.steps.at(-1).sourceKm??
      split.sourceV1.sourceKm)+1||
    !isDeepStrictEqual(splitInput.routeKilometres?.[
      segment.km-1],segment)||
    !Array.isArray(soloChoices)||soloChoices.length!==2||
    new Set(soloChoices.map(row=>row?.riderId)).size!==2||
    soloChoices.some(row=>
      !['conserve','steady','hard'].includes(row.effort)||
      !['finish_safely','rejoin_bunch'].includes(row.reason)))
    throw new Error('Rear solo contact needs consecutive replayed sources.');
  const states=priorRun?.finalSoloStates??split.solos;
  if(soloChoices.some(row=>!states.some(state=>
    state.riderId===row.riderId)))
    throw new Error('Rear solo contact needs both rider decisions.');
  bunchAbilityFromPaidTurnsV1(bunchTurnPlan);
  const riders=new Map(splitInput.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const choices=new Map(soloChoices.map(row=>[row.riderId,row]));
  const balances=states.map(row=>row.energyAfter);
  const gaps=states.map(row=>row.behindBunchSeconds);
  if(gaps[0]<=0||gaps[1]<=gaps[0])
    throw new Error('Rear solo contact needs ordered paid road.');
  const startM=(segment.km-1)*1000;
  const base=segmentBaseSeconds(segment);
  const slices=[];
  for(const turn of bunchTurnPlan.turns){
    const slice={startDistanceM:startM+turn.startM,
      endDistanceM:startM+turn.endM,
      lengthM:turn.endM-turn.startM};
    const bunchSpeedKph=speed(base,turn.ability+
      TUNING.breakaway.bunchDraftAdvantage);
    const soloSpeeds=states.map((state,index)=>{
      const choice=choices.get(state.riderId);
      const effect=riderKilometreEffect(riders.get(state.riderId),
        segment,{phase:'solo',energy:balances[index],
          exposed:segment.exposed});
      return speed(base,effect.ability+
        (TUNING.effortPressure[choice.effort]-1)*20);
    });
    const meeting=advanceFinaleGap({slice,
      gapSeconds:gaps[1]-gaps[0],
      frontSpeedKph:soloSpeeds[0],
      chaseSpeedKph:soloSpeeds[1]});
    const frontBunch=advanceFinaleGap({slice,
      gapSeconds:gaps[0],frontSpeedKph:bunchSpeedKph,
      chaseSpeedKph:soloSpeeds[0]});
    if(frontBunch.caught&&(!meeting.caught||
      frontBunch.catchDistanceM<=meeting.catchDistanceM+1e-9))
      throw new Error('Front solo reaches bunch before rear contact.');
    const endDistanceM=meeting.catchDistanceM??slice.endDistanceM;
    const distanceM=endDistanceM-slice.startDistanceM;
    const paid=states.map((state,index)=>{
      const choice=choices.get(state.riderId);
      const price=priceRearEnergyDemandV1({
        rider:riders.get(state.riderId),segment,
        energyBefore:balances[index],effort:choice.effort,
        role:'solo',distanceM});
      const behindBunchSeconds=gaps[index]+distanceM*3.6*
        (1/soloSpeeds[index]-1/bunchSpeedKph);
      balances[index]=price.energyAfter;
      gaps[index]=behindBunchSeconds;
      return {riderId:state.riderId,effort:choice.effort,
        reason:choice.reason,energyBefore:price.energyBefore,
        energySpent:price.energyDemand,
        energyAfter:price.energyAfter,behindBunchSeconds};
    });
    slices.push({startDistanceM:slice.startDistanceM,
      endDistanceM,bunchLeaderAbility:turn.ability,
      bunchSpeedKph,soloSpeeds,paid});
    if(!meeting.caught)continue;
    if(Math.abs(gaps[0]-gaps[1])>1e-7||gaps[0]<=0)
      throw new Error('Rear solos did not meet behind bunch.');
    const totals=states.map((state,index)=>({riderId:state.riderId,
      energyBefore:state.energyAfter,
      energySpent:slices.reduce((sum,row)=>
        sum+row.paid[index].energySpent,0),
      energyAfter:balances[index],behindBunchSeconds:gaps[index]}));
    return {version:REAR_SPLIT_SOLO_CONTACT_V2_VERSION,
      sourceKm:segment.km,soloChoices:structuredClone(soloChoices),
      slices,atDistanceM:endDistanceM,paid:totals,
      event:{kind:'rear_contact',atDistanceM:endDistanceM,
        riderIds:totals.map(row=>row.riderId)},
      rearGroup:{riderIds:totals.map(row=>row.riderId),
        atDistanceM:endDistanceM,behindBunchSeconds:gaps[0],
        energyByRider:Object.fromEntries(totals.map(row=>
          [row.riderId,row.energyAfter]))},
      remainingKmUnsettled:true,officialResults:false};
  }
  throw new Error('Rear solo riders did not make paid contact.');
}

export function validateRearSplitSoloContactV2(input,recording){
  if(!isDeepStrictEqual(recording,advanceRearSplitSoloContactV2(input)))
    throw new Error('Rear solo contact differs from paid source.');
  return true;
}
