// Bind the opt-in physical starting bunch to a fully replayed V94 recording.
// Checkpoint group labels remain observations, not positions or wheels.
import {isDeepStrictEqual} from 'node:util';
import {replayRaceDynamicsRecording} from
  './replay-race-dynamics-v94.mjs';
import {runRearBunchOriginRoadV1} from
  './rear-bunch-origin-road-v1.mjs';
import {orderAt} from './orders.mjs';

export const REAR_RECORDED_BUNCH_ORIGIN_V1_VERSION=
  'v2-rear-recorded-bunch-origin-1';
export const REAR_RECORDED_BUNCH_WORK_VERSION=
  'v2-rear-recorded-bunch-work-2';
export const REAR_RECORDED_BUNCH_ENERGY_VERSION=
  'v2-rear-recorded-bunch-energy-3';

export function runRearRecordedBunchOriginV1({recording,riderId,
  throughKm,choices,stageCount=null,committedStagePlan=null}){
  replayRaceDynamicsRecording(recording);
  if(typeof riderId!=='string'||!riderId||
    !Number.isInteger(throughKm)||throughKm<1||
    throughKm>recording.route.kilometres.length||
    !Array.isArray(choices)||choices.length!==throughKm)
    throw new Error('Recorded bunch origin needs a named rider and road.');
  const teams=recording.committedInputs.teams;
  const team=teams.find(row=>row.riders.some(rider=>
    rider.id===riderId));
  const rider=team?.riders.find(row=>row.id===riderId);
  if(!rider)throw new Error('Recorded bunch origin needs a committed rider.');
  const frames=recording.frames.slice(0,throughKm);
  const plans=frames.map(frame=>frame.pelotonFrontTurnPlan);
  if(frames.some((frame,index)=>frame.km!==index+1||
    frame.roadGroups.some(group=>group.riderIds.includes(riderId))||
    plans[index]?.status!=='worked'||
    plans[index].turns.some(turn=>
      !teams.some(row=>row.riders.some(member=>
        member.id===turn.leaderRiderId)))))
    throw new Error('Recorded bunch origin needs distinct paid bunch road.');
  const stageNumber=recording.committedInputs.raceContext.format===
    'stage'?recording.committedInputs.raceContext.stageNumber:1;
  // This recording has a stage number but no committed stage schedule.
  // A caller-supplied count cannot make a future-stage motive sourced.
  if(stageCount!==null||committedStagePlan!==null)
    throw new Error('Recorded origin has no committed future-stage schedule.');
  const roadInput={rider,orders:team.orders,
    routeKilometres:recording.route.kilometres.slice(0,throughKm),
    bunchTurnPlans:plans,choices,stageNumber,
    stageCount:stageNumber,
    committedStagePlan};
  const road=runRearBunchOriginRoadV1(roadInput);
  // The V94 front-turn ability is capacity, not a calibrated physical
  // bunch clock. A projected pace split cannot be promoted to a wheel loss.
  if(road.status==='wheel_lost')
    throw new Error('Recorded bunch origin has uncalibrated physical pace loss.');
  return {version:REAR_RECORDED_BUNCH_ORIGIN_V1_VERSION,
    raceSeed:recording.raceSeed,riderId,throughKm,
    road,sourceFrameCount:throughKm,
    checkpointGroupIsPhysicalPosition:false,
    officialResults:false};
}

export function validateRearRecordedBunchOriginV1(input,recording){
  if(!isDeepStrictEqual(recording,runRearRecordedBunchOriginV1(input)))
    throw new Error('Recorded bunch origin differs from paid source.');
  return true;
}

