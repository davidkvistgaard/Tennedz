// Reallocate a recorded front turn only among its physically present,
// source-named workers. This is a pending paid plan, not road movement.
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {quoteRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';

export const V94_PHYSICAL_AVAILABLE_FRONT_TURNS_VERSION=
  'v94-physical-available-front-turns-1';
const EPS=1e-7;

export function planV94PhysicalAvailableFrontTurnsV1(
  recording,prior){
  const km=prior?.sourceKm+1;
  const frame=recording.frames[km-1];
  const segment=recording.route.kilometres[km-1];
  const sourcePlan=frame?.pelotonFrontTurnPlan;
  const sourceTurns=sourcePlan?.turns;
  if(!Number.isInteger(km)||segment?.km!==km||
    !prior.fullFieldKilometre||
    sourcePlan?.status!=='worked'||
    !Array.isArray(sourceTurns)||!sourceTurns.length||
    sourceTurns[0].startM!==0||
    sourceTurns.at(-1).endM!==1000||
    sourceTurns.some((row,index)=>
      row.endM<=row.startM||
      index>0&&sourceTurns[index-1].endM!==row.startM)||
    new Set(sourceTurns.map(row=>
      row.leaderRiderId)).size!==sourceTurns.length)
    throw new Error('Available front needs a recorded turn plan.');
  const byRider=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[
      rider.id,{rider,team}])));
  const stakes=new Map(recording.committedInputs.rivalIntent
    .map(row=>[row.teamId,row]));
  const priorFinish=new Map(prior.finishes.map(row=>[
    row.riderId,row]));
  const sourceEnergy=new Map(frame.energyLedger.map(row=>[
    row.riderId,row]));
  const missing=[];
  const present=[];
  for(const turn of sourceTurns){
    const old=priorFinish.get(turn.leaderRiderId);
    const member=byRider.get(turn.leaderRiderId);
    const stake=stakes.get(member?.team.id);
    const order=member&&orderAt(member.team.orders,km-1);
    const payment=sourcePlan.extraEnergyCosts.find(row=>
      row.riderId===turn.leaderRiderId&&
      row.teamId===turn.teamId&&
      row.workKind===turn.workKind&&
      row.leadingM===turn.endM-turn.startM);
    const ledger=sourceEnergy.get(turn.leaderRiderId);
    if(!old||!member||!stake?.sportingGoal||
      !order||!payment||!ledger||
      member.team.id!==turn.teamId||
      !['front','chase'].includes(turn.workKind)||
      !Number.isFinite(turn.ability)||
      !Number.isFinite(payment.extraCost)||
      payment.extraCost<=0)
      throw new Error('Available front lacks source-named work.');
    if(old.physicalGroup!=='peloton'){
      missing.push({riderId:turn.leaderRiderId,
        teamId:turn.teamId,sourceWorkKind:turn.workKind,
        sourceStartM:turn.startM,sourceEndM:turn.endM,
        priorPhysicalGroup:old.physicalGroup,
        choice:'cannot_take_front_turn_from_rear'});
      continue;
    }
    if(Math.abs(old.clockSeconds-
      prior.front.frontClockSeconds)>EPS)
      throw new Error('Available worker lacks front clock.');
    const phase=turn.workKind==='chase'?'chase':'cruise';
    const physical=riderKilometreEffect(member.rider,segment,{
      phase,energy:old.energyAfter,
      exposed:segment.exposed});
    const recorded=riderKilometreEffect(member.rider,segment,{
      phase,energy:ledger.energyBefore,
      exposed:segment.exposed});
    const ability=turn.ability+
      physical.ability-recorded.ability;
    const costPerKm=payment.extraCost*1000/
      (turn.endM-turn.startM);
    present.push({riderId:turn.leaderRiderId,
      teamId:turn.teamId,workKind:turn.workKind,
      sourceStartM:turn.startM,
      sourceEndM:turn.endM,
      sourceAbility:turn.ability,
      sourceEnergyBefore:ledger.energyBefore,
      priorEnergy:old.energyAfter,
      perceivedAbility:ability,
      costPerKm,
      managerEffort:order.effort,
      managerChase:order.chase,
      managerFrontWork:order.frontWork??null,
      sportingGoal:stake.sportingGoal,
      sportingCaptainId:stake.sportingCaptainId,
      rider:member.rider});
  }
  if(!present.length||(!missing.length&&
    !present.some(row=>Math.abs(row.priorEnergy-
      row.sourceEnergyBefore)>1e-6)))
    throw new Error('Available front needs measured physical change.');
  let metre=0;
  const turns=present.map((row,index)=>{
    const leadingM=missing.length?
      Math.floor(1000/present.length)+
        (index<1000%present.length?1:0):
      row.sourceEndM-row.sourceStartM;
    const startM=metre;
    metre+=leadingM;
    const extraCost=+(row.costPerKm*leadingM/1000)
      .toFixed(6);
    const quote=quoteRearEnergyDemandV1({
      rider:row.rider,segment,
      energyBefore:row.priorEnergy,
      effort:row.managerEffort,role:'leader',
      distanceM:leadingM});
    return {teamId:row.teamId,
      leaderRiderId:row.riderId,
      workKind:row.workKind,startM,endM:metre,
      ability:row.perceivedAbility,
      sourceAbility:row.sourceAbility,
      sourceStartM:row.sourceStartM,
      sourceEndM:row.sourceEndM,
      energyAtBoundary:row.priorEnergy,
      managerEffort:row.managerEffort,
      managerChase:row.managerChase,
      managerFrontWork:row.managerFrontWork,
      sportingGoal:row.sportingGoal,
      sportingCaptainId:row.sportingCaptainId,
      quotedBaseEnergyDemand:quote.energyDemand,
      quotedExtraCost:extraCost,
      payable:quote.energyDemand+extraCost<=
        row.priorEnergy+EPS,
      choice:missing.length?
        'pending_paid_reallocated_front_turn':
        'pending_paid_repriced_front_turn'};
  });
  if(metre!==1000||turns.some(row=>!row.payable))
    throw new Error('Available front cannot pay all turns.');
  return {version:V94_PHYSICAL_AVAILABLE_FRONT_TURNS_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    sourcePlanVersion:sourcePlan.version,
    missing,turns,
    sourceTurnCount:sourceTurns.length,
    availableTurnCount:turns.length,
    sourcePlanNotPhysical:true,
    paidWorkPending:true,
    physicalRoadMoved:false,officialResults:false};
}
