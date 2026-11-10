// Selects only a movement contract that can pay and replay this kilometre.
// Connected, holdable roads use the staged paid rotation; a shelter loss
// uses the measured fixed-lane convoy. No group-clock position fallback.
import {isDeepStrictEqual} from 'node:util';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  './physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionRotationKmV2,
  PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION} from
  './physical-first-position-rotation-km-v2.mjs';
import {advancePhysicalFirstPositionFixedLaneConvoyKmV1,
  PHYSICAL_FIRST_POSITION_FIXED_LANE_CONVOY_VERSION} from
  './physical-first-position-fixed-lane-convoy-km-v1.mjs';
import {orderAt} from './orders.mjs';
import {advancePhysicalFirstPositionMixedFrontPassKmV1,
  PHYSICAL_FIRST_POSITION_MIXED_FRONT_PASS_VERSION} from
  './physical-first-position-mixed-front-pass-km-v1.mjs';
import {advancePhysicalFirstPositionPassContactKmV1,
  PHYSICAL_FIRST_POSITION_PASS_CONTACT_VERSION} from
  './physical-first-position-pass-contact-km-v1.mjs';

export const PHYSICAL_FIRST_POSITION_HYBRID_POLICY_VERSION=
  'physical-first-position-hybrid-policy-1';
const SUPPORTED=new Set([
  PHYSICAL_FIRST_POSITION_START_V2_VERSION,
  PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION,
  PHYSICAL_FIRST_POSITION_FIXED_LANE_CONVOY_VERSION,
  PHYSICAL_FIRST_POSITION_MIXED_FRONT_PASS_VERSION,
  PHYSICAL_FIRST_POSITION_PASS_CONTACT_VERSION]);

export function advancePhysicalFirstPositionHybridKmV1({
  prior,segment,input}){
  if(!SUPPORTED.has(prior?.version))
    throw new Error('Hybrid position step needs a paid predecessor.');
  const start=createPhysicalFirstPositionStartV2({
    input,grid:prior.grid});
  if(prior.inputHash!==start.inputHash||
    prior.sourceKm===0&&
      !isDeepStrictEqual(prior,start))
    throw new Error('Hybrid position step changed committed input.');
  if(input.teams.some(team=>
    orderAt(team.orders,segment.km-1)
      .attack!=='none'))
    throw new Error('Hybrid position step needs a paid attack departure.');
  const allConnected=prior.positions.every(row=>
    row.roadId==='peloton');
  if(allConnected){
    const rotationPrior=prior.sourceKm===0?
      prior:{...prior,
        version:
          PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION,
        stagedBackupRiderId:
          start.stagedBackupRiderId,
        stagedAttackRiderId:
          start.stagedAttackRiderId};
    try{
      const rotation=advancePhysicalFirstPositionRotationKmV2({
        prior:rotationPrior,segment,input});
      return {...rotation,
        selectionPolicyVersion:
          PHYSICAL_FIRST_POSITION_HYBRID_POLICY_VERSION,
        contactComponents:[rotation.positions.map(row=>
          row.riderId).sort()],
        contactEvents:[]};
    }catch(error){
      if(!['Rotation kilometre loses first shelter.',
        'Rotation kilometre loses second shelter.']
        .includes(error.message))throw error;
    }
  }
  const convoyPrior=prior.sourceKm===0?
    prior:{...prior,
      version:
        PHYSICAL_FIRST_POSITION_FIXED_LANE_CONVOY_VERSION};
  try{
    const convoy=advancePhysicalFirstPositionFixedLaneConvoyKmV1({
      prior:convoyPrior,segment,input});
    return {...convoy,
      selectionPolicyVersion:
        PHYSICAL_FIRST_POSITION_HYBRID_POLICY_VERSION};
  }catch(error){
    if(!allConnected&&[
      'Rotation kilometre loses first shelter.',
      'Rotation kilometre loses second shelter.'
    ].includes(error.message)){
      const contact=advancePhysicalFirstPositionPassContactKmV1({
        prior:convoyPrior,segment,input});
      return {...contact,
        selectionPolicyVersion:
          PHYSICAL_FIRST_POSITION_HYBRID_POLICY_VERSION};
    }
    if(error.message!==
      'Fixed-lane convoy needs a paid front pass.'||
      allConnected)throw error;
  }
  const mixed=advancePhysicalFirstPositionMixedFrontPassKmV1({
    prior:convoyPrior,segment,input});
  return {...mixed,
    selectionPolicyVersion:
      PHYSICAL_FIRST_POSITION_HYBRID_POLICY_VERSION};
}

export function replayPhysicalFirstPositionHybridKmV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionHybridKmV1(input)))
    throw new Error('Hybrid position step differs from paid movement.');
  return recorded;
}
