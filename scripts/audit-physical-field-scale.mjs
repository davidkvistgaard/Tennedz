// Read-only 20-team stress audit of the isolated paid physical source.
// A refusal marks a missing branch, never an inferred wheel or finish.
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../lib/engine/v2/skills.mjs';
import {normalizeOrders} from '../lib/engine/v2/orders.mjs';
import {commitTeamChaseStakesV1} from
  '../lib/engine/v2/team-chase-stake-v1.mjs';
import {commitRearSoloPlanV1} from
  '../lib/engine/v2/rear-solo-commitment-v1.mjs';
import {replayPhysicalFrontRaceV1,
  validatePhysicalFrontRaceV1} from
  '../lib/engine/v2/physical-front-race-replay-v1.mjs';
import {replayPhysicalFrontFirstRearLossKmV1,
  validatePhysicalFrontFirstRearLossKmV1} from
  '../lib/engine/v2/physical-front-first-rear-loss-v1.mjs';
import {advancePhysicalFrontRearClearKmV1,
  replayPhysicalFrontRearNextKmV1,
  validatePhysicalFrontRearNextKmV1} from
  '../lib/engine/v2/physical-front-rear-next-km-v1.mjs';
import {resolvePhysicalFrontRearContactV1,
  validatePhysicalFrontRearContactV1} from
  '../lib/engine/v2/physical-front-rear-contact-v1.mjs';
import {startPhysicalBunchV1,runPhysicalBunchV1,
  runPhysicalBunchToPaceLossV1,
  runPhysicalStaggeredBunchLossV1} from
  '../lib/engine/v2/physical-start-bunch-v1.mjs';
import {replayPhysicalSingleLossRaceV1,
  validatePhysicalSingleLossRaceV1} from
  '../lib/engine/v2/physical-single-loss-race-replay-v1.mjs';
import {completePhysicalPaceLossKmV1,
  completePhysicalOrderedRearLossesKmV1,
  validatePhysicalOrderedRearLossesKmV1,
  partitionPhysicalStaggeredLossArrivalsV1,
  validatePhysicalStaggeredLossArrivalsV1} from
  '../lib/engine/v2/physical-pace-loss-completion-v1.mjs';
import {inspectPhysicalOrderedRearLossBoundaryV1,
  validatePhysicalOrderedRearLossBoundaryV1,
  sourcePhysicalOrderedRearLossBoundaryV1} from
  '../lib/engine/v2/physical-ordered-rear-loss-boundary-v1.mjs';
import {advancePhysicalOrderedRearLossKmV1,
  validatePhysicalOrderedRearLossKmV1} from
  '../lib/engine/v2/physical-ordered-rear-loss-km-v1.mjs';
import {inspectPhysicalStaggeredLossKmContactsV1,
  validatePhysicalStaggeredLossKmContactsV1} from
  '../lib/engine/v2/physical-staggered-loss-km-contact-v1.mjs';
import {finishPhysicalLossKmContactV1,
  validatePhysicalLossKmContactV1,
  finishPhysicalSoloFieldContactKmV1,
  validatePhysicalSoloFieldContactKmV1} from
  '../lib/engine/v2/physical-loss-km-contact-road-v1.mjs';
import {runPhysicalLossKmRearPairV1,
  validatePhysicalLossKmRearPairV1,
  runPhysicalSoloFieldRearPairV1,
  validatePhysicalSoloFieldRearPairV1} from
  '../lib/engine/v2/physical-loss-km-rear-pair-v1.mjs';
import {probePhysicalStaggeredSoloFieldV1} from
  '../lib/engine/v2/physical-staggered-detached-solo-v1.mjs';
import {inspectFirstStaggeredSoloFieldContactV1} from
  '../lib/engine/v2/physical-staggered-solo-field-contact-v1.mjs';
import {inspectNextRearPairFieldContactV1} from
  '../lib/engine/v2/physical-rear-pair-field-contact-v1.mjs';
import {finishPhysicalSecondRearPairContactV1,
  runPhysicalSecondRearPairV1} from
  '../lib/engine/v2/physical-second-rear-pair-v1.mjs';
import {advancePhysicalThirdRearGroupV1} from
  '../lib/engine/v2/physical-third-rear-contact-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  '../lib/engine/v2/physical-rear-event-track-v1.mjs';
import {decidePhysicalRearContactV1} from
  '../lib/engine/v2/physical-rear-contact-choice-v1.mjs';
import {replayPhysicalCommittedStageReleaseFinishV1,
  validatePhysicalCommittedStageReleaseFinishV1} from
  '../lib/engine/v2/physical-committed-stage-release-km-v1.mjs';
import {replayPhysicalCommittedStageJoinRaceV1,
  validatePhysicalCommittedStageJoinRaceV1} from
  '../lib/engine/v2/physical-committed-stage-join-race-v1.mjs';
import {probePhysicalOrderedSoloBunchContactV1,
  validatePhysicalOrderedSoloBunchContactV1} from
  '../lib/engine/v2/physical-ordered-solo-bunch-contact-v1.mjs';
import {finishPhysicalOrderedSoloBunchJoinKmV1} from
  '../lib/engine/v2/physical-ordered-solo-bunch-join-v1.mjs';
import {inspectPhysicalOrderedRearBoundaryV1,
  validatePhysicalOrderedRearBoundaryV1,
  sourcePhysicalOrderedRearBoundaryRoadsV1,
  findPhysicalOrderedBoundaryEventsV1} from
  '../lib/engine/v2/physical-ordered-rear-boundary-v1.mjs';
import {resolvePhysicalOrderedRearFirstContactV1,
  validatePhysicalOrderedRearFirstContactV1} from
  '../lib/engine/v2/physical-ordered-rear-first-contact-v1.mjs';
import {probePhysicalOrderedRearBunchContactV1,
  validatePhysicalOrderedRearBunchContactV1} from
  '../lib/engine/v2/physical-ordered-rear-bunch-contact-v1.mjs';
import {finishPhysicalOrderedRearBunchJoinKmV1,
  validatePhysicalOrderedRearBunchJoinKmV1} from
  '../lib/engine/v2/physical-ordered-rear-bunch-join-v1.mjs';
import {replayPhysicalOrderedRearKmV1,
  validatePhysicalOrderedRearKmV1} from
  '../lib/engine/v2/physical-ordered-rear-km-v1.mjs';
import {replayPhysicalOrderedRearNextBunchKmV1,
  validatePhysicalOrderedRearNextBunchKmV1,
  advancePhysicalOrderedRearBunchFromStateV1} from
  '../lib/engine/v2/physical-ordered-rear-next-bunch-v1.mjs';
import {inspectPhysicalOrderedRearNextBoundaryV1,
  validatePhysicalOrderedRearNextBoundaryV1,
  sourcePhysicalOrderedRearBoundaryFromStateV1} from
  '../lib/engine/v2/physical-ordered-rear-next-boundary-v1.mjs';
import {replayPhysicalOrderedRearNextKmV1,
  validatePhysicalOrderedRearNextKmV1,
  advancePhysicalOrderedRearClearKmV1} from
  '../lib/engine/v2/physical-ordered-rear-next-km-v1.mjs';
import {resolvePhysicalOrderedRearContinuationContactV1,
  validatePhysicalOrderedRearContinuationContactV1} from
  '../lib/engine/v2/physical-ordered-rear-continuation-contact-v1.mjs';
import {replayPhysicalOrderedRearContinuationKmV1,
  validatePhysicalOrderedRearContinuationKmV1} from
  '../lib/engine/v2/physical-ordered-rear-continuation-km-v1.mjs';
import {probePhysicalOrderedRearContinuationBunchContactV1,
  validatePhysicalOrderedRearContinuationBunchContactV1} from
  '../lib/engine/v2/physical-ordered-rear-continuation-bunch-contact-v1.mjs';
import {finishPhysicalOrderedRearContinuationBunchJoinV1,
  validatePhysicalOrderedRearContinuationBunchJoinV1} from
  '../lib/engine/v2/physical-ordered-rear-continuation-bunch-join-v1.mjs';
import {replayPhysicalOrderedRearContinuationBunchKmV1,
  validatePhysicalOrderedRearContinuationBunchKmV1} from
  '../lib/engine/v2/physical-ordered-rear-continuation-bunch-km-v1.mjs';
import {advancePhysicalOrderedRearBunchPassKmV1,
  validatePhysicalOrderedRearBunchPassKmV1} from
  '../lib/engine/v2/physical-ordered-rear-bunch-pass-km-v1.mjs';
import {resolvePhysicalOrderedRearBunchThenRearContactV1,
  validatePhysicalOrderedRearBunchThenRearContactV1} from
  '../lib/engine/v2/physical-ordered-rear-bunch-then-rear-contact-v1.mjs';
import {inspectPhysicalOrderedRearPostBunchChainV1,
  validatePhysicalOrderedRearPostBunchChainV1} from
  '../lib/engine/v2/physical-ordered-rear-post-bunch-chain-v1.mjs';
import {advancePhysicalOrderedRearPostBunchKmV1,
  validatePhysicalOrderedRearPostBunchKmV1} from
  '../lib/engine/v2/physical-ordered-rear-post-bunch-km-v1.mjs';
import {inspectPhysicalOrderedRearEventSequenceV1,
  validatePhysicalOrderedRearEventSequenceV1} from
  '../lib/engine/v2/physical-ordered-rear-event-sequence-v1.mjs';
import {advancePhysicalOrderedRearEventKmV1,
  validatePhysicalOrderedRearEventKmV1} from
  '../lib/engine/v2/physical-ordered-rear-event-km-v1.mjs';
import {replayPhysicalStaggeredRearEventsV1,
  validatePhysicalStaggeredRearEventsV1,
  inspectPhysicalRearEventEndStateV1,
  validatePhysicalRearEventEndStateV1} from
  '../lib/engine/v2/physical-staggered-rear-event-replay-v1.mjs';
import {partitionPhysicalSimultaneousLossV1,
  validatePhysicalSimultaneousLossPartitionV1,
  contactPhysicalSimultaneousLossV1,
  validatePhysicalSimultaneousLossContactV1} from
  '../lib/engine/v2/physical-simultaneous-loss-contact-v1.mjs';
import {replayPhysicalSimultaneousRearGroupV1,
  validatePhysicalSimultaneousRearGroupV1,
  replayPhysicalMixedSimultaneousRearGroupV1,
  validatePhysicalMixedSimultaneousRearGroupV1} from
  '../lib/engine/v2/physical-simultaneous-rear-group-v1.mjs';
import {contactPhysicalMixedRearSoloV1,
  validatePhysicalMixedRearSoloContactV1} from
  '../lib/engine/v2/physical-mixed-rear-solo-contact-v1.mjs';
import {finishPhysicalMixedRearContactKmV1,
  validatePhysicalMixedRearContactKmV1} from
  '../lib/engine/v2/physical-mixed-rear-contact-road-v1.mjs';
import {replayPhysicalMixedJoinedRearRaceV1,
  validatePhysicalMixedJoinedRearRaceV1} from
  '../lib/engine/v2/physical-mixed-joined-rear-race-v1.mjs';

const fieldSize=20;
const ridersPerTeam=8;
const route=distanceKm=>Array.from({length:distanceKm},
  (_,index)=>{
    const terrain=['flat','hill','climb','descent'][
      Math.floor(index/10)%4];
    return {km:index+1,terrain,
      gradientPct:terrain==='hill'?3:
        terrain==='climb'?6:terrain==='descent'?-3:0,
      surface:'road',exposed:index%15<5,
      weather:{temperatureC:16,
        windKph:index%15<5?10:0,rainMm:0}};
  });

function source(distanceKm,fatigue,variant){
  const teams=Array.from({length:fieldSize},(_,number)=>{
    const id=`team-${number}`;
    const riders=Array.from({length:ridersPerTeam},
      (_,riderNumber)=>({
        id:`${id}-${riderNumber}`,form:50,fatigue,
        ...Object.fromEntries(SPORTING_SKILLS.map(
          skill=>[skill,96]))}));
    return {id,riders,
      energy:Object.fromEntries(riders.map(row=>[
        row.id,100-fatigue*.4])),
      orders:{captainId:riders[0].id,
        helperIds:riders.slice(2).map(row=>row.id),
        baseline:{effort:'steady',attack:'none',
          chase:'ignore',frontWork:number===0?
            'rotate':'sit_in',
          ...(number===0?{
            frontWorkRiderId:`${id}-2`}:{})},
        phases:[]}};
  });
  if(variant==='one_weak_climber')
    teams[19].riders[7].mountain=30;
  if(variant==='many_weak_climbers'||
    variant==='unequal_weak_climbers'||
    variant==='nearly_equal_weak_climbers'||
    variant==='unequal_descent_catch')
    for(const team of teams)team.riders[7].mountain=30;
  if(variant==='unequal_weak_climbers')
    teams[19].riders[7].mountain=35;
  if(variant==='nearly_equal_weak_climbers')
    teams[19].riders[7].mountain=31;
  if(variant==='unequal_descent_catch'){
    teams[19].riders[7].mountain=31;
    teams[19].riders[7].descending=0;
  }
  if(variant==='varied_field'||
    variant==='varied_captain'||
    variant==='front_varied')
    for(let teamIndex=0;teamIndex<teams.length;
      teamIndex++){
      const team=teams[teamIndex];
      for(let riderIndex=0;riderIndex<team.riders.length;
        riderIndex++){
        const rider=team.riders[riderIndex];
        const marker=teamIndex*8+riderIndex;
        rider.flat=92+(marker*3)%7;
        rider.hills=92+(marker*5)%7;
        rider.mountain=92+(marker*11)%7;
        rider.endurance=92+(marker*13)%7;
        rider.timetrial=92+(marker*17)%7;
        rider.strength=92+(marker*19)%7;
        rider.form=46+marker%9;
        rider.fatigue=fatigue+marker%5;
        team.energy[rider.id]=100-rider.fatigue*.4;
      }
    }
  if(variant==='varied_captain'){
    teams[4].orders.captainId='team-4-3';
    teams[4].orders.helperIds=teams[4].orders
      .helperIds.filter(id=>id!=='team-4-3');
  }
  if(variant==='front_uniform'||
    variant==='front_varied'){
    const attacker=teams[19].riders[1];
    for(const skill of SPORTING_SKILLS)
      attacker[skill]=100;
    teams[19].orders.baseline={
      ...teams[19].orders.baseline,
      effort:'hard',attack:'selective',
      attackRiderId:attacker.id};
    teams[19].orders.phases.push({atKm:5,
      effort:'steady',attack:'none'});
  }
  const workerChoices=(variant==='varied_field'||
    variant==='varied_captain'||
    variant==='front_varied')?
    teams.map(team=>team.riders.slice(2)
      .filter(row=>team.orders.helperIds.includes(
        row.id)).sort((a,b)=>{
      const score=rider=>rider.flat+rider.hills+
        rider.mountain+rider.endurance+
        rider.form-rider.fatigue;
      return score(b)-score(a)||
        a.id.localeCompare(b.id);
    }).slice(0,2).map(row=>row.id)):null;
  if(workerChoices)
    teams[0].orders.baseline.frontWorkRiderId=
      workerChoices[0][0];
  for(let marker=5;marker<distanceKm;marker+=5){
    const priorTeam=Math.floor((marker-1)/5)%fieldSize;
    const nextTeam=Math.floor(marker/5)%fieldSize;
    if(priorTeam!==nextTeam)
      teams[priorTeam].orders.phases.push({
        atKm:marker,frontWork:'sit_in'});
    teams[nextTeam].orders.phases.push({
      atKm:marker,frontWork:'rotate',
      frontWorkRiderId:workerChoices?
        workerChoices[nextTeam][0]:
        `team-${nextTeam}-2`});
  }
  for(const team of teams)
    team.orders=normalizeOrders(team.orders,{
      riderIds:team.riders.map(row=>row.id),
      distanceKm,allowFrontWork:true,
      allowNamedFrontWorker:true});
  const commitment=commitTeamChaseStakesV1({teams,
    distanceKm,intentions:teams.map((team,index)=>({
      teamId:team.id,baseline:{goal:(variant===
        'front_uniform'||variant===
        'front_varied')&&index===19?
        'break_stage':index===0||
        variant==='varied_captain'&&index===4?
        'sprint_finish':'none',
      captainId:team.orders.captainId},phases:[]}))});
  const startInput={teams,routeKilometres:route(distanceKm),
    commitment,raceSeed:'physical-20-team-scale-1',
    ...(['varied_field','varied_captain',
      'front_varied'].includes(
      variant)?{
      physicalDraftVersion:variant===
        'front_varied'?4:2,
      ...(variant==='front_varied'?{
        physicalRearIntentVersion:2}:{}),
      emergencyFrontWorkers:workerChoices.map(
        (choices,index)=>({version:1,
          teamId:teams[index].id,
          unavailableRiderId:choices[0],
          replacementRiderId:choices[1]}))}:{})};
  return {startInput,start:startPhysicalBunchV1(startInput)};
}

