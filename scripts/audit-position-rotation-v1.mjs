// Diagnose the opt-in paid position model without changing guided races.
// This model is independent of the historical group-clock finish.
import {preparePhysicalFirstSplitMotorInputV1} from
  '../lib/viewer/physical-first-split-test-race-v1.mjs';
import {PHYSICAL_FIRST_POSITION_START_VERSION,
  createPhysicalFirstPositionStartV1} from
  '../lib/engine/v2/physical-first-position-start-v1.mjs';
import {advancePhysicalFirstPositionRotationKmV1} from
  '../lib/engine/v2/physical-first-position-rotation-km-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionRotationKmV2} from
  '../lib/engine/v2/physical-first-position-rotation-km-v2.mjs';
import {settlePhysicalFirstPositionFinishTailV2} from
  '../lib/engine/v2/physical-first-position-finish-tail-v2.mjs';
import {recordPhysicalFirstPositionRotationRaceV2} from
  '../lib/engine/v2/physical-first-position-rotation-race-v2.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {orderAt} from '../lib/engine/v2/orders.mjs';
import {riderKilometreEffect} from
  '../lib/engine/v2/physiology.mjs';
import {segmentBaseSeconds} from
  '../lib/engine/v2/road-clock.mjs';
import {MOTOR_RACE_DYNAMICS,TUNING} from
  '../lib/engine/v2/tuning.mjs';

