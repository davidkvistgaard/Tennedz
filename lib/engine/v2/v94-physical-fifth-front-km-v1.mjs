// Conditional paid km-5 peloton front beside isolated fresh attack roads.
// Rear roads, field contact, and a physical break group remain unresolved.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalFreshAttackSolosV1} from
  './v94-physical-fresh-attack-solo-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';

export const V94_PHYSICAL_FIFTH_FRONT_KM_VERSION=
  'v94-physical-fifth-front-km-1';
export const V94_PHYSICAL_FIFTH_FRONT_DECISION_VERSION=
  'v94-physical-fifth-front-decision-1';

export function replayV94PhysicalFifthFrontKmV1(
  recording,prior){
  if(prior?.sourceKm!==4||!prior.fullFieldKilometre)
    throw new Error('Fifth front needs complete paid km 4.');
  const freshAttackSolos=replayV94PhysicalFreshAttackSolosV1(
    recording,prior);
  const front=replayV94PhysicalFrontKmFromPriorV1(recording,{
    km:5,prior,
    frontClockSeconds:prior.front.frontClockSeconds,
    version:V94_PHYSICAL_FIFTH_FRONT_KM_VERSION,
    decisionVersion:V94_PHYSICAL_FIFTH_FRONT_DECISION_VERSION,
    priorField:null,
    excludedFreshAttackRiderIds:freshAttackSolos.roads.map(row=>
      row.riderId)});
  if(Math.abs(front.frontClockSeconds-
    freshAttackSolos.frontClockSeconds)>1e-7)
    throw new Error('Fifth front disagrees with paid attack clock.');
  return {...front,priorSourceKm:4,priorVersion:prior.version,
    freshAttackSolos,
    sourceBreakGapNotPhysical:true,
    remainingFieldRoadUnresolved:true,
    officialResults:false};
}

export function validateV94PhysicalFifthFrontKmV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalFifthFrontKmV1(recording,prior)))
    throw new Error('Fifth front differs from paid source.');
  return true;
}
