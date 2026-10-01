import {createMotorLabPreview,PREVIEW_ROUTES} from '../lib/engine/v2/preview.mjs';

const count=Number(process.argv[2]??20);
if(!Number.isInteger(count)||count<1||count>200)
 throw new Error('Choose 1–200 scenario seeds.');
const routeId=process.argv[3]??'coast';
if(!PREVIEW_ROUTES.includes(routeId))throw new Error('Choose a laboratory route.');

function metrics(recording){
 const frames=recording.frames;
 const breakEpisodes=[];
 let currentEpisode=0,currentEpisodeChaseKm=0,catchesWithChase=0,catchesWithoutChase=0,
  caughtEpisodesEverChased=0,caughtEpisodesNeverChased=0;
 for(const frame of frames){
  if(frame.groups.length){
   currentEpisode++;
   if(frame.chasingTeams.length)currentEpisodeChaseKm++;
  }
  else if(currentEpisode){
   breakEpisodes.push(currentEpisode);currentEpisode=0;
   if(currentEpisodeChaseKm||frame.chasingTeams.length)caughtEpisodesEverChased++;
   else caughtEpisodesNeverChased++;
   currentEpisodeChaseKm=0;
   if(frame.chasingTeams.length)catchesWithChase++;
   else catchesWithoutChase++;
  }
 }
 if(currentEpisode)breakEpisodes.push(currentEpisode);
 return {
  breakKm:frames.filter(frame=>frame.groups.length>0).length,
  breakEpisodes:breakEpisodes.length,
  longestBreakKm:Math.max(0,...breakEpisodes),
  breakAtFinish:frames.at(-1).groups.length>0,
  breakKmWithChase:frames.filter(frame=>frame.groups.length&&frame.chasingTeams.length).length,
  catchesWithChase,catchesWithoutChase,caughtEpisodesEverChased,caughtEpisodesNeverChased,
  roadGroupsCreated:new Set(frames.flatMap(frame=>frame.groups.map(group=>group.id))).size,
  multiGroupKm:frames.filter(frame=>frame.groups.length>1).length,
  maxGapSeconds:Math.max(...frames.map(frame=>frame.groups[0]?.gapSeconds??0)),
  bunchAttackAttempts:frames.reduce((sum,frame)=>sum+frame.attackAttempts.length,0),
  attacksWithoutGap:frames.reduce((sum,frame)=>sum+frame.attacksWithoutGap.length,0),
  amberWin:recording.results[0].team==='Amber',
  captainPlace:recording.results.find(result=>result.name==='Amber Captain').position,
  split:frames.some(frame=>frame.moments.includes('Amber Captain attacked from a break')),
  blocked:frames.some(frame=>frame.moments.some(moment=>moment.includes('planned break attack could not start'))),
 };
}
function summarise(rows){
 const mean=key=>Number((rows.reduce((sum,row)=>sum+row[key],0)/rows.length).toFixed(1));
 return {
  amberWins:rows.filter(row=>row.amberWin).length,
  meanCaptainPlace:mean('captainPlace'),
  meanBreakKm:mean('breakKm'),
  meanBreakEpisodes:mean('breakEpisodes'),
  meanLongestBreakKm:mean('longestBreakKm'),
  breaksAtFinish:rows.filter(row=>row.breakAtFinish).length,
  meanBreakKmWithChase:mean('breakKmWithChase'),
  totalCatchesWithChase:rows.reduce((sum,row)=>sum+row.catchesWithChase,0),
  totalCatchesWithoutChase:rows.reduce((sum,row)=>sum+row.catchesWithoutChase,0),
  totalCaughtEpisodesEverChased:rows.reduce((sum,row)=>sum+row.caughtEpisodesEverChased,0),
  totalCaughtEpisodesNeverChased:rows.reduce((sum,row)=>sum+row.caughtEpisodesNeverChased,0),
  meanRoadGroupsCreated:mean('roadGroupsCreated'),
  meanMaxGapSeconds:mean('maxGapSeconds'),
  meanBunchAttackAttempts:mean('bunchAttackAttempts'),
  meanAttacksWithoutGap:mean('attacksWithoutGap'),
  totalMultiGroupKm:rows.reduce((sum,row)=>sum+row.multiGroupKm,0),
  splits:rows.filter(row=>row.split).length,
  blockedOrders:rows.filter(row=>row.blocked).length,
 };
}
const report={kind:'fictional-motor-lab-audit',routeId,seedCount:count,plans:{}};
for(const plan of ['sprint','break','balanced','conserve']){
 const baseline=[],attack40=[];
 for(let seed=0;seed<count;seed++){
  baseline.push(metrics(createMotorLabPreview({plan,seed,routeId})));
  attack40.push(metrics(createMotorLabPreview({plan,seed,routeId,orders:{breakAttackMarker:'40'}})));
 }
 report.plans[plan]={baseline:summarise(baseline),attackAfter40Km:summarise(attack40)};
}
console.log(JSON.stringify(report,null,2));
