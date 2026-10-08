import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentNamedAllChaseContactFromTour} from
  './finale-concurrent-named-all-chase-contact.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleGroupStep} from './finale-group-step.mjs';
import {finalePassiveBunchSpeed,finalePassiveFrontSpeed,
  finaleWorkerStep,FINALE_WORKER_PASSIVE_SLOPE_VERSION} from
  './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_CHASED_FOLLOWUP_VERSION=
  'v2-finale-concurrent-chased-followup-1';

function shelteredRate(rider,segment,energy){
  return TUNING.effortCost.conserve*riderKilometreEffect(rider,
    segment,{phase:'chase',energy,exposed:segment.exposed})
    .energyCostMultiplier;
}

// One adjacent 250 m slice after one contained and one surviving named
// launch. A catch is paid to its measured contact point, then stops.
export function recordFinaleConcurrentChasedFollowupFromTour(tour){
  const contact=recordFinaleConcurrentNamedAllChaseContactFromTour(tour);
  if(contact.roadGroups.length!==1||
    contact.containedRiderIds.length<1)
    throw new Error('Concurrent chased follow-up needs one surviving and one contained attack.');
  const teams=tour.committedInputs.teams;
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[1];
  if(slice.startDistanceM!==contact.endDistanceM)
    throw new Error('Concurrent chased follow-up needs the adjacent slice.');
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const energies=new Map(contact.riderEnergy.map(row=>
    [row.riderId,row.energyAfter]));
  const group=contact.roadGroups[0];
  const frontRiderId=group.riderIds[0];
  const frontTeam=teams.find(team=>team.id===group.teamIds[0]);
  const frontOrder=orderAt(frontTeam.orders,slice.sourceKm-1);
  const frontEnergy=energies.get(frontRiderId);
  const proposedFront=frontOrder.breakWork==='sit_on'||
    frontEnergy<TUNING.breakaway.minPullEnergy?null:
    finaleWorkerStep({rider:ridersById.get(frontRiderId),
      segment,order:frontOrder,energy:frontEnergy,role:'front',
      paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
  const front=proposedFront&&energyCostForFinaleSlice(slice,
    proposedFront.workCostPerKm)<=frontEnergy+1e-9?
    proposedFront:null;
  const frontSpeedKph=front?.speedKph??finalePassiveFrontSpeed({
    riderIds:[frontRiderId],ridersById,energies,segment});
  const chaseTeam=teams.find(team=>team.id===contact.chase.teamId);
  const chaseOrder=orderAt(chaseTeam.orders,slice.sourceKm-1);
  if(chaseOrder.chase!=='all'||
    teams.some(team=>team.id!==chaseTeam.id&&
      team.id!==frontTeam.id&&
      orderAt(team.orders,slice.sourceKm-1).frontWork!=='sit_in'))
    throw new Error('Concurrent chased follow-up needs the same paid rival order.');
  const eligible=[];
  for(const riderId of chaseTeam.orders.helperIds){
    if(!contact.pelotonRiderIds.includes(riderId))continue;
    const energy=energies.get(riderId);
    if(energy<TUNING.chase.minHelperEnergy)continue;
    const step=finaleWorkerStep({rider:ridersById.get(riderId),
      segment,order:chaseOrder,energy,role:'chase',
      paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
    if(energyCostForFinaleSlice(slice,step.workCostPerKm)<=energy+1e-9)
      eligible.push({riderId,step});
  }
  eligible.sort((a,b)=>b.step.speedKph-a.step.speedKph||
    a.riderId.localeCompare(b.riderId));
  const chase=eligible[0]??null;
  const passiveBunchSpeedKph=finalePassiveBunchSpeed({
    riderIds:contact.pelotonRiderIds,
    ridersById,energies,segment});
  const bunchSpeedKph=Math.max(passiveBunchSpeedKph,
    chase?.step.speedKph??0);
  const allIds=[frontRiderId,...contact.pelotonRiderIds];
  const riderPlans=allIds.map(riderId=>({riderId,
    energy:energies.get(riderId),
    workCostPerKm:riderId===frontRiderId?
      front?.workCostPerKm??shelteredRate(
        ridersById.get(riderId),segment,energies.get(riderId)):
      riderId===chase?.riderId?chase.step.workCostPerKm:
        shelteredRate(ridersById.get(riderId),segment,
          energies.get(riderId))}));
  const movement=advanceFinaleGroupStep({slice,frontGroup:group,
    pelotonRiderIds:contact.pelotonRiderIds,
    frontPull:{riderId:front?frontRiderId:null,
      speedKph:frontSpeedKph},
    chasePull:{riderId:chase?.riderId??null,
      speedKph:bunchSpeedKph},
    riderPlans,passiveFront:!front,passiveChase:!chase});
  const riderEnergy=movement.riders.map(row=>({
    riderId:row.riderId,
    role:row.riderId===frontRiderId?
      front?'front':'sheltered':
      row.riderId===chase?.riderId?'chase':'sheltered',
    energyAtDecision:energies.get(row.riderId),
    energySpent:row.energySpent,energyAfter:row.energy}));
  return {version:FINALE_CONCURRENT_CHASED_FOLLOWUP_VERSION,
    sourceContactVersion:contact.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    startDistanceM:slice.startDistanceM,
    endDistanceM:movement.endDistanceM,
    plannedEndDistanceM:slice.endDistanceM,
    outcome:movement.event?'caught_uncontinued':'surviving_solo',
    catchDistanceM:movement.event?.atDistanceM??null,
    frontRiderId:front?frontRiderId:null,
    chaseRiderId:chase?.riderId??null,
    frontSpeedKph,passiveBunchSpeedKph,bunchSpeedKph,
    bunchElapsedSeconds:movement.pelotonElapsedSeconds,
    roadGroups:movement.roadGroups,
    pelotonRiderIds:movement.pelotonRiderIds,
    riderEnergy,riderAttackLoad:contact.riderAttackLoad,
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentChasedFollowupFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentChasedFollowupFromTour(tour)))
    throw new Error('Concurrent chased follow-up does not replay.');
  return true;
}
