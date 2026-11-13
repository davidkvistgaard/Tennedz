// Read-only completeness gate for the isolated control/chase source trace.
// A rider appearing in a later paid step does not erase an earlier missing km.
import {isDeepStrictEqual} from 'node:util';
import {runIsolatedPaidControlChaseV1} from
  './isolated-paid-control-chase-run-v1.mjs';

export const ISOLATED_PAID_ROAD_COVERAGE_VERSION=
  'v2-isolated-paid-road-coverage-2';

export function auditIsolatedPaidRoadCoverageV1({runInput,run}){
  if(!isDeepStrictEqual(run,
    runIsolatedPaidControlChaseV1(runInput)))
    throw new Error('Coverage needs a replayed paid road run.');
  const roster=runInput.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  const perKilometre=run.steps.map(step=>{
    const modeled=new Set(Object.keys(
      step.road.energyByRider));
    const decided=new Set(step.paidInput.frontChoice.decisions.map(
      decision=>decision.riderId));
    const unmodeledRiderIds=roster.filter(id=>!modeled.has(id));
    const undecidedRiderIds=roster.filter(id=>!decided.has(id));
    return {sourceKm:step.road.sourceKm,
      action:step.action,
      modeledRiderIds:roster.filter(id=>modeled.has(id)),
      unmodeledRiderIds,
      decidedRiderIds:roster.filter(id=>decided.has(id)),
      undecidedRiderIds};
  });
  const missingRiderKilometres=perKilometre.reduce((sum,row)=>
    sum+row.unmodeledRiderIds.length,0);
  const missingDecisionRiderKilometres=perKilometre.reduce((sum,row)=>
    sum+row.undecidedRiderIds.length,0);
  return {version:ISOLATED_PAID_ROAD_COVERAGE_VERSION,
    sourceKm:run.sourceKm,
    roadKilometres:perKilometre.length,
    rosterRiders:roster.length,
    perKilometre,missingRiderKilometres,
    missingDecisionRiderKilometres,
    allRiderKilometresPaid:run.sourceKm===1&&
      missingRiderKilometres===0&&
      !run.unresolved&&!run.contact&&
      run.endDistanceM===runInput.commitment.distanceKm*1000,
    allRiderKilometresDecided:run.sourceKm===1&&
      missingDecisionRiderKilometres===0&&
      !run.unresolved&&!run.contact&&
      run.endDistanceM===runInput.commitment.distanceKm*1000};
}

export function requireFullPaidRiderCoverageV1(input){
  const audit=auditIsolatedPaidRoadCoverageV1(input);
  if(!audit.allRiderKilometresPaid||
    !audit.allRiderKilometresDecided)
    throw new Error('Paid rider-kilometre coverage is incomplete.');
  return audit;
}
