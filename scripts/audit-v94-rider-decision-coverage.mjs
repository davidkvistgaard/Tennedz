// Read-only coverage inventory; a paid energy entry is not a rider decision.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {prepareV91Playtest} from
  '../lib/engine/v2/playtest.mjs';

const requestedSeeds=process.argv.find(arg=>arg.startsWith('--seeds='));
const seedCount=requestedSeeds?Number(requestedSeeds.slice(8)):1;
const explicitStakes=process.argv.includes('--explicit-stakes');
const draftCost=process.argv.includes('--draft-cost');
const strictDraftCost=process.argv.includes('--strict-draft-cost');
if((draftCost||strictDraftCost)&&!explicitStakes)
  throw new Error('Draft cost audit needs explicit stakes.');
if(draftCost&&strictDraftCost)
  throw new Error('Choose one draft cost version.');
if(!Number.isInteger(seedCount)||seedCount<1||seedCount>8)
  throw new Error('Decision coverage seeds must be between 1 and 8.');
const results=[];
for(let seed=1;seed<=seedCount;seed++)
  for(const distanceKm of [120,260])for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30]){
  const settings={distanceKm,teamCount:20,terrain,fatigue,
    attack:'none',chase:'selective',
    seed:`chase-turn-holdout-${seed}-${terrain}-${fatigue}`};
  const sportingStakes=explicitStakes?
    prepareV91Playtest(settings).teams.map(team=>({
      teamId:team.id,goal:'none',
      captainId:team.orders.captainId})):null;
  let recording;
  try{
    ({recording}=createV94RaceDynamicsPreview({format:'one_day',
      settings,sportingStakes,roadGroupPaceVersion:3,chaseTurnVersion:1,
      bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1,
      pelotonDraftCostVersion:strictDraftCost?2:draftCost?1:0}));
  }catch(error){
    if(!String(error.message).includes('Combined fresh attack and paid pursuit')&&
      !String(error.message).includes('Unresolved peloton draft contact'))
      throw error;
    results.push({seed,distanceKm,terrain,fatigue,
      refusal:error.message,
      sourceKm:error.sourceKm??null,
      sourceEvidence:error.sourceEvidence??null});
    continue;
  }
  const coverage={riderKilometres:0,paidEnergyRows:0,
    draftedRiderKilometres:0,
    discountedDropRiderKilometres:0,
    discountedCoastRiderKilometres:0,
    firstDiscountedDrop:null,
    forwardDecisionRows:0,forwardRiderKilometres:0,
    pelotonRiderKilometres:0,droppedRiderKilometres:0,
    droppedDecisionRows:0,coveredRiderKilometres:0,
    uncoveredRiderKilometres:0,
    uncoveredForwardRiderKilometres:0,
    uncoveredPelotonRiderKilometres:0,
    uncoveredDroppedRiderKilometres:0,
    paidBunchWorkerRiderKilometres:0,
    paidBunchWorkerDecisionRows:0,
    paidBunchWorkerWithoutDecision:0};
  for(const frame of recording.frames){
    const count=frame.riderGroups.length;
    if(count!==160||frame.energyLedger.length!==count)
      throw new Error('Rider coverage source is incomplete.');
    const riderIds=new Set(frame.riderGroups.map(row=>row.id));
    if(riderIds.size!==count)
      throw new Error('Duplicate rider in a V94 frame.');
    coverage.riderKilometres+=count;
    coverage.paidEnergyRows+=frame.energyLedger.length;
    const draftRows=frame.pelotonDraftCosts??[];
    if((draftCost||strictDraftCost)&&draftRows.some(row=>
      row.sourceKm!==frame.km||
      row.baseCostFraction<.8||
      row.baseCostFraction>1)||
      !draftCost&&!strictDraftCost&&draftRows.length)
      throw new Error('Invalid V94 draft cost source.');
    coverage.draftedRiderKilometres+=draftRows.length;
    const resultByRider=new Map(frame.riderGroups.map(row=>[
      row.id,row]));
    const ledgerByRider=new Map(frame.energyLedger.map(row=>[
      row.riderId,row]));
    const discountedDrops=draftRows.filter(row=>
      resultByRider.get(row.riderId)?.group==='dropped');
    coverage.discountedDropRiderKilometres+=
      discountedDrops.length;
    if(coverage.firstDiscountedDrop===null&&
      discountedDrops.length)
      coverage.firstDiscountedDrop={km:frame.km,
        riderId:discountedDrops[0].riderId,
        leadingM:discountedDrops[0].leadingM,
        baseCostFraction:
          discountedDrops[0].baseCostFraction};
    coverage.discountedCoastRiderKilometres+=
      draftRows.filter(row=>
        (ledgerByRider.get(row.riderId)
          ?.coastDelaySeconds??0)>0).length;
    coverage.forwardDecisionRows+=frame.roadGroupRiderDecisions.length;
    const forwardDecisions=frame.roadGroupRiderDecisions;
    const workerDecisions=frame.pelotonRiderDecisions??[];
    const decisions=new Set([...forwardDecisions,...workerDecisions]
      .map(row=>row.riderId));
    if(decisions.size!==forwardDecisions.length+workerDecisions.length)
      throw new Error('Duplicate forward rider decision.');
    if([...forwardDecisions,...workerDecisions].some(row=>
      !riderIds.has(row.riderId)||
      typeof row.choice!=='string'||!row.choice.trim()))
      throw new Error('Invalid forward rider decision.');
    coverage.paidBunchWorkerDecisionRows+=workerDecisions.length;
    coverage.coveredRiderKilometres+=decisions.size;
    coverage.uncoveredRiderKilometres+=count-decisions.size;
    const paidWorkers=new Set((frame.pelotonFrontTurnPlan?.turns??[])
      .map(turn=>turn.leaderRiderId));
    if(paidWorkers.size!==
      (frame.pelotonFrontTurnPlan?.turns?.length??0)||
      [...paidWorkers].some(id=>!riderIds.has(id)))
      throw new Error('Paid bunch worker is absent or repeated.');
    if(workerDecisions.some(row=>!paidWorkers.has(row.riderId))||
      (explicitStakes&&workerDecisions.length!==paidWorkers.size))
      throw new Error('Paid bunch worker choices differ from turns.');
    coverage.paidBunchWorkerRiderKilometres+=paidWorkers.size;
    coverage.paidBunchWorkerWithoutDecision+=
      [...paidWorkers].filter(id=>!decisions.has(id)).length;
    for(const rider of frame.riderGroups){
      if(rider.group==='breakaway'||rider.group==='front'){
        coverage.forwardRiderKilometres++;
        if(!decisions.has(rider.id))
          coverage.uncoveredForwardRiderKilometres++;
      }else if(rider.group==='peloton'){
        coverage.pelotonRiderKilometres++;
        if(!decisions.has(rider.id))
          coverage.uncoveredPelotonRiderKilometres++;
      }else if(rider.group==='dropped'){
        coverage.droppedRiderKilometres++;
        if(decisions.has(rider.id))coverage.droppedDecisionRows++;
        else coverage.uncoveredDroppedRiderKilometres++;
      }else throw new Error('Unknown rider road group.');
    }
    if(coverage.uncoveredRiderKilometres!==
      coverage.uncoveredForwardRiderKilometres+
      coverage.uncoveredPelotonRiderKilometres+
      coverage.uncoveredDroppedRiderKilometres)
      throw new Error('Missing decisions differ from road groups.');
  }
  results.push({seed,distanceKm,terrain,fatigue,coverage});
}
if(process.argv.includes('--summary')){
  const totals={seedCount,explicitStakes,draftCost,
    strictDraftCost,cases:results.length,
    validatedCases:0,refusedCases:0,
    unresolvedDraftContactCases:0,
    riderKilometres:0,
    casesWithDiscountedDrop:0,
    paidEnergyRows:0,forwardDecisionRows:0,
    draftedRiderKilometres:0,
    discountedDropRiderKilometres:0,
    discountedCoastRiderKilometres:0,
    pelotonRiderKilometres:0,droppedRiderKilometres:0,
    droppedDecisionRows:0,coveredRiderKilometres:0,
    uncoveredRiderKilometres:0,
    uncoveredForwardRiderKilometres:0,
    uncoveredPelotonRiderKilometres:0,
    uncoveredDroppedRiderKilometres:0,
    paidBunchWorkerRiderKilometres:0,
    paidBunchWorkerDecisionRows:0,
    paidBunchWorkerWithoutDecision:0};
  for(const row of results){
    if(row.refusal){
      totals.refusedCases++;
      if(row.refusal.includes('Unresolved peloton draft contact'))
        totals.unresolvedDraftContactCases++;
      continue;
    }
    totals.validatedCases++;
    if(row.coverage.discountedDropRiderKilometres)
      totals.casesWithDiscountedDrop++;
    for(const key of ['riderKilometres','paidEnergyRows',
      'draftedRiderKilometres',
      'discountedDropRiderKilometres',
      'discountedCoastRiderKilometres',
      'forwardDecisionRows','pelotonRiderKilometres',
      'droppedRiderKilometres','droppedDecisionRows',
      'coveredRiderKilometres',
      'uncoveredRiderKilometres',
      'uncoveredForwardRiderKilometres',
      'uncoveredPelotonRiderKilometres',
      'uncoveredDroppedRiderKilometres',
      'paidBunchWorkerRiderKilometres',
      'paidBunchWorkerDecisionRows',
      'paidBunchWorkerWithoutDecision'])
      totals[key]+=row.coverage[key];
  }
  const firstDrop=results.find(row=>
    row.coverage?.firstDiscountedDrop);
  console.log(JSON.stringify({...totals,
    firstDiscountedDrop:firstDrop?{
      seed:firstDrop.seed,distanceKm:firstDrop.distanceKm,
      terrain:firstDrop.terrain,fatigue:firstDrop.fatigue,
      ...firstDrop.coverage.firstDiscountedDrop}:null}));
}else console.log(JSON.stringify(results));
if(process.argv.includes('--require-complete')){
  const refusals=results.filter(row=>row.refusal);
  const missing=results.reduce((sum,row)=>sum+
    (row.coverage?.uncoveredRiderKilometres??0),0);
  if(refusals.length||missing){
    console.error(`V94 decision coverage refused: `+
      `${refusals.length} incomplete races, `+
      `${missing} rider-kilometres without a choice.`);
    process.exitCode=1;
  }
}
