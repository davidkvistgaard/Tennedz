// Opt-in base-cost discount from recorded peloton membership and paid
// leading metres. No wheel, place, or unrecorded contact is inferred.
import {PELOTON_FRONT_TURNS_VERSION} from
  './peloton-front-turns-v1.mjs';

export const V94_PELOTON_DRAFT_COST_VERSION='v94-peloton-draft-cost-1';
export const V94_PELOTON_DRAFT_BASE_FRACTION=.8;

export function sourceV94PelotonDraftCostsV1({
  plan,priorRiderStates,aheadRiderIds,km}){
  if(!Number.isInteger(km)||km<1||
    plan?.version!==PELOTON_FRONT_TURNS_VERSION||
    !Array.isArray(plan.turns)||
    !Array.isArray(priorRiderStates)||
    !Array.isArray(aheadRiderIds)||
    new Set(aheadRiderIds).size!==aheadRiderIds.length||
    new Set(priorRiderStates.map(row=>row.id)).size!==
      priorRiderStates.length||
    aheadRiderIds.some(id=>
      !priorRiderStates.some(row=>row.id===id)))
    throw new Error('Invalid V94 peloton draft source.');
  if(plan.status==='no_front'){
    if(plan.turns.length)throw new Error('Unpaid front cannot shelter riders.');
    return [];
  }
  if(plan.status!=='worked'||
    plan.turns[0]?.startM!==0||
    plan.turns.at(-1)?.endM!==1000||
    plan.turns.some((turn,index)=>
      turn.startM!==(index?
        plan.turns[index-1].endM:0)||
      !Number.isInteger(turn.endM)||
      turn.endM<=turn.startM)||
    new Set(plan.turns.map(turn=>
      turn.leaderRiderId)).size!==plan.turns.length)
    throw new Error('Invalid paid V94 peloton draft intervals.');
  const leading=new Map(plan.turns.map(turn=>[
    turn.leaderRiderId,turn.endM-turn.startM]));
  const ahead=new Set(aheadRiderIds);
  return priorRiderStates.filter(row=>
    row.group==='peloton'&&!ahead.has(row.id)).map(row=>{
    const leadingM=leading.get(row.id)??0;
    return {version:V94_PELOTON_DRAFT_COST_VERSION,
      sourceKm:km,riderId:row.id,priorGroup:'peloton',
      leadingM,
      baseCostFraction:+(V94_PELOTON_DRAFT_BASE_FRACTION+
        (1-V94_PELOTON_DRAFT_BASE_FRACTION)*leadingM/1000)
        .toFixed(6)};
  }).sort((a,b)=>a.riderId.localeCompare(b.riderId));
}
