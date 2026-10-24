import {isDeepStrictEqual} from 'node:util';
import {recordFinaleDepletedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {recordFinaleMixedPost500OutsideLaneAudit} from
  './finale-mixed-post500-individual-audit.mjs';
import {positionedLineOrder} from './finale-paid-bunch-runner.mjs';

export const FINALE_MIXED_POST500_OUTSIDE_LANE_LINE_VERSION=
  'v2-finale-mixed-post500-outside-lane-line-1';
const EPSILON=1e-7;

// This separate opt-in interpretation retains every paid individual runner.
// A former leader passes road-2 in its own inferred outside lane without a
// pace, energy, or drafting change. The order is conditional; occupied wheel
// positions and official awards remain unresolved.
export function recordFinaleMixedPost500OutsideLaneLine(tour,clock,
  {plans=null}={}){
  const prior=recordFinaleDepletedIndividualLine(tour,clock,{plans});
  const laneAudit=recordFinaleMixedPost500OutsideLaneAudit(tour,
    clock,prior);
  const roster=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  const crossings=prior.conditionalCrossings;
  const finishers=prior.bandRunners.flatMap(band=>
    band.runner.finishers.map(row=>({roadBandId:band.roadBandId,
      ...row})));
  const byId=new Map(finishers.map(row=>[row.riderId,row]));
  if(crossings.length!==roster.size||
    finishers.length!==roster.size||byId.size!==roster.size||
    crossings.some(row=>roster.get(row.riderId)!==row.teamId||
      !Number.isFinite(row.elapsedSecondsFromLastKmStart)||
      !Number.isFinite(row.energyAtLine)||row.energyAtLine<0||
      !byId.has(row.riderId)||
      byId.get(row.riderId).roadBandId!==row.roadBandId||
      Math.abs(byId.get(row.riderId).elapsedSecondsFromLastKmStart-
        row.elapsedSecondsFromLastKmStart)>EPSILON||
      Math.abs(byId.get(row.riderId).energyAtLine-
        row.energyAtLine)>EPSILON))
    throw new Error('The outside-lane finish lost a paid rider.');
  const provisionalLineOrder=positionedLineOrder(crossings);
  const finalRoadBands=prior.bandRunners.map(band=>({
    id:band.roadBandId,
    riderIds:band.runner.finishers.map(row=>row.riderId),
    firstCrossingSeconds:Math.min(...band.runner.finishers.map(row=>
      row.elapsedSecondsFromLastKmStart)),
    lastCrossingSeconds:Math.max(...band.runner.finishers.map(row=>
      row.elapsedSecondsFromLastKmStart))})).sort((a,b)=>
    a.firstCrossingSeconds-b.firstCrossingSeconds||
    a.id.localeCompare(b.id));
  return {...prior,
    version:FINALE_MIXED_POST500_OUTSIDE_LANE_LINE_VERSION,
    laneAudit,finalRoadBands,provisionalLineOrder,
    pre500ContactStatus:'separate_paid_road_to_500m',
    roadStatus:'conditional_post500_outside_lane_passes',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleMixedPost500OutsideLaneLine(tour,clock,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedPost500OutsideLaneLine(tour,clock,input)))
    throw new Error('The post-500 outside-lane line does not replay.');
  return true;
}
