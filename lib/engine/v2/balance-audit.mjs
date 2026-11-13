import {TUNING} from './tuning.mjs';
import {projectNetChaseGap} from './chase-gap-candidate.mjs';

// Diagnostic for a recorded kilometre. The default rate checks v79; a caller
// can supply the opt-in candidate rate. It reports a surviving gap only
// when the same rear road group had a prior gap and the recorded chase
// capacity could have covered that gap plus this kilometre's passive drift.
// It never changes the recorded race or awards points.
export function hasResidualGapAfterSufficientChase(frames,index,
  {recoverySecondsPerCapacity=TUNING.chase.recoverySecondsPerCapacity}={}){
  if(!Array.isArray(frames)||!Number.isInteger(index)||index<1||index>=frames.length)
    throw new Error('A current and previous recorded frame are required.');
  const frame=frames[index],previous=frames[index-1];
  // The kilometre chase and passive drift apply to the group nearest the
  // bunch, even when other groups remain farther up the road.
  const group=frame.roadGroups?.at(-1);
  const prior=previous.roadGroups?.at(-1);
  if(!group||!prior||group.id!==prior.id||frame.attackPower!==0||
    !(frame.chasePower>0)||!(frame.passiveGapDelta>0)||!(group.gapSeconds>0))
    return false;
  return projectNetChaseGap({priorGapSeconds:prior.gapSeconds,
    passiveGapDelta:frame.passiveGapDelta,chasePower:frame.chasePower,
    recoverySecondsPerCapacity}).caught;
}
