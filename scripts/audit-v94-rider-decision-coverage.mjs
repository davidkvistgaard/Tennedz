// Read-only coverage inventory; a paid energy entry is not a rider decision.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';

const results=[];
for(const distanceKm of [120,260])for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30]){
  const settings={distanceKm,teamCount:20,terrain,fatigue,
    attack:'none',chase:'selective',
    seed:`chase-turn-holdout-1-${terrain}-${fatigue}`};
  let recording;
  try{
    ({recording}=createV94RaceDynamicsPreview({format:'one_day',
      settings,roadGroupPaceVersion:3,chaseTurnVersion:1,
      bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1}));
  }catch(error){
    if(!String(error.message).includes('Combined fresh attack and paid pursuit'))
      throw error;
    results.push({distanceKm,terrain,fatigue,refusal:error.message});
    continue;
  }
  const coverage={riderKilometres:0,paidEnergyRows:0,
    forwardDecisionRows:0,forwardRiderKilometres:0,
    pelotonRiderKilometres:0,droppedRiderKilometres:0,
    droppedDecisionRows:0};
  for(const frame of recording.frames){
    const count=frame.riderGroups.length;
    if(count!==160||frame.energyLedger.length!==count)
      throw new Error('Rider coverage source is incomplete.');
    coverage.riderKilometres+=count;
    coverage.paidEnergyRows+=frame.energyLedger.length;
    coverage.forwardDecisionRows+=frame.roadGroupRiderDecisions.length;
    const decisions=new Set(frame.roadGroupRiderDecisions.map(row=>row.riderId));
    if(decisions.size!==frame.roadGroupRiderDecisions.length)
      throw new Error('Duplicate forward rider decision.');
    for(const rider of frame.riderGroups){
      if(rider.group==='breakaway'||rider.group==='front')
        coverage.forwardRiderKilometres++;
      else if(rider.group==='peloton')coverage.pelotonRiderKilometres++;
      else if(rider.group==='dropped'){
        coverage.droppedRiderKilometres++;
        if(decisions.has(rider.id))coverage.droppedDecisionRows++;
      }
    }
  }
  results.push({distanceKm,terrain,fatigue,coverage});
}
console.log(JSON.stringify(results));
