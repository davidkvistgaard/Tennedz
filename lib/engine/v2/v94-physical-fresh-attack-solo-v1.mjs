// An isolated, paid solo road for each fresh attacker. The source's
// checkpoint group and gap do not establish physical shared work.
import {isDeepStrictEqual} from 'node:util';
import {inspectV94PhysicalFreshLaunchBoundaryV1} from
  './v94-physical-fresh-launch-boundary-v1.mjs';
import {firstV94SecondPiecewiseContactV1} from
  './v94-physical-second-rear-km-v1.mjs';
import {quoteRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const V94_PHYSICAL_FRESH_ATTACK_SOLO_VERSION=
  'v94-physical-fresh-attack-solo-3';
export const V94_PHYSICAL_FRESH_ATTACK_SOLO_DECISION_VERSION=
  'v94-physical-fresh-attack-solo-decision-1';
const EPS=1e-8;
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Fresh attack needs positive solo speed.');
  return 1000/seconds;
};

export function replayV94PhysicalFreshAttackSolosV1(
  recording,prior,{existingSourceBreakRiderIds=[],
    selectedRiderIds=null}={}){
  const launch=inspectV94PhysicalFreshLaunchBoundaryV1(
    recording,prior,{selectedRiderIds});
  const km=launch.sourceKm;
  const fromDistanceM=(km-1)*1000;
  const toDistanceM=km*1000;
  const frame=recording.frames[km-1];
  const segment=recording.route.kilometres[km-1];
  const existing=new Set(existingSourceBreakRiderIds);
  if(selectedRiderIds!==null&&(
    existing.size!==launch.sourceRearAttackRiderIds?.length||
    ![...existing].every(id=>
      launch.sourceRearAttackRiderIds.includes(id))))
    throw new Error('Fresh solo changed paid rear origins.');
  const caught=new Set(existing.size?
    prior.physicallyCaughtSourceBreakRiderIds??[]:[]);
  if(!Array.isArray(existingSourceBreakRiderIds)||
    existing.size!==existingSourceBreakRiderIds.length||
    [...caught].some(id=>!existing.has(id)||
      !prior.finishes.some(row=>row.riderId===id&&
        row.physicalGroup==='peloton'))||
    [...existing].some(id=>!prior.finishes.some(row=>
      row.riderId===id&&(caught.has(id)?
        row.physicalGroup==='peloton':
        row.physicalGroup.startsWith('solo-')||
        prior.physicalRearGroups?.some(group=>
          group.kind==='rear_group'&&
          group.roadId===row.physicalGroup&&
          group.riderDecisions.some(decision=>
            decision.riderId===id)))))||
    (existing.size>0&&(
      frame.breakawayRiderIds.length!==
        existing.size+launch.decisions.length||
      frame.breakawayRiderIds.some(id=>
        !existing.has(id)&&
        !launch.decisions.some(row=>row.riderId===id))||
      new Set(frame.roadGroups.flatMap(group=>
        group.riderIds)).size!==
        frame.breakawayRiderIds.length||
      frame.roadGroups.some(group=>group.riderIds.some(id=>
        !frame.breakawayRiderIds.includes(id)))||
      frame.joinedBreakawayRiderIds.length!==
        launch.decisions.length+
          (selectedRiderIds===null?0:existing.size)||
      frame.joinedBreakawayRiderIds.some(id=>
        !launch.decisions.some(row=>row.riderId===id)&&
        !(selectedRiderIds!==null&&existing.has(id))))))
    throw new Error(
      'Fresh mixed attack needs exact paid source membership.');
  const plan=frame.pelotonFrontTurnPlan;
  if(plan?.status!=='worked'||
    plan.turns[0]?.startM!==0||
    plan.turns.at(-1)?.endM!==1000||
    plan.turns.some((turn,index)=>
      !Number.isFinite(turn.ability)||
      turn.endM<=turn.startM||
      index>0&&plan.turns[index-1].endM!==turn.startM||
      launch.decisions.some(decision=>
        decision.riderId===turn.leaderRiderId))||
    plan.turns.some(turn=>!prior.finishes.some(row=>
      row.riderId===turn.leaderRiderId&&
      row.physicalGroup==='peloton')))
    throw new Error('Fresh attack needs a named paid bunch front.');
  const base=segmentBaseSeconds(segment);
  const frontSegments=[];
  let frontClockSeconds=launch.clockSeconds;
  for(const turn of plan.turns){
    const speedMps=speed(base,turn.ability);
    const duration=(turn.endM-turn.startM)/speedMps;
    frontSegments.push({startClockSeconds:frontClockSeconds,
      endClockSeconds:frontClockSeconds+duration,
      startDistanceM:fromDistanceM+turn.startM,
      endDistanceM:fromDistanceM+turn.endM,
      leaderRiderId:turn.leaderRiderId});
    frontClockSeconds+=duration;
  }
  const ledger=new Map(frame.energyLedger.map(row=>
    [row.riderId,row]));
  const sourceById=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[rider.id,rider])));
  const roads=launch.decisions.map(decision=>{
    const rider=sourceById.get(decision.riderId);
    const source=ledger.get(decision.riderId);
    const minimumSolo=quoteRearEnergyDemandV1({rider,segment,
      energyBefore:decision.energyAtBoundary,
      effort:decision.managerEffort,role:'solo',
      distanceM:1000});
    if(!source||source.paidFromReserve+EPS<
      minimumSolo.energyDemand||
      source.paidFromReserve>decision.energyAtBoundary+EPS||
      source.recoveryAward!==0||
      source.unmetEnergyDemand>EPS||
      Math.abs(decision.energyAtBoundary-
        source.paidFromReserve-source.capAdjustment-
        source.energyAfter)>.0015)
      throw new Error('Fresh attack cannot pay individual solo road.');
    const speedMps=speed(base,decision.perceivedAttackAbility);
    const finishClockSeconds=launch.clockSeconds+1000/speedMps;
    const roadSegment={startClockSeconds:launch.clockSeconds,
      endClockSeconds:finishClockSeconds,
      startDistanceM:fromDistanceM,
      endDistanceM:toDistanceM};
    const contact=firstV94SecondPiecewiseContactV1(
      [roadSegment],frontSegments,{sharedOrigin:true});
    if(contact){
      const error=new Error(
        'Fresh solo attack meets the paid front before boundary.');
      error.sourceEvidence={riderId:decision.riderId,...contact};
      throw error;
    }
    return {version:V94_PHYSICAL_FRESH_ATTACK_SOLO_DECISION_VERSION,
      sourceKm:km,riderId:decision.riderId,
      sourceLaunchVersion:launch.version,
      startClockSeconds:launch.clockSeconds,
      finishClockSeconds,
      startDistanceM:fromDistanceM,endDistanceM:toDistanceM,
      soloSpeedMps:speedMps,
      energyBefore:decision.energyAtBoundary,
      minimumSoloEnergyDemand:minimumSolo.energyDemand,
      sourcePaidFromReserve:source.paidFromReserve,
      sourceCapAdjustment:source.capAdjustment,
      energyAfter:source.energyAfter,
      earnedLeadSecondsAtBoundary:
        frontClockSeconds-finishClockSeconds,
      sourceJoinedBreakaway:
        frame.joinedBreakawayRiderIds.includes(
          decision.riderId),
      sourceBreakAheadMismatch:
        frame.joinedBreakawayRiderIds.includes(
          decision.riderId)&&
        finishClockSeconds>=frontClockSeconds-EPS,
      choice:'pay_individual_attack_road',
      physicalGroup:`solo-attack-${decision.riderId}`};
  });
  const ordered=[...roads].sort((a,b)=>
    a.finishClockSeconds-b.finishClockSeconds||
    a.riderId.localeCompare(b.riderId));
  const coincidentSoloSets=[];
  for(const road of ordered){
    const last=coincidentSoloSets.at(-1);
    if(last&&Math.abs(last.clockSeconds-
      road.finishClockSeconds)<EPS)
      last.riderIds.push(road.riderId);
    else coincidentSoloSets.push({sourceKm:km,
      clockSeconds:road.finishClockSeconds,
      atDistanceM:toDistanceM,riderIds:[road.riderId],
      formsRearGroup:false});
  }
  const byId=new Map(roads.map(row=>[row.riderId,row]));
  const priorById=new Map(prior.finishes.map(row=>
    [row.riderId,row]));
  const mixedSourceRoadClaims=frame.roadGroups.filter(group=>
    group.riderIds.some(id=>byId.has(id))&&
    group.riderIds.some(id=>existing.has(id))).map(group=>{
    if(!Number.isFinite(group.gapSeconds))
      throw new Error('Mixed source break lacks recorded gap.');
    return {sourceKm:km,sourceRoadGroupId:group.id,
      sourceCheckpointGapSeconds:group.gapSeconds,
      sourceClaimedRiderIds:[...group.riderIds],
      priorExistingRoads:group.riderIds.filter(id=>
        existing.has(id)).map(id=>({riderId:id,
        priorPhysicalGroup:priorById.get(id).physicalGroup,
        priorClockSeconds:priorById.get(id).clockSeconds})),
      freshPaidSoloRoads:group.riderIds.filter(id=>
        byId.has(id)).map(id=>({riderId:id,
        physicalGroup:byId.get(id).physicalGroup,
        finishClockSeconds:byId.get(id).finishClockSeconds})),
      sourceGroupNotPhysical:true,
      oldRoadContactUnresolved:true};
  });
  const sourceCheckpointComparisons=frame.roadGroups.filter(group=>
    group.riderIds.some(id=>byId.has(id))&&
    !group.riderIds.some(id=>existing.has(id))).map(group=>{
    const members=group.riderIds.map(id=>byId.get(id));
    if(!Number.isFinite(group.gapSeconds)||
      members.some(row=>!row))
      throw new Error(
        'Fresh source break has riders outside the paid launch.');
    const individualLeads=members.map(row=>
      row.earnedLeadSecondsAtBoundary);
    return {sourceKm:km,sourceRoadGroupId:group.id,
      sourceCheckpointGapSeconds:group.gapSeconds,
      maxIndividualPaidLeadSeconds:Math.max(...individualLeads),
      minIndividualPaidLeadSeconds:Math.min(...individualLeads),
      sourceGapMinusMaxIndividualLeadSeconds:
        group.gapSeconds-Math.max(...individualLeads),
      allMembersIndividuallyAhead:
        individualLeads.every(lead=>lead>EPS),
      physicalGroupFormed:false};
  });
  return {version:V94_PHYSICAL_FRESH_ATTACK_SOLO_VERSION,
    sourceKm:km,launch,frontClockSeconds,roads,
    coincidentSoloSets:coincidentSoloSets.filter(row=>
      row.riderIds.length>1),
    sourceBreakRoadIds:launch.sourceBreakRoadIds,
    sourceCheckpointComparisons,
    ...(existing.size>0?{
      existingSourceBreakRiderIds:[...existing],
      mixedSourceRoadClaims}:{}),
    sourceBreakAheadMismatchRiderIds:roads.filter(row=>
      row.sourceBreakAheadMismatch).map(row=>row.riderId),
    physicalRoadGroups:[],
    rearContactUnresolved:true,
    remainingFieldRoadUnresolved:true,
    officialResults:false};
}

export function validateV94PhysicalFreshAttackSolosV1(
  recording,prior,trace,options){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalFreshAttackSolosV1(
      recording,prior,options)))
    throw new Error('Fresh solo attacks differ from paid source.');
  return true;
}