if(process.argv.includes('--probe-front-field')){
  const variant=process.argv.includes(
    '--front-varied')?
    'front_varied':'front_uniform';
  const distanceKm=Number(process.argv.find(arg=>
    arg.startsWith('--distance='))?.split('=')[1]??120);
  const fatigue=Number(process.argv.find(arg=>
    arg.startsWith('--fatigue='))?.split('=')[1]??10);
  const input=source(distanceKm,fatigue,variant);
  const probe=throughKm=>replayPhysicalFrontRaceV1({
    ...input,attackKm:1,throughKm});
  let lastFullKm=1;
  let refusal=null;
  let full=null;
  try{
    full=probe(distanceKm);
    lastFullKm=distanceKm;
  }catch(error){
    let lower=1;
    let upper=distanceKm;
    while(upper-lower>1){
      const mid=Math.floor((lower+upper)/2);
      try{probe(mid);lower=mid;}
      catch{upper=mid;}
    }
    lastFullKm=lower;
    try{probe(upper);}
    catch(firstError){refusal={sourceKm:upper,
      reason:firstError.message};}
  }
  if(full){
    assert.equal(validatePhysicalFrontRaceV1({
      ...input,attackKm:1,throughKm:distanceKm},
    full),true);
    assert.equal(full.kilometres.length,distanceKm);
    assert.ok(full.kilometres.every(row=>
      row.riderStates.length===160));
    const previous=new Map();
    for(const kilometre of full.kilometres)
      for(const row of kilometre.riderStates){
        const before=previous.get(row.riderId);
        assert.equal(row.sourceKm,
          kilometre.sourceKm);
        assert.equal(row.atDistanceM,
          kilometre.sourceKm*1000);
        assert.ok(Number.isFinite(
          row.elapsedSeconds)&&
          (before===undefined||
            row.elapsedSeconds>before));
        assert.ok(Number.isFinite(
          row.energyAfter)&&
          row.energyAfter>=0);
        assert.ok(row.decisions.length>0);
        previous.set(row.riderId,
          row.elapsedSeconds);
      }
  }
  if(process.argv.includes('--assert-front-field')){
    assert.equal(lastFullKm,variant===
      'front_uniform'?distanceKm:20);
    assert.equal(refusal?.sourceKm??null,
      variant==='front_uniform'?null:21);
    assert.equal(refusal?.reason??null,
      variant==='front_uniform'?null:
        'Physical start follower cannot hold paid pace.');
  }
  const finish=full?{
    riderCount:full.kilometres.at(-1)
      .riderStates.length,
    frontRiderId:full.sources.front.riderId,
    initialGapSeconds:full.sources.front.attack
      .frontGapSeconds,
    finalGapSeconds:full.sources.front.steps.at(-1)
      .gapSecondsToBunch,
    earliestSeconds:Math.min(...Object.values(
      full.observedFinishSecondsByRider)),
    latestSeconds:Math.max(...Object.values(
      full.observedFinishSecondsByRider)),
    minimumEnergy:Math.min(...full.kilometres
      .at(-1).riderStates.map(row=>row.energyAfter)),
    officialResults:full.officialResults}:null;
  process.stdout.write(JSON.stringify({distanceKm,
    fatigue,variant,lastFullKm,refusal,finish},
  null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-front-first-loss')){
  const distanceKm=Number(process.argv.find(arg=>
    arg.startsWith('--distance='))?.split('=')[1]??120);
  const fatigue=Number(process.argv.find(arg=>
    arg.startsWith('--fatigue='))?.split('=')[1]??10);
  const input=source(distanceKm,fatigue,
    'front_varied');
  const replayInput={...input,attackKm:1,
    lossKm:21};
  const result=replayPhysicalFrontFirstRearLossKmV1(
    replayInput);
  assert.equal(validatePhysicalFrontFirstRearLossKmV1(
    replayInput,result),true);
  assert.equal(result.sourcedRiderCount,160);
  assert.equal(result.riderCount,160);
  assert.equal(result.fieldKilometreIncomplete,
    false);
  assert.equal(result.candidateEventCount,0);
  const previous=new Map(result.sources.before
    .kilometres.at(-1).riderStates.map(row=>
      [row.riderId,row]));
  assert.ok(result.riderStates.every(row=>{
    const prior=previous.get(row.riderId);
    return prior&&row.sourceKm===21&&
      row.atDistanceM===21000&&
      row.elapsedSeconds>prior.elapsedSeconds&&
      Number.isFinite(row.energyAfter)&&
      row.energyAfter>=0&&
      row.decisions.length>0;
  }));
  process.stdout.write(JSON.stringify({distanceKm,
    fatigue,sourceKm:result.sourceKm,
    bunchRiders:result.endBunchState.riderIds.length,
    frontRiderId:result.endFrontState.riderId,
    rearRiderIds:result.candidateRearSolos.map(row=>
      row.riderId),
    frontGapSeconds:result.endFrontState
      .gapSecondsToBunch,
    firstRearGapSeconds:result.candidateRearSolos[0]
      .gapSecondsToBunch,
    firstCandidateEvent:result.firstCandidateEvent,
    candidateEventCount:result.candidateEventCount,
    riderCount:result.riderCount,
    fieldKilometreIncomplete:result
      .fieldKilometreIncomplete},null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-front-next-bunch')){
  const distanceKm=Number(process.argv.find(arg=>
    arg.startsWith('--distance='))?.split('=')[1]??120);
  const fatigue=Number(process.argv.find(arg=>
    arg.startsWith('--fatigue='))?.split('=')[1]??10);
  const input=source(distanceKm,fatigue,
    'front_varied');
  const replayInput={...input,attackKm:1,
    lossKm:21};
  const next=replayPhysicalFrontRearNextKmV1(
    replayInput);
  assert.equal(validatePhysicalFrontRearNextKmV1(
    replayInput,next),true);
  process.stdout.write(JSON.stringify({distanceKm,
    fatigue,sourceKm:next.sourceKm,
    bunchRiders:next.endBunchState.riderIds.length,
    rearRiders:next.endRearEntities.length,
    frontRiderId:next.endFrontState.riderId,
    frontGapSeconds:next.endFrontState
      .gapSecondsToBunch,
    newSplits:next.sources.step.splits.map(row=>({
      riderId:row.riderId,
      atDistanceM:row.atDistanceM})),
    candidateEventCount:next.candidateEventCount,
    firstCandidateEvent:next.firstCandidateEvent,
    riderCount:next.riderCount??null,
    fieldKilometreIncomplete:next
      .fieldKilometreIncomplete},null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-front-clear-prefix')||
  process.argv.includes('--probe-front-rear-contact')){
  const distanceKm=Number(process.argv.find(arg=>
    arg.startsWith('--distance='))?.split('=')[1]??120);
  const fatigue=Number(process.argv.find(arg=>
    arg.startsWith('--fatigue='))?.split('=')[1]??10);
  const input=source(distanceKm,fatigue,
    'front_varied');
  let prior=replayPhysicalFrontFirstRearLossKmV1({
    ...input,attackKm:1,lossKm:21});
  let firstUnresolvedKm=null;
  let reason=null;
  let firstEvent=null;
  let candidateEventCount=0;
  let newSplits=[];
  for(let km=22;km<=distanceKm;km++){
    let next;
    try{next=advancePhysicalFrontRearClearKmV1({
      startInput:input.startInput,prior});}
    catch(error){firstUnresolvedKm=km;
      reason=error.message;break;}
    if(next.fieldKilometreIncomplete){
      firstUnresolvedKm=km;
      reason='Paid road contact needs a choice.';
      firstEvent=next.firstCandidateEvent;
      candidateEventCount=
        next.candidateEventCount;
      newSplits=next.sources.step.splits.map(row=>
        row.riderId);
      break;
    }
    assert.equal(next.riderCount,160);
    prior=next;
  }
  if(process.argv.includes(
    '--assert-front-clear-prefix')){
    assert.equal(prior.sourceKm,
      fatigue===10?30:25);
    assert.equal(firstUnresolvedKm,
      fatigue===10?31:26);
    assert.deepEqual(firstEvent?.roadIds,[
      'solo-team-3-3','solo-team-4-3']);
    assert.equal(candidateEventCount,
      fatigue===10?2:1);
    assert.equal(newSplits.length,
      fatigue===10?0:11);
  }
  if(process.argv.includes(
    '--probe-front-rear-contact')){
    const contactInput={startInput:input.startInput,
      prior};
    if(fatigue===30){
      assert.equal(firstEvent?.catchingRoadId,
        null);
      assert.throws(()=>
        resolvePhysicalFrontRearContactV1(
          contactInput),
      /needs measured rear approach/);
      process.stdout.write(JSON.stringify({
        distanceKm,fatigue,
        contactKm:firstUnresolvedKm,
        event:firstEvent,
        simultaneousSplitContactRefused:true},
      null,2)+'\n');
      process.exit(0);
    }
    const contact=resolvePhysicalFrontRearContactV1(
      contactInput);
    assert.equal(validatePhysicalFrontRearContactV1(
      contactInput,contact),true);
    assert.equal(contact.sourceKm,
      firstUnresolvedKm);
    assert.deepEqual(contact.event,firstEvent);
    assert.equal(contact.choice.outcome,'join');
    assert.equal(contact.membershipChanged,true);
    assert.equal(contact.candidateGroupRoad.riders
      .filter(row=>row.role==='leader').length,1);
    assert.ok(contact.candidateGroupRoad.riders
      .some(row=>row.role==='sheltered'&&
        row.draftFraction<1));
    assert.equal(contact.nextCandidateEvent
      ?.sourceKm,firstUnresolvedKm);
    process.stdout.write(JSON.stringify({distanceKm,
      fatigue,lastFullKm:prior.sourceKm,
      contactKm:contact.sourceKm,
      event:contact.event,
      outcome:contact.choice.outcome,
      membershipChanged:contact.membershipChanged,
      paidApproaches:contact.paidApproaches,
      candidateGroupRoad:contact
        .candidateGroupRoad??null,
      nextCandidateEvent:contact
        .nextCandidateEvent??null,
      laterRoadUnsettled:contact
        .laterRoadUnsettled},null,2)+'\n');
    process.exit(0);
  }
  process.stdout.write(JSON.stringify({distanceKm,
    fatigue,lastFullKm:prior.sourceKm,
    firstUnresolvedKm,reason,firstEvent,
    candidateEventCount,newSplits,
    bunchRiders:prior.endBunchState.riderIds.length,
    rearRoads:prior.endRearEntities.length,
    frontGapSeconds:prior.endFrontState
      .gapSecondsToBunch},null,2)+'\n');
  process.exit(0);
}

function audit(distanceKm,fatigue,variant){
  const input=source(distanceKm,fatigue,variant);
  let run;
  try{run=runPhysicalBunchV1({...input,throughKm:distanceKm});}
  catch(error){
    let lower=0;
    let upper=distanceKm;
    while(upper-lower>1){
      const km=Math.floor((lower+upper)/2);
      try{runPhysicalBunchV1({...input,throughKm:km});
        lower=km;}
      catch{upper=km;}
    }
    const lossKm=upper;
    if(error.message!==
      'Physical start follower cannot hold paid pace.')
      return {distanceKm,fatigue,variant,
        status:'refused',sourceKm:lossKm,
        reason:error.message};
    const loss=runPhysicalBunchToPaceLossV1({
      ...input,lossKm});
    const splitIds=loss.step.splits.map(row=>row.riderId);
    let staggeredScale=null;
    if(variant==='varied_field'){
      try{
        const staggered=runPhysicalStaggeredBunchLossV1({
          ...input,throughKm:distanceKm});
        const arrivalsInput={...input,staggered};
        const arrivals=partitionPhysicalStaggeredLossArrivalsV1(
          arrivalsInput);
        validatePhysicalStaggeredLossArrivalsV1(
          arrivalsInput,arrivals);
        const soloFieldInput={...arrivalsInput,
          throughKm:distanceKm};
        const soloField=probePhysicalStaggeredSoloFieldV1(
          soloFieldInput);
        const fieldContactInput={...arrivalsInput,
          soloField};
        const fieldContact=
          inspectFirstStaggeredSoloFieldContactV1(
            fieldContactInput);
        let laterFieldContactRoad=null;
        if(fieldContact.firstContact&&
          fieldContact.firstContact.sourceKm>
            Math.max(...staggered.losses.filter(row=>
              fieldContact.firstContact.riderIds.includes(
                row.riderId)).map(row=>row.sourceKm))){
          const fieldRoadInput={...fieldContactInput,
            fieldContact};
          laterFieldContactRoad=
            finishPhysicalSoloFieldContactKmV1(
              fieldRoadInput);
          validatePhysicalSoloFieldContactKmV1(
            fieldRoadInput,laterFieldContactRoad);
        }
        let laterPairContinuation=null;
        let paidPairSource=null;
        if(laterFieldContactRoad){
          const pairInput={...fieldContactInput,
            fieldContact,
            contactRoad:laterFieldContactRoad,
            throughKm:distanceKm};
          const pair=runPhysicalSoloFieldRearPairV1(
            pairInput);
          validatePhysicalSoloFieldRearPairV1(
            pairInput,pair);
          paidPairSource=pair;
          laterPairContinuation={status:'paid_pair_road',
            version:pair.version,
            steps:pair.steps.length,
            leaders:new Set(pair.steps.map(step=>
              step.leaderRiderId)).size,
            oneLeaderEveryKm:pair.steps.every(step=>
              step.riders.filter(rider=>
                rider.role==='leader').length===1),
            paidShelterEveryKm:pair.steps.every(step=>
              step.riders.filter(rider=>
                rider.role==='sheltered').length===1&&
              step.riders.every(rider=>
                rider.energySpent>0&&
                rider.recoveryAward===0)),
            endClock:pair.elapsedSeconds};
        }
        const lossContacts=
          inspectPhysicalStaggeredLossKmContactsV1(
            arrivalsInput);
        validatePhysicalStaggeredLossKmContactsV1(
          arrivalsInput,lossContacts);
        const paidContactRemainders=
          lossContacts.contacts.map(contact=>{
            const contactInput={...arrivalsInput,contact};
            const road=finishPhysicalLossKmContactV1(
              contactInput);
            validatePhysicalLossKmContactV1(
              contactInput,road);
            return road;
          });
        let rearPairContinuation=null;
        if(paidContactRemainders.length===1)
          try{
            const pairInput={...arrivalsInput,
              contact:lossContacts.contacts[0],
              contactRoad:paidContactRemainders[0],
              throughKm:distanceKm};
            const pair=runPhysicalLossKmRearPairV1(
              pairInput);
            validatePhysicalLossKmRearPairV1(
              pairInput,pair);
            paidPairSource=pair;
            rearPairContinuation={status:'paid_pair_road',
              version:pair.version,
              sourceKm:pair.sourceKm,
              steps:pair.steps.length,
              alternatingLeaders:new Set(pair.steps.map(
                step=>step.leaderRiderId)).size,
              oneLeaderEveryKm:pair.steps.every(step=>
                step.riders.filter(rider=>
                  rider.role==='leader').length===1),
              paidShelterEveryKm:pair.steps.every(step=>
                step.riders.filter(rider=>
                  rider.role==='sheltered').length===1&&
                step.riders.every(rider=>
                  rider.energySpent>0&&
                  rider.recoveryAward===0)),
              endClock:pair.elapsedSeconds};
          }catch(pairError){rearPairContinuation={
            status:'refused',reason:pairError.message,
            sourceKm:pairError.sourceKm??null};}
        const nextContact=paidPairSource?
          inspectNextRearPairFieldContactV1({
            ...fieldContactInput,firstFieldContact:
              fieldContact,
            contactRoad:laterFieldContactRoad??
              paidContactRemainders[0],
            pair:paidPairSource}):null;
        let secondRearPair=null;
        let thirdContact=null;
        let thirdRearGroup=null;
        if(nextContact?.nextContacts.length===1&&
          nextContact.nextContacts[0].kind===
            'two_other_solos_meet'){
          const secondInput={...fieldContactInput,
            firstFieldContact:fieldContact,
            contactRoad:laterFieldContactRoad??
              paidContactRemainders[0],
            pair:paidPairSource,
            secondContact:nextContact.nextContacts[0]};
          const road=finishPhysicalSecondRearPairContactV1(
            secondInput);
          const pair=runPhysicalSecondRearPairV1({
            ...secondInput,secondContactRoad:road,
            throughKm:distanceKm});
          const third=advancePhysicalThirdRearGroupV1({
            ...secondInput,secondContactRoad:road,
            secondPair:pair,throughKm:distanceKm});
          thirdContact={nextContacts:[third.thirdContact]};
          const thirdRoad=third.thirdContactRoad;
          const thirdGroup=third.group;
          const thirdEvent=third.thirdContact;
          const thirdTrack=pricePhysicalRearEventTrackV1({
            startInput,
            riderIds:thirdEvent.riders.map(row=>
              row.riderId),
            energyByRider:Object.fromEntries(
              thirdEvent.riders.map(row=>[
                row.riderId,row.energyAtContact])),
            km:thirdEvent.sourceKm,
            startM:thirdEvent.atDistanceM-
              (thirdEvent.sourceKm-1)*1000,
            startClock:thirdEvent.clockSeconds,
            contactLeaderRiderId:
              thirdRoad.leaderRiderId,
            groupId:thirdRoad.physicalGroup.id});
          const nextThirdTrack=pricePhysicalRearEventTrackV1({
            startInput,
            riderIds:thirdRoad.physicalGroup.riderIds,
            energyByRider:Object.fromEntries(
              thirdRoad.riders.map(row=>[
                row.riderId,row.energyAfter])),
            km:thirdEvent.sourceKm+1,startM:0,
            startClock:thirdRoad.elapsedSeconds,
            rotationIndex:0,
            groupId:thirdRoad.physicalGroup.id});
          thirdRearGroup={sourceKm:thirdRoad.sourceKm,
              contactMetres:thirdRoad.startDistanceM,
              riderCount:thirdRoad.riders.length,
              leaderRiderId:thirdRoad.leaderRiderId,
              roadRoles:thirdRoad.riders.map(rider=>({
                riderId:rider.riderId,role:rider.role,
                energySpent:rider.energySpent})),
              steps:thirdGroup.steps.length,
              leaders:[...new Set(thirdGroup.steps.map(step=>
                step.leaderRiderId))],
              oneLeaderEveryKm:thirdGroup.steps.every(step=>
                step.riders.filter(rider=>
                  rider.role==='leader').length===1),
              paidShelterEveryKm:thirdGroup.steps.every(step=>
                step.riders.filter(rider=>
                  rider.role==='sheltered').length===
                    thirdRoad.riders.length-1&&
                step.riders.every(rider=>
                  rider.energySpent>0&&
                  rider.recoveryAward===0)),
              endClock:thirdGroup.elapsedSeconds,
              genericTrackMatchesRoad:
                Math.abs(thirdTrack.endClock-
                  thirdRoad.elapsedSeconds)<1e-7&&
                thirdTrack.leaderRiderId===
                  thirdRoad.leaderRiderId&&
                thirdTrack.rows.every(row=>
                  Math.abs(row.energyAfter-
                    thirdRoad.riders.find(item=>
                      item.riderId===row.riderId)
                      .energyAfter)<1e-7),
              genericNextTrackMatches:
                Math.abs(nextThirdTrack.endClock-
                  thirdGroup.steps[0]
                    .elapsedSeconds)<1e-7&&
                nextThirdTrack.leaderRiderId===
                  thirdGroup.steps[0]
                    .leaderRiderId,
              otherRidersUnsettled:
                thirdGroup.otherRidersUnsettled};
          secondRearPair={sourceKm:road.sourceKm,
            contactMetres:road.startDistanceM,
            leaderRiderId:road.leaderRiderId,
            roadRoles:road.riders.map(rider=>({
              riderId:rider.riderId,role:rider.role,
              energySpent:rider.energySpent})),
            steps:pair.steps.length,
            leaders:[...new Set(pair.steps.map(step=>
              step.leaderRiderId))],
            oneLeaderEveryKm:pair.steps.every(step=>
              step.riders.filter(rider=>
                rider.role==='leader').length===1),
            paidShelterEveryKm:pair.steps.every(step=>
              step.riders.filter(rider=>
                rider.role==='sheltered').length===1&&
              step.riders.every(rider=>
                rider.energySpent>0&&
                rider.recoveryAward===0)),
            endClock:pair.elapsedSeconds,
            otherRidersUnsettled:pair.otherRidersUnsettled};
        }
        staggeredScale={status:'paid_bunch_finish',
          sourceVersion:staggered.version,
          detachedRiders:staggered.detachedRiderIds.length,
          paidLossCompletions:arrivals.completions.length,
          soloCandidates:soloField.candidates.length,
          soloRefusals:soloField.refusals,
          firstSoloFieldContact:
            fieldContact.firstContact,
          laterFieldContactRoad,
          laterPairContinuation,
          nearCoincidentArrivals:
            arrivals.nearCoincidentArrivals.length,
          nearCoincidentArrivalRows:
            arrivals.nearCoincidentArrivals,
          withinLossKmContactPairs:
            lossContacts.contacts.length,
          firstWithinLossKmContacts:
            lossContacts.contacts.slice(0,5),
          paidContactRemainders,
          rearPairContinuation,
          nextContact:nextContact?.nextContacts??[],
          secondRearPair,
          thirdContact:thirdContact?.nextContacts??[],
          thirdRearGroup,
          separateArrivalSolos:
            arrivals.separateSoloRiderIds.length,
          lossKilometres:[...new Set(staggered.losses
            .map(row=>row.sourceKm))],
          paidPaceMatches:staggered.road.reduce((sum,row)=>
            sum+row.riders.filter(rider=>
              rider.role==='pace_match').length,0),
          emergencyTurns:staggered.road.filter(row=>
            row.emergencyFrontWorker).length,
          singleLeaderEveryKm:staggered.road.every(row=>
            row.riders.filter(rider=>
              rider.role==='leader').length===1),
          validPaceMatches:staggered.road.every(row=>
            row.riders.filter(rider=>
              rider.role==='pace_match').every(rider=>
              rider.energySpent>0&&
              rider.recoveryAward===0&&
              row.riderDecisions.find(decision=>
                decision.riderId===rider.riderId)
                ?.choice==='hold_pace')),
          everyBunchRiderDecided:staggered.road.every(row=>
            row.riders.length===
              row.riderDecisions.length),
          namedLeaders:new Set(staggered.road.map(row=>
            row.leaderRiderId)).size,
          bunchFinishRiders:staggered.physicalGroup
            .riderIds.length};
      }catch(nextError){staggeredScale={
        status:'refused',reason:nextError.message};}
    }
    const completions=splitIds.map(riderId=>
      completePhysicalPaceLossKmV1({
        ...input,lossKm,loss,riderId}));
    const soloClockSpread=Math.max(...completions.map(
      row=>row.elapsedSeconds))-Math.min(
      ...completions.map(row=>row.elapsedSeconds));
    let continuation=null;
    let mixedContinuation=null;
    let laterMixedContact=null;
    let laterMixedRoad=null;
    let joinedContinuation=null;
    let paidRearContact=null;
    let paidArrivalPartitions=null;
    if(splitIds.length>1){
      const contactInput={...input,lossKm};
      const partition=partitionPhysicalSimultaneousLossV1(
        contactInput);
      assert.equal(validatePhysicalSimultaneousLossPartitionV1(
        contactInput,partition),true);
      if(variant==='unequal_weak_climbers'&&
        distanceKm===120&&fatigue===10){
        const forged=structuredClone(partition);
        forged.contacts[0].riderIds.push('team-19-7');
        assert.throws(()=>
          validatePhysicalSimultaneousLossPartitionV1(
            contactInput,forged),/differs from source/);
      }
      paidArrivalPartitions={contactSizes:partition.contacts
        .map(row=>row.riderIds.length),
      separateSoloRiderIds:partition.separateSoloRiderIds};
      let contact;
      try{
        contact=contactPhysicalSimultaneousLossV1(
          contactInput);
        assert.equal(validatePhysicalSimultaneousLossContactV1(
          contactInput,contact),true);
        paidRearContact={atDistanceM:contact.contact
          .atDistanceM,clockSeconds:contact.contact
          .clockSeconds,
        riderIds:contact.contact.riderIds.length,
        behindBunchSeconds:contact.contact
          .behindBunchSeconds};
      }catch(contactError){continuation={
        status:'refused',reason:contactError.message};}
      if(contact){
        try{
        const groupInput={...input,lossKm,
          throughKm:distanceKm};
        const group=replayPhysicalSimultaneousRearGroupV1(
          groupInput);
        assert.equal(validatePhysicalSimultaneousRearGroupV1(
          groupInput,group),true);
        const firstRearKm=group.sources.later[0];
        assert.equal(firstRearKm.rearRows.filter(row=>
          row.role==='leader').length,1);
        assert.equal(firstRearKm.rearRows.filter(row=>
          row.role==='sheltered').length,19);
        assert.ok(firstRearKm.rearRows.every(row=>
          row.energySpent>0));
        assert.ok(firstRearKm.rearRows.find(row=>
          row.role==='leader').energySpent>
          Math.max(...firstRearKm.rearRows.filter(row=>
            row.role==='sheltered').map(row=>
              row.energySpent)));
        assert.ok(group.sources.later.every(row=>
          row.gapSecondsToBunch>0));
        if(distanceKm===120&&fatigue===10){
          const forged=structuredClone(group);
          forged.kilometres.at(-1).riderStates.find(row=>
            row.riderId===splitIds[0]).energyAfter+=1;
          assert.throws(()=>
            validatePhysicalSimultaneousRearGroupV1(
              groupInput,forged),
          /differs from source/);
        }
        continuation={status:'paid_finish',
          riderKilometres:group.kilometres.reduce(
            (sum,row)=>sum+row.riderStates.length,0),
          finishRiders:Object.keys(group
            .observedFinishSecondsByRider).length,
          namedRearLeaders:new Set(group.sources.later
            .map(row=>row.leaderRiderId)).size,
          minimumEnergy:Math.min(...group.kilometres
            .flatMap(row=>row.riderStates.map(rider=>
              rider.energyAfter)))};
        }catch(groupError){continuation={
          status:'refused',reason:groupError.message,
          sourceKm:groupError.sourceKm};}
      }
      if(variant==='unequal_weak_climbers'||
        variant==='nearly_equal_weak_climbers'||
        variant==='unequal_descent_catch'){
        const mixedInput={...input,lossKm,
          throughKm:distanceKm};
        try{
          const mixed=replayPhysicalMixedSimultaneousRearGroupV1(
            mixedInput);
          assert.equal(validatePhysicalMixedSimultaneousRearGroupV1(
            mixedInput,mixed),true);
          assert.ok(mixed.sources.later.every(row=>
            row.rearRows.filter(rider=>
              rider.role==='leader').length===1&&
            row.rearRows.filter(rider=>
              rider.role==='sheltered').length===18));
          assert.ok(mixed.sources.later[0].rearRows.find(row=>
            row.role==='leader').energySpent>
            Math.max(...mixed.sources.later[0]
              .rearRows.filter(row=>row.role==='sheltered')
              .map(row=>row.energySpent)));
          if(distanceKm===120&&fatigue===10){
            const forged=structuredClone(mixed);
            forged.observedFinishSecondsByRider[
              'team-19-7']+=1;
            assert.throws(()=>
              validatePhysicalMixedSimultaneousRearGroupV1(
                mixedInput,forged),/differs from paid source/);
          }
          mixedContinuation={status:'paid_finish',
            riderKilometres:mixed.kilometres.reduce(
              (sum,row)=>sum+row.riderStates.length,0),
            finishRiders:Object.keys(mixed
              .observedFinishSecondsByRider).length,
            namedRearLeaders:new Set(mixed.sources.later
              .map(row=>row.leaderRiderId)).size,
            minimumEnergy:Math.min(...mixed.kilometres
              .flatMap(row=>row.riderStates.map(rider=>
                rider.energyAfter)))};
        }catch(mixedError){mixedContinuation={
          status:'refused',reason:mixedError.message,
          sourceKm:mixedError.sourceKm};}
        if(variant==='unequal_descent_catch'&&
          mixedContinuation.sourceKm){
          const laterInput={...input,lossKm,
            contactKm:mixedContinuation.sourceKm};
          const later=contactPhysicalMixedRearSoloV1(
            laterInput);
          assert.equal(validatePhysicalMixedRearSoloContactV1(
            laterInput,later),true);
          assert.equal(later.sources.prior.kilometres.length,
            later.sourceKm-1);
          assert.equal(later.riders.filter(row=>
            row.role==='leader').length,1);
          assert.equal(later.riders.filter(row=>
            row.role==='sheltered').length,18);
          assert.equal(later.riders.filter(row=>
            row.role==='solo').length,1);
          assert.ok(later.riders.find(row=>
            row.role==='leader').energySpent>
            Math.max(...later.riders.filter(row=>
              row.role==='sheltered').map(row=>
                row.energySpent)));
          const forged=structuredClone(later);
          forged.riders.at(-1).energyAfter+=1;
          assert.throws(()=>
            validatePhysicalMixedRearSoloContactV1(
              laterInput,forged),/differs from paid source/);
          laterMixedContact={sourceKm:later.sourceKm,
            atDistanceM:later.atDistanceM,
            behindBunchSeconds:later.behindBunchSeconds,
            riderCount:later.riders.length,
            leaderRiderId:later.leaderRiderId,
            minimumEnergy:Math.min(...later.riders
              .map(row=>row.energyAfter))};
          const roadInput={...laterInput,contact:later};
          const road=finishPhysicalMixedRearContactKmV1(
            roadInput);
          assert.equal(validatePhysicalMixedRearContactKmV1(
            roadInput,road),true);
          assert.equal(road.riders.filter(row=>
            row.role==='leader').length,1);
          assert.equal(road.riders.filter(row=>
            row.role==='sheltered').length,19);
          assert.ok(road.riders.find(row=>
            row.role==='leader').energySpent>
            Math.max(...road.riders.filter(row=>
              row.role==='sheltered').map(row=>
                row.energySpent)));
          laterMixedRoad={sourceKm:road.sourceKm,
            endDistanceM:road.endDistanceM,
            riderCount:road.riders.length,
            gapSecondsToBunch:road.gapSecondsToBunch,
            minimumEnergy:Math.min(...road.riders.map(
              row=>row.energyAfter))};
          try{
            const joinedInput={...input,lossKm,
              contactKm:later.sourceKm,
              throughKm:distanceKm};
            const joined=replayPhysicalMixedJoinedRearRaceV1(
              joinedInput);
            assert.equal(validatePhysicalMixedJoinedRearRaceV1(
              joinedInput,joined),true);
            const contactStates=joined.kilometres[
              later.sourceKm-1].riderStates;
            assert.equal(contactStates.filter(row=>
              row.physicalGroupId!=='peloton'&&
              row.decisions.length===2).length,20);
            assert.equal(contactStates.filter(row=>
              row.physicalGroupId==='peloton'&&
              row.decisions.length===1).length,140);
            const forgedJoined=structuredClone(joined);
            forgedJoined.observedFinishSecondsByRider[
              'team-19-7']+=1;
            assert.throws(()=>
              validatePhysicalMixedJoinedRearRaceV1(
                joinedInput,forgedJoined),
            /differs from source/);
            joinedContinuation={status:'paid_finish',
              riderKilometres:joined.kilometres.reduce(
                (sum,row)=>sum+row.riderStates.length,0),
              finishRiders:Object.keys(joined
                .observedFinishSecondsByRider).length,
              namedRearLeaders:new Set(joined.sources.later
                .map(row=>row.leaderRiderId)).size,
              minimumEnergy:Math.min(...joined.kilometres
                .flatMap(row=>row.riderStates.map(rider=>
                  rider.energyAfter)))};
          }catch(joinedError){joinedContinuation={
            status:'refused',reason:joinedError.message,
            sourceKm:joinedError.sourceKm};}
        }
      }
    }
    if(splitIds.length===1){
      try{
        const replayInput={...input,lossKm,
          riderId:splitIds[0],throughKm:distanceKm};
        const replay=replayPhysicalSingleLossRaceV1(
          replayInput);
        assert.equal(validatePhysicalSingleLossRaceV1(
          replayInput,replay),true);
        continuation={status:'paid_finish',
          riderKilometres:replay.kilometres.reduce(
            (sum,row)=>sum+row.riderStates.length,0),
          finishRiders:Object.keys(replay
            .observedFinishSecondsByRider).length};
      }catch(nextError){continuation={
        status:'refused',reason:nextError.message};}
    }
    return {distanceKm,fatigue,variant,
      status:'paid_split',sourceKm:lossKm,
      splitRiders:splitIds,
      staggeredScale,
      soloClockSpread,
      paidArrivalPartitions,
      paidRearContact,
      bunchAtKmEnd:loss.step.physicalGroup.riderIds.length,
      continuation,mixedContinuation,
      laterMixedContact,laterMixedRoad,
      joinedContinuation};
  }
  const decisions=run.road.reduce((sum,row)=>
    sum+row.riderDecisions.length,0);
  const namedLeaders=new Set(run.road.map(row=>
    row.leaderRiderId)).size;
  return {distanceKm,fatigue,variant,
    status:'paid_bunch_finish',
    riderKilometres:decisions,
    finishRiders:run.physicalGroup.riderIds.length,
    namedLeaders,
    minimumEnergy:Math.min(...Object.values(
      run.energyByRider))};
}

if(process.argv.includes('--probe-stage-join')){
  const results=[];
  for(const distanceKm of [120,260])
    for(const fatigue of [10,30]){
      const base=source(distanceKm,fatigue,
        'equal_field');
      const riderId='team-19-7';
      const keypoints=[{km:6}];
      const frontTeam=base.startInput.teams[1];
      frontTeam.orders.phases.push({
        atKm:6,effort:'conserve'});
      frontTeam.orders.phases=frontTeam.orders.phases
        .map(phase=>phase.atKm===10?{
          ...phase,effort:'steady'}:phase)
        .sort((a,b)=>a.atKm-b.atKm);
      for(const team of base.startInput.teams)
        team.orders=normalizeOrders(team.orders,{
          riderIds:team.riders.map(row=>row.id),
          distanceKm,keypoints,
          allowFrontWork:true,
          allowNamedFrontWorker:true});
      base.startInput.commitment=
        commitTeamChaseStakesV1({
          teams:base.startInput.teams,
          distanceKm,keypoints,
          intentions:base.startInput.teams.map(
            (team,index)=>({teamId:team.id,
              baseline:{goal:index===0?
                'sprint_finish':'none',
              captainId:team.orders.captainId},
              phases:[]}))});
      base.startInput.teams[19].riders[7]
        .mountain=100;
      const plan=commitRearSoloPlanV1({
        riderId,distanceKm,stageNumber:1,
        stageCount:2,baseline:{goal:'finish_safely',
          effort:'steady'},phases:[{atKm:5,
          goal:'save_for_stage',effort:'conserve',
          committedStagePlan:{riderId,
            currentStageNumber:1,
            targetStageNumber:2,
            currentGoal:'finish_safely',
            futureGoal:'target_stage',
            reserveEnergy:20}}]});
      const startInput={...base.startInput,
        physicalDraftVersion:4,
        soloCommitments:[plan]};
      const input={startInput,
        start:startPhysicalBunchV1(startInput),
        riderId,releaseKm:6,
        throughKm:distanceKm};
      const race=replayPhysicalCommittedStageJoinRaceV1(
        input);
      assert.equal(validatePhysicalCommittedStageJoinRaceV1(
        input,race),true);
      assert.equal(race.kilometres.length,distanceKm);
      assert.ok(race.kilometres.every(km=>
        km.riderStates.length===160&&
        km.riderStates.every(row=>
          row.decisions.length>0&&
          Number.isFinite(row.energyAfter))));
      assert.equal(Object.keys(race
        .observedFinishSecondsByRider).length,160);
      assert.equal(race.sources.join.sourceKm,7);
      assert.ok(race.sources.join
        .contactAtDistanceM>6000&&
        race.sources.join.contactAtDistanceM<7000&&
        race.sources.join.shelteredEnergySpent<
          race.sources.join
            .exposedAlternativeEnergyDemand);
      assert.ok(race.sources.later.every(step=>
        step.riders.filter(row=>
          row.role==='leader').length===1&&
        step.riders.find(row=>row.riderId===
          riderId)?.role==='sheltered'&&
        step.riderDecisions.find(row=>
          row.riderId===riderId)?.effort===
            'conserve'&&
        step.riderDecisions.find(row=>
          row.riderId===riderId)
          ?.teamOrderEffort==='steady'));
      results.push({distanceKm,fatigue,
        contactKm:race.sources.join.sourceKm,
        contactMetre:race.sources.join
          .contactAtDistanceM,
        soloMetres:race.sources.join
          .soloDistanceM,
        shelterMetres:race.sources.join
          .shelteredDistanceM,
        finishEnergy:race.kilometres.at(-1)
          .riderStates.find(row=>
            row.riderId===riderId).energyAfter,
        finishRiders:160});
    }
  process.stdout.write(JSON.stringify({results},
    null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-stage-release')){
  const results=[];
  for(const distanceKm of [120,260])
    for(const fatigue of [10,30]){
      const base=source(distanceKm,fatigue,
        'equal_field');
      const riderId='team-19-7';
      const plan=commitRearSoloPlanV1({
        riderId,distanceKm,stageNumber:1,
        stageCount:2,baseline:{goal:'finish_safely',
          effort:'steady'},phases:[{atKm:5,
          goal:'save_for_stage',effort:'conserve',
          committedStagePlan:{riderId,
            currentStageNumber:1,
            targetStageNumber:2,
            currentGoal:'finish_safely',
            futureGoal:'target_stage',
            reserveEnergy:20}}]});
      const startInput={...base.startInput,
        physicalDraftVersion:4,
        soloCommitments:[plan]};
      const input={startInput,
        start:startPhysicalBunchV1(startInput),
        riderId,releaseKm:6};
      const race=replayPhysicalCommittedStageReleaseFinishV1(
        input);
      assert.equal(validatePhysicalCommittedStageReleaseFinishV1(
        input,race),true);
      assert.equal(race.kilometres.length,distanceKm);
      assert.ok(race.kilometres.every(km=>
        km.riderStates.length===160&&
        km.riderStates.every(row=>
          row.decisions.length>0&&
          Number.isFinite(row.energyAfter))));
      assert.ok(race.sources.later.every(step=>
        step.gapSecondsToBunch>0&&
        step.bunch.riders.filter(row=>
          row.role==='leader').length===1&&
        step.solo.energyAfter>=20));
      assert.equal(Object.keys(race
        .observedFinishSecondsByRider).length,160);
      results.push({distanceKm,fatigue,
        releaseGapSeconds:race.sources.first
          .sources.release.gapSecondsToBunch,
        finishGapSeconds:race.sources.later
          .at(-1).gapSecondsToBunch,
        soloFinishEnergy:race.kilometres.at(-1)
          .riderStates.find(row=>
            row.riderId===riderId).energyAfter,
        finishRiders:160});
    }
  process.stdout.write(JSON.stringify({results},
    null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-single-leader-weak')){
  const draftVersion=process.argv.includes(
    '--classified')?4:3;
  const results=[120,260].map(distanceKm=>{
    const base=source(distanceKm,30,
      'one_weak_climber');
    const startInput={...base.startInput,
      physicalDraftVersion:draftVersion};
    const start=startPhysicalBunchV1(startInput);
    const staggered=runPhysicalStaggeredBunchLossV1({
      startInput,start,throughKm:distanceKm});
    const soloField=probePhysicalStaggeredSoloFieldV1({
      startInput,start,staggered,
      throughKm:distanceKm});
    const input={startInput,start,staggered,
      soloField,throughKm:distanceKm};
    const race=replayPhysicalStaggeredRearEventsV1(input);
    assert.equal(validatePhysicalStaggeredRearEventsV1(
      input,race),true);
    assert.ok(staggered.road.every(step=>
      step.riders.filter(row=>row.role===
        'leader').length===1&&
      step.physicalGroup.riderIds.every(id=>
        ['leader','sheltered'].includes(
          step.riders.find(row=>row.riderId===
            id)?.role))));
    assert.ok(race.kilometres.every(row=>
      row.riderStates.length===160&&
      row.riderStates.every(state=>
        state.decisions.length>0)));
    assert.equal(Object.keys(race
      .observedFinishSecondsByRider).length,160);
    const loss=staggered.losses[0];
    const lossDecision=staggered.road[
      loss.sourceKm-1].riderDecisions.find(row=>
      row.riderId===loss.riderId);
    if(draftVersion===4)
      assert.equal(lossDecision.reason,
        'cannot_hold_even_at_hard_effort');
    return {distanceKm,fatigue:30,
      draftVersion,lossReason:lossDecision.reason,
      losses:staggered.losses.length,
      contacts:race.contactCount,
      finishRiders:Object.keys(race
        .observedFinishSecondsByRider).length};
  });
  assert.ok(results.every(row=>
    row.losses===1&&row.contacts===0&&
    row.finishRiders===160));
  process.stdout.write(JSON.stringify({results},
    null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-single-leader')){
  const distanceKm=process.argv.includes(
    '--long')?260:120;
  const fatigue=process.argv.includes(
    '--fatigued')?30:10;
  const draftVersion=process.argv.includes(
    '--classified')?4:3;
  const baseline=source(distanceKm,fatigue,
    'varied_field');
  const baselineRoad=runPhysicalStaggeredBunchLossV1({
    ...baseline,throughKm:distanceKm});
  const baselineSolo=probePhysicalStaggeredSoloFieldV1({
    ...baseline,staggered:baselineRoad,
    throughKm:distanceKm});
  const startInput={...baseline.startInput,
    physicalDraftVersion:draftVersion};
  const start=startPhysicalBunchV1(startInput);
  const staggered=runPhysicalStaggeredBunchLossV1({
    startInput,start,throughKm:distanceKm});
  const soloField=probePhysicalStaggeredSoloFieldV1({
    startInput,start,staggered,throughKm:distanceKm});
  const input={startInput,start,staggered,
    soloField,throughKm:distanceKm};
  const splitCauses=staggered.road.flatMap(step=>
    step.splits.map(split=>step.riderDecisions
      .find(row=>row.riderId===split.riderId)
      ?.reason));
  const splitCauseCounts=Object.fromEntries(
    [...new Set(splitCauses)].map(reason=>[
      reason,splitCauses.filter(row=>row===reason)
        .length]));
  if(draftVersion===4){
    assert.equal(splitCauses.length,
      staggered.losses.length);
    assert.ok(splitCauses.every(reason=>
      ['team_effort_ceiling',
        'cannot_hold_even_at_hard_effort']
        .includes(reason)));
  }
  const countRole=(road,role)=>road.road.reduce(
    (sum,step)=>sum+step.riders.filter(row=>
      row.role===role).length,0);
  const baselinePaceMatches=countRole(
    baselineRoad,'pace_match');
  assert.ok(baselinePaceMatches>0);
  const firstLegacyMatch=baselineRoad.road.flatMap(step=>
    step.riders.filter(row=>row.role===
      'pace_match').map(row=>({
        km:step.sourceKm,row}))).at(0);
  const shelteredMatch=staggered.road[
    firstLegacyMatch.km-1].riders.find(row=>
    row.riderId===firstLegacyMatch.row.riderId);
  assert.equal(shelteredMatch.role,'sheltered');
  assert.ok(shelteredMatch.energySpent<
    firstLegacyMatch.row.energySpent);
  assert.equal(countRole(staggered,'pace_match'),0);
  assert.ok(staggered.road.every(step=>
    step.riders.filter(row=>row.role===
      'leader').length===1&&
    step.physicalGroup.riderIds.every(id=>
      ['leader','sheltered'].includes(
        step.riders.find(row=>row.riderId===
          id)?.role))));
  if(fatigue===30){
    assert.throws(()=>
      replayPhysicalStaggeredRearEventsV1(input),
    /distinct paid split ordering/);
    process.stdout.write(JSON.stringify({
      distanceKm,fatigue,draftVersion,
      baselinePaceMatches,
      candidatePaceMatches:countRole(staggered,
        'pace_match'),
      status:'refused_ambiguous_equal_split',
      losses:staggered.losses.length,
      splitCauseCounts},
    null,2)+'\n');
    process.exit(0);
  }
  const baselineRace=replayPhysicalStaggeredRearEventsV1({
    ...baseline,staggered:baselineRoad,
    soloField:baselineSolo,throughKm:distanceKm});
  const race=replayPhysicalStaggeredRearEventsV1(input);
  assert.equal(validatePhysicalStaggeredRearEventsV1(
    input,race),true);
  assert.ok(race.kilometres.every(row=>
    row.riderStates.length===160&&
    row.riderStates.every(state=>
      state.decisions.length>0)));
  assert.equal(Object.keys(race
    .observedFinishSecondsByRider).length,160);
  const baselineFinishEnergy=Object.fromEntries(
    baselineRace.kilometres.at(-1).riderStates.map(
      row=>[row.riderId,row.energyAfter]));
  const finishEnergyDeltas=race.kilometres.at(-1)
    .riderStates.map(row=>row.energyAfter-
      baselineFinishEnergy[row.riderId]);
  assert.ok(finishEnergyDeltas.every(
    Number.isFinite));
  assert.ok(finishEnergyDeltas.some(value=>
    value>1e-6));
  process.stdout.write(JSON.stringify({
    distanceKm,fatigue,draftVersion,
    baselinePaceMatches,
    firstShelteredMatch:{km:firstLegacyMatch.km,
      riderId:firstLegacyMatch.row.riderId,
      oldEnergySpent:firstLegacyMatch.row.energySpent,
      shelteredEnergySpent:
        shelteredMatch.energySpent},
    candidatePaceMatches:countRole(staggered,
      'pace_match'),
    splitCauseCounts,
    baselineContacts:baselineRace.contactCount,
    losses:staggered.losses.length,
    contacts:race.contactCount,
    baselineFinishSecondsRange:[
      Math.min(...Object.values(baselineRace
        .observedFinishSecondsByRider)),
      Math.max(...Object.values(baselineRace
        .observedFinishSecondsByRider))],
    candidateFinishSecondsRange:[
      Math.min(...Object.values(race
        .observedFinishSecondsByRider)),
      Math.max(...Object.values(race
        .observedFinishSecondsByRider))],
    baselineMinimumFinishEnergy:Math.min(...baselineRace
      .kilometres.at(-1).riderStates.map(row=>
        row.energyAfter)),
    candidateMinimumFinishEnergy:Math.min(...race
      .kilometres.at(-1).riderStates.map(row=>
        row.energyAfter)),
    finishEnergyIncreasedRiders:
      finishEnergyDeltas.filter(value=>
        value>1e-6).length,
    finishEnergyDecreasedRiders:
      finishEnergyDeltas.filter(value=>
        value< -1e-6).length,
    maximumFinishEnergyGain:
      Math.max(...finishEnergyDeltas),
    finishRiders:Object.keys(race
      .observedFinishSecondsByRider).length},
  null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-rear-captain')){
  const distanceKm=120;
  const baseline=source(distanceKm,10,
    'varied_field');
  const baselineStaggered=
    runPhysicalStaggeredBunchLossV1({
      ...baseline,throughKm:distanceKm});
  const baselineSolo=
    probePhysicalStaggeredSoloFieldV1({
      ...baseline,staggered:baselineStaggered,
      throughKm:distanceKm});
  const baselineRace=replayPhysicalStaggeredRearEventsV1({
    ...baseline,staggered:baselineStaggered,
    soloField:baselineSolo,throughKm:distanceKm});
  const input=source(distanceKm,10,
    'varied_captain');
  const staggered=runPhysicalStaggeredBunchLossV1({
    ...input,throughKm:distanceKm});
  const soloField=probePhysicalStaggeredSoloFieldV1({
    ...input,staggered,throughKm:distanceKm});
  const replayInput={...input,staggered,soloField,
    throughKm:distanceKm};
  const race=replayPhysicalStaggeredRearEventsV1(
    replayInput);
  assert.equal(validatePhysicalStaggeredRearEventsV1(
    replayInput,race),true);
  assert.ok(race.kilometres.every(row=>
    row.riderStates.length===160&&
    row.riderStates.every(state=>
      state.decisions.length>0)));
  const baselineFirst=baselineRace.contacts[0];
  const captainFirst=race.contacts[0];
  assert.equal(baselineFirst.outcome,'join');
  assert.equal(captainFirst.outcome,
    'pass_through');
  assert.deepEqual(captainFirst.riders,
    baselineFirst.riders);
  assert.equal(captainFirst.atDistanceM,
    baselineFirst.atDistanceM);
  assert.equal(captainFirst.clockSeconds,
    baselineFirst.clockSeconds);
  assert.equal(captainFirst.contactDecisions.find(
    row=>row.riderId==='team-4-3')?.choice,
  'pass_through');
  assert.ok(race.contacts.filter(row=>
    row.outcome==='pass_through').length>=3);
  assert.equal(race.kilometres[
    captainFirst.sourceKm-1]
    .riderStates.find(row=>row.riderId===
      'team-4-3').physicalGroupId,
  'solo-team-4-3');
  process.stdout.write(JSON.stringify({
    distanceKm,baselineFirstContact:
      baselineFirst.outcome,
    captainFirstContact:captainFirst.outcome,
    firstContactKm:captainFirst.sourceKm,
    firstContactAtDistanceM:
      captainFirst.atDistanceM,
    passThroughContacts:race.contacts.filter(row=>
      row.outcome==='pass_through').length,
    contactCount:race.contactCount,
    captainFinishGroupId:race.kilometres.at(-1)
      .riderStates.find(row=>row.riderId===
        'team-4-3').physicalGroupId,
    finishRiders:Object.keys(race
      .observedFinishSecondsByRider).length},
  null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-rear-ordered')){
  const results=[120,260].flatMap(distanceKm=>
    [10,30].map(fatigue=>{
      const base=source(distanceKm,fatigue,
        'varied_field');
      const startInput={...base.startInput,
        physicalDraftVersion:4,
        physicalRearIntentVersion:2};
      const start=startPhysicalBunchV1(startInput);
      try{
        const staggered=
          runPhysicalStaggeredBunchLossV1({
            startInput,start,throughKm:distanceKm});
        const soloField=
          probePhysicalStaggeredSoloFieldV1({
            startInput,start,staggered,
            throughKm:distanceKm});
        if(soloField.refusals.length){
          const riderId=soloField.refusals[0]
            .riderId;
          const contactInput={startInput,start,
            staggered,riderId,
            throughKm:distanceKm};
          const probe=
            probePhysicalOrderedSoloBunchContactV1(
              contactInput);
          assert.equal(
            validatePhysicalOrderedSoloBunchContactV1(
              contactInput,probe),true);
          assert.throws(()=>
            finishPhysicalOrderedSoloBunchJoinKmV1(
              contactInput),
          /isolated paid contact/);
          return {distanceKm,fatigue,
            status:'solo_source_refusal',
            reason:soloField.refusals[0],
            refusalCount:soloField.refusals.length,
            firstCandidateBunchCrossing:
              probe.contact?{
                riderId,
                sourceKm:probe.contact.sourceKm,
                atDistanceM:probe.contact.atDistanceM,
                clockSeconds:probe.contact.clockSeconds,
                soloEnergyAtContact:
                  probe.contact.soloEnergyAtContact,
                candidateOnly:probe.contact
                  .candidateOnly,
                otherRearRoadsUnsettled:
                  probe.contact
                    .otherRearRoadsUnsettled}:null};
        }
        const race=replayPhysicalStaggeredRearEventsV1({
          startInput,start,staggered,soloField,
          throughKm:distanceKm});
        return {distanceKm,fatigue,
          status:'full_replay',
          contacts:race.contactCount,
          riderKilometres:race.kilometres.reduce(
            (sum,row)=>sum+row.riderStates.length,0),
          finishRiders:Object.keys(race
            .observedFinishSecondsByRider).length};
      }catch(error){return {distanceKm,fatigue,
        status:'refusal',reason:error.message};}
    }));
  assert.ok(results.every(row=>
    row.status==='solo_source_refusal'&&
    row.reason.reason===
      'Staggered solo needs separate bunch contact.'&&
    row.refusalCount>0&&
    row.firstCandidateBunchCrossing
      ?.candidateOnly===true&&
    row.firstCandidateBunchCrossing
      ?.otherRearRoadsUnsettled===true));
  process.stdout.write(JSON.stringify({results},null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-rear-ordered-prefix')){
  const probeClearPrefix=(startInput,first,
    limitKm=80)=>{
    let prior={sourceKm:first.sourceKm,
      riderStates:first.riderStates,
      riderCount:first.riderCount,
      endBunchState:first.endBunchState,
      endRearEntities:first.endRearEntities};
    let paidRiderKm=0;
    for(let km=prior.sourceKm+1;
      km<=Math.min(limitKm,
        startInput.routeKilometres.length);km++){
      try{
        const boundary=
          sourcePhysicalOrderedRearBoundaryFromStateV1({
            startInput,prior});
        if(boundary.recording.firstEvent)
          return {lastFullKm:prior.sourceKm,
            firstUnresolvedKm:km,
            firstEvent:boundary.recording.firstEvent,
            paidRiderKm};
        const next=advancePhysicalOrderedRearClearKmV1({
          startInput,prior});
        assert.equal(next.sourceKm,km);
        assert.equal(next.riderCount,160);
        paidRiderKm+=next.riderCount;
        prior={sourceKm:next.sourceKm,
          riderStates:next.riderStates,
          riderCount:next.riderCount,
          endBunchState:next.endBunchState,
          endRearEntities:next.endRearEntities};
      }catch(error){return {
        lastFullKm:prior.sourceKm,
        firstUnresolvedKm:km,
        refusal:error.message,
        paidRiderKm};}
    }
    return {lastFullKm:prior.sourceKm,
      firstUnresolvedKm:null,
      paidRiderKm};
  };
  const advanceClearToKm=(startInput,first,
    throughKm)=>{
    let prior={sourceKm:first.sourceKm,
      riderStates:first.riderStates,
      riderCount:first.riderCount,
      endBunchState:first.endBunchState,
      endRearEntities:first.endRearEntities};
    while(prior.sourceKm<throughKm){
      const next=advancePhysicalOrderedRearClearKmV1({
        startInput,prior});
      assert.equal(next.sourceKm,
        prior.sourceKm+1);
      assert.equal(next.riderCount,160);
      prior={sourceKm:next.sourceKm,
        riderStates:next.riderStates,
        riderCount:next.riderCount,
        endBunchState:next.endBunchState,
        endRearEntities:next.endRearEntities};
    }
    return prior;
  };
  const probeMixedPrefix=(startInput,first,
    limitKm=startInput.routeKilometres.length)=>{
    let prior={sourceKm:first.sourceKm,
      riderStates:first.riderStates,
      riderCount:first.riderCount,
      endBunchState:first.endBunchState,
      endRearEntities:first.endRearEntities};
    const contactKilometres=[];
    const acceptNext=(next,km)=>{
      assert.equal(next.sourceKm,km);
      assert.equal(next.riderCount,160);
      assert.equal(next.riderStates.length,160);
      const previous=new Map(prior.riderStates
        .map(row=>[row.riderId,row]));
      assert.equal(previous.size,160);
      const ids=new Set();
      for(const row of next.riderStates){
        const before=previous.get(row.riderId);
        assert.ok(before&&!ids.has(row.riderId));
        ids.add(row.riderId);
        assert.equal(row.sourceKm,km);
        assert.equal(row.atDistanceM,km*1000);
        assert.ok(Number.isFinite(row.elapsedSeconds)&&
          row.elapsedSeconds>before.elapsedSeconds);
        assert.ok(Number.isFinite(row.energyAfter)&&
          row.energyAfter>=0);
        assert.ok(Array.isArray(row.decisions)&&
          row.decisions.length>0);
      }
    };
    for(let km=prior.sourceKm+1;
      km<=Math.min(limitKm,
        startInput.routeKilometres.length);km++){
      try{
        const bunch=advancePhysicalOrderedRearBunchFromStateV1({
          startInput,prior});
        if(bunch.step.attack)
          return {lastFullKm:prior.sourceKm,
            firstUnresolvedKm:km,
            refusal:'New bunch attack needs paid continuation.',
            contactKilometres};
        if(bunch.step.splits.length){
          const loss=
            sourcePhysicalOrderedRearLossBoundaryV1({
              startInput,prior});
          let next;
          try{next=advancePhysicalOrderedRearLossKmV1({
            startInput,prior});}
          catch(error){return {
            lastFullKm:prior.sourceKm,
            firstUnresolvedKm:km,
            refusal:error.message,
            newSplits:bunch.step.splits.map(row=>({
              riderId:row.riderId,
              atDistanceM:row.atDistanceM})),
            candidateEvents:
              findPhysicalOrderedBoundaryEventsV1(
                loss.tracks,loss.bunch,km)
                .map(row=>({
                  atDistanceM:row.atDistanceM,
                  roadIds:row.roadIds,
                  involvesBunch:
                    row.involvesBunch,
                  choice:row.involvesBunch?
                    null:decidePhysicalRearContactV1({
                      startInput,km,
                      roadIds:row.roadIds,
                      riderIdsByRoad:
                        row.riderIdsByRoad,
                      catchingRoadId:
                        row.catchingRoadId,
                      observedSecondsPerKmByRoad:
                        row.observedSecondsPerKmByRoad,
                      leaderRiderId:loss.tracks.find(
                        track=>track.id===
                          row.catchingRoadId)
                        ?.leaderRiderId})
                    .outcome})),
            contactKilometres};}
          if(loss.recording.firstEvent)
            assert.equal(
              validatePhysicalOrderedRearLossKmV1({
                startInput,prior},next),true);
          acceptNext(next,km);
          contactKilometres.push({sourceKm:km,
            newSplits:bunch.step.splits.map(row=>
              row.riderId),
            ...(loss.recording.firstEvent?{
              contact:next.sources.passage}:{}),
            bunchRiders:next.endBunchState
              .riderIds.length,
            rearRoads:next.endRearEntities.length});
          prior={sourceKm:next.sourceKm,
            riderStates:next.riderStates,
            riderCount:next.riderCount,
            endBunchState:next.endBunchState,
            endRearEntities:next.endRearEntities};
          continue;
        }
        const boundary=
          sourcePhysicalOrderedRearBoundaryFromStateV1({
            startInput,prior});
        const sequence=boundary.recording.firstEvent?
          inspectPhysicalOrderedRearEventSequenceV1({
            startInput,prior}):null;
        if(sequence?.firstUnsettledEvent||
          sequence?.contacts.some(row=>
            row.outcome!=='join'&&
            !(row.kind==='solo_bunch'&&
              row.outcome==='stay_solo')&&
            !(row.kind==='rear_rear'&&
              row.outcome==='pass_through')))
          return {lastFullKm:prior.sourceKm,
            firstUnresolvedKm:km,
            firstEvent:boundary.recording.firstEvent,
            firstUnsettledEvent:sequence
              .firstUnsettledEvent,
            firstUnsettledGroupAssessment:
              sequence.firstUnsettledGroupAssessment,
            contacts:sequence.contacts.map(row=>({
              kind:row.kind,outcome:row.outcome,
              atDistanceM:row.event.atDistanceM})),
            contactKilometres};
        const next=sequence?
          advancePhysicalOrderedRearEventKmV1({
            startInput,prior}):
          advancePhysicalOrderedRearClearKmV1({
            startInput,prior});
        if(sequence)
          assert.equal(
            validatePhysicalOrderedRearEventKmV1({
              startInput,prior},next),true);
        acceptNext(next,km);
        if(sequence)contactKilometres.push({
          sourceKm:km,
          contacts:sequence.contacts.map(row=>({
            kind:row.kind,outcome:row.outcome,
            atDistanceM:row.event.atDistanceM})),
          bunchRiders:next.endBunchState
            .riderIds.length,
          rearRoads:next.endRearEntities.length});
        prior={sourceKm:next.sourceKm,
          riderStates:next.riderStates,
          riderCount:next.riderCount,
          endBunchState:next.endBunchState,
          endRearEntities:next.endRearEntities};
      }catch(error){return {
        lastFullKm:prior.sourceKm,
        firstUnresolvedKm:km,
        refusal:error.message,
        contactKilometres};}
    }
    const atFinish=prior.sourceKm===
      startInput.routeKilometres.length;
    const sorted=atFinish?[...prior.riderStates]
      .sort((left,right)=>
        left.elapsedSeconds-
          right.elapsedSeconds):[];
    const firstClock=sorted[0]?.elapsedSeconds;
    return {lastFullKm:prior.sourceKm,
      firstUnresolvedKm:null,
      contactKilometres,
      ...(atFinish?{observedFinish:{
        riderCount:sorted.length,
        earliestRiderId:sorted[0].riderId,
        earliestSeconds:firstClock,
        medianGapSeconds:sorted[79]
          .elapsedSeconds-firstClock,
        latestGapSeconds:sorted.at(-1)
          .elapsedSeconds-firstClock,
        minimumEnergy:Math.min(...sorted
          .map(row=>row.energyAfter)),
        maximumEnergy:Math.max(...sorted
          .map(row=>row.energyAfter)),
        bunchRiders:prior.endBunchState
          .riderIds.length,
        rearRoads:prior.endRearEntities.length,
        officialResults:false}}:{})};
  };
  const post66Bunch=(startInput,km66Full,
    priorKm,verify)=>{
    if(!km66Full)return null;
    const prior=advanceClearToKm(startInput,
      km66Full,priorKm);
    const input={startInput,prior};
    const probe=
      probePhysicalOrderedRearContinuationBunchContactV1(
        input);
    if(verify)
      assert.equal(
        validatePhysicalOrderedRearContinuationBunchContactV1(
          input,probe),true);
    const contact=probe.contact;
    const canJoin=contact.canHold&&contact.payable&&
      contact.reserveOkay&&contact.shelterCheaper;
    const joined=canJoin?
      finishPhysicalOrderedRearContinuationBunchJoinV1(
        input):null;
    const {tracks,bunch}=canJoin?
      sourcePhysicalOrderedRearBoundaryFromStateV1(
        input):{tracks:[],bunch:null};
    const laterEvents=joined?
      findPhysicalOrderedBoundaryEventsV1(
        tracks.filter(track=>track.id!==
          `solo-${contact.riderId}`),
        bunch,probe.sourceKm):[];
    const rearContact=laterEvents[0]&&
      !laterEvents[0].involvesBunch?
      resolvePhysicalOrderedRearBunchThenRearContactV1(
        input):null;
    if(rearContact&&verify)
      assert.equal(
        validatePhysicalOrderedRearBunchThenRearContactV1(
          input,rearContact),true);
    const chain=rearContact?
      inspectPhysicalOrderedRearPostBunchChainV1(
        input):null;
    if(chain&&verify)
      assert.equal(
        validatePhysicalOrderedRearPostBunchChainV1(
          input,chain),true);
    const completedChain=chain&&
      !chain.firstUnsettledEvent&&
      chain.contacts.every(row=>
        row.choice.outcome==='join')?
      advancePhysicalOrderedRearPostBunchKmV1(
        input):null;
    if(completedChain&&verify)
      assert.equal(
        validatePhysicalOrderedRearPostBunchKmV1(
          input,completedChain),true);
    const full=joined&&!laterEvents.length?
      replayPhysicalOrderedRearContinuationBunchKmV1(
        input):null;
    const passed=!canJoin&&!contact.canHold?
      advancePhysicalOrderedRearBunchPassKmV1(
        input):null;
    if(full&&verify)
      assert.equal(
        validatePhysicalOrderedRearContinuationBunchKmV1(
          input,full),true);
    if(passed&&verify)
      assert.equal(
        validatePhysicalOrderedRearBunchPassKmV1(
          input,passed),true);
    const resolved=full??passed??completedChain;
    const laterClear=resolved?
      probeClearPrefix(startInput,resolved):null;
    const nextPrior=resolved&&laterClear
      ?.firstEvent?
      advanceClearToKm(startInput,resolved,
        laterClear.lastFullKm):null;
    const nextBoundary=nextPrior?
      sourcePhysicalOrderedRearBoundaryFromStateV1({
        startInput,prior:nextPrior}):null;
    const nextContact=nextBoundary?.recording
      .firstEvent?.involvesBunch?
      probePhysicalOrderedRearContinuationBunchContactV1({
        startInput,prior:nextPrior}):
      nextBoundary?.recording.firstEvent?
        resolvePhysicalOrderedRearContinuationContactV1({
          startInput,prior:nextPrior}):null;
    const nextSequence=nextPrior?
      inspectPhysicalOrderedRearEventSequenceV1({
        startInput,prior:nextPrior}):null;
    if(nextSequence&&verify)
      assert.equal(
        validatePhysicalOrderedRearEventSequenceV1({
          startInput,prior:nextPrior},
        nextSequence),true);
    const nextFull=nextSequence&&
      !nextSequence.firstUnsettledEvent&&
      nextSequence.contacts.every(row=>
        row.outcome==='join')?
      advancePhysicalOrderedRearEventKmV1({
        startInput,prior:nextPrior}):null;
    if(nextFull&&verify)
      assert.equal(
        validatePhysicalOrderedRearEventKmV1({
          startInput,prior:nextPrior},
        nextFull),true);
    return {sourceKm:probe.sourceKm,
      riderId:contact.riderId,
      atDistanceM:contact.atDistanceM,
      canHold:contact.canHold,
      payable:contact.payable,
      reserveOkay:contact.reserveOkay,
      shelterCheaper:contact.shelterCheaper,
      joinedBunchRiders:joined?.physicalGroup
        .riderIds.length??null,
      nextEvent:laterEvents[0]??null,
      rearContact:rearContact?{
        outcome:rearContact.choice.outcome,
        atDistanceM:rearContact.event
          .atDistanceM,
        leaderRiderId:rearContact
          .candidateGroupRoad?.leaderRiderId??
            null,
        nextEvent:rearContact
          .nextCandidateEvent??null}:null,
      rearChain:chain?{
        contacts:chain.contacts.map(row=>({
          atDistanceM:row.event.atDistanceM,
          outcome:row.choice.outcome,
          riderIds:row.event.riders.map(item=>
            item.riderId),
          leaderRiderId:row.groupRoad
            ?.leaderRiderId??null})),
        firstUnsettledEvent:chain
          .firstUnsettledEvent??null,
        endRoads:chain.endRoads.length}:null,
      fullRiders:(full??passed??completedChain)
        ?.riderCount??null,
      passDecision:passed?.contactDecision
        .choice??null,
      bunchRiders:(full??passed??completedChain)
        ?.endBunchState
        .riderIds.length??null,
      rearRoads:(full??passed??completedChain)
        ?.endRearEntities
        .length??null,
      laterClear,
      nextContact:nextContact?{
        sourceKm:nextContact.sourceKm,
        atDistanceM:(nextContact.contact??
          nextContact.event).atDistanceM,
        roadIds:(nextContact.contact??
          nextContact.event).roadIds,
        riderId:nextContact.contact
          ?.riderId??null,
        choice:nextContact.choice?.outcome??
          null,
        canHold:nextContact.contact
          ?.canHold??null,
        leaderRiderId:nextContact
          .candidateGroupRoad
          ?.leaderRiderId??null,
        nextCandidateEvent:nextContact
          .nextCandidateEvent??null}:null,
      nextSequence:nextSequence?{
        sourceKm:nextSequence.sourceKm,
        contacts:nextSequence.contacts
          .map(row=>({
            atDistanceM:row.event.atDistanceM,
            kind:row.kind,
            outcome:row.outcome,
            roadIds:row.event.roadIds,
            leaderRiderId:row.groupRoad
              ?.leaderRiderId??null})),
        bunchRiders:nextSequence
          .endBunchRiderIds.length,
        rearRoads:nextSequence.endRoads
          .length,
        firstUnsettledEvent:nextSequence
          .firstUnsettledEvent??null}:null,
      nextFullRiders:nextFull?.riderCount??
        null,
      nextBunchRiders:nextFull
        ?.endBunchState.riderIds.length??null,
      nextRearRoads:nextFull
        ?.endRearEntities.length??null,
      afterNextClear:nextFull?
        probeClearPrefix(startInput,
          nextFull):null,
      afterNextMixed:nextFull?
        probeMixedPrefix(startInput,
          nextFull):null};
  };
  const selectedCase=process.argv.find(arg=>
    arg.startsWith('--probe-rear-ordered-case='))
    ?.split('=')[1]??null;
  const [selectedDistance,selectedFatigue,
    selectedVariant='varied_field']=
    selectedCase?.split(':')??[];
  const roleMatrix=process.argv.includes(
    '--probe-rear-ordered-role-matrix');
  const terrainMatrix=process.argv.includes(
    '--probe-rear-ordered-terrain-matrix');
  if(roleMatrix||terrainMatrix||selectedCase&&
    ['varied_captain',
      'harder_late_climbs'].includes(
        selectedVariant)){
    const variant=terrainMatrix?
      'harder_late_climbs':selectedVariant;
    const probeRoleCase=(distanceKm,fatigue,
      scenarioVariant)=>{
    const base=source(distanceKm,fatigue,
      'varied_captain');
    const startInput={...base.startInput,
      routeKilometres:scenarioVariant===
        'harder_late_climbs'?
        base.startInput.routeKilometres
          .map(segment=>segment.km>40&&
            segment.terrain==='climb'?{
              ...segment,gradientPct:8}:
            segment):
        base.startInput.routeKilometres,
      physicalDraftVersion:4,
      physicalRearIntentVersion:2};
    const start=startPhysicalBunchV1(startInput);
    const throughKm=31;
    const staggered=runPhysicalStaggeredBunchLossV1({
      startInput,start,throughKm});
    const soloField=probePhysicalStaggeredSoloFieldV1({
      startInput,start,staggered,throughKm});
    assert.equal(soloField.refusals.length,0);
    const end=inspectPhysicalRearEventEndStateV1({
      startInput,start,staggered,soloField,
      throughKm});
    const riderStates=end.source.kilometres
      .at(-1).riderStates;
    const step=staggered.road.at(-1);
    const prior={sourceKm:throughKm,
      riderStates,riderCount:riderStates.length,
      endBunchState:{
        riderIds:[...step.physicalGroup.riderIds],
        energyByRider:step.energyByRider,
        quietKmByRider:step.quietKmByRider},
      endRearEntities:end.endEntities};
    const mixed=probeMixedPrefix(startInput,prior);
    return {
      distanceKm,fatigue,
      variant:scenarioVariant,
      firstPaidKm:throughKm,
      mixed};
    };
    const cases=roleMatrix||terrainMatrix?
      [120,260].flatMap(distanceKm=>
        [10,30].map(fatigue=>[
          distanceKm,fatigue])):
      [[Number(selectedDistance),
        Number(selectedFatigue)]];
    const results=cases.map(([distanceKm,
      fatigue])=>probeRoleCase(distanceKm,
      fatigue,variant));
    if(roleMatrix||terrainMatrix)
      assert.ok(results.every(row=>
        row.mixed.lastFullKm===
          row.distanceKm&&
        row.mixed.firstUnresolvedKm===null&&
        row.mixed.observedFinish
          ?.riderCount===160&&
        row.mixed.contactKilometres.some(item=>
          item.contacts?.some(contact=>
            contact.outcome===
              'pass_through'))));
    const baseline=terrainMatrix?
      cases.map(([distanceKm,fatigue])=>
        probeRoleCase(distanceKm,fatigue,
          'varied_captain')):null;
    if(baseline)
      assert.ok(results.every((row,index)=>{
        const base=baseline[index];
        return base.mixed.lastFullKm===
          base.distanceKm&&
          base.mixed.observedFinish
            ?.riderCount===160&&
          row.mixed.observedFinish
            .earliestSeconds>
            base.mixed.observedFinish
              .earliestSeconds&&
          row.mixed.observedFinish
            .minimumEnergy<
            base.mixed.observedFinish
              .minimumEnergy;
      }));
    process.stdout.write(JSON.stringify({results},
      null,2)+'\n');
    process.exit(0);
  }
  const results=[120,260]
    .filter(distanceKm=>!selectedCase||
      selectedDistance===String(distanceKm))
    .flatMap(distanceKm=>
    [10,30].filter(fatigue=>!selectedCase||
      selectedFatigue===String(fatigue))
      .map(fatigue=>{
      const base=source(distanceKm,fatigue,
        selectedVariant);
      const startInput={...base.startInput,
        physicalDraftVersion:4,
        physicalRearIntentVersion:2};
      const start=startPhysicalBunchV1(startInput);
      let lastPaid=null;
      for(let throughKm=30;throughKm<=40;throughKm++){
        try{
          const staggered=
            runPhysicalStaggeredBunchLossV1({
              startInput,start,throughKm});
          const soloField=
            probePhysicalStaggeredSoloFieldV1({
              startInput,start,staggered,
              throughKm});
          if(soloField.refusals.length){
            const boundaryInput={startInput,start,
              throughKm};
            const boundary=
              inspectPhysicalOrderedRearBoundaryV1(
                boundaryInput);
            assert.equal(
              validatePhysicalOrderedRearBoundaryV1(
                boundaryInput,boundary),true);
            const firstContact=boundary.firstEvent?
              resolvePhysicalOrderedRearFirstContactV1(
                boundaryInput):null;
            if(firstContact){
              assert.equal(
                validatePhysicalOrderedRearFirstContactV1(
                  boundaryInput,firstContact),true);
              assert.equal(firstContact.contact
                .outcome,'join');
            }
            const groupBunch=firstContact
              ?.nextCandidateEvent?.involvesBunch?
                probePhysicalOrderedRearBunchContactV1(
                  boundaryInput):null;
            if(groupBunch)
              assert.equal(
                validatePhysicalOrderedRearBunchContactV1(
                  boundaryInput,groupBunch),true);
            const joined=groupBunch?
              finishPhysicalOrderedRearBunchJoinKmV1(
                boundaryInput):null;
            if(joined){
              assert.equal(
                validatePhysicalOrderedRearBunchJoinKmV1(
                  boundaryInput,joined),true);
              if(distanceKm===120&&fatigue===10){
                const forged=structuredClone(joined);
                forged.groupDecisions[0]
                  .energyAfter+=1;
                assert.throws(()=>
                  validatePhysicalOrderedRearBunchJoinKmV1(
                    boundaryInput,forged),
                /differs from paid source/);
              }
            }
            const remainingEvents=joined?(()=>{
              const {tracks,bunch}=
                sourcePhysicalOrderedRearBoundaryRoadsV1(
                  boundaryInput);
              const remaining=tracks.filter(track=>
                !firstContact.contact.roadIds
                  .includes(track.id));
              return findPhysicalOrderedBoundaryEventsV1(
                remaining,bunch,throughKm);
            })():null;
            const fullKm=joined?
              replayPhysicalOrderedRearKmV1(
                boundaryInput):null;
            if(fullKm){
              assert.equal(
                validatePhysicalOrderedRearKmV1(
                  boundaryInput,fullKm),true);
              assert.equal(fullKm.endBunchState
                .riderIds.length,133);
              assert.equal(fullKm.endRearEntities
                .length,24);
              assert.equal(fullKm.endRearEntities
                .reduce((count,entity)=>
                  count+entity.riderIds.length,0),27);
              assert.ok(fullKm.endRearEntities
                .every(entity=>
                  entity.atDistanceM===
                    throughKm*1000&&
                  entity.riderIds.every(id=>
                    Number.isFinite(
                      entity.energyByRider[id]))&&
                  (entity.kind==='solo'||
                    Number.isInteger(
                      entity.rotationIndex))));
            }
            const nextBunch=fullKm?
              replayPhysicalOrderedRearNextBunchKmV1(
                boundaryInput):null;
            if(nextBunch){
              assert.equal(
                validatePhysicalOrderedRearNextBunchKmV1(
                  boundaryInput,nextBunch),true);
              assert.equal(nextBunch.sourceKm,
                throughKm+1);
              assert.equal(nextBunch.step.riders.length,
                133);
            }
            const nextBoundary=nextBunch?
              inspectPhysicalOrderedRearNextBoundaryV1(
                boundaryInput):null;
            if(nextBoundary)
              assert.equal(
                validatePhysicalOrderedRearNextBoundaryV1(
                  boundaryInput,nextBoundary),true);
            const nextKm=nextBoundary&&
              !nextBoundary.firstEvent?
              replayPhysicalOrderedRearNextKmV1(
                boundaryInput):null;
            if(nextKm){
              assert.equal(
                validatePhysicalOrderedRearNextKmV1(
                  boundaryInput,nextKm),true);
              assert.equal(nextKm.riderCount,160);
              assert.equal(nextKm.endRearEntities
                .length,24);
            }
            const laterClear=nextKm?
              probeClearPrefix(startInput,nextKm):null;
            const km47=nextKm?
              replayPhysicalOrderedRearContinuationBunchKmV1({
                startInput,
                prior:advanceClearToKm(startInput,
                  nextKm,46)}):null;
            if(km47){
              assert.equal(km47.sourceKm,47);
              assert.equal(km47.riderCount,160);
            }
            const post47Clear=km47?
              probeClearPrefix(startInput,km47):null;
            const paid65=km47?
              advanceClearToKm(startInput,
                km47,65):null;
            const km66Source=paid65?
              advancePhysicalOrderedRearBunchFromStateV1({
                startInput,prior:paid65}):null;
            const km66Losses=paid65?
              completePhysicalOrderedRearLossesKmV1({
                startInput,prior:paid65}):null;
            const km66Boundary=paid65?
              inspectPhysicalOrderedRearLossBoundaryV1({
                startInput,prior:paid65}):null;
            const km66Full=km66Boundary&&
              !km66Boundary.firstEvent?
              advancePhysicalOrderedRearLossKmV1({
                startInput,prior:paid65}):null;
            if(km66Losses&&distanceKm===120)
              assert.equal(
                validatePhysicalOrderedRearLossesKmV1({
                  startInput,prior:paid65},
                km66Losses),true);
            if(km66Boundary&&distanceKm===120)
              assert.equal(
                validatePhysicalOrderedRearLossBoundaryV1({
                  startInput,prior:paid65},
                km66Boundary),true);
            if(km66Full&&distanceKm===120)
              assert.equal(
                validatePhysicalOrderedRearLossKmV1({
                  startInput,prior:paid65},
                km66Full),true);
            const crossingCandidates=soloField.refusals
              .map(refusal=>{
                const input={startInput,start,staggered,
                  riderId:refusal.riderId,
                  throughKm};
                const probe=
                  probePhysicalOrderedSoloBunchContactV1(
                    input);
                assert.equal(
                  validatePhysicalOrderedSoloBunchContactV1(
                    input,probe),true);
                return {riderId:refusal.riderId,
                  contact:probe.contact};
              }).filter(row=>row.contact)
              .sort((a,b)=>a.contact.clockSeconds-
                b.contact.clockSeconds);
            return {distanceKm,fatigue,
              lastPaid,firstRefusedKm:throughKm,
              source:'independent_solo',
              refusalCount:soloField.refusals.length,
              firstOrderedEvent:boundary.firstEvent,
              firstContactGroup:firstContact?.contact
                .physicalGroup??null,
              firstContactLeader:
                firstContact?.candidateGroupRoad
                  ?.leaderRiderId??null,
              nextCandidateEvent:
                firstContact?.nextCandidateEvent??
                  null,
              groupBunchRiders:groupBunch
                ?.contact.groupRiders.map(row=>({
                  riderId:row.riderId,
                  canHold:row.canHold,
                  payable:row.payable,
                  reserveOkay:row.reserveOkay,
                  shelterCheaper:
                    row.shelterCheaper,
                  energyAtContact:
                    row.energyAtContact}))??null,
              joinedBunchRiders:joined
                ?.physicalGroup.riderIds.length??
                  null,
              joinedRiderStates:joined
                ?.riderStates.length??null,
              joinedFieldIncomplete:joined
                ?.fieldKilometreIncomplete??null,
              remainingRearRoads:joined?
                boundary.activeRoads.length-2:
                null,
              remainingCandidateEvents:
                remainingEvents?.length??null,
              fullKmRiders:fullKm
                ?.riderCount??null,
              fullKmGroups:fullKm
                ?.physicalGroups.length??null,
              nextBunchRiders:nextBunch
                ?.step.riders.length??null,
              nextBunchSplits:nextBunch
                ?.step.splits.length??null,
              nextBoundaryRoads:nextBoundary
                ?.rearRoads.length??null,
              nextBoundaryFirstEvent:
                nextBoundary?.firstEvent??null,
              nextKmRiders:nextKm?.riderCount??null,
              laterClear,
              km47BunchRiders:km47
                ?.endBunchState.riderIds.length??
                  null,
              km47RearRoads:km47
                ?.endRearEntities.length??null,
              post47Clear,
              km66Splits:km66Source
                ?.step.splits.map(split=>({
                  riderId:split.riderId,
                  atDistanceM:split.atDistanceM}))??
                    null,
              km66Completions:km66Losses
                ?.completions.length??null,
              km66FirstEvent:km66Boundary
                ?.firstEvent??null,
              km66EventCount:km66Boundary
                ?.candidateEventCount??null,
              km66FullRiders:km66Full
                ?.riderCount??null,
              after66Clear:km66Full?
                probeClearPrefix(startInput,
                  km66Full):null,
              post66Bunch:post66Bunch(startInput,
                km66Full,70,
                distanceKm===120),
              candidateBunchClockDifference:
                boundary.candidateBunchClockDifference,
              independentCrossingPreemptedByRearJoin:
                boundary
                  .independentCrossingPreemptedByRearJoin,
              crossingRiderActualRoadId:
                boundary.crossingRiderActualRoadId,
              candidateEventCount:
                boundary.candidateEventCount,
              activeRoads:boundary.activeRoads
                .length,
              firstCrossings:crossingCandidates
                .slice(0,3).map(row=>({
                  riderId:row.riderId,
                  atDistanceM:row.contact.atDistanceM,
                  clockSeconds:row.contact.clockSeconds,
                  candidateOnly:row.contact.candidateOnly,
                  otherRearRoadsUnsettled:
                    row.contact.otherRearRoadsUnsettled}))};
          }
          const input={startInput,start,staggered,
            soloField,throughKm};
          const race=replayPhysicalStaggeredRearEventsV1(
            input);
          assert.equal(
            validatePhysicalStaggeredRearEventsV1(
              input,race),true);
          const endState=
            inspectPhysicalRearEventEndStateV1(
              input);
          assert.deepEqual(endState.source,race);
          assert.equal(
            validatePhysicalRearEventEndStateV1(
              input,endState),true);
          const endRiderIds=endState.endEntities
            .flatMap(entity=>entity.riderIds);
          assert.equal(endRiderIds.length,
            staggered.detachedRiderIds.length);
          assert.equal(new Set(endRiderIds).size,
            endRiderIds.length);
          lastPaid={sourceKm:throughKm,
            contactCount:race.contactCount,
            riderStates:race.kilometres.at(-1)
              .riderStates.length,
            rearEntities:endState.endEntities
              .length,
            rearGroups:endState.endEntities
              .filter(entity=>entity.kind===
                'group').length};
          if(fatigue===30&&throughKm===32){
            const bunchStep=staggered.road.at(-1);
            const normalized={sourceKm:throughKm,
              riderStates:race.kilometres.at(-1)
                .riderStates,
              riderCount:lastPaid.riderStates,
              endRearEntities:endState.endEntities,
              endBunchState:{
                riderIds:bunchStep.physicalGroup
                  .riderIds,
                energyByRider:bunchStep
                  .energyByRider,
                quietKmByRider:bunchStep
                  .quietKmByRider}};
            const next=
              sourcePhysicalOrderedRearBoundaryFromStateV1({
                startInput,prior:normalized});
            if(distanceKm===120){
              const forged=structuredClone(normalized);
              forged.riderStates.find(row=>
                row.physicalGroupId==='peloton')
                .energyAfter+=1;
              assert.throws(()=>
                sourcePhysicalOrderedRearBoundaryFromStateV1({
                  startInput,prior:forged}),
              /lacks paid clock/);
            }
            lastPaid.nextBoundaryFirstEvent=
              next.recording.firstEvent;
            lastPaid.nextBoundaryRoads=
              next.recording.rearRoads.length;
            lastPaid.nextBunchSplits=
              next.next.step.splits.length;
            if(!next.recording.firstEvent){
              const paid=
                advancePhysicalOrderedRearClearKmV1({
                  startInput,prior:normalized});
              assert.equal(paid.sourceKm,33);
              assert.equal(paid.riderCount,160);
              assert.equal(paid.endRearEntities
                .length,24);
              lastPaid.nextKmRiders=paid.riderCount;
              lastPaid.laterClear=
                probeClearPrefix(startInput,paid);
              const paidState={
                sourceKm:paid.sourceKm,
                riderStates:paid.riderStates,
                riderCount:paid.riderCount,
                endBunchState:paid.endBunchState,
                endRearEntities:paid.endRearEntities};
              const contact=
                resolvePhysicalOrderedRearContinuationContactV1({
                  startInput,prior:paidState});
              if(distanceKm===120)
                assert.equal(
                  validatePhysicalOrderedRearContinuationContactV1({
                    startInput,prior:paidState},
                  contact),true);
              const contactKm=
                replayPhysicalOrderedRearContinuationKmV1({
                  startInput,prior:paidState});
              if(distanceKm===120)
                assert.equal(
                  validatePhysicalOrderedRearContinuationKmV1({
                    startInput,prior:paidState},
                  contactKm),true);
              assert.equal(contactKm.riderCount,160);
              assert.equal(contactKm.sourceKm,34);
              assert.equal(contactKm.endRearEntities
                .length,23);
              lastPaid.km34Contact={
                atDistanceM:contact.event.atDistanceM,
                outcome:contact.choice.outcome,
                groupRiders:contact.physicalGroup
                  ?.riderIds.length??null,
                leaderRiderId:contact.candidateGroupRoad
                  ?.leaderRiderId??null,
                nextCandidateEvent:
                  contact.nextCandidateEvent??null,
                fullRiders:contactKm.riderCount,
                rearRoads:contactKm
                  .endRearEntities.length};
              lastPaid.afterContactClear=
                probeClearPrefix(startInput,
                  contactKm);
              const paid35=
                advancePhysicalOrderedRearClearKmV1({
                  startInput,prior:contactKm});
              assert.equal(paid35.sourceKm,35);
              assert.equal(paid35.riderCount,160);
              const bunchContactInput={startInput,
                prior:paid35};
              const bunchContact=
                probePhysicalOrderedRearContinuationBunchContactV1(
                  bunchContactInput);
              if(distanceKm===120)
                assert.equal(
                  validatePhysicalOrderedRearContinuationBunchContactV1(
                    bunchContactInput,
                    bunchContact),true);
              const bunchJoin=
                finishPhysicalOrderedRearContinuationBunchJoinV1(
                  bunchContactInput);
              if(distanceKm===120)
                assert.equal(
                  validatePhysicalOrderedRearContinuationBunchJoinV1(
                    bunchContactInput,
                    bunchJoin),true);
              if(distanceKm===120){
                const forged=structuredClone(bunchJoin);
                forged.joinDecision.energyAfter+=1;
                assert.throws(()=>
                  validatePhysicalOrderedRearContinuationBunchJoinV1(
                    bunchContactInput,
                    forged),
                /differs from paid source/);
              }
              const bunchKm=
                replayPhysicalOrderedRearContinuationBunchKmV1(
                  bunchContactInput);
              if(distanceKm===120)
                assert.equal(
                  validatePhysicalOrderedRearContinuationBunchKmV1(
                    bunchContactInput,bunchKm),true);
              assert.equal(bunchKm.sourceKm,36);
              assert.equal(bunchKm.riderCount,160);
              assert.equal(bunchKm.endBunchState
                .riderIds.length,134);
              assert.equal(bunchKm.endRearEntities
                .length,22);
              lastPaid.afterBunchClear=
                probeClearPrefix(startInput,bunchKm);
              const paid65=
                advanceClearToKm(startInput,
                  bunchKm,65);
              const km66Source=
                advancePhysicalOrderedRearBunchFromStateV1({
                  startInput,prior:paid65});
              const km66Losses=
                completePhysicalOrderedRearLossesKmV1({
                  startInput,prior:paid65});
              const km66Boundary=
                inspectPhysicalOrderedRearLossBoundaryV1({
                  startInput,prior:paid65});
              const km66Full=
                km66Boundary.firstEvent?null:
                  advancePhysicalOrderedRearLossKmV1({
                    startInput,prior:paid65});
              if(distanceKm===120)
                assert.equal(
                  validatePhysicalOrderedRearLossesKmV1({
                    startInput,prior:paid65},
                  km66Losses),true);
              if(distanceKm===120)
                assert.equal(
                  validatePhysicalOrderedRearLossBoundaryV1({
                    startInput,prior:paid65},
                  km66Boundary),true);
              if(km66Full&&distanceKm===120)
                assert.equal(
                  validatePhysicalOrderedRearLossKmV1({
                    startInput,prior:paid65},
                  km66Full),true);
              lastPaid.km66Splits=
                km66Source.step.splits.map(split=>({
                  riderId:split.riderId,
                  atDistanceM:split.atDistanceM}));
              lastPaid.km66Completions=
                km66Losses.completions.length;
              lastPaid.km66FirstEvent=
                km66Boundary.firstEvent;
              lastPaid.km66EventCount=
                km66Boundary.candidateEventCount;
              lastPaid.km66FullRiders=
                km66Full?.riderCount??null;
              lastPaid.after66Clear=km66Full?
                probeClearPrefix(startInput,
                  km66Full):null;
              lastPaid.post66Bunch=
                post66Bunch(startInput,
                  km66Full,68,
                  distanceKm===120);
              lastPaid.km36BunchContact={
                atDistanceM:bunchContact.contact
                  .atDistanceM,
                riderId:bunchContact.contact
                  .riderId,
                canHold:bunchContact.contact
                  .canHold,
                payable:bunchContact.contact
                  .payable,
                reserveOkay:bunchContact.contact
                  .reserveOkay,
                shelterCheaper:bunchContact.contact
                  .shelterCheaper,
                joinedBunchRiders:bunchJoin
                  .physicalGroup.riderIds.length,
                joinEnergyAfter:bunchJoin
                  .joinDecision.energyAfter,
                fullRiders:bunchKm.riderCount,
                rearRoads:bunchKm
                  .endRearEntities.length};
            }
          }
        }catch(error){return {distanceKm,fatigue,
          lastPaid,firstRefusedKm:throughKm,
          source:'event_ordering',
          refusal:error.message};}
      }
      return {distanceKm,fatigue,lastPaid,
        firstRefusedKm:null};
    }));
  if(selectedCase){
    assert.equal(results.length,1);
    process.stdout.write(JSON.stringify({results},
      null,2)+'\n');
    process.exit(0);
  }
  assert.ok(results.every(row=>
    row.lastPaid?.riderStates===160&&
    row.lastPaid.contactCount===3&&
    row.lastPaid.rearEntities>0&&
    (row.fatigue!==30||
      row.lastPaid.nextKmRiders===160&&
      row.lastPaid.km34Contact
        ?.atDistanceM===33173.656142&&
      row.lastPaid.km34Contact
        .fullRiders===160&&
      row.lastPaid.km34Contact
        .rearRoads===23)&&
    (row.fatigue!==30||
      row.lastPaid.km36BunchContact
        ?.fullRiders===160&&
      row.lastPaid.km36BunchContact
        .rearRoads===22&&
      row.lastPaid.afterBunchClear
        ?.lastFullKm>=40)&&
    (row.fatigue!==10||
      row.km66Splits?.length===13&&
      row.km66Completions===13&&
      row.km66EventCount===0&&
      row.km66FullRiders===160&&
      row.after66Clear?.lastFullKm===70&&
      row.after66Clear?.firstEvent
        ?.roadIds[0]==='solo-team-9-2'&&
      row.post66Bunch?.joinedBunchRiders===122&&
      row.post66Bunch?.nextEvent
        ?.roadIds.join('|')===
          'solo-team-1-1|solo-team-13-5'&&
      row.post66Bunch?.rearContact
        ?.outcome==='join'&&
      row.post66Bunch?.rearContact
        ?.leaderRiderId==='team-1-1'&&
      row.post66Bunch?.rearContact
        ?.nextEvent?.atDistanceM===
          70810.44904&&
      row.post66Bunch?.fullRiders===160&&
      row.post66Bunch?.bunchRiders===122&&
      row.post66Bunch?.rearRoads===33&&
      row.post66Bunch?.laterClear
        ?.firstUnresolvedKm===72&&
      row.post66Bunch?.laterClear
        ?.firstEvent?.roadIds[0]===
          'solo-team-13-0'&&
      row.post66Bunch?.nextContact
        ?.riderId==='team-13-0'&&
      row.post66Bunch?.nextContact
        ?.canHold===true&&
      row.post66Bunch?.nextFullRiders===160&&
      row.post66Bunch?.nextBunchRiders===124&&
      row.post66Bunch?.nextRearRoads===30&&
      row.post66Bunch?.afterNextClear
        ?.firstUnresolvedKm===73&&
      row.post66Bunch?.afterNextClear
        ?.firstEvent?.atDistanceM===
          72324.017632&&
      row.post66Bunch?.afterNextMixed
        ?.lastFullKm===row.distanceKm&&
      row.post66Bunch?.afterNextMixed
        ?.firstUnresolvedKm===null&&
      row.post66Bunch?.afterNextMixed
        ?.observedFinish
          ?.riderCount===160&&
      row.post47Clear?.lastFullKm===65)&&
    (row.fatigue!==30||
      row.lastPaid.km66Splits
        ?.length===11&&
      row.lastPaid.km66Completions===11&&
      row.lastPaid.km66EventCount===0&&
      row.lastPaid.km66FullRiders===160&&
      row.lastPaid.after66Clear
        ?.lastFullKm===68&&
      row.lastPaid.after66Clear
        ?.firstEvent?.roadIds[0]===
          'solo-team-1-5'&&
      row.lastPaid.post66Bunch
        ?.riderId==='team-1-5'&&
      row.lastPaid.post66Bunch
        ?.canHold===false&&
      row.lastPaid.post66Bunch
        ?.fullRiders===160&&
      row.lastPaid.post66Bunch
        ?.passDecision===
          'stay_solo_after_bunch_contact'&&
      row.lastPaid.post66Bunch
        ?.bunchRiders===123&&
      row.lastPaid.post66Bunch
        ?.rearRoads===33&&
      row.lastPaid.post66Bunch
        ?.laterClear?.firstUnresolvedKm===71&&
      row.lastPaid.post66Bunch
        ?.laterClear?.firstEvent
          ?.roadIds.join('|')===
            'solo-team-1-1|solo-team-2-2'&&
      row.lastPaid.post66Bunch
        ?.nextContact?.choice==='join'&&
      row.lastPaid.post66Bunch
        ?.nextContact?.leaderRiderId===
          'team-1-1'&&
      row.lastPaid.post66Bunch
        ?.nextContact
          ?.nextCandidateEvent
          ?.atDistanceM===70318.555781&&
      row.lastPaid.post66Bunch
        ?.nextSequence?.contacts.length===5&&
      row.lastPaid.post66Bunch
        ?.nextSequence?.contacts.at(-1)
          ?.kind==='group_bunch'&&
      row.lastPaid.post66Bunch
        ?.nextSequence?.contacts.at(-1)
          ?.atDistanceM===70905.641841&&
      row.lastPaid.post66Bunch
        ?.nextFullRiders===160&&
      row.lastPaid.post66Bunch
        ?.nextBunchRiders===128&&
      row.lastPaid.post66Bunch
        ?.nextRearRoads===28&&
      row.lastPaid.post66Bunch
        ?.afterNextMixed
          ?.lastFullKm===row.distanceKm&&
      row.lastPaid.post66Bunch
        ?.afterNextMixed
          ?.firstUnresolvedKm===null&&
      row.lastPaid.post66Bunch
        ?.afterNextMixed
          ?.observedFinish
            ?.riderCount===160&&
      row.lastPaid.post66Bunch
        ?.afterNextMixed
          ?.contactKilometres
            ?.some(item=>item.sourceKm===106&&
              item.newSplits?.length===5&&
              item.contact?.choice===
                'stay_solo_after_bunch_contact')&&
      row.lastPaid.post66Bunch
        ?.afterNextMixed
          ?.contactKilometres
            ?.some(item=>item.sourceKm===106&&
              item.contact?.atDistanceM===
                105129.865902)&&
      row.lastPaid.afterBunchClear
        ?.lastFullKm===65)&&
    row.firstRefusedKm===
      (row.fatigue===10?32:33)&&
    row.refusalCount===1&&
    row.firstCrossings?.length===1&&
    row.firstCrossings[0].candidateOnly===true&&
    row.firstCrossings[0]
      .otherRearRoadsUnsettled===true));
  assert.ok(results.every(row=>row.fatigue===10?
    row.firstOrderedEvent?.roadIds.join('|')===
      'solo-team-11-2|solo-team-18-0'&&
    row.firstOrderedEvent.clockSeconds<
      row.firstCrossings[0].clockSeconds&&
    row.firstContactGroup?.riderIds.length===2&&
    row.firstContactLeader==='team-18-0'&&
    row.nextCandidateEvent?.involvesBunch===
      true&&
    row.nextCandidateEvent?.roadIds[0]===
      'rear-event-team-11-2-team-18-0'&&
    row.nextCandidateEvent.atDistanceM>
      row.firstCrossings[0].atDistanceM&&
    row.groupBunchRiders?.length===2&&
    row.groupBunchRiders.every(rider=>
      rider.canHold&&rider.payable&&
      rider.reserveOkay&&
      rider.shelterCheaper)&&
    row.joinedBunchRiders===133&&
    row.joinedRiderStates===133&&
    row.joinedFieldIncomplete===true&&
    row.remainingRearRoads===24&&
    row.remainingCandidateEvents===0&&
    row.fullKmRiders===160&&
    row.fullKmGroups===25&&
    row.nextBunchRiders===133&&
    row.nextKmRiders===160&&
    row.laterClear?.lastFullKm>=40&&
    row.km47BunchRiders===134&&
    row.km47RearRoads===23&&
    row.independentCrossingPreemptedByRearJoin===
      false:
    row.firstOrderedEvent===null&&
    row.firstContactGroup===null&&
    row.lastPaid.afterContactClear
      ?.lastFullKm===35&&
    row.lastPaid.afterContactClear
      ?.firstEvent?.roadIds.join('|')===
        'solo-team-10-3|peloton'&&
    row.independentCrossingPreemptedByRearJoin===
      true&&
    row.crossingRiderActualRoadId.startsWith(
      'rear-event-')));
  process.stdout.write(JSON.stringify({results},null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-rear-extreme')||
  process.argv.includes('--probe-rear-extreme-260')){
  const distanceKm=process.argv.includes(
    '--probe-rear-extreme-260')?260:120;
  const results=['one_weak_climber',
    'unequal_descent_catch'].flatMap(variant=>
    [10,30].map(fatigue=>{
      const input=source(distanceKm,fatigue,variant);
      let firstLossReplay=null;
      if(variant==='unequal_descent_catch'){
        const firstLossKm=21;
        const firstStaggered=
          runPhysicalStaggeredBunchLossV1({
            ...input,throughKm:firstLossKm});
        const firstSolo=probePhysicalStaggeredSoloFieldV1({
          ...input,staggered:firstStaggered,
          throughKm:firstLossKm});
        try{
          const firstRace=replayPhysicalStaggeredRearEventsV1({
            ...input,staggered:firstStaggered,
            soloField:firstSolo,
            throughKm:firstLossKm});
          firstLossReplay={status:'full_replay',
            contacts:firstRace.contactCount};
        }catch(error){firstLossReplay={status:'refusal',
          reason:error.message};}
      }
      let staggered;
      try{staggered=runPhysicalStaggeredBunchLossV1({
        ...input,throughKm:distanceKm});}
      catch(error){return {variant,fatigue,
        status:'bunch_source_refusal',
        reason:error.message};}
      const soloField=probePhysicalStaggeredSoloFieldV1({
        ...input,staggered,throughKm:distanceKm});
      if(soloField.refusals.length)
        return {variant,fatigue,status:'solo_refusal',
          detachedRiders:staggered.losses.length,
          lossKilometres:[...new Set(staggered.losses
            .map(row=>row.sourceKm))],
          refusals:soloField.refusals.slice(0,5)};
      try{
        const replayInput={...input,staggered,
          soloField,throughKm:distanceKm};
        const race=replayPhysicalStaggeredRearEventsV1(
          replayInput);
        assert.equal(validatePhysicalStaggeredRearEventsV1(
          replayInput,race),true);
        assert.ok(race.kilometres.every(row=>
          row.riderStates.length===160&&
          row.riderStates.every(state=>
            state.decisions.length>0&&
            Number.isFinite(state.elapsedSeconds)&&
            Number.isFinite(state.energyAfter)&&
            state.energyAfter>=0)));
        assert.ok(race.kilometres.flatMap(row=>
          row.segments).filter(row=>
          row.kind==='group').every(row=>
          row.riders.filter(rider=>
            rider.role==='leader').length===1&&
          row.riders.filter(rider=>
            rider.role==='sheltered').length===
            row.riders.length-1));
        const finishes=race.kilometres.at(-1)
          .riderStates;
        return {variant,fatigue,status:'full_replay',
          distanceKm,
          detachedRiders:staggered.losses.length,
          lossKilometres:[...new Set(staggered.losses
            .map(row=>row.sourceKm))],
          contacts:race.contactCount,
          sharedSplitContacts:race.contacts.filter(row=>
            row.source==='paid_simultaneous_split')
            .length,
          largestRearGroup:Math.max(0,...race.contacts
            .filter(row=>row.outcome==='join')
            .map(row=>row.physicalGroup.riderIds
              .length)),
          ...(firstLossReplay?{firstLossReplay}:{}),
          riderKilometres:race.kilometres.reduce(
            (sum,row)=>sum+row.riderStates.length,0),
          minimumFinishEnergy:Math.min(...finishes
            .map(row=>row.energyAfter)),
          earliestFinishSeconds:Math.min(...finishes
            .map(row=>row.elapsedSeconds)),
          latestFinishSeconds:Math.max(...finishes
            .map(row=>row.elapsedSeconds)),
          finishRiders:Object.keys(race
            .observedFinishSecondsByRider).length};
      }catch(error){
        return {variant,fatigue,status:'rear_refusal',
          detachedRiders:staggered.losses.length,
          lossKilometres:[...new Set(staggered.losses
            .map(row=>row.sourceKm))],
          firstLossReplay,
          reason:error.message};
      }
    }));
  assert.deepEqual(results.map(row=>[
    row.variant,row.fatigue,row.status,
    row.detachedRiders,row.lossKilometres]),[
    ['one_weak_climber',10,'full_replay',1,[21]],
    ['one_weak_climber',30,'full_replay',1,[21]],
    ['unequal_descent_catch',10,
      'full_replay',20,[21]],
    ['unequal_descent_catch',30,
      'full_replay',20,[21]]]);
  assert.ok(results.slice(0,2).every(row=>
    row.contacts===0&&row.finishRiders===160&&
    row.riderKilometres===160*distanceKm));
  assert.ok(results.slice(2).every(row=>
    row.contacts===19&&
    row.sharedSplitContacts===18&&
    row.largestRearGroup===20&&
    row.firstLossReplay?.status==='full_replay'&&
    row.finishRiders===160&&
    row.riderKilometres===160*distanceKm));
  for(const first of [0,2]){
    assert.ok(results[first+1]
      .earliestFinishSeconds>results[first]
        .earliestFinishSeconds);
    assert.ok(results[first+1]
      .minimumFinishEnergy<results[first]
        .minimumFinishEnergy);
  }
  assert.ok(results[2].latestFinishSeconds>
    results[0].latestFinishSeconds&&
    results[3].latestFinishSeconds>
      results[1].latestFinishSeconds);
  process.stdout.write(JSON.stringify({results},null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-rear-stage-plan')){
  const results=[120,260].map(distanceKm=>{
    const fatigue=10;
    const reserveEnergy=distanceKm===120?70:50;
    const base=source(distanceKm,fatigue,
      'varied_field');
    const riderId='team-4-3';
    const startInput={...base.startInput,
      soloCommitments:[commitRearSoloPlanV1({
        riderId,distanceKm,stageNumber:1,
        stageCount:2,baseline:{
          goal:'save_for_stage',
          effort:'conserve',
          committedStagePlan:{riderId,
            currentStageNumber:1,
            targetStageNumber:2,
            currentGoal:'finish_safely',
            futureGoal:'target_stage',
            reserveEnergy}}})]};
    const start=startPhysicalBunchV1(startInput);
    const staggered=runPhysicalStaggeredBunchLossV1({
      startInput,start,throughKm:distanceKm});
    const soloField=probePhysicalStaggeredSoloFieldV1({
      startInput,start,staggered,throughKm:distanceKm});
    assert.equal(soloField.refusals.length,0,
      JSON.stringify(soloField.refusals.slice(0,3)));
    const input={startInput,start,staggered,
      soloField,throughKm:distanceKm};
    const race=replayPhysicalStaggeredRearEventsV1(input);
    assert.equal(validatePhysicalStaggeredRearEventsV1(
      input,race),true);
    assert.ok(race.kilometres.every(row=>
      row.riderStates.length===160&&
      row.riderStates.every(state=>
        state.decisions.length>0)));
    assert.equal(Object.keys(race
      .observedFinishSecondsByRider).length,160);
    const saver=race.kilometres.at(-1)
      .riderStates.find(row=>row.riderId===riderId);
    assert.ok(saver.energyAfter>=reserveEnergy);
    if(distanceKm===260){
      const tiredBase=source(distanceKm,30,
        'varied_field');
      const impossibleInput={...tiredBase.startInput,
        soloCommitments:[commitRearSoloPlanV1({
          riderId,distanceKm,stageNumber:1,
          stageCount:2,baseline:{
            goal:'save_for_stage',
            effort:'conserve',
            committedStagePlan:{riderId,
              currentStageNumber:1,
              targetStageNumber:2,
              currentGoal:'finish_safely',
              futureGoal:'target_stage',
              reserveEnergy:70}}})]};
      const impossibleStart=startPhysicalBunchV1(
        impossibleInput);
      const impossibleStaggered=
        runPhysicalStaggeredBunchLossV1({
          startInput:impossibleInput,
          start:impossibleStart,throughKm:distanceKm});
      const impossibleSolo=
        probePhysicalStaggeredSoloFieldV1({
          startInput:impossibleInput,
          start:impossibleStart,
          staggered:impossibleStaggered,
          throughKm:distanceKm});
      assert.deepEqual(impossibleSolo.refusals,[{
        riderId,reason:
          'Staggered solo breaks future-stage reserve.'}]);
    }
    assert.ok(race.kilometres.flatMap(row=>
      row.segments).filter(segment=>
      segment.kind==='group'&&
      segment.riders.some(row=>
        row.riderId===riderId)).every(segment=>
      segment.riders.find(row=>
        row.riderId===riderId).role==='sheltered'));
    return {distanceKm,fatigue,riderId,reserveEnergy,
      contactCount:race.contactCount,
      bunchPaceMatches:race.kilometres.reduce(
        (sum,row)=>sum+row.riderStates
          .filter(state=>state.decisions.some(
            decision=>decision.choice===
              'hold_pace')).length,0),
      saverFinishEnergy:saver.energyAfter,
      saverFinishSeconds:saver.elapsedSeconds,
      saverGroupKilometres:race.kilometres
        .filter(row=>row.riderStates.find(state=>
          state.riderId===riderId)
          .physicalGroupId.startsWith(
            'rear-event-')).length,
      finishRiders:Object.keys(race
        .observedFinishSecondsByRider).length};
  });
  process.stdout.write(JSON.stringify({results},null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-rear-events-120')||
  process.argv.includes('--probe-rear-events')){
  const distances=process.argv.includes(
    '--probe-rear-events-120')?[120]:[120,260];
  const results=distances.flatMap(distanceKm=>
    [10,30].map(fatigue=>{
    const input=source(distanceKm,fatigue,
      'varied_field');
    const staggered=runPhysicalStaggeredBunchLossV1({
      ...input,throughKm:distanceKm});
    const soloField=probePhysicalStaggeredSoloFieldV1({
      ...input,staggered,throughKm:distanceKm});
    const race=replayPhysicalStaggeredRearEventsV1({
      ...input,staggered,soloField,throughKm:
        distanceKm});
    assert.equal(validatePhysicalStaggeredRearEventsV1({
      ...input,staggered,soloField,
      throughKm:distanceKm},race),true);
    assert.equal(race.kilometres.length,distanceKm);
    assert.ok(race.kilometres.every(row=>
      row.riderStates.length===160));
    assert.equal(Object.keys(race
      .observedFinishSecondsByRider).length,160);
    assert.equal(race.contacts[0].sourceKm,
      fatigue===30?26:31);
    if(fatigue===30){
      const first=race.contacts[0];
      const split=staggered.road[first.sourceKm-1]
        .splits.filter(row=>first.riders.some(
          rider=>rider.riderId===row.riderId));
      assert.equal(first.source,
        'paid_simultaneous_split');
      assert.equal(first.catchingRoadId,null);
      assert.equal(split.length,2);
      assert.ok(split.every(row=>
        Math.abs(row.atDistanceM-
          first.atDistanceM)<1e-5));
      assert.equal(first.contactDecisions.filter(row=>
        row.choice==='pull').length,1);
      assert.ok(race.kilometres[
        first.sourceKm-1].segments.some(segment=>
        segment.kind==='group'&&
        segment.roadId===first.physicalGroup.id&&
        segment.riders.filter(row=>
          row.role==='leader').length===1&&
        segment.riders.filter(row=>
          row.role==='sheltered').length===1));
    }
    assert.deepEqual(race.contacts[0].riders.map(row=>
      row.riderId),['team-3-3','team-4-3']);
    assert.equal(race.contacts[1].sourceKm,31);
    assert.deepEqual(race.contacts[1].riders.map(row=>
      row.riderId),['team-8-6','team-19-1']);
    assert.equal(race.contacts[2].sourceKm,31);
    assert.equal(race.contacts[2].riders.length,
      fatigue===30?4:3);
    assert.ok(race.contacts.every(contact=>
      contact.riders.every(row=>
        row.energyAtContact>=0)&&
      contact.contactDecisions.length===
        contact.riders.length&&
      contact.contactDecisions.filter(row=>
        row.choice==='pull').length===1));
    assert.ok(race.kilometres.every(row=>
      row.riderStates.every(state=>
        state.decisions.length>0&&
        state.decisions.every(decision=>
          decision?.riderId===state.riderId))));
    return {distanceKm,fatigue,
      status:'full_replay',
      contactCount:race.contactCount,
      bunchPaceMatches:race.kilometres.reduce(
        (sum,row)=>sum+row.riderStates
          .filter(state=>state.decisions.some(
            decision=>decision.choice===
              'hold_pace')).length,0),
      firstContacts:race.contacts.slice(0,5).map(row=>({
        km:row.sourceKm,atDistanceM:row.atDistanceM,
        riderIds:row.riders.map(rider=>
          rider.riderId),
        leaderRiderId:row.leaderRiderId})),
      finishRiders:Object.keys(
        race.observedFinishSecondsByRider).length,
      riderKilometres:race.kilometres.reduce((sum,row)=>
        sum+row.riderStates.length,0),
      minimumFinishEnergy:Math.min(...race
        .kilometres.at(-1).riderStates.map(row=>
          row.energyAfter)),
      earliestFinishSeconds:Math.min(...Object.values(
        race.observedFinishSecondsByRider)),
      latestFinishSeconds:Math.max(...Object.values(
        race.observedFinishSecondsByRider))};
  }));
  process.stdout.write(JSON.stringify({results},null,2)+'\n');
  process.exit(0);
}

const results=process.argv.includes('--probe-varied-120')?
  [10,30].map(fatigue=>
    audit(120,fatigue,'varied_field')):
  process.argv.includes('--probe-varied')?
  [120,260].flatMap(distanceKm=>
    [10,30].map(fatigue=>
      audit(distanceKm,fatigue,'varied_field'))):
  process.argv.includes('--probe-descent')?
  [audit(120,10,'unequal_descent_catch')]:
  [120,260].flatMap(distanceKm=>
  [10,30].flatMap(fatigue=>
    ['equal_field','one_weak_climber',
      'many_weak_climbers',
      'unequal_weak_climbers',
      'nearly_equal_weak_climbers',
      'unequal_descent_catch'].map(variant=>
      audit(distanceKm,fatigue,variant))));
if(process.argv.includes('--assert')){
  assert.equal(results.length,24);
  for(const row of results.filter(item=>
    item.variant==='equal_field')){
    assert.equal(row.status,'paid_bunch_finish');
    assert.equal(row.riderKilometres,
      row.distanceKm*fieldSize*ridersPerTeam);
    assert.equal(row.finishRiders,160);
    assert.ok(row.namedLeaders>=12);
    assert.ok(row.minimumEnergy>=0);
  }
  for(const row of results.filter(item=>
    item.variant!=='equal_field')){
    assert.equal(row.status,'paid_split');
    assert.equal(row.sourceKm,21);
    if(row.variant==='one_weak_climber'){
      assert.deepEqual(row.splitRiders,[
        'team-19-7']);
      assert.equal(row.continuation?.status,
        'paid_finish');
      assert.equal(row.continuation.riderKilometres,
        row.distanceKm*fieldSize*ridersPerTeam);
      assert.equal(row.continuation.finishRiders,160);
    }else if(row.variant==='many_weak_climbers'){
      assert.equal(row.splitRiders.length,20);
      assert.equal(row.paidRearContact.riderIds,20);
      assert.deepEqual(row.paidArrivalPartitions.contactSizes,[20]);
      assert.deepEqual(row.paidArrivalPartitions
        .separateSoloRiderIds,[]);
      assert.equal(row.paidRearContact.atDistanceM,
        row.sourceKm*1000);
      assert.ok(row.paidRearContact
        .behindBunchSeconds>0);
      assert.equal(row.continuation?.status,
        'paid_finish');
      assert.equal(row.continuation.riderKilometres,
        row.distanceKm*fieldSize*ridersPerTeam);
      assert.equal(row.continuation.finishRiders,160);
      assert.equal(row.continuation.namedRearLeaders,20);
      assert.ok(row.continuation.minimumEnergy>=0);
    }else{
      assert.equal(row.splitRiders.length,20);
      assert.ok(row.soloClockSpread>0);
      assert.equal(row.paidRearContact,null);
      assert.deepEqual(row.paidArrivalPartitions.contactSizes,[19]);
      assert.deepEqual(row.paidArrivalPartitions
        .separateSoloRiderIds,['team-19-7']);
      assert.equal(row.continuation?.status,'refused');
      assert.match(row.continuation.reason,
        /no recorded meeting/);
      if(row.variant==='unequal_descent_catch'){
        assert.equal(row.mixedContinuation?.status,'refused');
        assert.equal(row.mixedContinuation.sourceKm,36);
        assert.match(row.mixedContinuation.reason,
          /need paid contact road/);
        assert.equal(row.laterMixedContact?.sourceKm,36);
        assert.ok(row.laterMixedContact.atDistanceM>35000&&
          row.laterMixedContact.atDistanceM<36000);
        assert.equal(row.laterMixedContact.riderCount,20);
        assert.ok(row.laterMixedContact.behindBunchSeconds>0);
        assert.ok(row.laterMixedContact.minimumEnergy>=0);
        assert.equal(row.laterMixedRoad?.sourceKm,36);
        assert.equal(row.laterMixedRoad.endDistanceM,36000);
        assert.equal(row.laterMixedRoad.riderCount,20);
        assert.ok(row.laterMixedRoad.gapSecondsToBunch>0);
        assert.ok(row.laterMixedRoad.minimumEnergy>=0);
        assert.equal(row.joinedContinuation?.status,
          'paid_finish');
        assert.equal(row.joinedContinuation.riderKilometres,
          row.distanceKm*fieldSize*ridersPerTeam);
        assert.equal(row.joinedContinuation.finishRiders,160);
        assert.equal(row.joinedContinuation.namedRearLeaders,20);
        assert.ok(row.joinedContinuation.minimumEnergy>=0);
      }else{
        assert.equal(row.mixedContinuation?.status,'paid_finish');
        assert.equal(row.mixedContinuation.riderKilometres,
          row.distanceKm*fieldSize*ridersPerTeam);
        assert.equal(row.mixedContinuation.finishRiders,160);
        assert.equal(row.mixedContinuation.namedRearLeaders,19);
        assert.ok(row.mixedContinuation.minimumEnergy>=0);
      }
    }
  }
}
if(process.argv.includes('--assert-varied')){
  assert.equal(results.length,4);
  for(const row of results){
    assert.equal(row.variant,'varied_field');
    assert.equal(row.status,'paid_split');
    assert.equal(row.sourceKm,21);
    assert.equal(row.staggeredScale?.status,
      'paid_bunch_finish');
    assert.equal(row.staggeredScale.sourceVersion,
      'v2-physical-staggered-bunch-loss-2');
    assert.equal(row.staggeredScale
      .singleLeaderEveryKm,true);
    assert.equal(row.staggeredScale
      .validPaceMatches,true);
    assert.equal(row.staggeredScale
      .everyBunchRiderDecided,true);
    assert.ok(row.staggeredScale.paidPaceMatches>300);
    assert.ok(row.staggeredScale.detachedRiders>=35);
    assert.equal(row.staggeredScale.paidLossCompletions,
      row.staggeredScale.detachedRiders);
    assert.equal(row.staggeredScale.soloCandidates,
      row.staggeredScale.detachedRiders);
    assert.equal(row.staggeredScale.soloRefusals.length,0);
    const firstFieldContact=row.staggeredScale
      .firstSoloFieldContact;
    assert.equal(firstFieldContact.sourceKm,
      row.fatigue===30?26:31);
    assert.deepEqual(firstFieldContact.riderIds,
      ['team-3-3','team-4-3']);
    if(row.fatigue===10)
      assert.equal(firstFieldContact.catchingRiderId,
        'team-4-3');
    assert.ok(firstFieldContact.atDistanceM>
      (firstFieldContact.sourceKm-1)*1000&&
      firstFieldContact.atDistanceM<
        firstFieldContact.sourceKm*1000&&
      firstFieldContact.riders.every(rider=>
        rider.energyAtContact>=0));
    const next=row.staggeredScale.nextContact;
    assert.equal(next.length,1);
    assert.equal(next[0].kind,
      'two_other_solos_meet');
    assert.equal(next[0].sourceKm,31);
    assert.deepEqual(next[0].riderIds,
      ['team-8-6','team-19-1']);
    assert.ok(next[0].atDistanceM>30000&&
      next[0].atDistanceM<31000&&
      next[0].riders.every(rider=>
        rider.energyAtContact>=0));
    assert.ok(next[0].riderIds.includes(
      next[0].catchingRiderId));
    const second=row.staggeredScale.secondRearPair;
    assert.equal(second.sourceKm,31);
    assert.equal(second.steps,row.distanceKm-31);
    assert.equal(second.leaderRiderId,
      next[0].catchingRiderId);
    assert.equal(second.roadRoles.filter(rider=>
      rider.role==='leader').length,1);
    assert.equal(second.roadRoles.filter(rider=>
      rider.role==='sheltered').length,1);
    assert.ok(second.roadRoles.every(rider=>
      rider.energySpent>0));
    assert.equal(second.oneLeaderEveryKm,true);
    assert.equal(second.paidShelterEveryKm,true);
    assert.equal(second.leaders.length,2);
    assert.equal(second.otherRidersUnsettled,true);
    const third=row.staggeredScale.thirdContact;
    assert.equal(third.length,1);
    assert.equal(third[0].sourceKm,31);
    assert.ok(third[0].atDistanceM>30000&&
      third[0].atDistanceM<31000);
    assert.ok(third[0].riders.every(rider=>
      rider.energyAtContact>=0));
    if(row.fatigue===10){
      assert.equal(third[0].kind,
        'rear_pair_meets_solo');
      assert.equal(third[0].roadIds[1],
        'team-14-6');
    }else
      assert.equal(third[0].kind,
        'rear_pair_meets_rear_pair');
    const merged=row.staggeredScale.thirdRearGroup;
    assert.equal(merged.sourceKm,31);
    assert.equal(merged.riderCount,
      row.fatigue===10?3:4);
    assert.equal(merged.steps,row.distanceKm-31);
    assert.equal(merged.roadRoles.filter(rider=>
      rider.role==='leader').length,1);
    assert.equal(merged.roadRoles.filter(rider=>
      rider.role==='sheltered').length,
    merged.riderCount-1);
    assert.equal(merged.oneLeaderEveryKm,true);
    assert.equal(merged.paidShelterEveryKm,true);
    assert.equal(merged.otherRidersUnsettled,true);
    assert.equal(merged.genericTrackMatchesRoad,true);
    assert.equal(merged.genericNextTrackMatches,true);
    if(row.fatigue===10){
      const road=row.staggeredScale
        .laterFieldContactRoad;
      assert.equal(road.sourceKm,31);
      assert.equal(road.riders.length,2);
      assert.equal(road.riders.filter(rider=>
        rider.role==='leader').length,1);
      assert.ok(road.riders.every(rider=>
        rider.energySpent>0&&
        rider.recoveryAward===0));
      const pair=row.staggeredScale
        .laterPairContinuation;
      assert.equal(pair.status,'paid_pair_road');
      assert.equal(pair.steps,row.distanceKm-31);
      assert.equal(pair.leaders,2);
      assert.equal(pair.oneLeaderEveryKm,true);
      assert.equal(pair.paidShelterEveryKm,true);
    }else
      assert.equal(row.staggeredScale
        .laterFieldContactRoad,null);
    assert.equal(row.staggeredScale
      .nearCoincidentArrivals,
    row.fatigue===30?1:0);
    assert.equal(row.staggeredScale.separateArrivalSolos+
      row.staggeredScale.nearCoincidentArrivalRows.reduce((sum,
        contact)=>sum+contact.riderIds.length,0),
    row.staggeredScale.detachedRiders);
    assert.ok(row.staggeredScale.nearCoincidentArrivalRows.every(
      contact=>contact.riderIds.length>=2&&
      contact.atDistanceM===contact.sourceKm*1000));
    assert.equal(row.staggeredScale.withinLossKmContactPairs,
      row.fatigue===30?1:0);
    assert.ok(row.staggeredScale.firstWithinLossKmContacts
      .every(contact=>contact.sourceKm===26&&
        contact.atDistanceM>25000&&
        contact.atDistanceM<26000&&
        contact.riders.every(rider=>
          rider.energyAtContact>=0&&
          rider.energySpentToContact>0&&
          rider.energyAtContact<
            rider.energyBeforeAtKm)));
    assert.equal(row.staggeredScale
      .paidContactRemainders.length,
    row.staggeredScale.withinLossKmContactPairs);
    assert.ok(row.staggeredScale
      .paidContactRemainders.every(road=>
        road.riders.length===2&&
        road.riders.filter(rider=>
          rider.role==='leader').length===1&&
        road.riders.filter(rider=>
          rider.role==='sheltered').length===1&&
        road.riders.find(rider=>
          rider.role==='sheltered').energySpent<
          road.riders.find(rider=>
            rider.role==='leader').energySpent&&
        road.riders.every(rider=>
          rider.energySpent>0&&
          rider.energyAfter>=0&&
          rider.recoveryAward===0)));
    if(row.fatigue===30){
      const pair=row.staggeredScale
        .rearPairContinuation;
      assert.equal(pair.status,'paid_pair_road');
      assert.equal(pair.sourceKm,row.distanceKm);
      assert.equal(pair.steps,row.distanceKm-26);
      assert.equal(pair.alternatingLeaders,2);
      assert.equal(pair.oneLeaderEveryKm,true);
      assert.equal(pair.paidShelterEveryKm,true);
      assert.ok(pair.endClock>0);
    }else
      assert.equal(row.staggeredScale
        .rearPairContinuation,null);
    assert.ok(row.staggeredScale.namedLeaders>=12);
    assert.equal(row.staggeredScale.emergencyTurns,0);
    assert.equal(row.staggeredScale.bunchFinishRiders,
      160-row.staggeredScale.detachedRiders);
  }
}
process.stdout.write(JSON.stringify({
  version:'physical-field-scale-audit-1',
  fieldSize:fieldSize*ridersPerTeam,results},null,2)+'\n');
