// Read-only individual km-6 forward-road quotes and possible encounters.
// No source group, wheel, gap or full-kilometre payment is granted.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalSixthRiderBoundaryV1} from
  './v94-physical-sixth-rider-boundary-v1.mjs';
import {firstV94SecondPiecewiseContactV1} from
  './v94-physical-second-rear-km-v1.mjs';
import {quoteRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const V94_PHYSICAL_SIXTH_FORWARD_CONTACT_PROBE_VERSION=
  'v94-physical-sixth-forward-contact-probe-1';
const EPS=1e-7;
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Sixth forward quote needs positive solo speed.');
  return 1000/seconds;
};

export function inspectV94PhysicalSixthForwardContactProbeV1(
  recording,prior){
  const boundary=decideV94PhysicalSixthRiderBoundaryV1(
    recording,prior);
  const segment=recording.route.kilometres[5];
  const base=segmentBaseSeconds(segment);
  const riderById=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[rider.id,rider])));
  const sourceLedger=new Map(recording.frames[5].energyLedger.map(
    row=>[row.riderId,row]));
  const forward=boundary.decisions.filter(row=>
    row.sourceBreakMembershipClaim);
  const proposedSoloRoads=forward.map(decision=>{
    const rider=riderById.get(decision.riderId);
    const source=sourceLedger.get(decision.riderId);
    if(!source||Math.abs(source.energyBefore-
      decision.energyAtBoundary)>1e-6)
      throw new Error('Sixth solo quote lacks source reserve.');
    const speedMps=speed(base,decision.perceivedSoloAbility);
    const quote=quoteRearEnergyDemandV1({rider,segment,
      energyBefore:decision.energyAtBoundary,
      effort:decision.managerEffort,role:'solo',
      distanceM:1000});
    return {sourceKm:6,riderId:decision.riderId,
      priorPhysicalGroup:decision.physicalGroupAtBoundary,
      startClockSeconds:decision.clockSeconds,
      proposedEndClockSeconds:
        decision.clockSeconds+1000/speedMps,
      startDistanceM:5000,proposedEndDistanceM:6000,
      soloSpeedMps:speedMps,
      energyAtBoundary:decision.energyAtBoundary,
      quotedSoloEnergyDemand:quote.energyDemand,
      individuallyPayable:
        quote.energyDemand<=decision.energyAtBoundary+EPS,
      sourceFullKmPaidFromReserve:source.paidFromReserve,
      sourcePaidBudgetCoversSolo:
        source.paidFromReserve+EPS>=quote.energyDemand,
      managerEffort:decision.managerEffort,
      managerBreakWork:decision.managerBreakWork,
      sportingGoal:decision.sportingGoal,
      sportingCaptainId:decision.sportingCaptainId,
      sourceBreakMembershipClaim:true};
  });
  const contactCandidates=[];
  for(let i=0;i<proposedSoloRoads.length;i++)
    for(let j=i+1;j<proposedSoloRoads.length;j++){
      const a=proposedSoloRoads[i],b=proposedSoloRoads[j];
      const sharedOrigin=Math.abs(a.startClockSeconds-
        b.startClockSeconds)<=EPS;
      if(sharedOrigin)contactCandidates.push({
        riderIds:[a.riderId,b.riderId],
        kind:'boundary_colocation',
        clockSeconds:a.startClockSeconds,
        atDistanceM:5000,
        paidFormationPending:true});
      const contact=firstV94SecondPiecewiseContactV1([{
        startClockSeconds:a.startClockSeconds,
        endClockSeconds:a.proposedEndClockSeconds,
        startDistanceM:5000,endDistanceM:6000}],[{
        startClockSeconds:b.startClockSeconds,
        endClockSeconds:b.proposedEndClockSeconds,
        startDistanceM:5000,endDistanceM:6000}],{
        sharedOrigin});
      if(contact)contactCandidates.push({
        riderIds:[a.riderId,b.riderId],
        kind:'solo_road_meeting',
        clockSeconds:contact.clockSeconds,
        atDistanceM:contact.atDistanceM,
        paidFormationPending:true});
    }
  contactCandidates.sort((a,b)=>
    a.clockSeconds-b.clockSeconds||
    a.riderIds.join(',').localeCompare(b.riderIds.join(',')));
  return {version:V94_PHYSICAL_SIXTH_FORWARD_CONTACT_PROBE_VERSION,
    sourceKm:6,atDistanceM:5000,
    priorPhysicalVersion:prior.version,
    riderBoundaryVersion:boundary.version,
    proposedSoloRoads,contactCandidates,
    unattachableSourceRoadIds:
      boundary.unattachableSourceRoadIds,
    physicalRoadGroups:[],
    paidNewDistanceM:0,paidNewEnergy:0,
    remainingFieldRoadUnresolved:true,
    officialResults:false};
}

export function validateV94PhysicalSixthForwardContactProbeV1(
  recording,prior,observation){
  if(!isDeepStrictEqual(observation,
    inspectV94PhysicalSixthForwardContactProbeV1(
      recording,prior)))
    throw new Error('Sixth forward contact differs from paid source.');
  return true;
}
