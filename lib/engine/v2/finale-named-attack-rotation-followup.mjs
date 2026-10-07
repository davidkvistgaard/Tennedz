import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleGroupStep,advanceFinaleMergedStep} from
  './finale-group-step.mjs';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {finalePassiveBunchSpeed,finalePassiveFrontSpeed,
  finaleWorkerStep,FINALE_WORKER_PASSIVE_SLOPE_VERSION} from
  './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {validateFinaleNamedAttackRotationTransition} from
  './finale-named-attack-rotation-transition.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_NAMED_ATTACK_ROTATION_FOLLOWUP_VERSION=
  'v2-finale-named-attack-rotation-followup-1';
export const FINALE_NAMED_ATTACK_ROTATION_CATCH_VERSION=
  'v2-finale-named-attack-rotation-followup-2';

function shelteredRate(rider,segment,energy){
  return TUNING.effortCost.conserve*riderKilometreEffect(rider,
    segment,{phase:'chase',energy,exposed:segment.exposed})
    .energyCostMultiplier;
}

// Continue a verified rotating launch through one adjacent solo slice. A
// calculated catch fails closed until rotation after contact is specified.
function advanceRotationFollowup({launchInput,launch,slice,allowCatch}){
  validateFinaleNamedAttackRotationTransition(launchInput,launch);
  const {route,teams,attackerTeamId,attackerRiderId}=launchInput;
  const grid=finaleDistanceGrid(route,{remainingKm:1});
  if(launch.roadGroups.length!==1||
    !isDeepStrictEqual(slice,grid[1])||
    slice.startDistanceM!==launch.endDistanceM)
    throw new Error('Rotating follow-up needs the adjacent solo slice.');
  const segment=route.kilometres[slice.sourceKm-1];
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const energies=new Map(launch.riderEnergy.map(row=>
    [row.riderId,row.energyAfter]));
  const group=launch.roadGroups[0];
  const attacker=teams.find(team=>team.id===attackerTeamId);
  const frontOrder=orderAt(attacker.orders,slice.sourceKm-1);
  const frontEnergy=energies.get(attackerRiderId);
  const proposedFront=frontOrder.breakWork==='sit_on'||
    frontEnergy<TUNING.breakaway.minPullEnergy?null:
    finaleWorkerStep({rider:ridersById.get(attackerRiderId),
      segment,order:frontOrder,energy:frontEnergy,role:'front',
      paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
  const front=proposedFront&&energyCostForFinaleSlice(slice,
    proposedFront.workCostPerKm)<=frontEnergy+1e-9?
    proposedFront:null;
  const frontSpeedKph=front?.speedKph??finalePassiveFrontSpeed({
    riderIds:[attackerRiderId],ridersById,energies,segment});
  const chasers=[];
  for(const team of teams){
    if(team.id===attackerTeamId)continue;
    const order=orderAt(team.orders,slice.sourceKm-1);
    if(order.attack!=='none'||order.chase==='selective')
      throw new Error('Rotating follow-up needs other attacks and conditional chase recorded.');
    if(order.chase!=='all')continue;
    for(const riderId of team.orders.helperIds){
      if(!launch.pelotonRiderIds.includes(riderId))continue;
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
    pelotonRiderIds:launch.pelotonRiderIds,energies,
    busyTeamIds:[attackerTeamId,...(chase?[chase.teamId]:[])]});
  const rotationWork=new Map(rotation.selected?.work.map(row=>
    [row.riderId,row])??[]);
  if(rotationWork.has(chase?.riderId))
    throw new Error('A chaser cannot also pay for front rotation.');
  const passiveSpeedKph=finalePassiveBunchSpeed({
    riderIds:launch.pelotonRiderIds,ridersById,energies,segment});
  const bunchSpeedKph=Math.max(passiveSpeedKph,
    chase?.step.speedKph??0,rotation.bunchSpeedKph);
  const paceRiderId=rotation.selected&&
    rotation.selected.speedKph>=bunchSpeedKph?
    rotation.selected.riderIds[0]:chase?.riderId??null;
  const allIds=[attackerRiderId,...launch.pelotonRiderIds];
  const riderPlans=allIds.map(riderId=>({riderId,
    energy:energies.get(riderId),
    workCostPerKm:riderId===attackerRiderId?
      front?.workCostPerKm??shelteredRate(ridersById.get(riderId),
        segment,energies.get(riderId)):
      riderId===chase?.riderId?chase.step.workCostPerKm:
      rotationWork.has(riderId)?rotationWork.get(riderId).energySpent*
        1000/slice.lengthM:shelteredRate(ridersById.get(riderId),
        segment,energies.get(riderId))}));
  const movement=advanceFinaleGroupStep({slice,frontGroup:group,
    pelotonRiderIds:launch.pelotonRiderIds,
    frontPull:{riderId:front?attackerRiderId:null,
      speedKph:frontSpeedKph},
    chasePull:{riderId:paceRiderId,speedKph:bunchSpeedKph},
    riderPlans,passiveFront:!front,passiveChase:paceRiderId===null});
  if(movement.event&&!allowCatch)
    throw new Error('A rotating catch needs a merged-work continuation rule.');
  if(!movement.event&&allowCatch)
    throw new Error('The rotating catch variant needs actual road contact.');
  if(movement.event){
    if(movement.endDistanceM>=slice.endDistanceM)
      throw new Error('A line catch needs a separate finish contact rule.');
    const atCatch=new Map(movement.riders.map(row=>
      [row.riderId,row.energy]));
    const mergedIds=movement.pelotonRiderIds;
    const postCatchRotation=recordFinaleFrontRotationSlice({
      slice,route,teams,pelotonRiderIds:mergedIds,energies:atCatch,
      busyTeamIds:[attackerTeamId,...(chase?[chase.teamId]:[])]});
    const postWork=new Map(postCatchRotation.selected?.work.map(row=>
      [row.riderId,row])??[]);
    const mergedSpeedKph=Math.max(finalePassiveBunchSpeed({
      riderIds:mergedIds,ridersById,energies:atCatch,segment}),
    postCatchRotation.bunchSpeedKph);
    const postPullId=postCatchRotation.selected&&
      postCatchRotation.selected.speedKph>=mergedSpeedKph?
      postCatchRotation.selected.riderIds[0]:null;
    const merged=advanceFinaleMergedStep({slice,
      startDistanceM:movement.endDistanceM,riderIds:mergedIds,
      pullRiderId:postPullId,speedKph:mergedSpeedKph,
      passiveChase:postPullId===null,
      riderPlans:mergedIds.map(riderId=>({riderId,
        energy:atCatch.get(riderId),
        workCostPerKm:postWork.has(riderId)?
          postWork.get(riderId).energySpent*1000/slice.lengthM:
          shelteredRate(ridersById.get(riderId),segment,
            atCatch.get(riderId))}))});
    const secondById=new Map(merged.riders.map(row=>[row.riderId,row]));
    const riderEnergy=movement.riders.map(row=>{
      const after=secondById.get(row.riderId);
      return {riderId:row.riderId,
        role:row.riderId===attackerRiderId?
          front?'front':'sheltered':
          row.riderId===chase?.riderId?'chase':
            rotationWork.has(row.riderId)?'front_rotation':'sheltered',
        energyAtDecision:energies.get(row.riderId),
        energySpent:row.energySpent+after.energySpent,
        energyAtCatch:row.energy,
        postCatchRole:postWork.has(row.riderId)?
          'front_rotation':'sheltered',
        postCatchEnergySpent:after.energySpent,
        energyAfter:after.energy};
    });
    return {version:FINALE_NAMED_ATTACK_ROTATION_CATCH_VERSION,
      sourceTransitionVersion:launch.version,
      startDistanceM:slice.startDistanceM,
      endDistanceM:slice.endDistanceM,sourceKm:slice.sourceKm,
      frontRiderId:front?attackerRiderId:null,
      chaseRiderId:chase?.riderId??null,
      beforeCatchRotationPlan:rotation,
      frontSpeedKph,bunchSpeedKph,
      catchDistanceM:movement.endDistanceM,
      afterCatchRotationPlan:postCatchRotation,mergedSpeedKph,
      bunchElapsedSeconds:movement.pelotonElapsedSeconds+
        merged.travelSeconds,
      roadGroups:[],pelotonRiderIds:mergedIds,riderEnergy};
  }
  const riderEnergy=movement.riders.map(row=>({riderId:row.riderId,
    role:row.riderId===attackerRiderId?front?'front':'sheltered':
      row.riderId===chase?.riderId?'chase':
        rotationWork.has(row.riderId)?'front_rotation':'sheltered',
    energyAtDecision:energies.get(row.riderId),
    energySpent:row.energySpent,energyAfter:row.energy}));
  return {version:FINALE_NAMED_ATTACK_ROTATION_FOLLOWUP_VERSION,
    sourceTransitionVersion:launch.version,
    startDistanceM:slice.startDistanceM,endDistanceM:slice.endDistanceM,
    sourceKm:slice.sourceKm,frontRiderId:front?attackerRiderId:null,
    chaseRiderId:chase?.riderId??null,rotation,
    frontSpeedKph,bunchSpeedKph,
    bunchElapsedSeconds:movement.pelotonElapsedSeconds,
    roadGroups:movement.roadGroups,
    pelotonRiderIds:movement.pelotonRiderIds,riderEnergy};
}

export function continueFinaleNamedAttackRotationGroup(input){
  return advanceRotationFollowup({...input,allowCatch:false});
}

export function continueFinaleNamedAttackRotationCatch(input){
  return advanceRotationFollowup({...input,allowCatch:true});
}

export function validateFinaleNamedAttackRotationFollowup(input,recorded){
  if(!isDeepStrictEqual(recorded,
    continueFinaleNamedAttackRotationGroup(input)))
    throw new Error('The rotating named attack follow-up does not replay.');
  return true;
}

export function validateFinaleNamedAttackRotationCatch(input,recorded){
  if(!isDeepStrictEqual(recorded,
    continueFinaleNamedAttackRotationCatch(input)))
    throw new Error('The rotating named attack catch does not replay.');
  return true;
}
