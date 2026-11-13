import {paidSoloSprintPassage} from './finale-solo-sprint-work.mjs';

export const FINALE_SEPARATED_SINGLETON_BAND_VERSION=
  'v2-finale-separated-singleton-band-1';
const EPSILON=1e-7;

// Continue one already paid separated road group from its 500 m passage.
// A nominated solo sprint replaces only its final 300 m of road work.
export function recordFinaleSeparatedSingletonBandFromTour(tour,{
  band,at500,trace,passageAt500,passageAtLine,sprintPlan}){
  const finishM=tour?.route?.distanceKm*1000;
  const riderId=band?.slots?.[0]?.riderId;
  const team=tour?.committedInputs?.teams.find(row=>
    row.riders.some(rider=>rider.id===riderId));
  const rider=team?.riders.find(row=>row.id===riderId);
  const sourceRow=at500?.riders.find(row=>row.riderId===riderId);
  const lineEnergy=trace?.finalRiderEnergy.find(row=>
    row.riderId===riderId)?.energy;
  const decision=sprintPlan?.decisions.find(row=>
    row.finisherId===riderId);
  const after500=trace?.frames.filter(frame=>
    frame.endDistanceM>finishM-500);
  if(band.slots.length!==1||!rider||
    at500?.endDistanceM!==finishM-500||
    !Number.isFinite(sourceRow?.energy)||
    !Number.isFinite(passageAt500)||
    !Number.isFinite(passageAtLine)||
    !Number.isFinite(lineEnergy)||
    after500?.length!==5||after500.some((frame,index)=>
      frame.startDistanceM!==finishM-500+index*100||
      frame.endDistanceM!==frame.startDistanceM+100||
      frame.roadGroups.find(group=>group.id===band.id)
        ?.riderIds.length!==1||
      frame.roadGroups.find(group=>group.id===band.id)
        ?.riderIds[0]!==riderId))
    throw new Error('A separated singleton needs a paid 500 m road.');
  // A nomination is an intention, not permission to spend energy the rider
  // does not have. Decide for the whole final 300 m at the paid handoff so an
  // exhausted singleton keeps its already recorded road passage throughout.
  let sprint=Boolean(decision);
  if(sprint){
    let sprintEnergy=sourceRow.energy-after500.slice(0,2).reduce((spent,
      frame)=>spent+frame.riders.find(row=>row.riderId===riderId)
        .energySpent,0);
    for(const frame of after500.slice(2)){
      const paid=paidSoloSprintPassage(rider,
        tour.route.kilometres[frame.sourceKm-1],sprintEnergy);
      if(!Number.isFinite(paid.energySpent)||
        paid.energySpent>sprintEnergy+EPSILON||paid.energyAfter<0){
        sprint=false;
        break;
      }
      sprintEnergy=paid.energyAfter;
    }
  }
  let elapsed=passageAt500;
  let energy=sourceRow.energy;
  const frames=after500.map(frame=>{
    const row=frame.riders.find(item=>item.riderId===riderId);
    const group=frame.roadGroups.find(item=>item.id===band.id);
    const sprintSlice=sprint&&frame.startDistanceM>=finishM-300;
    const paid=sprintSlice?paidSoloSprintPassage(rider,
      tour.route.kilometres[frame.sourceKm-1],energy):null;
    const seconds=paid?.durationSeconds??group.elapsedSeconds;
    const spent=paid?.energySpent??row?.energySpent;
    const after=paid?.energyAfter??row?.energy;
    if(sprintSlice&&spent>energy+EPSILON)
      throw new Error('The singleton cannot pay for the nominated sprint.');
    if(!row||!Number.isFinite(seconds)||seconds<=0||
      !Number.isFinite(spent)||spent<0||
      !Number.isFinite(after)||after<0||
      spent>energy+EPSILON||
      !sprintSlice&&Math.abs(energy-spent-after)>EPSILON)
      throw new Error('The separated singleton has unpaid final-500 m travel.');
    const result={startDistanceM:frame.startDistanceM,
      endDistanceM:frame.endDistanceM,
      elapsedSecondsAtStart:elapsed,durationSeconds:seconds,
      riders:[{riderId,role:sprintSlice?'solo_sprint':'solo_front',
        positionBeforeM:frame.startDistanceM,
        positionM:frame.endDistanceM,
        activeSeconds:seconds,activeDistanceM:100,
        shelteredSeconds:0,shelteredDistanceM:0,
        energyAtDecision:energy,energySpent:spent,energyAfter:after,
        elapsedToLineSeconds:frame.endDistanceM===finishM?
          elapsed+seconds:null}]};
    elapsed+=seconds;
    energy=after;
    return result;
  });
  if(!sprint&&(Math.abs(elapsed-passageAtLine)>EPSILON||
    Math.abs(energy-lineEnergy)>EPSILON))
    throw new Error('The separated singleton differs from its paid road.');
  return {roadBandId:band.id,paidTo500Seconds:passageAt500,
    runner:{version:FINALE_SEPARATED_SINGLETON_BAND_VERSION,
      frames,finishers:[{riderId,teamId:team.id,
        elapsedSecondsFromLastKmStart:elapsed,energyAtLine:energy}]}};
}
