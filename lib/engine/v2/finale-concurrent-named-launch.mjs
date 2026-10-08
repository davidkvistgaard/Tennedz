import {isDeepStrictEqual} from 'node:util';
import {recordFinaleLastKmFieldHandoffFromTour} from
  './finale-last-km-field-handoff.mjs';
import {recordFinaleLastKmNamedIntentsFromTour} from
  './finale-last-km-named-intents.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleNamedAttackSlice} from './finale-named-attack-step.mjs';
import {finalePassiveBunchSpeed} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_NAMED_LAUNCH_VERSION=
  'v2-finale-concurrent-named-launch-1';

// A narrow paid 250 m projection for two or more independent named attacks
// against a passive bunch. Rival work and road-group formation are unresolved.
export function recordFinaleConcurrentNamedLaunchFromTour(tour){
  const field=recordFinaleLastKmFieldHandoffFromTour(tour);
  const intents=recordFinaleLastKmNamedIntentsFromTour(tour);
  const teams=tour.committedInputs.teams;
  const km=tour.route.distanceKm;
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const energies=new Map(field.riders.map(row=>[row.riderId,row.energy]));
  if(field.roadGroups.length||field.droppedRiderIds.length||
    field.pelotonRiderIds.length!==field.riders.length||
    intents.named.length<2||intents.named.some(row=>
      !row.canEnterRoadContest)||
    intents.otherPendingActions.length||
    intents.unresolvedSelectiveChaseTeamIds.length||
    teams.some(team=>{
      const order=orderAt(team.orders,km-1);
      return order.chase!=='ignore'||order.frontWork!=='sit_in'||
        !intents.named.some(row=>row.teamId===team.id)&&
        order.attack!=='none';
    }))
    throw new Error('Concurrent launch needs one complete passive bunch and only eligible named attacks.');
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[0];
  const segment=tour.route.kilometres[km-1];
  const attackerIds=new Set(intents.eligibleNamedRiderIds);
  const bunchIds=field.pelotonRiderIds.filter(id=>!attackerIds.has(id));
  const bunchSpeedKph=finalePassiveBunchSpeed({
    riderIds:bunchIds,ridersById,energies,segment});
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
    throw new Error('Concurrent attacks must share one recorded bunch pace.');
  const riderEnergy=field.riders.map(row=>{
    const attack=attackById.get(row.riderId);
    const energySpent=attack?.energySpent??energyCostForFinaleSlice(slice,
      TUNING.effortCost.conserve*riderKilometreEffect(
        ridersById.get(row.riderId),segment,{
          phase:'chase',energy:row.energy,
          exposed:segment.exposed}).energyCostMultiplier);
    if(energySpent>row.energy+1e-9)
      throw new Error(`A concurrent finale rider cannot pay for travel: ${
        row.riderId}.`);
    return {riderId:row.riderId,
      role:attack?'attack':'sheltered',
      energyAtDecision:row.energy,energySpent,
      energyAfter:Math.max(0,row.energy-energySpent)};
  });
  return {version:FINALE_CONCURRENT_NAMED_LAUNCH_VERSION,
    sourceFieldVersion:field.version,
    sourceIntentsVersion:intents.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    startDistanceM:slice.startDistanceM,
    endDistanceM:slice.endDistanceM,
    bunchSpeedKph,bunchElapsedSeconds,
    attacks,riderEnergy,
    roadOutcomeStatus:'unresolved',
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentNamedLaunchFromTour(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentNamedLaunchFromTour(tour)))
    throw new Error('The concurrent named launch does not replay.');
  return true;
}
