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

export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_VERSION=
  'physical-first-position-shared-road-km-1';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V2_VERSION=
  'physical-first-position-shared-road-km-2';
export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V3_VERSION=
  'physical-first-position-shared-road-km-3';
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
      const priced=priceRearEnergyDemandV1({
        rider:source.rider,segment:localSegment,
        energyBefore:energy,
        effort:orderAt(source.team.orders,
          segment.km-1).effort,
        role:leg.role,distanceM});
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
  frontPassCandidateId=null,version}){
  const km=priorPeloton?.sourceKm+1;
  const passingCorridor=version===
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V3_VERSION;
  const continuing=[
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V2_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V3_VERSION]
    .includes(priorPeloton?.version);
  const activeSolos=continuing?
    priorPeloton.positions.filter(row=>
      row.roadId===`solo:${row.riderId}`):
    priorSolos;
  if(!Array.isArray(priorSolos)||
    continuing&&priorSolos.length||
    !continuing&&!priorSolos.length||
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
        PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V3_VERSION]
        .includes(version)||
        typeof frontPassCandidateId!=='string'))||
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
    continuing&&priorPeloton.version===
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V3_VERSION&&
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
          Number(passingCorridor))||
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
  const frontPassQuote=frontPassCandidateId?
    quotePhysicalFirstPositionFrontPassV1({
      prior:priorPeloton,segment,input}):null;
  if(frontPassCandidateId&&
    frontPassQuote?.toRiderId!==
      frontPassCandidateId)
    throw new Error('Shared road lacks a payable front pass quote.');
  const candidate=frontPassCandidateId?
    byId.get(frontPassCandidateId):null;
  if(candidate&&candidate.roadId!=='peloton')
    throw new Error('Shared road front worker lacks bunch contact.');
  let frontPassEvent=null;
  const thresholdM=priorPeloton.grid.wheelSpacingM*2;
  const contactEvents=[];
  const soloCatchEvents=[];
  const laneChangeEvents=[];
  const checkpointCrossings=[];
  let previous=componentsFor(motion,thresholdM);
  if(activeSolos.some(row=>previous.some(group=>
    group.includes(frontId)&&
      group.includes(row.riderId))))
    throw new Error('Shared road starts with unrecorded solo contact.');
  const caughtSoloIds=new Set(
    passingCorridor?
      priorPeloton.caughtRiderIds??
        priorPeloton.caughtSoloRiderIds??[]:
      []);
  let elapsedSeconds=0;
  const maxSeconds=300;
  while(leader.distanceM<km*1000-EPS){
    if(elapsedSeconds>=maxSeconds)
      throw new Error('Shared road lost its payable front.');
    if(passingCorridor){
      const corridorLane=priorPeloton.grid.laneCount;
      const ordered=[...motion].sort((a,b)=>
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
          type:'paid_exposed_caught_rider_rejoin',
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
      }
      for(const row of ordered){
        if(row.lane>=corridorLane||
          caughtSoloIds.has(row.riderId)||
          row.riderId===frontId)continue;
        const ahead=ordered.findLast(other=>
          other.lane===row.lane&&
          other.distanceM>row.distanceM+EPS);
        if(!ahead||
          !caughtSoloIds.has(ahead.riderId)||
          ahead.distanceM-row.distanceM>
            thresholdM+EPS)continue;
        const safe=ordered.filter(other=>
          other.lane===corridorLane)
          .every(other=>Math.abs(
            other.distanceM-row.distanceM)>=
            priorPeloton.grid.wheelSpacingM-EPS);
        if(!safe)continue;
        laneChangeEvents.push({version,
          type:'paid_exposed_caught_rider_pass',
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
        row.lane=corridorLane;
      }
    }
    const ranked=[...motion].sort((a,b)=>
      b.distanceM-a.distanceM||
        a.riderId.localeCompare(b.riderId));
    const predecessor=new Map();
    const laneAhead=new Map();
    const roleById=new Map();
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
      !frontPassEvent?
      paidSpeedFor(candidate.riderId,
        segment,candidate.energy,'attack'):null;
    const stepSeconds=Math.min(STEP_SECONDS,
      (km*1000-leader.distanceM)/leaderSpeed,
      candidateSpeed?
        (km*1000-candidate.distanceM)/
          candidateSpeed:Infinity);
    if(stepSeconds<=EPS)
      throw new Error('Shared road lost its payable front time.');
    for(const row of ranked){
      const role=passingCorridor&&
        row.lane===priorPeloton.grid.laneCount?
        'leader':row.riderId===
        candidate?.riderId&&
        !frontPassEvent?'attack':
        roleById.get(row.riderId);
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
        if(row.roadId==='peloton'&&
          row.riderId!==frontId&&
          row.riderId!==candidate?.riderId)
          speed=Math.min(speed,leaderSpeed);
        const boundaryM=Math.min(
          input.kilometres.length*1000,
          localSegment.km*1000);
        const travelM=Math.max(0,Math.min(
          speed*remainingSeconds,
          cap-row.distanceM,
          boundaryM-row.distanceM));
        if(travelM<=EPS)break;
        row.distanceM+=travelM;
        totalTravelM+=travelM;
        const spentSeconds=travelM/speed;
        elapsedWithinStep+=spentSeconds;
        remainingSeconds-=spentSeconds;
        const paidRole=role==='attack'?
          'solo':role;
        const last=row.legs.at(-1);
        if(last?.role===paidRole&&
          last.sourceKm===localSegment.km)
          last.distanceM+=travelM;
        else row.legs.push({
          role:paidRole,
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
      }
      if(row.riderId===frontId&&
        totalTravelM<leaderSpeed*stepSeconds-EPS)
        throw new Error('Shared road leader blocked by its lane.');
    }
    elapsedSeconds+=stepSeconds;
    if(candidate&&!frontPassEvent&&
      candidate.distanceM>=leader.distanceM+
        priorPeloton.grid.wheelSpacingM-EPS){
      const surgePayment=priceTravel(
        sources.get(candidate.riderId),
        segment,input,candidate.energy,
        candidate.legs);
      frontPassEvent={
        version,
        type:'paid_front_pass',
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
          surgePayment.paidFromReserve};
      frontId=candidate.riderId;
      leader=candidate;
    }
    const current=componentsFor(motion,thresholdM);
    const frontComponent=current.find(group=>
      group.includes(frontId));
    for(const row of activeSolos){
      if(frontComponent.includes(row.riderId)&&
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
    if(!isDeepStrictEqual(current,previous)){
      contactEvents.push({
        version,
        type:'paid_contact_topology_observation',
        sourceKm:km,
        observedAtClockSeconds:
          priorPeloton.clockSeconds+elapsedSeconds,
        observedAfterPaidStepSeconds:stepSeconds,
        components:current});
      previous=current;
    }
  }
  const components=componentsFor(motion,thresholdM);
  const pelotonComponent=components.find(group=>
    group.includes(frontId));
  const joinedSoloRiderIds=activeSolos.filter(row=>
    pelotonComponent.includes(row.riderId))
    .map(row=>row.riderId);
  const caughtSoloRiderIds=[...caughtSoloIds];
  const roadById=new Map(components.flatMap(
    (group,index)=>group.map(id=>[
      id,group.includes(frontId)?'peloton':
    activeSolos.some(row=>row.riderId===id)&&
          (!passingCorridor||
            !caughtSoloIds.has(id))&&
          group.length===1?`solo:${id}`:
          `rear:${index}`])));
  const decisions=[];
  const positions=motion.map(row=>{
    const source=sources.get(row.riderId);
    const order=orderAt(source.team.orders,km-1);
    const priced=priceTravel(source,segment,input,
      row.energy,row.legs);
    const roadId=roadById.get(row.riderId);
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
      energyBefore:row.energy,
      paidDistanceM,
      paidFromReserve:priced.paidFromReserve,
      recoveryAward,
      capAdjustment:Math.max(0,
        priced.energy+recoveryAward-cap),
      energyAfter});
    const {legs,startDistanceM,...position}=row;
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
    km<input.kilometres.length&&
      positions.some(row=>row.distanceM>=
        finishDistanceM-EPS))
    throw new Error('Shared road needs an early finish contract.');
  if(frontPassCandidateId&&
    !frontPassEvent)
    throw new Error('Shared road front pass was not paid.');
  if(passingCorridor&&laneChangeEvents.some(event=>
    !decisions.find(row=>row.riderId===
      event.riderId)?.legs.some(leg=>
      leg.role==='leader'&&
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
  frontDistanceM:km*1000,
  leaderRiderId:frontId,
  ...([PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V2_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V3_VERSION]
    .includes(version)?
    {frontPassEvent}:{}),
  contactThresholdM:thresholdM,
  contactEvents,soloCatchEvents,
  ...(passingCorridor?{
    laneChangeEvents,
    caughtRiderIds:[...caughtSoloIds]}:{}),
  contactComponents:components,
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
