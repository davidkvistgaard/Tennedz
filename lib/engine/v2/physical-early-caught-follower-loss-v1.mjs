// Complete the kilometre where a follower loses a bunch that has
// already caught and passed a named break rider. Every road is paid;
// subsequent solo contact and finish remain separate questions.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalCaughtBreakRaceV1} from
  './physical-caught-break-race-replay-v1.mjs';
import {advancePhysicalBunchAfterCaughtSlideLossKmV1} from
  './physical-start-bunch-v1.mjs';
import {completePhysicalPostCatchLossKmV1} from
  './physical-pace-loss-completion-v1.mjs';
import {advancePhysicalSlidBreakSoloKmV1} from
  './physical-slid-break-solo-run-v1.mjs';
import {contactPhysicalPostcatchSplitV1} from
  './physical-postcatch-split-contact-v1.mjs';
import {finishPhysicalPostcatchContactKmV1} from
  './physical-postcatch-contact-road-v1.mjs';
import {orderAt} from './orders.mjs';

export const PHYSICAL_EARLY_CAUGHT_FOLLOWER_LOSS_VERSION=
  'v2-physical-early-caught-follower-loss-1';

export function replayPhysicalEarlyCaughtFollowerLossV1({
  startInput,start,attackKm,catchKm,lossKm}){
  if(!Number.isInteger(lossKm)||lossKm<=catchKm+1||
    lossKm>startInput?.routeKilometres?.length)
    throw new Error('Early caught follower loss needs later road.');
  const priorRace=replayPhysicalCaughtBreakRaceV1({
    startInput,start,attackKm,catchKm,
    throughKm:lossKm-1});
  const priorBunch=priorRace.sources.bunch.road.at(-1);
  const prior={riderIds:priorBunch.physicalGroup.riderIds,
    energyByRider:priorBunch.energyByRider,
    quietKmByRider:priorBunch.quietKmByRider};
  const segment=startInput.routeKilometres[lossKm-1];
  const caughtRiderId=priorRace.sources.slide.riderId;
  const roadInput={startInput,prior,segment,caughtRiderId};
  const loss=advancePhysicalBunchAfterCaughtSlideLossKmV1(
    roadInput);
  if(loss.splits.length!==1)
    throw new Error('Early catch needs one priced follower loss.');
  const split=loss.splits[0];
  const previousStates=priorRace.kilometres.at(-1)
    .riderStates;
  const priorBunchClock=previousStates.find(row=>
    row.physicalGroupId==='peloton').elapsedSeconds;
  const completionInput={...roadInput,loss,
    priorBunchElapsedSeconds:priorBunchClock,
    riderId:split.riderId};
  const completion=completePhysicalPostCatchLossKmV1(
    completionInput);
  const caughtPrior=previousStates.find(row=>
    row.riderId===caughtRiderId);
  const contactInput={roadInput,loss,completion,
    priorBunchClock,frontRiderId:caughtRiderId,
    priorFrontClock:caughtPrior.elapsedSeconds,
    frontEnergyBefore:caughtPrior.energyAfter};
  let contact=null;
  try{contact=contactPhysicalPostcatchSplitV1(
    contactInput);}
  catch(error){
    if(error.message!==
      'Post-catch riders have no paid contact here.')
      throw error;
  }
  const groupRoad=contact?
    finishPhysicalPostcatchContactKmV1({contactInput,
      contact,leaderRiderId:split.riderId}):null;
  const caughtStep=contact?null:
    advancePhysicalSlidBreakSoloKmV1({
      startInput,slideRecord:priorRace.sources.slide,
      priorStep:priorRace.sources.solo.steps.at(-1),
      segment,bunchStep:loss,
      priorBunchElapsedSeconds:priorBunchClock});
  if(caughtStep&&
    caughtStep.elapsedSeconds<=completion.elapsedSeconds)
    throw new Error('Early caught solos need paid contact.');
  const bunchClock=priorBunchClock+loss.elapsedSeconds;
  const decisions=new Map(loss.riderDecisions.map(row=>
    [row.riderId,row]));
  const states=loss.physicalGroup.riderIds.map(riderId=>{
    const row=loss.riders.find(item=>item.riderId===riderId);
    return {riderId,sourceKm:lossKm,
      physicalGroupId:'peloton',atDistanceM:lossKm*1000,
      elapsedSeconds:bunchClock,energyAfter:row.energyAfter,
      decisions:[decisions.get(riderId)]};
  });
  if(groupRoad){
    const caughtTeam=startInput.teams.find(team=>
      team.riders.some(rider=>rider.id===caughtRiderId));
    for(const row of groupRoad.riders){
      const firstDecision=row.riderId===caughtRiderId?{
        riderId:caughtRiderId,goal:'finish_safely',
        teamOrderEffort:orderAt(caughtTeam.orders,
          lossKm-1).effort,
        choice:'ride_solo',effort:'conserve',
        reason:'cannot_hold_paid_bunch_pace'}:
        completion.decision;
      states.push({riderId:row.riderId,
        sourceKm:lossKm,
        physicalGroupId:groupRoad.physicalGroup.id,
        atDistanceM:lossKm*1000,
        elapsedSeconds:groupRoad.elapsedSeconds,
        energyAfter:row.energyAfter,
        decisions:[firstDecision,row.decision]});
    }
  }else{
    states.push({riderId:split.riderId,sourceKm:lossKm,
      physicalGroupId:completion.physicalGroup.id,
      atDistanceM:lossKm*1000,
      elapsedSeconds:completion.elapsedSeconds,
      energyAfter:completion.energyAfter,
      decisions:[completion.decision]});
    states.push({riderId:caughtRiderId,sourceKm:lossKm,
      physicalGroupId:caughtStep.physicalGroup.id,
      atDistanceM:lossKm*1000,
      elapsedSeconds:caughtStep.elapsedSeconds,
      energyAfter:caughtStep.energyAfter,
      decisions:[caughtStep.decision]});
  }
  if(states.length!==start.riderIds.length||
    new Set(states.map(row=>row.riderId)).size!==
      start.riderIds.length||
    states.some(row=>!row.decisions[0]||
      !Number.isFinite(row.energyAfter)||
      row.energyAfter<0||
      !Number.isFinite(row.elapsedSeconds)))
    throw new Error('Early caught loss lacks rider kilometre.');
  const lossKilometre={sourceKm:lossKm,
    riderStates:states.sort((a,b)=>
      start.riderIds.indexOf(a.riderId)-
      start.riderIds.indexOf(b.riderId))};
  return {version:PHYSICAL_EARLY_CAUGHT_FOLLOWER_LOSS_VERSION,
    sourceKm:lossKm,attackKm,catchKm,
    riderIds:[...start.riderIds],
    kilometres:[...priorRace.kilometres,lossKilometre],
    sources:{priorRace,loss,completion,
      ...(contact?{contact,groupRoad}:{caughtStep})},
    laterContactUnsettled:true,
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalEarlyCaughtFollowerLossV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalEarlyCaughtFollowerLossV1(input)))
    throw new Error('Early caught follower loss differs from source.');
  return true;
}
