const EPSILON=1e-7;

function kilometreFrames(recording){
  return recording.frames.slice(0,-1).map(frame=>({
    km:frame.km,terrain:frame.terrain,
    attackAttempts:[...frame.attackers],
    joinedRiderIds:[...frame.joinedBreakawayRiderIds],
    caughtRiderIds:[...frame.caughtBreakawayRiderIds],
    frontAttacks:frame.splitAttacks.map(row=>({
      riderId:row.riderId,status:row.status})),
    engagedChaseTeamIds:[...frame.engagedChaseTeamIds],
    roadGroups:frame.roadGroups.map(group=>({
      id:group.id,gapSeconds:group.gapSeconds,
      riderIds:group.riderIds})),
    droppedRiders:frame.riderGroups.filter(row=>
      row.group==='dropped').map(row=>({
      riderId:row.id,deficitSeconds:row.deficitSeconds,
      energy:row.energy})),
    ownRiders:frame.riderGroups.filter(row=>
      row.teamId==='you').map(row=>({
      riderId:row.id,roadGroup:row.group,energy:row.energy})),
    coastedRiders:frame.energyLedger.filter(row=>
      row.coastDelaySeconds>0).length}));
}

function paidIsolatedAt(line,clock,distanceM,bunchTime){
  const frame=clock.passageFrames.find(row=>
    row.distanceM===distanceM);
  if(!frame)throw new Error('A shared road lost its isolated passage.');
  return frame.droppedPassages.map(row=>({
    ...row,
    deficitSeconds:row.passageSecondsFromBunchMarker-bunchTime}));
}

function isolatedAtContact(line,distanceM,bunchTime){
  return line.bandRunners.slice(2).map(band=>{
    const frame=band.runner.frames.find(row=>
      row.startDistanceM<=distanceM&&
      distanceM<=row.endDistanceM);
    const row=frame?.riders[0];
    if(!row)
      throw new Error('An isolated rider lacks the contact passage.');
    const share=(distanceM-frame.startDistanceM)/
      (frame.endDistanceM-frame.startDistanceM);
    if(share<0||share>1)
      throw new Error('An isolated rider lacks the contact passage.');
    const time=frame.elapsedSecondsAtStart+
      frame.durationSeconds*share;
    const energy=row.energyAtDecision-
      row.energySpent*share;
    if(time<=bunchTime||energy<-EPSILON)
      throw new Error('An isolated rider met the active contact.');
    return {riderId:row.riderId,
      passageSecondsFromBunchMarker:time,
      deficitSeconds:time-bunchTime,
      energy:Math.max(0,energy)};
  });
}

