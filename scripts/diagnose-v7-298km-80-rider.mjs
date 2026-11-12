// Synthetic capacity control for the 298 km / 80 rider Sunday race size.
// Riders, orders and weather are synthetic. The optional observed game
// stage profile is a read-only snapshot, not canonical geography.
import seedrandom from 'seedrandom';
import {readFileSync} from 'node:fs';
import {starterPack} from '../lib/onboarding/starter.mjs';
import {GAME_SNAPSHOT_PAID_VIEWER_VERSION} from
  '../lib/viewer/game-snapshot-paid-viewer-v1.mjs';
import {createGameSnapshotPositionRaceBundleV1} from
  '../lib/viewer/game-snapshot-position-viewer-v1.mjs';
import {replayPhysicalFirstPositionGeneralRaceV8} from
  '../lib/engine/v2/physical-first-position-general-race-v1.mjs';
import {encodeGameSnapshotPositionRaceArchiveV2} from
  '../lib/viewer/game-snapshot-position-archive-v2.mjs';

const distanceKm=298,teamCount=10;
const seed=process.argv[2]??'sunday-capacity-1';
const effort=process.argv[3]??'steady';
const routeSource=process.argv[4]??'flat';
const chase=process.argv[5]??'selective';
const attack=process.argv[6]??'none';
const frontWork=process.argv[7]??'rotate';
const conserveTeams=Number(process.argv[8]??0);
const attackTeams=Number(process.argv[9]??teamCount);
if(!/^[A-Za-z0-9-]{1,64}$/.test(seed))
  throw new Error('Supply a bounded synthetic seed.');
if(!['conserve','steady','hard'].includes(effort))
  throw new Error('Supply a valid explicit effort.');
if(!['flat','observed-sunday-20261111'].includes(routeSource))
  throw new Error('Supply a known synthetic test route.');
if(!['ignore','selective','all'].includes(chase)||
  !['none','selective','repeated'].includes(attack)||
  !['rotate','sit_in'].includes(frontWork))
  throw new Error('Supply valid explicit chase, attack and front-work orders.');
if(!Number.isInteger(conserveTeams)||conserveTeams<0||
  conserveTeams>teamCount)
  throw new Error('Supply zero to ten explicitly conserving teams.');
if(!Number.isInteger(attackTeams)||attackTeams<0||
  attackTeams>teamCount)
  throw new Error('Supply zero to ten explicitly attacking teams.');
const observedRoute=routeSource==='observed-sunday-20261111'?
  JSON.parse(readFileSync(new URL(
    './observed-sunday-stage-profile-20261111.json',import.meta.url),
  'utf8')):null;
if(observedRoute&&observedRoute.distance_km!==distanceKm)
  throw new Error('Observed route distance changed.');
const teams=Array.from({length:teamCount},(_,index)=>{
  const id=`synthetic-team-${index+1}`;
  const riders=starterPack(seedrandom(`${seed}:${id}`))
    .filter(row=>row.gender==='M')
    .map((row,riderIndex)=>({...row,
      id:`${id}-rider-${riderIndex+1}`,
      name:`Synthetic rider ${index+1}-${riderIndex+1}`}));
  if(riders.length!==8)throw new Error('Starter roster incomplete.');
  return {id,name:`Synthetic team ${index+1}`,riders,
    entry:{selected_riders:riders.map(row=>row.id),
      captain_id:riders[6].id}};
});
const snapshot={event:{id:'synthetic-sunday-capacity',
  kind:'one_day',gender:'M',seed,
  weather_locked:{temp_c:16,wind_kph:0,
    precipitation_mm:0}},
stage:{distance_km:distanceKm,
  profile_points:observedRoute?.profile_points??
    [[0,80],[distanceKm,80]],
  keypoints:observedRoute?.keypoints??[]},
teams,game_date:'2026-11-15'};
const manifest={version:GAME_SNAPSHOT_PAID_VIEWER_VERSION,
  eventId:snapshot.event.id,
  entries:teams.map((team,index)=>({
    teamId:team.id,
    orders:{version:2,captainId:team.entry.captain_id,
      roadCaptainId:team.riders[0].id,
      helperIds:team.riders.filter((_,riderIndex)=>
        riderIndex!==0&&riderIndex!==6)
        .map(row=>row.id),
      baseline:{effort:index<conserveTeams?'conserve':effort,
        attack:index<attackTeams?attack:'none',
        attackRiderId:attack==='none'||index>=attackTeams?
          null:team.riders[2].id,
        chase,
        frontWork,frontWorkRiderId:null}},
    stake:{sportingGoal:'sprint_finish',
      sportingCaptainId:team.entry.captain_id},
    riderNumbers:Object.fromEntries(team.riders.map(
      (row,riderIndex)=>[row.id,index*8+riderIndex+1])),
    style:{id:team.id,name:team.name,
      color:'#224466',accent:'#ffffff',
      pattern:'band'}}))};
const started=performance.now();
const bundle=createGameSnapshotPositionRaceBundleV1(
  snapshot,manifest);
const raceMs=performance.now()-started;
if(bundle.race.completedThroughKm!==distanceKm||
  bundle.race.decisionCount!==distanceKm*teamCount*8||
  bundle.race.finishCrossings.length!==teamCount*8)
  throw new Error('Synthetic Sunday-size V7 run is incomplete.');
replayPhysicalFirstPositionGeneralRaceV8(
  bundle.request,bundle.race);
const replayMs=performance.now()-started-raceMs;
const archive=encodeGameSnapshotPositionRaceArchiveV2(bundle);
const archiveMs=performance.now()-started-raceMs-replayMs;
console.log(JSON.stringify({
  fixture:'synthetic_sunday_capacity_only',
  seed,effort,routeSource,chase,attack,frontWork,
  conserveTeams,attackTeams,
  distanceKm,teams:teamCount,
  riders:teamCount*8,
  decisions:bundle.race.decisionCount,
  finishers:bundle.race.finishCrossings.length,
  attackDepartures:bundle.race.attackDepartureEvents.length,
  attackCapacityRefusals:bundle.race.attackCapacityRefusals.length,
  contactEvents:bundle.race.contactEvents.length,
  tieGroups:bundle.race.finaleFinishTieObservations.length,
  officialResults:bundle.race.officialResults,
  viewerFrames:bundle.document.feed.frames.length,
  viewerBytes:Buffer.byteLength(JSON.stringify(
    bundle.document)),
  archiveCompressedBytes:archive.metadata.compressedBytes,
  archiveUncompressedBytes:archive.metadata.uncompressedBytes,
  raceAndViewerMs:Math.round(raceMs),
  replayMs:Math.round(replayMs),
  archiveMs:Math.round(archiveMs),
  maxRssMb:Math.round(process.resourceUsage().maxRSS/1024)}));
