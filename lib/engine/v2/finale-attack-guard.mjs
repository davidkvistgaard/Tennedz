import {breakAttackAt,orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_PENDING_ATTACK_GUARD_VERSION=
  'v2-finale-pending-attack-guard-1';
export const FINALE_EXHAUSTED_ATTACK_DECISION_VERSION=
  'v2-finale-exhausted-named-attack-1';
export const FINALE_NAMED_BLOCK_DECISION_VERSION=
  'v2-finale-named-block-decision-2';

// Short-step travel candidates cannot silently suppress valid manager attacks.
// This checks the same kilometre cadence and named phase starts as the source
// motor. It is conservative about rider readiness: an attempted move needs a
// future recorded attack/position model, even if that move might fail.
export function pendingFinaleAttacksAt(tour,snapshot,km,
  {includeBlocked=false,includeUnavailable=false}={}){
  const stateById=new Map(snapshot.riders.map(row=>[row.riderId,row]));
  const keypoints=new Set((tour.committedInputs.keypoints??[])
    .map(point=>Number(point.km)));
  const pending=[];
  for(const team of tour.committedInputs.teams){
    if(team.orders.gcObjective!=='stage_result'&&team.riders.some(rider=>
      stateById.get(rider.id)?.status==='peloton'))
      pending.push({kind:'gc_tactics',teamId:team.id,riderId:null,
        message:`The short-step finale needs recorded GC tactics: ${
          team.id} at km ${km}.`});
    const breakRiderId=breakAttackAt(team.orders,km);
    if(breakRiderId&&stateById.get(breakRiderId)?.status==='breakaway')
      pending.push({kind:'break_attack',teamId:team.id,riderId:breakRiderId,
        message:`The short-step finale needs a recorded break attack: ${
          breakRiderId} at km ${km}.`});
    const order=orderAt(team.orders,km-1);
    if(order.attack==='none')continue;
    const aheadCount=team.riders.filter(rider=>
      stateById.get(rider.id)?.status==='breakaway').length;
    if(aheadCount>=TUNING.breakaway.maxRidersPerTeam&&!includeBlocked)
      continue;
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
    if(aheadCount>=TUNING.breakaway.maxRidersPerTeam){
      pending.push({kind:'team_break_limit',teamId:team.id,
        riderId:order.attackRiderId??null,
        message:`The short-step finale needs a recorded team break limit: ${
          team.id} at km ${km}.`});
      continue;
    }
    const eligible=order.attackRiderId?
      stateById.get(order.attackRiderId)?.status==='peloton':
      team.riders.some(rider=>
        stateById.get(rider.id)?.status==='peloton');
    if(eligible)
      pending.push({kind:'peloton_attack',teamId:team.id,
        riderId:order.attackRiderId??null,
        message:`The short-step finale needs a recorded peloton attack: ${
          team.id} at km ${km}.`});
    else if(includeUnavailable&&order.attackRiderId!=null)
      pending.push({kind:'named_unavailable',teamId:team.id,
        riderId:order.attackRiderId,
        message:`The short-step finale needs a recorded blocked attack: ${
          team.id} at km ${km}.`});
  }
  return pending;
}

export function assertNoPendingFinaleAttacks(tour,snapshot,grid){
  for(const km of new Set(grid.map(slice=>slice.sourceKm))){
    const first=pendingFinaleAttacksAt(tour,snapshot,km)[0];
    if(first)throw new Error(first.message);
  }
}
