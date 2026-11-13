// Inspect the whole-race source and paid finale of a mixed-order refusal.
// Synthetic riders only; this never classifies a race or saves points.
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../lib/engine/v2/tuning.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_COAST_DISSOLVED_FRONT_LAST_KM_VERSION} from
  '../lib/engine/v2/finale-multi-run.mjs';
import {finaleSnapshotFromTour} from
  '../lib/engine/v2/finale-snapshot.mjs';

const patterns=[
  {effort:'hard',attack:'repeated',chase:'all'},
  {effort:'conserve',attack:'none',chase:'ignore'},
  {effort:'steady',attack:'selective',chase:'selective'}];
const rows=[];
const cases=[['rolling',0,1],['mountain',0,0],['mountain',0,1],
  ['mountain',30,0],['exposed',30,0]];
for(const gender of ['M','F'])for(const [terrain,fatigue,seedIndex] of cases){
  const settings={distanceKm:260,teamCount:4,gender,terrain,
    fatigue,seed:`v93-mixed-late-4-${gender}-${terrain}-${fatigue}-${
      seedIndex}`,
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',
    chase:'all',managerTactics:Array.from({length:3},(_,index)=>
      patterns[(index+seedIndex)%3]),managerFinaleOrders:[
      {teamId:'you',atKm:255,effort:seedIndex?'conserve':'hard'},
      {teamId:'rival-1',atKm:255,
        effort:seedIndex?'hard':'conserve'}]};
  const {stage,weather,teams,seed}=prepareV91Playtest(settings);
  const recording=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  const source=finaleSnapshotFromTour(recording,{remainingKm:1,
    includeAttackLoad:true});
  const trace=probeFinaleSeparatedGroupsFromTour(recording,{
    version:FINALE_COAST_DISSOLVED_FRONT_LAST_KM_VERSION});
  const leader=source.roadGroups[0];
  const passage=[];
  let bunch=0;
  const groupTime=new Map(source.roadGroups.map(group=>[
    group.id,-group.gapSeconds]));
  const soloTime=new Map(leader.riderIds.map(id=>[
    id,-leader.gapSeconds]));
  for(const frame of trace.frames){
    bunch+=frame.bunchElapsedSeconds;
    for(const group of frame.roadGroups)
      groupTime.set(group.id,groupTime.get(group.id)+group.elapsedSeconds);
    for(const rider of frame.droppedTravel.riders)
      if(soloTime.has(rider.riderId))
        soloTime.set(rider.riderId,
          soloTime.get(rider.riderId)+rider.elapsedSeconds);
    passage.push({distanceM:frame.endDistanceM,
      groups:frame.roadGroups.map(group=>({id:group.id,
        riders:group.riderIds.length,
        secondsFromBunch:groupTime.get(group.id)-bunch})),
      isolated:leader.riderIds.map(id=>({id,
        secondsFromBunch:soloTime.get(id)-bunch}))});
  }
  const encounters=[];
  for(const id of leader.riderIds)for(const group of source.roadGroups.slice(1)){
    let previous={distanceM:source.startDistanceM,
      gap:-leader.gapSeconds+group.gapSeconds};
    for(const frame of passage){
      const solo=frame.isolated.find(row=>row.id===id).secondsFromBunch;
      const groupTime=frame.groups.find(row=>row.id===group.id)
        ?.secondsFromBunch;
      if(groupTime===undefined)continue;
      const gap=solo-groupTime;
      if(previous.gap*gap<0)encounters.push({riderId:id,
        groupId:group.id,fromM:previous.distanceM,toM:frame.distanceM,
        beforeSeconds:previous.gap,afterSeconds:gap});
      previous={distanceM:frame.distanceM,gap};
    }
  }
  rows.push({seed:settings.seed,dropped:source.droppedRiderIds.length,
    source:source.roadGroups.map(group=>({
    id:group.id,gapSeconds:group.gapSeconds,riders:group.riderIds.length})),
  dissolution:trace.frames.flatMap(frame=>
    frame.frontGroupDissolutions.map(row=>({groupId:row.groupId,
      atDistanceM:row.atDistanceM}))),
  frontExits:trace.frames.flatMap(frame=>
    frame.frontExhaustionDrops.map(row=>({id:row.riderId,
      groupId:row.fromRoadGroupId,atDistanceM:row.atDistanceM}))),
  bunchExits:trace.frames.flatMap(frame=>frame.exhaustionDrops)
    .map(row=>({id:row.riderId,atDistanceM:row.atDistanceM})),
  encounters,first:passage[0],line:passage.at(-1)});
}
console.log(JSON.stringify(rows,null,2));
