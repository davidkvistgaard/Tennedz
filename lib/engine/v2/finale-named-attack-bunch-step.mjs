import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {finalePassiveBunchSpeed} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {validateFinaleNamedAttackTransition} from
  './finale-named-attack-transition.mjs';
import {validateFinaleNamedAttackFollowup} from
  './finale-named-attack-followup.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_NAMED_ATTACK_BUNCH_STEP_VERSION=
  'v2-finale-named-attack-bunch-step-1';

// One sheltered slice after a contained launch or a verified catch. There is
// no new kilometre decision, road group, chase worker or finishing sprint.
export function continueFinaleNamedAttackBunch({launchInput,launch,
  followup=null,slice}){
  validateFinaleNamedAttackTransition(launchInput,launch);
  const {route,teams}=launchInput;
  const grid=finaleDistanceGrid(route,{remainingKm:4});
  if(followup!==null){
    const previousSlice=grid.find(row=>
      row.startDistanceM===launch.endDistanceM);
    validateFinaleNamedAttackFollowup({launchInput,launch,
      slice:previousSlice},followup);
  }
  const source=followup??launch;
  if(source.roadGroups.length!==0||
    slice?.startDistanceM!==source.endDistanceM||
    slice.sourceKm!==source.sourceKm||
    !grid.some(row=>row.startDistanceM===slice.startDistanceM&&
      row.endDistanceM===slice.endDistanceM))
    throw new Error('The passive bunch needs an adjacent same-kilometre caught state.');
  if(teams.some(team=>orderAt(team.orders,slice.sourceKm-1)
    .frontWork==='rotate'))
    throw new Error('A planned bunch rotation needs recorded work.');
  const segment=route.kilometres[slice.sourceKm-1];
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const energies=new Map(source.riderEnergy.map(row=>
    [row.riderId,row.energyAfter]));
  const riderIds=source.pelotonRiderIds;
  if(riderIds.length!==ridersById.size||
    new Set(riderIds).size!==riderIds.length)
    throw new Error('The passive bunch needs the entire present field.');
  const speedKph=finalePassiveBunchSpeed({riderIds,ridersById,
    energies,segment});
  const riderEnergy=riderIds.map(riderId=>{
    const energyAtDecision=energies.get(riderId);
    const workCostPerKm=TUNING.effortCost.conserve*
      riderKilometreEffect(ridersById.get(riderId),segment,{
        phase:'chase',energy:energyAtDecision,
        exposed:segment.exposed}).energyCostMultiplier;
    const energySpent=energyCostForFinaleSlice(slice,workCostPerKm);
    if(energySpent>energyAtDecision+1e-9)
      throw new Error(`A sheltered rider cannot pay for travel: ${riderId}.`);
    return {riderId,role:'sheltered',energyAtDecision,energySpent,
      energyAfter:Math.max(0,energyAtDecision-energySpent)};
  });
  return {version:FINALE_NAMED_ATTACK_BUNCH_STEP_VERSION,
    sourceFrameVersion:source.version,
    startDistanceM:slice.startDistanceM,endDistanceM:slice.endDistanceM,
    sourceKm:slice.sourceKm,
    bunchSpeedKph:speedKph,
    bunchElapsedSeconds:slice.lengthM*3.6/speedKph,
    pelotonRiderIds:[...riderIds],roadGroups:[],riderEnergy};
}

export function validateFinaleNamedAttackBunchStep(input,recorded){
  if(!isDeepStrictEqual(recorded,continueFinaleNamedAttackBunch(input)))
    throw new Error('The named attack bunch step does not replay.');
  return true;
}
