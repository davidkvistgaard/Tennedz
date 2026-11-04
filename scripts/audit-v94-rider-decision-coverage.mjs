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
const strictPelotonDropContact=process.argv.includes(
  '--strict-peloton-drop-contact');
const pelotonFollowerDecisions=process.argv.includes(
  '--peloton-follower-decisions');
const physicalExposure=process.argv.includes('--physical-exposure');
const freshAttackDecisions=process.argv.includes(
  '--fresh-attack-decisions');
const protectorSportingPursuit=process.argv.includes(
  '--protector-sporting-pursuit');
const protectorTiming=process.argv.includes('--protector-timing');
const sprintStakes=process.argv.includes('--sprint-stakes');
if((draftCost||strictDraftCost)&&!explicitStakes)
  throw new Error('Draft cost audit needs explicit stakes.');
if(draftCost&&strictDraftCost)
  throw new Error('Choose one draft cost version.');
if(pelotonFollowerDecisions&&(!explicitStakes||
  !(draftCost||strictDraftCost)||!strictPelotonDropContact))
  throw new Error('Follower choices need stakes, draft and strict loss contact.');
if(physicalExposure&&!(draftCost||strictDraftCost))
  throw new Error('Physical exposure audit needs draft cost.');
if(freshAttackDecisions&&!explicitStakes)
  throw new Error('Fresh attack choices need explicit stakes.');
if(protectorSportingPursuit&&!explicitStakes)
  throw new Error('Protector pursuit needs explicit stakes.');
