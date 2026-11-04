// Read-only same-seed comparison. A V94 front-turn capacity is not a
// calibrated physical bunch clock or proof that a rider lost the wheel.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {prepareV91Playtest} from
  '../lib/engine/v2/playtest.mjs';
import {orderAt} from '../lib/engine/v2/orders.mjs';
import {runRearBunchOriginRoadV1} from
  '../lib/engine/v2/rear-bunch-origin-road-v1.mjs';
import {replayRaceDynamicsRecording} from
  '../lib/engine/v2/replay-race-dynamics-v94.mjs';

const draftCost=process.argv.includes('--v94-draft-cost');
const physicalExposure=process.argv.includes('--v94-physical-exposure');
if(physicalExposure&&!draftCost)
  throw new Error('Physical exposure comparison needs V94 draft cost.');
const results=[];
for(let seedNumber=1;seedNumber<=4;seedNumber++)
  for(const terrain of ['flat','rolling','mountain'])
    for(const fatigue of [0,30]){
      const seed=`preview-recorded-road-${seedNumber}`;
      const settings={distanceKm:120,terrain,teamCount:20,
        fatigue,attack:'none',chase:'selective',seed};
      const sportingStakes=draftCost?
        prepareV91Playtest(settings).teams.map(team=>({
          teamId:team.id,goal:'none',
          captainId:team.orders.captainId})):null;
      let recording;
      try{
        ({recording}=createV94RaceDynamicsPreview({
          format:'one_day',roadGroupPaceVersion:3,
          bunchFrontTurnVersion:1,chaseTurnVersion:1,
          pelotonFrontTurnVersion:1,
          pelotonDraftCostVersion:draftCost?1:0,
          pelotonExposureCostVersion:physicalExposure?1:0,
          sportingStakes,settings}));
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
      let heldPaidAbsoluteError=0;
      let heldEnergyAbsoluteError=0;
      const heldMismatchByKind={frontLeader:0,captain:0,other:0};
      let firstHeldMismatch=null;
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
            heldPaidAbsoluteError+=Math.abs(
              projectedPaid-paid.paidFromReserve);
            heldEnergyAbsoluteError+=Math.abs(
              step.energyAfter-paid.energyAfter);
            if(Math.abs(projectedPaid-paid.paidFromReserve)>.001){
              heldPaidMismatches++;
              const kind=plan.turns.some(turn=>
                turn.leaderRiderId===rider.id)?'frontLeader':
                rider.id===team.orders.captainId?'captain':'other';
              heldMismatchByKind[kind]++;
              firstHeldMismatch??={riderId:rider.id,kind,
                projectedPaid:+projectedPaid.toFixed(6),
                recordedPaid:paid.paidFromReserve,
                projectedEnergyAfter:step.energyAfter,
                recordedEnergyAfter:paid.energyAfter,
                draftCostFraction:frame.pelotonDraftCosts?.find(row=>
                  row.riderId===rider.id)?.baseCostFraction??1};
            }
            if(Math.abs(step.energyAfter-paid.energyAfter)>.001)
              heldEnergyMismatches++;
          }
        }
      results.push({seedNumber,terrain,fatigue,
        projectedPaceLosses,paidPositive,unmetDemand,
        projectedHolds,heldPaidMismatches,heldEnergyMismatches,
        heldPaidAbsoluteError,heldEnergyAbsoluteError,
        heldMismatchByKind,firstHeldMismatch,
        v94FirstFrameRoadGroups:frame.roadGroups.length});
    }
const version='v94-rear-origin-calibration-3';
if(process.argv.includes('--summary')){
  const replayed=results.filter(row=>!row.refusal);
  const sum=key=>replayed.reduce((total,row)=>total+row[key],0);
  console.log(JSON.stringify({version,draftCost,physicalExposure,
    cases:results.length,
    replayedCases:replayed.length,refusedCases:results.length-
      replayed.length,
    projectedPaceLossesMin:Math.min(...replayed.map(row=>
      row.projectedPaceLosses)),
    projectedPaceLossesMax:Math.max(...replayed.map(row=>
      row.projectedPaceLosses)),
    projectedHolds:sum('projectedHolds'),
    heldPaidMismatches:sum('heldPaidMismatches'),
    heldEnergyMismatches:sum('heldEnergyMismatches'),
    heldPaidAbsoluteError:+sum('heldPaidAbsoluteError').toFixed(3),
    heldEnergyAbsoluteError:+sum('heldEnergyAbsoluteError').toFixed(3),
    heldMismatchByKind:Object.fromEntries(
      ['frontLeader','captain','other'].map(kind=>[kind,
        replayed.reduce((count,row)=>
          count+row.heldMismatchByKind[kind],0)])),
    firstHeldMismatch:replayed.find(row=>
      row.firstHeldMismatch)?.firstHeldMismatch??null,
    refusals:results.filter(row=>row.refusal).map(row=>({
      seedNumber:row.seedNumber,terrain:row.terrain,
      fatigue:row.fatigue,refusal:row.refusal}))}));
}else console.log(JSON.stringify({version,draftCost,
  physicalExposure,results}));
