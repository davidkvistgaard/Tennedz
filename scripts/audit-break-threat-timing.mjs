// Read-only decision trace. The actual V94 recording is never rerouted.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {perceiveRivalStrength} from
  '../lib/engine/v2/break-threat-perception.mjs';
import {assessOneKmChaseDelay} from
  '../lib/engine/v2/break-threat-matrix.mjs';
import {orderAt} from '../lib/engine/v2/orders.mjs';

const rivalGoals=Array.from({length:19},(_,index)=>({
  teamId:`rival-${index+1}`,
  role:index<6?'break':index<8?'control':'protect',
}));
const {recording}=createV94RaceDynamicsPreview({format:'one_day',rivalGoals,
  settings:{distanceKm:260,terrain:'flat',teamCount:20,fatigue:0,
    attack:'none',chase:'ignore',seed:'threat-timing-holdout-1'}});
const sourceFrames=JSON.stringify(recording.frames);
const rows=[];
for(const frame of recording.frames){
  if(frame.km<120||frame.km>220||!frame.roadGroups.length)continue;
  const firstGroup=frame.roadGroups[0];
  const aheadTeamIds=new Set(frame.roadGroups.flatMap(group=>group.teamIds));
  const frontRiderIds=firstGroup.riderIds;
  const unavailableRiderIds=[...frame.roadGroups.slice(1).flatMap(group=>group.riderIds),
    ...frame.riderGroups.filter(row=>row.group==='dropped').map(row=>row.id)];
  const energy=Object.fromEntries(frame.riderGroups.map(row=>
    [row.id,row.energy]));
  const teams=recording.committedInputs.teams.map(team=>({...team,
    energy:Object.fromEntries(team.riders.map(rider=>
      [rider.id,energy[rider.id]]))}));
  const roles=recording.committedInputs.raceContext.teamRoles;
  const nominatedChaseTeamIds=teams.filter(team=>
    !aheadTeamIds.has(team.id)&&roles[team.id]==='control'&&
    orderAt(team.orders,frame.km).chase!=='ignore').map(team=>team.id);
  if(!nominatedChaseTeamIds.length)continue;
  const observerTeamId=nominatedChaseTeamIds[0];
  const believed=perceiveRivalStrength({teams,observerTeamId,
    raceSeed:recording.raceSeed});
  const input={frontRiderIds,unavailableRiderIds,nominatedChaseTeamIds,
    remainingSegments:recording.route.kilometres.slice(frame.km),
    gapSeconds:firstGroup.gapSeconds};
  const truth=assessOneKmChaseDelay({...input,teams});
  const perception=assessOneKmChaseDelay({...input,teams:believed.teams});
  const next=recording.frames[frame.km];
  rows.push({km:frame.km,gapSeconds:firstGroup.gapSeconds,
    truthMustStart:truth.nominatedMustStartNow,
    believedMustStart:perception.nominatedMustStartNow,
    actualPaidControlTeams:next.chasers.filter(id=>roles[id]==='control').length,
    trueDeferredHeadroom:truth.deferred.nominated.allInGapHeadroomSeconds,
    believedDeferredHeadroom:perception.deferred.nominated.allInGapHeadroomSeconds});
}
if(JSON.stringify(recording.frames)!==sourceFrames)
  throw new Error('The decision audit changed the paid source road.');
console.log(JSON.stringify({samples:rows.length,
  trueMustStart:rows.filter(row=>row.truthMustStart).length,
  believedMustStart:rows.filter(row=>row.believedMustStart).length,
  differingStartAdvice:rows.filter(row=>
    row.truthMustStart!==row.believedMustStart).length,
  paidControlAtNextKm:rows.filter(row=>row.actualPaidControlTeams>0).length,
  nearBoundary:rows.filter(row=>
    Math.abs(row.trueDeferredHeadroom)<=10||
    Math.abs(row.believedDeferredHeadroom)<=10),
  ...(process.argv.includes('--details')?{rows}:{})},null,2));
