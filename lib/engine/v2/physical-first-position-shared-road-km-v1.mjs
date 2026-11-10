// Experimental shared-clock road step. An existing solo and the bunch
// move as measured wheels; a catch changes contact only after paid motion.
import {isDeepStrictEqual} from 'node:util';
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

export const PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_VERSION=
  'physical-first-position-shared-road-km-1';
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
    phase:role==='sheltered'?'cruise':'solo',
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

function priceTravel(source,segment,energyBefore,legs){
  let energy=energyBefore;
  let paidFromReserve=0;
  for(const leg of legs){
    let remaining=leg.distanceM;
    while(remaining>EPS){
      const distanceM=Math.min(1000,remaining);
      const priced=priceRearEnergyDemandV1({
        rider:source.rider,segment,
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

export function advancePhysicalFirstPositionSharedRoadKmV1({
  priorPeloton,priorSolos=[],segment,input}){
  const km=priorPeloton?.sourceKm+1;
  const continuing=priorPeloton?.version===
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_VERSION;
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
    priorPeloton.frontDistanceM!==(km-1)*1000||
    !continuing&&!isDeepStrictEqual(
      [...(priorPeloton.separateRoadRiderIds??[])]
        .sort(),
      priorSolos.map(row=>row.riderId).sort()))
    throw new Error('Shared road needs committed paid positions.');
  const start=createPhysicalFirstPositionStartV2({
    input,grid:priorPeloton.grid});
  if(priorPeloton.inputHash!==start.inputHash||
    input.positionModelVersion!==
      PHYSICAL_FIRST_POSITION_START_V2_VERSION)
    throw new Error('Shared road changed committed race input.');
  const sources=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{team,rider}])));
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
        priorPeloton.grid.laneCount)||
    activeSolos.some(row=>row.roadId!==
      `solo:${row.riderId}`||
      !continuing&&row.distanceM<=
        priorPeloton.frontDistanceM+EPS||
      row.clockSeconds!==priorPeloton.clockSeconds))
    throw new Error('Shared road has an unpriced rider source.');
  const frontId=priorPeloton.leaderRiderId;
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
  const leader=byId.get(frontId);
  const thresholdM=priorPeloton.grid.wheelSpacingM*2;
  const contactEvents=[];
  const soloCatchEvents=[];
  const checkpointCrossings=[];
  let previous=componentsFor(motion,thresholdM);
  if(activeSolos.some(row=>previous.some(group=>
    group.includes(frontId)&&
      group.includes(row.riderId))))
    throw new Error('Shared road starts with unrecorded solo contact.');
  const caughtSoloIds=new Set();
  let elapsedSeconds=0;
  const maxSeconds=300;
  while(leader.distanceM<km*1000-EPS){
    if(elapsedSeconds>=maxSeconds)
      throw new Error('Shared road lost its payable front.');
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
    const leaderSpeed=speedFor(sources.get(frontId),
      segment,leader.energy,'leader');
    const stepSeconds=Math.min(STEP_SECONDS,
      (km*1000-leader.distanceM)/leaderSpeed);
    const before=new Map(motion.map(row=>[
      row.riderId,row.distanceM]));
    for(const row of ranked){
      const role=roleById.get(row.riderId);
      let speed=speedFor(sources.get(row.riderId),
        segment,row.energy,role);
      if(row.roadId==='peloton'&&
        row.riderId!==frontId)
        speed=Math.min(speed,leaderSpeed);
      const ahead=predecessor.get(row.riderId);
      const cap=ahead?
        ahead.distanceM-priorPeloton.grid.wheelSpacingM:
        Infinity;
      const travelM=Math.max(0,Math.min(
        speed*stepSeconds,cap-row.distanceM));
      if(row.riderId===frontId&&
        travelM<leaderSpeed*stepSeconds-EPS)
        throw new Error('Shared road leader blocked by its lane.');
      row.distanceM+=travelM;
      if(travelM>EPS){
        const last=row.legs.at(-1);
        if(last?.role===role)last.distanceM+=travelM;
        else row.legs.push({role,distanceM:travelM});
      }
    }
    for(const row of motion){
      for(let markerKm=1;markerKm<=km;markerKm++){
        const lineDistanceM=markerKm*1000;
        const start=before.get(row.riderId);
        if(start>=lineDistanceM-EPS||
          row.distanceM<lineDistanceM-EPS)
          continue;
        const travelM=row.distanceM-start;
        if(travelM<=EPS)
          throw new Error('Shared road crossing lacks paid motion.');
        checkpointCrossings.push({
          riderId:row.riderId,km:markerKm,
          lineDistanceM,
          clockSeconds:priorPeloton.clockSeconds+
            elapsedSeconds+stepSeconds*
              (lineDistanceM-start)/travelM});
      }
    }
    elapsedSeconds+=stepSeconds;
    const current=componentsFor(motion,thresholdM);
    const frontComponent=current.find(group=>
      group.includes(frontId));
    for(const row of activeSolos){
      if(frontComponent.includes(row.riderId)&&
        !caughtSoloIds.has(row.riderId)){
        soloCatchEvents.push({
          version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_VERSION,
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
        version:PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_VERSION,
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
          group.length===1?`solo:${id}`:
          `rear:${index}`])));
  const decisions=[];
  const positions=motion.map(row=>{
    const source=sources.get(row.riderId);
    const order=orderAt(source.team.orders,km-1);
    const priced=priceTravel(source,segment,
      row.energy,row.legs);
    const roadId=roadById.get(row.riderId);
    const recovery=recoveryForKilometre({
      rider:source.rider,segment,
      effort:order.effort,group:roadId,
      working:row.legs.some(leg=>
        leg.role==='leader'||leg.role==='solo'),
      quietKm:row.quietKm});
    const cap=replayRearEnergyCapV1({
      rider:source.rider,
      kilometres:input.kilometres,
      throughKm:km}).cap;
    const paidDistanceM=row.distanceM-
      row.startDistanceM;
    if(paidDistanceM<=EPS||
      Math.abs(paidDistanceM-row.legs.reduce(
        (sum,leg)=>sum+leg.distanceM,0))>EPS)
      throw new Error('Shared road has unpaid movement.');
    const energyAfter=+Math.min(cap,
      priced.energy+recovery.recovery).toFixed(3);
    decisions.push({riderId:row.riderId,
      roadId,legs:row.legs,
      energyBefore:row.energy,
      paidDistanceM,
      paidFromReserve:priced.paidFromReserve,
      recoveryAward:recovery.recovery,
      energyAfter});
    const {legs,startDistanceM,...position}=row;
    return {...position,roadId,
      paidDistanceM:row.paidDistanceM+
        paidDistanceM,energy:energyAfter,
      quietKm:recovery.quietKm,
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
  return {version:
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_VERSION,
  sourceKm:km,
  inputHash:priorPeloton.inputHash,
  raceSeed:priorPeloton.raceSeed,
  grid:{...priorPeloton.grid},
  clockSeconds:priorPeloton.clockSeconds+
    elapsedSeconds,
  frontDistanceM:km*1000,
  leaderRiderId:frontId,
  contactThresholdM:thresholdM,
  contactEvents,soloCatchEvents,
  contactComponents:components,
  caughtSoloRiderIds,joinedSoloRiderIds,
  decisions,positions,
  checkpointCrossings:checkpointCrossings.sort((a,b)=>
    a.clockSeconds-b.clockSeconds||
      a.riderId.localeCompare(b.riderId)),
  sourceGroupClockUsedForMovement:false,
  officialResults:false};
}

export function replayPhysicalFirstPositionSharedRoadKmV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSharedRoadKmV1(input)))
    throw new Error('Shared road differs from paid movement.');
  return recorded;
}
