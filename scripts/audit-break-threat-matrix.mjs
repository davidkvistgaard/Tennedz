// Read-only comparison with recorded V94 road. A forecast is not a paid catch.
import {createV94RaceDynamicsPreview} from '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {assessBreakThreatRange} from '../lib/engine/v2/break-threat-matrix.mjs';
import {orderAt} from '../lib/engine/v2/orders.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {replayRaceDynamicsRecording} from '../lib/engine/v2/replay-race-dynamics-v94.mjs';

const rows=[];
for(const seed of ['threat-holdout-1'])
  for(const terrain of ['flat','mountain'])
    for(const fatigue of [0,30])
      for(const format of ['one_day','stage'])
        for(const controlCount of [0,2,4]){
      const rivalGoals=Array.from({length:19},(_,index)=>({
        teamId:`rival-${index+1}`,
        role:index<6?'break':index<6+controlCount?'control':'protect',
      }));
      const {recording}=createV94RaceDynamicsPreview({format,rivalGoals,
        settings:{distanceKm:260,terrain,teamCount:20,fatigue,
          attack:'none',chase:'ignore',seed}});
      validateRecordedTour(recording);
      replayRaceDynamicsRecording(recording);
      for(const km of [80,160,220]){
        const frame=recording.frames[km-1],front=frame.roadGroups[0];
        if(!front)continue;
        const energy=Object.fromEntries(frame.riderGroups.map(rider=>
          [rider.id,rider.energy]));
        const teams=recording.committedInputs.teams.map(team=>({...team,
          energy:Object.fromEntries(team.riders.map(rider=>
            [rider.id,energy[rider.id]]))}));
        const frontSet=new Set(front.riderIds);
        const chaseTeamIds=teams.filter(team=>
          !team.riders.some(rider=>frontSet.has(rider.id))&&
          recording.committedInputs.raceContext.teamRoles?.[team.id]==='control'&&
          orderAt(team.orders,km).chase!=='ignore').map(team=>team.id);
        const conditionalChaseTeamIds=format==='one_day'?
          teams.filter(team=>!team.riders.some(rider=>frontSet.has(rider.id))&&
            recording.committedInputs.raceContext.teamRoles?.[team.id]==='protect'&&
            orderAt(team.orders,km).chase==='selective').map(team=>team.id):[];
        const matrix=assessBreakThreatRange({teams,
          frontRiderIds:front.riderIds,
          nominatedChaseTeamIds:chaseTeamIds,conditionalChaseTeamIds,
          unavailableRiderIds:frame.riderGroups.filter(rider=>
            rider.group==='dropped').map(rider=>rider.id),
          remainingSegments:recording.route.kilometres.slice(km),
          gapSeconds:front.gapSeconds});
        const later=recording.frames.slice(km);
        const actualCatch=later.some(next=>
          !next.roadGroups.some(group=>group.riderIds.some(id=>frontSet.has(id))));
        rows.push({seed,terrain,fatigue,format,controlCount,km,
          gapSeconds:front.gapSeconds,
          frontRiders:matrix.nominated.frontRiderCount,
          droppedRiders:matrix.nominated.unavailableRiderCount,
          nominatedTeams:matrix.nominated.chaseTeamCount,
          conditionalTeams:matrix.conditionalTeamCount,
          frontWorkReserve:matrix.nominated.frontWorkReserveAtStart,
          nominatedChaseReserve:matrix.nominated.chaseWorkReserveAtStart,
          expandedChaseReserve:matrix.expanded.chaseWorkReserveAtStart,
          nominatedBudget:matrix.nominated.allInCatchableGapSeconds,
          expandedBudget:matrix.expanded.allInCatchableGapSeconds,
          capacityBand:matrix.capacityBand,
          actualCatch});
      }
    }
const differences=rows.filter(row=>
  (row.capacityBand!=='beyond_available_capacity')!==row.actualCatch);
const cells=[];
for(const format of ['one_day','stage'])for(const controlCount of [0,2,4]){
  const selected=rows.filter(row=>row.format===format&&
    row.controlCount===controlCount);
  cells.push({format,controlCount,cases:selected.length,
    nominatedCapacity:selected.filter(row=>row.capacityBand==='nominated_capacity').length,
    conditionalCapacity:selected.filter(row=>row.capacityBand==='conditional_capacity').length,
    observedCatch:selected.filter(row=>row.actualCatch).length,
    potentialOutcomeDifferenceCount:selected.filter(row=>
      (row.capacityBand!=='beyond_available_capacity')!==row.actualCatch).length});
}
console.log(JSON.stringify({cases:rows.length,
  nominatedCapacity:rows.filter(row=>row.capacityBand==='nominated_capacity').length,
  conditionalCapacity:rows.filter(row=>row.capacityBand==='conditional_capacity').length,
  observedCatch:rows.filter(row=>row.actualCatch).length,
  potentialOutcomeDifferenceCount:differences.length,cells,
  ...(process.argv.includes('--details')?{differences,rows}:{})},null,2));
