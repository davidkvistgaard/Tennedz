import {TUNING} from './tuning.mjs';

// Diagnostic for the v79 kilometre model. It reports a surviving gap only
// when the same rear road group had a smaller prior gap and the recorded chase
// capacity could have covered that gap plus this kilometre's passive drift.
// It never changes the recorded race or awards points.
export function hasResidualGapAfterSufficientChase(frames,index){
  if(!Array.isArray(frames)||!Number.isInteger(index)||index<1||index>=frames.length)
    throw new Error('A current and previous recorded frame are required.');
  const frame=frames[index],previous=frames[index-1];
  const group=frame.roadGroups?.length===1?frame.roadGroups[0]:null;
  const prior=previous.roadGroups?.at(-1);
  return Boolean(group&&prior&&group.id===prior.id&&
    frame.attackPower===0&&frame.chasePower>0&&frame.passiveGapDelta>0&&
    group.gapSeconds>0&&
    frame.chasePower*TUNING.chase.recoverySecondsPerCapacity>=
      prior.gapSeconds+frame.passiveGapDelta);
}
