// Experimental whole race with sequential paid departures. It refuses
// unpriced solo contact, simultaneous launches and peloton shelter loss.
import {isDeepStrictEqual} from 'node:util';
import {choosePhysicalFirstBoundaryAttacksV1} from
  './physical-first-attack-choice-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  './physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionRotationKmV2} from
  './physical-first-position-rotation-km-v2.mjs';
import {advancePhysicalFirstPositionAttackDepartureKmV1} from
  './physical-first-position-attack-departure-km-v1.mjs';
import {advancePhysicalFirstPositionSoloKmV1,
  advancePhysicalFirstPositionSoloKmV3} from
  './physical-first-position-solo-km-v1.mjs';
import {settlePhysicalFirstPositionFinishTailV2} from
  './physical-first-position-finish-tail-v2.mjs';

export const PHYSICAL_FIRST_POSITION_MULTI_SOLO_RACE_VERSION=
  'physical-first-position-multi-solo-race-1';
export const PHYSICAL_FIRST_POSITION_MULTI_SOLO_RACE_V2_VERSION=
  'physical-first-position-multi-solo-race-2';
const EPS=1e-6;

function paidPositionAt(trajectory,seconds){
  let distanceM=trajectory.startDistanceM;
  let remaining=seconds;
  for(const leg of trajectory.legs){
    if(remaining<=EPS)break;
    const duration=leg.distanceM/leg.speedMps;
    const travelSeconds=Math.min(remaining,
      duration);
    distanceM+=leg.speedMps*travelSeconds;
    remaining-=travelSeconds;
  }
  if(remaining>EPS)
    throw new Error('Multi-solo contact lacks paid travel.');
  return distanceM;
}

function verifyPiecewiseSoloSeparation({
  trajectories,clockSeconds,
  thresholdM,sourceKm}){
  const ordered=[...trajectories].sort((a,b)=>
    b.startDistanceM-a.startDistanceM);
  for(let index=1;index<ordered.length;index++){
    const ahead=ordered[index-1];
    const behind=ordered[index];
    const horizon=Math.min(
      ahead.stopClockSeconds,
      behind.stopClockSeconds)-
      clockSeconds;
    const checkpoints=new Set([0,horizon]);
    for(const trajectory of [ahead,behind]){
      let elapsed=0;
      for(const leg of trajectory.legs){
        elapsed+=leg.distanceM/leg.speedMps;
        if(elapsed>EPS&&elapsed<horizon-EPS)
          checkpoints.add(elapsed);
      }
    }
    if(horizon<0||
      [...checkpoints].some(seconds=>
        paidPositionAt(ahead,seconds)-
          paidPositionAt(behind,seconds)<=
            thresholdM+EPS))
      throw new Error(
        `Multi-solo race needs paid solo contact at km ${sourceKm}.`);
  }
}

