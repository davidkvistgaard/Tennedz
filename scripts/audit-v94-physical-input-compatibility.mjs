// Read-only preflight for same-seed physical replay. Never choose a
// front worker or convert a manager order to make an input fit.
import {prepareV91Playtest} from
  '../lib/engine/v2/playtest.mjs';
import {prepareV94RivalIntent} from
  '../lib/engine/v2/playtest-rival-intent-v94.mjs';
import {normalizeOrders,orderAt} from
  '../lib/engine/v2/orders.mjs';

const requestedSeeds=process.argv.find(arg=>
  arg.startsWith('--seeds='));
const seedCount=requestedSeeds?
  Number(requestedSeeds.slice(8)):3;
if(!Number.isInteger(seedCount)||
  seedCount<1||seedCount>8)
  throw new Error('Use --seeds=1 through 8.');

const rows=[];
for(let seed=1;seed<=seedCount;seed++)
  for(const distanceKm of [120,260])
    for(const terrain of ['flat','mountain'])
      for(const fatigue of [0,30]){
        const settings={distanceKm,teamCount:20,
          terrain,fatigue,attack:'none',
          chase:'selective',
          seed:`chase-turn-holdout-${seed}-${terrain}-${fatigue}`};
        const prepared=prepareV91Playtest(settings);
        const plan=prepareV94RivalIntent({
          prepared,format:'one_day',rivalGoals:[],
          controlTempoVersion:2,
          opportunisticSpecialistVersion:2,
          frontRotationVersion:1});
        const allTargets=plan.teams.flatMap(team=>
          [team.id,...team.riders.map(rider=>rider.id)]);
        const orders=plan.teams.map(team=>
          normalizeOrders(team.orders,{
            riderIds:team.riders.map(rider=>rider.id),
            distanceKm,keypoints:prepared.stage.keypoints,
            allowFrontWork:true,allowChaseTarget:true,
            allowNamedFrontWorker:true,
            chaseTargetIds:allTargets.filter(id=>
              id!==team.id&&!team.riders.some(rider=>
                rider.id===id))}));
        const front=Array.from({length:distanceKm},
          (_,index)=>orders.map((teamOrders,teamIndex)=>({
            teamId:plan.teams[teamIndex].id,
            order:orderAt(teamOrders,index),
            teamOrders})).filter(row=>
            row.order.frontWork==='rotate'));
        const counts=front.map(rows=>rows.length);
        const explicitSportingGoalTeams=plan.intent.filter(
          row=>['sprint_finish','summit_attack',
            'break_stage','none'].includes(
            row.sportingGoal)&&
            plan.teams.some(team=>team.id===row.teamId&&
              team.riders.some(rider=>
                rider.id===row.sportingCaptainId)))
          .length;
        const unnamedFrontTeamKm=front.reduce((sum,rows)=>
          sum+rows.filter(({order,teamOrders})=>
            !teamOrders.helperIds.includes(
              order.frontWorkRiderId)).length,0);
        const firstMultipleIndex=counts.findIndex(count=>count>1);
        const firstUnnamedIndex=front.findIndex(rows=>
          rows.some(({order,teamOrders})=>
            !teamOrders.helperIds.includes(
              order.frontWorkRiderId)));
        const firstMissingStake=plan.intent.find(row=>
          !['sprint_finish','summit_attack',
            'break_stage','none'].includes(
            row.sportingGoal)||
          !plan.teams.some(team=>team.id===row.teamId&&
            team.riders.some(rider=>rider.id===
              row.sportingCaptainId)));
        rows.push({seed,distanceKm,terrain,fatigue,
          riderCount:plan.teams.reduce((sum,team)=>
            sum+team.riders.length,0),
          teamCount:plan.teams.length,
          explicitSportingGoalTeams,
          singleFrontWorkerKm:counts.filter(
            count=>count===1).length,
          multipleFrontWorkerKm:counts.filter(
            count=>count>1).length,
          noFrontWorkerKm:counts.filter(
            count=>count===0).length,
          orderedFrontTeamKm:counts.reduce((sum,count)=>
            sum+count,0),
          unnamedFrontTeamKm,
          maximumOrderedFrontTeams:Math.max(...counts),
          firstMultipleFrontOrder:firstMultipleIndex<0?null:{
            km:firstMultipleIndex+1,
            teams:front[firstMultipleIndex].map(row=>({
              teamId:row.teamId,
              frontWorkRiderId:row.order.frontWorkRiderId??null,
              effort:row.order.effort}))},
          firstUnnamedFrontOrder:firstUnnamedIndex<0?null:{
            km:firstUnnamedIndex+1,
            teams:front[firstUnnamedIndex].filter(
              ({order,teamOrders})=>
                !teamOrders.helperIds.includes(
                  order.frontWorkRiderId)).map(row=>({
              teamId:row.teamId,
              frontWorkRiderId:row.order.frontWorkRiderId??null,
              helperIds:row.teamOrders.helperIds}))},
          firstMissingSportingStake:firstMissingStake?{
            teamId:firstMissingStake.teamId,
            role:firstMissingStake.role,
            source:firstMissingStake.source,
            sportingGoal:firstMissingStake.sportingGoal??null,
            sportingCaptainId:
              firstMissingStake.sportingCaptainId??null}:null});
      }

const firstEvidence=key=>{
  const row=rows.find(item=>item[key]);
  return row?{seed:row.seed,
    distanceKm:row.distanceKm,
    terrain:row.terrain,fatigue:row.fatigue,
    ...row[key]}:null;
};
const summary={version:4,seedCount,cases:rows.length,
  riderCount:rows.every(row=>row.riderCount===
    rows[0].riderCount)?rows[0].riderCount:null,
  teamCases:rows.reduce((sum,row)=>
    sum+row.teamCount,0),
  explicitSportingGoalTeams:rows.reduce((sum,row)=>
    sum+row.explicitSportingGoalTeams,0),
  riderKilometres:rows.reduce((sum,row)=>
    sum+row.riderCount*row.distanceKm,0),
  singleFrontWorkerKm:rows.reduce((sum,row)=>
    sum+row.singleFrontWorkerKm,0),
  multipleFrontWorkerKm:rows.reduce((sum,row)=>
    sum+row.multipleFrontWorkerKm,0),
  noFrontWorkerKm:rows.reduce((sum,row)=>
    sum+row.noFrontWorkerKm,0),
  orderedFrontTeamKm:rows.reduce((sum,row)=>
    sum+row.orderedFrontTeamKm,0),
  unnamedFrontTeamKm:rows.reduce((sum,row)=>
    sum+row.unnamedFrontTeamKm,0),
  maximumOrderedFrontTeams:Math.max(...rows.map(
    row=>row.maximumOrderedFrontTeams)),
  firstMultipleFrontOrder:firstEvidence(
    'firstMultipleFrontOrder'),
  firstUnnamedFrontOrder:firstEvidence(
    'firstUnnamedFrontOrder'),
  firstMissingSportingStake:firstEvidence(
    'firstMissingSportingStake')};
console.log(JSON.stringify(process.argv.includes('--rows')?
  {...summary,rows}:summary));
if(process.argv.includes('--require-compatible')&&
  (summary.multipleFrontWorkerKm||
    summary.noFrontWorkerKm||
    summary.unnamedFrontTeamKm||
    summary.explicitSportingGoalTeams!==
      summary.teamCases||
    rows.some(row=>row.riderCount!==160))){
  console.error('Physical input preflight refused: '+
    'V94 needs explicit sporting goals, named helpers and '+
    'a multi-team single-leader decision source.');
  process.exitCode=1;
}
