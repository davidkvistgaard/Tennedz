import {recordFinaleAllBandOverlapAudit,
  recordFinaleUnorderedBandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';

export const FINALE_PRE500_ACTIVE_OVERLAP_AUDIT_VERSION=
  'v2-finale-pre500-active-overlap-audit-1';
export const FINALE_PRE500_DROPPED_OVERLAP_AUDIT_VERSION=
  'v2-finale-pre500-dropped-overlap-audit-1';
export const FINALE_PRE500_UNORDERED_DROPPED_OVERLAP_AUDIT_VERSION=
  'v2-finale-pre500-dropped-overlap-audit-2';
export const FINALE_PRE500_ISOLATED_PASS_VERSION=
  'v2-finale-pre500-isolated-lane-pass-1';
const EPSILON=1e-7;

function activeRunners(positioned,passages){
  const bands=positioned?.roadBands;
  const start=positioned?.startDistanceM;
  if(!Array.isArray(bands)||bands.length<1||
    !Array.isArray(passages)||passages.length!==2||
    passages[0].endDistanceM!==start+250||
    passages[1].endDistanceM!==start+500||
    passages.some(row=>!Array.isArray(row.bandTimes)||
      row.bandTimes.length!==bands.length||
      !Array.isArray(row.riderEnergy)))
    throw new Error('The pre-500 audit needs two paid active passages.');
  return bands.map((band,index)=>{
    let before=start;
    let time=band.passageSecondsFromBunchMarker;
    let energy=new Map(band.slots.map(slot=>
      [slot.riderId,slot.energy]));
    const frames=passages.map(passage=>{
      const after=passage.endDistanceM;
      const endTime=passage.bandTimes[index];
      const seconds=endTime-time;
      const next=new Map(passage.riderEnergy.map(row=>
        [row.riderId,row.energy]));
      if(!Number.isFinite(seconds)||seconds<=0||
        next.size!==passage.riderEnergy.length||
        band.slots.some(slot=>!Number.isFinite(next.get(slot.riderId))||
          next.get(slot.riderId)<0||
          next.get(slot.riderId)>energy.get(slot.riderId)+EPSILON))
        throw new Error('A pre-500 active rider has no paid passage.');
      const frame={startDistanceM:before,endDistanceM:after,
        elapsedSecondsAtStart:time,durationSeconds:seconds,
        riders:band.slots.map(slot=>{
          const offset=start-slot.positionM;
          return {riderId:slot.riderId,role:'active',
            positionBeforeM:before-offset,positionM:after-offset,
            activeSeconds:seconds,activeDistanceM:after-before,
            shelteredSeconds:0,shelteredDistanceM:0,
            elapsedToLineSeconds:null};
        })};
      before=after;
      time=endTime;
      energy=next;
      return frame;
    });
    return {roadBandId:band.id,runner:{frames}};
  });
}

// Carry each provisional source wheel behind its band's paid edge through
// the two recorded 250 m passages. This only tests longitudinal proximity:
// lanes, passing and a response to possible contact remain unresolved.
export function recordFinalePre500ActiveOverlapAudit(positioned,passages){
  if(positioned?.roadBands?.length<2)
    throw new Error('The pre-500 audit needs two paid active bands.');
  const runners=activeRunners(positioned,passages);
  const overlap=recordFinaleAllBandOverlapAudit(runners);
  return {version:FINALE_PRE500_ACTIVE_OVERLAP_AUDIT_VERSION,
    sourcePositionVersion:positioned.version,
    status:overlap.status,
    firstPotentialOverlap:overlap.firstPotentialOverlap,
    inferredWheelPositions:true,contactResolved:false,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

// A dropped rider's kilometre deficit is already a passage-time offset from
// the bunch at the same marker. Keep that rider isolated through the two
// paid 250 m passages; do not invent a wheel or a shared dropped group.
function droppedPre500Runners(tour,clock,positioned){
  const start=positioned?.startDistanceM;
  const active=positioned?.roadBands;
  const dropped=positioned?.droppedRiderIds;
  const frames=clock?.passageFrames?.filter(frame=>
    frame.distanceM<=start+500);
  const trace=clock?.trace?.frames;
  const source=tour?.frames?.[clock?.sourceKm-1];
  if(!Array.isArray(active)||!active.length||
    !Array.isArray(dropped)||!dropped.length||
    !Array.isArray(frames)||frames.length!==2||
    frames[0].distanceM!==start+250||
    frames[1].distanceM!==start+500||
    !Array.isArray(trace)||!source||
    clock.trace.sourceKm!==clock.sourceKm)
    throw new Error('A dropped pre-500 audit needs paid source passages.');
  const energyAt=distanceM=>trace.find(frame=>
    frame.endDistanceM===distanceM)?.riders;
  const passages=frames.map(frame=>({endDistanceM:frame.distanceM,
    bandTimes:[...frame.groups.map(group=>
      group.passageSecondsFromBunchMarker),
    frame.bunchPassageSecondsFromBunchMarker],
    riderEnergy:energyAt(frame.distanceM)}));
  if(passages.some(row=>!Array.isArray(row.riderEnergy)||
    row.bandTimes.length!==active.length))
    throw new Error('A dropped pre-500 audit lost active rider energy.');
  const runners=activeRunners(positioned,passages);
  const sourceById=new Map(source.riderGroups.map(row=>[row.id,row]));
  for(const riderId of dropped){
    const row=sourceById.get(riderId);
    if(row?.group!=='dropped'||
      !Number.isFinite(row.deficitSeconds)||row.deficitSeconds<=0)
      throw new Error('A dropped rider lacks a source passage deficit.');
    let before=start;
    let time=row.deficitSeconds;
    const paid=frames.map(frame=>{
      const next=frame.droppedPassages.find(value=>
        value.riderId===riderId);
      const after=frame.distanceM;
      const seconds=next?.passageSecondsFromBunchMarker-time;
      if(!Number.isFinite(seconds)||seconds<=0||
        next.unmetEnergyDemand>EPSILON)
        throw new Error('A dropped pre-500 rider has unpaid travel.');
      const result={startDistanceM:before,endDistanceM:after,
        elapsedSecondsAtStart:time,durationSeconds:seconds,
        riders:[{riderId,role:'dropped',positionBeforeM:before,
          positionM:after,activeSeconds:seconds,
          activeDistanceM:after-before,shelteredSeconds:0,
          shelteredDistanceM:0,elapsedToLineSeconds:null}]};
      before=after;
      time=next.passageSecondsFromBunchMarker;
      return result;
    });
    runners.push({roadBandId:`isolated:${riderId}`,
      runner:{frames:paid}});
  }
  return {runners,activeCount:active.length,start,frames};
}

export function recordFinalePre500DroppedOverlapAudit(tour,clock,positioned,
  {unordered=false}={}){
  const {runners}=droppedPre500Runners(tour,clock,positioned);
  const overlap=unordered?
    recordFinaleUnorderedBandOverlapAudit(runners):
    recordFinaleAllBandOverlapAudit(runners);
  return {version:unordered?
    FINALE_PRE500_UNORDERED_DROPPED_OVERLAP_AUDIT_VERSION:
    FINALE_PRE500_DROPPED_OVERLAP_AUDIT_VERSION,
    sourcePositionVersion:positioned.version,
    sourceClockVersion:clock.version,
    status:overlap.status,
    firstPotentialOverlap:overlap.firstPotentialOverlap,
    inferredWheelPositions:true,
    droppedPassageSource:'recorded_kilometre_deficit',
    contactResolved:false,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

// Isolated riders have their own paid passage times and no wheel or helper.
// In this opt-in rule, a faster isolated rider takes a separate lane to pass:
// neither rider changes speed, role, band or energy. Any possible encounter
// with an active band still refuses this rule.
export function recordFinalePre500IsolatedPasses(tour,clock,positioned){
  const {runners,activeCount,start,frames}=droppedPre500Runners(
    tour,clock,positioned);
  const active=runners.slice(0,activeCount);
  const isolated=runners.slice(activeCount);
  for(let a=0;a<runners.length;a++)for(let b=a+1;b<runners.length;b++){
    if(a>=activeCount&&b>=activeCount)continue;
    if(recordFinaleUnorderedBandOverlapAudit([runners[a],runners[b]])
      .firstPotentialOverlap)return null;
  }
  const passes=[];
  for(let a=0;a<isolated.length;a++)for(let b=a+1;b<isolated.length;b++){
    const left=isolated[a],right=isolated[b];
    const pair=recordFinaleUnorderedBandOverlapAudit([left,right]);
    if(!pair.firstPotentialOverlap)continue;
    const leftFrames=left.runner.frames;
    const rightFrames=right.runner.frames;
    let found=0;
    for(let index=0;index<2;index++){
      const beforeLeft=leftFrames[index].elapsedSecondsAtStart;
      const beforeRight=rightFrames[index].elapsedSecondsAtStart;
      const afterLeft=beforeLeft+leftFrames[index].durationSeconds;
      const afterRight=beforeRight+rightFrames[index].durationSeconds;
      const before=beforeLeft-beforeRight;
      const after=afterLeft-afterRight;
      if(Math.abs(before)<=EPSILON||Math.abs(after)<=EPSILON)
        return null;
      if(before*after>=0)continue;
      const share=before/(before-after);
      const distanceM=(index?frames[0].distanceM:start)+250*share;
      const elapsedSecondsFromLastKmStart=beforeLeft+
        (afterLeft-beforeLeft)*share;
      passes.push({passingRiderId:before>0?
        left.runner.frames[0].riders[0].riderId:
        right.runner.frames[0].riders[0].riderId,
      passedRiderId:before>0?
        right.runner.frames[0].riders[0].riderId:
        left.runner.frames[0].riders[0].riderId,
      distanceM,elapsedSecondsFromLastKmStart,
      laneRule:'isolated_open_lane_no_draft'});
      found++;
    }
    if(!found||Math.abs(passes.at(-1).distanceM-
      pair.firstPotentialOverlap.distanceM)>EPSILON)
      return null;
  }
  if(!passes.length)return null;
  passes.sort((a,b)=>a.elapsedSecondsFromLastKmStart-
    b.elapsedSecondsFromLastKmStart||
    a.passingRiderId.localeCompare(b.passingRiderId));
  return {version:FINALE_PRE500_ISOLATED_PASS_VERSION,
    sourceClockVersion:clock.version,
    sourcePositionVersion:positioned.version,
    status:'resolved_isolated_lane_passes',
    firstPotentialOverlap:null,passes,contactResolved:true,
    inferredWheelPositions:active.some(band=>band.runner.frames[0]
      .riders.length>1),
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}
