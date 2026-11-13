import {isDeepStrictEqual} from 'node:util';
import {recordFinaleDepletedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {recordFinaleMixedStraddlingOutsideLaneAudit} from
  './finale-mixed-straddling-outside-lane-audit.mjs';
import {positionedLineOrder} from './finale-paid-bunch-runner.mjs';

export const FINALE_MIXED_STRADDLING_OUTSIDE_LANE_LINE_VERSION=
  'v2-finale-mixed-straddling-outside-lane-line-1';
const EPSILON=1e-7;

// Internal, opt-in interpretation: departing leaders take distinct inferred
// outside lanes without drafting or changing paid pace/energy. The one new
// source-group approach is split and paid, but occupied wheels are unknown.
export function recordFinaleMixedStraddlingOutsideLaneLine(tour,clock,
  {plans=null}={}){
  const prior=recordFinaleDepletedIndividualLine(tour,clock,{plans});
  const audit=recordFinaleMixedStraddlingOutsideLaneAudit(tour,clock,prior);
  const sourceProximity=audit.pre500OtherActive.encounters;
  const fresh=sourceProximity.filter(row=>row.laterFreshEncounter);
  if(sourceProximity.length!==39||fresh.length!==1||
    sourceProximity.some(row=>row.activeRoadBandId!=='road-1'||
      (row.laterFreshEncounter?!row.firstNewEncounter||
        row.firstNewEncounter.contactResolved!==false:
        !row.sourceAdjacent))||
    fresh.length!==audit.freshSourceGroupEnergy.length||
    audit.pre500OtherActive.checkedOlderDropMarkerBounds<1||
    audit.pre500OtherActive.checkedRearIsolatedRiders<1)
    throw new Error('The inferred source-exit lanes lack paid encounters.');
  const crossings=prior.conditionalCrossings;
  const finishers=prior.bandRunners.flatMap(band=>
    band.runner.finishers.map(row=>({roadBandId:band.roadBandId,
      ...row})));
  const byId=new Map(finishers.map(row=>[row.riderId,row]));
  const roster=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  if(crossings.length!==roster.size||
    finishers.length!==roster.size||byId.size!==roster.size||
    crossings.some(row=>roster.get(row.riderId)!==row.teamId||
      !Number.isFinite(row.elapsedSecondsFromLastKmStart)||
      !Number.isFinite(row.energyAtLine)||row.energyAtLine<0||
      byId.get(row.riderId)?.roadBandId!==row.roadBandId||
      Math.abs(byId.get(row.riderId).energyAtLine-
        row.energyAtLine)>EPSILON||
      Math.abs(byId.get(row.riderId).elapsedSecondsFromLastKmStart-
        row.elapsedSecondsFromLastKmStart)>EPSILON))
    throw new Error('The inferred source-exit line lost a paid rider.');
  const finalRoadBands=prior.bandRunners.map(band=>({
    id:band.roadBandId,
    riderIds:band.runner.finishers.map(row=>row.riderId),
    firstCrossingSeconds:Math.min(...band.runner.finishers.map(row=>
      row.elapsedSecondsFromLastKmStart)),
    lastCrossingSeconds:Math.max(...band.runner.finishers.map(row=>
      row.elapsedSecondsFromLastKmStart))})).sort((a,b)=>
    a.firstCrossingSeconds-b.firstCrossingSeconds||
    a.id.localeCompare(b.id));
  return {...prior,version:FINALE_MIXED_STRADDLING_OUTSIDE_LANE_LINE_VERSION,
    sourceExitAudit:audit,finalRoadBands,
    provisionalLineOrder:positionedLineOrder(crossings),
    pre500ContactStatus:'inferred_distinct_source_exit_lanes',
    roadStatus:'conditional_straddling_outside_lane_passes',
    contactResolved:false,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleMixedStraddlingOutsideLaneLine(tour,clock,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedStraddlingOutsideLaneLine(tour,clock,input)))
    throw new Error('The straddling outside-lane line does not replay.');
  return true;
}
