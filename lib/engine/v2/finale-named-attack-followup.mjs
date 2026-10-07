import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleGroupStep,advanceFinaleMergedStep} from
  './finale-group-step.mjs';
import {finalePassiveBunchSpeed,finalePassiveFrontSpeed,
  finaleWorkerStep,
  FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {validateFinaleNamedAttackTransition} from
  './finale-named-attack-transition.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_NAMED_ATTACK_FOLLOWUP_VERSION=
  'v2-finale-named-attack-followup-1';

function shelteredRate(rider,segment,energy){
  return TUNING.effortCost.conserve*riderKilometreEffect(rider,segment,{
    phase:'chase',energy,exposed:segment.exposed}).energyCostMultiplier;
}

// Continue one verified launch through the immediately adjacent grid slice.
// The same kilometre has no new manager decision boundary. A catch is split
// at its actual distance and everyone shelters for the remainder.
export function continueFinaleNamedAttackGroup({launchInput,launch,slice}){
  validateFinaleNamedAttackTransition(launchInput,launch);
  const {route,teams,attackerTeamId,attackerRiderId}=launchInput;
  const grid=finaleDistanceGrid(route,{remainingKm:4});
  if(launch.roadGroups.length!==1||
    slice?.startDistanceM!==launch.endDistanceM||
    slice.sourceKm!==launch.sourceKm||
    !grid.some(row=>row.startDistanceM===slice.startDistanceM&&
      row.endDistanceM===slice.endDistanceM))
    throw new Error('The follow-up needs one adjacent same-kilometre launch group.');
  const segment=route.kilometres[slice.sourceKm-1];
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const energies=new Map(launch.riderEnergy.map(row=>
    [row.riderId,row.energyAfter]));
  const group=launch.roadGroups[0];
  const frontTeam=teams.find(team=>team.id===attackerTeamId);
  const frontOrder=orderAt(frontTeam.orders,slice.sourceKm-1);
  const frontEnergy=energies.get(attackerRiderId);
  const proposedFrontStep=frontOrder.breakWork==='sit_on'||
    frontEnergy<TUNING.breakaway.minPullEnergy?null:
    finaleWorkerStep({rider:ridersById.get(attackerRiderId),
      segment,order:frontOrder,energy:frontEnergy,role:'front',
      paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
  const frontStep=proposedFrontStep&&
    energyCostForFinaleSlice(slice,proposedFrontStep.workCostPerKm)<=
      frontEnergy+1e-9?proposedFrontStep:null;
  const frontSpeedKph=frontStep?.speedKph??finalePassiveFrontSpeed({
    riderIds:[attackerRiderId],ridersById,energies,segment});
  const candidates=[];
  for(const team of teams){
    if(team.id===attackerTeamId)continue;
    const order=orderAt(team.orders,slice.sourceKm-1);
    if(order.attack!=='none'||order.chase==='selective')
      throw new Error('Follow-up cannot suppress another attack or conditional chase.');
    if(order.chase!=='all')continue;
    for(const riderId of team.orders.helperIds){
      if(!launch.pelotonRiderIds.includes(riderId))continue;
      const energy=energies.get(riderId);
      if(energy<TUNING.chase.minHelperEnergy)continue;
      const step=finaleWorkerStep({rider:ridersById.get(riderId),
        segment,order,energy,role:'chase',
        paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
      if(energy+1e-9>=energyCostForFinaleSlice(slice,
        step.workCostPerKm))
        candidates.push({teamId:team.id,riderId,step});
    }
  }
  candidates.sort((a,b)=>b.step.speedKph-a.step.speedKph||
    a.teamId.localeCompare(b.teamId)||
    a.riderId.localeCompare(b.riderId));
  const chase=candidates[0]??null;
  const passiveBunchSpeed=finalePassiveBunchSpeed({
    riderIds:launch.pelotonRiderIds,ridersById,energies,segment});
  const bunchSpeedKph=Math.max(passiveBunchSpeed,
    chase?.step.speedKph??0);
  const allIds=[attackerRiderId,...launch.pelotonRiderIds];
  const plans=allIds.map(riderId=>({riderId,energy:energies.get(riderId),
    workCostPerKm:riderId===attackerRiderId?
      frontStep?.workCostPerKm??shelteredRate(
        ridersById.get(riderId),segment,energies.get(riderId)):
      riderId===chase?.riderId?chase.step.workCostPerKm:
        shelteredRate(ridersById.get(riderId),segment,
          energies.get(riderId))}));
  const first=advanceFinaleGroupStep({slice,frontGroup:group,
    pelotonRiderIds:launch.pelotonRiderIds,
    frontPull:{riderId:frontStep?attackerRiderId:null,
      speedKph:frontSpeedKph},
    chasePull:{riderId:chase?.riderId??null,
      speedKph:bunchSpeedKph},riderPlans:plans,
    passiveFront:!frontStep,passiveChase:!chase});
  let merged=null;
  if(first.event&&first.endDistanceM<slice.endDistanceM){
    const atCatch=new Map(first.riders.map(row=>[row.riderId,row.energy]));
    const mergedIds=[...first.pelotonRiderIds];
    const mergedSpeed=finalePassiveBunchSpeed({riderIds:mergedIds,
      ridersById,energies:atCatch,segment});
    merged=advanceFinaleMergedStep({slice,
      startDistanceM:first.endDistanceM,riderIds:mergedIds,
      pullRiderId:null,speedKph:mergedSpeed,passiveChase:true,
      riderPlans:mergedIds.map(riderId=>({riderId,
        energy:atCatch.get(riderId),workCostPerKm:shelteredRate(
          ridersById.get(riderId),segment,atCatch.get(riderId))}))});
  }
  const secondById=new Map(merged?.riders.map(row=>[row.riderId,row])??[]);
  const riderEnergy=first.riders.map(row=>({
    riderId:row.riderId,role:row.role,
    energyAtDecision:energies.get(row.riderId),
    energySpent:row.energySpent+
      (secondById.get(row.riderId)?.energySpent??0),
    energyAfter:secondById.get(row.riderId)?.energy??row.energy}));
  return {version:FINALE_NAMED_ATTACK_FOLLOWUP_VERSION,
    sourceTransitionVersion:launch.version,
    startDistanceM:slice.startDistanceM,endDistanceM:slice.endDistanceM,
    sourceKm:slice.sourceKm,
    frontRiderId:frontStep?attackerRiderId:null,
    chaseRiderId:chase?.riderId??null,
    frontSpeedKph,bunchSpeedKph,
    catchDistanceM:first.event?.atDistanceM??null,
    bunchElapsedSeconds:first.pelotonElapsedSeconds+
      (merged?.travelSeconds??0),
    roadGroups:first.roadGroups,
    pelotonRiderIds:first.pelotonRiderIds,
    riderEnergy};
}

export function validateFinaleNamedAttackFollowup(input,recorded){
  if(!isDeepStrictEqual(recorded,continueFinaleNamedAttackGroup(input)))
    throw new Error('The named attack follow-up does not replay.');
  return true;
}
