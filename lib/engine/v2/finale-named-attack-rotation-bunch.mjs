import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {validateFinaleNamedAttackRotationTransition} from
  './finale-named-attack-rotation-transition.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_NAMED_ATTACK_ROTATION_BUNCH_VERSION=
  'v2-finale-named-attack-rotation-bunch-1';

// A failed launch remains in one bunch. Chase has no separated target in the
// next slice; independent front rotation may still set paid bunch pace.
export function continueFinaleNamedAttackRotationBunch({
  launchInput,launch,slice}){
  validateFinaleNamedAttackRotationTransition(launchInput,launch);
  const {route,teams,attackerTeamId}=launchInput;
  const grid=finaleDistanceGrid(route,{remainingKm:1});
  if(launch.roadGroups.length||
    !isDeepStrictEqual(slice,grid[1])||
    slice.startDistanceM!==launch.endDistanceM||
    launch.pelotonRiderIds.length!==launchInput.pelotonRiderIds.length||
    teams.some(team=>team.id!==attackerTeamId&&
      orderAt(team.orders,slice.sourceKm-1).attack!=='none'))
    throw new Error('A contained rotating attack needs one adjacent bunch slice.');
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const energies=new Map(launch.riderEnergy.map(row=>
    [row.riderId,row.energyAfter]));
  const ids=launch.pelotonRiderIds;
  if(ids.length!==ridersById.size||new Set(ids).size!==ids.length)
    throw new Error('A contained rotating attack needs the complete bunch.');
  const rotation=recordFinaleFrontRotationSlice({slice,route,teams,
    pelotonRiderIds:ids,energies,busyTeamIds:[attackerTeamId]});
  const work=new Map(rotation.selected?.work.map(row=>
    [row.riderId,row])??[]);
  const segment=route.kilometres[slice.sourceKm-1];
  const riderEnergy=ids.map(riderId=>{
    const energyAtDecision=energies.get(riderId);
    const worker=work.get(riderId);
    const energySpent=worker?.energySpent??energyCostForFinaleSlice(slice,
      TUNING.effortCost.conserve*riderKilometreEffect(
        ridersById.get(riderId),segment,{phase:'chase',
          energy:energyAtDecision,
          exposed:segment.exposed}).energyCostMultiplier);
    if(!Number.isFinite(energyAtDecision)||
      energySpent>energyAtDecision+1e-9)
      throw new Error(`A rotating bunch rider cannot pay: ${riderId}.`);
    return {riderId,role:worker?'front_rotation':'sheltered',
      energyAtDecision,energySpent,
      energyAfter:Math.max(0,energyAtDecision-energySpent)};
  });
  return {version:FINALE_NAMED_ATTACK_ROTATION_BUNCH_VERSION,
    sourceTransitionVersion:launch.version,
    startDistanceM:slice.startDistanceM,endDistanceM:slice.endDistanceM,
    sourceKm:slice.sourceKm,rotation,
    bunchSpeedKph:rotation.bunchSpeedKph,
    bunchElapsedSeconds:slice.lengthM*3.6/rotation.bunchSpeedKph,
    pelotonRiderIds:[...ids],roadGroups:[],riderEnergy};
}

export function validateFinaleNamedAttackRotationBunch(input,recorded){
  if(!isDeepStrictEqual(recorded,
    continueFinaleNamedAttackRotationBunch(input)))
    throw new Error('The contained rotating attack does not replay.');
  return true;
}
