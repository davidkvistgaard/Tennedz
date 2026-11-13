// Inspect a whole-race four-team road whose final groups cross without contact.
// Synthetic riders only; no result or official award is saved.
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from '../lib/engine/v2/tuning.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION} from
  '../lib/engine/v2/finale-multi-run.mjs';
import {finaleSnapshotFromTour} from '../lib/engine/v2/finale-snapshot.mjs';
import {recordFinaleCoastMixedFrontClearClock} from
  '../lib/engine/v2/finale-separated-last-km.mjs';

const gender=process.argv[2]??'M';
const terrain=process.argv[3]??'flat';
const fatigue=Number(process.argv[4]??0);
const seedIndex=Number(process.argv[5]??2);
const seed=`v93-next-contact-four-mixed-4-${gender}-${terrain}-${
  fatigue}-${seedIndex}`;
const settings={distanceKm:260,teamCount:4,gender,terrain,fatigue,seed,
  defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
  managerTactics:Array.from({length:3},(_,index)=>({
    effort:['hard','conserve','steady'][(index+seedIndex)%3],
    attack:index%3===1?'selective':'repeated',
    chase:index%3===1?'ignore':'all'})),managerFinaleOrders:[
    {teamId:'you',atKm:255,effort:seedIndex?'conserve':'hard'},
    {teamId:'rival-1',atKm:255,
      effort:seedIndex?'hard':'conserve'}]};
const {stage,weather,teams,seed:raceSeed}=prepareV91Playtest(settings);
const recording=simulateTacticalTour({stage,weather,teams,seed:raceSeed,
  motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
const source=finaleSnapshotFromTour(recording,{remainingKm:1,
  includeAttackLoad:true});
const trace=probeFinaleSeparatedGroupsFromTour(recording,{
  version:FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION});
let continuation;
try{continuation=recordFinaleCoastMixedFrontClearClock(recording)
  .line.outcome;}
catch(error){continuation=error.message;}
const groupTime=new Map(source.roadGroups.map(group=>[
  group.id,-group.gapSeconds]));
const droppedTime=new Map();
let bunchTime=0;
const passages=[{distanceM:source.startDistanceM,
  groups:source.roadGroups.map(group=>({id:group.id,
    secondsFromBunch:-group.gapSeconds})),bunchSeconds:0}];
for(const frame of trace.frames){
  const startBunchTime=bunchTime;
  bunchTime+=frame.bunchElapsedSeconds;
  for(const row of frame.frontExhaustionDrops)
    droppedTime.set(row.riderId,
      startBunchTime+row.initialDeficitSeconds);
  for(const row of frame.exhaustionDrops)
    droppedTime.set(row.riderId,startBunchTime);
  for(const group of frame.roadGroups)
    groupTime.set(group.id,groupTime.get(group.id)+group.elapsedSeconds);
  const isolated=frame.droppedTravel.riders.map(row=>{
    const time=droppedTime.get(row.riderId)+row.elapsedSeconds;
    droppedTime.set(row.riderId,time);
    return {riderId:row.riderId,secondsFromBunch:time-bunchTime,
      contactDistanceM:row.contactDistanceM,
      contactStatus:row.contactStatus};
  });
  passages.push({distanceM:frame.endDistanceM,
    groups:frame.roadGroups.map(group=>({id:group.id,
      riderIds:group.riderIds,
      secondsFromBunch:groupTime.get(group.id)-bunchTime})),
    bunchSeconds:bunchTime,
    isolated,
    frontExits:frame.frontExhaustionDrops.map(row=>({
      riderId:row.riderId,fromRoadGroupId:row.fromRoadGroupId})),
    bunchExits:frame.exhaustionDrops.map(row=>row.riderId)});
}
const contacts=[];
for(let index=1;index<passages.length;index++){
  const before=passages[index-1],after=passages[index];
  for(let a=0;a<after.groups.length;a++)
    for(let b=a+1;b<after.groups.length;b++){
      const left=after.groups[a].id,right=after.groups[b].id;
      const oldLeft=before.groups.find(group=>group.id===left);
      const oldRight=before.groups.find(group=>group.id===right);
      if(!oldLeft||!oldRight)continue;
      const oldGap=oldLeft.secondsFromBunch-oldRight.secondsFromBunch;
      const newGap=after.groups[a].secondsFromBunch-
        after.groups[b].secondsFromBunch;
      if(oldGap*newGap<0)contacts.push({left,right,
        fromM:before.distanceM,toM:after.distanceM,oldGap,newGap,
        atM:before.distanceM+(after.distanceM-before.distanceM)*
          -oldGap/(newGap-oldGap)});
    }
}
console.log(JSON.stringify({seed,continuation,
  sourceGroups:source.roadGroups.map(group=>({
  id:group.id,riderIds:group.riderIds,gapSeconds:group.gapSeconds})),
  priorDropped:source.droppedRiderIds,traceVersion:trace.version,
  passages,contacts},null,2));
