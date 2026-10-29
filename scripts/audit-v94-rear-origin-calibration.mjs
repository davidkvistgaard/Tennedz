// Read-only same-seed comparison. A V94 front-turn capacity is not a
// calibrated physical bunch clock or proof that a rider lost the wheel.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {orderAt} from '../lib/engine/v2/orders.mjs';
import {runRearBunchOriginRoadV1} from
  '../lib/engine/v2/rear-bunch-origin-road-v1.mjs';
import {replayRaceDynamicsRecording} from
  '../lib/engine/v2/replay-race-dynamics-v94.mjs';

const results=[];
for(let seedNumber=1;seedNumber<=4;seedNumber++)
  for(const terrain of ['flat','rolling','mountain'])
    for(const fatigue of [0,30]){
      const seed=`preview-recorded-road-${seedNumber}`;
      let recording;
      try{
        ({recording}=createV94RaceDynamicsPreview({
          format:'one_day',roadGroupPaceVersion:3,
          bunchFrontTurnVersion:1,chaseTurnVersion:1,
          pelotonFrontTurnVersion:1,
          settings:{distanceKm:120,terrain,teamCount:20,
            fatigue,attack:'none',chase:'selective',seed}}));
      }catch(error){
        if(!String(error.message).includes(
          'Combined fresh attack and paid pursuit'))throw error;
        results.push({seedNumber,terrain,fatigue,
          refusal:error.message});
        continue;
      }
      replayRaceDynamicsRecording(recording);
      const segment=recording.route.kilometres[0];
      const frame=recording.frames[0];
      const plan=frame.pelotonFrontTurnPlan;
      let projectedPaceLosses=0;
      let paidPositive=0;
      let unmetDemand=0;
      let projectedHolds=0;
      let heldPaidMismatches=0;
      let heldEnergyMismatches=0;
      const energyById=new Map(frame.energyLedger.map(row=>
        [row.riderId,row]));
      for(const team of recording.committedInputs.teams)
        for(const rider of team.riders){
          const choice={riderId:rider.id,km:1,
            effort:orderAt(team.orders,0).effort,
            action:'hold_wheel',reason:'follow_order'};
          const road=runRearBunchOriginRoadV1({rider,
            orders:team.orders,routeKilometres:[segment],
            bunchTurnPlans:[plan],choices:[choice],
            stageNumber:1,stageCount:1});
          const paid=energyById.get(rider.id);
          if(!paid)throw new Error('Missing first-kilometre energy source.');
          if(road.status==='wheel_lost'){
            if(road.steps[0].split.kind!=='physical_pace_loss')
              throw new Error('Unexpected first-kilometre split source.');
            projectedPaceLosses++;
            if(paid.paidFromReserve>0)paidPositive++;
            if(paid.unmetEnergyDemand>0)unmetDemand++;
          }else{
            if(road.status!=='bunch')
              throw new Error('Unexpected first-kilometre origin state.');
            projectedHolds++;
            const step=road.steps[0];
            const projectedPaid=step.slices.reduce((sum,slice)=>
              sum+slice.energySpent,0);
            if(Math.abs(projectedPaid-paid.paidFromReserve)>.001)
              heldPaidMismatches++;
            if(Math.abs(step.energyAfter-paid.energyAfter)>.001)
              heldEnergyMismatches++;
          }
        }
      results.push({seedNumber,terrain,fatigue,
        projectedPaceLosses,paidPositive,unmetDemand,
        projectedHolds,heldPaidMismatches,heldEnergyMismatches,
        v94FirstFrameRoadGroups:frame.roadGroups.length});
    }
const version='v94-rear-origin-calibration-2';
if(process.argv.includes('--summary')){
  const replayed=results.filter(row=>!row.refusal);
  const sum=key=>replayed.reduce((total,row)=>total+row[key],0);
  console.log(JSON.stringify({version,cases:results.length,
    replayedCases:replayed.length,refusedCases:results.length-
      replayed.length,
    projectedPaceLossesMin:Math.min(...replayed.map(row=>
      row.projectedPaceLosses)),
    projectedPaceLossesMax:Math.max(...replayed.map(row=>
      row.projectedPaceLosses)),
    projectedHolds:sum('projectedHolds'),
    heldPaidMismatches:sum('heldPaidMismatches'),
    heldEnergyMismatches:sum('heldEnergyMismatches')}));
}else console.log(JSON.stringify({version,results}));
