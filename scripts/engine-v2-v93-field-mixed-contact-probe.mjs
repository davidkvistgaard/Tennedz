// Paid whole-race witness for a long-field mixed-tactic contact refusal.
// Synthetic riders only; no classification or award is saved.
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../lib/engine/v2/tuning.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION} from
  '../lib/engine/v2/finale-multi-run.mjs';
import {finaleSnapshotFromTour} from
  '../lib/engine/v2/finale-snapshot.mjs';
import {createV93PlayableTest} from
  '../lib/engine/v2/playtest-v93-coasted.mjs';
import {recordFinaleCoastMixedThreeFrontDroppedClock,
  recordFinaleCoastMixedThreeFrontPre500PassClock} from
  '../lib/engine/v2/finale-separated-last-km.mjs';
import {auditDissolvedFrontPaidContact} from
  '../lib/engine/v2/finale-dissolved-front-paid-contact.mjs';

const teamCount=Number(process.argv[2]??15);
const gender=process.argv[3]??'M';
const terrain=process.argv[4]??'flat';
const mode=process.argv[5]??'field-mixed';
const seedIndex=Number(process.argv[6]??2);
const fatigue=30,distanceKm=260;
const settings={distanceKm,teamCount,gender,terrain,fatigue,
  seed:`v93-next-contact-${mode}-${teamCount}-${gender}-${terrain}-${
    fatigue}-${seedIndex}`,
  defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
  managerTactics:Array.from({length:teamCount-1},(_,index)=>({
    effort:['hard','conserve','steady'][(index+seedIndex)%3],
    attack:index%3===1?'selective':'repeated',
    chase:index%3===1?'ignore':'all'})),
  managerFinaleOrders:[
    {teamId:'you',atKm:255,effort:'conserve'},
    {teamId:'rival-1',atKm:255,effort:'hard'}]};
const {stage,weather,teams,seed}=prepareV91Playtest(settings);
const recording=simulateTacticalTour({stage,weather,teams,seed,
  motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
const source=finaleSnapshotFromTour(recording,{remainingKm:1,
  includeAttackLoad:true});
const trace=probeFinaleSeparatedGroupsFromTour(recording,{
  version:FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION});
const paidContact=auditDissolvedFrontPaidContact(trace);
let refusal=null;
let playable=null;
try{
  const race=createV93PlayableTest(settings);
  playable={version:race.version,
    crossings:race.individualLine.conditionalCrossings.length,
    pointsStatus:race.pointsStatus};
}
catch(error){refusal={message:error.message,
  reason:error.roadPreview?.unsupportedReason??null};}
let candidate=null;
try{candidate=recordFinaleCoastMixedThreeFrontDroppedClock(recording)
  .line.outcome;}
catch(error){candidate=error.message;}
let pre500Candidate=null;
try{
  const clock=recordFinaleCoastMixedThreeFrontPre500PassClock(recording);
  pre500Candidate={version:clock.version,outcome:clock.line.outcome,
    bandSizes:clock.line.bands.map(row=>row.riderIds.length),
    passes:clock.frontPasses.length};
}catch(error){pre500Candidate=error.message;}
const groupTimes=new Map(source.roadGroups.map(group=>[
  group.id,-group.gapSeconds]));
const sourceRows=new Map(recording.frames[source.sourceKm-1]
  .riderGroups.map(row=>[row.id,row]));
const isolatedTimes=new Map(source.droppedRiderIds.map(id=>[
  id,sourceRows.get(id)?.deficitSeconds]));
let bunchTime=0;
const passages=[];
for(const frame of trace.frames){
  const oldBunchTime=bunchTime;
  bunchTime+=frame.bunchElapsedSeconds;
  for(const row of frame.frontExhaustionDrops)
    isolatedTimes.set(row.riderId,oldBunchTime+row.initialDeficitSeconds);
  for(const row of frame.exhaustionDrops)
    isolatedTimes.set(row.riderId,oldBunchTime);
  for(const group of frame.roadGroups)
    groupTimes.set(group.id,groupTimes.get(group.id)+group.elapsedSeconds);
  const isolated=frame.droppedTravel.riders.map(row=>{
    const time=isolatedTimes.get(row.riderId)+row.elapsedSeconds;
    isolatedTimes.set(row.riderId,time);
    return {id:row.riderId,secondsFromBunch:+(time-bunchTime).toFixed(3),
      contactM:row.contactDistanceM,
      contactStatus:row.contactStatus};
  });
  passages.push({distanceM:frame.endDistanceM,
    groups:frame.roadGroups.map(group=>({id:group.id,
      count:group.riderIds.length,
      secondsFromBunch:+(groupTimes.get(group.id)-bunchTime).toFixed(3)})),
    bunchSeconds:+bunchTime.toFixed(3),
    isolated,
    frontExits:frame.frontExhaustionDrops.map(row=>({id:row.riderId,
      from:row.fromRoadGroupId})),
    bunchExits:frame.exhaustionDrops.map(row=>row.riderId)});
}
// A marker-order reversal is a contact candidate, not a paid rider pass.
const possibleFrontOverlaps=[];
for(let index=1;index<passages.length;index++){
  const before=passages[index-1],after=passages[index];
  const beforeSecond=before.groups[1]?.secondsFromBunch;
  const afterSecond=after.groups[1]?.secondsFromBunch;
  if(beforeSecond===undefined||afterSecond===undefined)continue;
  for(const rider of after.isolated){
    const earlier=before.isolated.find(row=>row.id===rider.id);
    if(!earlier)continue;
    const priorGap=earlier.secondsFromBunch-beforeSecond;
    const nextGap=rider.secondsFromBunch-afterSecond;
    if(priorGap>=0||nextGap<=0)continue;
    possibleFrontOverlaps.push({riderId:rider.id,frontId:after.groups[1].id,
      betweenM:[before.distanceM,after.distanceM],
      interpolatedM:+(before.distanceM+
        (after.distanceM-before.distanceM)*
        -priorGap/(nextGap-priorGap)).toFixed(3)});
  }
}
console.log(JSON.stringify({seed:settings.seed,refusal,playable,candidate,
  pre500Candidate,
  sourceGroups:source.roadGroups.map(group=>({id:group.id,
    count:group.riderIds.length,gapSeconds:group.gapSeconds})),
  priorDropped:source.droppedRiderIds.length,possibleFrontOverlaps,
  paidSplits:paidContact.encounters.map(row=>({riderId:row.riderId,
    activeBandId:row.activeBandId,distanceM:row.distanceM,
    energyAtContact:row.split.solo.energyAtContact,
    contactResolved:paidContact.contactResolved})),
  passages},null,2));