export function runRearRecordedBunchOriginV2({recording,riderId,
  throughKm}){
  replayRaceDynamicsRecording(recording);
  if(typeof riderId!=='string'||!riderId||
    !Number.isInteger(throughKm)||throughKm<1||
    throughKm>recording.route.kilometres.length||
    recording.committedInputs.raceContext
      ?.pelotonFollowerDecisionVersion!==2||
    recording.committedInputs.raceContext
      ?.pelotonExposureCostVersion!==1)
    throw new Error('Recorded work needs V94 follower and exposure sources.');
  const team=recording.committedInputs.teams.find(row=>
    row.riders.some(rider=>rider.id===riderId));
  const rider=team?.riders.find(row=>row.id===riderId);
  if(!rider)throw new Error('Recorded work needs a committed rider.');
  const frames=recording.frames.slice(0,throughKm);
  if(frames.some((frame,index)=>frame.km!==index+1||
    frame.roadGroups.some(group=>group.riderIds.includes(riderId))||
    frame.riderGroups.find(row=>row.id===riderId)?.group!==
      'peloton'||
    frame.pelotonFrontTurnPlan?.status!=='worked'))
    throw new Error('Recorded work needs continuous peloton road.');
  const stageNumber=recording.committedInputs.raceContext.format===
    'stage'?recording.committedInputs.raceContext.stageNumber:1;
  const roadInput={rider,orders:team.orders,teamId:team.id,
    routeKilometres:recording.route.kilometres.slice(0,throughKm),
    bunchTurnPlans:frames.map(frame=>frame.pelotonFrontTurnPlan),
    choices:frames.map(frame=>({riderId,km:frame.km,
      effort:orderAt(team.orders,frame.km-1).effort,
      action:'hold_wheel',reason:'follow_order'})),
    followerDecisions:frames.map(frame=>
      frame.pelotonFrontTurnPlan.turns.some(turn=>
        turn.leaderRiderId===riderId)?null:
        frame.pelotonFollowerDecisions.find(row=>
          row.riderId===riderId)),
    stageNumber,stageCount:stageNumber,
    followerSpeedVersion:1,recordedWorkVersion:1};
  const road=runRearBunchOriginRoadV1(roadInput);
  if(road.status!=='bunch')
    throw new Error('Recorded work has uncalibrated physical pace loss.');
  return {version:REAR_RECORDED_BUNCH_WORK_VERSION,
    raceSeed:recording.raceSeed,riderId,throughKm,
    road,sourceFrameCount:throughKm,
    checkpointGroupIsPhysicalPosition:false,
    officialResults:false};
}

export function validateRearRecordedBunchOriginV2(input,recording){
  if(!isDeepStrictEqual(recording,runRearRecordedBunchOriginV2(input)))
    throw new Error('Recorded bunch work differs from paid source.');
  return true;
}

export function runRearRecordedBunchOriginV3(input){
  const previous=runRearRecordedBunchOriginV2(input);
  const sourceEnergyReconciliation=previous.road.steps.map(step=>{
    const source=input.recording.frames[step.sourceKm-1]
      .energyLedger.find(row=>row.riderId===input.riderId);
    if(!source)throw new Error('Recorded bunch energy lacks rider source.');
    const physicalPaid=step.slices.reduce((sum,slice)=>
      sum+slice.energySpent,0);
    const physicalEnergyBefore=step.slices[0]?.energyBefore;
    if(!Number.isFinite(physicalEnergyBefore)||
      Math.abs(physicalEnergyBefore-source.energyBefore)>.001||
      Math.abs(physicalPaid-source.paidFromReserve)>.001||
      Math.abs(step.recoveryAward-source.recoveryAward)>.001||
      Math.abs(step.energyAfter-source.energyAfter)>.001)
      throw new Error(`Recorded bunch energy differs at km ${step.sourceKm}.`);
    return {sourceKm:step.sourceKm,riderId:input.riderId,
      sourceEnergyBefore:source.energyBefore,physicalEnergyBefore,
      sourcePaid:source.paidFromReserve,physicalPaid,
      sourceRecovery:source.recoveryAward,
      physicalRecovery:step.recoveryAward,
      sourceEnergyAfter:source.energyAfter,
      physicalEnergyAfter:step.energyAfter};
  });
  return {...previous,version:REAR_RECORDED_BUNCH_ENERGY_VERSION,
    sourceEnergyReconciliation};
}

export function validateRearRecordedBunchOriginV3(input,recording){
  if(!isDeepStrictEqual(recording,runRearRecordedBunchOriginV3(input)))
    throw new Error('Recorded bunch energy differs from paid source.');
  return true;
}
