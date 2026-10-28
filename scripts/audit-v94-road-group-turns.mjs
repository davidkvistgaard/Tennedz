// Read-only, source-replayed comparison of old aggregate group costs with
// isolated one-leader shares. No candidate pace or energy enters the race.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRaceDynamicsRecording} from
  '../lib/engine/v2/replay-race-dynamics-v94.mjs';
import {decideRoadGroupWork,roadGroupExposureCosts} from
  '../lib/engine/v2/road-groups.mjs';
import {planRoadGroupTurnsV1} from
  '../lib/engine/v2/road-group-turns-v1.mjs';

const cases=[{terrain:'flat',fatigue:0},{terrain:'mountain',fatigue:0},
  {terrain:'flat',fatigue:30},{terrain:'mountain',fatigue:30}];
if(process.argv.slice(2).some(arg=>arg!=='--long'))
  throw new Error('Use --long for 260-km cases.');
const distanceKm=process.argv.includes('--long')?260:120;
const output=[];
for(const settings of cases){
  const {recording}=createV94RaceDynamicsPreview({format:'one_day',
    settings:{distanceKm,teamCount:20,attack:'none',chase:'selective',
      seed:`road-turn-audit-${distanceKm===120?'':'long-'}${settings.terrain}-${settings.fatigue}`,
      ...settings}});
  replayRaceDynamicsRecording(recording);
  let groups=0,worked=0,unworked=0,turns=0,shadowExtra=0,sourceExtra=0;
  let newDrops=0,afterFrontWork=0,caughtAndDropped=0;
  for(let index=1;index<recording.frames.length;index++){
    const frame=recording.frames[index],prior=recording.frames[index-1];
    const priorDropped=new Set(prior.riderGroups.filter(row=>row.group==='dropped')
      .map(row=>row.id));
    const priorBunchWorkers=new Set([...(prior.paidBunchPace?.riderIds??[]),
      ...prior.hardBunchWorkRiderIds,...prior.steadyBunchWorkRiderIds]);
    for(const rider of frame.riderGroups.filter(row=>row.group==='dropped'&&
      !priorDropped.has(row.id))){
      newDrops++;
      if(priorBunchWorkers.has(rider.id))afterFrontWork++;
      if(frame.caughtBreakawayRiderIds.includes(rider.id))caughtAndDropped++;
    }
    const startingGroups=prior.roadGroups;
    if(!startingGroups.length)continue;
    const energyById=new Map(prior.riderGroups.map(row=>[row.id,row.energy]));
    const teams=recording.committedInputs.teams.map(team=>({...team,
      energy:Object.fromEntries(team.riders.map(rider=>{
        if(!energyById.has(rider.id))throw new Error('Missing prior rider energy.');
        return [rider.id,energyById.get(rider.id)];
      }))}));
    const decisions=decideRoadGroupWork(startingGroups,teams,frame.km,{
      holdTeamIds:frame.activeGcResponseTeamIds}).riderDecisions;
    const paidCosts=roadGroupExposureCosts(startingGroups,
      frame.roadGroupWorkerRiderIds,{driveRiderIds:frame.driveRiderIds});
    sourceExtra+=[...paidCosts.values()].reduce((sum,value)=>sum+value,0);
    for(const group of startingGroups){
      const activePullRiderIds=frame.roadGroupWorkerRiderIds.filter(id=>
        group.riderIds.includes(id));
      const plan=planRoadGroupTurnsV1({group,riderDecisions:decisions,teams,
        segment:recording.route.kilometres[index],activePullRiderIds});
      groups++;
      if(plan.status==='worked'){
        worked++;turns+=plan.turns.length;
        shadowExtra+=plan.extraEnergyCosts.reduce((sum,row)=>sum+row.extraCost,0);
      }else unworked++;
    }
  }
  output.push({distanceKm,...settings,groups,worked,unworked,turns,
    newDrops,afterFrontWork,caughtAndDropped,
    sourceExtra:+sourceExtra.toFixed(3),shadowExtra:+shadowExtra.toFixed(3)});
}
console.log(JSON.stringify(output));
