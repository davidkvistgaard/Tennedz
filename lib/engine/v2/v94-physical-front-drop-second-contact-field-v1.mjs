// Accept the measured two-contact front-drop road only after auditing every
// remaining road and pricing every rider's finish from their own reserve.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalSixthKmV1} from
  './v94-physical-sixth-km-v1.mjs';
import {replayV94PhysicalFrontDropContactFragmentV1} from
  './v94-physical-front-drop-contact-fragment-v1.mjs';
import {inspectV94PhysicalFrontDropContactNextV1} from
  './v94-physical-front-drop-contact-next-probe-v1.mjs';
import {replayV94PhysicalFrontDropSecondFragmentV1} from
  './v94-physical-front-drop-second-contact-fragment-v1.mjs';
import {firstV94SecondPiecewiseContactV1} from
  './v94-physical-second-rear-km-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {orderAt} from './orders.mjs';

export const V94_PHYSICAL_FRONT_DROP_SECOND_FIELD_VERSION=
  'v94-physical-front-drop-second-contact-field-1';
const EPS=1e-7;

export function replayV94PhysicalFrontDropSecondFieldV1(
  recording,prior){
  const first=replayV94PhysicalFrontDropContactFragmentV1(
    recording,prior);
  const probe=inspectV94PhysicalFrontDropContactNextV1(
    recording,prior);
  const second=replayV94PhysicalFrontDropSecondFragmentV1(
    recording,prior);
  const km=second.sourceKm;
  if(first.sourceKm!==km||probe.sourceKm!==km||
    !probe.firstAdditionalContact||
    Math.abs(probe.firstAdditionalContact.clockSeconds-
      second.contactClockSeconds)>EPS||
    Math.abs(probe.firstAdditionalContact.atDistanceM-
      second.atDistanceM)>EPS)
    throw new Error('Second field lacks ordered paid contact.');
  let physicalRoads;
  try{replayV94PhysicalSixthKmV1(recording,prior);}
  catch(error){
    if(error.message!==
      'Physical front drop/rear contact needs paid resolution.')
      throw error;
    physicalRoads=error.physicalRoads;
  }
  const {roads,frontSegments,front,boundary,
    newFrontDrops}=physicalRoads??{};
  if(!Array.isArray(roads)||!Array.isArray(frontSegments)||
    !Array.isArray(newFrontDrops)||!front?.atFrontClock||
    boundary?.sourceKm!==km)
    throw new Error('Second field lacks measured roads.');
  const joined=new Set(second.riderWork.map(row=>row.riderId));
  const firstJoined=new Set(first.riderWork.map(row=>row.riderId));
  if(firstJoined.size!==first.riderWork.length||
    second.riderWork.length!==joined.size||
    ![...firstJoined].every(id=>joined.has(id))||
    !newFrontDrops.every(drop=>joined.has(drop.riderId)))
    throw new Error('Second field leaves a front drop unpaid.');
  if(roads.some(road=>road.riderDecisions.some(row=>
    joined.has(row.riderId))&&road.riderDecisions.some(row=>
    !joined.has(row.riderId))))
    throw new Error('Second field splits an unpaid rear road.');
  const otherRoads=roads.filter(road=>
    !road.riderDecisions.some(row=>joined.has(row.riderId)));
  if(otherRoads.some(road=>
    !['rear_group','solo','fresh_attack_solo'].includes(
      road.kind)))
    throw new Error('Second field has unpriced rear road kind.');
  const remaining=otherRoads.map(road=>({id:road.roadId,
    segments:[{startClockSeconds:road.startClockSeconds,
      endClockSeconds:road.finishClockSeconds,
      startDistanceM:road.startDistanceM,
      endDistanceM:road.endDistanceM}]}));
  const group=[{startClockSeconds:second.road.startClockSeconds,
    endClockSeconds:second.road.finishClockSeconds,
    startDistanceM:second.road.startDistanceM,
    endDistanceM:second.road.endDistanceM}];
  const contacts=[];
  for(const other of remaining){
    const contact=firstV94SecondPiecewiseContactV1(
      group,other.segments);
    if(contact)contacts.push({roadIds:[second.road.roadId,
      other.id],contact});
  }
  for(let i=0;i<remaining.length;i++)
    for(let j=i+1;j<remaining.length;j++){
      const contact=firstV94SecondPiecewiseContactV1(
        remaining[i].segments,remaining[j].segments);
      if(contact)contacts.push({roadIds:[remaining[i].id,
        remaining[j].id],contact});
    }
  for(const other of [...remaining,{id:second.road.roadId,
    segments:group}])for(const frontSegment of frontSegments){
    const contact=firstV94SecondPiecewiseContactV1(
      other.segments,[frontSegment]);
    if(contact)contacts.push({roadIds:[other.id,'peloton'],
      contact});
  }
  if(contacts.length)
    throw new Error('Second field has unresolved road contact.');
  const byRider=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[
      rider.id,{rider,team}])));
  const priorFinish=new Map(prior.finishes.map(row=>[
    row.riderId,row]));
  const ledger=new Map(recording.frames[km-1].energyLedger.map(
    row=>[row.riderId,row]));
  const segment=recording.route.kilometres[km-1];
  const otherRearFinishes=otherRoads.flatMap(road=>
    road.riderDecisions.map(row=>{
      const rider=byRider.get(row.riderId)?.rider;
      if(!rider)throw new Error('Second field lacks rear rider.');
      if(road.kind==='fresh_attack_solo'){
        const source=ledger.get(row.riderId);
        const cap=replayRearEnergyCapV1({rider,
          kilometres:recording.route.kilometres,
          throughKm:km}).cap;
        if(!source||source.recoveryAward!==0||
          source.energyAfter>cap+EPS)
          throw new Error('Second field cannot price fresh solo.');
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
        throw new Error('Second field cannot claim rear recovery.');
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
  const contactRoad={roadId:second.road.roadId,
    kind:'rear_group',sourceKm:km,
    previousGroupIds:[...second.previousRoadIds],
    firstContactVersion:first.version,
    secondContactVersion:second.version,
    startClockSeconds:second.contactClockSeconds,
    finishClockSeconds:second.road.finishClockSeconds,
    startDistanceM:second.atDistanceM,
    endDistanceM:km*1000,
    speedMps:second.road.speedMps,
    leaderRiderId:second.road.leaderRiderId,
    riderDecisions:second.riderWork.map(row=>({
      version:row.version,
      choice:row.roleAfterContact==='leader'?
        'lead_paid_contact_group':'take_paid_contact_shelter',
      sportingGoal:row.sportingGoal,
      sportingCaptainId:row.sportingCaptainId??null,
      teamOrderEffort:row.teamOrderEffort,
      perceivedAbilityAtChoice:row.perceivedAbilityAtChoice,
      riderId:row.riderId,role:row.roleAfterContact,
      effort:row.effectiveEffort,
      energyBefore:row.energyBeforeKm,
      paidFromReserve:row.paidFromReserve,
      reserveBeforeRecovery:row.energyBeforeKm-
        row.paidFromReserve,
      sourceContactFragmentVersion:second.version}))};
  const contactFinishes=second.riderWork.map(row=>({
    riderId:row.riderId,sourceKm:km,
    physicalGroup:contactRoad.roadId,endDistanceM:km*1000,
    clockSeconds:row.finishClockSeconds,
    energyBefore:row.energyBeforeKm,
    paidFromReserve:row.paidFromReserve,
    recoveryAward:row.recoveryAward,
    capAdjustment:row.capAdjustment,
    energyAfter:row.energyAfter}));
  const frontFinishes=front.atFrontClock.filter(row=>
    row.attached).map(row=>{
    if(front.physicallyCaughtSourceBreakRiderIds?.includes(
      row.riderId)){
      const {rider,team}=byRider.get(row.riderId)??{};
      const previous=priorFinish.get(row.riderId);
      if(!rider||!previous||
        previous.physicalGroup!=='peloton')
        throw new Error('Second field lacks caught rider source.');
      const effort=orderAt(team.orders,km-1).effort;
      const quietKm=prior.physicalCaughtQuietKmByRider
        ?.[row.riderId]??prior
        .physicalFormerCaughtQuietKmByRider?.[row.riderId]??0;
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
      throw new Error('Second field lacks front ledger.');
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
  const finishes=[...frontFinishes,...rearFinishes];
  if(finishes.length!==prior.finishes.length||
    new Set(finishes.map(row=>row.riderId)).size!==
      finishes.length||
    finishes.some(row=>row.endDistanceM!==km*1000||
      !Number.isFinite(row.clockSeconds)||
      Math.abs(row.energyBefore-row.paidFromReserve+
        row.recoveryAward-row.capAdjustment-
        row.energyAfter)>.001+EPS))
    throw new Error('Second field lacks paid rider coverage.');
  const completeRoads=[...otherRoads,contactRoad];
  return {version:V94_PHYSICAL_FRONT_DROP_SECOND_FIELD_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    priorVersion:prior.version,boundary,front,
    roads:completeRoads,newFrontDrops:[],
    physicalRearGroups:completeRoads.filter(row=>
      row.kind==='rear_group'),
    rearFinishes,droppedFrontFinishes:[],
    coincidentNewFrontDropSets:[],
    continuationNeedsContactDecision:false,
    firstContactFragmentVersion:first.version,
    secondContactFragmentVersion:second.version,
    contactRoadAudit:{checkedRearRoadCount:roads.length,
      checkedFrontDropCount:newFrontDrops.length,
      checkedFrontSegmentCount:frontSegments.length,
      unresolvedContactCount:0},
    sourceBreakRiderIds:[...prior.freshAttackSoloRiderIds],
    ...(front.physicallyCaughtSourceBreakRiderIds?.length?{
      physicallyCaughtSourceBreakRiderIds:
        [...front.physicallyCaughtSourceBreakRiderIds],
      physicalCaughtQuietKmByRider:Object.fromEntries(
        frontFinishes.filter(row=>
          front.physicallyCaughtSourceBreakRiderIds.includes(
            row.riderId)).map(row=>[
          row.riderId,row.physicalQuietKm]))}:{}),
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    finishes,fullFieldKilometre:true,
    officialResults:false};
}

export function validateV94PhysicalFrontDropSecondFieldV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalFrontDropSecondFieldV1(
      recording,prior)))
    throw new Error('Second front-drop field differs from paid source.');
  return true;
}
