// Reproduce the 160-rider first-climb drop without changing guided races.
import {prepareV91Playtest} from
  '../lib/engine/v2/playtest.mjs';
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRearEnergyCapV1} from
  '../lib/engine/v2/rear-energy-cap-source-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v2.mjs';
import {createPhysicalFirstPositionStartV1,
  PHYSICAL_FIRST_POSITION_START_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v1.mjs';
import {advancePhysicalFirstPositionRotationKmV1,
  PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION} from
  '../lib/engine/v2/physical-first-position-rotation-km-v1.mjs';
import {advancePhysicalFirstPositionRotationKmV2,
  PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-rotation-km-v2.mjs';
import {advancePhysicalFirstPositionFixedLaneConvoyKmV1,
  replayPhysicalFirstPositionFixedLaneConvoyKmV1} from
  '../lib/engine/v2/physical-first-position-fixed-lane-convoy-km-v1.mjs';
import {settlePhysicalFirstPositionFixedLaneFinishV1,
  replayPhysicalFirstPositionFixedLaneFinishV1} from
  '../lib/engine/v2/physical-first-position-fixed-lane-finish-v1.mjs';
import {advancePhysicalFirstPositionHybridKmV1,
  replayPhysicalFirstPositionHybridKmV1} from
  '../lib/engine/v2/physical-first-position-hybrid-km-v1.mjs';
import {PHYSICAL_FIRST_POSITION_MIXED_FRONT_PASS_VERSION} from
  '../lib/engine/v2/physical-first-position-mixed-front-pass-km-v1.mjs';
import {PHYSICAL_FIRST_POSITION_PASS_CONTACT_VERSION} from
  '../lib/engine/v2/physical-first-position-pass-contact-km-v1.mjs';
import {recordPhysicalFirstPositionHybridRaceV1,
  replayPhysicalFirstPositionHybridRaceV1} from
  '../lib/engine/v2/physical-first-position-hybrid-race-v1.mjs';
import {orderAt} from '../lib/engine/v2/orders.mjs';
import {riderKilometreEffect} from
  '../lib/engine/v2/physiology.mjs';
import {segmentBaseSeconds} from
  '../lib/engine/v2/road-clock.mjs';
import {MOTOR_DRAFT_SHELTER,MOTOR_RACE_DYNAMICS,
  TUNING} from '../lib/engine/v2/tuning.mjs';

const category=process.argv.includes('--women')?
  'women':'men';
const hybrid=process.argv.includes('--hybrid');
const rotateAfterDrop=process.argv.includes(
  '--rotate-after-drop');
const recordWhole=process.argv.includes(
  '--record-whole');
const seed=process.argv.find(arg=>
  arg.startsWith('--seed='))?.slice('--seed='.length)??
  'preview-recorded-road-1';
const frontAbilityShift=Number(process.argv.find(arg=>
  arg.startsWith('--front-ability-shift='))
  ?.slice('--front-ability-shift='.length)??0);
const successorAbilityShift=Number(process.argv.find(arg=>
  arg.startsWith('--successor-ability-shift='))
  ?.slice('--successor-ability-shift='.length)??0);
if(!Number.isInteger(frontAbilityShift)||
  Math.abs(frontAbilityShift)>10||
  !Number.isInteger(successorAbilityShift)||
  Math.abs(successorAbilityShift)>10)
  throw new Error('Audit ability shifts must be integers within 10.');
const settings={distanceKm:120,teamCount:20,
  gender:category==='men'?'M':'F',
  terrain:'mountain',fatigue:0,attack:'none',
  chase:'selective',seed};
const sportingStakes=prepareV91Playtest(settings)
  .teams.map(team=>({teamId:team.id,
    goal:team.id==='you'?'summit_attack':'none',
    captainId:team.orders.captainId}));
const rivalGoals=Array.from({length:19},(_,index)=>
  ({teamId:`rival-${index+1}`,role:'protect'}));
const {recording}=createV94RaceDynamicsPreview({
  format:'one_day',settings,sportingStakes,
  rivalGoals,ownFrontWork:'rotate',
  roadGroupPaceVersion:3,chaseTurnVersion:1,
  bunchFrontTurnVersion:1,
  pelotonFrontTurnVersion:1,
  pelotonDraftCostVersion:1,
  pelotonExposureCostVersion:1,
  freshAttackDecisionVersion:1,
  roadGroupRiderDecisionVersion:1,
  protectorSportingPursuitVersion:1});
const {teams,rivalIntent}=recording.committedInputs;
if(frontAbilityShift){
  // Synthetic profile sensitivity only; never change a historic recording.
  const worker=teams.find(team=>team.id==='you')
    .riders.find(rider=>rider.id==='you-5');
  for(const ability of ['flat','hills','mountain'])
    worker[ability]=Math.max(0,Math.min(100,
      worker[ability]+frontAbilityShift));
}
if(successorAbilityShift){
  const successor=teams.find(team=>team.id==='you')
    .riders.find(rider=>rider.id==='you-6');
  for(const ability of ['flat','hills','mountain'])
    successor[ability]=Math.max(0,Math.min(100,
      successor[ability]+successorAbilityShift));
}
// A committed named worker can impose a pace some sheltered riders
// cannot hold. This is a new input variant, not a changed recording.
teams.find(team=>team.id==='you')
  .orders.baseline.frontWorkRiderId='you-5';
if(rotateAfterDrop){
  const orders=teams.find(team=>team.id==='you')
    .orders;
  orders.phases=[...orders.phases,
    {atKm:25,frontWork:'rotate',
      frontWorkRiderId:'you-6'}]
    .sort((a,b)=>a.atKm-b.atKm);
}
const kilometres=recording.route.kilometres;
const riders=teams.flatMap(team=>team.riders.map(rider=>({
  riderId:rider.id,teamId:team.id,
  roadId:'peloton',distanceM:0,
  clockSeconds:0,reserve:replayRearEnergyCapV1({
    rider,kilometres,throughKm:0}).initialCap,
  quietKm:0})));
const start={sourceKm:0,
  roads:[{roadId:'peloton',
    riderIds:riders.map(row=>row.riderId),
    clockSeconds:0}],riders};
const input={start,kilometres,teams,
  stakes:rivalIntent,raceSeed:recording.raceSeed,
  positionModelVersion:
    PHYSICAL_FIRST_POSITION_START_V2_VERSION};
const source=runPhysicalFirstWholeRaceProbeV1(input);
const positionStart=createPhysicalFirstPositionStartV2({
  input,grid:{laneCount:4,wheelSpacingM:2.5,
    laneStaggerM:.08}});
const segment=kilometres[0];
const riderSource=new Map(teams.flatMap(team=>
  team.riders.map(rider=>[rider.id,{rider,team}])));
const abilityFor=(row,phase)=>{
  const {rider,team}=riderSource.get(row.riderId);
  const order=orderAt(team.orders,0);
  return riderKilometreEffect(rider,segment,{
    phase,energy:row.energy,
    exposed:segment.exposed}).ability+
    (TUNING.effortPressure[order.effort]-1)*20+
    (phase==='cruise'?
      MOTOR_DRAFT_SHELTER[segment.terrain]:0);
};
const frontAbility=abilityFor(positionStart.positions[0],
  'solo');
const speedFor=ability=>1000/(
  segmentBaseSeconds(segment)+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint);
const frontSpeed=speedFor(frontAbility);
const elapsed=1000/frontSpeed;
// This deliberately omits energy and collision settlement. It only
// locates the first missing movement contract and cannot feed the viewer.
const projected=positionStart.positions.map(row=>{
  const ability=abilityFor(row,
    row===positionStart.positions[0]?'solo':'cruise');
  const speed=Math.min(frontSpeed,
    speedFor(ability));
  return {riderId:row.riderId,
    startDistanceM:row.distanceM,
    endDistanceM:row.distanceM+speed*elapsed,
    fallsBackM:1000-speed*elapsed};
}).sort((a,b)=>b.endDistanceM-a.endDistanceM);
const separationThresholdM=5;
const components=[];
for(const row of projected){
  if(!components.length||
    components.at(-1).at(-1).endDistanceM-
      row.endDistanceM>separationThresholdM)
    components.push([]);
  components.at(-1).push(row);
}
let positionOutcome=null;
try{
  const first=advancePhysicalFirstPositionRotationKmV2({
    prior:positionStart,segment:kilometres[0],
    input});
  positionOutcome={status:'complete',
    sourceKm:first.sourceKm};
}catch(error){
  positionOutcome={status:'unsupported',
    sourceKm:1,reason:error.message};
}
let fixedLaneOutcome=null;
let wholeRecording=null;
try{
  let prior=positionStart;
  let contactEvents=0;
  let riderDecisions=0;
  let rotationKm=0;
  let fixedLaneKm=0;
  let mixedFrontPassKm=0;
  let passContactKm=0;
  let passContactAtKm=null;
  let passContactEvents=0;
  let refusedFrontPasses=0;
  let maxFrontClockDeltaSeconds=0;
  let firstPelotonMembershipMismatchKm=null;
  let matchingPelotonKilometres=0;
  let matchingRoadCounts=0;
  let unsupported=null;
  for(const roadSegment of kilometres){
    const args={prior,segment:roadSegment,input};
    try{
      const next=hybrid?
        advancePhysicalFirstPositionHybridKmV1(args):
        advancePhysicalFirstPositionFixedLaneConvoyKmV1(args);
      if(hybrid)
        replayPhysicalFirstPositionHybridKmV1(args,next);
      else replayPhysicalFirstPositionFixedLaneConvoyKmV1(
        args,next);
      if(next.version===
        PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION)
        rotationKm++;
      else if(next.version===
        PHYSICAL_FIRST_POSITION_MIXED_FRONT_PASS_VERSION)
        mixedFrontPassKm++;
      else if(next.version===
        PHYSICAL_FIRST_POSITION_PASS_CONTACT_VERSION){
        passContactKm++;
        passContactAtKm=roadSegment.km;
        passContactEvents+=next.contactEvents.length;
      }
      else fixedLaneKm++;
      refusedFrontPasses+=Number(next.event
        ?.type==='front_pass_refused');
      contactEvents+=next.contactEvents.length;
      riderDecisions+=next.decisions.length;
      const sourceState=source.states[roadSegment.km];
      maxFrontClockDeltaSeconds=Math.max(
        maxFrontClockDeltaSeconds,
        Math.abs(next.clockSeconds-
          sourceState.frontClockSeconds));
      const paidIds=next.contactComponents[0];
      const sourceIds=[...sourceState.roads.find(
        road=>road.roadId==='peloton')
        .riderIds].sort();
      if(JSON.stringify(paidIds)===
        JSON.stringify(sourceIds))
        matchingPelotonKilometres++;
      else if(firstPelotonMembershipMismatchKm===null)
          firstPelotonMembershipMismatchKm=
            roadSegment.km;
      if(next.contactComponents.length===
        sourceState.roads.length)
        matchingRoadCounts++;
      prior=next;
    }catch(error){
      unsupported={sourceKm:roadSegment.km,
        reason:error.message};
      if(rotateAfterDrop&&[
        'Fixed-lane convoy needs a paid front pass.',
        'Rotation kilometre loses first shelter.',
        'Rotation kilometre loses second shelter.'
      ].includes(error.message)){
        const candidate=prior.positions.find(
          row=>row.riderId==='you-6');
        unsupported.frontPassGeometry={
          fromRiderId:prior.positions[0]
            .riderId,
          candidateRiderId:candidate?.riderId,
          candidateLane:candidate?.lane,
          candidateGapM:candidate?
            prior.positions[0].distanceM-
              candidate.distanceM:null,
          aheadInCandidateLane:candidate?
            prior.positions.filter(row=>
              row.lane===candidate.lane&&
              row.distanceM>candidate.distanceM)
              .map(row=>row.riderId):[]};
        const legacyInput={...input,
          positionModelVersion:
            PHYSICAL_FIRST_POSITION_START_VERSION};
        try{
          const legacyStart=createPhysicalFirstPositionStartV1({
            input:legacyInput,grid:prior.grid});
          const subset=advancePhysicalFirstPositionRotationKmV1({
            prior:{...prior,
              version:
                PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION,
              inputHash:legacyStart.inputHash,
              positions:prior.positions.filter(row=>
                row.roadId==='peloton'),
              separateRoadRiderIds:prior.positions
                .filter(row=>row.roadId!=='peloton')
                .map(row=>row.riderId)},
            segment:roadSegment,
            input:legacyInput});
          unsupported.pelotonSubsetPass={
            event:subset.event?.type??null,
            from:subset.event?.fromRiderId??null,
            to:subset.event?.toRiderId??null,
            firstSeconds:subset.firstSeconds,
            secondSeconds:subset.secondSeconds};
        }catch(passError){
          unsupported.pelotonSubsetPass={
            unsupported:passError.message};
        }
      }
      break;
    }
  }
  fixedLaneOutcome={status:unsupported?
    'partial':'trace_complete_finish_unresolved',
  completedThroughKm:prior.sourceKm,
  riderDecisions,
  rotationKm,fixedLaneKm,
  mixedFrontPassKm,
  passContactKm,passContactAtKm,
  passContactEvents,
  refusedFrontPasses,
  contactComponentSizes:prior.sourceKm?
    prior.contactComponents.map(group=>
      group.length):null,
  contactEvents,
  maxFrontClockDeltaSeconds,
  firstPelotonMembershipMismatchKm,
  matchingPelotonKilometres,
  matchingRoadCounts,
  sourceFinalRoadSizes:source.states.at(-1)
    .roads.map(road=>road.riderIds.length),
  lastDistanceM:prior.positions.at(-1).distanceM,
  unsupported,
  officialResults:false};
  if(!unsupported){
    try{
      const tailRequest={prior,input};
      const finish=settlePhysicalFirstPositionFixedLaneFinishV1(
        tailRequest);
      replayPhysicalFirstPositionFixedLaneFinishV1(
        tailRequest,finish);
      const sourceFinishClock=new Map(
        source.states.at(-1).riders.map(row=>
          [row.riderId,row.clockSeconds]));
      const finishClockDeltas=finish.finishCrossings
        .map(row=>Math.abs(row.clockSeconds-
          sourceFinishClock.get(row.riderId)));
      fixedLaneOutcome.finish={status:
        'paid_crossings_unranked',
      crossingCoverage:`${finish.finishCrossings.length}/${riders.length}`,
      lastClockSeconds:finish.lastClockSeconds,
      contactEvents:finish.contactEvents.length,
      maxOldGroupClockDeltaSeconds:
        Math.max(...finishClockDeltas),
      exactOldGroupClockMatches:
        finishClockDeltas.filter(delta=>
          delta<1e-6).length,
      officialResults:finish.officialResults};
      fixedLaneOutcome.status=
        'trace_and_crossings_complete_unranked';
    }catch(error){
      fixedLaneOutcome.finish={status:'unsupported',
        reason:error.message};
    }
  }
  if(!unsupported&&recordWhole&&hybrid){
    try{
      const request={input,grid:positionStart.grid};
      const race=recordPhysicalFirstPositionHybridRaceV1(
        request);
      replayPhysicalFirstPositionHybridRaceV1(
        request,race);
      wholeRecording={status:'replay_verified',
        riderKm:race.positionRiderKm,
        crossingCoverage:race.finishCrossingCoverage,
        paidFrontPasses:race.frontPassEvents.length,
        officialResults:race.officialResults};
    }catch(error){
      wholeRecording={status:'unsupported',
        reason:error.message};
    }
  }
}catch(error){
  fixedLaneOutcome={status:'unsupported',
    sourceKm:1,reason:error.message};
}
process.stdout.write(`${JSON.stringify({
  version:'physical-first-position-early-climb-audit-1',
  category,hybrid,rotateAfterDrop,seed,
  syntheticFrontAbilityShift:frontAbilityShift,
  syntheticSuccessorAbilityShift:
    successorAbilityShift,
  riderCount:riders.length,
  firstTerrain:kilometres[0].terrain,
  sourceFront:source.steps[0].peloton
    .road.leaderRiderId,
  sourceFrontAtKm26:source.steps[25].peloton
    .road.leaderRiderId,
  sourceTeamRidersInPelotonAtKm25:
    source.states[25].roads.find(road=>
      road.roadId==='peloton').riderIds
      .filter(id=>id.startsWith('you-')),
  sourceStartDrops:source.steps[0].peloton
    .startDropEvents.length,
  stagedFront:positionStart.positions[0].riderId,
  unpaidDiagnostic:{slowerRiders:projected.filter(row=>
    row.fallsBackM>1e-6).length,
  maxFallBackM:Math.max(...projected.map(row=>
    row.fallsBackM)),
  componentSizes:components.map(group=>group.length)},
  positionOutcome,fixedLaneOutcome,
  wholeRecording,
  officialResults:false},null,2)}\n`);
