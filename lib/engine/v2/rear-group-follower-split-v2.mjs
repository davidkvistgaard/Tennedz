// Opt-in terrain-priced split from a replayed two-rider rear group.
// The V1 physical separation remains the source of its contact marker.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearGroupFollowerSplitV1} from
  './rear-group-follower-split-v1.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {MOTOR_RECOVERY_CEILING} from './tuning.mjs';

export const REAR_GROUP_FOLLOWER_SPLIT_V2_VERSION=
  'v2-rear-group-follower-split-2';

export function advanceRearGroupFollowerSplitV2(input){
  // This source binds the contact and split route segments, but does not
  // bind earlier cap-decay kilometres. Refuse a later cap built from them.
  if(input.priorChoiceInput?.contactInput?.segment?.km>
    MOTOR_RECOVERY_CEILING.afterKm+1)
    throw new Error('Terrain split needs sourced precontact decay route.');
  const sourceV1=advanceRearGroupFollowerSplitV1(input);
  if(sourceV1.status!=='two_solos_behind'||
    !isDeepStrictEqual(input.routeKilometres?.[input.segment.km-1],
      input.segment)||
    !isDeepStrictEqual(input.routeKilometres?.[
      input.priorChoiceInput.contactInput.segment.km-1],
    input.priorChoiceInput.contactInput.segment))
    throw new Error('Terrain split needs confirmed route-bound solo road.');
  const riders=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const prior=input.priorChoice.group.continuation.rearGroup;
  const prices=[sourceV1.leaderRiderId,sourceV1.followerRiderId].map(
    (riderId,index)=>{
      const rider=riders.get(riderId);
      const effort=index===0?sourceV1.leaderDecision.effort:
        sourceV1.followerDecision.effort;
      const role=index===0?'leader':'solo';
      const price=priceRearEnergyDemandV1({rider,
        segment:input.segment,
        energyBefore:prior.energyByRider[riderId],effort,role,
        distanceM:1000});
      const capSource=replayRearEnergyCapV1({rider,
        kilometres:input.routeKilometres,
        throughKm:input.segment.km});
      const recovery=recoveryForKilometre({rider,
        segment:input.segment,effort,group:'dropped',
        working:index===0,quietKm:0});
      if(recovery.recovery!==0||recovery.quietKm!==0)
        throw new Error('Split solo cannot claim bunch recovery.');
      return {...price,cap:capSource.cap,
        capAdjustment:Math.max(0,price.energyAfter-capSource.cap),
        energyAfter:+Math.min(price.energyAfter,capSource.cap).toFixed(3)};
    });
  const solos=sourceV1.solos.map((row,index)=>({
    ...row,energyAfter:prices[index].energyAfter}));
  return {version:REAR_GROUP_FOLLOWER_SPLIT_V2_VERSION,
    sourceV1,prices,solos,officialResults:false};
}

export function validateRearGroupFollowerSplitV2(input,recording){
  if(!isDeepStrictEqual(recording,
    advanceRearGroupFollowerSplitV2(input)))
    throw new Error('Terrain rear split differs from paid source.');
  return true;
}
