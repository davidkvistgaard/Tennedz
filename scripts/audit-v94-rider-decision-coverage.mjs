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
const strictPelotonDeficitContact=process.argv.includes(
  '--strict-peloton-deficit-contact');
const pelotonFollowerDecisions=process.argv.includes(
  '--peloton-follower-decisions');
const pelotonFollowerEffort=process.argv.includes(
  '--peloton-follower-effort');
const physicalExposure=process.argv.includes('--physical-exposure');
const freshAttackDecisions=process.argv.includes(
  '--fresh-attack-decisions');
const roadGroupRiderDecisions=process.argv.includes(
  '--road-group-rider-decisions');
const protectorSportingPursuit=process.argv.includes(
  '--protector-sporting-pursuit');
const protectorTiming=process.argv.includes('--protector-timing');
const sprintStakes=process.argv.includes('--sprint-stakes');
const recordedRoadSeeds=process.argv.includes('--recorded-road-seeds');
if((draftCost||strictDraftCost)&&!explicitStakes)
  throw new Error('Draft cost audit needs explicit stakes.');
if(draftCost&&strictDraftCost)
  throw new Error('Choose one draft cost version.');
if(pelotonFollowerDecisions&&pelotonFollowerEffort)
  throw new Error('Choose one follower decision version.');
if((pelotonFollowerDecisions||pelotonFollowerEffort)&&(!explicitStakes||
  !(draftCost||strictDraftCost)||!strictPelotonDropContact))
  throw new Error('Follower choices need stakes, draft and strict loss contact.');
if(physicalExposure&&!(draftCost||strictDraftCost))
  throw new Error('Physical exposure audit needs draft cost.');
if(freshAttackDecisions&&!explicitStakes)
  throw new Error('Fresh attack choices need explicit stakes.');
if(roadGroupRiderDecisions&&!explicitStakes)
  throw new Error('Forward choices need explicit stakes.');
