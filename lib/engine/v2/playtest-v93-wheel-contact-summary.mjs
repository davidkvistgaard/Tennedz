import {probeFinaleSeparatedGroupsFromTour,
  FINALE_COAST_FRONT_CATCH_LAST_KM_VERSION,
  FINALE_SINGLE_LATE_CATCH_LAST_KM_VERSION} from './finale-multi-run.mjs';
import {validateFinaleCoastedWheelContactLine,
  FINALE_NO_DROPS_WHEEL_CONTACT_LINE_VERSION} from
  './finale-coasted-wheel-contact-line.mjs';

const EPSILON=1e-7;

function kilometreFrames(recording){
  return recording.frames.slice(0,-1).map(frame=>({
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
    droppedRiders:frame.riderGroups.filter(row=>row.group==='dropped')
      .map(row=>({riderId:row.id,deficitSeconds:row.deficitSeconds,
        energy:row.energy})),
    ownRiders:frame.riderGroups.filter(row=>row.teamId==='you')
      .map(row=>({riderId:row.id,roadGroup:row.group,
        energy:row.energy})),
    coastedRiders:frame.energyLedger.filter(row=>
      row.coastDelaySeconds>0).length}));
}

export function summarizeV93WheelContactPlaytest(race){
  const {settings,recording,individualLine:line}=race;
  validateFinaleCoastedWheelContactLine(recording,
    {plans:race.appliedPlans},line);
  const finishM=recording.route.distanceKm*1000;
  const sourceM=finishM-1000;
  const trace=probeFinaleSeparatedGroupsFromTour(recording,{
    version:line.version===FINALE_NO_DROPS_WHEEL_CONTACT_LINE_VERSION?
      FINALE_SINGLE_LATE_CATCH_LAST_KM_VERSION:
      FINALE_COAST_FRONT_CATCH_LAST_KM_VERSION});
  const first=trace.frames[0];
  const own=new Set(recording.committedInputs.teams[0]
    .riders.map(row=>row.id));
  const activeAtContact=new Map(line.atContact.riders.map(row=>
    [row.riderId,row.energy]));
  const activeAt500=new Map(line.at500.slots.map(row=>
    [row.riderId,row.energy]));
  const isolatedAt=(distanceM,bunchTime)=>line.isolated.map(row=>{
    const paid=row.frames.find(frame=>frame.distanceM===distanceM);
    if(!paid||paid.elapsedSecondsFromLastKmStart<=bunchTime)
      throw new Error('An isolated passage has no matching shared road.');
    return {riderId:row.riderId,
      passageSecondsFromBunchMarker:
        paid.elapsedSecondsFromLastKmStart,
      deficitSeconds:paid.elapsedSecondsFromLastKmStart-bunchTime,
      energy:paid.energy,energySpent:paid.energySpent,
      curtailedEnergyDemand:paid.curtailedEnergyDemand};
  });
  const at250Time=first.bunchElapsedSeconds;
  const droppedAt250=isolatedAt(sourceM+250,at250Time);
  const at250={distanceM:sourceM+250,
    bunchPassageSecondsFromBunchMarker:at250Time,
    groups:first.roadGroups.map(group=>({id:group.id,
      riderIds:group.riderIds,gapSeconds:group.gapSeconds,
      passageSecondsFromBunchMarker:
        at250Time-group.gapSeconds})),
    droppedPassages:droppedAt250,
    ownRiderEnergy:first.riders.filter(row=>own.has(row.riderId))
      .map(row=>({riderId:row.riderId,energy:row.energy}))};
  const contactM=line.contact.bunchEdgeM;
  const contactTime=line.contact.elapsedSecondsFromLastKmStart;
  const fraction=(contactM-(sourceM+250))/250;
  if(fraction<=0||fraction>=1)
    throw new Error('Shared contact has no recorded 250 m source interval.');
  const droppedAtContact=line.isolated.map(row=>{
    const before=row.frames[0],after=row.frames[1];
    const time=before.elapsedSecondsFromLastKmStart+fraction*
      (after.elapsedSecondsFromLastKmStart-
        before.elapsedSecondsFromLastKmStart);
    const energy=before.energy-fraction*(before.energy-after.energy);
    if(time<=contactTime||energy<-EPSILON)
      throw new Error('Shared contact passed an isolated rider.');
    return {riderId:row.riderId,
      passageSecondsFromBunchMarker:time,
      deficitSeconds:time-contactTime,energy};
  });
  const atContact={distanceM:contactM,
    bunchPassageSecondsFromBunchMarker:contactTime,groups:[],
    contact:{kind:'shared_wheel_contact',
      frontGroupId:line.source.frontGroupId,
      atDistanceM:contactM,
      frontWheelM:line.contact.frontWheelM,
      bunchWheelM:line.contact.bunchWheelM,
      simultaneousWheelPairs:line.contact.simultaneousWheelPairs},
    droppedPassages:droppedAtContact,
    ownRiderEnergy:[...activeAtContact,...droppedAtContact.map(row=>
      [row.riderId,row.energy])].filter(([id])=>own.has(id))
      .map(([riderId,energy])=>({riderId,energy}))};
  const at500Time=line.at500.elapsedSecondsFromLastKmStart;
  const at500={distanceM:finishM-500,
    bunchPassageSecondsFromBunchMarker:at500Time,
    groups:[],droppedPassages:isolatedAt(finishM-500,at500Time),
    ownRiderEnergy:[...activeAt500,
      ...line.isolated.map(row=>[row.riderId,row.frames[1].energy])]
      .filter(([id])=>own.has(id)).map(([riderId,energy])=>
        ({riderId,energy}))};
  const sprintFrames=line.runner.frames.filter(frame=>
    !frame.phase&&frame.endDistanceM<=finishM&&
      frame.startDistanceM<finishM)
    .map(frame=>{
      const bunchTime=frame.elapsedSecondsAtStart+
        frame.durationSeconds;
      const dropped=isolatedAt(frame.endDistanceM,bunchTime);
      const energies=new Map([...frame.riders.map(row=>
        [row.riderId,row.energyAfter]),
      ...dropped.map(row=>[row.riderId,row.energy])]);
      if(energies.size!==line.finishers.length)
        throw new Error('A shared road boundary lost rider energy.');
      return {distanceM:frame.endDistanceM,
        bunchPassageSecondsFromBunchMarker:bunchTime,
        groups:[],droppedPassages:dropped,
        ownRiderEnergy:[...energies].filter(([id])=>own.has(id))
          .map(([riderId,energy])=>({riderId,energy}))};
    });
  const lastKmRoad=[at250,atContact,at500,...sprintFrames];
  if(lastKmRoad.at(-1).distanceM!==finishM||
    lastKmRoad.some(frame=>frame.ownRiderEnergy.length!==8||
      frame.droppedPassages.length!==line.isolated.length))
    throw new Error('The shared road is incomplete.');
  const bandReplays=[{id:'peloton',riderIds:line.runner.finishers
    .map(row=>row.riderId),passageAt500Seconds:at500Time,
    frames:line.runner.frames},...line.isolated.map(row=>({
      id:`isolated:${row.riderId}`,riderIds:[row.riderId],
      passageAt500Seconds:row.frames[1]
        .elapsedSecondsFromLastKmStart,
      frames:row.frames.map((frame,index)=>({
        startDistanceM:index?row.frames[index-1].distanceM:sourceM,
        endDistanceM:frame.distanceM,
        riders:[{riderId:row.riderId,role:'isolated_coast',
          positionM:frame.distanceM,energyAfter:frame.energy,
          energySpent:frame.energySpent,
          elapsedToLineSeconds:frame.distanceM===finishM?
            row.elapsedSecondsFromLastKmStart:null}]}))}))];
  const leadOutWork=line.runner.frames.flatMap(frame=>
    frame.riders.filter(row=>row.role==='lead_out'&&
      row.energySpent>0).map(row=>({riderId:row.riderId,
      roadBandId:'peloton',startDistanceM:frame.startDistanceM,
      endDistanceM:frame.endDistanceM,
      energySpent:row.energySpent})));
  return {version:race.version,settings,
    tuningVersion:recording.tuningVersion,
    handoffKm:recording.route.distanceKm-1,
    kilometreFrames:kilometreFrames(recording),
    lastKmRoad,bandReplays,lineTimes:line.finishers,
    provisionalLineOrder:line.resultStatus===
      'experimental_inferred_order'?line.lineOrder:null,
    roadPlaceBounds:{status:'shared_contact_photo_ranges',
      riders:line.lineOrder},
    managerDecisions:line.sprintPlan.decisions,
    managerOrders:recording.committedInputs.teams.map(team=>({
      teamId:team.id,...team.orders.baseline,
      phaseOrders:team.orders.phases.map(phase=>({...phase}))})),
    leadOutWork,pointPreview:race.pointPreview,
    sharedWheelContact:{roadGroupId:line.source.frontGroupId,
      atDistanceM:contactM,
      elapsedSecondsFromLastKmStart:contactTime,
      frontWheelM:line.contact.frontWheelM,
      bunchWheelM:line.contact.bunchWheelM,
      wheelPairs:line.contact.simultaneousWheelPairs},
    roadStatus:race.roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}
