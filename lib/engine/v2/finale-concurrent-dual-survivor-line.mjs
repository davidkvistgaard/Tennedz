import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentFullCatchContinuationFromTour} from
  './finale-concurrent-band-continuation.mjs';
import {recordFinaleDualSeparatedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {resolveIndependentDualBunchSource} from
  './finale-positioned-source.mjs';
import {positionedLineOrder,
  recordFinalePositionedDualSeparatedRunnerFromTour} from
  './finale-paid-bunch-runner.mjs';
import {auditFinaleConcurrentSoloAgainstBunch} from
  './finale-concurrent-survivor-line.mjs';
import {paidSoloSprintPassage} from './finale-solo-sprint-work.mjs';

export const FINALE_CONCURRENT_DUAL_SURVIVOR_LINE_VERSION=
  'v2-finale-concurrent-dual-survivor-line-lab-1';
export const FINALE_CONCURRENT_DUAL_SURVIVOR_SPRINT_LINE_VERSION=
  'v2-finale-concurrent-dual-survivor-line-lab-2';
const EPSILON=1e-8;

// Two paid solo bands keep their recorded road tape. Only the bunch's last
// 100 m band crossing is replaced by the existing individual bunch runner.
// Inferred wheels and passing keep the result conditional and non-awarding.
export function recordFinaleConcurrentDualSurvivorLineFromTour(tour,{
  plans=null}={}){
  return recordDualSurvivorLine(tour,{plans});
}

function recordDualSurvivorLine(tour,{plans,allowSoloFinisher=false}){
  const road=recordFinaleConcurrentFullCatchContinuationFromTour(tour);
  const finishM=tour.route.distanceKm*1000;
  const roster=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  if(road.status!=='band_crossings_only'||
    road.roadRelationshipStatus!=='separated_band_crossings'||
    road.contactEvents.length||
    road.bandCrossings.map(row=>row.kind).join(',')!==
      'front,rear_attack,bunch')
    throw new Error('A dual survivor line needs three paid separated bands.');
  const handoffIndex=road.frames.findIndex(frame=>
    frame.roadBands.length===3&&
    frame.roadBands[0].kind==='front'&&
    frame.roadBands[1].kind==='rear_attack'&&
    frame.roadBands[2].kind==='bunch'&&
    Math.abs(frame.roadBands[2].positionM-(finishM-100))<EPSILON);
  const handoff=road.frames[handoffIndex];
  const [front,rear,bunch]=handoff?.roadBands??[];
  const soloIds=[front?.riderIds[0],rear?.riderIds[0]];
  const bunchIds=bunch?.riderIds;
  if(handoffIndex<0||front.riderIds.length!==1||
    rear.riderIds.length!==1||
    front.positionM<=rear.positionM+EPSILON||
    rear.positionM<=bunch.positionM+EPSILON||
    !Array.isArray(bunchIds)||bunchIds.length!==roster.length-2||
    new Set([...soloIds,...bunchIds]).size!==roster.length||
    roster.some(id=>!soloIds.includes(id)&&!bunchIds.includes(id)))
    throw new Error('The dual survivor handoff lost a road rider.');
  const handoffEnergy=new Map(handoff.riders.map(row=>
    [row.riderId,row.energyAtEvent]));
  const sourceEnergy=new Map(road.finalRiders.map(row=>
    [row.riderId,row.energyAtSource]));
  const roadPrefix=road.frames.slice(0,handoffIndex+1);
  const spentById=new Map();
  for(const frame of roadPrefix)for(const row of frame.riders)
    spentById.set(row.riderId,(spentById.get(row.riderId)??0)+
      row.energySpent);
  if(handoffEnergy.size!==roster.length||roster.some(id=>
    !Number.isFinite(handoffEnergy.get(id))||
    !Number.isFinite(sourceEnergy.get(id))||
    Math.abs(sourceEnergy.get(id)-(spentById.get(id)??0)-
      handoffEnergy.get(id))>EPSILON))
    throw new Error('The dual survivor handoff lost earned energy.');
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  if(!allowSoloFinisher&&nominations.some(row=>
    soloIds.includes(row.finisherId)))
    throw new Error('A nominated solo finisher needs its own paid sprint.');
  const roadGroups=soloIds.map(riderId=>({
    id:`survivor:${riderId}`,riderIds:[riderId]}));
  const sprintPlan=recordFinaleDualSeparatedSprintPlanFromTour(tour,{
    source:{endDistanceM:bunch.positionM,roadGroups,
      pelotonRiderIds:bunchIds,
      riderEnergy:roster.map(riderId=>({riderId,
        energyAfter:handoffEnergy.get(riderId)}))},
    plans:nominations,sourceRoadTraceVersion:road.version});
  const source={distanceM:bunch.positionM,roadGroups,
    pelotonRiderIds:bunchIds,
    riderEnergy:bunchIds.map(riderId=>({riderId,
      energy:handoffEnergy.get(riderId)})),
    bunchElapsedSeconds:handoff.elapsedSinceLaunchSeconds,
    sourceRoadTraceVersion:road.version};
  const positionedSource=resolveIndependentDualBunchSource(tour,{
    version:road.version,at500M:source,frames:[{}]},sprintPlan);
  const runner=recordFinalePositionedDualSeparatedRunnerFromTour(tour,{
    source,plan:sprintPlan,positionedSource});
  const soloSuffix=soloIds.map((riderId,index)=>{
    const crossing=road.bandCrossings[index];
    const final=road.finalRiders.find(row=>row.riderId===riderId);
    const frames=road.frames.slice(handoffIndex+1).map(frame=>({
      elapsedSinceLaunchSeconds:frame.elapsedSinceLaunchSeconds,
      roadBand:frame.roadBands.find(band=>
        band.riderIds.includes(riderId)),
      rider:frame.riders.find(row=>row.riderId===riderId)}));
    const speedMps=(finishM-handoff.roadBands[index].positionM)/
      (crossing?.elapsedSinceLaunchSeconds-
        handoff.elapsedSinceLaunchSeconds);
    const spent=frames.reduce((total,frame)=>
      total+(frame.rider?.energySpent??0),0);
    if(crossing?.riderIds?.length!==1||
      crossing.riderIds[0]!==riderId||!final||
      !Number.isFinite(speedMps)||speedMps<=0||
      !Number.isFinite(final.energyAtStop)||
      Math.abs(handoffEnergy.get(riderId)-spent-
        final.energyAtStop)>EPSILON||
      final.positionM!==finishM||
      frames.some(frame=>frame.roadBand?.kind!==
        (index?'rear_attack':'front')||
        Math.abs(frame.roadBand.positionM-Math.min(finishM,
          handoff.roadBands[index].positionM+speedMps*
            (frame.elapsedSinceLaunchSeconds-
              handoff.elapsedSinceLaunchSeconds)))>EPSILON))
      throw new Error('A dual survivor lost paid solo travel.');
    return {riderId,elapsedAtLineSeconds:
      crossing.elapsedSinceLaunchSeconds,
    energyAtLine:final.energyAtStop,frames};
  });
  if(runner.finishers.length!==bunchIds.length||
    new Set(runner.finishers.map(row=>row.riderId)).size!==
      bunchIds.length||
    runner.finishers.some(row=>!handoffEnergy.has(row.riderId)||
      !Number.isFinite(row.elapsedSecondsFromLastKmStart)||
      !Number.isFinite(row.energyAtLine)||row.energyAtLine<0||
      row.energyAtLine>handoffEnergy.get(row.riderId)+EPSILON))
    throw new Error('The dual survivor line lost a paid bunch crossing.');
  const crossBandContactAudit={
    frontAgainstBunch:auditFinaleConcurrentSoloAgainstBunch({
      handoff,front,bunchRunner:runner,
      frontCrossingSeconds:soloSuffix[0].elapsedAtLineSeconds,finishM}),
    rearAgainstBunch:auditFinaleConcurrentSoloAgainstBunch({
      handoff,front:rear,bunchRunner:runner,
      frontCrossingSeconds:soloSuffix[1].elapsedAtLineSeconds,finishM}),
    frontAgainstRear:auditSoloGap(road.frames.slice(handoffIndex),
      soloSuffix[0].elapsedAtLineSeconds)};
  if(Object.values(crossBandContactAudit).some(row=>
    row.minimumGapM<=EPSILON))
    throw new Error('A provisional rider reached a dual solo before the line.');
  const teamByRider=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  const conditionalCrossings=[...soloSuffix.map(row=>({
    riderId:row.riderId,teamId:teamByRider.get(row.riderId),
    elapsedSecondsFromLastKmStart:row.elapsedAtLineSeconds,
    energyAtLine:row.energyAtLine})),...runner.finishers];
  const provisionalLineOrder=positionedLineOrder(conditionalCrossings);
  return {version:FINALE_CONCURRENT_DUAL_SURVIVOR_LINE_VERSION,
    sourceRoadTraceVersion:road.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    roadPrefix:{startDistanceM:road.startDistanceM,
      handoffDistanceM:bunch.positionM,
      sourceElapsedSinceLaunchSeconds:road.sourceElapsedSinceLaunchSeconds,
      handoffElapsedSinceLaunchSeconds:handoff.elapsedSinceLaunchSeconds,
      contactEvents:road.contactEvents,frames:roadPrefix,
      riderEnergyAtHandoff:roster.map(riderId=>({riderId,
        energy:handoffEnergy.get(riderId)}))},
    soloSuffix,sprintPlan,positionedSource,runner,
    crossBandContactAudit,conditionalCrossings,provisionalLineOrder,
    roadStatus:'paid_dual_survivor_conditional_individual_line',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

// A nominated attacker changes pace at that rider's own paid 100 m
// boundary. The already recorded bunch tape remains valid until its 100 m
// boundary; every intervening solo position and debit is replaced on the
// common clock before the existing individual bunch runner takes over.
export function recordFinaleConcurrentDualSurvivorSprintLineFromTour(tour,{
  plans=null}={}){
  const line=recordDualSurvivorLine(tour,{plans,allowSoloFinisher:true});
  const finishM=tour.route.distanceKm*1000;
  const handoff=line.roadPrefix.frames.at(-1);
  const soloIds=line.soloSuffix.map(row=>row.riderId);
  const nominated=new Set(line.sprintPlan.decisions.map(row=>row.finisherId));
  const sprintIds=soloIds.filter(id=>nominated.has(id));
  if(!sprintIds.length)
    throw new Error('A dual survivor sprint needs a nominated attacker.');
  const ridersById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const sprints=sprintIds.map(riderId=>{
    const frame=line.roadPrefix.frames.find(row=>row.roadBands.some(
      band=>band.riderIds.includes(riderId)&&
        Math.abs(band.positionM-(finishM-100))<EPSILON));
    const energyAtDecision=frame?.riders.find(row=>
      row.riderId===riderId)?.energyAtEvent;
    if(!frame||!Number.isFinite(energyAtDecision))
      throw new Error('A nominated attacker has no paid 100 m decision.');
    const passage=paidSoloSprintPassage(ridersById.get(riderId),
      tour.route.kilometres.at(-1),energyAtDecision);
    if(!Number.isFinite(passage.durationSeconds)||
      passage.durationSeconds<=0||
      !Number.isFinite(passage.energySpent)||
      passage.energySpent<0||
      passage.energySpent>energyAtDecision+EPSILON||
      passage.energyAfter<0||
      frame.elapsedSinceLaunchSeconds+passage.durationSeconds<=
        handoff.elapsedSinceLaunchSeconds+EPSILON)
      throw new Error('A nominated attacker cannot pay for a separate sprint.');
    return {riderId,startDistanceM:finishM-100,
      startSeconds:frame.elapsedSinceLaunchSeconds,
      energyAtDecision,...passage,
      lineSeconds:frame.elapsedSinceLaunchSeconds+
        passage.durationSeconds};
  });
  const sprintById=new Map(sprints.map(row=>[row.riderId,row]));
  const paidFrames=[];
  for(const [index,frame] of line.roadPrefix.frames.entries()){
    const roadBands=frame.roadBands.map(band=>{
      const sprint=sprintById.get(band.riderIds[0]);
      if(!sprint||frame.elapsedSinceLaunchSeconds<=
        sprint.startSeconds+EPSILON)return band;
      return {...band,positionM:Math.min(finishM,
        sprint.startDistanceM+100*(frame.elapsedSinceLaunchSeconds-
          sprint.startSeconds)/sprint.durationSeconds)};
    });
    const riders=frame.riders.map(row=>{
      const sprint=sprintById.get(row.riderId);
      if(!sprint||frame.elapsedSinceLaunchSeconds<=
        sprint.startSeconds+EPSILON)return row;
      const positionM=roadBands.find(band=>band.riderIds.includes(
        row.riderId)).positionM;
      const priorFrame=paidFrames[index-1];
      const priorPositionM=priorFrame.roadBands.find(band=>
        band.riderIds.includes(row.riderId)).positionM;
      const energyBefore=priorFrame.riders.find(other=>
        other.riderId===row.riderId).energyAtEvent;
      const distanceM=positionM-priorPositionM;
      const energySpent=sprint.energySpent*distanceM/100;
      if(distanceM<0||energySpent<0||energySpent>energyBefore+EPSILON)
        throw new Error('A solo sprint lost its paid common-clock travel.');
      return {riderId:row.riderId,role:'solo_sprint',distanceM,
        energyBefore,energySpent,
        energyAtEvent:Math.max(0,energyBefore-energySpent)};
    });
    paidFrames.push({...frame,roadBands,riders});
  }
  const prefixGaps=paidFrames.map(frame=>({
    seconds:frame.elapsedSinceLaunchSeconds,
    frontRear:frame.roadBands[0].positionM-
      frame.roadBands[1].positionM,
    rearBunch:frame.roadBands[1].positionM-
      frame.roadBands[2].positionM}));
  if(prefixGaps.some(row=>row.frontRear<=EPSILON||
    row.rearBunch<=EPSILON))
    throw new Error('A nominated solo sprint met another road band.');
  const paidHandoff=paidFrames.at(-1);
  const energyAtHandoff=new Map(paidHandoff.riders.map(row=>
    [row.riderId,row.energyAtEvent]));
  const originalHandoff=new Map(line.roadPrefix.riderEnergyAtHandoff.map(
    row=>[row.riderId,row.energy]));
  const originalSpent=new Map(),paidSpent=new Map();
  for(const frame of line.roadPrefix.frames)for(const row of frame.riders)
    originalSpent.set(row.riderId,
      (originalSpent.get(row.riderId)??0)+row.energySpent);
  for(const frame of paidFrames)for(const row of frame.riders)
    paidSpent.set(row.riderId,
      (paidSpent.get(row.riderId)??0)+row.energySpent);
  if(line.conditionalCrossings.some(row=>
    !Number.isFinite(energyAtHandoff.get(row.riderId))||
    Math.abs(originalHandoff.get(row.riderId)+
      originalSpent.get(row.riderId)-
      paidSpent.get(row.riderId)-
      energyAtHandoff.get(row.riderId))>EPSILON))
    throw new Error('The solo sprint prefix lost earned rider energy.');
  const soloSprintWork=sprints.map(sprint=>{
    const positionM=paidHandoff.roadBands.find(band=>
      band.riderIds.includes(sprint.riderId)).positionM;
    const energySpentToHandoff=sprint.energySpent*
      (positionM-sprint.startDistanceM)/100;
    const energySpentAfterHandoff=sprint.energySpent-
      energySpentToHandoff;
    if(Math.abs(sprint.energyAtDecision-energySpentToHandoff-
      energyAtHandoff.get(sprint.riderId))>EPSILON||
      Math.abs(energyAtHandoff.get(sprint.riderId)-
        energySpentAfterHandoff-sprint.energyAfter)>EPSILON)
      throw new Error('A solo sprint has no reconciled handoff energy.');
    return {...sprint,positionAtHandoffM:positionM,
      energyAtHandoff:energyAtHandoff.get(sprint.riderId),
      energySpentToHandoff,energySpentAfterHandoff};
  });
  const sprintWorkById=new Map(soloSprintWork.map(row=>
    [row.riderId,row]));
  const soloSuffix=line.soloSuffix.map((row,index)=>{
    const sprint=sprintWorkById.get(row.riderId);
    return sprint?{riderId:row.riderId,
      elapsedAtLineSeconds:sprint.lineSeconds,
      energyAtLine:sprint.energyAfter,
      sprint:{...sprint,role:'solo_sprint'},
      frames:[{elapsedSinceLaunchSeconds:sprint.lineSeconds,
        elapsedSincePreviousSeconds:sprint.lineSeconds-
          paidHandoff.elapsedSinceLaunchSeconds,
        event:'solo_sprint_line',
        roadBand:{kind:index?'rear_attack':'front',
          positionM:finishM,riderIds:[row.riderId]},
        rider:{riderId:row.riderId,role:'solo_sprint',
          distanceM:finishM-sprint.positionAtHandoffM,
          energyBefore:sprint.energyAtHandoff,
          energySpent:sprint.energySpentAfterHandoff,
          energyAtEvent:sprint.energyAfter}}]}:row;
  });
  const crossBandContactAudit={
    frontAgainstBunch:auditFinaleConcurrentSoloAgainstBunch({
      handoff:paidHandoff,front:paidHandoff.roadBands[0],
      bunchRunner:line.runner,
      frontCrossingSeconds:soloSuffix[0].elapsedAtLineSeconds,finishM}),
    rearAgainstBunch:auditFinaleConcurrentSoloAgainstBunch({
      handoff:paidHandoff,front:paidHandoff.roadBands[1],
      bunchRunner:line.runner,
      frontCrossingSeconds:soloSuffix[1].elapsedAtLineSeconds,finishM}),
    frontAgainstRear:auditSoloPairFromHandoff(paidHandoff,
      soloSuffix,finishM)};
  if(Object.values(crossBandContactAudit).some(row=>
    row.minimumGapM<=EPSILON))
    throw new Error('A provisional rider reached a sprinting solo.');
  const crossingById=new Map(soloSuffix.map(row=>[row.riderId,row]));
  const conditionalCrossings=line.conditionalCrossings.map(row=>{
    const solo=crossingById.get(row.riderId);
    return solo?{...row,
      elapsedSecondsFromLastKmStart:solo.elapsedAtLineSeconds,
      energyAtLine:solo.energyAtLine}:row;
  });
  return {...line,
    version:FINALE_CONCURRENT_DUAL_SURVIVOR_SPRINT_LINE_VERSION,
    roadPrefix:{...line.roadPrefix,frames:paidFrames,
      riderEnergyAtHandoff:line.roadPrefix.riderEnergyAtHandoff.map(row=>({
        riderId:row.riderId,energy:energyAtHandoff.get(row.riderId)}))},
    soloSuffix,soloSprintWork,
    preHandoffContactAudit:{minimumFrontRearGapM:Math.min(
      ...prefixGaps.map(row=>row.frontRear)),
    minimumRearBunchGapM:Math.min(...prefixGaps.map(row=>
      row.rearBunch))},
    crossBandContactAudit,conditionalCrossings,
    provisionalLineOrder:positionedLineOrder(conditionalCrossings),
    roadStatus:'paid_dual_survivor_sprint_conditional_individual_line'};
}

function auditSoloPairFromHandoff(handoff,solos,finishM){
  const start=handoff.elapsedSinceLaunchSeconds;
  const end=Math.min(...solos.map(row=>row.elapsedAtLineSeconds));
  const [front,rear]=handoff.roadBands;
  const gapAtStart=front.positionM-rear.positionM;
  const frontAtEnd=Math.min(finishM,front.positionM+
    (finishM-front.positionM)*(end-start)/
      (solos[0].elapsedAtLineSeconds-start));
  const rearAtEnd=Math.min(finishM,rear.positionM+
    (finishM-rear.positionM)*(end-start)/
      (solos[1].elapsedAtLineSeconds-start));
  const gapAtEnd=frontAtEnd-rearAtEnd;
  if(!(end>start)||!Number.isFinite(gapAtEnd))
    throw new Error('The two solos have no common paid line interval.');
  return {minimumGapM:Math.min(gapAtStart,gapAtEnd),
    nearestElapsedSeconds:gapAtEnd<gapAtStart?end:start,
    status:Math.min(gapAtStart,gapAtEnd)>EPSILON?
      'no_paid_solo_contact':'paid_solo_contact'};
}

function auditSoloGap(frames,frontCrossingSeconds){
  let minimumGapM=Infinity,nearestElapsedSeconds=null;
  for(const frame of frames){
    if(frame.elapsedSinceLaunchSeconds>
      frontCrossingSeconds+EPSILON)break;
    const front=frame.roadBands.find(band=>band.kind==='front');
    const rear=frame.roadBands.find(band=>
      band.kind==='rear_attack');
    if(!front||!rear)throw new Error('The dual solo road bands vanished.');
    const gapM=front.positionM-rear.positionM;
    if(gapM<minimumGapM){minimumGapM=gapM;
      nearestElapsedSeconds=frame.elapsedSinceLaunchSeconds;}
  }
  if(!Number.isFinite(minimumGapM))
    throw new Error('The dual solo contact audit has no road frame.');
  return {minimumGapM,nearestElapsedSeconds,
    status:minimumGapM>EPSILON?
      'no_paid_solo_contact':'paid_solo_contact'};
}

export function validateFinaleConcurrentDualSurvivorLineFromTour(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentDualSurvivorLineFromTour(tour,input)))
    throw new Error('Concurrent dual survivor line does not replay.');
  return true;
}

export function validateFinaleConcurrentDualSurvivorSprintLineFromTour(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentDualSurvivorSprintLineFromTour(tour,input)))
    throw new Error('Concurrent dual survivor sprint line does not replay.');
  return true;
}
