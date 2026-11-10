// Same-seed diagnostic of the opt-in fixed-lane position trace.
// Unsupported movement is reported rather than copied from group clocks.
import {preparePhysicalFirstSplitMotorInputV1} from
  '../lib/viewer/physical-first-split-test-race-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionFixedLaneConvoyKmV1} from
  '../lib/engine/v2/physical-first-position-fixed-lane-convoy-km-v1.mjs';
import {advancePhysicalFirstPositionHybridKmV1} from
  '../lib/engine/v2/physical-first-position-hybrid-km-v1.mjs';
import {PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-rotation-km-v2.mjs';
import {settlePhysicalFirstPositionFixedLaneFinishV1} from
  '../lib/engine/v2/physical-first-position-fixed-lane-finish-v1.mjs';

const grid={laneCount:4,wheelSpacingM:2.5,
  laneStaggerM:.08};
const smoke=process.argv.includes('--smoke');
const hybrid=process.argv.includes('--hybrid');
const advance=hybrid?
  advancePhysicalFirstPositionHybridKmV1:
  advancePhysicalFirstPositionFixedLaneConvoyKmV1;
const categories=['men','women'];
const terrains=smoke?['mountain']:
  ['flat','rolling','mountain'];
const chases=['selective','all'];
const seeds=smoke?['preview-recorded-road-1']:
  ['preview-recorded-road-1',
    'preview-recorded-road-2'];
const results=[];
for(const seed of seeds){
  for(const category of categories){
    for(const terrain of terrains){
      for(const chase of chases){
        const {input:base}=preparePhysicalFirstSplitMotorInputV1(
          category,{terrain,chase,attack:'none',seed});
        const input={...base,positionModelVersion:
          PHYSICAL_FIRST_POSITION_START_V2_VERSION};
        const source=runPhysicalFirstWholeRaceProbeV1(
          input);
        let prior=createPhysicalFirstPositionStartV2({
          input,grid});
        let firstUnsupported=null;
        let paidRiderKm=0;
        let matchingMembershipKm=0;
        let maxFrontClockDeltaSeconds=0;
        let rotationKm=0;
        let fixedLaneKm=0;
        let contactEvents=0;
        let frontPasses=0;
        for(const segment of input.kilometres){
          let next;
          try{
            next=advance({
              prior,segment,input});
          }catch(error){
            firstUnsupported={km:segment.km,
              reason:error.message};
            break;
          }
          const sourceState=source.states[segment.km];
          const paidIds=next.contactComponents[0];
          const sourceIds=[...sourceState.roads.find(
            road=>road.roadId==='peloton')
            .riderIds].sort();
          if(JSON.stringify(paidIds)===
            JSON.stringify(sourceIds))
            matchingMembershipKm++;
          maxFrontClockDeltaSeconds=Math.max(
            maxFrontClockDeltaSeconds,
            Math.abs(next.clockSeconds-
              sourceState.frontClockSeconds));
          paidRiderKm+=next.decisions.length;
          if(next.version===
            PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION)
            rotationKm++;
          else fixedLaneKm++;
          contactEvents+=next.contactEvents?.length??0;
          frontPasses+=Number(next.event?.type===
            'paid_front_pass');
          prior=next;
        }
        let finish=null;
        if(!firstUnsupported){
          try{
            const settled=settlePhysicalFirstPositionFixedLaneFinishV1({
              prior,input});
            const sourceFinishClock=new Map(
              source.states.at(-1).riders.map(row=>
                [row.riderId,row.clockSeconds]));
            finish={crossings:settled.finishCrossings.length,
              riderCount:prior.positions.length,
              maxOldGroupClockDeltaSeconds:Math.max(
                ...settled.finishCrossings.map(row=>
                  Math.abs(row.clockSeconds-
                    sourceFinishClock.get(row.riderId)))),
              officialResults:settled.officialResults};
          }catch(error){
            finish={unsupported:error.message};
          }
        }
        results.push({category,terrain,chase,seed,
          completedThroughKm:prior.sourceKm,
          paidRiderKm,matchingMembershipKm,
          rotationKm,fixedLaneKm,
          contactEvents,frontPasses,
          maxFrontClockDeltaSeconds,
          firstUnsupported,finish});
      }
    }
  }
}
process.stdout.write(`${JSON.stringify({
  version:'physical-first-position-fixed-lane-matrix-1',
  smoke,hybrid,caseCount:results.length,
  completeTraceCount:results.filter(row=>
    row.completedThroughKm===120).length,
  completeCrossingCount:results.filter(row=>
    Number.isInteger(row.finish?.crossings)&&
    row.finish.crossings===
      row.finish.riderCount).length,
  maxOldGroupClockDeltaSeconds:Math.max(
    ...results.map(row=>row.finish
      ?.maxOldGroupClockDeltaSeconds??0)),
  officialResultsCount:results.filter(row=>
    row.finish?.officialResults).length,
  results},null,2)}\n`);
