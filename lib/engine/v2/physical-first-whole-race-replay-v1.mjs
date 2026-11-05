// Recompute the experimental physical recording from committed inputs.
// This path reads recorded choices as claims, not as road positions.
import {isDeepStrictEqual} from 'node:util';
import {choosePhysicalFirstBoundaryAttacksV1} from
  './physical-first-attack-choice-v1.mjs';
import {launchPhysicalFirstAttackRoadsV1} from
  './physical-first-attack-road-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {planPhysicalFirstPelotonLeaderV1} from
  './physical-first-leader-plan-v1.mjs';
import {advancePhysicalFirstRoadV1,
  advancePhysicalFirstRoadWithStartDropsV1} from
  './physical-first-road-step-v1.mjs';
import {PHYSICAL_FIRST_PELOTON_KM_VERSION} from
  './physical-first-peloton-km-v1.mjs';
import {planPhysicalFirstRearLeaderV1} from
  './physical-first-rear-leader-plan-v1.mjs';
import {resolvePhysicalFirstRearBoundaryContactV1} from
  './physical-first-rear-boundary-contact-v1.mjs';
import {settlePhysicalFirstSoloCrossingV1} from
  './physical-first-solo-contact-settlement-v1.mjs';
import {PHYSICAL_FIRST_WHOLE_RACE_PROBE_VERSION,
  physicalFirstInputHash} from
  './physical-first-whole-race-probe-v1.mjs';

export const PHYSICAL_FIRST_WHOLE_RACE_REPLAY_VERSION=
  'physical-first-whole-race-replay-4';
const EPS=.002;

