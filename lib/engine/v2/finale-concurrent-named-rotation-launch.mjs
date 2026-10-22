import {isDeepStrictEqual} from 'node:util';
import {recordFinaleLastKmFieldHandoffFromTour} from
  './finale-last-km-field-handoff.mjs';
import {recordFinaleLastKmNamedIntentsFromTour} from
  './finale-last-km-named-intents.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {advanceFinaleNamedAttackSlice} from './finale-named-attack-step.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_NAMED_ROTATION_LAUNCH_VERSION=
  'v2-finale-concurrent-named-rotation-launch-1';

// Two or more simultaneous named attacks against one paid, locked front
// rotation turn. No chase worker or road contact is inferred from this slice.
export function recordFinaleConcurrentNamedRotationLaunchFromTour(tour){
  const field=recordFinaleLastKmFieldHandoffFromTour(tour);
  const intents=recordFinaleLastKmNamedIntentsFromTour(tour);
  const teams=tour.committedInputs.teams;
  const km=tour.route.distanceKm;
  const attackingTeams=new Set(intents.named.map(row=>row.teamId));
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
      return order.chase!=='ignore'||
        (attackingTeams.has(team.id)?order.frontWork!=='sit_in':
          order.attack!=='none');
    }))
    throw new Error('Concurrent rotation launch needs one complete bunch, eligible named attacks and front-work-only rivals.');
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[0];
  const segment=tour.route.kilometres[km-1];
  const attackerIds=new Set(intents.eligibleNamedRiderIds);
  const bunchIds=field.pelotonRiderIds.filter(id=>
    !attackerIds.has(id));
  const rotation=recordFinaleFrontRotationSlice({
    slice,route:tour.route,teams,pelotonRiderIds:bunchIds,
    energies,busyTeamIds:[...attackingTeams]});
  if(!rotation.selected)
    throw new Error('Concurrent rotation launch needs a payable ordered turn.');
  const rotationWork=new Map(rotation.selected.work.map(row=>
    [row.riderId,row]));
  const bunchSpeedKph=rotation.bunchSpeedKph;
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
    throw new Error('Concurrent attacks must share one paid rotation pace.');
  const riderEnergy=field.riders.map(row=>{
    const attack=attackById.get(row.riderId);
    const worker=rotationWork.get(row.riderId);
    if(attack&&worker)
      throw new Error('A named attacker cannot also pay for front rotation.');
    const role=attack?'attack':worker?'front_rotation':'sheltered';
    const energySpent=attack?.energySpent??worker?.energySpent??
      energyCostForFinaleSlice(slice,TUNING.effortCost.conserve*
        riderKilometreEffect(ridersById.get(row.riderId),segment,{
          phase:'chase',energy:row.energy,
          exposed:segment.exposed}).energyCostMultiplier);
    if(energySpent>row.energy+1e-9)
      throw new Error(`A concurrent finale rider cannot pay for travel: ${
        row.riderId}.`);
    return {riderId:row.riderId,role,
      energyAtDecision:row.energy,energySpent,
      energyAfter:Math.max(0,row.energy-energySpent)};
  });
  return {version:FINALE_CONCURRENT_NAMED_ROTATION_LAUNCH_VERSION,
    sourceFieldVersion:field.version,
    sourceIntentsVersion:intents.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    startDistanceM:slice.startDistanceM,
    endDistanceM:slice.endDistanceM,
    rotation,bunchSpeedKph,bunchElapsedSeconds,
    attacks,riderEnergy,
    roadOutcomeStatus:'unresolved',
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentNamedRotationLaunchFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentNamedRotationLaunchFromTour(tour)))
    throw new Error('Concurrent named rotation launch does not replay.');
  return true;
}
