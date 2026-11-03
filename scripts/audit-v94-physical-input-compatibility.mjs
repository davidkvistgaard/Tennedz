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
        const counts=Array.from({length:distanceKm},
          (_,index)=>orders.filter(teamOrders=>
            orderAt(teamOrders,index)
              .frontWork==='rotate').length);
        rows.push({seed,distanceKm,terrain,fatigue,
          riderCount:plan.teams.reduce((sum,team)=>
            sum+team.riders.length,0),
          singleFrontWorkerKm:counts.filter(
            count=>count===1).length,
          multipleFrontWorkerKm:counts.filter(
            count=>count>1).length,
          noFrontWorkerKm:counts.filter(
            count=>count===0).length,
          maximumOrderedFrontTeams:Math.max(...counts)});
      }

const summary={version:1,seedCount,cases:rows.length,
  riderCount:rows.every(row=>row.riderCount===
    rows[0].riderCount)?rows[0].riderCount:null,
  riderKilometres:rows.reduce((sum,row)=>
    sum+row.riderCount*row.distanceKm,0),
  singleFrontWorkerKm:rows.reduce((sum,row)=>
    sum+row.singleFrontWorkerKm,0),
  multipleFrontWorkerKm:rows.reduce((sum,row)=>
    sum+row.multipleFrontWorkerKm,0),
  noFrontWorkerKm:rows.reduce((sum,row)=>
    sum+row.noFrontWorkerKm,0),
  maximumOrderedFrontTeams:Math.max(...rows.map(
    row=>row.maximumOrderedFrontTeams))};
console.log(JSON.stringify(process.argv.includes('--rows')?
  {...summary,rows}:summary));
if(process.argv.includes('--require-compatible')&&
  (summary.multipleFrontWorkerKm||
    summary.noFrontWorkerKm||
    rows.some(row=>row.riderCount!==160))){
  console.error('Physical input preflight refused: '+
    'V94 manager orders need an explicit multi-team '+
    'single-leader decision source.');
  process.exitCode=1;
}
