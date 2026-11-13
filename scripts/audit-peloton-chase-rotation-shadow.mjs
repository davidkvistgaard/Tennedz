// Compare two read-only chase forecasts on the SAME validated/replayed road.
// Neither forecast changes a paid frame or decides that a team will help.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {forecastBreakThreat} from '../lib/engine/v2/break-threat-matrix.mjs';
import {orderAt} from '../lib/engine/v2/orders.mjs';

const rivalGoals=Array.from({length:19},(_,index)=>({
  teamId:`rival-${index+1}`,
  role:index<6?'break':index<8?'control':'protect',
}));
const {recording}=createV94RaceDynamicsPreview({format:'one_day',rivalGoals,
  settings:{distanceKm:260,terrain:'flat',teamCount:20,fatigue:0,
    attack:'none',chase:'ignore',seed:'chase-rotation-audit-1'}});
const before=JSON.stringify(recording.frames);
const roles=recording.committedInputs.raceContext.teamRoles;
const rows=[];
for(const km of [80,160,220]){
  const frame=recording.frames[km-1];
  const front=frame.roadGroups[0];
  if(!front)continue;
  const aheadTeamIds=new Set(frame.roadGroups.flatMap(row=>row.teamIds));
  const energy=new Map(frame.riderGroups.map(row=>[row.id,row.energy]));
  const teams=recording.committedInputs.teams.map(team=>({...team,
    energy:Object.fromEntries(team.riders.map(rider=>
      [rider.id,energy.get(rider.id)]))}));
  const chaseTeamIds=teams.filter(team=>roles[team.id]==='control'&&
    !aheadTeamIds.has(team.id)&&
    orderAt(team.orders,km).chase!=='ignore').map(team=>team.id);
  const input={teams,frontRiderIds:front.riderIds,chaseTeamIds,
    unavailableRiderIds:[...frame.roadGroups.slice(1)
      .flatMap(row=>row.riderIds),...frame.riderGroups.filter(row=>
      row.group==='dropped').map(row=>row.id)],
    remainingSegments:recording.route.kilometres.slice(km),
    gapSeconds:front.gapSeconds};
  const stacked=forecastBreakThreat(input);
  const rotated=forecastBreakThreat({...input,rotationVersion:2});
  rows.push({km,gapSeconds:front.gapSeconds,chaseTeamCount:chaseTeamIds.length,
    helperCount:stacked.peakConcurrentChaseHelpers,
    stackedCatchableGapSeconds:stacked.allInCatchableGapSeconds,
    rotatedCatchableGapSeconds:rotated.allInCatchableGapSeconds,
    stackedChaseEnergy:stacked.chaseEnergySpent,
    rotatedChaseEnergy:rotated.chaseEnergySpent});
}
if(before!==JSON.stringify(recording.frames))
  throw new Error('Rotation shadow audit changed paid road frames.');
console.log(JSON.stringify(rows,null,2));