export function replayPhysicalFirstWholeRaceV1({
  start,kilometres,teams,stakes,raceSeed,
  emergencyFrontWorkers=[]},recording){
  if(recording?.version!==
      PHYSICAL_FIRST_WHOLE_RACE_PROBE_VERSION||
    recording.raceSeed!==raceSeed||
    recording.commitmentHash!==physicalFirstInputHash({
      kilometres,teams,stakes,emergencyFrontWorkers})||
    recording.completedThroughKm!==kilometres?.length||
    recording.officialResults!==false||
    recording.states?.length!==kilometres.length+1||
    recording.steps?.length!==kilometres.length||
    !isDeepStrictEqual(recording.states[0],start))
    throw new Error(
      'Physical replay needs the same committed recording.');
  const riderTeams=new Map(teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  const initial=new Map(start.riders.map(row=>
    [row.riderId,row]));
  if(initial.size!==riderTeams.size||
    teams.some(team=>team.riders.some(rider=>{
      const row=initial.get(rider.id);
      const cap=replayRearEnergyCapV1({
        rider,kilometres,throughKm:0}).initialCap;
      return row?.teamId!==team.id||
        row.roadId!=='peloton'||
        row.distanceM!==0||
        row.clockSeconds!==0||
        Math.abs(row.reserve-cap)>EPS;
    })))
    throw new Error(
      'Physical replay needs committed starting reserve.');
  let prior=start,paidStep=null;
  const states=[start];
  for(const segment of kilometres){
    const km=prior.sourceKm+1;
    const actual=recording.steps[km-1];
    if(segment?.km!==km||actual?.sourceKm!==km)
      throw new Error(
        'Physical replay has a kilometre gap.');
    try{
      const contact=km===1?{
        state:prior,events:[],leaderPlans:[]}:
        resolvePhysicalFirstRearBoundaryContactV1({
          prior,paidStep,nextSegment:segment,
          teams,stakes});
      if(!isDeepStrictEqual(
        actual.boundaryContactEvents,
        contact.events))
        throw new Error(
          'Physical replay contact differs from paid approach.');
      const workingPrior=contact.state;
      const attackChoices=choosePhysicalFirstBoundaryAttacksV1({
        prior:workingPrior,segment,teams,stakes});
      if(!isDeepStrictEqual(actual.attackChoices,
        attackChoices))
        throw new Error(
          'Physical replay attack choices differ from order.');
      const attackLaunch=launchPhysicalFirstAttackRoadsV1({
        prior:workingPrior,choices:attackChoices,
        segment,kilometres,teams,stakes});
      if(!isDeepStrictEqual(actual.attackSteps,
        attackLaunch.attackSteps))
        throw new Error(
          'Physical replay attack road or reserve differs.');
      const input={prior:attackLaunch.state,segment,
        kilometres,teams,stakes,
        emergencyFrontWorkers};
      const leaderPlan=planPhysicalFirstPelotonLeaderV1(
        input);
      if(!isDeepStrictEqual(
        actual.peloton?.leaderPlan,leaderPlan))
        throw new Error(
          'Physical replay bunch leader differs from order.');
      const paidBunch=
        advancePhysicalFirstRoadWithStartDropsV1({
          ...input,roadId:'peloton',
          leaderRiderId:leaderPlan.leaderRiderId,
          planVersion:leaderPlan.version});
      const peloton={...paidBunch,
        version:PHYSICAL_FIRST_PELOTON_KM_VERSION,
        leaderPlan};
      if(!isDeepStrictEqual(actual.peloton,peloton))
        throw new Error(
          'Physical replay bunch work or reserve differs.');
      const otherInput={...input,prior:workingPrior};
      const otherSteps=workingPrior.roads.filter(
        road=>road.roadId!=='peloton').map(road=>{
        if(road.riderIds.length===1)
          return advancePhysicalFirstRoadV1({
            ...otherInput,roadId:road.roadId,
            leaderRiderId:road.riderIds[0],
            planVersion:
              'physical-first-solo-continuation-1'});
        const groupPlan=contact.leaderPlans.find(
          row=>row.roadId===road.roadId)??
          planPhysicalFirstRearLeaderV1({
            prior:workingPrior,roadId:road.roadId,
            segment,teams,stakes});
        return {...advancePhysicalFirstRoadWithStartDropsV1({
          ...otherInput,roadId:road.roadId,
          leaderRiderId:groupPlan.leaderRiderId,
          planVersion:groupPlan.version}),
        leaderPlan:groupPlan};
      });
      if(!isDeepStrictEqual(
        actual.otherSteps,otherSteps)||
        !isDeepStrictEqual(actual.soloSteps,
          otherSteps.filter(step=>
            step.priorRoadId.startsWith('solo:'))))
        throw new Error(
          'Physical replay rear work or reserve differs.');
      const provisionalRoads=[...peloton.roads,
        ...attackLaunch.attackSteps.map(step=>
          step.road),
        ...otherSteps.flatMap(step=>
          step.roads??[step.road])];
      const provisionalFinishes=[...peloton.finishes,
        ...attackLaunch.attackSteps.flatMap(step=>
          step.finishes),
        ...otherSteps.flatMap(step=>
          step.finishes)];
      const settlement=settlePhysicalFirstSoloCrossingV1({
        prior:workingPrior,roads:provisionalRoads,
        finishes:provisionalFinishes,
        launchEvents:[...attackLaunch.launchEvents,
          ...peloton.startDropEvents,
          ...otherSteps.flatMap(step=>
            step.startDropEvents??[])],
        otherSteps,segment,kilometres,teams,stakes});
      if(!isDeepStrictEqual(
        actual.withinKmContactEvents,
        settlement.events))
        throw new Error(
          'Physical replay within-km contact differs from paid roads.');
      const {roads,finishes}=settlement;
      const finishIds=new Set(finishes.map(row=>
        row.riderId));
      if(finishes.length!==riderTeams.size||
        finishIds.size!==riderTeams.size||
        [...riderTeams.keys()].some(id=>
          !finishIds.has(id))||
        new Set(roads.map(row=>row.roadId))
          .size!==roads.length)
        throw new Error(
          'Physical replay lacks paid rider coverage.');
      const frontClockSeconds=
        peloton.road.finishClockSeconds;
      const next={
        version:PHYSICAL_FIRST_WHOLE_RACE_PROBE_VERSION,
        sourceKm:km,boundaryDistanceM:km*1000,
        frontClockSeconds,
        roads:roads.map(road=>({
          roadId:road.roadId,
          riderIds:road.riderIds,
          clockSeconds:road.finishClockSeconds,
          leadOverFrontSeconds:+
            (frontClockSeconds-
              road.finishClockSeconds).toFixed(6)})),
        riders:finishes.map(finish=>({
          riderId:finish.riderId,
          teamId:riderTeams.get(finish.riderId),
          roadId:finish.physicalGroup,
          distanceM:finish.endDistanceM,
          clockSeconds:finish.clockSeconds,
          reserve:finish.energyAfter,
          quietKm:finish.quietKm})),
        sourceGroupMembershipUsed:false,
        sourceGapUsed:false,officialResults:false};
      if(!isDeepStrictEqual(recording.states[km],
        next))
        throw new Error(
          'Physical replay boundary or finish differs.');
      paidStep={sourceKm:km,
        boundaryContactEvents:contact.events,
        withinKmContactEvents:settlement.events,
        attackChoices,
        attackSteps:attackLaunch.attackSteps,
        peloton,otherSteps,
        soloSteps:otherSteps.filter(step=>
          step.priorRoadId.startsWith('solo:'))};
      if(!isDeepStrictEqual(actual,paidStep))
        throw new Error(
          'Physical replay event contract differs.');
      states.push(next);
      prior=next;
    }catch(error){
      error.sourceKm=km;
      error.completedThroughKm=km-1;
      throw error;
    }
  }
  return {version:PHYSICAL_FIRST_WHOLE_RACE_REPLAY_VERSION,
    raceSeed,validatedKm:kilometres.length,
    validatedRiderKm:kilometres.length*
      riderTeams.size,
    finalState:states.at(-1),
    sourceGapUsed:false,officialResults:false};
}
