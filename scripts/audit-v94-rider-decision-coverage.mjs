// Read-only coverage inventory; a paid energy entry is not a rider decision.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {prepareV91Playtest} from
  '../lib/engine/v2/playtest.mjs';

const requestedSeeds=process.argv.find(arg=>arg.startsWith('--seeds='));
const seedCount=requestedSeeds?Number(requestedSeeds.slice(8)):1;
const explicitStakes=process.argv.includes('--explicit-stakes');
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
      bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1}));
  }catch(error){
    if(!String(error.message).includes('Combined fresh attack and paid pursuit'))
      throw error;
    results.push({seed,distanceKm,terrain,fatigue,
      refusal:error.message,
      sourceKm:error.sourceKm??null,
      sourceEvidence:error.sourceEvidence??null});
    continue;
  }
  const coverage={riderKilometres:0,paidEnergyRows:0,
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
  const totals={seedCount,explicitStakes,cases:results.length,
    validatedCases:0,refusedCases:0,riderKilometres:0,
    paidEnergyRows:0,forwardDecisionRows:0,
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
    if(row.refusal){totals.refusedCases++;continue;}
    totals.validatedCases++;
    for(const key of ['riderKilometres','paidEnergyRows',
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
  console.log(JSON.stringify(totals));
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
