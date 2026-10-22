import {isDeepStrictEqual} from 'node:util';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {advanceFinaleNamedAttackSlice} from
  './finale-named-attack-step.mjs';
import {advanceFinaleNamedAttackTransition,
  FINALE_NAMED_ATTACK_TRANSITION_VERSION} from
  './finale-named-attack-transition.mjs';

export const FINALE_NAMED_ATTACK_ROTATION_TRANSITION_VERSION=
  'v2-finale-named-attack-rotation-transition-1';

// Opt-in first-slice variant. The v1 contest selects a reactive chaser; the
// remaining independent rotating teams may supply one paid pair. The larger
// of those earned paces determines whether the named attack splits.
export function advanceFinaleNamedAttackRotationTransition(input){
  const base=advanceFinaleNamedAttackTransition(input);
  const rotation=recordFinaleFrontRotationSlice({
    slice:input.slice,route:input.route,teams:input.teams,
    pelotonRiderIds:input.pelotonRiderIds.filter(id=>
      id!==input.attackerRiderId),energies:input.energies,
    busyTeamIds:[input.attackerTeamId,
      ...(base.chase?[base.chase.teamId]:[])]});
  const selected=rotation.selected;
  const workers=new Map(selected?.work.map(row=>[row.riderId,row])??[]);
  if(workers.has(input.attackerRiderId)||
    workers.has(base.chase?.riderId))
    throw new Error('A finale rider cannot attack, chase and rotate at once.');
  const bunchSpeedKph=Math.max(input.slice.lengthM*3.6/
    base.attack.bunchSeconds,rotation.bunchSpeedKph);
  const team=input.teams.find(row=>row.id===input.attackerTeamId);
  const attack=advanceFinaleNamedAttackSlice({slice:input.slice,
    route:input.route,team,riderId:input.attackerRiderId,
    energy:input.energies.get(input.attackerRiderId),
    repeatLoad:input.repeatLoad,bunchSpeedKph});
  const riderEnergy=base.riderEnergy.map(row=>{
    const worker=workers.get(row.riderId);
    return worker?{riderId:row.riderId,role:'front_rotation',
      energyAtDecision:worker.energyAtDecision,
      energySpent:worker.energySpent,
      energyAfter:worker.energyAfter}:row;
  });
  const split=attack.status==='split';
  return {version:FINALE_NAMED_ATTACK_ROTATION_TRANSITION_VERSION,
    sourceTransitionVersion:FINALE_NAMED_ATTACK_TRANSITION_VERSION,
    rotationVersion:rotation.version,
    startDistanceM:input.slice.startDistanceM,
    endDistanceM:input.slice.endDistanceM,
    sourceKm:input.slice.sourceKm,
    bunchElapsedSeconds:attack.bunchSeconds,
    attack,chase:base.chase,rotation,
    riderEnergy,
    pelotonRiderIds:split?input.pelotonRiderIds.filter(id=>
      id!==input.attackerRiderId):[...input.pelotonRiderIds],
    roadGroups:split?[{id:`launch:${input.attackerRiderId}:${input.slice.startDistanceM}`,
      riderIds:[input.attackerRiderId],teamIds:[input.attackerTeamId],
      gapSeconds:attack.earnedGapSeconds}]:[]};
}

export function validateFinaleNamedAttackRotationTransition(input,recorded){
  if(!isDeepStrictEqual(recorded,
    advanceFinaleNamedAttackRotationTransition(input)))
    throw new Error('The rotating named attack transition does not replay.');
  return true;
}
