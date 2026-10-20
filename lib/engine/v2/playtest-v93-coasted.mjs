import {isDeepStrictEqual} from 'node:util';
import {prepareV91Playtest} from './playtest.mjs';
import {simulateTacticalTour} from './tour.mjs';
import {validateRecordedTour} from './recording.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from './tuning.mjs';
import {recordFinaleCoastDroppedLastKmClock,
  validateFinaleCoastDroppedLastKmClock} from
  './finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine,
  validateFinaleDepletedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {projectV93ProvisionalCoastedPointPreview} from
  './playtest-point-preview.mjs';

export const V93_COASTED_PLAYTEST_VERSION='v93-coasted-playtest-1';

// A bounded full-race preview: the selected route and all manager tactics
// generate one locked road, followed by a coasted kilometre, nominated
// individual crossings and a read-only policy illustration.
export function createV93CoastedPlaytest(settings,{plans=null,
  pointContext=null}={}){
  const prepared=prepareV91Playtest(settings);
  const {stage,weather,teams,seed}=prepared;
  const recording=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  validateRecordedTour(recording);
  const clock=recordFinaleCoastDroppedLastKmClock(recording);
  validateFinaleCoastDroppedLastKmClock(recording,clock);
  const individualLine=recordFinaleCoastedIndividualLine(recording,clock,
    {plans});
  const appliedPlans=individualLine.sprintPlan.decisions.map(row=>({
    teamId:row.teamId,finisherId:row.finisherId,
    leadOutRiderId:row.leadOutRiderId}));
  validateFinaleDepletedIndividualLine(recording,clock,
    {plans:appliedPlans},individualLine);
  let pointPreview=null;
  if(pointContext)try{
    pointPreview=projectV93ProvisionalCoastedPointPreview(recording,clock,
      individualLine,pointContext);
  }catch(error){
    if(error.message!=='Preview points need an unambiguous multiband order.')
      throw error;
    pointPreview={status:'unavailable',
      reason:'Tied conditional crossings have no unique point placing.',
      pointsStatus:'withheld',canCommitAwards:false};
  }
  return {version:V93_COASTED_PLAYTEST_VERSION,
    settings:prepared.settings,recording,clock,individualLine,
    appliedPlans,pointPreview,
    roadStatus:individualLine.roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateV93CoastedPlaytest(settings,input,recorded){
  if(!isDeepStrictEqual(recorded,
    createV93CoastedPlaytest(settings,input)))
    throw new Error('The v93 coasted playtest does not replay.');
  return true;
}

export function summarizeV93CoastedPlaytest(race){
  const {settings,recording,clock,individualLine}=race;
  const source=recording.frames.at(-2);
  const crossingById=new Map(individualLine.conditionalCrossings.map(row=>
    [row.riderId,row]));
  if(source.km!==recording.route.distanceKm-1||
    crossingById.size!==recording.committedInputs.teams.length*8)
    throw new Error('The coasted workbench lost its locked field.');
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
      ...frame,sourceKm:clock.sourceKm})),
    bandReplays:individualLine.bandRunners.map(band=>({
      id:band.roadBandId,
      riderIds:band.runner.finishers.map(row=>row.riderId),
      passageAt500Seconds:band.paidTo500Seconds??
        clock.passageFrames.find(frame=>frame.distanceM===
          recording.route.distanceKm*1000-500)?.droppedPassages.find(row=>
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
