import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentNamedInactiveSelectiveRotationContactFromTour} from
  './finale-concurrent-named-chase-rotation-contact.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_INACTIVE_BUNCH_FOLLOWUP_VERSION=
  'v2-finale-concurrent-inactive-bunch-followup-1';

// With no due named attack and no road group, selective chasers have no
// target. Move the complete bunch through the adjacent 250 m slice, paying
// only the chosen front-rotation pair and sheltered travel for everyone else.
export function recordFinaleConcurrentInactiveBunchFollowupFromTour(tour){
  const contact=
    recordFinaleConcurrentNamedInactiveSelectiveRotationContactFromTour(tour);
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[1];
  const teams=tour.committedInputs.teams;
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const energies=new Map(contact.riderEnergy.map(row=>
    [row.riderId,row.energyAfter]));
  if(contact.roadGroups.length||
    slice.startDistanceM!==contact.endDistanceM||
    contact.pelotonRiderIds.length!==ridersById.size||
    new Set(contact.pelotonRiderIds).size!==ridersById.size||
    contact.chase!==null)
    throw new Error('An inactive named finale needs the adjacent complete bunch.');
  const rotation=recordFinaleFrontRotationSlice({
    slice,route:tour.route,teams,
    pelotonRiderIds:contact.pelotonRiderIds,energies});
  const work=new Map(rotation.selected?.work.map(row=>
    [row.riderId,row])??[]);
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const riderEnergy=contact.pelotonRiderIds.map(riderId=>{
    const energyAtDecision=energies.get(riderId);
    const worker=work.get(riderId);
    const energySpent=worker?.energySpent??energyCostForFinaleSlice(slice,
      TUNING.effortCost.conserve*riderKilometreEffect(
        ridersById.get(riderId),segment,{phase:'chase',
          energy:energyAtDecision,
          exposed:segment.exposed}).energyCostMultiplier);
    if(!Number.isFinite(energyAtDecision)||
      energySpent>energyAtDecision+1e-9)
      throw new Error(`An inactive finale rider cannot pay: ${riderId}.`);
    return {riderId,role:worker?'front_rotation':'sheltered',
      energyAtDecision,energySpent,
      energyAfter:Math.max(0,energyAtDecision-energySpent)};
  });
  return {version:FINALE_CONCURRENT_INACTIVE_BUNCH_FOLLOWUP_VERSION,
    sourceContactVersion:contact.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    startDistanceM:slice.startDistanceM,
    endDistanceM:slice.endDistanceM,
    bunchElapsedSeconds:slice.lengthM*3.6/rotation.bunchSpeedKph,
    rotation,
    nonlaunchingNamedDecisions:contact.nonlaunchingNamedDecisions,
    pelotonRiderIds:[...contact.pelotonRiderIds],roadGroups:[],
    riderEnergy,riderAttackLoad:contact.riderAttackLoad,
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentInactiveBunchFollowupFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentInactiveBunchFollowupFromTour(tour)))
    throw new Error('Concurrent inactive bunch follow-up does not replay.');
  return true;
}