function recordMultiSoloRace({input,grid},
  leaderPaid){
  if(input?.positionModelVersion!==
      PHYSICAL_FIRST_POSITION_START_V2_VERSION||
    !Array.isArray(input.kilometres)||
    !input.kilometres.length)
    throw new Error('Multi-solo race needs committed inputs.');
  let peloton=createPhysicalFirstPositionStartV2({
    input,grid});
  const start=peloton;
  const solos=new Map();
  const soloLineClocks=new Map();
  const soloFinishes=new Map();
  const steps=[];
  const checkpointCrossings=[];
  for(const segment of input.kilometres){
    const priorPeloton=peloton;
    const priorKm=peloton.sourceKm;
    const activeSoloRoads=[...solos.values()]
      .map(position=>({position,
        lineClockSeconds:soloLineClocks.get(
          position.riderId)?.get(priorKm)}));
    if(activeSoloRoads.some(row=>
      !Number.isFinite(row.lineClockSeconds)))
      throw new Error('Multi-solo choice lacks paid line time.');
    const choicePrior={sourceKm:priorKm,
      roads:[{roadId:'peloton',
        riderIds:peloton.positions.map(row=>
          row.riderId),
        clockSeconds:peloton.clockSeconds},
      ...activeSoloRoads.map(row=>({
        roadId:row.position.roadId,
        riderIds:[row.position.riderId],
        clockSeconds:row.lineClockSeconds}))],
      riders:[...peloton.positions.map(row=>({
        riderId:row.riderId,
        teamId:row.teamId,
        roadId:'peloton',
        distanceM:priorKm*1000,
        clockSeconds:peloton.clockSeconds,
        reserve:row.energy,
        quietKm:row.quietKm})),
      ...activeSoloRoads.map(row=>({
        riderId:row.position.riderId,
        teamId:row.position.teamId,
        roadId:row.position.roadId,
        distanceM:priorKm*1000,
        clockSeconds:row.lineClockSeconds,
        reserve:row.position.energy,
        quietKm:row.position.quietKm}))]};
    const attackChoices=choosePhysicalFirstBoundaryAttacksV1({
      prior:choicePrior,segment,
      teams:input.teams,stakes:input.stakes,
      kilometres:input.kilometres});
    const attempts=attackChoices.filter(row=>
      row.choice==='attempt_paid_attack');
    if(attempts.length>1)
      throw new Error(
        `Multi-solo race needs simultaneous departures at km ${segment.km}.`);
    let departure=null;
    let attackRefusal=null;
    if(attempts.length){
      try{
        departure=advancePhysicalFirstPositionAttackDepartureKmV1({
          prior:peloton,segment,input,
          choice:attempts[0],activeSoloRoads});
        peloton=departure.peloton;
      }catch(error){
        if(error.message!==
          'Position attacker lacks a clear passing lane.')
          throw error;
        const candidate=priorPeloton.positions.find(row=>
          row.riderId===attempts[0].riderId);
        if(!candidate)
          throw new Error('Refused attacker is not in the paid peloton.');
        attackRefusal={version:
          leaderPaid?
            PHYSICAL_FIRST_POSITION_MULTI_SOLO_RACE_V2_VERSION:
            PHYSICAL_FIRST_POSITION_MULTI_SOLO_RACE_VERSION,
        type:'attack_pass_refused',
        sourceKm:segment.km,
        riderId:attempts[0].riderId,
        teamId:attempts[0].teamId,
        lane:candidate.lane,
        distanceToFrontM:priorPeloton.positions[0]
          .distanceM-candidate.distanceM,
        aheadInLaneRiderIds:priorPeloton.positions
          .filter(row=>row.riderId!==candidate.riderId&&
            row.lane===candidate.lane&&
            row.distanceM>candidate.distanceM+EPS)
          .map(row=>row.riderId),
        reason:'no_clear_paid_passing_lane'};
      }
      if(departure&&solos.has(
        departure.soloPosition.riderId))
        throw new Error('Multi-solo race duplicated a solo road.');
    }
    if(!departure){
      peloton=advancePhysicalFirstPositionRotationKmV2({
        prior:peloton,segment,input});
    }
    const soloSteps=[];
    const previousSolos=new Map(solos);
    for(const [riderId,priorSolo] of previousSolos){
      if(priorSolo.finishedAtClockSeconds!==undefined)
        continue;
      const soloStep=(leaderPaid?
        advancePhysicalFirstPositionSoloKmV3:
        advancePhysicalFirstPositionSoloKmV1)({
        priorSolo,priorPeloton,
        nextPeloton:peloton,segment,input});
      soloSteps.push(soloStep);
      solos.set(riderId,soloStep.position);
      if(soloStep.finished){
        if(!soloStep.finishCrossing)
          throw new Error('Multi-solo finish lacks a line crossing.');
        soloFinishes.set(riderId,
          soloStep.finishCrossing);
      }
      for(const crossing of soloStep.checkpointCrossings){
        if(!soloLineClocks.has(riderId))
          soloLineClocks.set(riderId,new Map());
        soloLineClocks.get(riderId).set(
          crossing.km,crossing.clockSeconds);
      }
      checkpointCrossings.push(...soloStep
        .checkpointCrossings);
    }
    if(departure){
      const position=departure.soloPosition;
      solos.set(position.riderId,position);
      soloLineClocks.set(position.riderId,
        new Map(departure.soloCheckpointCrossings
          .map(row=>[row.km,row.clockSeconds])));
      checkpointCrossings.push(...departure
        .soloCheckpointCrossings);
    }
    const trajectories=soloSteps.map(step=>({
      riderId:step.riderId,
      startDistanceM:step.startDistanceM,
      speedMps:step.speedMps,
      ...(leaderPaid?{legs:step.speedLegs}:{}),
      stopClockSeconds:step.endClockSeconds}));
    if(departure)trajectories.push({
      riderId:departure.soloPosition.riderId,
      startDistanceM:departure.soloDecision
        .startDistanceM,
      speedMps:departure.attackSpeedMps,
      ...(leaderPaid?{legs:[{
        distanceM:departure.soloDecision
          .endDistanceM-
          departure.soloDecision
            .startDistanceM,
        speedMps:departure.attackSpeedMps}]}:{}),
      stopClockSeconds:departure.endClockSeconds});
    if(leaderPaid)
      verifyPiecewiseSoloSeparation({
        trajectories,
        clockSeconds:priorPeloton.clockSeconds,
        thresholdM:grid.wheelSpacingM*2,
        sourceKm:segment.km});
    else{
      trajectories.sort((a,b)=>
        b.startDistanceM-a.startDistanceM);
      for(let index=1;index<trajectories.length;index++){
        const ahead=trajectories[index-1];
        const behind=trajectories[index];
        const activeSeconds=Math.min(
          ahead.stopClockSeconds,
          behind.stopClockSeconds)-
          priorPeloton.clockSeconds;
        const startGapM=ahead.startDistanceM-
          behind.startDistanceM;
        const endGapM=startGapM+
          (ahead.speedMps-behind.speedMps)*
            activeSeconds;
        if(activeSeconds<0||
          startGapM<=grid.wheelSpacingM*2+EPS||
          endGapM<=grid.wheelSpacingM*2+EPS)
          throw new Error(
            `Multi-solo race needs paid solo contact at km ${segment.km}.`);
      }
    }
    checkpointCrossings.push(...peloton
      .checkpointCrossings);
    steps.push({sourceKm:segment.km,
      attackChoices,departure,attackRefusal,
      soloSteps,
      peloton,soloPositions:[...solos.values()]});
  }
  const tail=settlePhysicalFirstPositionFinishTailV2({
    input,prior:peloton});
  const finishKm=input.kilometres.length;
  const soloFinishCrossings=[...soloFinishes].map(
    ([riderId,crossing])=>({
      riderId,lineDistanceM:crossing.lineDistanceM,
      clockSeconds:crossing.clockSeconds,
      sourceKm:crossing.sourceKm,
      paidRoadId:`solo:${riderId}`}));
  const finishCrossings=[...tail.lineCrossings,
    ...soloFinishCrossings].sort((a,b)=>
    a.clockSeconds-b.clockSeconds||
    a.riderId.localeCompare(b.riderId));
  const riderCount=start.positions.length;
  const crossingKeys=new Set([
    ...checkpointCrossings.map(row=>
      `${row.riderId}:${row.km}`),
    ...finishCrossings.map(row=>
      `${row.riderId}:${finishKm}`)]);
  if(steps.length!==finishKm||
    soloFinishes.size!==solos.size||
    finishCrossings.length!==riderCount||
    new Set(finishCrossings.map(row=>
      row.riderId)).size!==riderCount||
    crossingKeys.size!==riderCount*finishKm)
    throw new Error('Multi-solo race lacks paid finish coverage.');
  return {version:leaderPaid?
    PHYSICAL_FIRST_POSITION_MULTI_SOLO_RACE_V2_VERSION:
    PHYSICAL_FIRST_POSITION_MULTI_SOLO_RACE_VERSION,
  raceSeed:input.raceSeed,
  inputHash:start.inputHash,
  plannedKm:finishKm,
  completedThroughKm:steps.length,
  riderCount,start,steps,
  checkpointCrossings,tail,
  soloFinishes:[...soloFinishes],
  finishCrossings,
  paidAttackDepartures:steps.filter(row=>
    row.departure).length,
  refusedAttackPasses:steps.filter(row=>
    row.attackRefusal).length,
  physicalRoadCount:1+solos.size,
  sourceGroupClockPositionsUsedForMovement:false,
  officialResults:false};
}

export function recordPhysicalFirstPositionMultiSoloRaceV1(
  input){
  return recordMultiSoloRace(input,false);
}

export function recordPhysicalFirstPositionMultiSoloRaceV2(
  input){
  return recordMultiSoloRace(input,true);
}

export function replayPhysicalFirstPositionMultiSoloRaceV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionMultiSoloRaceV1(input)))
    throw new Error('Multi-solo race differs from paid movement.');
  return recorded;
}

export function replayPhysicalFirstPositionMultiSoloRaceV2(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionMultiSoloRaceV2(input)))
    throw new Error('Multi-solo race v2 differs from paid movement.');
  return recorded;
}
