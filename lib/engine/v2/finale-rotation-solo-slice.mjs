import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleGroupStep} from './finale-group-step.mjs';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {probeLastKmRotationSoloFromTour} from
  './finale-last-km-rotation-solo.mjs';
import {finalePassiveBunchSpeed,finalePassiveFrontSpeed,
  finaleWorkerStep,FINALE_WORKER_PASSIVE_SLOPE_VERSION} from
  './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_ROTATION_SOLO_SLICE_VERSION=
  'v2-finale-rotation-solo-slice-1';

// One source-linked 100 m solo-versus-bunch step. A calculated catch is
// refused until its precise remaining-slice work and road merge are recorded.
export function recordFinaleRotationSoloSliceFromTour(tour,{attackTeamId}){
  const road=probeLastKmRotationSoloFromTour(tour,{teamId:attackTeamId});
  const route=tour.route,teams=tour.committedInputs.teams;
  const slice=finaleDistanceGrid(route,{remainingKm:1}).find(row=>
    row.startDistanceM===road.at500M.distanceM);
  if(!slice||slice.lengthM!==100)
    throw new Error('The solo continuation needs the first 100 m slice.');
  const segment=route.kilometres[slice.sourceKm-1];
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const energies=new Map(road.at500M.riderEnergy.map(row=>
    [row.riderId,row.energy]));
  const frontGroup=road.at500M.roadGroups[0];
  const frontId=road.riderId;
  const frontOrder=orderAt(teams.find(team=>team.id===attackTeamId)
    .orders,slice.sourceKm-1);
  const frontEnergy=energies.get(frontId);
  const proposedFront=frontOrder.breakWork==='sit_on'||
    frontEnergy<TUNING.breakaway.minPullEnergy?null:
    finaleWorkerStep({rider:ridersById.get(frontId),segment,
      order:frontOrder,energy:frontEnergy,role:'front',
      paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
  const front=proposedFront&&energyCostForFinaleSlice(slice,
    proposedFront.workCostPerKm)<=frontEnergy+1e-9?
    proposedFront:null;
  const frontSpeedKph=front?.speedKph??finalePassiveFrontSpeed({
    riderIds:[frontId],ridersById,energies,segment});
  const chasers=[];
  for(const team of teams){
    if(team.id===attackTeamId)continue;
    const order=orderAt(team.orders,slice.sourceKm-1);
    if(order.attack!=='none'||order.chase==='selective')
      throw new Error('Solo continuation needs other attacks and conditional chase recorded.');
    if(order.chase!=='all')continue;
    for(const riderId of team.orders.helperIds){
      if(!road.at500M.pelotonRiderIds.includes(riderId))continue;
      const energy=energies.get(riderId);
      if(energy<TUNING.chase.minHelperEnergy)continue;
      const step=finaleWorkerStep({rider:ridersById.get(riderId),
        segment,order,energy,role:'chase',
        paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
      if(energyCostForFinaleSlice(slice,step.workCostPerKm)<=energy+1e-9)
        chasers.push({teamId:team.id,riderId,step});
    }
  }
  chasers.sort((a,b)=>b.step.speedKph-a.step.speedKph||
    a.teamId.localeCompare(b.teamId)||
    a.riderId.localeCompare(b.riderId));
  const chase=chasers[0]??null;
  const rotation=recordFinaleFrontRotationSlice({slice,route,teams,
    pelotonRiderIds:road.at500M.pelotonRiderIds,energies,
    busyTeamIds:[attackTeamId,...(chase?[chase.teamId]:[])]});
  const workers=new Map(rotation.selected?.work.map(row=>
    [row.riderId,row])??[]);
  if(workers.has(frontId)||workers.has(chase?.riderId))
    throw new Error('A solo worker cannot pay for two roles.');
  const passiveSpeedKph=finalePassiveBunchSpeed({
    riderIds:road.at500M.pelotonRiderIds,ridersById,energies,segment});
  const bunchSpeedKph=Math.max(passiveSpeedKph,
    chase?.step.speedKph??0,rotation.bunchSpeedKph);
  const paceRiderId=rotation.selected&&
    rotation.selected.speedKph>=bunchSpeedKph?
    rotation.selected.riderIds[0]:chase&&
      chase.step.speedKph>=bunchSpeedKph?chase.riderId:null;
  const paceSource=paceRiderId===null?'passive_bunch':
    rotation.selected?.riderIds.includes(paceRiderId)?
      'front_rotation':'chase';
  const allIds=[frontId,...road.at500M.pelotonRiderIds];
  const shelteredRate=riderId=>TUNING.effortCost.conserve*
    riderKilometreEffect(ridersById.get(riderId),segment,{
      phase:'chase',energy:energies.get(riderId),
      exposed:segment.exposed}).energyCostMultiplier;
  const riderPlans=allIds.map(riderId=>({riderId,
    energy:energies.get(riderId),
    workCostPerKm:riderId===frontId?
      front?.workCostPerKm??shelteredRate(riderId):
      riderId===chase?.riderId?chase.step.workCostPerKm:
      workers.has(riderId)?workers.get(riderId).energySpent*
        1000/slice.lengthM:shelteredRate(riderId)}));
  const movement=advanceFinaleGroupStep({slice,frontGroup,
    pelotonRiderIds:road.at500M.pelotonRiderIds,
    frontPull:{riderId:front?frontId:null,speedKph:frontSpeedKph},
    chasePull:{riderId:paceRiderId,speedKph:bunchSpeedKph},
    riderPlans,passiveFront:!front,passiveChase:paceRiderId===null});
  if(movement.event)
    throw new Error('The solo slice needs an exact catch continuation.');
  const riderEnergy=movement.riders.map(row=>({
    riderId:row.riderId,
    role:row.riderId===frontId?front?'front':'sheltered':
      row.riderId===chase?.riderId?'chase':
        workers.has(row.riderId)?'front_rotation':'sheltered',
    energyAtDecision:energies.get(row.riderId),
    energySpent:row.energySpent,energyAfter:row.energy}));
  return {version:FINALE_ROTATION_SOLO_SLICE_VERSION,
    sourceRoadTraceVersion:road.version,
    startDistanceM:slice.startDistanceM,
    endDistanceM:movement.endDistanceM,sourceKm:slice.sourceKm,
    frontRiderId:front?frontId:null,
    chaseRiderId:chase?.riderId??null,rotation,paceSource,
    frontSpeedKph,bunchSpeedKph,
    frontTravelSeconds:movement.frontElapsedSeconds,
    bunchTravelSeconds:movement.pelotonElapsedSeconds,
    roadGroups:movement.roadGroups,
    pelotonRiderIds:movement.pelotonRiderIds,riderEnergy};
}

export function validateFinaleRotationSoloSliceFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationSoloSliceFromTour(tour,input)))
    throw new Error('The solo rotation slice does not replay.');
  return true;
}
