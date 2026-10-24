// Read-only paid movement/energy witness for the remaining 20-team mountain refusal.
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from '../lib/engine/v2/tuning.mjs';
import {recordFinaleCoastMixedTwoFrontDroppedClock} from
  '../lib/engine/v2/finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine} from
  '../lib/engine/v2/finale-depleted-individual-line.mjs';
import {recordFinaleMixedTwoFrontDroppedMultifrontPre500Audit} from
  '../lib/engine/v2/finale-mixed-two-front-dropped-pre500-audit.mjs';
import {recordFinaleMixedTwoFrontDroppedMultifrontFinal500Audit} from
  '../lib/engine/v2/finale-mixed-two-front-dropped-final500-audit.mjs';

const teamCount=20;
const settings={distanceKm:260,teamCount,gender:'M',terrain:'mountain',
  fatigue:30,seed:'v93-heterogeneous-20-M-mountain-30',
  defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
  managerTactics:Array.from({length:teamCount-1},(_,index)=>({
    effort:['hard','steady','conserve'][index%3],
    attack:index%3===0?'repeated':'selective',
    chase:index%3===1?'all':'selective'})),
  teamOverrides:[{teamId:'you',level:45},
    ...Array.from({length:teamCount-1},(_,index)=>({
      teamId:`rival-${index+1}`,level:index%2===0?25:65}))],
  managerFinaleOrders:[
    {teamId:'you',atKm:255,effort:'steady',chase:'all'},
    {teamId:'rival-1',atKm:255,effort:'hard'}]};
const {stage,weather,teams,seed}=prepareV91Playtest(settings);
const recording=simulateTacticalTour({stage,weather,teams,seed,
  motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
const clock=recordFinaleCoastMixedTwoFrontDroppedClock(recording);
const line=recordFinaleCoastedIndividualLine(recording,clock);
const pre=recordFinaleMixedTwoFrontDroppedMultifrontPre500Audit(
  recording,clock,line);
const final=recordFinaleMixedTwoFrontDroppedMultifrontFinal500Audit(
  recording,clock,line,pre);
const event=final.freshApproaches[0];
const source=new Map(line.positionedSource.roadBands.flatMap(group=>
  group.slots.map(slot=>[slot.riderId,{group:group.id,lane:slot.lane}])));
const runners=new Map(line.bandRunners.flatMap(band=>
  band.runner.frames.flatMap(frame=>frame.riders.map(row=>[
    row.riderId,{band:band.roadBandId,frames:band.runner.frames
      .filter(item=>item.riders.some(rider=>
        rider.riderId===row.riderId)).map(item=>({
          start:item.elapsedSecondsAtStart,duration:item.durationSeconds,
          ...item.riders.find(rider=>rider.riderId===row.riderId)}))}]))));
console.log(JSON.stringify({seed:settings.seed,
  preApproaches:pre.freshApproaches.length,
  finalApproaches:final.freshApproaches.length,
  event:{firstRiderId:event.firstRiderId,
    secondRiderId:event.secondRiderId,
    time:event.elapsedSecondsFromLastKmStart,
    firstWheelM:event.firstWheelM,secondWheelM:event.secondWheelM,
    firstEnergy:event.firstEnergy,secondEnergy:event.secondEnergy},
  riders:[event.firstRiderId,event.secondRiderId].map(id=>({
    id,source:source.get(id),runner:runners.get(id),
    outsidePre500:pre.outsideLaneAssignments.find(row=>
      row.riderId===id)??null})),
  conditionalCrossings:line.conditionalCrossings.length,
  pointsStatus:line.pointsStatus,
  classifiedResults:line.classifiedResults},null,2));
