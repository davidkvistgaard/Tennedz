import {isDeepStrictEqual} from 'node:util';
import {recordFinaleLastKmFieldHandoffFromTour} from
  './finale-last-km-field-handoff.mjs';
import {recordFinaleLastKmNamedIntentsFromTour} from
  './finale-last-km-named-intents.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleNamedAttackSlice} from './finale-named-attack-step.mjs';
import {finalePassiveBunchSpeed,finaleWorkerStep,
  FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_NAMED_ALL_CHASE_VERSION=
  'v2-finale-concurrent-named-all-chase-launch-1';

// A separate, replayable first slice for two or more named attacks with an
// ordered all-out rival chase. Selective chase and later contact remain open.
export function recordFinaleConcurrentNamedAllChaseFromTour(tour){
  const field=recordFinaleLastKmFieldHandoffFromTour(tour);
  const intents=recordFinaleLastKmNamedIntentsFromTour(tour);
  const teams=tour.committedInputs.teams;
  const km=tour.route.distanceKm;
  const attackingTeams=new Set(intents.named.map(row=>row.teamId));
  const orderedChaseTeams=teams.filter(team=>
    !attackingTeams.has(team.id)&&
    orderAt(team.orders,km-1).chase==='all');
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const energies=new Map(field.riders.map(row=>[row.riderId,row.energy]));
  if(field.roadGroups.length||field.droppedRiderIds.length||
    field.pelotonRiderIds.length!==field.riders.length||
    intents.named.length<2||intents.named.some(row=>
      !row.canEnterRoadContest)||
    orderedChaseTeams.length!==1||
    intents.otherPendingActions.length||
    intents.unresolvedSelectiveChaseTeamIds.length||
    teams.some(team=>{
      const order=orderAt(team.orders,km-1);
      if(order.frontWork!=='sit_in')return true;
      return attackingTeams.has(team.id)?order.chase!=='ignore':
        order.attack!=='none'||!['ignore','all'].includes(order.chase);
    }))
    throw new Error('Concurrent all-chase launch needs one complete bunch and only named attacks plus rival all-chase.');
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[0];
  const segment=tour.route.kilometres[km-1];
  const attackerIds=new Set(intents.eligibleNamedRiderIds);
  const bunchIds=field.pelotonRiderIds.filter(id=>
    !attackerIds.has(id));
  const passiveBunchSpeedKph=finalePassiveBunchSpeed({
    riderIds:bunchIds,ridersById,energies,segment});
  const eligible=[];
  for(const team of teams){
    if(attackingTeams.has(team.id))continue;
    const order=orderAt(team.orders,km-1);
    if(order.chase!=='all')continue;
    for(const riderId of team.orders.helperIds){
      if(!bunchIds.includes(riderId))continue;
      const energy=energies.get(riderId);
      if(energy<TUNING.chase.minHelperEnergy)continue;
      const worker=finaleWorkerStep({
        rider:ridersById.get(riderId),segment,order,energy,
        role:'chase',paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
      const energySpent=energyCostForFinaleSlice(slice,
        worker.workCostPerKm);
      if(energySpent<=energy+1e-9)
        eligible.push({teamId:team.id,riderId,
          speedKph:worker.speedKph,
          energyAtDecision:energy,energySpent,
          energyAfter:Math.max(0,energy-energySpent)});
    }
  }
  eligible.sort((a,b)=>b.speedKph-a.speedKph||
    a.teamId.localeCompare(b.teamId)||
    a.riderId.localeCompare(b.riderId));
  const chase=eligible[0]??null;
  if(!chase)
    throw new Error('Concurrent all-chase launch has no payable ordered helper.');
  const bunchSpeedKph=Math.max(passiveBunchSpeedKph,chase.speedKph);
  const attacks=intents.named.map(row=>{
    const team=teams.find(candidate=>candidate.id===row.teamId);
    return advanceFinaleNamedAttackSlice({slice,route:tour.route,
      team,riderId:row.riderId,energy:row.sourceEnergy,
      repeatLoad:row.loadAtDecision,bunchSpeedKph});
  });
  const attackById=new Map(attacks.map(row=>[row.riderId,row]));
  const bunchElapsedSeconds=slice.lengthM*3.6/bunchSpeedKph;
  if(attacks.some(row=>Math.abs(row.bunchSeconds-
    bunchElapsedSeconds)>1e-9))
    throw new Error('Concurrent attacks must share one paid chase pace.');
  const riderEnergy=field.riders.map(row=>{
    const attack=attackById.get(row.riderId);
    const role=attack?'attack':row.riderId===chase.riderId?
      'chase':'sheltered';
    const energySpent=attack?.energySpent??
      (role==='chase'?chase.energySpent:
        energyCostForFinaleSlice(slice,TUNING.effortCost.conserve*
          riderKilometreEffect(ridersById.get(row.riderId),segment,{
            phase:'chase',energy:row.energy,
            exposed:segment.exposed}).energyCostMultiplier));
    if(energySpent>row.energy+1e-9)
      throw new Error(`A concurrent finale rider cannot pay for travel: ${
        row.riderId}.`);
    return {riderId:row.riderId,role,
      energyAtDecision:row.energy,energySpent,
      energyAfter:Math.max(0,row.energy-energySpent)};
  });
  return {version:FINALE_CONCURRENT_NAMED_ALL_CHASE_VERSION,
    sourceFieldVersion:field.version,
    sourceIntentsVersion:intents.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    startDistanceM:slice.startDistanceM,
    endDistanceM:slice.endDistanceM,
    passiveBunchSpeedKph,bunchSpeedKph,bunchElapsedSeconds,
    chase,attacks,riderEnergy,
    roadOutcomeStatus:'unresolved',
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentNamedAllChaseFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentNamedAllChaseFromTour(tour)))
    throw new Error('Concurrent named all-chase launch does not replay.');
  return true;
}
