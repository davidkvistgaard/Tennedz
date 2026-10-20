import {isDeepStrictEqual} from 'node:util';
import {prepareV91Playtest} from './playtest.mjs';
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
  recordFinaleSeparatedLastKmClock,
  recordFinaleSingleGroupLastKmClock,
  validateFinaleSeparatedLastKmClock,
  validateFinaleSingleGroupLastKmClock,
  validateFinaleCoastDroppedLastKmClock} from
  './finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine,
  validateFinaleDepletedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {projectV93ProvisionalCoastedPointPreview,
  projectV93ProvisionalSeparatedPointPreview,
  projectV93ProvisionalSingleGroupPointPreview,
  projectV93ProvisionalBunchOnlyPointPreview} from
  './playtest-point-preview.mjs';
import {recordFinaleSeparatedIndividualLine,
  validateFinaleSeparatedIndividualLine,
  recordFinaleSingleGroupIndividualLine,
  validateFinaleSingleGroupIndividualLine} from
  './finale-separated-individual-line.mjs';

export const V93_COASTED_PLAYTEST_VERSION='v93-coasted-playtest-1';
export const V93_SEPARATED_PLAYTEST_VERSION='v93-separated-playtest-1';
export const V93_SINGLE_GROUP_PLAYTEST_VERSION='v93-single-group-playtest-1';
export const V93_BUNCH_ONLY_PLAYTEST_VERSION='v93-bunch-only-playtest-1';

// A bounded full-race preview: the selected route and all manager tactics
// generate one locked road, followed by a paid kilometre, nominated
// individual crossings and a read-only policy illustration.
export function createV93PlayableTest(settings,{plans=null,
  pointContext=null}={}){
  const prepared=prepareV91Playtest(settings);
  const {stage,weather,teams,seed}=prepared;
  const recording=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  validateRecordedTour(recording);
  const source=recording.frames.at(-2);
  const dropped=source.riderGroups.filter(row=>row.group==='dropped');
  const separated=source.roadGroups.length>=2&&dropped.length===0;
  const singleGroup=source.roadGroups.length===1&&dropped.length===0;
  const bunchOnly=source.roadGroups.length===0&&dropped.length===0;
  const coasted=source.roadGroups.length>=1&&dropped.length>0;
  if(!separated&&!singleGroup&&!bunchOnly&&!coasted)
    throw new Error('The v93 preview cannot pay this final-kilometre road.');
  const clock=separated?recordFinaleSeparatedLastKmClock(recording):
    singleGroup?recordFinaleSingleGroupLastKmClock(recording):
      bunchOnly?recordFinaleBunchOnlyLastKmClock(recording):
        recordFinaleCoastDroppedLastKmClock(recording);
  if(separated)validateFinaleSeparatedLastKmClock(recording,clock);
  else if(singleGroup)validateFinaleSingleGroupLastKmClock(recording,clock);
  else if(bunchOnly)validateFinaleBunchOnlyLastKmClock(recording,clock);
  else validateFinaleCoastDroppedLastKmClock(recording,clock);
  const individualLine=separated?
    recordFinaleSeparatedIndividualLine(recording,clock,{plans}):
    singleGroup?recordFinaleSingleGroupIndividualLine(recording,clock,
      {plans}):bunchOnly?recordFinaleBunchOnlyIndividualLine(recording,
      clock,{plans}):recordFinaleCoastedIndividualLine(recording,clock,
      {plans});
  const appliedPlans=individualLine.sprintPlan.decisions.map(row=>({
    teamId:row.teamId,finisherId:row.finisherId,
    leadOutRiderId:row.leadOutRiderId}));
  if(separated)validateFinaleSeparatedIndividualLine(recording,clock,
    {plans:appliedPlans},individualLine);
  else if(singleGroup)validateFinaleSingleGroupIndividualLine(recording,clock,
    {plans:appliedPlans},individualLine);
  else if(bunchOnly)validateFinaleBunchOnlyIndividualLine(recording,clock,
    {plans:appliedPlans},individualLine);
  else validateFinaleDepletedIndividualLine(recording,clock,
    {plans:appliedPlans},individualLine);
  let pointPreview=null;
  if(pointContext)try{
    pointPreview=(separated?
      projectV93ProvisionalSeparatedPointPreview:
      singleGroup?projectV93ProvisionalSingleGroupPointPreview:
        bunchOnly?projectV93ProvisionalBunchOnlyPointPreview:
          projectV93ProvisionalCoastedPointPreview)(recording,clock,
      individualLine,pointContext);
  }catch(error){
    if(error.message!=='Preview points need an unambiguous multiband order.')
      throw error;
    pointPreview={status:'unavailable',
      reason:'Tied conditional crossings have no unique point placing.',
      pointsStatus:'withheld',canCommitAwards:false};
  }
  return {version:separated?V93_SEPARATED_PLAYTEST_VERSION:
    singleGroup?V93_SINGLE_GROUP_PLAYTEST_VERSION:
      bunchOnly?V93_BUNCH_ONLY_PLAYTEST_VERSION:
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
    createV93PlayableTest(settings,input)))
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
  return {version:race.version,settings,
    tuningVersion:recording.tuningVersion,
    handoffKm:source.km,
    kilometreFrames:recording.frames.slice(0,-1).map(frame=>({
      km:frame.km,terrain:frame.terrain,
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
    managerDecisions:individualLine.sprintPlan.decisions,
    leadOutWork:individualLine.bandRunners.flatMap(band=>
      band.runner.frames.flatMap(frame=>frame.riders.filter(row=>
        row.role==='lead_out'&&row.energySpent>0).map(row=>({
        riderId:row.riderId,roadBandId:band.roadBandId,
        startDistanceM:frame.startDistanceM,
        endDistanceM:frame.endDistanceM,
        energySpent:row.energySpent})))),
    pointPreview:race.pointPreview,
    roadStatus:race.roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}
