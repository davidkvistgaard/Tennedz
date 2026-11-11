// Synthetic contact matrix only. These riders and roads are not game canon.
import {isDeepStrictEqual} from 'node:util';
import {prepareSyntheticPositionCatchV1} from
  '../tests/unit/synthetic-position-catch-fixture-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1,
  runPhysicalFirstWholeRaceProbeV2,
  replayPhysicalFirstWholeRaceProbeV2} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstPositionGeneralRaceV2,
  replayPhysicalFirstPositionGeneralRaceV2,
  recordPhysicalFirstPositionGeneralRaceV3,
  replayPhysicalFirstPositionGeneralRaceV3,
  recordPhysicalFirstPositionGeneralRaceV4,
  replayPhysicalFirstPositionGeneralRaceV4,
  recordPhysicalFirstPositionGeneralRaceV5,
  replayPhysicalFirstPositionGeneralRaceV5,
  recordPhysicalFirstPositionGeneralRaceV6,
  replayPhysicalFirstPositionGeneralRaceV6,
  recordPhysicalFirstPositionGeneralRaceV7,
  replayPhysicalFirstPositionGeneralRaceV7} from
  '../lib/engine/v2/physical-first-position-general-race-v1.mjs';

const option=(name,fallback)=>process.argv.find(arg=>
  arg.startsWith(`--${name}=`))?.slice(name.length+3)??
  fallback;
const integer=(name,fallback)=>{
  const raw=option(name,String(fallback));
  if(!(/^\d+$/).test(raw))
    throw new Error(`Invalid ${name}.`);
  return Number(raw);
};
const options={teamCount:integer('teams',2),
  kmCount:integer('km',20),
  weakBunchCount:integer('weak-workers',0),
  profile:option('profile','hill_then_mountain'),
  oneTimeAttack:option('attack','first')==='first',
  secondAttackAtKm:integer('second-attack-km',0)||null,
  frontWorkerAtKm:integer('front-worker-km',0)||null,
  raceSeed:option('seed','synthetic-general-audit-1')};
options.riderCount=integer('riders',options.teamCount*8);
const sourceVersion=option('source-version','1');
const positionVersion=option('position-version','2');
const parallelTeamAttack=option('parallel-team-attack',
  'false');
const sprintStakes=option('sprint-stakes','none');
if(!['first','none'].includes(option('attack','first')))
  throw new Error('Unsupported attack audit option.');
if(!['1','2'].includes(sourceVersion))
  throw new Error('Unsupported source probe version.');
if(!['2','3','4','5','6','7'].includes(positionVersion)||
  !['true','false'].includes(parallelTeamAttack)||
  !['none','first','all'].includes(sprintStakes)||
  sprintStakes!=='none'&&
    !['6','7'].includes(positionVersion))
  throw new Error('Unsupported position version.');
const request=prepareSyntheticPositionCatchV1(options);
request.input.positionPassingCorridorCount=1;
if(sprintStakes!=='none')
  for(const [index,stake] of request.input.stakes.entries())
    if(sprintStakes==='all'||index===0)
      stake.sportingGoal='sprint_finish';
if(option('attack','first')==='none')
  request.input.teams[0].orders.baseline.attack='none';
if(parallelTeamAttack==='true'){
  request.input.teams[1].orders.baseline.attack=
    'selective';
  request.input.teams[1].orders.baseline
    .attackRiderId='team-1-7';
  request.input.teams[1].orders.phases.push({
    atKm:1,attack:'none',attackRiderId:null});
}
let source=null,position=null;
let sourceError=null,positionError=null;
try{source=(sourceVersion==='2'?
  runPhysicalFirstWholeRaceProbeV2:
  runPhysicalFirstWholeRaceProbeV1)(
  request.input);
  if(sourceVersion==='2')
    replayPhysicalFirstWholeRaceProbeV2(
      request.input,source);
}catch(error){
  source=null;
  sourceError={message:error.message,
    sourceKm:error.sourceKm??null,
    evidence:error.sourceEvidence??null};
}
try{
  position=(positionVersion==='7'?
    recordPhysicalFirstPositionGeneralRaceV7:
    positionVersion==='6'?
    recordPhysicalFirstPositionGeneralRaceV6:
    positionVersion==='5'?
    recordPhysicalFirstPositionGeneralRaceV5:
    positionVersion==='4'?
    recordPhysicalFirstPositionGeneralRaceV4:
    positionVersion==='3'?
      recordPhysicalFirstPositionGeneralRaceV3:
    recordPhysicalFirstPositionGeneralRaceV2)(request);
  (positionVersion==='7'?
    replayPhysicalFirstPositionGeneralRaceV7:
    positionVersion==='6'?
    replayPhysicalFirstPositionGeneralRaceV6:
    positionVersion==='5'?
    replayPhysicalFirstPositionGeneralRaceV5:
    positionVersion==='4'?
    replayPhysicalFirstPositionGeneralRaceV4:
    positionVersion==='3'?
      replayPhysicalFirstPositionGeneralRaceV3:
    replayPhysicalFirstPositionGeneralRaceV2)(
    request,position);
}catch(error){
  positionError={message:error.message,
    sourceKm:error.sourceKm??null,
    activeSoloRiderIds:
      error.activeSoloRiderIds??null,
    attackAttemptRiderIds:
      error.attackAttemptRiderIds??null,
    frontPassCandidateId:
      error.frontPassCandidateId??null};
}
const pelotonComparisons=source&&position?
  position.steps.slice(0,-1).map((step,index)=>({
    km:index+1,
    aligned:isDeepStrictEqual(
      [...(source.states[index+1].roads.find(row=>
        row.roadId==='peloton')?.riderIds??[])].sort(),
      step.sharedRoad.positions.filter(row=>
        row.roadId==='peloton').map(row=>
        row.riderId).sort())})):[];
