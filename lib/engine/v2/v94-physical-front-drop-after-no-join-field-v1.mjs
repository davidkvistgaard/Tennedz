// Settle a no-join overtake followed by one paid front-drop group.
// Unjoined drops retain their individual solo roads and energy costs.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalSixthKmV1} from
  './v94-physical-sixth-km-v1.mjs';
import {decideV94PhysicalFrontDropNoJoinChoiceV1} from
  './v94-physical-front-drop-no-join-choice-v1.mjs';
import {replayV94PhysicalFrontDropAfterNoJoinFragmentV1} from
  './v94-physical-front-drop-after-no-join-fragment-v1.mjs';
import {firstV94SecondPiecewiseContactV1} from
  './v94-physical-second-rear-km-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {orderAt} from './orders.mjs';

export const V94_PHYSICAL_FRONT_DROP_AFTER_NO_JOIN_FIELD_VERSION=
  'v94-physical-front-drop-after-no-join-field-1';
const EPS=1e-7;
const segmentOf=road=>({
  startClockSeconds:road.startClockSeconds,
  endClockSeconds:road.finishClockSeconds,
  startDistanceM:road.startDistanceM,
  endDistanceM:road.endDistanceM});

export function replayV94PhysicalFrontDropAfterNoJoinFieldV1(
  recording,prior){
  const choice=decideV94PhysicalFrontDropNoJoinChoiceV1(
    recording,prior);
  const fragment=replayV94PhysicalFrontDropAfterNoJoinFragmentV1(
    recording,prior);
  const km=fragment.sourceKm;
  let physicalRoads;
  try{replayV94PhysicalSixthKmV1(recording,prior);}
  catch(error){
    if(error.message!==
      'Physical front drop/rear contact needs paid resolution.')
      throw error;
    physicalRoads=error.physicalRoads;
  }
  const {roads,newFrontDrops,frontSegments,front,
    boundary}=physicalRoads??{};
  if(!Array.isArray(roads)||
    !Array.isArray(newFrontDrops)||
    !Array.isArray(frontSegments)||
    !front?.atFrontClock||boundary?.sourceKm!==km||
    choice.sourceKm!==km||
    fragment.contactChoiceVersion!==choice.version)
    throw new Error('No-join field lacks measured paid roads.');
  const joined=new Set(fragment.riderWork.map(row=>row.riderId));
  const separate=new Set(choice.contacts.map(row=>
    row.dropRiderId));
  const unjoinedDrops=newFrontDrops.filter(row=>
    separate.has(row.riderId));
  if(joined.size!==fragment.riderWork.length||
    separate.size!==choice.contacts.length||
    unjoinedDrops.length!==separate.size||
    [...separate].some(id=>joined.has(id))||
    !newFrontDrops.every(row=>joined.has(row.riderId)||
      separate.has(row.riderId))||
    !roads.some(row=>row.roadId===choice.soloRoadId&&
      row.riderDecisions.length===1&&
      joined.has(row.riderDecisions[0].riderId))||
    roads.some(road=>road.riderDecisions.some(row=>
      joined.has(row.riderId))&&road.riderDecisions.some(row=>
      !joined.has(row.riderId))))
    throw new Error('No-join field loses a paid road member.');
  const otherRoads=roads.filter(row=>
    !row.riderDecisions.some(item=>
      joined.has(item.riderId)));
  if(otherRoads.some(row=>
    !['rear_group','solo','fresh_attack_solo'].includes(
      row.kind)))
    throw new Error('No-join field has unpriced rear road.');
  const remaining=[...otherRoads.map(row=>({
    roadId:row.roadId,segments:[segmentOf(row)],
    sharedOrigin:null})),...unjoinedDrops.map(row=>({
    roadId:`solo-${row.riderId}`,
    segments:row.segments,
    sharedOrigin:row.origin}))];
  const group=[segmentOf(fragment.road)];
  const contacts=[];
  const add=(a,b,sharedOrigin=false)=>{
    const contact=firstV94SecondPiecewiseContactV1(
      a.segments,b.segments,{sharedOrigin});
    if(contact)contacts.push({roadIds:[a.roadId,b.roadId],
      ...contact});
  };
  const contactGroup={roadId:fragment.road.roadId,
    segments:group};
  for(let i=0;i<remaining.length;i++){
    const a=remaining[i];
    add(contactGroup,a);
    for(let j=i+1;j<remaining.length;j++){
      const b=remaining[j];
      const sharedOrigin=a.sharedOrigin&&b.sharedOrigin&&
        Math.abs(a.sharedOrigin.startClockSeconds-
          b.sharedOrigin.startClockSeconds)<EPS&&
        Math.abs(a.sharedOrigin.startDistanceM-
          b.sharedOrigin.startDistanceM)<EPS;
      add(a,b,!!sharedOrigin);
    }
    if(a.sharedOrigin)for(const segment of frontSegments)
      add(a,{roadId:'peloton',segments:[segment]},true);
  }
  for(const segment of frontSegments)
    add(contactGroup,{roadId:'peloton',segments:[segment]});
  if(contacts.length)
    throw new Error('No-join field has unresolved road contact.');
  const sources=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[
      rider.id,{rider,team}])));
  const priorFinishes=new Map(prior.finishes.map(row=>[
    row.riderId,row]));
  const ledger=new Map(recording.frames[km-1].energyLedger.map(
    row=>[row.riderId,row]));
  const segment=recording.route.kilometres[km-1];
  const otherRearFinishes=otherRoads.flatMap(road=>
    road.riderDecisions.map(row=>{
      const rider=sources.get(row.riderId)?.rider;
      if(!rider)throw new Error('No-join field lacks rear rider.');
      if(road.kind==='fresh_attack_solo'){
        const source=ledger.get(row.riderId);
        const cap=replayRearEnergyCapV1({rider,
          kilometres:recording.route.kilometres,
          throughKm:km}).cap;
        if(!source||source.recoveryAward!==0||
          source.energyAfter>cap+EPS)
          throw new Error('No-join field cannot price fresh solo.');
        return {riderId:row.riderId,sourceKm:km,
          physicalGroup:road.roadId,endDistanceM:km*1000,
          clockSeconds:road.finishClockSeconds,
          energyBefore:source.energyBefore,
          paidFromReserve:source.paidFromReserve,
          recoveryAward:0,capAdjustment:source.capAdjustment,
          energyAfter:source.energyAfter};
      }
      const recovery=recoveryForKilometre({rider,segment,
        effort:row.effort,group:'dropped',
        working:row.role==='leader',quietKm:0});
      if(recovery.recovery!==0)
        throw new Error('No-join field cannot claim rear recovery.');
      const cap=replayRearEnergyCapV1({rider,
        kilometres:recording.route.kilometres,
        throughKm:km}).cap;
      const capAdjustment=Math.max(0,
        row.reserveBeforeRecovery-cap);
      return {riderId:row.riderId,sourceKm:km,
        physicalGroup:road.roadId,endDistanceM:km*1000,
        clockSeconds:road.finishClockSeconds,
        energyBefore:row.energyBefore,
        paidFromReserve:row.paidFromReserve,
        recoveryAward:0,capAdjustment,
        energyAfter:+Math.min(cap,
          row.reserveBeforeRecovery).toFixed(3)};
    }));
  const paidRoad={roadId:fragment.road.roadId,
    kind:'rear_group',sourceKm:km,
    previousGroupIds:[...fragment.previousRoadIds],
    noJoinChoiceVersion:choice.version,
    sourceContactFragmentVersion:fragment.version,
    startClockSeconds:fragment.contactClockSeconds,
    finishClockSeconds:fragment.road.finishClockSeconds,
    startDistanceM:fragment.atDistanceM,
    endDistanceM:km*1000,
    speedMps:fragment.road.speedMps,
    leaderRiderId:fragment.road.leaderRiderId,
    riderDecisions:fragment.riderWork.map(row=>({
      version:row.version,
      choice:row.roleAfterContact==='leader'?
        'lead_paid_contact_group':'take_paid_contact_shelter',
      sportingGoal:row.sportingGoal,
      sportingCaptainId:row.sportingCaptainId??null,
      teamOrderEffort:row.managerEffort,
      perceivedAbilityAtChoice:row.perceivedAbilityAtChoice,
      riderId:row.riderId,role:row.roleAfterContact,
      effort:row.effectiveEffort,
      energyBefore:row.energyBeforeKm,
      paidFromReserve:row.paidFromReserve,
      reserveBeforeRecovery:row.energyBeforeKm-
        row.paidFromReserve,
      sourceContactFragmentVersion:fragment.version}))};
  const contactFinishes=fragment.riderWork.map(row=>({
    riderId:row.riderId,sourceKm:km,
    physicalGroup:paidRoad.roadId,
    endDistanceM:km*1000,
    clockSeconds:row.finishClockSeconds,
    energyBefore:row.energyBeforeKm,
    paidFromReserve:row.paidFromReserve,
    recoveryAward:row.recoveryAward,
    capAdjustment:row.capAdjustment,
    energyAfter:row.energyAfter}));
  const droppedFrontFinishes=unjoinedDrops.map(row=>{
    const priorRow=priorFinishes.get(row.riderId);
    if(!priorRow||
      Math.abs(priorRow.energyAfter-
        row.finish.energyBefore)>EPS)
      throw new Error('No-join drop loses prior reserve.');
    return row.finish;
  });
  const frontFinishes=front.atFrontClock.filter(row=>
    row.attached).map(row=>{
    if(front.physicallyCaughtSourceBreakRiderIds?.includes(
      row.riderId)){
      const {rider,team}=sources.get(row.riderId)??{};
      const previous=priorFinishes.get(row.riderId);
      if(!rider||!previous||
        previous.physicalGroup!=='peloton')
        throw new Error('No-join field lacks caught source.');
      const effort=orderAt(team.orders,km-1).effort;
      const quietKm=prior.physicalCaughtQuietKmByRider
        ?.[row.riderId]??0;
      const rest=recoveryForKilometre({rider,segment,
        effort,group:'peloton',working:false,quietKm});
      const cap=replayRearEnergyCapV1({rider,
        kilometres:recording.route.kilometres,
        throughKm:km}).cap;
      const capAdjustment=Math.max(0,
        row.reserveBeforeRecovery+rest.recovery-cap);
      return {riderId:row.riderId,sourceKm:km,
        physicalGroup:'peloton',endDistanceM:km*1000,
        clockSeconds:front.frontClockSeconds,
        energyBefore:previous.energyAfter,
        paidFromReserve:row.physicalPaidThroughClock,
        recoveryAward:rest.recovery,capAdjustment,
        energyAfter:+Math.min(cap,
          row.reserveBeforeRecovery+rest.recovery).toFixed(3),
        physicalQuietKm:rest.quietKm};
    }
    const source=ledger.get(row.riderId);
    if(!source)
      throw new Error('No-join field lacks front ledger.');
    return {riderId:row.riderId,sourceKm:km,
      physicalGroup:'peloton',endDistanceM:km*1000,
      clockSeconds:front.frontClockSeconds,
      energyBefore:source.energyBefore,
      paidFromReserve:row.physicalPaidThroughClock,
      recoveryAward:source.recoveryAward,
      capAdjustment:source.capAdjustment,
      energyAfter:source.energyAfter};
  });
  const rearFinishes=[...otherRearFinishes,...contactFinishes];
  const finishes=[...frontFinishes,...droppedFrontFinishes,
    ...rearFinishes];
  if(finishes.length!==prior.finishes.length||
    new Set(finishes.map(row=>row.riderId)).size!==
      finishes.length||
    finishes.some(row=>row.endDistanceM!==km*1000||
      !Number.isFinite(row.clockSeconds)||
      Math.abs(row.energyBefore-row.paidFromReserve+
        row.recoveryAward-row.capAdjustment-
        row.energyAfter)>.001+EPS))
    throw new Error('No-join field lacks paid rider coverage.');
  const completeRoads=[...otherRoads,paidRoad];
  const orderedDrops=[...droppedFrontFinishes].sort((a,b)=>
    a.clockSeconds-b.clockSeconds||
    a.riderId.localeCompare(b.riderId));
  const coincidentNewFrontDropSets=[];
  for(const finish of orderedDrops){
    const last=coincidentNewFrontDropSets.at(-1);
    if(last&&Math.abs(last.clockSeconds-
      finish.clockSeconds)<EPS)
      last.riderIds.push(finish.riderId);
    else coincidentNewFrontDropSets.push({sourceKm:km,
      atDistanceM:km*1000,
      clockSeconds:finish.clockSeconds,
      riderIds:[finish.riderId],formsRearGroup:false});
  }
  const unresolvedDrops=coincidentNewFrontDropSets.filter(
    row=>row.riderIds.length>1);
  return {version:V94_PHYSICAL_FRONT_DROP_AFTER_NO_JOIN_FIELD_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    priorVersion:prior.version,boundary,front,
    roads:completeRoads,newFrontDrops:unjoinedDrops,
    physicalRearGroups:completeRoads.filter(row=>
      row.kind==='rear_group'),
    rearFinishes,droppedFrontFinishes,
    coincidentNewFrontDropSets:unresolvedDrops,
    continuationNeedsContactDecision:
      unresolvedDrops.length>0,
    noJoinChoiceVersion:choice.version,
    contactFragmentVersion:fragment.version,
    contactRoadAudit:{checkedRearRoadCount:roads.length,
      checkedFrontDropCount:newFrontDrops.length,
      checkedFrontSegmentCount:frontSegments.length,
      unresolvedContactCount:0},
    sourceBreakRiderIds:[...prior.freshAttackSoloRiderIds],
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    finishes,fullFieldKilometre:true,
    officialResults:false};
}

export function validateV94PhysicalFrontDropAfterNoJoinFieldV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalFrontDropAfterNoJoinFieldV1(
      recording,prior)))
    throw new Error('No-join field differs from paid roads.');
  return true;
}
