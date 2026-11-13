import {isDeepStrictEqual} from 'node:util';
import {contestFinaleNamedAttackSlice} from
  './finale-named-attack-contest.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_NAMED_ATTACK_TRANSITION_VERSION=
  'v2-finale-named-attack-transition-1';

// An isolated one-bunch transition. Every present rider pays once, and a
// successful launch becomes a distinct road group at the slice boundary.
export function advanceFinaleNamedAttackTransition(input){
  const contest=contestFinaleNamedAttackSlice(input);
  const {slice,route,teams,pelotonRiderIds,energies,attackerRiderId}=input;
  const segment=route.kilometres[slice.sourceKm-1];
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const energyRows=pelotonRiderIds.map(riderId=>{
    const energyAtDecision=energies.get(riderId);
    const role=riderId===attackerRiderId?'attack':
      riderId===contest.chase?.riderId?'chase':'sheltered';
    const energySpent=role==='attack'?contest.attack.energySpent:
      role==='chase'?contest.chase.energySpent:
        energyCostForFinaleSlice(slice,TUNING.effortCost.conserve*
          riderKilometreEffect(ridersById.get(riderId),segment,{
            phase:'chase',energy:energyAtDecision,
            exposed:segment.exposed}).energyCostMultiplier);
    if(energySpent>energyAtDecision+1e-9)
      throw new Error(`A finale rider cannot pay for this slice: ${riderId}.`);
    return {riderId,role,energyAtDecision,energySpent,
      energyAfter:Math.max(0,energyAtDecision-energySpent)};
  });
  const split=contest.attack.status==='split';
  const peloton=split?pelotonRiderIds.filter(id=>id!==attackerRiderId):
    [...pelotonRiderIds];
  return {version:FINALE_NAMED_ATTACK_TRANSITION_VERSION,
    contestVersion:contest.version,
    startDistanceM:slice.startDistanceM,endDistanceM:slice.endDistanceM,
    sourceKm:slice.sourceKm,
    bunchElapsedSeconds:contest.attack.bunchSeconds,
    attack:contest.attack,chase:contest.chase,
    riderEnergy:energyRows,
    pelotonRiderIds:peloton,
    roadGroups:split?[{id:`launch:${attackerRiderId}:${slice.startDistanceM}`,
      riderIds:[attackerRiderId],teamIds:[input.attackerTeamId],
      gapSeconds:contest.attack.earnedGapSeconds}]:[]};
}

export function validateFinaleNamedAttackTransition(input,recorded){
  if(!isDeepStrictEqual(recorded,advanceFinaleNamedAttackTransition(input)))
    throw new Error('The named finale transition does not replay from its inputs.');
  return true;
}
