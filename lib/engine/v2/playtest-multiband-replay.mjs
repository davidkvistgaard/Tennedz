import {isDeepStrictEqual} from 'node:util';

const EPSILON=1e-6;

// A surviving front group and the bunch pass 500 m on different clocks.
// Replay each band's paid individual continuation without pretending that
// their passage frames are simultaneous or that inferred wheels are official.
export function summarizeV91PaidMultibandReplay(output){
  const line=output?.individualLine;
  const clock=output?.recording?.paidFinale;
  const tour=output?.recording?.recording;
  if(line?.version!==
    'v2-finale-multiband-individual-line-lab-3'||
    output?.summary?.roadStatus!=='conditional_multiband_line'||
    !clock||!tour)return null;
  const finishM=tour.route.distanceKm*1000;
  const at500=clock.line?.approachFrames?.find(frame=>
    frame.endDistanceM===finishM-500);
  const source=line.positionedSource;
  const expected=new Set(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id)));
  if(line.sourceClockVersion!==clock.version||
    line.sourcePositionVersion!==source?.version||
    line.lineDistanceM!==finishM||
    !at500||source?.roadBands?.length!==2||
    line.bandRunners?.length!==2||
    at500.roadGroups?.length!==1||
    at500.roadGroups[0].id!==source.roadBands[0].id||
    source.roadBands[1].id!=='peloton'||
    !isDeepStrictEqual(line.conditionalCrossings,
      output.summary.finale?.lineTimes)||
    line.pointsStatus!=='withheld'||
    output.summary.pointsStatus!=='withheld')
    throw new Error('The multiband replay lost its paid source or line.');
  const groups=[...at500.roadGroups.map(group=>({
    id:group.id,riderIds:group.riderIds})),
  {id:'peloton',riderIds:at500.pelotonRiderIds}];
  const sourceIds=groups.flatMap(group=>group.riderIds);
  const sourceEnergy=new Map(at500.riders.map(row=>
    [row.riderId,row.energy]));
  const crossings=new Map(line.conditionalCrossings.map(row=>
    [row.riderId,row]));
  if(sourceIds.length!==expected.size||
    new Set(sourceIds).size!==expected.size||
    sourceIds.some(id=>!expected.has(id))||
    sourceEnergy.size!==expected.size||
    [...expected].some(id=>
      !Number.isFinite(sourceEnergy.get(id)))||
    crossings.size!==expected.size||
    source.roadBands.some((band,index)=>
      band.id!==groups[index].id||
      band.slots.length!==groups[index].riderIds.length||
      band.slots.some(slot=>
        !groups[index].riderIds.includes(slot.riderId))))
    throw new Error('The multiband replay lost a road rider.');
  const bands=line.bandRunners.map((band,index)=>{
    const group=groups[index];
    const slots=new Map(source.roadBands[index].slots.map(slot=>
      [slot.riderId,slot]));
    const frames=band.runner?.frames;
    if(band.roadBandId!==group.id||
      !Array.isArray(frames)||!frames.length||
      !Number.isFinite(band.paidTo500Seconds)||
      Math.abs(frames[0].elapsedSecondsAtStart-
        band.paidTo500Seconds)>EPSILON||
      frames[0].startDistanceM!==finishM-500||
      frames.at(-1).endDistanceM!==finishM||
      band.runner.finishers.length!==group.riderIds.length)
      throw new Error('The multiband replay lost a paid band.');
    let previous=null;
    const replayFrames=frames.map((frame,frameIndex)=>{
      const finalWheelClearance=frameIndex===frames.length-1&&
        previous?.endDistanceM===finishM&&
        frame.startDistanceM<finishM&&frame.endDistanceM===finishM;
      if(!Number.isFinite(frame.elapsedSecondsAtStart)||
        !Number.isFinite(frame.durationSeconds)||
        frame.durationSeconds<=0||
        frame.startDistanceM!==(previous?.endDistanceM??finishM-500)&&
          !finalWheelClearance||
        previous&&Math.abs(frame.elapsedSecondsAtStart-
          previous.elapsedSecondsAtStart-
          previous.durationSeconds)>EPSILON||
        frame.riders?.length!==group.riderIds.length||
        new Set(frame.riders.map(row=>row.riderId)).size!==
          group.riderIds.length)
        throw new Error('The multiband replay lost its band clock.');
      const prior=new Map(previous?.riders.map(row=>
        [row.riderId,row])??[]);
      const riders=frame.riders.map(row=>{
        const before=prior.get(row.riderId);
        const slot=slots.get(row.riderId);
        if(!slot||
          ![row.positionBeforeM,row.positionM,row.energyAtDecision,
            row.energySpent,row.energyAfter].every(Number.isFinite)||
          row.positionM<row.positionBeforeM-EPSILON||
          row.positionM>finishM+EPSILON||
          row.energySpent<-EPSILON||row.energyAfter<-EPSILON||
          Math.abs(row.energyAtDecision-row.energySpent-
            row.energyAfter)>EPSILON||
          before&&(Math.abs(before.positionM-row.positionBeforeM)>
            EPSILON||Math.abs(before.energyAfter-
              row.energyAtDecision)>EPSILON)||
          !before&&(Math.abs(row.positionBeforeM-
            (slot.positionM+500))>EPSILON||
            Math.abs(row.energyAtDecision-
              sourceEnergy.get(row.riderId))>EPSILON))
          throw new Error('The multiband replay lost rider travel or energy.');
        return {riderId:row.riderId,role:row.role,
          positionM:row.positionM,energyAfter:row.energyAfter,
          energySpent:row.energySpent,
          elapsedToLineSeconds:row.elapsedToLineSeconds};
      });
      previous=frame;
      return {elapsedSeconds:frame.elapsedSecondsAtStart+
        frame.durationSeconds,endDistanceM:frame.endDistanceM,riders};
    });
    const last=replayFrames.at(-1);
    if(last.riders.some(row=>{
      const crossing=crossings.get(row.riderId);
      return !crossing||
        Math.abs(row.positionM-finishM)>EPSILON||
        !Number.isFinite(row.elapsedToLineSeconds)||
        Math.abs(row.elapsedToLineSeconds-
          crossing.elapsedSecondsFromLastKmStart)>EPSILON||
        Math.abs(row.energyAfter-crossing.energyAtLine)>EPSILON;
    })||!isDeepStrictEqual(band.runner.finishers,
      line.conditionalCrossings.filter(row=>
        row.roadBandId===band.roadBandId).map(({roadBandId,...row})=>row)))
      throw new Error('The multiband replay lost its individual line.');
    return {id:band.roadBandId,riderIds:group.riderIds,
      passageSecondsFromBunchMarker:band.paidTo500Seconds,
      sourceRiders:group.riderIds.map(riderId=>({riderId,
        energyAt500:sourceEnergy.get(riderId)})),frames:replayFrames};
  });
  return {version:line.version,status:'band_local_paid_trace',
    handoffDistanceM:finishM-500,lineDistanceM:finishM,bands};
}
