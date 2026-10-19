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

export const FINALE_CONCURRENT_DUAL_SURVIVOR_LINE_VERSION=
  'v2-finale-concurrent-dual-survivor-line-lab-1';
const EPSILON=1e-8;

// Two paid solo bands keep their recorded road tape. Only the bunch's last
// 100 m band crossing is replaced by the existing individual bunch runner.
// Inferred wheels and passing keep the result conditional and non-awarding.
export function recordFinaleConcurrentDualSurvivorLineFromTour(tour,{
  plans=null}={}){
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
  if(nominations.some(row=>soloIds.includes(row.finisherId)))
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
