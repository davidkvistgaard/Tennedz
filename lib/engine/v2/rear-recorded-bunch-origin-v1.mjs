// Bind the opt-in physical starting bunch to a fully replayed V94 recording.
// Checkpoint group labels remain observations, not positions or wheels.
import {isDeepStrictEqual} from 'node:util';
import {replayRaceDynamicsRecording} from
  './replay-race-dynamics-v94.mjs';
import {runRearBunchOriginRoadV1} from
  './rear-bunch-origin-road-v1.mjs';

export const REAR_RECORDED_BUNCH_ORIGIN_V1_VERSION=
  'v2-rear-recorded-bunch-origin-1';

export function runRearRecordedBunchOriginV1({recording,riderId,
  throughKm,choices,stageCount=1,committedStagePlan=null}){
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
  if(recording.committedInputs.raceContext.format==='one_day'&&
    (stageCount!==1||committedStagePlan!==null))
    throw new Error('One-day origin has no future-stage release.');
  const roadInput={rider,orders:team.orders,
    routeKilometres:recording.route.kilometres.slice(0,throughKm),
    bunchTurnPlans:plans,choices,stageNumber,stageCount,
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