export function summarizeV93LateActiveContactPlaytest(race){
  const {settings,recording,clock,individualLine:line}=race;
  const prior=recording.frames.at(-2);
  // The replay validator reconstructs the complete contact line from the
  // locked race and plan, not from the presentation frames below.
  if(line.contact?.status!=='paid_occupied_lane_wheel_contact'||
    line.merged.finishers.length+line.bandRunners.slice(2)
      .reduce((sum,band)=>sum+band.runner.finishers.length,0)!==
      recording.committedInputs.teams.length*8)
    throw new Error('The shared sprint lost its locked field.');
  const own=new Set(recording.committedInputs.teams[0].riders
    .map(row=>row.id));
  const ownEnergy=(active,isolated)=>[
    ...active.map(row=>[row.riderId,row.energyAfter??row.energy]),
    ...isolated.map(row=>[row.riderId,row.energy])]
    .filter(([id])=>own.has(id))
    .map(([riderId,energy])=>({riderId,energy}));
  const lastKmRoad=clock.passageFrames
    .filter(frame=>frame.distanceM<=line.startDistanceM+500)
    .map(frame=>({...frame,
      droppedPassages:frame.droppedPassages??[],
      ownRiderEnergy:clock.trace.frames.find(row=>
        row.endDistanceM===frame.distanceM)?.riders
        .filter(row=>own.has(row.riderId))
        .map(row=>({riderId:row.riderId,energy:row.energy})),
      sourceKm:clock.sourceKm}));
  for(let index=0;index<line.prefix[0].frames.length-1;index++){
    const front=line.prefix[0].frames[index];
    const bunch=line.prefix[1].frames[index];
    const distanceM=front.endDistanceM;
    if(distanceM!==bunch.endDistanceM||
      distanceM<=line.startDistanceM+500)
      throw new Error('A source band lost its sprint boundary.');
    const frontTime=front.elapsedSecondsAtStart+
      front.durationSeconds;
    const bunchTime=bunch.elapsedSecondsAtStart+
      bunch.durationSeconds;
    const isolated=paidIsolatedAt(line,clock,distanceM,bunchTime);
    lastKmRoad.push({distanceM,
      bunchPassageSecondsFromBunchMarker:bunchTime,
      groups:[{id:line.sourceRoadGroupIds[0],
        riderIds:line.prefix[0].riderIds,
        gapSeconds:bunchTime-frontTime,
        passageSecondsFromBunchMarker:frontTime}],
      droppedPassages:isolated,
      ownRiderEnergy:ownEnergy([
        ...front.riders,...bunch.riders],isolated),
      sourceKm:clock.sourceKm});
  }
  const contact=line.contact;
  const isolatedContact=isolatedAtContact(line,
    contact.atDistanceM,
    contact.elapsedSecondsFromLastKmStart);
  lastKmRoad.push({distanceM:contact.atDistanceM,
    bunchPassageSecondsFromBunchMarker:
      contact.elapsedSecondsFromLastKmStart,
    groups:[],contact:{kind:'shared_active_wheel_contact',
      groupId:contact.frontRoadBandId,
      atDistanceM:contact.atDistanceM,
      wheelPairs:contact.wheelPairs},
    droppedPassages:isolatedContact,
    ownRiderEnergy:ownEnergy(line.atContact.slots,
      isolatedContact),sourceKm:clock.sourceKm});
  const mergedFrames=line.merged.frames.filter((frame,index,all)=>
    frame.endDistanceM!==line.lineDistanceM||
    index===all.length-1);
  for(const frame of mergedFrames){
    const distanceM=frame.endDistanceM;
    const bunchTime=frame.elapsedSecondsAtStart+
      frame.durationSeconds;
    const isolated=paidIsolatedAt(line,clock,distanceM,bunchTime);
    lastKmRoad.push({distanceM,
      bunchPassageSecondsFromBunchMarker:bunchTime,
      groups:[],droppedPassages:isolated,
      ownRiderEnergy:ownEnergy(frame.riders,isolated),
      sourceKm:clock.sourceKm});
  }
  if(lastKmRoad.at(-1)?.distanceM!==line.lineDistanceM||
    lastKmRoad.some(frame=>frame.ownRiderEnergy?.length!==8)||
    lastKmRoad.some((frame,index)=>index>0&&
      frame.distanceM<=lastKmRoad[index-1].distanceM))
    throw new Error('The shared sprint road is incomplete: '+
      JSON.stringify(lastKmRoad.map(frame=>({
        distanceM:frame.distanceM,
        own:frame.ownRiderEnergy?.length}))));
  const bandReplays=line.bandRunners.map(band=>({
    id:band.roadBandId,
    riderIds:band.runner.finishers.map(row=>row.riderId),
    passageAt500Seconds:band.paidTo500Seconds??
      clock.passageFrames.find(frame=>
        frame.distanceM===line.startDistanceM+500)
        ?.droppedPassages.find(row=>
          band.roadBandId===`isolated:${row.riderId}`)
        ?.passageSecondsFromBunchMarker,
    frames:band.runner.frames,
    ...(band.mergedIntoRoadBandId?{
      mergedIntoRoadBandId:band.mergedIntoRoadBandId}:{})}));
  const leadOutWork=bandReplays.flatMap(band=>band.frames
    .flatMap(frame=>frame.riders.filter(row=>
      row.role==='lead_out'&&row.energySpent>0)
      .map(row=>({riderId:row.riderId,
        roadBandId:band.id,
        startDistanceM:frame.startDistanceM,
        endDistanceM:frame.endDistanceM,
        energySpent:row.energySpent}))));
  return {version:race.version,settings,
    tuningVersion:recording.tuningVersion,
    handoffKm:prior.km,
    kilometreFrames:kilometreFrames(recording),
    lastKmRoad,bandReplays,
    lineTimes:line.conditionalCrossings,
    provisionalLineOrder:line.provisionalLineOrder,
    roadPlaceBounds:{status:'shared_contact_photo_ranges',
      riders:line.roadPlaceBounds},
    managerDecisions:line.sprintPlan.decisions,
    managerOrders:recording.committedInputs.teams.map(team=>({
      teamId:team.id,...team.orders.baseline,
      phaseOrders:team.orders.phases.map(phase=>({...phase}))})),
    leadOutWork,pointPreview:race.pointPreview,
    sharedWheelContact:{roadGroupId:contact.frontRoadBandId,
      phase:'paid_final_500m_sprint',
      atDistanceM:contact.atDistanceM,
      elapsedSecondsFromLastKmStart:
        contact.elapsedSecondsFromLastKmStart,
      wheelPairs:contact.wheelPairs},
    roadStatus:race.roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}
