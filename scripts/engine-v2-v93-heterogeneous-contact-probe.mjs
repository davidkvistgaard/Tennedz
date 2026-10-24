// Read-only whole-race witness for unequal-strength field refusals.
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from '../lib/engine/v2/tuning.mjs';
import {probeFinaleSeparatedGroupsFromTour,FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION} from '../lib/engine/v2/finale-multi-run.mjs';
import {finaleSnapshotFromTour} from '../lib/engine/v2/finale-snapshot.mjs';
import {auditDissolvedFrontPaidContact} from '../lib/engine/v2/finale-dissolved-front-paid-contact.mjs';
import {createV93PlayableTest} from '../lib/engine/v2/playtest-v93-coasted.mjs';
import {recordFinaleCoastMixedTwoFrontDroppedClock} from
  '../lib/engine/v2/finale-separated-last-km.mjs';

const teamCount=Number(process.argv[2]??4);
const gender=process.argv[3]??'M';
const terrain=process.argv[4]??'flat';
const fatigue=Number(process.argv[5]??30);
const settings={distanceKm:260,teamCount,gender,terrain,fatigue,
  seed:`v93-heterogeneous-${teamCount}-${gender}-${terrain}-${fatigue}`,
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
const source=finaleSnapshotFromTour(recording,{remainingKm:1,
  includeAttackLoad:true});
const trace=probeFinaleSeparatedGroupsFromTour(recording,{
  version:FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION});
const contact=auditDissolvedFrontPaidContact(trace);
let candidate;
try{const clock=recordFinaleCoastMixedTwoFrontDroppedClock(recording);
  candidate={version:clock.version,outcome:clock.line.outcome,
    bands:clock.line.bands.map(row=>({id:row.id,
      count:row.riderIds.length}))};}
catch(error){candidate={reason:error.message};}
const groupTimes=new Map(source.roadGroups.map(row=>[row.id,
  -row.gapSeconds]));
const sourceRows=new Map(recording.frames[source.sourceKm-1]
  .riderGroups.map(row=>[row.id,row]));
const droppedTimes=new Map(source.droppedRiderIds.map(id=>[
  id,sourceRows.get(id)?.deficitSeconds]));
let bunchTime=0;
const markerOrder=trace.frames.map(frame=>{
  const oldBunchTime=bunchTime;
  bunchTime+=frame.bunchElapsedSeconds;
  for(const row of frame.frontExhaustionDrops)
    droppedTimes.set(row.riderId,
      oldBunchTime+row.initialDeficitSeconds);
  for(const row of frame.exhaustionDrops)
    droppedTimes.set(row.riderId,oldBunchTime);
  for(const group of frame.roadGroups)
    groupTimes.set(group.id,groupTimes.get(group.id)+group.elapsedSeconds);
  for(const rider of frame.droppedTravel.riders)
    droppedTimes.set(rider.riderId,
      droppedTimes.get(rider.riderId)+rider.elapsedSeconds);
  const isolated=[...droppedTimes].sort((a,b)=>a[1]-b[1]);
  return {distanceM:frame.endDistanceM,
    groups:[...groupTimes].map(([id,time])=>({id,
      secondsFromBunch:time-bunchTime})),
    isolated:isolated.map(([id,time])=>({id,
      secondsFromBunch:time-bunchTime}))};
});
let playable;
try{const race=createV93PlayableTest(settings);
  playable={version:race.version,
    crossings:race.individualLine?.conditionalCrossings.length};}
catch(error){playable={reason:error.roadPreview?.unsupportedReason??
  error.message};}
console.log(JSON.stringify({seed:settings.seed,playable,candidate,
  sourceGroups:source.roadGroups.map(row=>({id:row.id,
    count:row.riderIds.length,gapSeconds:row.gapSeconds})),
  priorDropped:source.droppedRiderIds.length,
  trace:trace.frames.map(row=>({distanceM:row.endDistanceM,
    groups:row.roadGroups.map(group=>({id:group.id,
      count:group.riderIds.length})),
    frontExits:row.frontExhaustionDrops.map(exit=>({id:exit.riderId,
      from:exit.fromRoadGroupId})),
    bunchExits:row.exhaustionDrops.map(exit=>exit.riderId),
    isolated:row.droppedTravel.riders.map(rider=>({id:rider.riderId,
      contactM:rider.contactDistanceM,
      status:rider.contactStatus}))})),
  paidMarkerEncounters:contact.encounters.map(row=>({rider:row.riderId,
    band:row.activeBandId,distanceM:row.distanceM})),
  markerOrder},null,2));
