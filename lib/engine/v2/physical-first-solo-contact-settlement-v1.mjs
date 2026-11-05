// Replace one crossing pair of provisional paid solo roads with a
// repriced shared road. Any further contact remains a hard refusal.
import {assertNoUnpaidLaunchCrossingsV1} from
  './physical-first-road-crossing-guard-v1.mjs';
import {resolvePhysicalFirstSoloContactV1} from
  './physical-first-solo-contact-v1.mjs';
import {resolvePhysicalFirstBunchCatchV1} from
  './physical-first-bunch-catch-v1.mjs';

export const PHYSICAL_FIRST_SOLO_CONTACT_SETTLEMENT_VERSION=
  'physical-first-solo-contact-settlement-2';
const EPS=.002;

export function settlePhysicalFirstSoloCrossingV1({prior,
  roads,finishes,launchEvents,otherSteps,pelotonStep,
  segment,kilometres,teams,stakes}){
  try{
    assertNoUnpaidLaunchCrossingsV1(prior,roads,
      launchEvents);
    return {version:PHYSICAL_FIRST_SOLO_CONTACT_SETTLEMENT_VERSION,
      roads,finishes,events:[]};
  }catch(error){
    const evidence=error.sourceEvidence;
    const ids=[evidence?.firstRoadId,
      evidence?.secondRoadId];
    if(/Road crossing needs recorded paid contact/
      .test(error.message)&&
      ids.includes('peloton')&&
      evidence.projectedMeeting){
      const soloRoadId=ids.find(id=>
        id!=='peloton');
      const soloStep=otherSteps.find(step=>
        step.priorRoadId===soloRoadId&&
        step.road?.kind==='solo');
      if(!soloStep)throw error;
      const catchResult=resolvePhysicalFirstBunchCatchV1({
        prior,pelotonStep,soloStep,
        segment,kilometres,teams,stakes});
      const remainingPrior={...prior,
        roads:prior.roads.filter(row=>
          row.roadId!==soloRoadId)};
      const remainingRoads=roads.filter(row=>
        row.roadId!==soloRoadId).map(row=>
        row.roadId==='peloton'?
          catchResult.road:row);
      assertNoUnpaidLaunchCrossingsV1(
        remainingPrior,remainingRoads,
        launchEvents.filter(event=>
          event.fromRoadId!==soloRoadId));
      const soloStart=prior.roads.find(row=>
        row.roadId===soloRoadId)
        .clockSeconds;
      const soloEnd=soloStep.road
        .finishClockSeconds;
      for(const other of roads){
        if(['peloton',soloRoadId].includes(
          other.roadId))continue;
        const old=prior.roads.find(row=>
          row.roadId===other.roadId);
        const start=old?.clockSeconds??
          other.startClockSeconds;
        const before=soloStart-start;
        const after=soloEnd-
          other.finishClockSeconds;
        if(!Number.isFinite(start)||
          Math.abs(before)<=EPS||
          Math.abs(after)<=EPS||
          Math.sign(before)!==Math.sign(after))
          throw new Error(
            'Caught solo also crosses another road.');
      }
      return {version:
        PHYSICAL_FIRST_SOLO_CONTACT_SETTLEMENT_VERSION,
        roads:catchResult.joined?
          remainingRoads:roads,
        finishes:catchResult.joined?
          finishes.filter(row=>
            row.riderId!==
              catchResult.event.riderId)
            .concat([catchResult.finish]):
          finishes,
        events:[catchResult]};
    }
    const pair=ids.map(id=>otherSteps.find(step=>
      step.priorRoadId===id&&
      step.road?.kind==='solo'));
    if(!/Road crossing needs recorded paid contact/
      .test(error.message)||
      !pair.every(Boolean)||
      !evidence.projectedMeeting||
      !ids.every(id=>prior.roads.some(row=>
        row.roadId===id)))throw error;
    const contact=resolvePhysicalFirstSoloContactV1({
      prior,firstStep:pair[0],secondStep:pair[1],
      segment,kilometres,teams,stakes});
    const consumed=new Set(ids);
    const untouchedPrior={...prior,roads:
      prior.roads.filter(row=>
        !consumed.has(row.roadId))};
    const untouchedRoads=roads.filter(row=>
      !consumed.has(row.roadId));
    assertNoUnpaidLaunchCrossingsV1(
      untouchedPrior,untouchedRoads,
      launchEvents.filter(event=>
        !consumed.has(event.fromRoadId)));
    const fraction=(contact.atDistanceM-
      prior.sourceKm*1000)/1000;
    for(const other of untouchedRoads){
      const old=prior.roads.find(row=>
        row.roadId===other.roadId);
      const start=old?.clockSeconds??
        other.startClockSeconds;
      if(!Number.isFinite(start)||
        !Number.isFinite(other.finishClockSeconds)||
        other.startDistanceM!==prior.sourceKm*1000||
        other.endDistanceM!==segment.km*1000)
        throw new Error(
          'Solo contact needs a complete comparison road.');
      const atContact=start+fraction*
        (other.finishClockSeconds-start);
      const mid=contact.atClockSeconds-
        atContact;
      const end=contact.road.finishClockSeconds-
        other.finishClockSeconds;
      for(const id of ids){
        const source=prior.roads.find(row=>
          row.roadId===id);
        const before=source.clockSeconds-start;
        if(Math.abs(before)<=EPS||
          Math.abs(mid)<=EPS||
          Math.sign(before)!==Math.sign(mid))
          throw new Error(
            'Solo approach crosses another road before contact.');
      }
      if(Math.abs(mid)<=EPS||
        Math.abs(end)<=EPS||
        Math.sign(mid)!==Math.sign(end))
        throw new Error(
          'Joined solo road needs another paid contact.');
    }
    const settledRoads=untouchedRoads.concat(
      [contact.road]);
    const settledFinishes=finishes.filter(row=>
      !contact.road.riderIds.includes(row.riderId))
      .concat(contact.finishes);
    return {version:PHYSICAL_FIRST_SOLO_CONTACT_SETTLEMENT_VERSION,
      roads:settledRoads,finishes:settledFinishes,
      events:[contact]};
  }
}
