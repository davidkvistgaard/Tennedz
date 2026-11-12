// Experimental shared-clock road step. An existing solo and the bunch
// move as measured wheels; a catch changes contact only after paid motion.
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_DRAFT_SHELTER,MOTOR_RACE_DYNAMICS,TUNING} from
  './tuning.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  './physical-first-position-start-v2.mjs';
import {quotePhysicalFirstPositionFrontPassV1} from
  './physical-first-position-front-pass-quote-v1.mjs';
import {choosePhysicalFirstBoundaryAttacksV1,
  choosePhysicalFirstBoundaryAttacksV2} from
  './physical-first-attack-choice-v1.mjs';

export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_VERSION=
  'physical-first-position-shared-road-km-1';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V2_VERSION=
  'physical-first-position-shared-road-km-2';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V3_VERSION=
  'physical-first-position-shared-road-km-3';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V4_VERSION=
  'physical-first-position-shared-road-km-4';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V5_VERSION=
  'physical-first-position-shared-road-km-5';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V6_VERSION=
  'physical-first-position-shared-road-km-6';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V7_VERSION=
  'physical-first-position-shared-road-km-7';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V8_VERSION=
  'physical-first-position-shared-road-km-8';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION=
  'physical-first-position-shared-road-km-9';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION=
  'physical-first-position-shared-road-km-10';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION=
  'physical-first-position-shared-road-km-11';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION=
  'physical-first-position-shared-road-km-12';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION=
  'physical-first-position-shared-road-km-13';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION=
  'physical-first-position-shared-road-km-14';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION=
  'physical-first-position-shared-road-km-15';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V16_VERSION=
  'physical-first-position-shared-road-km-16';
const STEP_SECONDS=.25;
const EPS=1e-6;

function componentsFor(rows,thresholdM){
  const sorted=[...rows].sort((a,b)=>
    b.distanceM-a.distanceM||a.riderId.localeCompare(b.riderId));
  const components=[];
  for(const row of sorted){
    if(!components.length||components.at(-1).at(-1)
      .distanceM-row.distanceM>thresholdM+EPS)
      components.push([]);
    components.at(-1).push(row);
  }
  return components.map(rows=>rows.map(row=>row.riderId));
}

const membershipKey=groups=>JSON.stringify(
  groups.map(group=>[...group].sort())
    .sort((left,right)=>{
      const a=left.join('\u0000');
      const b=right.join('\u0000');
      return a<b?-1:Number(a>b);
    }));

