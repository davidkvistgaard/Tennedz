// Read-only same-source comparison until either motor leaves the bunch.
// A physical pace-loss projection is not proof of a lost wheel.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {prepareV91Playtest} from
  '../lib/engine/v2/playtest.mjs';
import {orderAt} from '../lib/engine/v2/orders.mjs';
import {runRearBunchOriginRoadV1} from
  '../lib/engine/v2/rear-bunch-origin-road-v1.mjs';
import {replayRaceDynamicsRecording} from
  '../lib/engine/v2/replay-race-dynamics-v94.mjs';

const option=(name,fallback)=>{
  const value=process.argv.find(arg=>arg.startsWith(`--${name}=`));
  return value?value.slice(name.length+3):fallback;
};
const distanceKm=Number(option('distance',120));
const fatigue=Number(option('fatigue',0));
const terrain=option('terrain','flat');
const seedNumber=Number(option('seed-number',1));
const recordedWork=Number(option('recorded-work',0));
if(![120,260].includes(distanceKm)||![0,30].includes(fatigue)||
  !['flat','rolling','mountain'].includes(terrain)||
  !Number.isInteger(seedNumber)||seedNumber<1||seedNumber>4||
  ![0,1].includes(recordedWork))
  throw new Error('Multikm origin audit needs a known synthetic case.');
const settings={distanceKm,terrain,teamCount:20,
  fatigue,attack:'none',chase:'selective',
  seed:`preview-recorded-road-${seedNumber}`};
const sportingStakes=prepareV91Playtest(settings).teams.map(team=>({
  teamId:team.id,goal:recordedWork?'sprint_finish':'none',
  captainId:team.orders.captainId}));
let recording;
try{
  ({recording}=createV94RaceDynamicsPreview({format:'one_day',
    settings,sportingStakes,roadGroupPaceVersion:3,
    bunchFrontTurnVersion:1,chaseTurnVersion:1,
    pelotonFrontTurnVersion:1,pelotonDraftCostVersion:1,
    pelotonExposureCostVersion:1,
    ...(recordedWork?{pelotonDropContactVersion:1,
      pelotonFollowerDecisionVersion:2}:{})}));
}catch(error){
  if(!String(error.message).includes(
    'Combined fresh attack and paid pursuit')&&
    !String(error.message).includes(
      'Unresolved peloton drop contact'))throw error;
  console.log(JSON.stringify({version:'v94-rear-origin-multikm-1',
    seedNumber,distanceKm,terrain,fatigue,recordedWork,
    refusal:error.message}));
  process.exit(0);
}
replayRaceDynamicsRecording(recording);
const frames=recording.frames;
const summary={version:'v94-rear-origin-multikm-1',
  raceSeed:recording.raceSeed,seedNumber,distanceKm,terrain,fatigue,
  recordedWork,
  riders:0,v94PelotonRiderKm:0,physicalHeldRiderKm:0,
  energyAndPaidMatchedKm:0,
  projectedPaceLossRiders:0,physicalRefusals:0,
  paidMismatches:0,energyMismatches:0,
  earliestMismatch:null,firstOtherMismatch:null,firstRefusal:null,
  firstMismatchRiders:0,firstMismatchRestRiders:0,
  firstMismatchOtherRiders:0,
  lastPhysicalHeldKm:0};
