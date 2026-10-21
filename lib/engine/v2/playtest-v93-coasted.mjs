import {isDeepStrictEqual} from 'node:util';
import {prepareV91Playtest} from './playtest.mjs';
import {validateRequestedFinalePlans} from './playtest-finale-trial.mjs';
import {simulateTacticalTour} from './tour.mjs';
import {validateRecordedTour} from './recording.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from './tuning.mjs';
import {recordFinaleBunchOnlyLastKmClock,
  validateFinaleBunchOnlyLastKmClock} from
  './finale-bunch-only-last-km.mjs';
import {recordFinaleBunchOnlyIndividualLine,
  validateFinaleBunchOnlyIndividualLine} from
  './finale-bunch-only-individual-line.mjs';
import {recordFinaleCoastDroppedLastKmClock,
  recordFinaleCoastNoFrontDroppedLastKmClock,
  recordFinaleCoastDynamicNoFrontLastKmClock,
  recordFinaleCoastDynamicFrontLastKmClock,
  recordFinaleCoastDynamicActiveLastKmClock,
  recordFinaleCoastDynamicSingleLastKmClock,
  recordFinaleSeparatedLastKmClock,
  recordFinaleSingleGroupLastKmClock,
  validateFinaleSeparatedLastKmClock,
  validateFinaleSingleGroupLastKmClock,
  validateFinaleCoastDroppedLastKmClock,
  validateFinaleCoastNoFrontDroppedLastKmClock,
  validateFinaleCoastDynamicNoFrontLastKmClock,
  validateFinaleCoastDynamicFrontLastKmClock,
  validateFinaleCoastDynamicActiveLastKmClock,
  validateFinaleCoastDynamicSingleLastKmClock} from
  './finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine,
  recordFinaleCoastedIsolatedPassIndividualLine,
  validateFinaleDepletedIndividualLine,
  FINALE_COASTED_INDIVIDUAL_LINE_VERSION,
  FINALE_COAST_ISOLATED_PASS_INDIVIDUAL_LINE_VERSION,
  FINALE_COAST_SINGLETON_INDIVIDUAL_LINE_VERSION} from
  './finale-depleted-individual-line.mjs';
import {projectV93ProvisionalCoastedPointPreview,
  projectV93ProvisionalIsolatedPassPointPreview,
  projectV93ProvisionalSeparatedPointPreview,
  projectV93ProvisionalSingleGroupPointPreview,
  projectV93ProvisionalBunchOnlyPointPreview,
  projectV93ProvisionalCoastNoFrontPointPreview} from
  './playtest-point-preview.mjs';
import {recordFinaleSeparatedIndividualLine,
  validateFinaleSeparatedIndividualLine,
  recordFinaleSingleGroupIndividualLine,
  validateFinaleSingleGroupIndividualLine} from
  './finale-separated-individual-line.mjs';
import {projectFinaleDynamicSingleRoadBounds} from
  './finale-dynamic-single-road-bounds.mjs';
import {projectFinaleDynamicActiveRoadBounds} from
  './finale-dynamic-active-road-bounds.mjs';
import {projectFinaleDynamicFrontRoadBounds} from
  './finale-dynamic-front-road-bounds.mjs';

export const V93_COASTED_PLAYTEST_VERSION='v93-coasted-playtest-1';
export const V93_COAST_ISOLATED_PASS_PLAYTEST_VERSION=
  'v93-coast-isolated-pass-playtest-1';
export const V93_SEPARATED_PLAYTEST_VERSION='v93-separated-playtest-1';
export const V93_SINGLE_GROUP_PLAYTEST_VERSION='v93-single-group-playtest-1';
export const V93_BUNCH_ONLY_PLAYTEST_VERSION='v93-bunch-only-playtest-1';
export const V93_COAST_NO_FRONT_PLAYTEST_VERSION=
  'v93-coast-no-front-playtest-1';
export const V93_DYNAMIC_NO_FRONT_PLAYTEST_VERSION=
  'v93-dynamic-no-front-playtest-1';
