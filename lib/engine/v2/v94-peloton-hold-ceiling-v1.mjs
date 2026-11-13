// Conservative pace check only. It never creates a split, wheel or position.
// A rider who cannot match a named turn even with the best phase, hard effort
// and the largest existing shelter allowance needs a physical road decision.
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {MOTOR_DRAFT_SHELTER,TUNING} from './tuning.mjs';

export const V94_PELOTON_HOLD_CEILING_VERSION=
  'v94-peloton-hold-ceiling-1';
const phases=['cruise','chase','attack','solo','finale'];
const generousShelter=Math.max(...Object.values(MOTOR_DRAFT_SHELTER));
const hardBonus=(TUNING.effortPressure.hard-1)*20;

export function inspectV94PelotonHoldCeilingV1({plan,priorRiderStates,
  aheadRiderIds,teams,segment,km}){
  if(!Number.isInteger(km)||km<1||segment?.km!==km||
    !Array.isArray(plan?.turns)||!Array.isArray(priorRiderStates)||
    !Array.isArray(aheadRiderIds)||!Array.isArray(teams)||
    new Set(priorRiderStates.map(row=>row.id)).size!==
      priorRiderStates.length)
    throw new Error('Invalid V94 peloton hold source.');
  const ahead=new Set(aheadRiderIds);
  const byRider=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,{rider,team}])));
  const followers=priorRiderStates.filter(row=>
    row.group==='peloton'&&!ahead.has(row.id));
  const risk=[];
  for(const turn of plan.turns)for(const state of followers){
    if(state.id===turn.leaderRiderId)continue;
    const source=byRider.get(state.id);
    if(!source||!Number.isFinite(state.energy)||
      !Number.isFinite(turn.ability)||turn.endM<=turn.startM)
      throw new Error('Invalid V94 peloton hold rider or turn.');
    const strongestPhase=Math.max(...phases.map(phase=>
      riderKilometreEffect(source.rider,segment,{phase,
        energy:state.energy,exposed:segment.exposed}).ability));
    const ceiling=+(strongestPhase+hardBonus+generousShelter).toFixed(3);
    if(ceiling+1e-9>=turn.ability)continue;
    risk.push({version:V94_PELOTON_HOLD_CEILING_VERSION,
      sourceKm:km,riderId:state.id,teamId:source.team.id,
      energyBefore:state.energy,
      teamOrderEffort:orderAt(source.team.orders,km-1).effort,
      leaderRiderId:turn.leaderRiderId,
      turnStartM:turn.startM,turnEndM:turn.endM,
      leaderAbility:turn.ability,strongestPhaseAbility:strongestPhase,
      hardEffortBonus:hardBonus,generousShelterBonus:generousShelter,
      holdAbilityCeiling:ceiling});
  }
  return risk.sort((a,b)=>a.turnStartM-b.turnStartM||
    a.riderId.localeCompare(b.riderId));
}
