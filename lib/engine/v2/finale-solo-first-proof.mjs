import {isDeepStrictEqual} from 'node:util';
import {probeLastKmRotationSoloFromTour} from
  './finale-last-km-rotation-solo.mjs';
import {recordFinaleRotationSoloRunFromTour} from
  './finale-rotation-solo-slice.mjs';
import {segmentBaseSeconds} from './finish.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_SOLO_FIRST_PROOF_VERSION=
  'v2-finale-solo-first-proof-1';
const EPSILON=1e-8;

// The separated road run pays the solo to the line, but its old gap ignores
// an opponent who might launch a sprint from the bunch. Give every bunch
// rider an unrealistically favourable 500 m: full energy, the best of all
// existing riding phases, hard-finale acceleration and bunch draft for the
// whole distance. Only a solo ahead even of that lower time bound has a
// defensible first place within this versioned, collapsed-band source.
export function proveFinaleSoloFirstFromTour(tour,{attackTeamId}){
  const road=probeLastKmRotationSoloFromTour(tour,{teamId:attackTeamId});
  const run=recordFinaleRotationSoloRunFromTour(tour,{attackTeamId});
  const soloId=run.roadGroups[0]?.riderIds[0];
  const sourceGap=road.at500M.roadGroups[0]?.gapSeconds;
  const lineGap=run.roadGroups[0]?.gapSeconds;
  if(!soloId||!Number.isFinite(sourceGap)||sourceGap<=0||
    !Number.isFinite(lineGap)||lineGap<=0||
    run.endDistanceM-road.at500M.distanceM!==500||
    run.pelotonRiderIds.length===0||
    run.frames.length!==5)
    throw new Error('First-place proof needs one paid, separated 500 m run.');
  const soloLineSeconds=road.at500M.bunchElapsedSeconds-sourceGap+
    run.frames.reduce((sum,frame)=>sum+frame.frontTravelSeconds,0);
  if(Math.abs(soloLineSeconds-(run.bunchElapsedSecondsAtLine-lineGap))>
    EPSILON)
    throw new Error('The solo and bunch clocks disagree at the line.');
  const ridersById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const segment=tour.route.kilometres.at(-1);
  const optimisticPaces=run.pelotonRiderIds.flatMap(riderId=>{
    const rider=ridersById.get(riderId);
    if(!rider)throw new Error('The solo proof lost a locked bunch rider.');
    return ['cruise','chase','finale','solo','attack'].map(phase=>{
      const ability=riderKilometreEffect(rider,segment,{phase,
        energy:100,exposed:segment.exposed}).ability;
      return {riderId,phase,secondsPerKm:segmentBaseSeconds(segment)+
        (50-ability-TUNING.finish.finaleEffortAbilityPoints.hard-
          TUNING.breakaway.bunchDraftAdvantage)*
          TUNING.breakaway.driftSecondsPerAbilityPoint};
    });
  });
  const fastest=optimisticPaces.reduce((best,row)=>
    !best||row.secondsPerKm<best.secondsPerKm?row:best,null);
  if(!Number.isFinite(fastest?.secondsPerKm)||
    fastest.secondsPerKm<=0)
    throw new Error('The solo proof has no finite bunch pace bound.');
  const earliestPossibleBunchSeconds=road.at500M.bunchElapsedSeconds+
    fastest.secondsPerKm*.5;
  const guaranteed=soloLineSeconds+EPSILON<earliestPossibleBunchSeconds;
  return {version:FINALE_SOLO_FIRST_PROOF_VERSION,
    sourceRoadTraceVersion:road.version,sourceSoloRunVersion:run.version,
    soloRiderId:soloId,sourceDistanceM:road.at500M.distanceM,
    lineDistanceM:run.endDistanceM,soloLineSeconds,
    fastestBoundRiderId:fastest.riderId,
    fastestBoundPhase:fastest.phase,
    fastestBoundSecondsPerKm:fastest.secondsPerKm,
    earliestPossibleBunchSeconds,
    conservativeMarginSeconds:earliestPossibleBunchSeconds-
      soloLineSeconds,
    knownFirstRiderId:guaranteed?soloId:null,
    proofStatus:guaranteed?'model_bound_first':'unresolved_sprint_contact',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleSoloFirstProofFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,proveFinaleSoloFirstFromTour(tour,input)))
    throw new Error('The solo first-place proof does not replay.');
  return true;
}