for(const team of recording.committedInputs.teams)
  for(const rider of team.riders){
    summary.riders++;
    const throughKm=frames.findIndex(frame=>
      frame.riderGroups.find(row=>row.id===rider.id)
        ?.group!=='peloton');
    const pelotonKm=throughKm<0?frames.length:throughKm;
    summary.v94PelotonRiderKm+=pelotonKm;
    if(!pelotonKm)continue;
    const routeKilometres=recording.route.kilometres
      .slice(0,pelotonKm);
    const bunchTurnPlans=frames.slice(0,pelotonKm)
      .map(frame=>frame.pelotonFrontTurnPlan);
    const choices=routeKilometres.map(segment=>({
      riderId:rider.id,km:segment.km,
      effort:orderAt(team.orders,segment.km-1).effort,
      action:'hold_wheel',reason:'follow_order'}));
    let road;
    const followerDecisions=recordedWork?
      frames.slice(0,pelotonKm).map(frame=>
        frame.pelotonFrontTurnPlan.turns.some(turn=>
          turn.leaderRiderId===rider.id)?null:
          frame.pelotonFollowerDecisions.find(row=>
            row.riderId===rider.id)):null;
    try{
      road=runRearBunchOriginRoadV1({rider,
        orders:team.orders,routeKilometres,bunchTurnPlans,
        choices,stageNumber:1,stageCount:1,
        followerSpeedVersion:1,
        ...(recordedWork?{recordedWorkVersion:1,
          teamId:team.id,followerDecisions}:{})});
    }catch(error){
      summary.physicalRefusals++;
      summary.firstRefusal??={riderId:rider.id,
        throughKm:pelotonKm,error:error.message};
      continue;
    }
    if(road.status==='wheel_lost')
      summary.projectedPaceLossRiders++;
    let riderMismatch=false;
    for(const step of road.steps){
      if(step.split)break;
      const ledger=frames[step.sourceKm-1].energyLedger.find(row=>
        row.riderId===rider.id);
      if(!ledger)throw new Error('Missing V94 rider ledger.');
      const physicalPaid=step.slices.reduce((sum,slice)=>
        sum+slice.energySpent,0);
      const paidError=Math.abs(physicalPaid-ledger.paidFromReserve);
      const energyError=Math.abs(step.energyAfter-ledger.energyAfter);
      if(paidError<=.001&&energyError<=.001)
        summary.energyAndPaidMatchedKm++;
      if(paidError>.001)summary.paidMismatches++;
      if(energyError>.001)summary.energyMismatches++;
      if(paidError>.001||energyError>.001){
        const frame=frames[step.sourceKm-1];
        const v94RestTeam=frame.pelotonRestTeamIds
          ?.includes(team.id)??false;
        if(!riderMismatch){
          summary.firstMismatchRiders++;
          if(v94RestTeam)summary.firstMismatchRestRiders++;
          else{
            summary.firstMismatchOtherRiders++;
            summary.firstOtherMismatch??={riderId:rider.id,
              km:step.sourceKm,
              role:step.slices.some(slice=>
                slice.role==='leader')?'frontLeader':'follower',
              teamOrderEffort:choices[step.sourceKm-1].effort,
              draftCost:frame.pelotonDraftCosts?.find(row=>
                row.riderId===rider.id)??null,
              frontTurn:frame.pelotonFrontTurnPlan.turns.find(row=>
                row.leaderRiderId===rider.id)??null,
              v94Recovery:ledger.recoveryAward,
              physicalRecovery:step.recoveryAward,
              physicalPaid:+physicalPaid.toFixed(6),
              v94Paid:ledger.paidFromReserve,
              physicalEnergyBefore:step.slices[0].energyBefore,
              v94EnergyBefore:ledger.energyBefore,
              physicalEnergy:step.energyAfter,
              v94Energy:ledger.energyAfter};
          }
        }
        riderMismatch=true;
        if(!summary.earliestMismatch||
          step.sourceKm<summary.earliestMismatch.km)
          summary.earliestMismatch={
            riderId:rider.id,km:step.sourceKm,
            role:step.slices.some(slice=>
              slice.role==='leader')?'frontLeader':'follower',
            teamOrderEffort:choices[step.sourceKm-1].effort,
            v94RestTeam,
            v94BunchEaseTeam:frame.bunchEaseTeamIds
              ?.includes(team.id)??false,
            physicalPaid:+physicalPaid.toFixed(6),
            v94Paid:ledger.paidFromReserve,
            physicalEnergyBefore:step.slices[0].energyBefore,
            v94EnergyBefore:ledger.energyBefore,
            physicalRecovery:step.recoveryAward,
            v94Recovery:ledger.recoveryAward,
            physicalEnergy:step.energyAfter,
            v94Energy:ledger.energyAfter};
      }
      summary.physicalHeldRiderKm++;
      summary.lastPhysicalHeldKm=Math.max(summary.lastPhysicalHeldKm,
        step.sourceKm);
    }
  }
console.log(JSON.stringify(summary));
