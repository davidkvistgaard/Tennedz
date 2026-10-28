// Two named helpers share one exposed bunch-front position in equal turns.
// The ordinary riding cost remains in the kilometre energy ledger.
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING,MOTOR_EXPLICIT_FRONT} from './tuning.mjs';

export const BUNCH_FRONT_TURNS_VERSION='v2-bunch-front-turns-1';

export function planBunchFrontTurnsV1({paidPace,teams,segment,km}){
  if(!paidPace||typeof paidPace.teamId!=='string'||
    !['hard','steady','conserve'].includes(paidPace.effort)||
    !Array.isArray(paidPace.riderIds)||paidPace.riderIds.length!==2||
    paidPace.riderIds[0]===paidPace.riderIds[1]||
    !Number.isFinite(paidPace.ability)||!Array.isArray(teams)||
    !Number.isInteger(km)||km<1||segment?.km!==km)
    throw new Error('Invalid paid bunch-front pair.');
  const team=teams.find(row=>row.id===paidPace.teamId);
  const workers=paidPace.riderIds.map(id=>team?.riders?.find(row=>
    row.id===id));
  if(workers.some(worker=>!worker)||
    paidPace.riderIds.some(id=>!Number.isFinite(team.energy?.[id])||
      team.energy[id]<0||team.energy[id]>100))
    throw new Error('Bunch-front worker lacks committed energy.');
  const adjustment=paidPace.effort==='conserve'?
    MOTOR_EXPLICIT_FRONT.conserveFrontAdjustmentPoints:
    TUNING.groups.frontPaceAdjustmentPoints[paidPace.effort];
  const abilities=workers.map(worker=>riderKilometreEffect(worker,segment,
    {phase:'cruise',energy:team.energy[worker.id],
      exposed:segment.exposed}).ability+adjustment);
  const expectedAbility=(abilities[0]+abilities[1])/2;
  if(Math.abs(expectedAbility-paidPace.ability)>1e-8)
    throw new Error('Bunch-front turn pace differs from selected pair.');
  const order=km%2?[0,1]:[1,0];
  const turns=order.map((index,turn)=>({leaderRiderId:workers[index].id,
    startM:turn*500,endM:(turn+1)*500,ability:abilities[index]}));
  const exposedExtraCostPerKm=paidPace.effort==='hard'?
    TUNING.groups.hardPaceWorkerExtraCostPerKm:
    paidPace.effort==='steady'?
      TUNING.groups.steadyPaceWorkerExtraCostPerKm:
      MOTOR_EXPLICIT_FRONT.conserveWorkerExtraCostPerKm;
  const extraEnergyCosts=paidPace.riderIds.map(riderId=>({riderId,
    leadingM:500,extraCost:+(exposedExtraCostPerKm/2).toFixed(6)}));
  if(extraEnergyCosts.some(row=>team.energy[row.riderId]<row.extraCost))
    throw new Error('Bunch-front worker cannot pay the selected turn.');
  return {version:BUNCH_FRONT_TURNS_VERSION,teamId:team.id,
    riderIds:[...paidPace.riderIds],turns,extraEnergyCosts,
    ability:expectedAbility};
}
