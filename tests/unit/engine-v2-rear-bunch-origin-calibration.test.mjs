import test from 'node:test';
import assert from 'node:assert/strict';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {orderAt} from '../../lib/engine/v2/orders.mjs';
import {runRearBunchOriginRoadV1} from
  '../../lib/engine/v2/rear-bunch-origin-road-v1.mjs';
import {quoteRearEnergyDemandV1} from
  '../../lib/engine/v2/rear-energy-demand-v1.mjs';
import {replayRaceDynamicsRecording} from
  '../../lib/engine/v2/replay-race-dynamics-v94.mjs';

test('same-seed first-km origin projection exposes calibration blocker',()=>{
  const summaries=[];
  for(const terrain of ['flat','rolling','mountain'])
    for(const fatigue of [0,30]){
      const {recording}=createV94RaceDynamicsPreview({
        format:'one_day',roadGroupPaceVersion:3,
        bunchFrontTurnVersion:1,chaseTurnVersion:1,
        pelotonFrontTurnVersion:1,
        settings:{distanceKm:120,terrain,teamCount:20,
          fatigue,attack:'none',chase:'selective',
          seed:'preview-recorded-road-1'}});
      replayRaceDynamicsRecording(recording);
      const segment=recording.route.kilometres[0];
      const turnPlan=recording.frames[0].pelotonFrontTurnPlan;
      const lost=[];
      const held=[];
      for(const team of recording.committedInputs.teams)
        for(const rider of team.riders){
          const choice={riderId:rider.id,km:1,
            effort:orderAt(team.orders,0).effort,
            action:'hold_wheel',reason:'follow_order'};
          if(terrain==='mountain'&&fatigue===30&&
            !turnPlan.turns.some(turn=>
              turn.leaderRiderId===rider.id)){
            const paid=recording.frames[0].energyLedger.find(
              row=>row.riderId===rider.id);
            const shelter=quoteRearEnergyDemandV1({rider,
              segment,energyBefore:paid.energyBefore,
              effort:choice.effort,role:'sheltered',
              distanceM:1000});
            assert.ok(Math.abs(shelter.energyDemand/
              paid.paidFromReserve-.8)<1e-9);
          }
          const road=runRearBunchOriginRoadV1({rider,
            orders:team.orders,routeKilometres:[segment],
            bunchTurnPlans:[turnPlan],choices:[choice],
            stageNumber:1,stageCount:1});
          if(road.status==='wheel_lost'){
            assert.equal(road.steps[0].split.kind,
              'physical_pace_loss');
            assert.ok(road.steps[0].split.bunchSpeedKph>
              road.steps[0].split.holdSpeedKph);
            const paid=recording.frames[0].energyLedger.find(
              row=>row.riderId===rider.id);
            assert.ok(paid.paidFromReserve>0);
            assert.equal(paid.unmetEnergyDemand,0);
            lost.push(rider.id);
          }else{
            assert.equal(road.status,'bunch');
            held.push(rider.id);
          }
        }
      assert.equal(lost.length+held.length,160);
      assert.equal(recording.frames[0].roadGroups.length,0);
      summaries.push({terrain,fatigue,lost:lost.length,
        held:held.length});
    }
  assert.deepEqual(summaries.map(row=>[row.lost,row.held]),
    Array.from({length:6},()=>[117,43]));
});
