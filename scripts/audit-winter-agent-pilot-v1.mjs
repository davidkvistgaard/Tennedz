// Read-only whole-race calibration. The uncommitted human team uses an
// explicitly synthetic conserve/rotation scenario, not the player's order.
import {readFileSync} from 'node:fs';
import {planWinterAgentTacticsV1} from
  '../lib/race/winter-agent-tactics-v1.mjs';
import {normalizeOrders} from '../lib/engine/v2/orders.mjs';
import {GAME_SNAPSHOT_PAID_VIEWER_VERSION} from
  '../lib/viewer/game-snapshot-paid-viewer-v1.mjs';
import {createGameSnapshotPositionRaceBundleV1} from
  '../lib/viewer/game-snapshot-position-viewer-v1.mjs';
import {replayPhysicalFirstPositionGeneralRaceV8} from
  '../lib/engine/v2/physical-first-position-general-race-v1.mjs';

const [snapshotPath,agentIdsPath]=process.argv.slice(2);
if(!snapshotPath||!agentIdsPath)
  throw new Error('Pass private read-only snapshot and agent ID files.');
const snapshot=JSON.parse(readFileSync(snapshotPath,'utf8'));
const agentIds=new Set(JSON.parse(readFileSync(agentIdsPath,'utf8')));
if(snapshot?.event?.id!==
  '109a9235-44e6-d390-1fa9-aec19b65cf3b'||
  snapshot.teams?.length!==10||agentIds.size!==9||
  snapshot.stage?.distance_km!==298)
  throw new Error('The Sunday calibration inputs changed.');
let agentPolicyCount=0;
const entries=snapshot.teams.map((team,index)=>{
  const riderIds=team.entry.selected_riders;
  let orders,stake,policy;
  if(agentIds.has(team.id)){
    const plan=planWinterAgentTacticsV1({entry:team.entry,
      riders:team.riders,stage:snapshot.stage});
    orders=plan.orders;stake=plan.stake;policy=plan.version;
  }else{
    const roadCaptainId=riderIds.find(id=>
      id!==team.entry.captain_id);
    orders={version:2,captainId:team.entry.captain_id,
      roadCaptainId,
      helperIds:riderIds.filter(id=>
        id!==team.entry.captain_id&&id!==roadCaptainId),
      baseline:{effort:'conserve',attack:'none',
        chase:'selective',frontWork:'rotate'},
      phases:[]};
    stake={sportingGoal:'none',
      sportingCaptainId:team.entry.captain_id};
    policy='synthetic-human-calibration-only';
  }
  if(policy==='winter-agent-tactics-v1')agentPolicyCount++;
  return {teamId:team.id,
    orders:normalizeOrders(orders,{riderIds,
      distanceKm:snapshot.stage.distance_km,
      keypoints:snapshot.stage.keypoints,
      allowFrontWork:true,allowNamedFrontWorker:true}),stake,
    riderNumbers:Object.fromEntries(riderIds.map((id,i)=>
      [id,index*8+i+1])),
    style:{id:team.id,name:team.name,color:'#224466',
      accent:'#ffffff',pattern:'band'}};
});
if(agentPolicyCount!==9)throw new Error('Expected nine agent policies.');
const start=performance.now();
const bundle=createGameSnapshotPositionRaceBundleV1(snapshot,{
  version:GAME_SNAPSHOT_PAID_VIEWER_VERSION,
  eventId:snapshot.event.id,entries});
const raceMs=Math.round(performance.now()-start);
if(bundle.race.completedThroughKm!==298||
  bundle.race.decisionCount!==23840||
  bundle.race.finishCrossings.length!==80)
  throw new Error('The calibrated race did not finish completely.');
replayPhysicalFirstPositionGeneralRaceV8(bundle.request,bundle.race);
console.log(JSON.stringify({fixture:'read_only_sunday_20261112',
  agentPolicies:9,humanInput:'synthetic-conserve-rotation',
  km:bundle.race.completedThroughKm,
  decisions:bundle.race.decisionCount,
  finishCrossings:bundle.race.finishCrossings.length,
  contacts:bundle.race.contactEvents.length,
  attackDepartures:bundle.race.attackDepartureEvents.length,
  unresolvedFinishTies:
    bundle.race.finaleFinishTieObservations.length,
  officialResults:bundle.race.officialResults,
  viewerFrames:bundle.document.feed.frames.length,
  raceMs,replayMs:Math.round(performance.now()-start-raceMs)}));