export const V93_DYNAMIC_FRONT_PLAYTEST_VERSION=
  'v93-dynamic-front-playtest-1';
export const V93_DYNAMIC_ACTIVE_PLAYTEST_VERSION=
  'v93-dynamic-active-playtest-1';
export const V93_COAST_SINGLETON_PLAYTEST_VERSION=
  'v93-coast-singleton-playtest-1';
export const V93_DYNAMIC_SINGLE_PLAYTEST_VERSION=
  'v93-dynamic-single-playtest-1';

// A bounded full-race preview: the selected route and all manager tactics
// generate one locked road, followed by a paid kilometre, nominated
// individual crossings and a read-only policy illustration.
export function createV93PlayableTest(settings,{plans=null,
  pointContext=null}={}, {resolveIsolatedPasses=true}={}){
  const prepared=prepareV91Playtest(settings);
  const {stage,weather,teams,seed}=prepared;
  if(plans!==null)validateRequestedFinalePlans(plans,teams);
  const recording=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  validateRecordedTour(recording);
  const source=recording.frames.at(-2);
  const dropped=source.riderGroups.filter(row=>row.group==='dropped');
  const separated=source.roadGroups.length>=2&&dropped.length===0;
  const singleGroup=source.roadGroups.length===1&&dropped.length===0;
  const bunchOnly=source.roadGroups.length===0&&dropped.length===0;
  const coastNoFront=source.roadGroups.length===0&&dropped.length>0;
  const coasted=source.roadGroups.length>=1&&dropped.length>0;
  if(!separated&&!singleGroup&&!bunchOnly&&!coastNoFront&&!coasted)
    throw new Error('The v93 preview cannot pay this final-kilometre road.');
  let dynamicNoFront=false;
  let dynamicFront=false;
  let dynamicActive=false;
  let dynamicSingle=false;
  const singleClock=()=>{
    try{return recordFinaleSingleGroupLastKmClock(recording);}
    catch(error){
      if(!error.message.startsWith(
        'A separated-group rider cannot pay for travel:'))
        throw error;
      dynamicSingle=true;
      return recordFinaleCoastDynamicSingleLastKmClock(recording);
    }
  };
  const noFrontClock=()=>{
    try{return recordFinaleCoastNoFrontDroppedLastKmClock(recording);}
    catch(error){
      if(error.message!==
        'Newly exhausted finale riders need recorded drop travel.')
        throw error;
      dynamicNoFront=true;
      return recordFinaleCoastDynamicNoFrontLastKmClock(recording);
    }
  };
  const frontClock=()=>{
    try{return recordFinaleCoastDroppedLastKmClock(recording);}
    catch(error){
      if(error.message===
        'Newly exhausted finale riders need recorded drop travel.'){
        dynamicActive=true;
        return recordFinaleCoastDynamicActiveLastKmClock(recording);
      }
      if(!error.message.startsWith(
        'A separated-group rider cannot pay for travel:'))
        throw error;
      dynamicFront=true;
      return recordFinaleCoastDynamicFrontLastKmClock(recording);
    }
  };
  const clock=separated?recordFinaleSeparatedLastKmClock(recording):
    singleGroup?singleClock():
      bunchOnly?recordFinaleBunchOnlyLastKmClock(recording):
        coastNoFront?
          noFrontClock():
          frontClock();
  if(separated)validateFinaleSeparatedLastKmClock(recording,clock);
  else if(dynamicSingle)validateFinaleCoastDynamicSingleLastKmClock(
    recording,clock);
  else if(singleGroup)validateFinaleSingleGroupLastKmClock(recording,clock);
  else if(bunchOnly)validateFinaleBunchOnlyLastKmClock(recording,clock);
  else if(dynamicNoFront)validateFinaleCoastDynamicNoFrontLastKmClock(
    recording,clock);
  else if(coastNoFront)validateFinaleCoastNoFrontDroppedLastKmClock(
    recording,clock);
  else if(dynamicActive)validateFinaleCoastDynamicActiveLastKmClock(
    recording,clock);
  else if(dynamicFront)validateFinaleCoastDynamicFrontLastKmClock(
    recording,clock);
  else validateFinaleCoastDroppedLastKmClock(recording,clock);
  const baseLine=separated?
    recordFinaleSeparatedIndividualLine(recording,clock,{plans}):
    singleGroup&&!dynamicSingle?
      recordFinaleSingleGroupIndividualLine(recording,clock,
      {plans}):bunchOnly?recordFinaleBunchOnlyIndividualLine(recording,
      clock,{plans}):recordFinaleCoastedIndividualLine(recording,clock,
      {plans});
  const individualLine=resolveIsolatedPasses&&baseLine.version===
    FINALE_COASTED_INDIVIDUAL_LINE_VERSION&&
    baseLine.pre500Audit.firstPotentialOverlap&&
    !baseLine.overlapAudit.firstPotentialOverlap?
    recordFinaleCoastedIsolatedPassIndividualLine(recording,clock,
      {plans})??baseLine:baseLine;
  const appliedPlans=individualLine.sprintPlan.decisions.map(row=>({
    teamId:row.teamId,finisherId:row.finisherId,
    leadOutRiderId:row.leadOutRiderId}));
  if(separated)validateFinaleSeparatedIndividualLine(recording,clock,
    {plans:appliedPlans},individualLine);
  else if(singleGroup&&!dynamicSingle)
    validateFinaleSingleGroupIndividualLine(recording,clock,
    {plans:appliedPlans},individualLine);
  else if(bunchOnly)validateFinaleBunchOnlyIndividualLine(recording,clock,
    {plans:appliedPlans},individualLine);
  else validateFinaleDepletedIndividualLine(recording,clock,
    {plans:appliedPlans},individualLine);
  const coastedSingleton=individualLine.version===
    FINALE_COAST_SINGLETON_INDIVIDUAL_LINE_VERSION;
  let pointPreview=null;
  if(pointContext&&dynamicSingle)
    pointPreview={status:'unavailable',
      reason:'New front drops remain ahead without a resolved road contact order.',
      pointsStatus:'withheld',canCommitAwards:false};
  else if(pointContext&&dynamicActive)
    pointPreview={status:'unavailable',
      reason:'Newly isolated bunch riders have unresolved pre-500 m road contact.',
      pointsStatus:'withheld',canCommitAwards:false};
  else if(pointContext&&coastedSingleton)
    pointPreview={status:'unavailable',
      reason:'Singleton fronts and isolated riders have unresolved road contact.',
      pointsStatus:'withheld',canCommitAwards:false};
  else if(pointContext&&dynamicFront)
    pointPreview={status:'unavailable',
      reason:'A front rider passed through the bunch without a resolved contact order.',
      pointsStatus:'withheld',canCommitAwards:false};
  else if(pointContext&&dynamicNoFront)
    pointPreview={status:'unavailable',
      reason:'Newly isolated riders have unresolved pre-500 m road contact.',
      pointsStatus:'withheld',canCommitAwards:false};
  else if(pointContext)try{
    pointPreview=(separated?
      projectV93ProvisionalSeparatedPointPreview:
      singleGroup?projectV93ProvisionalSingleGroupPointPreview:
        bunchOnly?projectV93ProvisionalBunchOnlyPointPreview:
          coastNoFront?projectV93ProvisionalCoastNoFrontPointPreview:
          individualLine.version===
            FINALE_COAST_ISOLATED_PASS_INDIVIDUAL_LINE_VERSION?
            projectV93ProvisionalIsolatedPassPointPreview:
          projectV93ProvisionalCoastedPointPreview)(recording,clock,
      individualLine,pointContext);
  }catch(error){
    const contact=error.message===
      'Preview points need separate paid individual bands.'&&
      (individualLine.pre500Audit?.firstPotentialOverlap||
        individualLine.overlapAudit?.firstPotentialOverlap);
    if(!contact&&error.message!==
      'Preview points need an unambiguous multiband order.')
      throw error;
    pointPreview={status:'unavailable',
      reason:contact?
        'Potential road-band contact leaves no defensible point order.':
        'Tied conditional crossings have no unique point placing.',
      pointsStatus:'withheld',canCommitAwards:false};
  }
  return {version:separated?V93_SEPARATED_PLAYTEST_VERSION:
    individualLine.version===
      FINALE_COAST_ISOLATED_PASS_INDIVIDUAL_LINE_VERSION?
      V93_COAST_ISOLATED_PASS_PLAYTEST_VERSION:
    dynamicSingle?V93_DYNAMIC_SINGLE_PLAYTEST_VERSION:
      singleGroup?V93_SINGLE_GROUP_PLAYTEST_VERSION:
      bunchOnly?V93_BUNCH_ONLY_PLAYTEST_VERSION:
        dynamicActive?V93_DYNAMIC_ACTIVE_PLAYTEST_VERSION:
        dynamicFront?V93_DYNAMIC_FRONT_PLAYTEST_VERSION:
        dynamicNoFront?V93_DYNAMIC_NO_FRONT_PLAYTEST_VERSION:
        coastNoFront?V93_COAST_NO_FRONT_PLAYTEST_VERSION:
        coastedSingleton?V93_COAST_SINGLETON_PLAYTEST_VERSION:
        V93_COASTED_PLAYTEST_VERSION,
    settings:prepared.settings,recording,clock,individualLine,
    appliedPlans,pointPreview,
    roadStatus:individualLine.roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function createV93CoastedPlaytest(settings,input={}){
  return createV93PlayableTest(settings,input);
}

export function validateV93CoastedPlaytest(settings,input,recorded){
  if(!isDeepStrictEqual(recorded,
    createV93PlayableTest(settings,input,{
      resolveIsolatedPasses:recorded?.version!==
        V93_COASTED_PLAYTEST_VERSION})))
    throw new Error('The v93 road-to-line playtest does not replay.');
  return true;
}

export function summarizeV93CoastedPlaytest(race){
  const {settings,recording,clock,individualLine}=race;
  const source=recording.frames.at(-2);
  const crossingById=new Map(individualLine.conditionalCrossings.map(row=>
    [row.riderId,row]));
  if(source.km!==recording.route.distanceKm-1||
    crossingById.size!==recording.committedInputs.teams.length*8)
    throw new Error('The v93 workbench lost its locked field.');
  const contactCandidates=[
    ['paid_first_500m',individualLine.pre500Audit?.firstPotentialOverlap],
    ['paid_final_500m',individualLine.overlapAudit?.firstPotentialOverlap]]
    .filter(([,contact])=>contact)
    .map(([sourcePhase,contact])=>({sourcePhase,
      distanceM:contact.distanceM,
      elapsedSecondsFromLastKmStart:
        contact.elapsedSecondsFromLastKmStart,
      riderIds:[contact.firstRiderId??contact.aheadRiderId??
        contact.frontRiderId,
      contact.secondRiderId??contact.behindRiderId??
        contact.bunchRiderId],
      roadBandIds:[contact.firstRoadBandId??contact.aheadRoadBandId,
        contact.secondRoadBandId??contact.behindRoadBandId]}))
    .sort((a,b)=>a.elapsedSecondsFromLastKmStart-
      b.elapsedSecondsFromLastKmStart);
  const needsContactWitness=contactCandidates.length>0&&
    individualLine.provisionalLineOrder===null;
  if(race.pointPreview?.reason===
    'Potential road-band contact leaves no defensible point order.'&&
    !needsContactWitness)
    throw new Error('Withheld contact points need a paid contact witness.');
  const potentialRoadContact=needsContactWitness?
    contactCandidates[0]:null;
  if(needsContactWitness&&(!potentialRoadContact||
    potentialRoadContact.riderIds.some(id=>!crossingById.has(id))||
    potentialRoadContact.riderIds.some((id,index)=>
      crossingById.get(id).roadBandId!==
        potentialRoadContact.roadBandIds[index])||
    !Number.isFinite(potentialRoadContact.distanceM)||
    !Number.isFinite(
      potentialRoadContact.elapsedSecondsFromLastKmStart)))
    throw new Error('The potential contact has no matching paid replay.');
  const isolatedPassEvents=individualLine.version===
    FINALE_COAST_ISOLATED_PASS_INDIVIDUAL_LINE_VERSION?
    individualLine.pre500Audit.passes.map(event=>({
      ...event,passingRoadBandId:`isolated:${event.passingRiderId}`,
      passedRoadBandId:`isolated:${event.passedRiderId}`})):[];
  if(isolatedPassEvents.some(event=>
    crossingById.get(event.passingRiderId)?.roadBandId!==
      event.passingRoadBandId||
    crossingById.get(event.passedRiderId)?.roadBandId!==
      event.passedRoadBandId||
    event.distanceM<=recording.route.distanceKm*1000-1000||
    event.distanceM>=recording.route.distanceKm*1000-500))
    throw new Error('An isolated pass has no matching paid rider path.');
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
      roadGroups:frame.roadGroups.map(group=>({id:group.id,
        gapSeconds:group.gapSeconds,riderIds:group.riderIds})),
      droppedRiders:frame.riderGroups.filter(row=>row.group==='dropped')
        .map(row=>({riderId:row.id,deficitSeconds:row.deficitSeconds,
          energy:row.energy})),
      ownRiders:frame.riderGroups.filter(row=>row.teamId==='you')
        .map(row=>({riderId:row.id,roadGroup:row.group,
          energy:row.energy})),
      coastedRiders:frame.energyLedger.filter(row=>
        row.coastDelaySeconds>0).length})),
    lastKmRoad:clock.passageFrames.map(frame=>({
      ...frame,droppedPassages:frame.droppedPassages??[],
      sourceKm:clock.sourceKm})),
    bandReplays:individualLine.bandRunners.map(band=>({
      id:band.roadBandId,
      riderIds:band.runner.finishers.map(row=>row.riderId),
      passageAt500Seconds:band.paidTo500Seconds??
        clock.passageFrames.find(frame=>frame.distanceM===
          recording.route.distanceKm*1000-500)?.droppedPassages?.find(row=>
          band.roadBandId===`isolated:${row.riderId}`)
          ?.passageSecondsFromBunchMarker,
      frames:band.runner.frames})),
    lineTimes:individualLine.conditionalCrossings,
    provisionalLineOrder:individualLine.provisionalLineOrder,
    ...(race.version===V93_DYNAMIC_SINGLE_PLAYTEST_VERSION?{
      roadPlaceBounds:projectFinaleDynamicSingleRoadBounds(clock,
        individualLine)}:{}),
    ...(race.version===V93_DYNAMIC_ACTIVE_PLAYTEST_VERSION&&
      clock.line.bands.length===3?{
      roadPlaceBounds:projectFinaleDynamicActiveRoadBounds(recording,
        clock,individualLine)}:{}),
    ...(race.version===V93_DYNAMIC_FRONT_PLAYTEST_VERSION&&
      clock.line.bands.length===3?{
      roadPlaceBounds:projectFinaleDynamicFrontRoadBounds(recording,
        clock,individualLine)}:{}),
    managerDecisions:individualLine.sprintPlan.decisions,
    managerOrders:recording.committedInputs.teams.map(team=>({
      teamId:team.id,...team.orders.baseline,
      phaseOrders:team.orders.phases.map(phase=>({...phase}))})),
    leadOutWork:individualLine.bandRunners.flatMap(band=>
      band.runner.frames.flatMap(frame=>frame.riders.filter(row=>
        row.role==='lead_out'&&row.energySpent>0).map(row=>({
        riderId:row.riderId,roadBandId:band.roadBandId,
        startDistanceM:frame.startDistanceM,
        endDistanceM:frame.endDistanceM,
        energySpent:row.energySpent})))),
    pointPreview:race.pointPreview,
    ...(potentialRoadContact?{potentialRoadContact:{
      ...potentialRoadContact,status:'potential_longitudinal_overlap',
      contactResolved:false}}:{}),
    ...(isolatedPassEvents.length?{isolatedPassEvents}:{}),
    roadStatus:race.roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}
