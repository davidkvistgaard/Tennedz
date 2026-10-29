// Opt-in physical hold gate for a source-replayed rear-group kilometre.
// A rider who cannot match the paid leader needs a separately paid split road.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearGroupSourceRoadV1} from
  './rear-group-source-road-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_GROUP_SOURCE_ROAD_V2_VERSION=
  'v2-rear-group-source-road-2';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Rear hold speed is invalid.');
  return 3600/seconds;
};

export function advanceRearGroupSourceRoadV2(input){
  const sourceRoad=advanceRearGroupSourceRoadV1(input);
  const group=input.priorChoice.group.continuation.rearGroup;
  const riders=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const leader=sourceRoad.riderPlans.find(row=>
    row.riderId===sourceRoad.road.leaderRiderId);
  const base=segmentBaseSeconds(input.segment);
  const holdChecks=sourceRoad.memberDecisions.filter(row=>
    row.riderId!==leader.riderId).map(decision=>{
    const rider=riders.get(decision.riderId);
    const effect=riderKilometreEffect(rider,input.segment,{
      phase:'cruise',energy:group.energyByRider[rider.id],
      exposed:input.segment.exposed});
    const holdSpeedKph=speed(base,effect.ability+
      (TUNING.effortPressure[decision.effort]-1)*20+
      TUNING.breakaway.bunchDraftAdvantage);
    return {riderId:rider.id,effort:decision.effort,
      holdSpeedKph,leaderSpeedKph:leader.speedKph,
      canHold:holdSpeedKph+1e-9>=leader.speedKph};
  });
  if(holdChecks.some(row=>!row.canHold))
    throw new Error('Rear rider cannot hold the paid leader; split road needed.');
  return {version:REAR_GROUP_SOURCE_ROAD_V2_VERSION,
    sourceRoad,holdChecks,officialResults:false};
}

export function validateRearGroupSourceRoadV2(input,recording){
  if(!isDeepStrictEqual(recording,
    advanceRearGroupSourceRoadV2(input)))
    throw new Error('Rear hold differs from the paid source.');
  return true;
}
