import {breakAttackAt,orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_PENDING_ATTACK_GUARD_VERSION=
  'v2-finale-pending-attack-guard-1';

// Short-step travel candidates cannot silently suppress valid manager attacks.
// This checks the same kilometre cadence and named phase starts as the source
// motor. It is conservative about rider readiness: an attempted move needs a
// future recorded attack/position model, even if that move might fail.
export function assertNoPendingFinaleAttacks(tour,snapshot,grid){
  const stateById=new Map(snapshot.riders.map(row=>[row.riderId,row]));
  const keypoints=new Set((tour.committedInputs.keypoints??[])
    .map(point=>Number(point.km)));
  const sourceKm=new Set(grid.map(slice=>slice.sourceKm));
  for(const km of sourceKm){
    for(const team of tour.committedInputs.teams){
      if(team.orders.gcObjective!=='stage_result'&&team.riders.some(rider=>
        stateById.get(rider.id)?.status==='peloton'))
        throw new Error(`The short-step finale needs recorded GC tactics: ${
          team.id} at km ${km}.`);
      const breakRiderId=breakAttackAt(team.orders,km);
      if(breakRiderId&&stateById.get(breakRiderId)?.status==='breakaway')
        throw new Error(`The short-step finale needs a recorded break attack: ${
          breakRiderId} at km ${km}.`);
      const order=orderAt(team.orders,km-1);
      if(order.attack==='none')continue;
      const aheadCount=team.riders.filter(rider=>
        stateById.get(rider.id)?.status==='breakaway').length;
      if(aheadCount>=TUNING.breakaway.maxRidersPerTeam)continue;
      const namedPhaseStarts=order.attackRiderId!=null&&
        team.orders.phases.some(phase=>phase.atKm===km-1&&
          (phase.attack!==undefined||phase.attackRiderId!==undefined));
      const attempts=namedPhaseStarts||
        order.attack==='repeated'&&
          (km%TUNING.attack.repeatedEveryKm===0||keypoints.has(km))||
        order.attack==='selective'&&
          (km%TUNING.attack.selectiveEveryKm===0||keypoints.has(km));
      if(!attempts)continue;
      const committedFinale=order.attackRiderId!=null||
        team.orders.phases.some(phase=>phase.atKm<=km-1&&
          phase.attack===order.attack);
      if(km===tour.route.distanceKm&&!committedFinale)continue;
      const eligible=order.attackRiderId?
        stateById.get(order.attackRiderId)?.status==='peloton':
        team.riders.some(rider=>
          stateById.get(rider.id)?.status==='peloton');
      if(eligible)
        throw new Error(`The short-step finale needs a recorded peloton attack: ${
          team.id} at km ${km}.`);
    }
  }
}
