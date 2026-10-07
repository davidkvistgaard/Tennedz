import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {finalePassiveBunchSpeed} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {validateFinaleNamedAttackTransition} from
  './finale-named-attack-transition.mjs';
import {continueFinaleNamedAttackGroup,continueFinaleNamedAttackChain,
  validateFinaleNamedAttackFollowup} from
  './finale-named-attack-followup.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_NAMED_ATTACK_BUNCH_STEP_VERSION=
  'v2-finale-named-attack-bunch-step-1';
export const FINALE_NAMED_ATTACK_BUNCH_CHAIN_VERSION=
  'v2-finale-named-attack-bunch-step-2';
export const FINALE_NAMED_ATTACK_LATE_CATCH_BUNCH_VERSION=
  'v2-finale-named-attack-bunch-step-3';

// One sheltered slice after a contained launch or a verified catch. There is
// no new kilometre decision, road group, chase worker or finishing sprint.
function advanceBunch({launchInput,source,slice,version}){
  const {route,teams}=launchInput;
  const grid=finaleDistanceGrid(route,{remainingKm:4});
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
  return {version,
    sourceFrameVersion:source.version,
    startDistanceM:slice.startDistanceM,endDistanceM:slice.endDistanceM,
    sourceKm:slice.sourceKm,
    bunchSpeedKph:speedKph,
    bunchElapsedSeconds:slice.lengthM*3.6/speedKph,
    pelotonRiderIds:[...riderIds],roadGroups:[],riderEnergy};
}

export function continueFinaleNamedAttackBunch({launchInput,launch,
  followup=null,slice}){
  validateFinaleNamedAttackTransition(launchInput,launch);
  const grid=finaleDistanceGrid(launchInput.route,{remainingKm:4});
  if(followup!==null){
    const previousSlice=grid.find(row=>
      row.startDistanceM===launch.endDistanceM);
    validateFinaleNamedAttackFollowup({launchInput,launch,
      slice:previousSlice},followup);
  }
  return advanceBunch({launchInput,source:followup??launch,slice,
    version:FINALE_NAMED_ATTACK_BUNCH_STEP_VERSION});
}

// Continue a caught/contained complete bunch across the remaining slices in
// the same kilometre. Each predecessor must replay before its energy is used.
export function continueFinaleNamedAttackBunchChain({launchInput,launch,
  followup=null,frames,slice}){
  validateFinaleNamedAttackTransition(launchInput,launch);
  const grid=finaleDistanceGrid(launchInput.route,{remainingKm:4});
  if(followup!==null){
    const previousSlice=grid.find(row=>
      row.startDistanceM===launch.endDistanceM);
    validateFinaleNamedAttackFollowup({launchInput,launch,
      slice:previousSlice},followup);
  }
  if(!Array.isArray(frames)||frames.length<1)
    throw new Error('A named attack bunch chain needs prior frames.');
  let source=followup??launch;
  for(const [index,recorded] of frames.entries()){
    const next=grid.find(row=>row.startDistanceM===source.endDistanceM);
    const expected=advanceBunch({launchInput,source,slice:next,
      version:index===0?FINALE_NAMED_ATTACK_BUNCH_STEP_VERSION:
        FINALE_NAMED_ATTACK_BUNCH_CHAIN_VERSION});
    if(!isDeepStrictEqual(recorded,expected))
      throw new Error('A prior named attack bunch frame does not replay.');
    source=recorded;
  }
  return advanceBunch({launchInput,source,slice,
    version:FINALE_NAMED_ATTACK_BUNCH_CHAIN_VERSION});
}

// A split may survive one or more slices before contact. Replay the entire
// solo history, including the catch frame, before spending the merged field's
// energy on any subsequent sheltered travel.
export function continueFinaleNamedAttackLateCatchBunch({launchInput,launch,
  followups,frames=[],slice}){
  validateFinaleNamedAttackTransition(launchInput,launch);
  if(!Array.isArray(followups)||followups.length<2||
    !Array.isArray(frames))
    throw new Error('A late catch needs a recorded solo history.');
  const grid=finaleDistanceGrid(launchInput.route,{remainingKm:4});
  let source=launch;
  for(const [index,recorded] of followups.entries()){
    const next=grid.find(row=>row.startDistanceM===source.endDistanceM);
    const expected=index===0?continueFinaleNamedAttackGroup({
      launchInput,launch,slice:next}):continueFinaleNamedAttackChain({
        launchInput,launch,followups:followups.slice(0,index),slice:next});
    if(!isDeepStrictEqual(recorded,expected))
      throw new Error('A prior named attack follow-up does not replay.');
    if(index<followups.length-1&&recorded.roadGroups.length!==1)
      throw new Error('A late catch needs an unbroken solo history.');
    source=recorded;
  }
  if(source.roadGroups.length!==0||!source.catchDistanceM)
    throw new Error('The named attack has not been caught.');
  for(const recorded of frames){
    const next=grid.find(row=>row.startDistanceM===source.endDistanceM);
    const expected=advanceBunch({launchInput,source,slice:next,
      version:FINALE_NAMED_ATTACK_LATE_CATCH_BUNCH_VERSION});
    if(!isDeepStrictEqual(recorded,expected))
      throw new Error('A prior late-catch bunch frame does not replay.');
    source=recorded;
  }
  return advanceBunch({launchInput,source,slice,
    version:FINALE_NAMED_ATTACK_LATE_CATCH_BUNCH_VERSION});
}

export function validateFinaleNamedAttackBunchStep(input,recorded){
  if(!isDeepStrictEqual(recorded,continueFinaleNamedAttackBunch(input)))
    throw new Error('The named attack bunch step does not replay.');
  return true;
}

export function validateFinaleNamedAttackBunchChain(input,recorded){
  if(!isDeepStrictEqual(recorded,
    continueFinaleNamedAttackBunchChain(input)))
    throw new Error('The named attack bunch chain does not replay.');
  return true;
}