if(protectorTiming&&(!protectorSportingPursuit||!sprintStakes)||
  sprintStakes&&!explicitStakes)
  throw new Error('Protector timing needs explicit sprint stakes.');
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
      teamId:team.id,goal:sprintStakes?'sprint_finish':'none',
      captainId:team.orders.captainId})):null;
  let recording;
  try{
    ({recording}=createV94RaceDynamicsPreview({format:'one_day',
      settings,sportingStakes,roadGroupPaceVersion:3,chaseTurnVersion:1,
      bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1,
      pelotonDraftCostVersion:strictDraftCost?2:draftCost?1:0,
      pelotonDropContactVersion:strictPelotonDropContact?1:0,
      pelotonFollowerDecisionVersion:pelotonFollowerDecisions?1:0,
      pelotonExposureCostVersion:physicalExposure?1:0,
      freshAttackDecisionVersion:freshAttackDecisions?1:0,
      protectorSportingPursuitVersion:protectorSportingPursuit?1:0,
      protectorPursuitTimingVersion:protectorTiming?1:0}));
  }catch(error){
    if(!String(error.message).includes('Combined fresh attack and paid pursuit')&&
      !String(error.message).includes('Unresolved peloton draft contact')&&
      !String(error.message).includes('Unresolved peloton drop contact'))
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
    freshAttackDecisionRows:0,
    pelotonRiderKilometres:0,droppedRiderKilometres:0,
    droppedDecisionRows:0,coveredRiderKilometres:0,
    uncoveredRiderKilometres:0,
    uncoveredForwardRiderKilometres:0,
    firstUncoveredForward:null,
    uncoveredForwardFreshAttack:0,
    uncoveredForwardExisting:0,
    uncoveredForwardNewOther:0,
    uncoveredPelotonRiderKilometres:0,
    uncoveredDroppedRiderKilometres:0,
    newDroppedFromPeloton:0,
    newDroppedFromFront:0,
    continuingDropped:0,
    otherDroppedOrigin:0,
    firstDroppedWithoutDecision:null,
    paidBunchWorkerRiderKilometres:0,
    paidBunchWorkerDecisionRows:0,
    paidBunchWorkerWithoutDecision:0,
    pelotonFollowerDecisionRows:0,
    protectorTimingRows:0,protectorTimingChaseRows:0};
  let priorFrame=null;
  for(const frame of recording.frames){
    const count=frame.riderGroups.length;
    if(count!==160||frame.energyLedger.length!==count)
      throw new Error('Rider coverage source is incomplete.');
    const riderIds=new Set(frame.riderGroups.map(row=>row.id));
    if(riderIds.size!==count)
      throw new Error('Duplicate rider in a V94 frame.');
    coverage.riderKilometres+=count;
    coverage.paidEnergyRows+=frame.energyLedger.length;
    coverage.protectorTimingRows+=
      (frame.protectorPursuitDecisions??[]).length;
    coverage.protectorTimingChaseRows+=
      (frame.protectorPursuitDecisions??[]).filter(row=>
        row.choice==='chase').length;
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
    const followerDecisions=frame.pelotonFollowerDecisions??[];
    const attackDecisions=frame.freshAttackRiderDecisions??[];
    if(freshAttackDecisions&&attackDecisions.length!==
      frame.attackers.length||
      attackDecisions.some(row=>
        !frame.attackers.includes(row.riderId)))
      throw new Error('Fresh attack choices differ from paid launch.');
    coverage.freshAttackDecisionRows+=attackDecisions.length;
    const allDecisions=[...forwardDecisions,...workerDecisions,
      ...followerDecisions,
      ...attackDecisions];
    const decisions=new Set(allDecisions
      .map(row=>row.riderId));
    if(decisions.size!==allDecisions.length)
      throw new Error('Duplicate forward rider decision.');
    if(allDecisions.some(row=>
      !riderIds.has(row.riderId)||
      typeof row.choice!=='string'||!row.choice.trim()))
      throw new Error('Invalid forward rider decision.');
    coverage.paidBunchWorkerDecisionRows+=workerDecisions.length;
    coverage.pelotonFollowerDecisionRows+=followerDecisions.length;
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
        if(!decisions.has(rider.id)){
          coverage.uncoveredForwardRiderKilometres++;
          const origin=frame.attackers.includes(rider.id)?
            'fresh_attack':priorFrame?.breakawayRiderIds
              .includes(rider.id)?'existing_front':'new_other';
          if(origin==='fresh_attack')
            coverage.uncoveredForwardFreshAttack++;
          else if(origin==='existing_front')
            coverage.uncoveredForwardExisting++;
          else coverage.uncoveredForwardNewOther++;
          coverage.firstUncoveredForward??={km:frame.km,
            riderId:rider.id,teamId:rider.teamId,origin,
            roadGroupId:frame.roadGroups.find(group=>
              group.riderIds.includes(rider.id))?.id??null,
            splitAttack:frame.splitAttacks.some(row=>
              row.riderId===rider.id),
            joinedBreakaway:frame.joinedBreakawayRiderIds
              .includes(rider.id)};
        }
      }else if(rider.group==='peloton'){
        coverage.pelotonRiderKilometres++;
        if(!decisions.has(rider.id))
          coverage.uncoveredPelotonRiderKilometres++;
      }else if(rider.group==='dropped'){
        coverage.droppedRiderKilometres++;
        if(decisions.has(rider.id))coverage.droppedDecisionRows++;
        else{
          coverage.uncoveredDroppedRiderKilometres++;
          const previous=priorFrame?.riderGroups.find(row=>
            row.id===rider.id);
          const priorGroup=previous?.group??'peloton';
          if(priorGroup==='peloton')
            coverage.newDroppedFromPeloton++;
          else if(priorGroup==='breakaway')
            coverage.newDroppedFromFront++;
          else if(priorGroup==='dropped')
            coverage.continuingDropped++;
          else coverage.otherDroppedOrigin++;
          coverage.firstDroppedWithoutDecision??={
            km:frame.km,riderId:rider.id,
            teamId:rider.teamId,priorGroup,
            priorDeficitSeconds:previous?.deficitSeconds??0,
            deficitSeconds:rider.deficitSeconds,
            coastDelaySeconds:ledgerByRider.get(rider.id)
              ?.coastDelaySeconds??null,
            paidFrontWorker:paidWorkers.has(rider.id)};
        }
      }else throw new Error('Unknown rider road group.');
    }
    if(coverage.uncoveredRiderKilometres!==
      coverage.uncoveredForwardRiderKilometres+
      coverage.uncoveredPelotonRiderKilometres+
      coverage.uncoveredDroppedRiderKilometres)
      throw new Error('Missing decisions differ from road groups.');
    priorFrame=frame;
  }
  results.push({seed,distanceKm,terrain,fatigue,coverage});
}
if(process.argv.includes('--summary')){
  const totals={seedCount,explicitStakes,draftCost,
    freshAttackDecisions,protectorSportingPursuit,
    protectorTiming,sprintStakes,strictPelotonDropContact,
    pelotonFollowerDecisions,physicalExposure,
    strictDraftCost,cases:results.length,
    validatedCases:0,refusedCases:0,
    unresolvedDraftContactCases:0,
    unresolvedPelotonDropContactCases:0,
    riderKilometres:0,
    casesWithDiscountedDrop:0,
    paidEnergyRows:0,forwardDecisionRows:0,
    freshAttackDecisionRows:0,
    draftedRiderKilometres:0,
    discountedDropRiderKilometres:0,
    discountedCoastRiderKilometres:0,
    pelotonRiderKilometres:0,droppedRiderKilometres:0,
    droppedDecisionRows:0,coveredRiderKilometres:0,
    uncoveredRiderKilometres:0,
    uncoveredForwardRiderKilometres:0,
    uncoveredForwardFreshAttack:0,
    uncoveredForwardExisting:0,
    uncoveredForwardNewOther:0,
    uncoveredPelotonRiderKilometres:0,
    uncoveredDroppedRiderKilometres:0,
    newDroppedFromPeloton:0,
    newDroppedFromFront:0,
    continuingDropped:0,
    otherDroppedOrigin:0,
    paidBunchWorkerRiderKilometres:0,
    paidBunchWorkerDecisionRows:0,
    paidBunchWorkerWithoutDecision:0,
    pelotonFollowerDecisionRows:0,
    protectorTimingRows:0,protectorTimingChaseRows:0};
  for(const row of results){
    if(row.refusal){
      totals.refusedCases++;
      if(row.refusal.includes('Unresolved peloton draft contact'))
        totals.unresolvedDraftContactCases++;
      if(row.refusal.includes('Unresolved peloton drop contact'))
        totals.unresolvedPelotonDropContactCases++;
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
      'freshAttackDecisionRows',
      'droppedRiderKilometres','droppedDecisionRows',
      'coveredRiderKilometres',
      'uncoveredRiderKilometres',
      'uncoveredForwardRiderKilometres',
      'uncoveredForwardFreshAttack',
      'uncoveredForwardExisting',
      'uncoveredForwardNewOther',
      'uncoveredPelotonRiderKilometres',
      'uncoveredDroppedRiderKilometres',
      'newDroppedFromPeloton',
      'newDroppedFromFront',
      'continuingDropped',
      'otherDroppedOrigin',
      'paidBunchWorkerRiderKilometres',
      'paidBunchWorkerDecisionRows',
      'paidBunchWorkerWithoutDecision',
      'pelotonFollowerDecisionRows',
      'protectorTimingRows','protectorTimingChaseRows'])
      totals[key]+=row.coverage[key];
  }
  const firstDrop=results.find(row=>
    row.coverage?.firstDiscountedDrop);
  const firstForward=results.find(row=>
    row.coverage?.firstUncoveredForward);
  const firstDropped=results.find(row=>
    row.coverage?.firstDroppedWithoutDecision);
  console.log(JSON.stringify({...totals,
    firstDroppedWithoutDecision:firstDropped?{
      seed:firstDropped.seed,distanceKm:firstDropped.distanceKm,
      terrain:firstDropped.terrain,fatigue:firstDropped.fatigue,
      ...firstDropped.coverage.firstDroppedWithoutDecision}:null,
    firstUncoveredForward:firstForward?{
      seed:firstForward.seed,distanceKm:firstForward.distanceKm,
      terrain:firstForward.terrain,fatigue:firstForward.fatigue,
      ...firstForward.coverage.firstUncoveredForward}:null,
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
