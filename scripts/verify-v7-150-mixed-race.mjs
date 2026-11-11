// Whole-race synthetic stress case. This does not set official awards or
// change game rider data; it only verifies the recorded V7 motor path.
import {prepareSyntheticPositionCatchV1} from
  '../tests/unit/synthetic-position-catch-fixture-v1.mjs';
import {recordPhysicalFirstPositionGeneralRaceV7,
  replayPhysicalFirstPositionGeneralRaceV7} from
  '../lib/engine/v2/physical-first-position-general-race-v1.mjs';
import {adaptPhysicalFirstPositionRaceV3} from
  '../lib/viewer/physical-first-position-adapter-v1.mjs';

const category=process.argv[2]??'men';
const seed=process.argv[3]??
  `v7-mixed-150-${category}-1`;
if(!['men','women'].includes(category)||
  !/^[A-Za-z0-9-]{1,64}$/.test(seed))
  throw new Error('Supply a category and bounded seed.');
const request=prepareSyntheticPositionCatchV1({
  teamCount:19,riderCount:150,kmCount:120,
  profile:'hill_then_mountain',
  weakBunchCount:2,oneTimeAttack:true,
  secondAttackAtKm:5,frontWorkerAtKm:2,
  raceSeed:seed});
request.input.positionPassingCorridorCount=1;
// The synthetic test input has terrain classes, not recorded elevation.
// A flat display profile is explicitly a test fixture, never geography.
for(const segment of request.input.kilometres){
  segment.startM=0;
  segment.endM=0;
}
for(const team of request.input.teams){
  for(const rider of team.riders){
    rider.gender=category==='women'?'F':'M';
    rider.name=`Synthetic rider ${rider.id}`;
  }
}
for(const stake of request.input.stakes.slice(1))
  stake.sportingGoal='sprint_finish';

const started=Date.now();
const race=recordPhysicalFirstPositionGeneralRaceV7(
  request);
if(race.completedThroughKm!==120||
  race.riderCount!==150||
  race.decisionCount!==18_000||
  race.checkpointCrossings.length!==17_850||
  race.finishCrossings.length!==150||
  race.tail.positionFrames.some(frame=>
    frame.positions.length!==150))
  throw new Error('The 150-rider V7 stress race is incomplete.');
replayPhysicalFirstPositionGeneralRaceV7(request,race);
const finaleProjectionLowerBoundBytes=Buffer.byteLength(
  JSON.stringify(race.tail.positionFrames.map(frame=>({
    time:frame.clockSeconds,
    positions:frame.positions.map(row=>({
      riderId:row.riderId,distance:row.distanceM,
      lateral:0,groupId:row.roadId})),
  }))));
const riderNumbers=Object.fromEntries(request.input.teams
  .flatMap(team=>team.riders)
  .map((rider,index)=>[rider.id,index+1]));
const teamStyles=request.input.teams.map(team=>({
  id:team.id,name:team.id,color:'#226688',
  accent:'#ffffff',pattern:'band'}));
const viewerProjection=adaptPhysicalFirstPositionRaceV3({
  request,race,category,teamStyles,riderNumbers,
  raceId:`synthetic-${seed}`,
  fixtureKind:'synthetic_motor_lab'});
const {feed,coverage}=viewerProjection;
const viewerProjectionBytes=Buffer.byteLength(
  JSON.stringify(viewerProjection));
const motorRecordBytes=Buffer.byteLength(JSON.stringify({
  request,race}));
const recordedFinale=race.tail.positionFrames.slice(1);
const recordedFinaleTimes=new Set(recordedFinale.map(row=>
  row.clockSeconds));
const displayedFinaleTimes=new Set(feed.frames.slice(
  coverage.recordedBoundaryFrames).map(frame=>frame.time));
if([...displayedFinaleTimes].some(time=>
  !recordedFinaleTimes.has(time))||
  race.finishCrossings.some(crossing=>{
    const milestone=recordedFinale.find(row=>
      row.clockSeconds>=crossing.clockSeconds);
    return !milestone||
      !displayedFinaleTimes.has(milestone.clockSeconds);
  }))
  throw new Error('The 150-rider display lost a recorded finish milestone.');
if(feed.frames.some(frame=>frame.positions.length!==150)||
  coverage.viewerFeedBytes>3_500_000||
  viewerProjectionBytes>4_200_000||
  motorRecordBytes+viewerProjectionBytes>=
    64*1024*1024||
  feed.frames.at(-1).time!==feed.duration)
  throw new Error('The bounded 150-rider display feed is incomplete.');
console.log(JSON.stringify({
  version:'v7-mixed-150-whole-race-check-1',
  source:'synthetic_control',category,seed,
  elapsedMs:Date.now()-started,
  kilometres:race.completedThroughKm,
  decisions:race.decisionCount,
  checkpointCrossings:race.checkpointCrossings.length,
  finishers:race.finishCrossings.length,
  attackDepartures:race.attackDepartureEvents.length,
  paidContactEvents:race.contactEvents.length,
  paidSprintPasses:race.finaleSprintPassEvents.length,
  finaleFrames:race.tail.positionFrames.length,
  finaleProjectionLowerBoundBytes,
  viewerFeedBytes:coverage.viewerFeedBytes,
  viewerProjectionBytes,
  motorRecordBytes,
  renderedFinaleFrames:coverage.renderedFinaleFrames,
  exactFinalePositionSamples:
    coverage.exactFinalePositionSamples,
  finishTieGroups:race.finaleFinishTieObservations.length,
  replayVerified:true,officialResults:race.officialResults,
}));
