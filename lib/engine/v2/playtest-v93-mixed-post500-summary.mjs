import {recordFinaleMixedStraddlingIndividualAudit} from
  './finale-mixed-straddling-individual-audit.mjs';

const EPSILON=1e-7;

function paidBoundary(line,distanceM,own){
  const bands=line.bandRunners.map(band=>{
    const frame=band.runner.frames.find(row=>
      row.endDistanceM===distanceM);
    if(!frame)throw new Error('The post-500 replay lost a road boundary.');
    return {id:band.roadBandId,frame,
      passageSecondsFromBunchMarker:
        frame.elapsedSecondsAtStart+frame.durationSeconds};
  });
  const bunch=bands.find(row=>row.id==='peloton')
    ?.passageSecondsFromBunchMarker;
  if(!Number.isFinite(bunch))
    throw new Error('The post-500 replay lost the bunch.');
  const groups=bands.filter(row=>row.id!=='peloton'&&
    !row.id.startsWith('isolated:')).map(row=>({
    id:row.id,riderIds:row.frame.riders.map(rider=>rider.riderId),
    passageSecondsFromBunchMarker:row.passageSecondsFromBunchMarker,
    gapSeconds:bunch-row.passageSecondsFromBunchMarker}));
  const droppedPassages=bands.filter(row=>
    row.id.startsWith('isolated:')).map(row=>({
    riderId:row.id.slice('isolated:'.length),
    passageSecondsFromBunchMarker:row.passageSecondsFromBunchMarker,
    deficitSeconds:row.passageSecondsFromBunchMarker-bunch,
    contactDistanceM:null,
    contactStatus:'separate_inferred_outside_lane'}));
  const ownRiderEnergy=bands.flatMap(row=>row.frame.riders.filter(rider=>
    own.has(rider.riderId)).map(rider=>({riderId:rider.riderId,
    energy:rider.energyAfter})));
  if(new Set(bands.flatMap(row=>row.frame.riders.map(rider=>
    rider.riderId))).size!==line.conditionalCrossings.length||
    ownRiderEnergy.length!==own.size||
    groups.some(row=>row.gapSeconds<=EPSILON))
    throw new Error('The post-500 replay lost its separate road.');
  return {distanceM,bunchPassageSecondsFromBunchMarker:bunch,
    groups,droppedPassages,ownRiderEnergy,
    sourceKm:line.startDistanceM/1000};
}

