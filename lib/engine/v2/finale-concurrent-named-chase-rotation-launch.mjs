import {isDeepStrictEqual} from 'node:util';
import {recordFinaleLastKmFieldHandoffFromTour} from
  './finale-last-km-field-handoff.mjs';
import {recordFinaleLastKmNamedIntentsFromTour} from
  './finale-last-km-named-intents.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {advanceFinaleNamedAttackSlice} from './finale-named-attack-step.mjs';
import {finalePassiveBunchSpeed,finaleWorkerStep,
  FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {attackCandidate} from './tactics.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_NAMED_CHASE_ROTATION_VERSION=
  'v2-finale-concurrent-named-chase-rotation-launch-1';
export const FINALE_CONCURRENT_NAMED_SELECTIVE_ROTATION_VERSION=
  'v2-finale-concurrent-named-selective-rotation-launch-2';

// Record one ordered chase team and one independent front-rotation turn against
// all due named attackers. This only pays the first 250 m; road contact is open.
function recordConcurrentNamedChaseRotation(tour,{chaseRule,version}){
  const field=recordFinaleLastKmFieldHandoffFromTour(tour);
  const intents=recordFinaleLastKmNamedIntentsFromTour(tour);
  const teams=tour.committedInputs.teams;
  const km=tour.route.distanceKm;
  const attackingTeams=new Set(intents.named.map(row=>row.teamId));
  const chaseTeams=teams.filter(team=>
    !attackingTeams.has(team.id)&&
    orderAt(team.orders,km-1).chase===chaseRule);
  const rotatingTeams=teams.filter(team=>
    !attackingTeams.has(team.id)&&
    orderAt(team.orders,km-1).frontWork==='rotate');
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const energies=new Map(field.riders.map(row=>[row.riderId,row.energy]));
  if(field.roadGroups.length||field.droppedRiderIds.length||
    field.pelotonRiderIds.length!==field.riders.length||
    intents.named.length<2||intents.named.some(row=>
      !row.canEnterRoadContest)||
    intents.otherPendingActions.length||
    (chaseRule==='all'?intents.unresolvedSelectiveChaseTeamIds.length:
      intents.unresolvedSelectiveChaseTeamIds.length!==1)||
    chaseTeams.length!==1||rotatingTeams.length<1||
    rotatingTeams.some(team=>team.id===chaseTeams[0].id)||
    teams.some(team=>{
      const order=orderAt(team.orders,km-1);
      return attackingTeams.has(team.id)?
        order.chase!=='ignore'||order.frontWork!=='sit_in':
        order.attack!=='none'||
          !['ignore',chaseRule].includes(order.chase)||
          !['sit_in','rotate'].includes(order.frontWork);
    }))
    throw new Error('Concurrent chase-rotation launch needs eligible named attacks, one rival chase team and separate rotating rivals in one bunch.');
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[0];
  const segment=tour.route.kilometres[km-1];
  const attackerIds=new Set(intents.eligibleNamedRiderIds);
  const bunchIds=field.pelotonRiderIds.filter(id=>
    !attackerIds.has(id));
  const passiveBunchSpeedKph=finalePassiveBunchSpeed({
    riderIds:bunchIds,ridersById,energies,segment});
  const chaseTeam=chaseTeams[0];
  const chaseOrder=orderAt(chaseTeam.orders,km-1);
  const attackPressure=chaseRule==='selective'?intents.named.reduce((sum,row)=>{
    const team=teams.find(candidate=>candidate.id===row.teamId);
    const source={...team,
      energy:Object.fromEntries(team.riders.map(rider=>
        [rider.id,energies.get(rider.id)])),
      attackLoad:{[row.riderId]:row.loadAtDecision}};
    const candidate=attackCandidate(source,segment,new Set(),row.riderId);
    if(!candidate)throw new Error('An eligible named attack lacks pressure.');
    return sum+candidate.pressure;
  },0):null;
  const leadership=Number(chaseTeam.riders.find(rider=>
    rider.id===chaseTeam.orders.roadCaptainId)?.leadership??35);
  const awarenessThreshold=TUNING.chase.awarenessThreshold-
    leadership*TUNING.chase.leadershipAwareness;
  const chaseAware=chaseRule==='all'||attackPressure>=awarenessThreshold;
  const eligible=[];
  for(const riderId of chaseTeam.orders.helperIds){
    if(!bunchIds.includes(riderId))continue;
    const energy=energies.get(riderId);
    if(energy<TUNING.chase.minHelperEnergy)continue;
    const worker=finaleWorkerStep({
      rider:ridersById.get(riderId),segment,order:chaseOrder,energy,
      role:'chase',paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
    const energySpent=energyCostForFinaleSlice(slice,
      worker.workCostPerKm);
    if(energySpent<=energy+1e-9)
      eligible.push({teamId:chaseTeam.id,riderId,
        speedKph:worker.speedKph,
        energyAtDecision:energy,energySpent,
        energyAfter:Math.max(0,energy-energySpent)});
  }
  eligible.sort((a,b)=>b.speedKph-a.speedKph||
    a.riderId.localeCompare(b.riderId));
  const chase=chaseAware?eligible[0]??null:null;
  if(chaseAware&&!chase)
    throw new Error('Concurrent chase-rotation launch has no payable ordered helper.');
  const rotation=recordFinaleFrontRotationSlice({
    slice,route:tour.route,teams,pelotonRiderIds:bunchIds,
    energies,busyTeamIds:[...attackingTeams,chaseTeam.id]});
  const rotationWork=new Map(rotation.selected?.work.map(row=>
    [row.riderId,row])??[]);
  const bunchSpeedKph=Math.max(passiveBunchSpeedKph,
    chase?.speedKph??0,rotation.bunchSpeedKph);
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
    throw new Error('Concurrent attacks must share one paid chase-rotation pace.');
  const riderEnergy=field.riders.map(row=>{
    const attack=attackById.get(row.riderId);
    const worker=rotationWork.get(row.riderId);
    const chaser=row.riderId===chase?.riderId;
    if(Number(Boolean(attack))+Number(Boolean(worker))+Number(chaser)>1)
      throw new Error('Concurrent work roles must not overlap.');
    const role=attack?'attack':chaser?'chase':
      worker?'front_rotation':'sheltered';
    const energySpent=attack?.energySpent??
      (chaser?chase.energySpent:worker?.energySpent??
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
  return {version,
    sourceFieldVersion:field.version,
    sourceIntentsVersion:intents.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    startDistanceM:slice.startDistanceM,
    endDistanceM:slice.endDistanceM,
    passiveBunchSpeedKph,bunchSpeedKph,bunchElapsedSeconds,
    ...(chaseRule==='selective'?{selectiveDecision:{teamId:chaseTeam.id,
      attackPressure,awarenessThreshold,decision:chaseAware?'engage':'wait'}}:{}),
    chase,rotation,rotationDecision:rotation.selected?
      'paid':'no_eligible_pair',
    attacks,riderEnergy,
    roadOutcomeStatus:'unresolved',
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function recordFinaleConcurrentNamedChaseRotationFromTour(tour){
  return recordConcurrentNamedChaseRotation(tour,{
    chaseRule:'all',version:FINALE_CONCURRENT_NAMED_CHASE_ROTATION_VERSION});
}

export function recordFinaleConcurrentNamedSelectiveRotationFromTour(tour){
  return recordConcurrentNamedChaseRotation(tour,{
    chaseRule:'selective',version:FINALE_CONCURRENT_NAMED_SELECTIVE_ROTATION_VERSION});
}

export function validateFinaleConcurrentNamedChaseRotationFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentNamedChaseRotationFromTour(tour)))
    throw new Error('Concurrent named chase-rotation launch does not replay.');
  return true;
}

export function validateFinaleConcurrentNamedSelectiveRotationFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentNamedSelectiveRotationFromTour(tour)))
    throw new Error('Concurrent named selective-rotation launch does not replay.');
  return true;
}
