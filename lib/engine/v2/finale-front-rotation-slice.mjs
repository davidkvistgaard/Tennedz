import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {finalePassiveBunchSpeed} from './finale-worker.mjs';
import {segmentBaseSeconds} from './finish.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {MOTOR_EXPLICIT_FRONT,TUNING} from './tuning.mjs';

export const FINALE_FRONT_ROTATION_SLICE_VERSION=
  'v2-finale-front-rotation-slice-1';

const extraCost=effort=>effort==='hard'?
  TUNING.groups.hardPaceWorkerExtraCostPerKm:effort==='steady'?
    TUNING.groups.steadyPaceWorkerExtraCostPerKm:
    MOTOR_EXPLICIT_FRONT.conserveWorkerExtraCostPerKm;
const paceAdjustment=effort=>effort==='conserve'?
  MOTOR_EXPLICIT_FRONT.conserveFrontAdjustmentPoints:
  TUNING.groups.frontPaceAdjustmentPoints[effort];

// One counterfactual, paid rotation choice. An attack or chase team supplied
// as busy cannot also set front pace. This is a scheduling building block;
// a source-linked road runner must carry its energy and pace into every slice.
export function recordFinaleFrontRotationSlice({slice,route,teams,
  pelotonRiderIds,energies,busyTeamIds=[]}){
  const grid=finaleDistanceGrid(route,{remainingKm:1});
  const turnIndex=grid.findIndex(row=>row.startDistanceM===
    slice?.startDistanceM&&row.endDistanceM===slice.endDistanceM);
  if(turnIndex<0||!isDeepStrictEqual(slice,grid[turnIndex])||
    !Array.isArray(teams)||!teams.length||
    new Set(teams.map(team=>team?.id)).size!==teams.length||
    !Array.isArray(pelotonRiderIds)||!pelotonRiderIds.length||
    new Set(pelotonRiderIds).size!==pelotonRiderIds.length||
    !(energies instanceof Map)||!Array.isArray(busyTeamIds)||
    new Set(busyTeamIds).size!==busyTeamIds.length||
    busyTeamIds.some(id=>!teams.some(team=>team.id===id)))
    throw new Error('A front rotation needs a canonical slice and distinct teams.');
  const segment=route.kilometres[slice.sourceKm-1];
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  if(ridersById.size!==teams.reduce((count,team)=>
    count+team.riders.length,0)||pelotonRiderIds.some(id=>
    !ridersById.has(id)||!Number.isFinite(energies.get(id))||
      energies.get(id)<0||energies.get(id)>100))
    throw new Error('Front rotation needs present, energized locked riders.');
  const present=new Set(pelotonRiderIds);
  const busy=new Set(busyTeamIds);
  const eligible=[];
  for(const team of teams){
    const order=orderAt(team.orders,slice.sourceKm-1);
    if(order.frontWork!=='rotate'||busy.has(team.id))continue;
    const workers=team.riders.filter(rider=>
      team.orders.helperIds.includes(rider.id)&&present.has(rider.id))
      .map(rider=>{
        const energy=energies.get(rider.id);
        if(energy<=TUNING.chase.minHelperEnergy)return null;
        const effect=riderKilometreEffect(rider,segment,{
          phase:'cruise',energy,exposed:segment.exposed});
        const energySpent=energyCostForFinaleSlice(slice,
          (TUNING.effortCost[order.effort]+extraCost(order.effort))*
            effect.energyCostMultiplier);
        return energySpent<=energy+1e-9?{
          riderId:rider.id,ability:effect.ability,
          energyAtDecision:energy,energySpent,
          energyAfter:Math.max(0,energy-energySpent)}:null;
      }).filter(Boolean)
      .sort((a,b)=>b.ability-a.ability||
        a.riderId.localeCompare(b.riderId));
    if(workers.length<2)continue;
    const pair=workers.slice(0,2);
    const paceAbility=(pair[0].ability+pair[1].ability)/2+
      paceAdjustment(order.effort);
    const secondsPerKm=segmentBaseSeconds(segment)+
      (50-paceAbility-TUNING.breakaway.bunchDraftAdvantage)*
        TUNING.breakaway.driftSecondsPerAbilityPoint;
    if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
      throw new Error('The rotating helpers have no finite bunch pace.');
    eligible.push({teamId:team.id,effort:order.effort,
      riderIds:pair.map(row=>row.riderId),work:pair.map(row=>({
        riderId:row.riderId,energyAtDecision:row.energyAtDecision,
        energySpent:row.energySpent,energyAfter:row.energyAfter})),
    speedKph:3600/secondsPerKm});
  }
  eligible.sort((a,b)=>a.teamId.localeCompare(b.teamId));
  const selected=eligible.length?eligible[turnIndex%eligible.length]:null;
  const passiveBunchSpeedKph=finalePassiveBunchSpeed({
    riderIds:pelotonRiderIds,ridersById,energies,segment});
  return {version:FINALE_FRONT_ROTATION_SLICE_VERSION,
    startDistanceM:slice.startDistanceM,endDistanceM:slice.endDistanceM,
    turnIndex,eligibleTeamIds:eligible.map(row=>row.teamId),
    selected: selected??null,passiveBunchSpeedKph,
    bunchSpeedKph:Math.max(passiveBunchSpeedKph,
      selected?.speedKph??0)};
}

export function validateFinaleFrontRotationSlice(input,recorded){
  if(!isDeepStrictEqual(recorded,recordFinaleFrontRotationSlice(input)))
    throw new Error('The front rotation slice does not replay.');
  return true;
}
