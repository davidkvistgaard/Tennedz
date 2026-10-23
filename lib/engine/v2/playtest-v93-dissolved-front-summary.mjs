const EPSILON=1e-7;

export function summarizeV93DissolvedFrontPlaytest(race){
  const {settings,recording,dissolvedFrontResult:result}=race;
  const {line}=result;
  const source=recording.frames.at(-2);
  const own=new Set(recording.committedInputs.teams[0].riders.map(row=>row.id));
  const bandById=new Map(line.bandRunners.map(row=>[row.roadBandId,row]));
  const frontId=line.positionedSource.roadBands[0].id;
  const activeIds=[frontId,'peloton'];
  const lastKmRoad=line.shoulder.passages.filter(row=>
    row.distanceM<=recording.route.distanceKm*1000-500).map(row=>({
    distanceM:row.distanceM,
    bunchPassageSecondsFromBunchMarker:
      row.bunchPassageSecondsFromBunchMarker,
    groups:row.roadGroups.map(group=>({id:group.id,
      riderIds:group.riderIds,
      passageSecondsFromBunchMarker:
        group.passageSecondsFromBunchMarker,
      gapSeconds:group.gapSeconds})),
    droppedPassages:row.isolated.map(item=>({riderId:item.riderId,
      passageSecondsFromBunchMarker:item.passageSecondsFromBunchMarker,
      deficitSeconds:item.passageSecondsFromBunchMarker-
        row.bunchPassageSecondsFromBunchMarker})),
    ownRiderEnergy:row.riderEnergy.filter(item=>own.has(item.riderId))
      .map(item=>({riderId:item.riderId,energy:item.energy})),
    sourceKm:line.shoulder.sourceKm}));
  const finishM=recording.route.distanceKm*1000;
  for(let distanceM=finishM-400;distanceM<=finishM;distanceM+=100){
    const at=new Map();
    for(const band of line.bandRunners){
      const frame=band.runner.frames.find(row=>row.endDistanceM===distanceM);
      if(!frame)throw new Error('A dissolved-front replay lost a boundary.');
      const time=frame.elapsedSecondsAtStart+frame.durationSeconds;
      for(const rider of frame.riders){
        if(at.has(rider.riderId))
          throw new Error('A dissolved-front rider occupied two bands.');
        at.set(rider.riderId,{time,energy:rider.energyAfter,
          roadBandId:band.roadBandId});
      }
    }
    const bunch=bandById.get('peloton').runner.frames.find(row=>
      row.endDistanceM===distanceM);
    const front=bandById.get(frontId).runner.frames.find(row=>
      row.endDistanceM===distanceM);
    const bunchTime=bunch.elapsedSecondsAtStart+bunch.durationSeconds;
    const frontTime=front.elapsedSecondsAtStart+front.durationSeconds;
    if(at.size!==recording.committedInputs.teams.length*8||
      frontTime>=bunchTime-EPSILON)
      throw new Error('The dissolved-front paid road lost its active bands.');
    const isolated=[...at].filter(([,row])=>
      row.roadBandId.startsWith('isolated:')).map(([riderId,row])=>({
      riderId,passageSecondsFromBunchMarker:row.time,
      deficitSeconds:row.time-bunchTime}));
    if(isolated.some(row=>row.deficitSeconds<=EPSILON))
      throw new Error('An isolated rider reached the active road.');
    lastKmRoad.push({distanceM,
      bunchPassageSecondsFromBunchMarker:bunchTime,
      groups:[{id:frontId,
        riderIds:front.riders.map(row=>row.riderId),
        passageSecondsFromBunchMarker:frontTime,
        gapSeconds:bunchTime-frontTime}],
      droppedPassages:isolated,
      ownRiderEnergy:[...at].filter(([id])=>own.has(id))
        .map(([riderId,row])=>({riderId,energy:row.energy})),
      sourceKm:line.shoulder.sourceKm});
  }
  const crossings=new Map(line.conditionalCrossings.map(row=>
    [row.riderId,row]));
  const last=lastKmRoad.at(-1);
  if(last.distanceM!==finishM||
    lastKmRoad.some(row=>row.ownRiderEnergy.length!==8)||
    [...last.groups.flatMap(row=>row.riderIds),
      ...bandById.get('peloton').runner.finishers.map(row=>row.riderId),
      ...last.droppedPassages.map(row=>row.riderId)].length!==
      recording.committedInputs.teams.length*8||
    [...crossings].some(([id,row])=>{
      const band=bandById.get(row.roadBandId);
      const finisher=band?.runner.finishers.find(item=>item.riderId===id);
      return !finisher||
        Math.abs(row.elapsedSecondsFromLastKmStart-
          finisher.elapsedSecondsFromLastKmStart)>EPSILON||
        Math.abs(row.energyAtLine-finisher.energyAtLine)>EPSILON;
    }))
    throw new Error('The dissolved-front finish disagrees with its replay.');
  const bandReplays=line.bandRunners.map(band=>({
    id:band.roadBandId,
    riderIds:band.runner.finishers.map(row=>row.riderId),
    passageAt500Seconds:band.paidTo500Seconds,
    frames:band.runner.frames}));
  return {version:race.version,settings,
    tuningVersion:recording.tuningVersion,handoffKm:source.km,
    kilometreFrames:recording.frames.slice(0,-1).map(frame=>({
      km:frame.km,terrain:frame.terrain,
      attackAttempts:[...frame.attackers],
      joinedRiderIds:[...frame.joinedBreakawayRiderIds],
      caughtRiderIds:[...frame.caughtBreakawayRiderIds],
      frontAttacks:frame.splitAttacks.map(row=>({
        riderId:row.riderId,status:row.status})),
      engagedChaseTeamIds:[...frame.engagedChaseTeamIds],
      roadGroups:frame.roadGroups.map(group=>({id:group.id,
        gapSeconds:group.gapSeconds,riderIds:group.riderIds})),
      droppedRiders:frame.riderGroups.filter(row=>row.group==='dropped')
        .map(row=>({riderId:row.id,
          deficitSeconds:row.deficitSeconds,energy:row.energy})),
      ownRiders:frame.riderGroups.filter(row=>row.teamId==='you')
        .map(row=>({riderId:row.id,roadGroup:row.group,
          energy:row.energy})),
      coastedRiders:frame.energyLedger.filter(row=>
        row.coastDelaySeconds>0).length})),
    lastKmRoad,bandReplays,
    lineTimes:line.conditionalCrossings,
    provisionalLineOrder:result.provisionalLineOrder,
    managerDecisions:line.sprintPlan.decisions,
    managerOrders:recording.committedInputs.teams.map(team=>({
      teamId:team.id,...team.orders.baseline,
      phaseOrders:team.orders.phases.map(phase=>({...phase}))})),
    leadOutWork:bandReplays.flatMap(band=>band.frames.flatMap(frame=>
      frame.riders.filter(row=>row.role==='lead_out'&&
        row.energySpent>0).map(row=>({riderId:row.riderId,
        roadBandId:band.id,startDistanceM:frame.startDistanceM,
        endDistanceM:frame.endDistanceM,energySpent:row.energySpent})))),
    dissolvedFront:{fromRoadGroupId:source.roadGroups[0].id,
      atDistanceM:source.km*1000,
      riderIds:line.shoulder.laneAssignments.map(row=>row.riderId),
      outsideLaneAssignments:result.outsideLaneAssignments},
    pointPreview:race.pointPreview,
    roadStatus:race.roadStatus,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}
