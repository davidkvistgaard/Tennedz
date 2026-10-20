import {isDeepStrictEqual} from 'node:util';
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
function summarizePaidFinaleReplay(trial,{startM,elapsedAtStart,status,
  approach=null}){
  const tour=trial?.recording;
  const paid=trial?.paidFinale;
  const frames=paid?.frames;
  const handoffM=(tour?.route?.distanceKm-1)*1000;
  const finishM=tour?.route?.distanceKm*1000;
  if(trial?.roadStatus!=='paid_conditional_line'||
    !Array.isArray(frames)||!frames.length||
    !Number.isFinite(handoffM)||!Number.isFinite(startM)||
    Math.abs(paid.startDistanceM-startM)>EPSILON||
    Math.abs(frames[0].startDistanceM-startM)>EPSILON||
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
  if(Math.abs(frames[0].elapsedSecondsAtStart-elapsedAtStart)>EPSILON||
    replayFrames.at(-1).riders.some(row=>
      Math.abs(row.positionM-finishM)>EPSILON||
      !Number.isFinite(row.elapsedToLineSeconds)))
    throw new Error('The paid finale replay did not reach every line.');
  const finishers=new Map(paid.finishers?.map(row=>
    [row.riderId,row])??[]);
  if(finishers.size!==expected.size||
    replayFrames.at(-1).riders.some(row=>{
      const finisher=finishers.get(row.riderId);
      return !finisher||
        !Number.isFinite(finisher.elapsedSecondsFromLastKmStart)||
        !Number.isFinite(finisher.energyAtLine)||
        Math.abs(row.elapsedToLineSeconds-
          finisher.elapsedSecondsFromLastKmStart)>EPSILON||
        Math.abs(row.energyAfter-finisher.energyAtLine)>EPSILON;
    }))
    throw new Error('The paid finale replay lost its individual line.');
  if(approach){
    const at500=new Map(approach.frames.at(-1).riders.map(row=>
      [row.riderId,row.energyAfter]));
    if(approach.lastBoundaryM!==startM||
      Math.abs(paid.sourceBunchElapsedSeconds-elapsedAtStart)>EPSILON||
      at500.size!==expected.size||
      frames[0].riders.some(row=>
        Math.abs(row.positionBeforeM-startM)>EPSILON||
        Math.abs(row.energyAtDecision-at500.get(row.riderId))>EPSILON))
      throw new Error('The paid finale tail lost its approach or line.');
  }
  return {version:paid.version,status,
    handoffDistanceM:startM,lineDistanceM:finishM,
    ...(approach?{positionSourceStatus:paid.positionSourceStatus}:{}),
    frames:replayFrames};
}

export function summarizeV91PaidFinaleReplay(trial){
  const handoffM=(trial?.recording?.route?.distanceKm-1)*1000;
  return summarizePaidFinaleReplay(trial,{startM:handoffM,
    elapsedAtStart:0,status:'complete_paid_trace'});
}

// A caught or contained named attack has a group-level opening 500 m and a
// positioned, paid continuation. Keep it separate from a full-kilometre replay.
export function summarizeV91PaidFinaleTail(trial){
  if(!['caught','contained'].includes(trial?.roadDecision?.branch))
    return null;
  const approach=summarizeV91PaidNamedAttackApproach(trial);
  const startM=approach?.lastBoundaryM;
  return summarizePaidFinaleReplay(trial,{startM,
    elapsedAtStart:approach.frames.at(-1).elapsedSeconds,
    status:'partial_paid_trace',approach});
}

// A solo attack can be caught after the 500 m handoff. Both the approach to
// contact and the continuation are paid individual frames, even though their
// bunch boundaries differ when riders occupy different road positions.
export function summarizeV91PaidPartialContactReplay(trial){
  const before=trial?.preContactFinale;
  const after=trial?.paidFinale;
  if(trial?.roadDecision?.branch!=='solo'||
    trial?.roadStatus!=='paid_conditional_line'||
    !Array.isArray(before?.frames)||!before.frames.length||
    !Array.isArray(after?.frames)||!after.frames.length)
    return null;
  const approach=summarizeV91PaidNamedAttackApproach(trial);
  const last=before.frames.at(-1);
  const first=after.frames[0];
  const alignment=before.alignment;
  const at500=new Map(approach.frames.at(-1).riders.map(row=>
    [row.riderId,row.energyAfter]));
  const starting=before.frames[0].riders;
  if(approach.frames.at(-1).roadGroups.length!==1||
    !approach.frames.at(-1).roadGroups[0].riderIds
      .includes(approach.attackRiderId)||
    !Number.isFinite(alignment?.soloPositionM)||
    !Number.isFinite(alignment?.soloEnergyAt500M)||
    !Number.isFinite(alignment?.soloEnergyAtBunch500M)||
    !Number.isFinite(alignment?.energySpent)||
    Math.abs(alignment.soloEnergyAt500M-
      at500.get(approach.attackRiderId))>EPSILON||
    Math.abs(alignment.soloEnergyAt500M-alignment.energySpent-
      alignment.soloEnergyAtBunch500M)>EPSILON||
    starting.length!==at500.size||
    starting.some(row=>row.riderId===approach.attackRiderId?
      Math.abs(row.positionBeforeM-alignment.soloPositionM)>EPSILON||
      Math.abs(row.energyAtDecision-
        alignment.soloEnergyAtBunch500M)>EPSILON:
      Math.abs(row.positionBeforeM-approach.lastBoundaryM)>EPSILON||
      Math.abs(row.energyAtDecision-at500.get(row.riderId))>EPSILON))
    throw new Error('The paid partial contact replay lost its 500 m source.');
  if(!isDeepStrictEqual(before.contact,after.contact)||
    !Number.isFinite(before.contact?.distanceM)||
    !Number.isFinite(before.contact?.elapsedSeconds)||
    Math.abs(last.endDistanceM-before.contact.distanceM)>EPSILON||
    Math.abs(last.elapsedSecondsAtStart+last.durationSeconds-
      before.contact.elapsedSeconds)>EPSILON||
    Math.abs(first.elapsedSecondsAtStart-
      before.contact.elapsedSeconds)>EPSILON)
    throw new Error('The paid partial contact replay lost its exact contact.');
  const joined={...trial,paidFinale:{...after,
    startDistanceM:before.startDistanceM,
    frames:[...before.frames,...after.frames]}};
  return summarizePaidFinaleReplay(joined,{
    startM:approach.lastBoundaryM,
    elapsedAtStart:approach.frames.at(-1).elapsedSeconds,
    status:'partial_contact_paid_trace'});
}

// Two managers can attack on the same last kilometre. The paid road tape
// records both catches as bands, then a separate positioned runner begins at
// the complete bunch boundary. Never imply individual wheel positions before
// that boundary.
export function summarizeV91PaidConcurrentLateCatchReplay(output){
  const line=output?.individualLine;
  const tour=output?.recording?.recording;
  if(line?.version!=='v2-finale-concurrent-late-catch-line-lab-1'||
    output?.summary?.roadStatus!==line.roadStatus||!tour)return null;
  const prefix=line.roadPrefix;
  const runner=line.runner;
  const expected=new Set(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id)));
  const finishM=tour.route.distanceKm*1000;
  if(prefix.startDistanceM<finishM-500||
    prefix.startDistanceM>=prefix.handoffDistanceM||
    prefix.handoffDistanceM!==runner.startDistanceM||
    runner.lineDistanceM!==finishM||
    !Array.isArray(prefix.frames)||!prefix.frames.length||
    !Array.isArray(runner.frames)||!runner.frames.length||
    prefix.contactEvents?.map(row=>row.kind).join(',')!==
      'rear_attack_bunch_contact,front_bunch_contact')return null;
  let prior=null;
  const roadFrames=prefix.frames.map(frame=>{
    const groups=frame.roadBands;
    const grouped=groups?.flatMap(group=>group.riderIds)??[];
    if(!Number.isFinite(frame.elapsedSinceLaunchSeconds)||
      frame.elapsedSinceLaunchSeconds<=
        (prior?.elapsedSinceLaunchSeconds??
          prefix.sourceElapsedSinceLaunchSeconds)||
      grouped.length!==expected.size||new Set(grouped).size!==expected.size||
      grouped.some(id=>!expected.has(id))||
      frame.riders?.length!==expected.size||
      new Set(frame.riders.map(row=>row.riderId)).size!==expected.size)
      throw new Error('The concurrent road replay lost a band or clock.');
    const previous=new Map(prior?.riders.map(row=>
      [row.riderId,row.energyAtEvent])??[]);
    const riders=frame.riders.map(row=>{
      if(!expected.has(row.riderId)||
        ![row.energyBefore,row.energySpent,row.energyAtEvent]
          .every(Number.isFinite)||row.energySpent<-EPSILON||
        row.energyAtEvent<-EPSILON||
        Math.abs(row.energyBefore-row.energySpent-
          row.energyAtEvent)>EPSILON||
        previous.has(row.riderId)&&
          Math.abs(previous.get(row.riderId)-row.energyBefore)>EPSILON)
        throw new Error('The concurrent road replay lost rider energy.');
      return {riderId:row.riderId,role:row.role,
        energyAfter:row.energyAtEvent,energySpent:row.energySpent};
    });
    prior=frame;
    return {elapsedSeconds:frame.elapsedSinceLaunchSeconds,
      roadGroups:groups.map(group=>({kind:group.kind,
        positionM:group.positionM,riderIds:group.riderIds})),riders};
  });
  const contacts=prefix.contactEvents;
  if(contacts.some((contact,index)=>
    !expected.has(contact.riderId)||
    ![contact.positionM,contact.elapsedSinceLaunchSeconds]
      .every(Number.isFinite)||
    contact.elapsedSinceLaunchSeconds<=
      (index===0?prefix.sourceElapsedSinceLaunchSeconds:
        contacts[index-1].elapsedSinceLaunchSeconds)||
    contact.elapsedSinceLaunchSeconds>=
      prefix.handoffElapsedSinceLaunchSeconds||
    !prefix.frames.some(frame=>
      Math.abs(frame.elapsedSinceLaunchSeconds-
        contact.elapsedSinceLaunchSeconds)<EPSILON&&
      frame.roadBands.some(group=>
        group.riderIds.includes(contact.riderId)&&
        Math.abs(group.positionM-contact.positionM)<EPSILON)))||
    Math.abs(prior.elapsedSinceLaunchSeconds-
      prefix.handoffElapsedSinceLaunchSeconds)>EPSILON||
    prior.roadBands.length!==1||
    prior.roadBands[0].kind!=='bunch'||
    Math.abs(prior.roadBands[0].positionM-
      prefix.handoffDistanceM)>EPSILON||
    prefix.riderEnergyAtHandoff?.length!==expected.size||
    prefix.riderEnergyAtHandoff.some(row=>{
      const atRoad=prior.riders.find(rider=>rider.riderId===row.riderId);
      return !atRoad||Math.abs(atRoad.energyAtEvent-row.energy)>EPSILON;
    }))throw new Error('The concurrent road replay missed its handoff.');
  const first=runner.frames[0];
  const atHandoff=new Map(prefix.riderEnergyAtHandoff.map(row=>
    [row.riderId,row.energy]));
  if(first.startDistanceM!==prefix.handoffDistanceM||
    Math.abs(first.elapsedSecondsAtStart-
      prefix.handoffElapsedSinceLaunchSeconds)>EPSILON||
    first.riders.length!==expected.size||
    first.riders.some(row=>
      !expected.has(row.riderId)||
      Math.abs(row.energyAtDecision-atHandoff.get(row.riderId))>
        EPSILON||
      !line.positionedSource.slots.some(slot=>
        slot.riderId===row.riderId&&
        Math.abs(slot.positionM-row.positionBeforeM)<EPSILON)))
    throw new Error('The concurrent rider replay lost its paid source.');
  const replay=summarizePaidFinaleReplay({recording:tour,
    roadStatus:'paid_conditional_line',paidFinale:{
      version:line.version,startDistanceM:runner.startDistanceM,
      frames:runner.frames,finishers:runner.finishers}},
  {startM:prefix.handoffDistanceM,
    elapsedAtStart:prefix.handoffElapsedSinceLaunchSeconds,
    status:'concurrent_late_catch_paid_trace'});
  if(!isDeepStrictEqual(runner.finishers,line.conditionalCrossings)||
    !isDeepStrictEqual(runner.lineOrder,line.provisionalLineOrder)||
    !isDeepStrictEqual(line.conditionalCrossings,
      output.summary.finale?.lineTimes)||
    line.pointsStatus!=='withheld'||
    output.summary.pointsStatus!=='withheld')
    throw new Error('The concurrent replay lost its conditional result.');
  return {...replay,roadFrames,contactEvents:contacts,
    roadStartDistanceM:prefix.startDistanceM};
}
