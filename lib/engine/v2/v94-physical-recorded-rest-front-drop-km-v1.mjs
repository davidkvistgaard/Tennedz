// Settle observed recorded-rest front drops in physical time order.
// Refuse when a batch cannot pay or any crossing remains.
import {replayV94PhysicalRecordedRestKmV1} from
  './v94-physical-recorded-rest-km-v1.mjs';
import {replayV94PhysicalFrontDropFirstBatchFragmentV1} from
  './v94-physical-front-drop-first-batch-fragment-v1.mjs';
import {inspectV94PhysicalFrontDropFirstBatchNextV1} from
  './v94-physical-front-drop-first-batch-next-v1.mjs';
import {extendV94PhysicalFrontDropBatchV1} from
  './v94-physical-front-drop-batch-extension-v1.mjs';
import {completeV94PhysicalFrontDropBatchFieldV1} from
  './v94-physical-front-drop-batch-field-v1.mjs';

export const V94_PHYSICAL_RECORDED_REST_FRONT_DROP_KM_VERSION=
  'v94-physical-recorded-rest-front-drop-km-1';
export const V94_PHYSICAL_RECORDED_REST_LATER_DROP_KM_VERSION=
  'v94-physical-recorded-rest-later-drop-km-1';

export function replayV94PhysicalRecordedRestFrontDropKmV1(
  recording,prior){
  let physicalRoads;
  try{replayV94PhysicalRecordedRestKmV1(recording,prior);}
  catch(error){
    if(error.message!==
      'Physical front drop/rear contact needs paid resolution.')
      throw error;
    physicalRoads=error.physicalRoads;
  }
  if(!physicalRoads)
    throw new Error('Recorded-rest front drop needs contact.');
  const provisional=replayV94PhysicalRecordedRestKmV1(
    recording,prior,{provisionalFrontDropContacts:true});
  let fragment,laterStart=false;
  try{fragment=replayV94PhysicalFrontDropFirstBatchFragmentV1(
    recording,prior,physicalRoads);}
  catch(error){
    if(error.message!==
      'Front-drop batch fragment needs paid shelter.')
      throw error;
    fragment=replayV94PhysicalFrontDropFirstBatchFragmentV1(
      recording,prior,physicalRoads,{
        startAtFirstPayableBatch:true});
    laterStart=true;
  }
  for(let batch=0;
    batch<physicalRoads.newFrontDrops.length;batch++){
    const probe=inspectV94PhysicalFrontDropFirstBatchNextV1(
      physicalRoads,fragment);
    if(!probe.firstAdditionalContact)break;
    fragment=extendV94PhysicalFrontDropBatchV1(
      recording,prior,physicalRoads,fragment);
  }
  const field=completeV94PhysicalFrontDropBatchFieldV1(
    recording,prior,physicalRoads,provisional,fragment);
  return {...field,
    version:laterStart?
      V94_PHYSICAL_RECORDED_REST_LATER_DROP_KM_VERSION:
      V94_PHYSICAL_RECORDED_REST_FRONT_DROP_KM_VERSION,
    fieldVersion:field.version,
    sourceCheckpointCalibrationFailed:true,
    officialResults:false};
}
