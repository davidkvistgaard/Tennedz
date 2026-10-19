import {recordFinaleAllBandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';

export const FINALE_PRE500_ACTIVE_OVERLAP_AUDIT_VERSION=
  'v2-finale-pre500-active-overlap-audit-1';
const EPSILON=1e-7;

// Carry each provisional source wheel behind its band's paid edge through
// the two recorded 250 m passages. This only tests longitudinal proximity:
// lanes, passing and a response to possible contact remain unresolved.
export function recordFinalePre500ActiveOverlapAudit(positioned,passages){
  const bands=positioned?.roadBands;
  const start=positioned?.startDistanceM;
  if(!Array.isArray(bands)||bands.length<2||
    !Array.isArray(passages)||passages.length!==2||
    passages[0].endDistanceM!==start+250||
    passages[1].endDistanceM!==start+500||
    passages.some(row=>!Array.isArray(row.bandTimes)||
      row.bandTimes.length!==bands.length||
      !Array.isArray(row.riderEnergy)))
    throw new Error('The pre-500 audit needs two paid active passages.');
  const runners=bands.map((band,index)=>{
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
  const overlap=recordFinaleAllBandOverlapAudit(runners);
  return {version:FINALE_PRE500_ACTIVE_OVERLAP_AUDIT_VERSION,
    sourcePositionVersion:positioned.version,
    status:overlap.status,
    firstPotentialOverlap:overlap.firstPotentialOverlap,
    inferredWheelPositions:true,contactResolved:false,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}