const smoke=process.argv.includes('--smoke');
const stagedBackup=process.argv.includes('--staged-backup');
const requireComplete=process.argv.includes('--require-complete');
const grid={laneCount:4,wheelSpacingM:2.5,laneStaggerM:.08};
const speedFor=(source,segment,energy,phase)=>{
  const order=orderAt(source.team.orders,segment.km-1);
  const ability=riderKilometreEffect(source.rider,segment,
    {phase,energy,exposed:segment.exposed}).ability+
    (TUNING.effortPressure[order.effort]-1)*20;
  return 1000/(segmentBaseSeconds(segment)+
    (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint);
};
const variants=smoke?[
  {category:'men',terrain:'mountain',chase:'selective',
    attack:'none',seed:'preview-recorded-road-1'},
  {category:'women',terrain:'mountain',chase:'selective',
    attack:'none',seed:'preview-recorded-road-1'},
  {category:'men',terrain:'flat',chase:'all',
    attack:'selective',seed:'preview-recorded-road-1'},
  {category:'women',terrain:'flat',chase:'all',
    attack:'selective',seed:'preview-recorded-road-1'},
]:['preview-recorded-road-1','viewer-release-holdout-2']
  .flatMap(seed=>['men','women'].flatMap(category=>
    ['flat','rolling','mountain'].flatMap(terrain=>
      ['selective','all'].flatMap(chase=>
        ['none','selective','repeated'].map(attack=>({
          category,terrain,chase,attack,seed}))))));

const rows=[];
for(const variant of variants){
  const {category,...options}=variant;
  try{
    const {input}=preparePhysicalFirstSplitMotorInputV1(
      category,options);
    const committed={...input,
      positionModelVersion:stagedBackup?
        PHYSICAL_FIRST_POSITION_START_V2_VERSION:
        PHYSICAL_FIRST_POSITION_START_VERSION};
    const paidRace=runPhysicalFirstWholeRaceProbeV1(committed);
    let state=stagedBackup?
      createPhysicalFirstPositionStartV2({input:committed,grid}):
      createPhysicalFirstPositionStartV1({input:committed,grid});
    let paidFrontPasses=0,refusedFrontPasses=0;
    let blockedPassingLanes=0,openPassingLanes=0;
    let blockedButFaster=0,openButFaster=0;
    let reachableIfOpen=0;
    let proposedGainSumM=0,maxProposedGainM=0;
    let edgeLaneCandidates=0;
    let sourceAlignedKm=0,firstSourceDifference=null;
    const crossings=[];
    let unsupported=null;
    for(const segment of committed.kilometres){
      try{
        const prior=state;
        const request={prior,segment,input:committed};
        state=stagedBackup?
          advancePhysicalFirstPositionRotationKmV2(request):
          advancePhysicalFirstPositionRotationKmV1(request);
        crossings.push(...state.checkpointCrossings);
        if(!firstSourceDifference){
          const paid=paidRace.steps[segment.km-1];
          const paidLeader=paid.peloton?.road?.leaderRiderId;
          const paidIds=new Set(paid.peloton?.road?.riderIds??[]);
          const modelIds=new Set(state.positions.map(row=>row.riderId));
          const reasons=[];
          if(paidRace.states[segment.km]?.roads.length!==1)
            reasons.push('separate_paid_road');
          if(paidIds.size!==modelIds.size||
            [...modelIds].some(id=>!paidIds.has(id)))
            reasons.push('road_membership');
          if(state.leaderRiderId!==paidLeader)
            reasons.push('front_worker');
          if(Math.abs(state.clockSeconds-
            paid.peloton.road.finishClockSeconds)>1e-6)
            reasons.push('paid_clock');
          if(reasons.length)firstSourceDifference={
            km:segment.km,reasons,
            modelLeader:state.leaderRiderId,
            paidLeader,modelClockSeconds:state.clockSeconds,
            paidClockSeconds:paid.peloton.road.finishClockSeconds};
          else sourceAlignedKm=segment.km;
        }
        if(state.event?.type==='paid_front_pass')paidFrontPasses++;
        if(state.event?.type==='front_pass_refused'){
          refusedFrontPasses++;
          const candidate=prior.positions.find(row=>
            row.riderId===state.proposedLeaderRiderId);
          const front=prior.positions[0];
          const sourceFor=id=>committed.teams.flatMap(team=>
            team.riders.map(rider=>({rider,team})))
            .find(source=>source.rider.id===id);
          const approachSpeed=speedFor(
            sourceFor(candidate.riderId),segment,
            candidate.energy,'attack');
          const frontSpeed=speedFor(sourceFor(front.riderId),
            segment,front.energy,'solo');
          const faster=approachSpeed>frontSpeed;
          const gain=front.distanceM-candidate.distanceM+
            prior.grid.wheelSpacingM;
          proposedGainSumM+=gain;
          maxProposedGainM=Math.max(maxProposedGainM,gain);
          if(candidate.lane===prior.grid.laneCount-1)
            edgeLaneCandidates++;
          if(faster&&gain/(approachSpeed-frontSpeed)<
            1000/frontSpeed)reachableIfOpen++;
          const blocked=prior.positions.some(row=>
            row.riderId!==candidate.riderId&&
            row.lane===candidate.lane&&
            row.distanceM>candidate.distanceM+1e-6);
          if(blocked){
            blockedPassingLanes++;
            if(faster)blockedButFaster++;
          }else{
            openPassingLanes++;
            if(faster)openButFaster++;
          }
        }
      }catch(error){
        unsupported={km:segment.km,reason:error.message};
        break;
      }
    }
    const riderCount=state.positions.length;
    const uniqueCrossings=new Set(crossings.map(row=>
      `${row.riderId}:${row.km}`));
    const sourceStayedConnected=paidRace.states.every(row=>
      row.roads.length===1);
    const connectedFinish=stagedBackup&&
      variant.attack==='none'&&
      sourceStayedConnected&&
      state.sourceKm===committed.kilometres.length?
      settlePhysicalFirstPositionFinishTailV2({
        input:committed,prior:state}):null;
    const recordedRace=connectedFinish?
      recordPhysicalFirstPositionRotationRaceV2({
        input:committed,grid}):null;
    rows.push({variant,status:'complete',
      positionKm:state.sourceKm,plannedKm:committed.kilometres.length,
      riderCount,recordedRiderCrossings:uniqueCrossings.size,
      sourceAlignedKm,firstSourceDifference,
      paidFrontPasses,refusedFrontPasses,unsupported,
      blockedPassingLanes,openPassingLanes,
      blockedButFaster,openButFaster,
      reachableIfOpen,
      proposedGainSumM,maxProposedGainM,
      edgeLaneCandidates,
      connectedFinishCrossings:
        connectedFinish?.lineCrossings.length??0,
      recordedPositionRiderKm:
        recordedRace?.positionRiderKm??0,
      sourceStayedConnected,
      officialResults:false});
  }catch(error){
    rows.push({variant,status:'failed',reason:error.message});
  }
}
const complete=rows.filter(row=>row.status==='complete');
const summary={version:stagedBackup?
  'physical-first-position-rotation-audit-2':
  'physical-first-position-rotation-audit-1',
  positionModelVersion:stagedBackup?
    PHYSICAL_FIRST_POSITION_START_V2_VERSION:
    PHYSICAL_FIRST_POSITION_START_VERSION,
  scenarios:rows.length,started:complete.length,
  independentModelCompletedRaces:complete.filter(row=>
    row.positionKm===row.plannedKm).length,
  sourceAlignedRaces:complete.filter(row=>
    row.sourceAlignedKm===row.plannedKm).length,
  connectedRacesWithPaidFinish:complete.filter(row=>
    row.connectedFinishCrossings===row.riderCount).length,
  recordedConnectedRaces:complete.filter(row=>
    row.recordedPositionRiderKm===
      row.riderCount*row.plannedKm).length,
  paidFrontPasses:complete.reduce((sum,row)=>
    sum+row.paidFrontPasses,0),
  blockedPassingLanes:complete.reduce((sum,row)=>
    sum+row.blockedPassingLanes,0),
  openPassingLanes:complete.reduce((sum,row)=>
    sum+row.openPassingLanes,0),
  blockedButFaster:complete.reduce((sum,row)=>
    sum+row.blockedButFaster,0),
  openButFaster:complete.reduce((sum,row)=>
    sum+row.openButFaster,0),
  reachableIfOpen:complete.reduce((sum,row)=>
    sum+row.reachableIfOpen,0),
  meanProposedGainM:complete.reduce((sum,row)=>
    sum+row.proposedGainSumM,0)/
    Math.max(1,complete.reduce((sum,row)=>
      sum+row.refusedFrontPasses,0)),
  maxProposedGainM:Math.max(0,...complete.map(row=>
    row.maxProposedGainM)),
  edgeLaneCandidates:complete.reduce((sum,row)=>
    sum+row.edgeLaneCandidates,0),
  officialResultsAvailable:0,
  readyForViewerPositions:false};
process.stdout.write(`${JSON.stringify({summary,rows},null,2)}\n`);
if(requireComplete)process.exitCode=1;
