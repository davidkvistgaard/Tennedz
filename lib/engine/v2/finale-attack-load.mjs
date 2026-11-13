import {validateRecordedTour} from './recording.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_ATTACK_LOAD_HANDOFF_VERSION=
  'v2-finale-attack-load-handoff-1';

// The kilometre motor keeps repeat-attack load internally. Reconstruct its
// source-boundary value from validated actions, without consulting the future
// kilometres that the short-step finale will replace.
export function finaleAttackLoadFromTour(tour,sourceKm){
  validateRecordedTour(tour);
  if(!Number.isInteger(sourceKm)||sourceKm<1||
    sourceKm>tour.route.distanceKm)
    throw new Error('Invalid finale attack-load source kilometre.');
  const loads=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,0])));
  for(const frame of tour.frames.slice(0,sourceKm)){
    for(const [id,load] of loads)
      loads.set(id,+Math.max(0,load-
        TUNING.attack.loadRecoveryPerKm).toFixed(3));
    for(const riderId of frame.attackers)
      loads.set(riderId,+(loads.get(riderId)+1).toFixed(3));
    for(const attempt of frame.splitAttacks)
      if(['split','joined_group_ahead'].includes(attempt.status))
        loads.set(attempt.riderId,
          +(loads.get(attempt.riderId)+1).toFixed(3));
  }
  return {version:FINALE_ATTACK_LOAD_HANDOFF_VERSION,sourceKm,
    riderLoads:[...loads.entries()].map(([riderId,load])=>({riderId,load}))};
}
