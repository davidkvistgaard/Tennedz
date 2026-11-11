// Explicit large, synthetic game-shaped archive check. No database writes.
import seedrandom from 'seedrandom';
import {isDeepStrictEqual} from 'node:util';
import {starterPack} from '../lib/onboarding/starter.mjs';
import {GAME_SNAPSHOT_PAID_VIEWER_VERSION} from
  '../lib/viewer/game-snapshot-paid-viewer-v1.mjs';
import {createGameSnapshotPositionRaceBundleV1} from
  '../lib/viewer/game-snapshot-position-viewer-v1.mjs';
import {encodeGameSnapshotPositionRaceArchiveV2,
  decodeGameSnapshotPositionRaceArchiveV2} from
  '../lib/viewer/game-snapshot-position-archive-v2.mjs';

const category=process.argv[2]??'men';
const profile=process.argv[3]??'flat';
if(!['men','women'].includes(category))
  throw new Error('Choose a valid category.');
if(!['flat','hill_then_mountain'].includes(profile))
  throw new Error('Choose a valid route profile.');
const gender=category==='men'?'M':'F';
const event={id:`synthetic-starter-archive-${category}`,
  kind:'one_day',gender,seed:`starter-archive-${category}`,
  weather_locked:{temp_c:16,wind_kph:0,
    precipitation_mm:0}};
const teams=Array.from({length:15},(_,index)=>{
  const id=`team-${index}`;
  const riders=starterPack(seedrandom(
    `archive-starter-control:${category}:${index}`))
    .filter(row=>row.gender===gender)
    .map((row,riderIndex)=>({
      ...row,id:`${id}-${riderIndex+1}`}));
  return {id,name:`Synthetic team ${index+1}`,
    riders,entry:{selected_riders:riders.map(row=>
      row.id),captain_id:riders[6].id}};
});
const snapshot={event,
  stage:{distance_km:120,
    profile_points:profile==='flat'?[[0,100],[120,100]]:
      Array.from({length:121},(_,km)=>[km,
        km<=1?100:km<=5?
          100+(km-1)*37.5:250+(km-5)*65]),
    keypoints:[]},
  teams,game_date:'2026-11-09'};
const manifest={version:GAME_SNAPSHOT_PAID_VIEWER_VERSION,
  eventId:event.id,
  entries:teams.map((team,index)=>({
    teamId:team.id,
    orders:{version:2,
      captainId:team.riders[6].id,
      roadCaptainId:team.riders[0].id,
      helperIds:[1,2,3,4,5,7]
        .map(n=>team.riders[n].id),
      baseline:{effort:'steady',attack:'none',
        chase:'selective',
        frontWork:index===0?'rotate':'sit_in',
        frontWorkRiderId:index===0?
          team.riders[1].id:null}},
    stake:{sportingGoal:'sprint_finish',
      sportingCaptainId:team.riders[6].id},
    riderNumbers:Object.fromEntries(team.riders
      .map((rider,riderIndex)=>
        [rider.id,index*8+riderIndex+1])),
    style:{id:team.id,name:team.name,
      color:index?'#226688':'#aa4433',
      accent:'#ffffff',pattern:'band'}}))};
const started=Date.now();
const bundle=createGameSnapshotPositionRaceBundleV1(
  snapshot,manifest);
const archive=encodeGameSnapshotPositionRaceArchiveV2(
  bundle);
const restored=decodeGameSnapshotPositionRaceArchiveV2(
  archive);
function firstDifference(a,b,path='$'){
  // JSON archives canonically write -0 as 0; a starter appearance value
  // can be -0 without changing any motor or viewer field.
  if(a===b||Number.isNaN(a)&&Number.isNaN(b))return null;
  if(a===null||b===null||
    typeof a!=='object'||typeof b!=='object')
    return {path,original:a,restored:b};
  const keysA=Object.keys(a),keysB=Object.keys(b);
  if(!isDeepStrictEqual(keysA.sort(),keysB.sort()))
    return {path,originalKeys:keysA,
      restoredKeys:keysB};
  for(const key of keysA){
    const difference=firstDifference(a[key],b[key],
      `${path}.${key}`);
    if(difference)return difference;
  }
  return null;
}
const difference=firstDifference(bundle,restored);
if(difference)
  throw new Error(`Starter archive changed the motor bundle: ${JSON.stringify({
    decisions:bundle.race.decisionCount,
    finishers:bundle.race.finishCrossings.length,
    contacts:bundle.race.contactEvents.length,
    restoredContacts:restored.race.contactEvents.length,
    firstDifference:difference,
  })}`);
if(bundle.race.decisionCount!==14_400||
  bundle.race.finishCrossings.length!==120)
  throw new Error('Starter race did not cover every rider and kilometre.');
console.log(JSON.stringify({
  version:'v7-starter-archive-control-1',
  source:'synthetic_game_shaped_starter_profiles',
  category,elapsedMs:Date.now()-started,
  profile,
  decisions:bundle.race.decisionCount,
  finishers:bundle.race.finishCrossings.length,
  contactEvents:bundle.race.contactEvents.length,
  finaleFrames:bundle.race.tail.positionFrames.length,
  rawBundleBytes:Buffer.byteLength(
    JSON.stringify(bundle)),
  archiveUncompressedBytes:
    archive.metadata.uncompressedBytes,
  archiveCompressedBytes:
    archive.metadata.compressedBytes,
  viewerDocumentBytes:Buffer.byteLength(
    JSON.stringify(bundle.document)),
  archiveSha256:archive.metadata.compressedSha256,
  replayVerified:true,
  officialResults:bundle.race.officialResults,
}));