const sourceAttacks=source?.steps.flatMap(step=>
  step.attackSteps.map(attackStep=>
    `${step.sourceKm}:${attackStep.choice.riderId}`))??null;
const positionAttacks=position?.attackDepartureEvents
  .map(event=>`${event.sourceKm}:${event.toRiderId}`)??null;
let previousTopology=null;
const distinctMembershipTransitions=position?.contactEvents
  .reduce((count,event)=>{
    const topology=JSON.stringify(
      event.components.map(group=>
        [...group].sort()));
    const changed=topology!==previousTopology;
    previousTopology=topology;
    return count+Number(changed);
  },0)??null;
const summary={version:'position-general-synthetic-audit-1',
  fixture:'synthetic_noncanonical',options,
  sourceVersion,positionVersion,
  parallelTeamAttack:parallelTeamAttack==='true',
  sprintStakes,
  sourceStatus:source?sourceVersion==='2'?
    'complete_replayed':'complete':'failed',
  sourceError,
  positionStatus:position?
    'complete_replayed':'failed',
  positionError,
  riderCount:position?.riderCount??null,
  plannedKm:request.input.kilometres.length,
  decisionCount:position?.decisionCount??null,
  terminalRecords:
    position?.terminalDecisionCount??null,
  checkpointCrossings:
    position?.checkpointCrossings.length??null,
  finishCrossings:
    position?.finishCrossings.length??null,
  unresolvedFinishClockTies:
    position?.finaleFinishTieObservations
      ?.length??null,
  sprintDecisions:
    position?.finaleSprintDecisions?.length??null,
  paidSprintAttempts:
    position?.finaleSprintDecisions?.filter(row=>
      row.choice==='attempt_paid_sprint').length??null,
  sprintPassObservations:
    position?.finaleSprintPassEvents?.length??null,
  sprintLaneObservations:
    position?.finaleSprintLaneEvents?.length??null,
  finalePositionFrames:
    position?.tail.positionFrames?.length??null,
  finaleFrameRiderCoverage:
    position?.tail.positionFrames?.every(frame=>
      frame.positions.length===position.riderCount)
      ??null,
  sourceAttacks,positionAttacks,
  attackCapacityRefusals:
    position?.attackCapacityRefusals
      ?.map(row=>`${row.sourceKm}:${row.riderId}`)??null,
  unmatchedSourceAttacks:sourceAttacks&&
    positionAttacks?sourceAttacks.filter(key=>
      !positionAttacks.includes(key)):null,
  firstPelotonMismatchKm:
    pelotonComparisons.find(row=>
      !row.aligned)?.km??null,
  alignedPelotonCheckpoints:
    pelotonComparisons.filter(row=>
      row.aligned).length,
  comparedPelotonCheckpoints:
    pelotonComparisons.length,
  contactObservations:
    position?.contactEvents.length??null,
  distinctMembershipTransitions,
  sourceBoundaryContactsWithoutSharedLeader:
    source?.steps.flatMap(step=>
      step.boundaryContactEvents).filter(event=>
      event.type===
        'paid_contact_without_shared_leader').length??null,
  sourceFinalRoads:source?.states.at(-1)
    .roads.map(row=>({roadId:row.roadId,
      riderCount:row.riderIds.length}))??null,
  positionFinalRoads:position?
    Object.entries(Object.groupBy(
      position.steps.at(-1).sharedRoad.positions,
      row=>row.roadId)).map(([roadId,riders])=>
      ({roadId,riderCount:riders.length})):null,
  officialResults:false,
  readyForGuidedRaces:false};
process.stdout.write(JSON.stringify(summary,null,2)+'\n');
if(sourceError||positionError)process.exitCode=1;
