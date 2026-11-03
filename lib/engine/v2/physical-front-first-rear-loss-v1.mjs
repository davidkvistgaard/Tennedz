// First sourced bunch loss with an existing named front rider. Solo
// completions are candidates until the ordered rear contacts are paid.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalFrontRaceV1} from
  './physical-front-race-replay-v1.mjs';
import {advancePhysicalBunchAfterFrontLossKmV1} from
  './physical-start-bunch-v1.mjs';
import {advancePhysicalFrontSoloFromBunchStepV1} from
  './physical-front-solo-run-v1.mjs';
import {completePhysicalFrontBunchLossFromStepV1} from
  './physical-pace-loss-completion-v1.mjs';
import {staggeredSoloTrajectoryV1} from
  './physical-staggered-solo-field-contact-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_FRONT_FIRST_REAR_LOSS_VERSION=
  'v2-physical-front-first-rear-loss-1';

export function replayPhysicalFrontFirstRearLossKmV1({
  startInput,start,attackKm,lossKm}){
  if(startInput?.physicalDraftVersion!==4||
    startInput?.physicalRearIntentVersion!==2||
    !Number.isInteger(lossKm)||
    lossKm<=attackKm+1||
    lossKm>startInput.routeKilometres.length)
    throw new Error(
      'Front first loss needs later paid route.');
  const before=replayPhysicalFrontRaceV1({
    startInput,start,attackKm,throughKm:lossKm-1});
  const last=before.kilometres.at(-1);
  const frontRiderId=before.sources.front.riderId;
  const priorBunchStep=before.sources.bunch.road.at(-1);
  const bunchRows=last.riderStates.filter(row=>
    row.physicalGroupId==='peloton');
  const frontRow=last.riderStates.find(row=>
    row.riderId===frontRiderId);
  if(!priorBunchStep||!frontRow||
    bunchRows.length+1!==start.riderIds.length||
    bunchRows.some(row=>row.elapsedSeconds!==
      bunchRows[0].elapsedSeconds))
    throw new Error(
      'Front first loss lacks prior paid field.');
  const bunchStartClock=bunchRows[0].elapsedSeconds;
  const prior={riderIds:[...priorBunchStep
    .physicalGroup.riderIds],
  energyByRider:priorBunchStep.energyByRider,
  quietKmByRider:priorBunchStep.quietKmByRider};
  if(!isDeepStrictEqual([...prior.riderIds].sort(),
    bunchRows.map(row=>row.riderId).sort())||
    bunchRows.some(row=>row.energyAfter!==
      prior.energyByRider[row.riderId]))
    throw new Error(
      'Front first loss bunch differs from source.');
  const bunchStep=advancePhysicalBunchAfterFrontLossKmV1({
    startInput,prior,
    segment:startInput.routeKilometres[lossKm-1],
    frontRiderId});
  if(!bunchStep.splits.length||bunchStep.attack)
    throw new Error(
      'Front first loss needs paid rear splits.');
  const bunchEndClock=bunchStartClock+
    bunchStep.elapsedSeconds;
  const frontStep=advancePhysicalFrontSoloFromBunchStepV1({
    startInput,prior:{sourceKm:lossKm-1,
      riderId:frontRiderId,
      elapsedSeconds:frontRow.elapsedSeconds,
      bunchElapsedSeconds:bunchStartClock,
      energyAfter:frontRow.energyAfter,
      gapSecondsToBunch:bunchStartClock-
        frontRow.elapsedSeconds},
    bunchStep});
  const candidateSoloCompletions=bunchStep.splits
    .map(split=>
      completePhysicalFrontBunchLossFromStepV1({
      startInput,lossKm,
      step:bunchStep,bunchElapsedSeconds:bunchEndClock,
      riderId:split.riderId}));
  const sourcedIds=[...bunchStep.physicalGroup
    .riderIds,frontRiderId,
  ...candidateSoloCompletions.map(row=>row.riderId)];
  if(sourcedIds.length!==start.riderIds.length||
    new Set(sourcedIds).size!==
      start.riderIds.length||
    candidateSoloCompletions.some(row=>
      row.elapsedSeconds<=bunchEndClock||
      row.energyAfter<0))
    throw new Error(
      'Front first loss lacks paid candidate roads.');
  const rearTracks=candidateSoloCompletions.map(
    completion=>{
      const trajectory=staggeredSoloTrajectoryV1({
        riderId:completion.riderId,lossKm,
        completion},lossKm,bunchStartClock,
      bunchStep);
      const split=bunchStep.splits.find(row=>
        row.riderId===completion.riderId);
      return {...trajectory,
        id:`solo-${completion.riderId}`,
        kind:'solo',riderIds:[completion.riderId],
        domainStartM:split.atDistanceM-
          (lossKm-1)*1000,
        domainEndM:1000};
    });
  const frontTrack={id:`front-${frontRiderId}`,
    kind:'front',riderId:frontRiderId,
    riderIds:[frontRiderId],
    breaks:[],domainStartM:0,
    domainEndM:1000,
    clockAt:metres=>frontRow.elapsedSeconds+
      frontStep.seconds*metres/1000,
    energyAt:metres=>frontStep.energyBefore-
      frontStep.energySpent*metres/1000};
  const bunchTrack={id:'peloton',
    riderId:'peloton',riderIds:[],
    breaks:[],domainStartM:0,
    domainEndM:1000,
    clockAt:metres=>bunchStartClock+
      bunchStep.elapsedSeconds*metres/1000};
  const candidateEvents=
    findPhysicalOrderedBoundaryEventsV1([
      frontTrack,...rearTracks],bunchTrack,
    lossKm);
  const decisions=new Map(bunchStep.riderDecisions
    .map(row=>[row.riderId,row]));
  const riderStates=!candidateEvents.length?[
    ...bunchStep.physicalGroup.riderIds.map(
      riderId=>({riderId,sourceKm:lossKm,
        physicalGroupId:'peloton',
        atDistanceM:lossKm*1000,
        elapsedSeconds:bunchEndClock,
        energyAfter:bunchStep.riders.find(row=>
          row.riderId===riderId).energyAfter,
        decisions:[decisions.get(riderId)]})),
    {riderId:frontRiderId,sourceKm:lossKm,
      physicalGroupId:frontStep.physicalGroup.id,
      atDistanceM:lossKm*1000,
      elapsedSeconds:frontStep.elapsedSeconds,
      energyAfter:frontStep.energyAfter,
      decisions:[frontStep.decision]},
    ...candidateSoloCompletions.map(row=>({
      riderId:row.riderId,sourceKm:lossKm,
      physicalGroupId:row.physicalGroup.id,
      atDistanceM:lossKm*1000,
      elapsedSeconds:row.elapsedSeconds,
      energyAfter:row.energyAfter,
      decisions:[row.decision]}))].sort((a,b)=>
    start.riderIds.indexOf(a.riderId)-
      start.riderIds.indexOf(b.riderId)):null;
  if(riderStates&&(riderStates.length!==
    start.riderIds.length||
    new Set(riderStates.map(row=>
      row.riderId)).size!==
      start.riderIds.length||
    riderStates.some(row=>!Number.isFinite(
      row.elapsedSeconds)||
      !Number.isFinite(row.energyAfter)||
      row.energyAfter<0||
      !row.decisions.length||
      row.decisions.some(decision=>!decision))))
    throw new Error(
      'Front first loss lacks settled rider states.');
  return {version:PHYSICAL_FRONT_FIRST_REAR_LOSS_VERSION,
    sourceKm:lossKm,
    sourcedRiderCount:sourcedIds.length,
    ...(riderStates?{riderCount:riderStates.length,
      riderStates}:{}),
    sources:{before,bunchStep,frontStep,
      candidateSoloCompletions},
    endBunchState:{
      riderIds:[...bunchStep.physicalGroup.riderIds],
      energyByRider:Object.fromEntries(
        bunchStep.physicalGroup.riderIds.map(id=>
          [id,bunchStep.energyByRider[id]])),
      quietKmByRider:Object.fromEntries(
        bunchStep.physicalGroup.riderIds.map(id=>
          [id,bunchStep.quietKmByRider[id]]))},
    endFrontState:{riderId:frontRiderId,
      elapsedSeconds:frontStep.elapsedSeconds,
      energyAfter:frontStep.energyAfter,
      gapSecondsToBunch:frontStep
        .gapSecondsToBunch},
    candidateRearSolos:candidateSoloCompletions,
    ...(riderStates?{
      endRearSolos:candidateSoloCompletions}:{}),
    firstCandidateEvent:candidateEvents[0]??null,
    candidateEventCount:candidateEvents.length,
    rearContactsUnsettled:Boolean(candidateEvents.length),
    fieldKilometreIncomplete:Boolean(
      candidateEvents.length),
    movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalFrontFirstRearLossKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalFrontFirstRearLossKmV1(input)))
    throw new Error(
      'Front first loss differs from paid source.');
  return true;
}