function speedFor(source,segment,energy,role){
  const order=orderAt(source.team.orders,segment.km-1);
  const ability=riderKilometreEffect(source.rider,segment,{
    phase:role==='sheltered'?'cruise':
      role==='attack'?'attack':'solo',
    energy,exposed:segment.exposed}).ability+
    (TUNING.effortPressure[order.effort]-1)*20+
    (role==='sheltered'?
      MOTOR_DRAFT_SHELTER[segment.terrain]:0);
  const seconds=segmentBaseSeconds(segment)+
    (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Shared road lacks payable speed.');
  return 1000/seconds;
}

function priceTravel(source,segment,input,energyBefore,legs){
  let energy=energyBefore;
  let paidFromReserve=0;
  for(const leg of legs){
    const localSegment=input.kilometres[leg.sourceKm-1];
    let remaining=leg.distanceM;
    while(remaining>EPS){
      const distanceM=Math.min(1000,remaining);
      let priced;
      try{
        priced=priceRearEnergyDemandV1({
          rider:source.rider,segment:localSegment,
          energyBefore:energy,
          effort:orderAt(source.team.orders,
            segment.km-1).effort,
          role:leg.energyRole??leg.role,distanceM});
      }catch(error){
        throw new Error(`Shared road unpaid travel at km ${segment.km}, `+
          `rider ${source.rider.id}, source km ${leg.sourceKm}, `+
          `role ${leg.energyRole??leg.role}, `+
          `distance ${distanceM.toFixed(3)} m, `+
          `energy ${energy.toFixed(3)}: ${error.message}`,
        {cause:error});
      }
      energy=priced.energyAfter;
      paidFromReserve+=priced.energyDemand;
      remaining-=distanceM;
    }
  }
  return {energy,paidFromReserve};
}

function segmentAt(input,distanceM){
  const index=Math.min(input.kilometres.length-1,
    Math.max(0,Math.floor((distanceM+EPS)/1000)));
  return input.kilometres[index];
}

function advanceSharedRoad({priorPeloton,
  priorSolos=[],segment,input,
  frontPassCandidateId=null,
  attackChoice=null,version}){
  const featureVersion=version===
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V16_VERSION?
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION:version;
  const priorFeatureVersion=priorPeloton?.version===
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V16_VERSION?
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION:
    priorPeloton?.version;
  const km=priorPeloton?.sourceKm+1;
  const passingCorridor=[
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V3_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V4_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V5_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V6_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V7_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V8_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION]
    .includes(featureVersion);
  const leaderPaid=[
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V4_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V5_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V6_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V7_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V8_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION]
    .includes(featureVersion);
  const passDropped=[
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V5_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V6_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V7_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V8_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION]
    .includes(featureVersion);
  const attackEnabled=featureVersion===
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V6_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V7_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V8_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION;
  const attackCorridor=featureVersion===
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V7_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V8_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION;
  const cooperativeContactPace=featureVersion===
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V8_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION;
  const simultaneousFrontAttack=featureVersion===
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION;
  const startWithoutSolo=featureVersion===
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION;
  const earlyFinish=featureVersion===
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION;
  const membershipOnlyContact=featureVersion===
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION;
  const continuing=[
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V2_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V3_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V4_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V5_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V6_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V7_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V8_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION]
    .includes(priorFeatureVersion);
  const activeSolos=continuing?
    priorPeloton.positions.filter(row=>
      row.roadId===`solo:${row.riderId}`):
    priorSolos;
  if(!Array.isArray(priorSolos)||
    continuing&&priorSolos.length||
    !continuing&&!priorSolos.length&&
      !startWithoutSolo||
    segment?.km!==km||
    !isDeepStrictEqual(segment,input?.kilometres?.[km-1])||
    !Array.isArray(priorPeloton?.positions)||
    !priorPeloton.positions.length||
    !Number.isFinite(priorPeloton.clockSeconds)||
    !Number.isFinite(priorPeloton.grid?.wheelSpacingM)||
    passingCorridor&&
      input?.positionPassingCorridorCount!==1||
    priorPeloton.frontDistanceM!==(km-1)*1000||
    (frontPassCandidateId!==null&&
      (![PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V2_VERSION,
        PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V3_VERSION,
        PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V4_VERSION,
        PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V5_VERSION,
        PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V6_VERSION,
        PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V7_VERSION,
        PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V8_VERSION,
        PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION,
        PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION,
        PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION,
        PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION,
        PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION,
        PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION,
        PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION]
        .includes(featureVersion)||
        typeof frontPassCandidateId!=='string'))||
    (attackChoice!==null&&
      (!attackEnabled||
        frontPassCandidateId!==null&&
          !simultaneousFrontAttack||
        activeSolos.length&&
          !startWithoutSolo||
        attackChoice.choice!==
          'attempt_paid_attack'||
        attackChoice.sourceKm!==km||
        typeof attackChoice.riderId!==
          'string'))||
    !continuing&&!isDeepStrictEqual(
      [...(priorPeloton.separateRoadRiderIds??[])]
        .sort(),
      priorSolos.map(row=>row.riderId).sort()))
    throw new Error('Shared road needs committed paid positions.');
  const start=createPhysicalFirstPositionStartV2({
    input,grid:priorPeloton.grid});
  const positionModelConfigHash=passingCorridor?
    createHash('sha256').update(JSON.stringify({
      sourceInputHash:start.inputHash,
      version,positionPassingCorridorCount:1}))
      .digest('hex'):null;
  if(priorPeloton.inputHash!==start.inputHash||
    continuing&&[
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V3_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V4_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V5_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V6_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V7_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V8_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION]
      .includes(priorFeatureVersion)&&
      priorPeloton.positionModelConfigHash!==
        positionModelConfigHash||
    input.positionModelVersion!==
      PHYSICAL_FIRST_POSITION_START_V2_VERSION)
    throw new Error('Shared road changed committed race input.');
  const sources=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{team,rider}])));
  // Reserve changes only after this shared kilometre has been settled.
  // A rider's speed for one source segment and role is therefore stable
  // across the quarter-second observations within this call.
  const speedCache=new Map();
  const paidSpeedFor=(riderId,localSegment,energy,role)=>{
    const key=`${role}:${localSegment.km}:${riderId}`;
    if(!speedCache.has(key))
      speedCache.set(key,speedFor(sources.get(riderId),
        localSegment,energy,role));
    return speedCache.get(key);
  };
  const initial=[...priorPeloton.positions,
    ...(continuing?[]:priorSolos)];
  if(new Set(initial.map(row=>row.riderId)).size!==
      initial.length||sources.size!==initial.length||
    initial.some(row=>!sources.has(row.riderId)||
      sources.get(row.riderId).team.id!==row.teamId||
      !Number.isFinite(row.distanceM)||
      !Number.isFinite(row.energy)||row.energy<0||
      !Number.isInteger(row.lane)||
      row.lane<0||row.lane>=
        priorPeloton.grid.laneCount+
          Number(passingCorridor)||
      earlyFinish&&(
        row.roadId==='finished'?(
          row.distanceM!==input.kilometres.length*1000||
          !Number.isFinite(row.finishedAtClockSeconds)||
          row.finishedAtClockSeconds>
            priorPeloton.clockSeconds):
          row.finishedAtClockSeconds!==undefined))||
    activeSolos.some(row=>row.roadId!==
      `solo:${row.riderId}`||
      !continuing&&row.distanceM<=
        priorPeloton.frontDistanceM+EPS||
      row.clockSeconds!==priorPeloton.clockSeconds))
    throw new Error('Shared road has an unpriced rider source.');
  let frontId=priorPeloton.leaderRiderId;
  const front=priorPeloton.positions.find(row=>
    row.riderId===frontId);
  if(!front||front.distanceM!==
      priorPeloton.frontDistanceM)
    throw new Error('Shared road lacks its paid bunch leader.');
  const motion=initial.map(row=>({
    ...row,startDistanceM:row.distanceM,
    legs:[]}));
  const byId=new Map(motion.map(row=>[
    row.riderId,row]));
  let leader=byId.get(frontId);
  if(attackChoice){
    const peloton=priorPeloton.positions.filter(row=>
      row.roadId==='peloton');
    const choicePrior={sourceKm:km-1,
      frontDistanceM:priorPeloton.frontDistanceM,
      roads:[{roadId:'peloton',
        riderIds:peloton.map(row=>row.riderId),
        clockSeconds:priorPeloton.clockSeconds}],
      riders:priorPeloton.positions.map(row=>({
        riderId:row.riderId,teamId:row.teamId,
        roadId:row.roadId,
        distanceM:row.roadId==='peloton'?
          (km-1)*1000:row.distanceM,
        clockSeconds:priorPeloton.clockSeconds,
        reserve:row.energy,quietKm:row.quietKm}))};
    const attempts=([PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION]
      .includes(featureVersion)?
      choosePhysicalFirstBoundaryAttacksV2:
      choosePhysicalFirstBoundaryAttacksV1)({
      prior:choicePrior,segment,
      teams:input.teams,stakes:input.stakes,
      kilometres:input.kilometres})
      .filter(row=>row.choice===
        'attempt_paid_attack');
    const oneCorridor=featureVersion===
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION||
      featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION||
      featureVersion===PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION;
    const selected=oneCorridor?
      [...attempts].sort((a,b)=>
        b.perceivedAbilityAtChoice-
          a.perceivedAbilityAtChoice||
        a.riderId.localeCompare(b.riderId))[0]:
      attempts[0];
    if(!attempts.length||
      !oneCorridor&&attempts.length!==1||
      !isDeepStrictEqual(selected,
        attackChoice))
      throw new Error(
        'Shared road attack differs from committed choice.');
  }
  const frontPassQuote=frontPassCandidateId?
    quotePhysicalFirstPositionFrontPassV1({
      prior:priorPeloton,segment,input}):null;
  if(frontPassCandidateId&&
    frontPassQuote?.toRiderId!==
      frontPassCandidateId)
    throw new Error('Shared road lacks a payable front pass quote.');
  const parallelAttempt=Boolean(simultaneousFrontAttack&&
    frontPassCandidateId&&attackChoice);
  const requestedCandidateId=frontPassCandidateId??
    attackChoice?.riderId??null;
  let candidate=requestedCandidateId?
    byId.get(requestedCandidateId):null;
  let parallelAttackCandidate=parallelAttempt?
      byId.get(attackChoice.riderId):null;
  if(parallelAttempt&&!parallelAttackCandidate)
    throw new Error(
      'Shared road parallel attacker is absent.');
  if(candidate&&candidate.roadId!=='peloton')
    throw new Error('Shared road front worker lacks bunch contact.');
  if(parallelAttackCandidate&&
    (parallelAttackCandidate===candidate||
      parallelAttackCandidate.roadId!=='peloton'))
    throw new Error(
      'Shared road parallel attack lacks a distinct bunch rider.');
  let attackRefusal=null;
  let attackCorridorEntry=null;
  if(attackChoice){
    const actor=parallelAttackCandidate??candidate;
    const clearOwnLane=actor&&
      actor.riderId!==frontId&&
      actor.lane!==leader.lane&&
      !motion.some(row=>row!==actor&&
        (!earlyFinish||row.finishedAtClockSeconds===undefined)&&
        row.lane===actor.lane&&
        row.distanceM>actor.distanceM+EPS);
    const corridorLane=priorPeloton.grid.laneCount;
    const clearCorridor=attackCorridor&&actor&&
      actor.riderId!==frontId&&
      motion.every(row=>row===actor||
        earlyFinish&&row.finishedAtClockSeconds!==undefined||
        row.lane!==corridorLane||
        Math.abs(row.distanceM-actor.distanceM)>=
          priorPeloton.grid.wheelSpacingM-EPS);
    const attackSpeed=clearCorridor||clearOwnLane?
      paidSpeedFor(actor.riderId,segment,
        actor.energy-attackChoice.attackInitiationCost,
        'attack'):null;
    const frontSpeed=clearCorridor||clearOwnLane?
      paidSpeedFor(frontId,segment,
        leader.energy,'leader'):null;
    const availableSeconds=frontSpeed?
      (km*1000-leader.distanceM)/frontSpeed:0;
    const paidRunway=Boolean(attackSpeed&&frontSpeed&&
      (attackSpeed-frontSpeed)*availableSeconds>
        leader.distanceM-actor.distanceM+
          priorPeloton.grid.wheelSpacingM*2+EPS);
    const corridorRunway=clearCorridor&&paidRunway;
    // V15 refuses an attack that cannot physically reach separation,
    // even when the rider starts in an otherwise clear own lane.
    const clear=featureVersion===
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION?
      paidRunway&&(clearOwnLane||clearCorridor):
      clearOwnLane||corridorRunway;
    if(!clear){
      attackRefusal={version,
        type:'attack_pass_refused',
        sourceKm:km,
        riderId:attackChoice.riderId,
        reason:(clearCorridor||clearOwnLane)&&!paidRunway?
          'insufficient_paid_attack_runway':
          'no_clear_paid_passing_lane'};
      if(parallelAttackCandidate)
        parallelAttackCandidate=null;
      else candidate=null;
    }else{
      const cost=attackChoice.attackInitiationCost;
      if(!Number.isFinite(cost)||cost<=0||
        actor.energy<=cost+EPS)
        throw new Error(
          'Shared road attacker cannot pay initiation.');
      actor.attackStartEnergy=actor.energy;
      actor.energy-=cost;
      if(!clearOwnLane&&attackCorridor){
        attackCorridorEntry={version,
          type:'paid_attack_passing_lane_entry',
          sourceKm:km,
          riderId:actor.riderId,
          fromLane:actor.lane,
          toLane:corridorLane,
          atClockSeconds:priorPeloton.clockSeconds,
          atDistanceM:actor.distanceM};
        actor.attackReturnLane=actor.lane;
        actor.lane=corridorLane;
      }
    }
  }
  let frontPassEvent=null;
  let attackDepartureEvent=null;
  const thresholdM=priorPeloton.grid.wheelSpacingM*2;
  const contactEvents=[];
  const contactPaceEvents=[];
  const recordedPacePairs=new Set();
  const cooperativeRiderIds=new Set(cooperativeContactPace?
    motion.filter(row=>orderAt(sources.get(row.riderId)
      .team.orders,km-1).breakWork==='cooperate')
      .map(row=>row.riderId):[]);
  const soloCatchEvents=[];
  const laneChangeEvents=[];
  if(attackCorridorEntry)
    laneChangeEvents.push(attackCorridorEntry);
  const checkpointCrossings=[];
  const earlyFinishCrossings=[];
  const activeMotion=()=>earlyFinish?
    motion.filter(row=>row.finishedAtClockSeconds===undefined):
    motion;
  let previous=componentsFor(activeMotion(),thresholdM);
  let previousMembership=membershipOnlyContact?
    membershipKey(previous):null;
  if(activeSolos.some(row=>previous.some(group=>
    group.includes(frontId)&&
      group.includes(row.riderId))))
    throw new Error('Shared road starts with unrecorded solo contact.');
  const caughtSoloIds=new Set(
    passingCorridor?
      priorPeloton.caughtRiderIds??
        priorPeloton.caughtSoloRiderIds??[]:
      []);
  const launchedSoloRows=[];
  let elapsedSeconds=0;
  const maxSeconds=300;
  const handoffDistanceM=featureVersion===
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION&&
    km===input.kilometres.length?
    km*1000-300:km*1000;
  while(leader.distanceM<handoffDistanceM-EPS){
    if(elapsedSeconds>=maxSeconds)
      throw new Error('Shared road lost its payable front.');
    if(passingCorridor){
      const corridorLane=priorPeloton.grid.laneCount;
      const ordered=[...activeMotion()].sort((a,b)=>
        b.distanceM-a.distanceM||
          a.riderId.localeCompare(b.riderId));
      for(const row of ordered){
        if(row.lane!==corridorLane||
          !Number.isInteger(row.returnLane)||
          typeof row.passingRiderId!=='string')
          continue;
        const passed=byId.get(row.passingRiderId);
        if(!passed||row.distanceM-passed.distanceM<
          priorPeloton.grid.wheelSpacingM-EPS)
          continue;
        const clear=ordered.filter(other=>
          other!==row&&other.lane===row.returnLane)
          .every(other=>Math.abs(
            other.distanceM-row.distanceM)>=
            priorPeloton.grid.wheelSpacingM-EPS);
        if(!clear)continue;
        laneChangeEvents.push({version,
          type:row.passingObstacleType===
            'slower_bunch_worker'?
            'paid_exposed_bunch_worker_rejoin':
            'paid_exposed_caught_rider_rejoin',
          sourceKm:km,riderId:row.riderId,
          passedRiderId:passed.riderId,
          fromLane:corridorLane,
          toLane:row.returnLane,
          atClockSeconds:
            priorPeloton.clockSeconds+
              elapsedSeconds,
          atDistanceM:row.distanceM});
        row.lane=row.returnLane;
        delete row.returnLane;
        delete row.passingRiderId;
        delete row.passingObstacleType;
      }
      for(const row of ordered){
        if(row.lane>=corridorLane||
          caughtSoloIds.has(row.riderId)||
          row.riderId===frontId&&
            !simultaneousFrontAttack)continue;
        const ahead=ordered.findLast(other=>
          other.lane===row.lane&&
          other.distanceM>row.distanceM+EPS);
        const slowerWorker=passDropped&&
          row.roadId==='peloton'&&
          ahead?.roadId==='peloton'&&
          paidSpeedFor(row.riderId,segment,
            row.energy,'sheltered')>=
            paidSpeedFor(frontId,segment,
              leader.energy,'leader')-EPS&&
          paidSpeedFor(ahead.riderId,segment,
            ahead.energy,'sheltered')<
            paidSpeedFor(frontId,segment,
              leader.energy,'leader')-EPS;
        if(!ahead||
          !caughtSoloIds.has(ahead.riderId)&&
            !slowerWorker||
          ahead.distanceM-row.distanceM>
            thresholdM+EPS)continue;
        const safe=ordered.filter(other=>
          other.lane===corridorLane)
          .every(other=>Math.abs(
            other.distanceM-row.distanceM)>=
            priorPeloton.grid.wheelSpacingM-EPS);
        if(!safe)continue;
        laneChangeEvents.push({version,
          type:slowerWorker?
            'paid_exposed_bunch_worker_pass_entry':
            'paid_exposed_caught_rider_pass',
          sourceKm:km,riderId:row.riderId,
          passedRiderId:ahead.riderId,
          fromLane:row.lane,
          toLane:corridorLane,
          atClockSeconds:
            priorPeloton.clockSeconds+
              elapsedSeconds,
          atDistanceM:row.distanceM});
        row.returnLane=row.lane;
        row.passingRiderId=ahead.riderId;
        if(slowerWorker)
          row.passingObstacleType=
            'slower_bunch_worker';
        row.lane=corridorLane;
      }
    }
    const ranked=[...activeMotion()].sort((a,b)=>
      b.distanceM-a.distanceM||
        a.riderId.localeCompare(b.riderId));
    const predecessor=new Map();
    const laneAhead=new Map();
    const roleById=new Map();
    const cooperativeLeadByFollower=new Map();
    if(cooperativeContactPace)
      for(const group of previous){
        if(group.length!==2||
          group.includes(frontId)||
          !group.every(id=>
            cooperativeRiderIds.has(id)))
          continue;
        cooperativeLeadByFollower.set(
          group[1],byId.get(group[0]));
      }
    for(let index=0;index<ranked.length;index++){
      const row=ranked[index];
      predecessor.set(row.riderId,
        laneAhead.get(row.lane)??null);
      laneAhead.set(row.lane,row);
      const exposed=row.riderId===frontId||
        index===0||ranked[index-1].distanceM-
          row.distanceM>thresholdM+EPS;
      roleById.set(row.riderId,
        exposed?(row.roadId===`solo:${row.riderId}`&&
          !caughtSoloIds.has(row.riderId)?
          'solo':'leader'):'sheltered');
    }
    const leaderSpeed=paidSpeedFor(frontId,
      segment,leader.energy,'leader');
    const candidateSpeed=candidate&&
      !frontPassEvent&&
      (parallelAttempt||!attackDepartureEvent)?
      paidSpeedFor(candidate.riderId,
        segment,candidate.energy,'attack'):null;
    const stepSeconds=Math.min(STEP_SECONDS,
      (handoffDistanceM-leader.distanceM)/leaderSpeed,
      candidateSpeed&&candidate.distanceM<
        km*1000-EPS?
        (km*1000-candidate.distanceM)/
          candidateSpeed:Infinity);
    if(stepSeconds<=EPS)
      throw new Error('Shared road lost its payable front time.');
    for(const row of ranked){
      const role=row.riderId===
        candidate?.riderId&&
        !frontPassEvent&&
        (parallelAttempt||
          !attackDepartureEvent)||
        row.riderId===
          parallelAttackCandidate?.riderId&&
          !attackDepartureEvent?'attack':
        passingCorridor&&
          row.lane===priorPeloton.grid.laneCount?
          'leader':roleById.get(row.riderId);
      const ahead=predecessor.get(row.riderId);
      const cap=ahead?
        ahead.distanceM-priorPeloton.grid.wheelSpacingM:
        Infinity;
      let remainingSeconds=stepSeconds;
      let elapsedWithinStep=0;
      let totalTravelM=0;
      while(remainingSeconds>EPS){
        const localSegment=segmentAt(input,
          row.distanceM);
        let speed=paidSpeedFor(row.riderId,
          localSegment,row.energy,role);
        const cooperativeLead=role==='sheltered'?
          cooperativeLeadByFollower.get(
            row.riderId):null;
        const unrestrainedSpeed=speed;
        if(cooperativeLead)
          speed=Math.min(speed,paidSpeedFor(
            cooperativeLead.riderId,localSegment,
            cooperativeLead.energy,'leader'));
        if(row.roadId==='peloton'&&
          row.riderId!==frontId&&
          row.riderId!==candidate?.riderId&&
          row.riderId!==
            parallelAttackCandidate?.riderId)
          speed=Math.min(speed,leaderSpeed);
        const boundaryM=Math.min(
          input.kilometres.length*1000,
          localSegment.km*1000);
        // An approaching rear road may make paid contact with the bunch.
        // Without an explicit passing choice it settles behind its named
        // front, even when its independent pace could carry it past.
        const rearApproachCap=version===
          PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V16_VERSION&&
          row.roadId.startsWith('rear:')?
          Math.max(0,leader.distanceM-row.distanceM):Infinity;
        const travelM=Math.max(0,Math.min(
          speed*remainingSeconds,
          cap-row.distanceM,
          rearApproachCap,
          boundaryM-row.distanceM));
        if(travelM<=EPS)break;
        if(cooperativeLead&&
          speed<unrestrainedSpeed-EPS){
          const pair=`${cooperativeLead.riderId}:`+
            row.riderId;
          if(!recordedPacePairs.has(pair)){
            contactPaceEvents.push({version,
              type:'paid_cooperative_shelter_pace',
              sourceKm:km,
              leaderRiderId:
                cooperativeLead.riderId,
              followerRiderId:row.riderId,
              unrestrainedSpeedMps:
                unrestrainedSpeed,
              heldSpeedMps:speed,
              observedAtClockSeconds:
                priorPeloton.clockSeconds+
                  elapsedSeconds,
              observedAtDistanceM:row.distanceM});
            recordedPacePairs.add(pair);
          }
        }
        row.distanceM+=travelM;
        totalTravelM+=travelM;
        const spentSeconds=travelM/speed;
        elapsedWithinStep+=spentSeconds;
        remainingSeconds-=spentSeconds;
        const paidRole=role==='attack'?
          'solo':role;
        const energyRole=leaderPaid&&
          (role==='solo'||role==='attack')?
          'leader':undefined;
        const last=row.legs.at(-1);
        if(last?.role===paidRole&&
          last.energyRole===energyRole&&
          last.sourceKm===localSegment.km)
          last.distanceM+=travelM;
        else row.legs.push({
          role:paidRole,
          ...(energyRole?{energyRole}:{}),
          sourceKm:localSegment.km,
          distanceM:travelM});
        if(row.distanceM>=boundaryM-EPS&&
          boundaryM<
            input.kilometres.length*1000-EPS)
          checkpointCrossings.push({
            riderId:row.riderId,
            km:localSegment.km,
            lineDistanceM:boundaryM,
            clockSeconds:priorPeloton.clockSeconds+
              elapsedSeconds+elapsedWithinStep});
        if(earlyFinish&&row.distanceM>=
          input.kilometres.length*1000-EPS){
          row.distanceM=input.kilometres.length*1000;
          row.finishedAtClockSeconds=
            priorPeloton.clockSeconds+
              elapsedSeconds+elapsedWithinStep;
          earlyFinishCrossings.push({
            riderId:row.riderId,
            lineDistanceM:row.distanceM,
            clockSeconds:row.finishedAtClockSeconds});
          break;
        }
      }
      if(row.riderId===frontId&&
        totalTravelM<leaderSpeed*stepSeconds-EPS&&
        predecessor.get(frontId)?.roadId!==
          `solo:${predecessor.get(frontId)?.riderId}`)
        throw new Error(
          `Shared road leader blocked by its lane at km ${km}: ${frontId}, ahead ${predecessor.get(frontId)?.riderId??'none'}.`);
    }
    elapsedSeconds+=stepSeconds;
    if(candidate&&!frontPassEvent&&
      (parallelAttempt||!attackDepartureEvent)&&
      candidate.distanceM>=leader.distanceM+
        (attackChoice&&!parallelAttempt?
          thresholdM+EPS:
          priorPeloton.grid.wheelSpacingM-EPS)){
      const surgePayment=priceTravel(
        sources.get(candidate.riderId),
        segment,input,candidate.energy,
        candidate.legs);
      const event={
        version,
        type:attackChoice&&!parallelAttempt?
          'paid_attack_departure':
          'paid_front_pass',
        sourceKm:km,
        fromRiderId:frontId,
        toRiderId:candidate.riderId,
        passingLane:candidate.lane,
        observedAtClockSeconds:
          priorPeloton.clockSeconds+
            elapsedSeconds,
        observedAfterPaidStepSeconds:stepSeconds,
        newFrontDistanceM:candidate.distanceM,
        oldFrontDistanceM:leader.distanceM,
        surgeDistanceM:candidate.distanceM-
          candidate.startDistanceM,
        surgePaidFromReserve:
          surgePayment.paidFromReserve+
          (parallelAttempt?0:
            attackChoice?.attackInitiationCost??0),
        ...(attackChoice&&!parallelAttempt?{
          attackInitiationCost:
            attackChoice.attackInitiationCost,
          attackChoice}:{}),
        };
      if(attackChoice&&!parallelAttempt){
        attackDepartureEvent=event;
        candidate.roadId=`solo:${candidate.riderId}`;
        launchedSoloRows.push(candidate);
        if(candidate.attackReturnLane!==undefined){
          const returnLane=candidate.attackReturnLane;
          const clear=activeMotion().every(row=>
            row===candidate||row.lane!==returnLane||
            Math.abs(row.distanceM-
              candidate.distanceM)>=
              priorPeloton.grid.wheelSpacingM-EPS);
          if(!clear)
            throw new Error(
              'Paid attack cannot return from passing lane.');
          laneChangeEvents.push({version,
            type:'paid_attack_passing_lane_return',
            sourceKm:km,
            riderId:candidate.riderId,
            fromLane:candidate.lane,
            toLane:returnLane,
            atClockSeconds:
              priorPeloton.clockSeconds+
                elapsedSeconds,
            atDistanceM:candidate.distanceM});
          candidate.lane=returnLane;
          delete candidate.attackReturnLane;
        }
      }else{
        frontPassEvent=event;
        frontId=candidate.riderId;
        leader=candidate;
      }
    }
    if(parallelAttackCandidate&&
      !attackDepartureEvent&&
      parallelAttackCandidate.distanceM>=
        leader.distanceM+thresholdM+EPS){
      const actor=parallelAttackCandidate;
      const payment=priceTravel(
        sources.get(actor.riderId),
        segment,input,actor.energy,actor.legs);
      attackDepartureEvent={version,
        type:'paid_attack_departure',
        sourceKm:km,
        fromRiderId:frontId,
        toRiderId:actor.riderId,
        passingLane:actor.lane,
        observedAtClockSeconds:
          priorPeloton.clockSeconds+
            elapsedSeconds,
        observedAfterPaidStepSeconds:stepSeconds,
        newFrontDistanceM:actor.distanceM,
        oldFrontDistanceM:leader.distanceM,
        surgeDistanceM:actor.distanceM-
          actor.startDistanceM,
        surgePaidFromReserve:
          payment.paidFromReserve+
          attackChoice.attackInitiationCost,
        attackInitiationCost:
          attackChoice.attackInitiationCost,
        attackChoice};
      actor.roadId=`solo:${actor.riderId}`;
      launchedSoloRows.push(actor);
      if(actor.attackReturnLane!==undefined){
        const returnLane=actor.attackReturnLane;
        const clear=activeMotion().every(row=>
          row===actor||row.lane!==returnLane||
          Math.abs(row.distanceM-
            actor.distanceM)>=
            priorPeloton.grid.wheelSpacingM-EPS);
        if(!clear)
          throw new Error(
            'Parallel attack cannot return from passing lane.');
        laneChangeEvents.push({version,
          type:'paid_attack_passing_lane_return',
          sourceKm:km,
          riderId:actor.riderId,
          fromLane:actor.lane,
          toLane:returnLane,
          atClockSeconds:
            priorPeloton.clockSeconds+
              elapsedSeconds,
          atDistanceM:actor.distanceM});
        actor.lane=returnLane;
        delete actor.attackReturnLane;
      }
    }
    const current=componentsFor(activeMotion(),thresholdM);
    const activeFrontId=earlyFinish&&
      leader.finishedAtClockSeconds!==undefined?
      activeMotion().filter(row=>
        row.roadId==='peloton').sort((a,b)=>
        b.distanceM-a.distanceM)[0]?.riderId:
      frontId;
    const frontComponent=current.find(group=>
      group.includes(activeFrontId));
    for(const row of [...activeSolos,
      ...launchedSoloRows]){
      if(frontComponent?.includes(row.riderId)&&
        !caughtSoloIds.has(row.riderId)){
        soloCatchEvents.push({
          version,
          type:'paid_solo_peloton_contact',
          sourceKm:km,riderId:row.riderId,
          observedAtClockSeconds:
            priorPeloton.clockSeconds+elapsedSeconds,
          observedAfterPaidStepSeconds:stepSeconds,
          soloDistanceM:byId.get(row.riderId)
            .distanceM,
          pelotonFrontDistanceM:
            leader.distanceM,
          contactRiderIds:[...frontComponent],
          contactThresholdM:thresholdM});
        caughtSoloIds.add(row.riderId);
      }
    }
    const currentMembership=membershipOnlyContact?
      membershipKey(current):null;
    if(membershipOnlyContact?
      currentMembership!==previousMembership:
      !isDeepStrictEqual(current,previous)){
      contactEvents.push({
        version,
        type:'paid_contact_topology_observation',
        sourceKm:km,
        observedAtClockSeconds:
          priorPeloton.clockSeconds+elapsedSeconds,
        observedAfterPaidStepSeconds:stepSeconds,
        components:membershipOnlyContact?
          current.map(group=>[...group].sort()):
          current});
      previous=current;
    }
    if(membershipOnlyContact){
      previous=current;
      previousMembership=currentMembership;
    }
  }
  const components=componentsFor(activeMotion(),thresholdM);
  const topologyFrontId=earlyFinish&&
    leader.finishedAtClockSeconds!==undefined?
    activeMotion().filter(row=>
      row.roadId==='peloton').sort((a,b)=>
      b.distanceM-a.distanceM)[0]?.riderId:
    frontId;
  const pelotonComponent=components.find(group=>
    group.includes(topologyFrontId));
  const soloActors=[...activeSolos,
    ...launchedSoloRows];
  const joinedSoloRiderIds=soloActors.filter(row=>
    pelotonComponent?.includes(row.riderId))
    .map(row=>row.riderId);
  const caughtSoloRiderIds=[...caughtSoloIds];
  const roadById=new Map(components.flatMap(
    (group,index)=>group.map(id=>[
      id,group.includes(topologyFrontId)?'peloton':
    soloActors.some(row=>row.riderId===id)&&
          (!passingCorridor||
            !caughtSoloIds.has(id))&&
          group.length===1?`solo:${id}`:
          `rear:${index}`])));
  const decisions=[];
  const positions=motion.map(row=>{
    if(earlyFinish&&row.finishedAtClockSeconds!==undefined&&
      row.legs.length===0){
      if(row.distanceM!==input.kilometres.length*1000||
        row.startDistanceM!==row.distanceM)
        throw new Error('Finished rider changed without paid movement.');
      decisions.push({riderId:row.riderId,
        roadId:'finished',choice:'already_finished',
        legs:[],energyBefore:row.energy,
        paidDistanceM:0,paidFromReserve:0,
        recoveryAward:0,capAdjustment:0,
        energyAfter:row.energy});
      const {legs,startDistanceM,...position}=row;
      return {...position,roadId:'finished',
        clockSeconds:priorPeloton.clockSeconds+
          elapsedSeconds};
    }
    const source=sources.get(row.riderId);
    const order=orderAt(source.team.orders,km-1);
    const initiationCost=row.attackStartEnergy===
      undefined?0:
      row.attackStartEnergy-row.energy;
    const priced=priceTravel(source,segment,input,
      row.energy,row.legs);
    const roadId=earlyFinish&&
      row.finishedAtClockSeconds!==undefined?
      'finished':roadById.get(row.riderId);
    const working=row.legs.some(leg=>
      leg.role!=='sheltered');
    const localCrossings=checkpointCrossings.filter(
      crossing=>crossing.riderId===row.riderId);
    let quietKm=roadId==='peloton'&&!working?
      row.quietKm:0;
    let recoveryAward=0;
    for(const crossing of localCrossings){
      const recovery=recoveryForKilometre({
        rider:source.rider,
        segment:input.kilometres[
          crossing.km-1],
        effort:order.effort,
        group:roadId,working,
        quietKm});
      quietKm=recovery.quietKm;
      recoveryAward+=recovery.recovery;
    }
    const completedKm=Math.min(
      input.kilometres.length,
      Math.floor((row.distanceM+EPS)/1000));
    const cap=replayRearEnergyCapV1({
      rider:source.rider,
      kilometres:input.kilometres,
      throughKm:completedKm}).cap;
    const paidDistanceM=row.distanceM-
      row.startDistanceM;
    if(paidDistanceM<=EPS||
      Math.abs(paidDistanceM-row.legs.reduce(
        (sum,leg)=>sum+leg.distanceM,0))>EPS)
      throw new Error('Shared road has unpaid movement.');
    const energyAfter=+Math.min(cap,
      priced.energy+recoveryAward).toFixed(3);
    decisions.push({riderId:row.riderId,
      roadId,legs:row.legs,
      energyBefore:row.attackStartEnergy??
        row.energy,
      paidDistanceM,
      paidFromReserve:priced.paidFromReserve+
        initiationCost,
      ...(initiationCost?{
        attackInitiationCost:
          initiationCost}:{}),
      recoveryAward,
      capAdjustment:Math.max(0,
        priced.energy+recoveryAward-cap),
      energyAfter});
    const {legs,startDistanceM,
      attackStartEnergy,...position}=row;
    return {...position,roadId,
      paidDistanceM:row.paidDistanceM+
        paidDistanceM,energy:energyAfter,
      quietKm,
      clockSeconds:priorPeloton.clockSeconds+
        elapsedSeconds};
  }).sort((a,b)=>b.distanceM-a.distanceM||
    a.riderId.localeCompare(b.riderId));
  const finishDistanceM=input.kilometres.length*1000;
  if(positions.some(row=>row.distanceM>
      finishDistanceM+EPS)||
    !earlyFinish&&km<input.kilometres.length&&
      positions.some(row=>row.distanceM>=
        finishDistanceM-EPS))
    throw new Error('Shared road needs an early finish contract.');
  if(frontPassCandidateId&&
    !frontPassEvent)
    throw new Error('Shared road front pass was not paid.');
  if(attackChoice&&
    (parallelAttempt?
      parallelAttackCandidate:candidate)&&
    !attackRefusal&&
    !attackDepartureEvent)
    throw new Error(
      'Shared road attack did not earn physical separation.');
  if(passingCorridor&&laneChangeEvents.some(event=>
    !decisions.find(row=>row.riderId===
      event.riderId)?.legs.some(leg=>
      (leg.role==='leader'||
        leg.energyRole==='leader')&&
      leg.distanceM>EPS)))
    throw new Error('Shared road has an unpaid lane change.');
  return {version,
  sourceKm:km,
  inputHash:priorPeloton.inputHash,
  ...(passingCorridor?{
    positionModelConfigHash}:{}),
  raceSeed:priorPeloton.raceSeed,
  grid:{...priorPeloton.grid},
  clockSeconds:priorPeloton.clockSeconds+
    elapsedSeconds,
  frontDistanceM:handoffDistanceM,
  leaderRiderId:frontId,
  ...([PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V2_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V3_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V4_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V5_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V6_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V7_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V8_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION]
    .includes(featureVersion)?
    {frontPassEvent}:{}),
  ...(attackEnabled?{
    attackChoice,
    attackDepartureEvent,
    attackRefusal}:{}),
  contactThresholdM:thresholdM,
  contactEvents,soloCatchEvents,
  ...(cooperativeContactPace?{
    contactPaceEvents}:{}),
  ...(passingCorridor?{
    laneChangeEvents,
    caughtRiderIds:[...caughtSoloIds]}:{}),
  contactComponents:components,
  ...(earlyFinish?{earlyFinishCrossings}:{}),
  caughtSoloRiderIds,joinedSoloRiderIds,
  decisions,positions,
  checkpointCrossings:checkpointCrossings.sort((a,b)=>
    a.clockSeconds-b.clockSeconds||
      a.riderId.localeCompare(b.riderId)),
  sourceGroupClockUsedForMovement:false,
  officialResults:false};
}