// The first 500 m are recorded group road. Beyond the sprint handoff,
// boundaries come from individual paid runners so a group-marker crossing
// is never mistaken for the first occupied-wheel approach.
export function summarizeV93MixedPost500Playtest(race){
  const {settings,recording}=race;
  const straddling=Boolean(race.straddlingResult);
  const twoFront=Boolean(race.mixedTwoFrontResult);
  const result=race.straddlingResult??race.post500Result??
    race.mixedTwoFrontResult;
  const {clock,line}=result;
  const finishM=recording.route.distanceKm*1000;
  const source=recording.frames.at(-2);
  const own=new Set(recording.committedInputs.teams[0]
    .riders.map(row=>row.id));
  const before=clock.passageFrames.filter(frame=>
    frame.distanceM<=finishM-500).map(frame=>({
    ...frame,sourceKm:clock.sourceKm}));
  const after=[];
  for(let distanceM=finishM-400;distanceM<=finishM;
    distanceM+=100)
    after.push(paidBoundary(line,distanceM,own));
  if(before.length!==2||after.length!==5||
    source.km!==recording.route.distanceKm-1||
    line.conditionalCrossings.length!==
      recording.committedInputs.teams.length*8)
    throw new Error('The post-500 whole race has no paid handoff.');
  const bandReplays=line.bandRunners.map(band=>({
    id:band.roadBandId,
    riderIds:band.runner.finishers.map(row=>row.riderId),
    passageAt500Seconds:band.paidTo500Seconds??
      before.at(-1).droppedPassages.find(row=>
        band.roadBandId===`isolated:${row.riderId}`)
        ?.passageSecondsFromBunchMarker,
    frames:band.runner.frames}));
  const crossingById=new Map(line.conditionalCrossings.map(row=>
    [row.riderId,row]));
  const approaches=straddling?
    recordFinaleMixedStraddlingIndividualAudit(recording).approaches:[];
  if(bandReplays.some(band=>!Number.isFinite(
    band.passageAt500Seconds)||band.riderIds.some(id=>
      crossingById.get(id)?.roadBandId!==band.id))||
    !straddling&&!twoFront&&line.laneAudit.encounters.some(event=>
      crossingById.get(event.isolatedRiderId)?.roadBandId!==
        `isolated:${event.isolatedRiderId}`||
      crossingById.get(event.activeRiderId)?.roadBandId!=='road-2')||
    straddling&&(approaches.length!==7||approaches.some(event=>
      crossingById.get(event.riderId)?.roadBandId!==
        `isolated:${event.riderId}`||
      crossingById.get(event.activeRiderId)?.roadBandId!=='road-2')))
    throw new Error('The post-500 outside lanes lack a paid replay.');
  return {version:race.version,settings,
    tuningVersion:recording.tuningVersion,
    handoffKm:source.km,
    kilometreFrames:recording.frames.slice(0,-1).map(frame=>({
      km:frame.km,terrain:frame.terrain,
      attackAttempts:[...frame.attackers],
      joinedRiderIds:[...frame.joinedBreakawayRiderIds],
      caughtRiderIds:[...frame.caughtBreakawayRiderIds],
      frontAttacks:frame.splitAttacks.map(row=>({riderId:row.riderId,
        status:row.status})),
      engagedChaseTeamIds:[...frame.engagedChaseTeamIds],
      chasingTeamIds:[...frame.chasers],
      paidBunchPaceTeamId:frame.paidBunchPace?.teamId??null,
      pullRiderIds:[...frame.pullRiderIds],
      roadGroups:frame.roadGroups.map(group=>({id:group.id,
        gapSeconds:group.gapSeconds,riderIds:group.riderIds})),
      droppedRiders:frame.riderGroups.filter(row=>
        row.group==='dropped').map(row=>({riderId:row.id,
        deficitSeconds:row.deficitSeconds,energy:row.energy})),
      ownRiders:frame.riderGroups.filter(row=>row.teamId==='you')
        .map(row=>({riderId:row.id,roadGroup:row.group,
          energy:row.energy})),
      coastedRiders:frame.energyLedger.filter(row=>
        row.coastDelaySeconds>0).length})),
    lastKmRoad:[...before,...after],bandReplays,
    lineTimes:line.conditionalCrossings,
    provisionalLineOrder:line.provisionalLineOrder,
    managerDecisions:line.sprintPlan.decisions,
    managerOrders:recording.committedInputs.teams.map(team=>({
      teamId:team.id,...team.orders.baseline,
      phaseOrders:team.orders.phases.map(phase=>({...phase}))})),
    leadOutWork:bandReplays.flatMap(band=>band.frames.flatMap(frame=>
      frame.riders.filter(row=>row.role==='lead_out'&&
        row.energySpent>0).map(row=>({riderId:row.riderId,
        roadBandId:band.id,startDistanceM:frame.startDistanceM,
        endDistanceM:frame.endDistanceM,energySpent:row.energySpent})))),
    post500OutsideLanePasses:straddling||twoFront?[]:
      line.laneAudit.encounters.map(event=>({
      isolatedRiderId:event.isolatedRiderId,
      roadGroupId:'road-2',activeRiderId:event.activeRiderId,
      atDistanceM:event.isolatedWheelM,
      elapsedSecondsFromLastKmStart:
        event.elapsedSecondsFromLastKmStart,
      inferredLane:event.lane,
      occupiedWheelOrderResolved:false})),
    straddlingOutsideLaneApproaches:approaches.map(event=>({
      isolatedRiderId:event.riderId,activeRiderId:event.activeRiderId,
      roadGroupId:'road-2',atDistanceM:event.isolatedWheelM,
      elapsedSecondsFromLastKmStart:
        event.elapsedSecondsFromLastKmStart,
      occupiedWheelOrderResolved:false})),
    straddlingSourceRoadAdjacencies:straddling?
      line.sourceExitAudit.pre500OtherActive.encounters.filter(row=>
        row.sourceAdjacent&&!row.laterFreshEncounter).length:0,
    straddlingSourceRoadReapproaches:straddling?
      line.sourceExitAudit.pre500OtherActive.encounters.filter(row=>
        row.laterFreshEncounter).map(row=>({
        isolatedRiderId:row.isolatedRiderId,
        activeRiderId:row.activeRiderId,
        roadGroupId:row.activeRoadBandId,
        atDistanceM:row.firstNewEncounter.isolatedWheelM,
        elapsedSecondsFromLastKmStart:
          row.firstNewEncounter.elapsedSecondsFromLastKmStart,
        occupiedWheelOrderResolved:false})):[],
    ...(twoFront?{mixedTwoFrontOlderDrops:{
      leadingGroupIds:source.roadGroups.map(row=>row.id),
      formerFrontLeavers:clock.trace.frames.flatMap(frame=>
        frame.frontExhaustionDrops.map(row=>({riderId:row.riderId,
          fromRoadGroupId:row.fromRoadGroupId}))),
      olderDroppedRiderIds:result.pre500Audit.olderDroppedRiderIds,
      inferredOutsideLaneCount:result.final500Audit
        .outsideLaneAssignments.length,
      ...(result.pre500Audit.firstFreshApproach?{
        freshWheelApproaches:[
          result.pre500Audit.firstFreshApproach,
          ...result.final500Audit.freshApproaches]
          .map(row=>({firstRiderId:row.firstRiderId,
            secondRiderId:row.secondRiderId,
            atDistanceM:row.firstWheelM,
            firstEnergy:row.firstEnergy,
            secondEnergy:row.secondEnergy,
            occupiedWheelOrderResolved:false}))}:{}),
      occupiedWheelOrderResolved:false}}:{}),
    pointPreview:result.pointPreview,
    roadStatus:result.roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}
