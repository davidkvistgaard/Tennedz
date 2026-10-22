import {riderKilometreEffect,sportingSkills} from './physiology.mjs';

export const FINALE_LEAD_OUT_VERSION='v2-finale-lead-out-candidate-1';

// Read-only role selection for a future short-step finale. It neither changes
// v79 results nor grants a finisher speed or position before work is recorded.
export function selectFinaleLeadOut({team,finisherId,nomineeId=null,riderStates,segment}){
  const riders=team?.riders;
  if(!Array.isArray(riders)||riders.length!==8||
    riders.some(rider=>typeof rider?.id!=='string'||!rider.id)||
    new Set(riders.map(rider=>rider?.id)).size!==8||
    !team.orders||team.orders.version!==2||
    !Array.isArray(team.orders.helperIds)||
    new Set(team.orders.helperIds).size!==team.orders.helperIds.length||
    team.orders.helperIds.some(id=>!riders.some(rider=>rider.id===id))||
    !Array.isArray(riderStates)||riderStates.length!==8||
    riderStates.some(state=>typeof state?.riderId!=='string'||!state.riderId)||
    new Set(riderStates.map(state=>state?.riderId)).size!==8||
    riderStates.some(state=>!riders.some(rider=>rider.id===state.riderId)||
      !Number.isFinite(state.energy)||state.energy<0||state.energy>100||
      typeof state.roadGroupId!=='string'||!state.roadGroupId))
    throw new Error('Lead-out selection needs a complete locked lineup and rider states.');
  if(!riders.some(rider=>rider.id===finisherId)||
    nomineeId!==null&&(!riders.some(rider=>rider.id===nomineeId)||nomineeId===finisherId))
    throw new Error('The finisher and nominated lead-out must be distinct locked riders.');
  const states=new Map(riderStates.map(state=>[state.riderId,state]));
  const finisher=states.get(finisherId);
  const candidates=riders.filter(rider=>rider.id!==finisherId).map(rider=>{
    const state=states.get(rider.id);
    const sharedGroup=finisher.energy>0&&finisher.roadGroupId!=='dropped'&&
      state.roadGroupId===finisher.roadGroupId;
    const eligible=sharedGroup&&state.energy>=20;
    if(!eligible)return {riderId:rider.id,eligible:false,
      reason:!sharedGroup?'different_road_group':'exhausted'};
    const skills=sportingSkills(rider);
    const effect=riderKilometreEffect(rider,segment,{phase:'chase',
      energy:state.energy,exposed:segment.exposed});
    const ability=effect.ability*.25+skills.positioning*.25+
      skills.acceleration*.2+skills.endurance*.15+skills.strength*.15;
    const score=+(ability*(.4+.6*state.energy/100)).toFixed(3);
    // A short launch is hard work; this rate is an uncalibrated laboratory
    // input, never a charge in the current race/point path.
    return {riderId:rider.id,eligible:true,score,energy:state.energy,
      workCostPerKm:+(28*effect.energyCostMultiplier).toFixed(3)};
  });
  const nominated=nomineeId===null?null:candidates.find(row=>row.riderId===nomineeId);
  const available=candidates.filter(row=>row.eligible).sort((a,b)=>
    b.score-a.score||a.riderId.localeCompare(b.riderId));
  const selected=nominated?.eligible?nominated:available.find(row=>
    team.orders.helperIds?.includes(row.riderId))??null;
  return {version:FINALE_LEAD_OUT_VERSION,finisherId,
    nominatedRiderId:nomineeId,selectedRiderId:selected?.riderId??null,
    status:selected?'ready':'unavailable',
    fallbackReason:nominated&&!nominated.eligible?nominated.reason:null,
    selectedScore:selected?.score??null,
    selectedWorkCostPerKm:selected?.workCostPerKm??null};
}
