// Opt-in physical hold check for each paid turn within a rear kilometre.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearGroupTurnKilometreV1} from
  './rear-group-turn-kilometre-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_GROUP_TURN_KILOMETRE_V2_VERSION=
  'v2-rear-group-turn-kilometre-2';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Rear turn hold speed is invalid.');
  return 3600/seconds;
};

export function advanceRearGroupTurnKilometreV2(input){
  const sourceTurn=advanceRearGroupTurnKilometreV1(input);
  const riderById=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const decisionById=new Map(sourceTurn.memberDecisions.map(row=>
    [row.riderId,row]));
  const base=segmentBaseSeconds(input.segment);
  const holdChecks=sourceTurn.slices.flatMap(slice=>
    slice.riders.filter(row=>row.role==='sheltered').map(row=>{
      const decision=decisionById.get(row.riderId);
      const effect=riderKilometreEffect(riderById.get(row.riderId),
        input.segment,{phase:'cruise',energy:row.energyBefore,
          exposed:input.segment.exposed});
      const holdSpeedKph=speed(base,effect.ability+
        (TUNING.effortPressure[decision.effort]-1)*20+
        TUNING.breakaway.bunchDraftAdvantage);
      return {startDistanceM:slice.startDistanceM,
        endDistanceM:slice.endDistanceM,
        riderId:row.riderId,leaderRiderId:slice.leaderRiderId,
        holdSpeedKph,leaderSpeedKph:slice.leaderSpeedKph,
        canHold:holdSpeedKph+1e-9>=slice.leaderSpeedKph};
    }));
  if(holdChecks.some(row=>!row.canHold))
    throw new Error('Rear turn follower cannot hold paid leader; split road needed.');
  return {version:REAR_GROUP_TURN_KILOMETRE_V2_VERSION,
    sourceTurn,holdChecks,officialResults:false};
}

export function validateRearGroupTurnKilometreV2(input,recording){
  if(!isDeepStrictEqual(recording,
    advanceRearGroupTurnKilometreV2(input)))
    throw new Error('Rear turn hold differs from paid source.');
  return true;
}
