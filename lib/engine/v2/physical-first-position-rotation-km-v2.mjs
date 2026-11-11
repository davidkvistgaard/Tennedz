// Versioned paid rotation on a start grid that stages an ordered reserve
// front worker. The underlying road physics remains the v1 paid step.
import {isDeepStrictEqual} from 'node:util';
import {createPhysicalFirstPositionStartV1,
  PHYSICAL_FIRST_POSITION_START_VERSION} from
  './physical-first-position-start-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  './physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionRotationKmV1,
  PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION} from
  './physical-first-position-rotation-km-v1.mjs';

export const PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION=
  'physical-first-position-rotation-km-2';

export function advancePhysicalFirstPositionRotationKmV2({
  prior,segment,input}){
  if(input?.positionModelVersion!==
      PHYSICAL_FIRST_POSITION_START_V2_VERSION||
    ![PHYSICAL_FIRST_POSITION_START_V2_VERSION,
      PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION]
      .includes(prior?.version)||
    !Number.isInteger(prior?.sourceKm)||
    prior.sourceKm<0)
    throw new Error('Rotation v2 needs a committed position race.');
  const expected=createPhysicalFirstPositionStartV2({
    input,grid:prior.grid});
  if(prior.inputHash!==expected.inputHash||
    prior.stagedBackupRiderId!==
      expected.stagedBackupRiderId||
    prior.stagedAttackRiderId!==
      expected.stagedAttackRiderId||
    prior.sourceKm===0&&!isDeepStrictEqual(prior,expected))
    throw new Error('Rotation v2 changed its committed start.');
  const legacyInput={...input,
    positionModelVersion:PHYSICAL_FIRST_POSITION_START_VERSION};
  const legacyStart=createPhysicalFirstPositionStartV1({
    input:legacyInput,grid:prior.grid});
  const legacyPrior={...prior,
    version:prior.sourceKm===0?
      PHYSICAL_FIRST_POSITION_START_VERSION:
      PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION,
    inputHash:legacyStart.inputHash};
  const paid=advancePhysicalFirstPositionRotationKmV1({
    prior:legacyPrior,segment,input:legacyInput});
  return {...paid,
    version:PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION,
    sourceStartVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION,
    basePhysicsVersion:
      PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION,
    inputHash:expected.inputHash,
    stagedBackupRiderId:expected.stagedBackupRiderId,
    stagedAttackRiderId:expected.stagedAttackRiderId,
    ...(prior.separateRoadRiderIds?.length?{
      separateRoadRiderIds:[...prior.separateRoadRiderIds]}:{}),
    sourceGroupClockUsedForMovement:false,
    officialResults:false};
}

export function replayPhysicalFirstPositionRotationKmV2(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionRotationKmV2(input)))
    throw new Error('Rotation v2 differs from paid movement.');
  return recorded;
}
