// Preserve V1 recordings while locating when a caught solo actually exits
// the bunch after the replayed paid postcontact turns.
import {isDeepStrictEqual} from 'node:util';
import {advanceCaughtFrontSlideV1} from
  './isolated-caught-front-slide-v1.mjs';
import {TUNING} from './tuning.mjs';

export const ISOLATED_CAUGHT_FRONT_SLIDE_V2_VERSION=
  'v2-isolated-caught-front-slide-2';

export function advanceCaughtFrontSlideV2(input){
  const prior=advanceCaughtFrontSlideV1(input);
  let beforeGap=0;
  let bunchExitDistanceM=null;
  for(const slice of prior.slices){
    const afterGap=slice.behindBunchSeconds;
    if(bunchExitDistanceM!==null&&
      afterGap<=TUNING.groups.droppedAtSeconds)
      throw new Error('Caught front needs a separate bunch recontact road.');
    if(bunchExitDistanceM===null&&
      beforeGap<=TUNING.groups.droppedAtSeconds&&
      afterGap>TUNING.groups.droppedAtSeconds){
      const share=(TUNING.groups.droppedAtSeconds-beforeGap)/
        (afterGap-beforeGap);
      bunchExitDistanceM=slice.startDistanceM+
        (slice.endDistanceM-slice.startDistanceM)*share;
    }
    beforeGap=afterGap;
  }
  if((prior.status==='solo_behind')!==
    (bunchExitDistanceM!==null))
    throw new Error('Caught front exit differs from paid gap.');
  return {...prior,version:ISOLATED_CAUGHT_FRONT_SLIDE_V2_VERSION,
    bunchExitDistanceM,event:prior.event?{
      ...prior.event,atDistanceM:bunchExitDistanceM}:null};
}

export function validateCaughtFrontSlideV2(input,recording){
  if(!isDeepStrictEqual(recording,advanceCaughtFrontSlideV2(input)))
    throw new Error('Caught front exit differs from paid source.');
  return true;
}