export function advancePhysicalFirstPositionSharedRoadKmV1(input){
  return advanceSharedRoad({...input,
    frontPassCandidateId:null,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV1(input)))
    throw new Error('Shared road differs from paid movement.');
  return recorded;
}

export function advancePhysicalFirstPositionSharedRoadKmV2(input){
  if(typeof input?.frontPassCandidateId!=='string')
    throw new Error('Shared road v2 needs a named front worker.');
  return advanceSharedRoad({...input,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V2_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV2(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV2(input)))
    throw new Error('Shared road v2 differs from paid movement.');
  return recorded;
}

export function advancePhysicalFirstPositionSharedRoadKmV3(input){
  return advanceSharedRoad({...input,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V3_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV3(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV3(input)))
    throw new Error('Shared road v3 differs from paid movement.');
  return recorded;
}

export function advancePhysicalFirstPositionSharedRoadKmV4(input){
  return advanceSharedRoad({...input,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V4_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV4(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV4(input)))
    throw new Error('Shared road v4 differs from paid movement.');
  return recorded;
}

export function advancePhysicalFirstPositionSharedRoadKmV5(input){
  return advanceSharedRoad({...input,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V5_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV5(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV5(input)))
    throw new Error('Shared road v5 differs from paid movement.');
  return recorded;
}

export function advancePhysicalFirstPositionSharedRoadKmV6(input){
  return advanceSharedRoad({...input,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V6_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV6(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV6(input)))
    throw new Error('Shared road v6 differs from paid movement.');
  return recorded;
}

export function advancePhysicalFirstPositionSharedRoadKmV7(input){
  return advanceSharedRoad({...input,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V7_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV7(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV7(input)))
    throw new Error('Shared road v7 differs from paid movement.');
  return recorded;
}

export function advancePhysicalFirstPositionSharedRoadKmV8(input){
  return advanceSharedRoad({...input,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V8_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV8(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV8(input)))
    throw new Error('Shared road v8 differs from paid movement.');
  return recorded;
}

export function advancePhysicalFirstPositionSharedRoadKmV9(input){
  return advanceSharedRoad({...input,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV9(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV9(input)))
    throw new Error('Shared road v9 differs from paid movement.');
  return recorded;
}

export function advancePhysicalFirstPositionSharedRoadKmV10(input){
  return advanceSharedRoad({...input,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV10(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV10(input)))
    throw new Error('Shared road v10 differs from paid movement.');
  return recorded;
}

export function advancePhysicalFirstPositionSharedRoadKmV11(input){
  return advanceSharedRoad({...input,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV11(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV11(input)))
    throw new Error('Shared road v11 differs from paid movement.');
  return recorded;
}

export function advancePhysicalFirstPositionSharedRoadKmV12(input){
  return advanceSharedRoad({...input,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV12(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV12(input)))
    throw new Error('Shared road v12 differs from paid movement.');
  return recorded;
}

export function advancePhysicalFirstPositionSharedRoadKmV13(input){
  return advanceSharedRoad({...input,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV13(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV13(input)))
    throw new Error('Shared road v13 differs from paid movement.');
  return recorded;
}

export function advancePhysicalFirstPositionSharedRoadKmV14(input){
  return advanceSharedRoad({...input,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV14(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV14(input)))
    throw new Error('Shared road v14 differs from paid movement.');
  return recorded;
}

export function advancePhysicalFirstPositionSharedRoadKmV15(input){
  return advanceSharedRoad({...input,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV15(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV15(input)))
    throw new Error('Shared road v15 differs from paid movement.');
  return recorded;
}

export function advancePhysicalFirstPositionSharedRoadKmV16(input){
  return advanceSharedRoad({...input,
    version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V16_VERSION});
}

export function replayPhysicalFirstPositionSharedRoadKmV16(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV16(input)))
    throw new Error('Shared road v16 differs from paid movement.');
  return recorded;
}
