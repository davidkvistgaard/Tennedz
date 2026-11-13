import {isDeepStrictEqual} from 'node:util';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {FINALE_COAST_LATE_BUNCH_EXIT_INDIVIDUAL_LINE_VERSION} from
  './finale-depleted-individual-line.mjs';

export const FINALE_LATE_BUNCH_EXIT_SHOULDER_VERSION=
  'v2-finale-late-bunch-exit-shoulder-1';
const EPSILON=1e-7;

// A rider leaving the bunch after the 500 m handoff takes a distinct outside
// lane. The existing paid solo travel and sprint replay are unchanged. This
// rule only accepts an exit whose paid passage is behind the bunch at every
// subsequent marker; equal solo clocks still have no recorded place order.
export function recordFinaleLateBunchExitShoulder(tour,clock,line){
  if(line?.version!==FINALE_COAST_LATE_BUNCH_EXIT_INDIVIDUAL_LINE_VERSION||
    tour?.frames?.at(-2)?.roadGroups?.length)
    throw new Error('The late shoulder needs a no-front individual line.');
  const source=resolveFinaleMultibandPositionedSource(tour,
    {includeDropped:true,allowNoFront:true});
  const exits=line.positionedSource.lateBunchExits;
  const finishM=tour.route.distanceKm*1000;
  if(!Array.isArray(exits)||!exits.length||
    line.startDistanceM!==finishM-1000||
    new Set(exits.map(row=>row.riderId)).size!==exits.length)
    throw new Error('The late shoulder has no unique recorded exits.');
  const sourceSlots=new Map(source.roadBands[0].slots.map(row=>
    [row.riderId,row]));
  const exitEvents=clock.trace.frames.flatMap(frame=>
    frame.exhaustionDrops.map(row=>({frame,row})));
  const assignments=exits.map((exit,index)=>{
    const slot=sourceSlots.get(exit.riderId);
    const event=exitEvents.find(({row})=>row.riderId===exit.riderId);
    if(!slot||!event||event.row.atDistanceM!==exit.atDistanceM||
      event.frame.startDistanceM!==exit.atDistanceM||
      exit.atDistanceM<finishM-500||exit.atDistanceM>=finishM||
      line.conditionalCrossings.find(row=>row.riderId===exit.riderId)
        ?.roadBandId!==`isolated:${exit.riderId}`)
      throw new Error('A late shoulder exit lacks a paid source wheel.');
    const passages=clock.passageFrames.filter(row=>
      row.distanceM>exit.atDistanceM).map(row=>{
      const solo=row.droppedPassages.find(value=>
        value.riderId===exit.riderId);
      const frame=clock.trace.frames.find(value=>
        value.endDistanceM===row.distanceM);
      const travel=frame?.droppedTravel?.riders?.find(value=>
        value.riderId===exit.riderId);
      const state=frame?.riders?.find(value=>
        value.riderId===exit.riderId);
      const gap=solo?.passageSecondsFromBunchMarker-
        row.bunchPassageSecondsFromBunchMarker;
      if(!solo||!travel||!state||!Number.isFinite(gap)||
        gap<=EPSILON||Math.abs(gap-travel.deficitSecondsAfter)>EPSILON||
        Math.abs(solo.energyAfter-state.energy)>EPSILON)
        throw new Error('A late shoulder rider did not fall behind on paid road.');
      return {distanceM:row.distanceM,
        secondsBehindBunch:gap,
        passageSecondsFromBunchMarker:
          solo.passageSecondsFromBunchMarker,
        energyAfter:state.energy};
    });
    if(!passages.length||passages.at(-1).distanceM!==finishM||
      passages.some((row,i)=>i&&row.secondsBehindBunch+
        EPSILON<passages[i-1].secondsBehindBunch))
      throw new Error('A late shoulder rider rejoined the bunch.');
    const crossing=line.conditionalCrossings.find(row=>
      row.riderId===exit.riderId);
    if(Math.abs(crossing.elapsedSecondsFromLastKmStart-
      passages.at(-1).passageSecondsFromBunchMarker)>EPSILON||
      Math.abs(crossing.energyAtLine-passages.at(-1).energyAfter)>EPSILON)
      throw new Error('A late shoulder crossing differs from the paid road.');
    return {riderId:exit.riderId,atDistanceM:exit.atDistanceM,
      sourceLane:slot.lane,outsideLane:source.laneCount+index,
      rule:'late_exhausted_leaver_outside_no_draft',passages};
  });
  const atLine=new Map(assignments.map(row=>[row.riderId,
    row.passages.at(-1).passageSecondsFromBunchMarker]));
  const unresolvedEqualClocks=assignments.flatMap((left,index)=>
    assignments.slice(index+1).filter(right=>
      Math.abs(atLine.get(left.riderId)-atLine.get(right.riderId))<=EPSILON)
      .map(right=>[left.riderId,right.riderId]));
  return {version:FINALE_LATE_BUNCH_EXIT_SHOULDER_VERSION,
    sourceClockVersion:clock.version,
    sourcePositionVersion:source.version,
    sourceIndividualLineVersion:line.version,
    assignments,unresolvedEqualClocks,
    status:'conditional_paid_late_exit_shoulder',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleLateBunchExitShoulder(tour,clock,line,audit){
  if(!isDeepStrictEqual(audit,
    recordFinaleLateBunchExitShoulder(tour,clock,line)))
    throw new Error('The late bunch exit shoulder does not replay.');
  return true;
}
