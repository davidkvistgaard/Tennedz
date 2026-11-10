// Diagnose the opt-in paid position model without changing guided races.
// This model is independent of the historical group-clock finish.
import {preparePhysicalFirstSplitMotorInputV1} from
  '../lib/viewer/physical-first-split-test-race-v1.mjs';
import {PHYSICAL_FIRST_POSITION_START_VERSION,
  createPhysicalFirstPositionStartV1} from
  '../lib/engine/v2/physical-first-position-start-v1.mjs';
import {advancePhysicalFirstPositionRotationKmV1} from
  '../lib/engine/v2/physical-first-position-rotation-km-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';

const smoke=process.argv.includes('--smoke');
const requireComplete=process.argv.includes('--require-complete');
const grid={laneCount:4,wheelSpacingM:2.5,laneStaggerM:.08};
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
      positionModelVersion:PHYSICAL_FIRST_POSITION_START_VERSION};
    const paidRace=runPhysicalFirstWholeRaceProbeV1(committed);
    let state=createPhysicalFirstPositionStartV1({
      input:committed,grid});
    let paidFrontPasses=0,refusedFrontPasses=0;
    let blockedPassingLanes=0,openPassingLanes=0;
    let sourceAlignedKm=0,firstSourceDifference=null;
    const crossings=[];
    let unsupported=null;
    for(const segment of committed.kilometres){
      try{
        const prior=state;
        state=advancePhysicalFirstPositionRotationKmV1({
          prior,segment,input:committed});
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
          const blocked=prior.positions.some(row=>
            row.riderId!==candidate.riderId&&
            row.lane===candidate.lane&&
            row.distanceM>candidate.distanceM+1e-6);
          if(blocked)blockedPassingLanes++;
          else openPassingLanes++;
        }
      }catch(error){
        unsupported={km:segment.km,reason:error.message};
        break;
      }
    }
    const riderCount=state.positions.length;
    const uniqueCrossings=new Set(crossings.map(row=>
      `${row.riderId}:${row.km}`));
    rows.push({variant,status:'complete',
      positionKm:state.sourceKm,plannedKm:committed.kilometres.length,
      riderCount,recordedRiderCrossings:uniqueCrossings.size,
      sourceAlignedKm,firstSourceDifference,
      paidFrontPasses,refusedFrontPasses,unsupported,
      blockedPassingLanes,openPassingLanes,
      officialResults:false});
  }catch(error){
    rows.push({variant,status:'failed',reason:error.message});
  }
}
const complete=rows.filter(row=>row.status==='complete');
const summary={version:'physical-first-position-rotation-audit-1',
  scenarios:rows.length,started:complete.length,
  independentModelCompletedRaces:complete.filter(row=>
    row.positionKm===row.plannedKm).length,
  sourceAlignedRaces:complete.filter(row=>
    row.sourceAlignedKm===row.plannedKm).length,
  paidFrontPasses:complete.reduce((sum,row)=>
    sum+row.paidFrontPasses,0),
  blockedPassingLanes:complete.reduce((sum,row)=>
    sum+row.blockedPassingLanes,0),
  openPassingLanes:complete.reduce((sum,row)=>
    sum+row.openPassingLanes,0),
  officialResultsAvailable:0,
  readyForViewerPositions:false};
process.stdout.write(`${JSON.stringify({summary,rows},null,2)}\n`);
if(requireComplete)process.exitCode=1;
