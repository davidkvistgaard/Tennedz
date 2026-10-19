import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentFullCatchContinuationFromTour} from
  './finale-concurrent-band-continuation.mjs';
import {recordFinaleLateSeparatedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {resolveIndependentBunchSource} from
  './finale-positioned-source.mjs';
import {positionedLineOrder,
  recordFinalePositionedLateSeparatedRunnerFromTour} from
  './finale-paid-bunch-runner.mjs';

export const FINALE_CONCURRENT_SURVIVOR_LINE_VERSION=
  'v2-finale-concurrent-survivor-line-lab-1';
const EPSILON=1e-8;

// Conditional individual continuation of a measured rear catch. The road
// band's later bunch crossing is discarded at the paid 100 m handoff; the
// bunch then runs once on inferred wheels. The solo keeps its paid band tape.
export function recordFinaleConcurrentSurvivorLineFromTour(tour,
  {plans=null}={}){
  const road=recordFinaleConcurrentFullCatchContinuationFromTour(tour);
  const finishM=tour.route.distanceKm*1000;
  const roster=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  if(road.status!=='band_crossings_only'||
    road.roadRelationshipStatus!=='rear_caught_then_band_crossings'||
    road.contactEvents.map(row=>row.kind).join(',')!==
      'rear_attack_bunch_contact')
    throw new Error('A survivor line needs one measured rear catch.');
  const handoffIndex=road.frames.findIndex(frame=>
    frame.roadBands.length===2&&
    frame.roadBands[0].kind==='front'&&
    frame.roadBands[1].kind==='bunch'&&
    Math.abs(frame.roadBands[1].positionM-(finishM-100))<EPSILON);
  const handoff=road.frames[handoffIndex];
  const [front,bunch]=handoff?.roadBands??[];
  const frontId=front?.riderIds[0];
  const bunchIds=bunch?.riderIds;
  if(handoffIndex<0||front?.riderIds.length!==1||
    front.positionM<=bunch.positionM+EPSILON||
    !Array.isArray(bunchIds)||bunchIds.length!==roster.length-1||
    new Set([frontId,...bunchIds]).size!==roster.length||
    roster.some(id=>id!==frontId&&!bunchIds.includes(id)))
    throw new Error('The survivor line needs a complete separated handoff.');
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
    throw new Error('The survivor handoff lost earned energy.');
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  if(nominations.some(row=>row.finisherId===frontId))
    throw new Error('A nominated solo finisher needs its own paid sprint.');
  const soloGroup={id:`survivor:${frontId}`,riderIds:[frontId]};
  const sprintPlan=recordFinaleLateSeparatedSprintPlanFromTour(tour,{
    source:{endDistanceM:bunch.positionM,
      roadGroups:[soloGroup],pelotonRiderIds:bunchIds,
      riderEnergy:roster.map(riderId=>({riderId,
        energyAfter:handoffEnergy.get(riderId)}))},
    plans:nominations,sourceRoadTraceVersion:road.version});
  const source={distanceM:bunch.positionM,
    roadGroups:[soloGroup],pelotonRiderIds:bunchIds,
    riderEnergy:bunchIds.map(riderId=>({riderId,
      energy:handoffEnergy.get(riderId)})),
    bunchElapsedSeconds:handoff.elapsedSinceLaunchSeconds,
    sourceRoadTraceVersion:road.version};
  const positionedSource=resolveIndependentBunchSource(tour,{
    version:road.version,at500M:source,frames:[{}]},sprintPlan);
  const runner=recordFinalePositionedLateSeparatedRunnerFromTour(tour,{
    source,plan:sprintPlan,positionedSource});
  const frontCrossing=road.bandCrossings.find(row=>row.kind==='front');
  const frontFinal=road.finalRiders.find(row=>row.riderId===frontId);
  const frontSuffix=road.frames.slice(handoffIndex+1).map(frame=>({
    elapsedSinceLaunchSeconds:frame.elapsedSinceLaunchSeconds,
    roadBand:frame.roadBands.find(band=>
      band.riderIds.includes(frontId)),
    rider:frame.riders.find(row=>row.riderId===frontId)}));
  const frontSpent=frontSuffix.reduce((total,frame)=>
    total+(frame.rider?.energySpent??0),0);
  const frontSpeed=(finishM-front.positionM)/
    (frontCrossing?.elapsedSinceLaunchSeconds-
      handoff.elapsedSinceLaunchSeconds);
  if(!frontCrossing||!frontFinal||
    frontCrossing.riderIds?.length!==1||
    frontCrossing.riderIds[0]!==frontId||
    !Number.isFinite(frontCrossing.elapsedSinceLaunchSeconds)||
    frontCrossing.elapsedSinceLaunchSeconds<=
      handoff.elapsedSinceLaunchSeconds||
    !Number.isFinite(frontFinal.energyAtStop)||
    Math.abs(handoffEnergy.get(frontId)-frontSpent-
      frontFinal.energyAtStop)>EPSILON||
    !Number.isFinite(frontSpeed)||frontSpeed<=0||
    frontSuffix.some(frame=>frame.roadBand?.kind!=='front'||
      Math.abs(frame.roadBand.positionM-
        Math.min(finishM,front.positionM+frontSpeed*
          (frame.elapsedSinceLaunchSeconds-
            handoff.elapsedSinceLaunchSeconds)))>EPSILON)||
    frontFinal.positionM!==finishM||
    runner.finishers.length!==bunchIds.length||
    new Set(runner.finishers.map(row=>row.riderId)).size!==
      bunchIds.length||
    runner.finishers.some(row=>!handoffEnergy.has(row.riderId)||
      !Number.isFinite(row.elapsedSecondsFromLastKmStart)||
      !Number.isFinite(row.energyAtLine)||row.energyAtLine<0||
      row.energyAtLine>handoffEnergy.get(row.riderId)+EPSILON))
    throw new Error('The survivor line lost a paid individual crossing.');
  const contactAudit=auditFinaleConcurrentSoloAgainstBunch({
    handoff,front,bunchRunner:runner,
    frontCrossingSeconds:frontCrossing.elapsedSinceLaunchSeconds,
    finishM});
  if(contactAudit.minimumGapM<=EPSILON)
    throw new Error('The provisional bunch reached the solo before the line.');
  const frontTeam=tour.committedInputs.teams.find(team=>
    team.riders.some(rider=>rider.id===frontId));
  const conditionalCrossings=[{
    riderId:frontId,teamId:frontTeam.id,
    elapsedSecondsFromLastKmStart:
      frontCrossing.elapsedSinceLaunchSeconds,
    energyAtLine:frontFinal.energyAtStop},...runner.finishers];
  const provisionalLineOrder=positionedLineOrder(conditionalCrossings);
  return {version:FINALE_CONCURRENT_SURVIVOR_LINE_VERSION,
    sourceRoadTraceVersion:road.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    roadPrefix:{startDistanceM:road.startDistanceM,
      handoffDistanceM:bunch.positionM,
      sourceElapsedSinceLaunchSeconds:road.sourceElapsedSinceLaunchSeconds,
      handoffElapsedSinceLaunchSeconds:handoff.elapsedSinceLaunchSeconds,
      contactEvents:road.contactEvents,frames:roadPrefix,
      riderEnergyAtHandoff:roster.map(riderId=>({riderId,
        energy:handoffEnergy.get(riderId)}))},
    frontSuffix:{riderId:frontId,
      elapsedAtLineSeconds:frontCrossing.elapsedSinceLaunchSeconds,
      energyAtLine:frontFinal.energyAtStop,frames:frontSuffix},
    sprintPlan,positionedSource,runner,contactAudit,
    conditionalCrossings,provisionalLineOrder,
    roadStatus:'paid_surviving_front_conditional_individual_line',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

// Both trajectories are piecewise linear between the handoff and solo line.
// Testing each runner frame edge and active/sheltered switch therefore tests
// the entire interval, without assuming its line order proves no contact.
export function auditFinaleConcurrentSoloAgainstBunch({handoff,front,
  bunchRunner,
  frontCrossingSeconds,finishM}){
  const startSeconds=handoff.elapsedSinceLaunchSeconds;
  const frontSpeedMps=(finishM-front.positionM)/
    (frontCrossingSeconds-startSeconds);
  if(!Number.isFinite(frontSpeedMps)||frontSpeedMps<=0)
    throw new Error('The surviving front rider has no paid line speed.');
  let minimumGapM=Infinity,nearestRiderId=null,
    nearestElapsedSeconds=null;
  for(const frame of bunchRunner.frames){
    const frameStart=frame.elapsedSecondsAtStart;
    if(frameStart>=frontCrossingSeconds-EPSILON)break;
    for(const row of frame.riders){
      if(row.role==='finished')continue;
      const times=[0,row.activeSeconds,
        row.activeSeconds+row.shelteredSeconds,
        frontCrossingSeconds-frameStart]
        .filter(seconds=>seconds>=0&&
          seconds<=frame.durationSeconds+EPSILON&&
          seconds<=frontCrossingSeconds-frameStart+EPSILON);
      for(const seconds of times){
        const active=Math.min(seconds,row.activeSeconds);
        const sheltered=Math.min(Math.max(0,seconds-row.activeSeconds),
          row.shelteredSeconds);
        const bunchPosition=Math.min(finishM,row.positionBeforeM+
          (row.activeSeconds?active*row.activeDistanceM/
            row.activeSeconds:0)+
          (row.shelteredSeconds?sheltered*row.shelteredDistanceM/
            row.shelteredSeconds:0));
        const elapsedSeconds=frameStart+seconds;
        const frontPosition=front.positionM+frontSpeedMps*
          (elapsedSeconds-startSeconds);
        const gapM=frontPosition-bunchPosition;
        if(gapM<minimumGapM){
          minimumGapM=gapM;nearestRiderId=row.riderId;
          nearestElapsedSeconds=elapsedSeconds;
        }
      }
    }
  }
  if(!Number.isFinite(minimumGapM))
    throw new Error('The survivor line has no cross-band contact audit.');
  return {minimumGapM,nearestRiderId,nearestElapsedSeconds,
    status:minimumGapM>EPSILON?
      'no_provisional_cross_band_contact':'provisional_cross_band_contact'};
}

export function validateFinaleConcurrentSurvivorLineFromTour(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentSurvivorLineFromTour(tour,input)))
    throw new Error('Concurrent survivor individual line does not replay.');
  return true;
}
