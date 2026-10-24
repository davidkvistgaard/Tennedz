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
  const {settings,recording,post500Result:result}=race;
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
  if(bandReplays.some(band=>!Number.isFinite(
    band.passageAt500Seconds)||band.riderIds.some(id=>
      crossingById.get(id)?.roadBandId!==band.id))||
    line.laneAudit.encounters.some(event=>
      crossingById.get(event.isolatedRiderId)?.roadBandId!==
        `isolated:${event.isolatedRiderId}`||
      crossingById.get(event.activeRiderId)?.roadBandId!=='road-2'))
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
    post500OutsideLanePasses:line.laneAudit.encounters.map(event=>({
      isolatedRiderId:event.isolatedRiderId,
      roadGroupId:'road-2',activeRiderId:event.activeRiderId,
      atDistanceM:event.isolatedWheelM,
      elapsedSecondsFromLastKmStart:
        event.elapsedSecondsFromLastKmStart,
      inferredLane:event.lane,
      occupiedWheelOrderResolved:false})),
    pointPreview:result.pointPreview,
    roadStatus:result.roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}
