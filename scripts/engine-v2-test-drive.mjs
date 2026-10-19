// Offline v91 motor test drive. It reads fictional settings and never saves a
// result, awards points, or calls the production game/database path.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createV91Playtest,prepareV91Playtest} from
  '../lib/engine/v2/playtest.mjs';
import {finaleSnapshotFromTour} from
  '../lib/engine/v2/finale-snapshot.mjs';
import {createV91ConditionalRaceFinal,
  validateV91ConditionalRaceFinal} from
  '../lib/engine/v2/playtest-race-final.mjs';

const REFUSALS=new Set([
  'The inactive-intents bunch has an unresolved road action.',
  'The cooperative group has an unresolved last-kilometre road action.',
  'Finisher and lead-out plans are not paid for a road group.',
  'Finisher and lead-out plans are not paid for road groups.',
  'The separated last-kilometre finale needs recorded response or front rotation.',
  'An early bunch plan needs one inactive-attack bunch.',
]);

function requestFor(scenario){
  const settings=scenario?.settings;
  const {teams}=prepareV91Playtest(settings);
  const overrides=scenario?.finalePlans??[];
  if(!Array.isArray(overrides)||overrides.some(row=>!row||
    typeof row!=='object'||Array.isArray(row)||
    Object.keys(row).some(key=>
      !['teamId','finisherId','leadOutRiderId'].includes(key))||
    !teams.some(team=>team.id===row.teamId))||
    new Set(overrides.map(row=>row.teamId)).size!==overrides.length)
    throw new Error('Choose at most one finale override per known manager.');
  const request={};
  if(scenario?.attack!==undefined){
    if(!scenario.attack||typeof scenario.attack!=='object'||
      Array.isArray(scenario.attack)||
      Object.keys(scenario.attack).sort().join(',')!=='riderId,teamId')
      throw new Error('Choose one named team and rider attack.');
    request.attackTeamId=scenario.attack.teamId;
    request.attackRiderId=scenario.attack.riderId;
  }
  if(overrides.length){
    const byTeam=new Map(overrides.map(row=>[row.teamId,row]));
    request.plans=teams.map(team=>({teamId:team.id,
      finisherId:byTeam.get(team.id)?.finisherId??team.orders.captainId,
      leadOutRiderId:byTeam.get(team.id)?.leadOutRiderId??null}));
  }
  return request;
}

function summaryFor(trial,request){
  const {recording,paidFinale}=trial;
  const lastKm=recording.frames[recording.route.distanceKm-2];
  const allTeams=recording.committedInputs.teams;
  const decisions=allTeams.map(team=>({teamId:team.id,
    baseline:team.orders.baseline,
    finisherId:trial.finalePlans?.find(row=>row.teamId===team.id)
      ?.finisherId??null,
    leadOutRiderId:trial.finalePlans?.find(row=>row.teamId===team.id)
      ?.leadOutRiderId??null}));
  return {version:'v91-offline-test-drive-1',
    input:trial.settings,request,engineVersion:trial.version,
    roadStatus:trial.roadStatus,
    resultStatus:trial.classifiedResults===null?'unclassified':'classified',
    pointsStatus:trial.pointsStatus,canCommitAwards:trial.canCommitAwards,
    managerDecisions:decisions,
    lastKmSource:{roadGroups:lastKm.roadGroups.map(group=>({
      id:group.id,gapSeconds:group.gapSeconds,
      riderIds:group.riderIds})),
    droppedRiderIds:lastKm.riderGroups.filter(row=>
      row.group==='dropped').map(row=>row.id),
    chaserTeamIds:lastKm.chasers},
    finale:trial.roadStatus==='paid_group_bands'?{
      outcome:paidFinale.line.outcome,
      roadFrames:paidFinale.roadFrames.map(frame=>({
        elapsedSecondsFromBunchMarker:frame.elapsedSecondsFromBunchMarker,
        bunchPositionM:frame.bunchPositionM,
        frontPositionM:frame.frontPositionM,contact:frame.contact})),
      finalRiderEnergy:paidFinale.line.finalRiderEnergy,
      roadPlaceBounds:trial.roadPlaceBounds,
      individualFinishStatus:'unresolved_within_road_bands'}:
      trial.roadStatus==='paid_separated_bands'?{
        outcome:paidFinale.line.outcome,
        passageFrames:paidFinale.passageFrames,
        bands:paidFinale.line.bands,
        finalRiderEnergy:paidFinale.line.finalRiderEnergy,
        individualFinishStatus:'unresolved_within_road_bands'}:{
      individualFinishStatus:'conditional_inferred_wheels',
      lineTimes:paidFinale.finishers,
      leadOutWork:paidFinale.frames.flatMap(frame=>frame.riders.filter(
        row=>row.role?.startsWith('lead_out')).map(row=>({
          riderId:row.riderId,role:row.role,
          energySpent:row.energySpent,
          distanceTravelledM:row.distanceTravelledM}))),
    }};
}

export function runV91TestDrive(scenario,{full=false}={}){
  if(!scenario||typeof scenario!=='object'||Array.isArray(scenario)||
    Object.keys(scenario).some(key=>
      !['settings','attack','finalePlans'].includes(key)))
    throw new Error('Choose settings, an optional attack and finale plans.');
  const request=requestFor(scenario);
  let trial;
  try{trial=createV91ConditionalRaceFinal(scenario.settings,request);}
  catch(error){
    if(!REFUSALS.has(error.message))throw error;
    const source=request.attackTeamId===undefined?
      createV91Playtest(scenario.settings):null;
    const snapshot=source?finaleSnapshotFromTour(source.recording,{
      remainingKm:1,includeAttackLoad:true}):null;
    return {version:'v91-offline-test-drive-1',status:'unsupported',
      input:prepareV91Playtest(scenario.settings).settings,
      request,reason:error.message,
      ...(snapshot?{lastKmSource:{
        roadGroups:snapshot.roadGroups.map(group=>({
          id:group.id,gapSeconds:group.gapSeconds,
          riderIds:group.riderIds})),
        droppedRiderIds:snapshot.droppedRiderIds,
        chaserTeamIds:source.recording.frames[snapshot.sourceKm-1].chasers
      }}:{}),pointsStatus:'withheld',
      canCommitAwards:false};
  }
  validateV91ConditionalRaceFinal(scenario.settings,request,trial);
  if(!['paid_conditional_line','paid_group_bands','paid_separated_bands']
    .includes(trial.roadStatus)){
    const summary={version:'v91-offline-test-drive-1',
      status:'unsupported',input:trial.settings,request,
      engineVersion:trial.version,reason:trial.roadStatus,
      pointsStatus:'withheld',canCommitAwards:false};
    return full?{summary,recording:trial}:summary;
  }
  const summary=summaryFor(trial,request);
  return full?{summary,recording:trial}:summary;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(
  resolve(process.argv[1])).href){
  const [path,flag]=process.argv.slice(2);
  if(!path||flag!==undefined&&flag!=='--full')
    throw new Error('Usage: node scripts/engine-v2-test-drive.mjs input.json [--full]');
  const raw=readFileSync(path==='-'?0:path,'utf8').replace(/^\uFEFF/,'');
  const result=runV91TestDrive(JSON.parse(raw),{full:flag==='--full'});
  console.log(JSON.stringify(result,null,2));
}
