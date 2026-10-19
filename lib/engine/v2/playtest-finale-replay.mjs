const EPSILON=1e-6;

// The browser may show a complete paid final kilometre only when its frames
// start at the locked handoff and preserve every rider on one clock. Later
// contact-only continuations stay visible in the summary, not as a false
// full-kilometre animation.
export function summarizeV91PaidFinaleReplay(trial){
  const tour=trial?.recording;
  const paid=trial?.paidFinale;
  const frames=paid?.frames;
  const handoffM=(tour?.route?.distanceKm-1)*1000;
  const finishM=tour?.route?.distanceKm*1000;
  if(trial?.roadStatus!=='paid_conditional_line'||
    !Array.isArray(frames)||!frames.length||
    !Number.isFinite(handoffM)||
    Math.abs(paid.startDistanceM-handoffM)>EPSILON||
    Math.abs(frames[0].startDistanceM-handoffM)>EPSILON||
    Math.abs(frames.at(-1).endDistanceM-finishM)>EPSILON)
    return null;
  const riderIds=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  const expected=new Set(riderIds);
  let previous=null;
  const replayFrames=frames.map(frame=>{
    if(!Number.isFinite(frame.elapsedSecondsAtStart)||
      !Number.isFinite(frame.durationSeconds)||frame.durationSeconds<=0||
      previous&&Math.abs(frame.elapsedSecondsAtStart-
        previous.elapsedSecondsAtStart-previous.durationSeconds)>EPSILON||
      !Array.isArray(frame.riders)||frame.riders.length!==expected.size||
      new Set(frame.riders.map(row=>row.riderId)).size!==expected.size)
      throw new Error('The paid finale replay lost its clock or riders.');
    const prior=new Map(previous?.riders.map(row=>[row.riderId,row])??[]);
    const riders=frame.riders.map(row=>{
      const before=prior.get(row.riderId);
      if(!expected.has(row.riderId)||
        ![row.positionBeforeM,row.positionM,row.energyAtDecision,
          row.energySpent,row.energyAfter].every(Number.isFinite)||
        row.energySpent<-EPSILON||row.energyAfter<-EPSILON||
        Math.abs(row.energyAtDecision-row.energySpent-
          row.energyAfter)>EPSILON||
        before&&(Math.abs(before.positionM-row.positionBeforeM)>EPSILON||
          Math.abs(before.energyAfter-row.energyAtDecision)>EPSILON))
        throw new Error('The paid finale replay lost rider travel or energy.');
      return {riderId:row.riderId,role:row.role,
        positionM:row.positionM,energyAfter:row.energyAfter,
        energySpent:row.energySpent,
        elapsedToLineSeconds:row.elapsedToLineSeconds};
    });
    previous=frame;
    return {elapsedSeconds:frame.elapsedSecondsAtStart+
        frame.durationSeconds,
      endDistanceM:frame.endDistanceM,
      roadGroups:frame.roadGroups?.map(group=>({id:group.id,
        riderIds:group.riderIds,positionM:group.positionM}))??[],
      riders};
  });
  if(Math.abs(frames[0].elapsedSecondsAtStart)>EPSILON||
    replayFrames.at(-1).riders.some(row=>
      Math.abs(row.positionM-finishM)>EPSILON||
      !Number.isFinite(row.elapsedToLineSeconds)))
    throw new Error('The paid finale replay did not reach every line.');
  return {version:paid.version,status:'complete_paid_trace',
    handoffDistanceM:handoffM,lineDistanceM:finishM,
    frames:replayFrames};
}
