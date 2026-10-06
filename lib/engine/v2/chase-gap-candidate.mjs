// Read-only kilometre projection for a break with no fresh attack. It keeps
// passive movement and paid chase in one gap before deciding whether a catch
// occurred. The official v79 path does not call it; only the opt-in
// v80 candidate uses it for a kilometre without a fresh attack.
export function projectNetChaseGap({priorGapSeconds,passiveGapDelta,chasePower,
  recoverySecondsPerCapacity}){
  if(!Number.isFinite(priorGapSeconds)||priorGapSeconds<0||
    !Number.isFinite(passiveGapDelta)||!Number.isFinite(chasePower)||chasePower<0||
    !Number.isFinite(recoverySecondsPerCapacity)||recoverySecondsPerCapacity<0)
    throw new Error('Invalid net-chase gap input.');
  const gapBeforeChase=Math.max(0,priorGapSeconds+passiveGapDelta);
  const recoveredSeconds=Math.min(gapBeforeChase,
    chasePower*recoverySecondsPerCapacity);
  const gapSeconds=Math.max(0,gapBeforeChase-recoveredSeconds);
  return {gapBeforeChase,recoveredSeconds,gapSeconds,
    caught:priorGapSeconds>0&&gapSeconds===0};
}