if(strictPelotonDeficitContact&&!strictPelotonDropContact)
  throw new Error('Deficit onset needs strict peloton drop contact.');
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
    seed:recordedRoadSeeds?`preview-recorded-road-${seed}`:
      `chase-turn-holdout-${seed}-${terrain}-${fatigue}`};
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
      pelotonDeficitContactVersion:strictPelotonDeficitContact?1:0,
      pelotonFollowerDecisionVersion:pelotonFollowerEffort?2:
        pelotonFollowerDecisions?1:0,
      pelotonExposureCostVersion:physicalExposure?1:0,
      freshAttackDecisionVersion:freshAttackDecisions?1:0,
      roadGroupRiderDecisionVersion:roadGroupRiderDecisions?1:0,
      protectorSportingPursuitVersion:protectorSportingPursuit?1:0,
      protectorPursuitTimingVersion:protectorTiming?1:0}));
  }catch(error){
    if(!String(error.message).includes('Combined fresh attack and paid pursuit')&&
      !String(error.message).includes('Unresolved peloton draft contact')&&
      !String(error.message).includes('Unresolved peloton drop contact')&&
      !String(error.message).includes('Unresolved peloton deficit onset'))
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
    forwardDecisionRows:0,versionedForwardDecisionRows:0,
    unversionedForwardDecisionRows:0,forwardRiderKilometres:0,
    freshAttackDecisionRows:0,
    pelotonRiderKilometres:0,droppedRiderKilometres:0,
    droppedDecisionRows:0,coveredRiderKilometres:0,
    versionedDecisionRows:0,unversionedDecisionRows:0,
    uncoveredRiderKilometres:0,
    uncoveredForwardRiderKilometres:0,
    firstUncoveredForward:null,
    uncoveredForwardFreshAttack:0,
    uncoveredForwardExisting:0,
    uncoveredForwardNewOther:0,
    uncoveredPelotonRiderKilometres:0,
    caughtToPelotonTransitions:0,
    caughtToPelotonBeforeFinish:0,
    caughtToPelotonForwardDecisions:0,
    caughtToPelotonWithoutDecision:0,
    firstCaughtToPelotonTransition:null,
    firstCaughtToPelotonBeforeFinish:null,
    uncoveredDroppedRiderKilometres:0,
    newDroppedFromPeloton:0,
    newDroppedFromFront:0,
    continuingDropped:0,
    otherDroppedOrigin:0,
    firstDroppedWithoutDecision:null,
    paidBunchWorkerRiderKilometres:0,
    paidBunchWorkerDecisionRows:0,
    paidBunchWorkerWithoutDecision:0,
    pelotonFollowerDecisionRows:0,pelotonFollowerRestRows:0,
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
    const versionedForward=forwardDecisions.filter(row=>
      row.version==='v94-road-group-rider-decisions-1'&&
      row.sourceKm===frame.km&&
      typeof row.goal==='string'&&
      typeof row.teamOrderEffort==='string'&&
      typeof row.teamOrderBreakWork==='string'&&
      Number.isFinite(row.perceivedAbility)&&
      Number.isFinite(row.energyBefore));
    coverage.versionedForwardDecisionRows+=versionedForward.length;
    coverage.unversionedForwardDecisionRows+=
      forwardDecisions.length-versionedForward.length;
    if(roadGroupRiderDecisions&&
      versionedForward.length!==forwardDecisions.length)
      throw new Error('Incomplete versioned forward decisions.');
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
    const versionedDecisions=allDecisions.filter(row=>
      typeof row.version==='string'&&row.version&&
      row.sourceKm===frame.km&&
      typeof row.goal==='string'&&row.goal).length;
    coverage.versionedDecisionRows+=versionedDecisions;
    coverage.unversionedDecisionRows+=allDecisions.length-
      versionedDecisions;
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
    if(pelotonFollowerEffort){
      if(followerDecisions.some(row=>row.version!==
          'v94-peloton-follower-effort-2'||
          row.appliedEffort!==(row.effortSource===
            'recorded_peloton_rest'?'conserve':
            row.teamOrderEffort)))
        throw new Error('Invalid follower applied effort source.');
      coverage.pelotonFollowerRestRows+=followerDecisions.filter(row=>
        row.effortSource==='recorded_peloton_rest').length;
    }
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
        const previous=priorFrame?.riderGroups.find(row=>
          row.id===rider.id);
        if(previous?.group==='breakaway'&&
          frame.caughtBreakawayRiderIds.includes(rider.id)){
          coverage.caughtToPelotonTransitions++;
          const forwardDecision=forwardDecisions.some(row=>
            row.riderId===rider.id);
          if(frame.km<distanceKm){
            coverage.caughtToPelotonBeforeFinish++;
            coverage.firstCaughtToPelotonBeforeFinish??={
              km:frame.km,riderId:rider.id,
              priorGroup:previous.group,
              decisionSource:forwardDecision?'road_group':
                decisions.has(rider.id)?'other':'none'};
          }
          if(forwardDecision)
            coverage.caughtToPelotonForwardDecisions++;
          coverage.firstCaughtToPelotonTransition??={
            km:frame.km,riderId:rider.id,
            priorGroup:previous.group,
            decisionSource:forwardDecision?'road_group':
              decisions.has(rider.id)?'other':'none'};
          if(!decisions.has(rider.id))
            coverage.caughtToPelotonWithoutDecision++;
        }
        if(!decisions.has(rider.id)){
          coverage.uncoveredPelotonRiderKilometres++;
        }
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
    roadGroupRiderDecisions,
    recordedRoadSeeds,
    freshAttackDecisions,protectorSportingPursuit,
    protectorTiming,sprintStakes,strictPelotonDropContact,
    strictPelotonDeficitContact,
    pelotonFollowerDecisions,pelotonFollowerEffort,
    physicalExposure,
    strictDraftCost,cases:results.length,
    validatedCases:0,refusedCases:0,
    unresolvedDraftContactCases:0,
    unresolvedPelotonDropContactCases:0,
    unresolvedPelotonDeficitContactCases:0,
    riderKilometres:0,
    casesWithDiscountedDrop:0,
    paidEnergyRows:0,forwardDecisionRows:0,
    versionedForwardDecisionRows:0,
    unversionedForwardDecisionRows:0,
    freshAttackDecisionRows:0,
    draftedRiderKilometres:0,
    discountedDropRiderKilometres:0,
    discountedCoastRiderKilometres:0,
    pelotonRiderKilometres:0,droppedRiderKilometres:0,
    droppedDecisionRows:0,coveredRiderKilometres:0,
    versionedDecisionRows:0,unversionedDecisionRows:0,
    uncoveredRiderKilometres:0,
    uncoveredForwardRiderKilometres:0,
    uncoveredForwardFreshAttack:0,
    uncoveredForwardExisting:0,
    uncoveredForwardNewOther:0,
    uncoveredPelotonRiderKilometres:0,
    caughtToPelotonTransitions:0,
    caughtToPelotonBeforeFinish:0,
    caughtToPelotonForwardDecisions:0,
    caughtToPelotonWithoutDecision:0,
    uncoveredDroppedRiderKilometres:0,
    newDroppedFromPeloton:0,
    newDroppedFromFront:0,
    continuingDropped:0,
    otherDroppedOrigin:0,
    paidBunchWorkerRiderKilometres:0,
    paidBunchWorkerDecisionRows:0,
    paidBunchWorkerWithoutDecision:0,
    pelotonFollowerDecisionRows:0,pelotonFollowerRestRows:0,
    protectorTimingRows:0,protectorTimingChaseRows:0};
  for(const row of results){
    if(row.refusal){
      totals.refusedCases++;
      if(row.refusal.includes('Unresolved peloton draft contact'))
        totals.unresolvedDraftContactCases++;
      if(row.refusal.includes('Unresolved peloton drop contact'))
        totals.unresolvedPelotonDropContactCases++;
      if(row.refusal.includes('Unresolved peloton deficit onset'))
        totals.unresolvedPelotonDeficitContactCases++;
      continue;
    }
    totals.validatedCases++;
    if(row.coverage.discountedDropRiderKilometres)
      totals.casesWithDiscountedDrop++;
    for(const key of ['riderKilometres','paidEnergyRows',
      'draftedRiderKilometres',
      'discountedDropRiderKilometres',
      'discountedCoastRiderKilometres',
      'forwardDecisionRows','versionedForwardDecisionRows',
      'unversionedForwardDecisionRows','pelotonRiderKilometres',
      'freshAttackDecisionRows',
      'droppedRiderKilometres','droppedDecisionRows',
      'versionedDecisionRows','unversionedDecisionRows',
      'coveredRiderKilometres',
      'uncoveredRiderKilometres',
      'uncoveredForwardRiderKilometres',
      'uncoveredForwardFreshAttack',
      'uncoveredForwardExisting',
      'uncoveredForwardNewOther',
      'uncoveredPelotonRiderKilometres',
      'caughtToPelotonTransitions',
      'caughtToPelotonBeforeFinish',
      'caughtToPelotonForwardDecisions',
      'caughtToPelotonWithoutDecision',
      'uncoveredDroppedRiderKilometres',
      'newDroppedFromPeloton',
      'newDroppedFromFront',
      'continuingDropped',
      'otherDroppedOrigin',
      'paidBunchWorkerRiderKilometres',
      'paidBunchWorkerDecisionRows',
      'paidBunchWorkerWithoutDecision',
      'pelotonFollowerDecisionRows','pelotonFollowerRestRows',
      'protectorTimingRows','protectorTimingChaseRows'])
      totals[key]+=row.coverage[key];
  }
  const firstDrop=results.find(row=>
    row.coverage?.firstDiscountedDrop);
  const firstForward=results.find(row=>
    row.coverage?.firstUncoveredForward);
  const firstDropped=results.find(row=>
    row.coverage?.firstDroppedWithoutDecision);
  const firstCaught=results.find(row=>
    row.coverage?.firstCaughtToPelotonTransition);
  const firstCaughtBeforeFinish=results.find(row=>
    row.coverage?.firstCaughtToPelotonBeforeFinish);
  const firstDeficitOnset=results.find(row=>
    row.refusal?.includes('Unresolved peloton deficit onset'));
  console.log(JSON.stringify({...totals,
    firstPelotonDeficitOnset:firstDeficitOnset?{
      seed:firstDeficitOnset.seed,
      distanceKm:firstDeficitOnset.distanceKm,
      terrain:firstDeficitOnset.terrain,
      fatigue:firstDeficitOnset.fatigue,
      sourceKm:firstDeficitOnset.sourceKm,
      sourceEvidence:firstDeficitOnset.sourceEvidence}:null,
    firstCaughtToPelotonBeforeFinish:firstCaughtBeforeFinish?{
      seed:firstCaughtBeforeFinish.seed,
      distanceKm:firstCaughtBeforeFinish.distanceKm,
      terrain:firstCaughtBeforeFinish.terrain,
      fatigue:firstCaughtBeforeFinish.fatigue,
      ...firstCaughtBeforeFinish.coverage
        .firstCaughtToPelotonBeforeFinish}:null,
    firstCaughtToPelotonTransition:firstCaught?{
      seed:firstCaught.seed,distanceKm:firstCaught.distanceKm,
      terrain:firstCaught.terrain,fatigue:firstCaught.fatigue,
      ...firstCaught.coverage.firstCaughtToPelotonTransition}:null,
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
