import {probeLastKmRotationSoloFromTour} from
  './finale-last-km-rotation-solo.mjs';
import {probeLastKmRotationCatchFromTour} from
  './finale-last-km-rotation-catch.mjs';
import {probeLastKmRotationContainedFromTour} from
  './finale-last-km-rotation-contained.mjs';

const EPSILON=1e-6;

// Show the already paid named-attack approach separately when the later
// individual continuation starts at 500 m. Group gaps and energy are
// recorded here; individual positions remain unavailable in this segment.
export function summarizeV91PaidNamedAttackApproach(trial){
  const tour=trial?.recording;
  const intent=trial?.attackIntent;
  const branch=trial?.roadDecision?.branch;
  const probe={solo:probeLastKmRotationSoloFromTour,
    caught:probeLastKmRotationCatchFromTour,
    contained:probeLastKmRotationContainedFromTour}[branch];
  if(!tour||!intent||!probe)return null;
  const source=probe(tour,{teamId:intent.teamId});
  const riderIds=new Set(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id)));
  const handoffM=(tour.route.distanceKm-1)*1000;
  let previous=null;
  let elapsedSeconds=0;
  const frames=source.frames.map(frame=>{
    if(frame.startDistanceM!==(previous?.endDistanceM??handoffM)||
      frame.endDistanceM<=frame.startDistanceM||
      !Number.isFinite(frame.bunchElapsedSeconds)||
      frame.bunchElapsedSeconds<=0||
      frame.riderEnergy.length!==riderIds.size||
      new Set(frame.riderEnergy.map(row=>row.riderId)).size!==riderIds.size)
      throw new Error('The paid attack approach lost its boundary or riders.');
    const prior=new Map(previous?.riderEnergy.map(row=>[row.riderId,row])??[]);
    const riders=frame.riderEnergy.map(row=>{
      const energySpent=row.energySpent;
      if(!riderIds.has(row.riderId)||
        ![row.energyAtDecision,energySpent,row.energyAfter]
          .every(Number.isFinite)||energySpent<-EPSILON||
        row.energyAtCatch!==undefined&&
          (![row.energyAtCatch,row.postCatchEnergySpent]
            .every(Number.isFinite)||
            row.postCatchEnergySpent<-EPSILON||
            row.postCatchEnergySpent-energySpent>EPSILON||
            Math.abs(row.energyAtDecision-
              (energySpent-row.postCatchEnergySpent)-
              row.energyAtCatch)>EPSILON||
            Math.abs(row.energyAtCatch-row.postCatchEnergySpent-
              row.energyAfter)>EPSILON)||
        row.energyAfter<-EPSILON||
        Math.abs(row.energyAtDecision-energySpent-
          row.energyAfter)>EPSILON||
        prior.has(row.riderId)&&Math.abs(prior.get(row.riderId)
          .energyAfter-row.energyAtDecision)>EPSILON)
        throw new Error('The paid attack approach lost rider energy.');
      return {riderId:row.riderId,role:row.role,
        energySpent,energyAfter:row.energyAfter};
    });
    const grouped=frame.roadGroups.flatMap(group=>group.riderIds);
    const onRoad=[...grouped,...frame.pelotonRiderIds];
    if(onRoad.length!==riderIds.size||
      new Set(onRoad).size!==riderIds.size||
      onRoad.some(id=>!riderIds.has(id)))
      throw new Error('The paid attack approach lost a road group.');
    elapsedSeconds+=frame.bunchElapsedSeconds;
    previous=frame;
    return {distanceM:frame.endDistanceM,elapsedSeconds,
      catchDistanceM:frame.catchDistanceM??null,
      pelotonRiderCount:frame.pelotonRiderIds.length,
      roadGroups:frame.roadGroups.map(group=>({id:group.id,
        riderIds:group.riderIds,gapSeconds:group.gapSeconds})),riders};
  });
  if(frames.at(-1)?.distanceM!==tour.route.distanceKm*1000-500||
    Math.abs(elapsedSeconds-source.at500M.bunchElapsedSeconds)>EPSILON||
    branch==='caught'&&(!Number.isFinite(frames[1].catchDistanceM)||
      frames[1].catchDistanceM<=frames[0].distanceM||
      frames[1].catchDistanceM>=frames[1].distanceM)||
    branch==='caught'&&frames[1].roadGroups.length!==0||
    source.at500M.riderEnergy.length!==riderIds.size||
    source.at500M.riderEnergy.some(row=>{
      const rider=frames.at(-1).riders.find(entry=>
        entry.riderId===row.riderId);
      return !rider||Math.abs(rider.energyAfter-row.energy)>EPSILON;
    }))
    throw new Error('The paid attack approach missed its 500 m handoff.');
  const paid=trial.paidFinale;
  if(['caught','contained'].includes(branch)&&paid?.frames?.[0]&&
    (Math.abs(paid.startDistanceM-frames.at(-1).distanceM)>EPSILON||
      Math.abs(paid.sourceBunchElapsedSeconds-elapsedSeconds)>EPSILON||
      paid.frames[0].riders.some(row=>{
        const before=frames.at(-1).riders.find(entry=>
          entry.riderId===row.riderId);
        return !before||Math.abs(before.energyAfter-
          row.energyAtDecision)>EPSILON;
      })))
    throw new Error('The paid attack approach missed the finale handoff.');
  return {version:source.version,branch,attackRiderId:intent.riderId,
    handoffDistanceM:handoffM,lastBoundaryM:frames.at(-1).distanceM,
    frames};
}

export function summarizeV91PaidSoloApproach(trial){
  if(trial?.roadDecision?.branch!=='solo')return null;
  const {branch,frames,...approach}=
    summarizeV91PaidNamedAttackApproach(trial);
  return {...approach,frames:frames.map(({catchDistanceM,...frame})=>frame)};
}

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
