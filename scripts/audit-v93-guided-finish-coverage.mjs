// Read-only coverage audit for the guided v93 final kilometre. A refusal is
// counted only after its attached kilometre road validates in full.
import {createV93CoastedPlaytest,validateV93CoastedPlaytest} from
  '../lib/engine/v2/playtest-v93-coasted.mjs';
import {resolveRandomRivalTactics} from
  '../lib/engine/v2/playtest-rival-random.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {generatePlaytestStageProfile} from
  '../lib/engine/v2/playtest-stage-generator.mjs';
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION,TUNING} from
  '../lib/engine/v2/tuning.mjs';
import {finaleSnapshotFromTour} from
  '../lib/engine/v2/finale-snapshot.mjs';
import {orderAt} from '../lib/engine/v2/orders.mjs';
import {finaleDistanceGrid} from '../lib/engine/v2/finale-grid.mjs';
import {planFinaleBunchFrontWork} from
  '../lib/engine/v2/finale-bunch-front-work.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  validateFinaleSeparatedGroupsFromTour,
  FINALE_COAST_NO_FRONT_PAID_BUNCH_VERSION,
  FINALE_COAST_ONE_FRONT_PAID_BUNCH_VERSION,
  FINALE_COAST_TWO_FRONT_PAID_BUNCH_VERSION,
  FINALE_COAST_THREE_FRONT_PAID_BUNCH_VERSION,
  FINALE_COAST_UNAVAILABLE_FRONT_CATCH_VERSION,
  FINALE_COAST_PAYABLE_FRONT_CATCH_VERSION,
  FINALE_PAID_BUNCH_ONLY_VERSION,
  FINALE_DYNAMIC_NO_FRONT_PAID_BUNCH_VERSION,
  FINALE_COAST_FRONT_CATCH_LAST_KM_VERSION} from
  '../lib/engine/v2/finale-multi-run.mjs';
import {recordFinaleCoastNoFrontPaidBunchClock,
  validateFinaleCoastNoFrontPaidBunchClock,
  recordFinaleCoastOneFrontPaidBunchClock,
  validateFinaleCoastOneFrontPaidBunchClock,
  recordFinaleCoastTwoFrontPaidBunchClock,
  validateFinaleCoastTwoFrontPaidBunchClock,
  recordFinaleCoastThreeFrontPaidBunchClock,
  validateFinaleCoastThreeFrontPaidBunchClock,
  recordFinaleCoastUnavailableFrontCatchClock,
  validateFinaleCoastUnavailableFrontCatchClock,
  recordFinaleCoastPayableFrontCatchClock,
  validateFinaleCoastPayableFrontCatchClock,
  recordFinalePaidBunchOnlyClock,
  validateFinalePaidBunchOnlyClock,
  recordFinaleDynamicNoFrontPaidBunchClock,
  validateFinaleDynamicNoFrontPaidBunchClock,
  recordFinaleCoastFrontCatchLastKmClock,
  validateFinaleCoastFrontCatchLastKmClock,
  recordFinaleLateChaseCatchClock,
  validateFinaleLateChaseCatchClock} from
  '../lib/engine/v2/finale-separated-last-km.mjs';

const countArg=process.argv.find(value=>value.startsWith('--seeds='));
const count=countArg?Number(countArg.slice('--seeds='.length)):12;
const startArg=process.argv.find(value=>value.startsWith('--seed-start='));
const seedStart=startArg?Number(startArg.slice('--seed-start='.length)):1;
const namedFrontWork=process.argv.includes('--named-front-work');
const terrainArg=process.argv.find(value=>value.startsWith('--terrain='));
const terrainFilter=terrainArg?.slice('--terrain='.length)??null;
const fatigueArg=process.argv.find(value=>value.startsWith('--fatigue='));
const fatigueFilter=fatigueArg===undefined?null:Number(fatigueArg.slice(
  '--fatigue='.length));
const frontEffortArg=process.argv.find(value=>
  value.startsWith('--front-effort='));
const frontEffort=frontEffortArg?.slice('--front-effort='.length)??null;
if(!Number.isInteger(count)||count<1||count>48||
  !Number.isInteger(seedStart)||seedStart<1||seedStart+count-1>96)
  throw new Error('Choose up to 48 seeds inside the first 96 seed numbers.');
if(frontEffort!==null&&(!namedFrontWork||
  !['hard','conserve'].includes(frontEffort)))
  throw new Error('Use hard or conserve with --named-front-work.');
if(terrainFilter!==null&&!(namedFrontWork?['rolling','mountain']:
  ['flat','mountain']).includes(terrainFilter)||
  fatigueFilter!==null&&![0,30].includes(fatigueFilter))
  throw new Error('Choose an audited terrain and fatigue.');

function seededRandom(label){
  let state=2166136261;
  for(const character of label)
    state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
}

const rows=[];
for(const terrain of (namedFrontWork?['rolling','mountain']:
  ['flat','mountain']).filter(value=>terrainFilter===null||
  value===terrainFilter))for(const fatigue of [0,30].filter(value=>
    fatigueFilter===null||value===fatigueFilter))
  for(let index=0;index<count;index++){
    const seed=`guided-finish-coverage-${seedStart+index}`;
    const managerTactics=resolveRandomRivalTactics({teamCount:20,
      random:seededRandom(`${seed}:${terrain}:${fatigue}`)});
    const settings={distanceKm:260,
      terrain:namedFrontWork?'custom':terrain,
      ...(namedFrontWork?{profileHeightsM:generatePlaytestStageProfile({
        distanceKm:260,style:terrain,seed})}:{}),
      teamCount:20,fatigue,attack:'none',
      chase:namedFrontWork?'selective':'ignore',seed,managerTactics,
      ...(namedFrontWork?{managerTacticalOrdersV8:[
        {teamId:'you',atKm:5,attack:'selective',attackRiderId:'you-2',
          chaseTarget:'rival-1-2',frontWork:'rotate',
          frontWorkRiderId:'you-5',
          ...(frontEffort?{effort:frontEffort}:{})},
        {teamId:'you',atKm:25,attack:'none'}]}:{})};
    const input={plans:Array.from({length:20},(_,teamIndex)=>{
      const teamId=teamIndex?`rival-${teamIndex}`:'you';
      return {teamId,finisherId:`${teamId}-7`,leadOutRiderId:null};
    })};
    try{
      const race=createV93CoastedPlaytest(settings,input);
      validateV93CoastedPlaytest(settings,input,race);
      const frames=race.recording.frames;
      rows.push({seed,terrain,fatigue,status:'paid_finish',
        version:race.version,roadKm:frames.length,
        maxGapSeconds:Math.max(...frames.map(frame=>frame.gapSeconds)),
        kmAtLeastOneMinute:frames.filter(frame=>
          frame.gapSeconds>=60).length});
    }catch(error){
      const road=error.cause?.playtestSource?.recording??
        simulateTacticalTour({...prepareV91Playtest(settings),
          motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
      validateRecordedTour(road);
      const maxGapSeconds=Math.max(...road.frames.map(frame=>
        frame.gapSeconds));
      const kmAtLeastOneMinute=road.frames.filter(frame=>
        frame.gapSeconds>=60).length;
      const handoff=road.frames.at(-2);
      const snapshot=finaleSnapshotFromTour(road,{remainingKm:1,
        includeAttackLoad:true});
      const own=road.committedInputs.teams.find(team=>team.id==='you');
      const ownOrder=orderAt(own.orders,road.route.distanceKm-1);
      const present=new Map(snapshot.riders.map(row=>[row.riderId,row]));
      const firstSlice=finaleDistanceGrid(road.route,{remainingKm:1})[0];
      const frontWorkCandidate=planFinaleBunchFrontWork({
        teams:road.committedInputs.teams,
        pelotonRiderIds:snapshot.peloton.riderIds,
        energies:new Map(snapshot.riders.map(row=>[row.riderId,row.energy])),
        aheadTeamIds:snapshot.roadGroups.flatMap(group=>group.teamIds),
        segment:road.route.kilometres[firstSlice.sourceKm-1],
        sourceKm:firstSlice.sourceKm,
        sliceLengthKm:firstSlice.lengthM/1000});
      let noFrontPaidTrace=null;
      let oneFrontPaidTrace=null;
      let twoFrontPaidTrace=null;
      let threeFrontPaidTrace=null;
      let unavailableFrontCatch=null;
      let payableFrontCatch=null;
      let paidBunchOnly=null;
      let dynamicNoFrontPaidTrace=null;
      let ordinaryFrontCatchTrace=null;
      let lateChaseCatchTrace=null;
      if(!namedFrontWork&&snapshot.roadGroups.length===1){
        let traceEvidence=null;
        try{
          const trace=probeFinaleSeparatedGroupsFromTour(road,{
            version:FINALE_COAST_FRONT_CATCH_LAST_KM_VERSION});
          validateFinaleSeparatedGroupsFromTour(road,trace);
          traceEvidence={contactDistanceM:trace.frames.find(frame=>
            frame.contact)?.contact.atDistanceM??null,
          contactPaidChaseRiderId:trace.frames.find(frame=>
            frame.contact)?.bunchPullRiderId??null,
          paidChaseSlices:trace.frames.filter(frame=>
            frame.bunchPullRiderId!==null).length,
          exhaustionDrops:trace.frames.reduce((sum,frame)=>
            sum+frame.exhaustionDrops.length,0)};
          const clock=recordFinaleCoastFrontCatchLastKmClock(road);
          validateFinaleCoastFrontCatchLastKmClock(road,clock);
          ordinaryFrontCatchTrace={status:'replayed',
            ...traceEvidence};
        }catch(candidateError){
          ordinaryFrontCatchTrace={status:'refused',
            reason:candidateError.message,...traceEvidence};
        }
      }
      if(!namedFrontWork&&snapshot.roadGroups.length===1)
        try{
          const clock=recordFinaleLateChaseCatchClock(road);
          validateFinaleLateChaseCatchClock(road,clock);
          if(clock.line.bands.at(-1)?.lastPossiblePlace!==
              road.committedInputs.teams.length*8||
            clock.canCommitAwards!==false)
            throw new Error('The late chase catch lost its locked riders.');
          lateChaseCatchTrace={status:'replayed',
            contactDistanceM:clock.contact.atDistanceM,
            paidChaseSlices:clock.trace.frames.filter(frame=>
              frame.bunchPullRiderId!==null).length};
        }catch(candidateError){
          lateChaseCatchTrace={status:'refused',
            reason:candidateError.message};
        }
      if(snapshot.roadGroups.length===0&&
        snapshot.droppedRiderIds.length===0)
        try{
          const trace=probeFinaleSeparatedGroupsFromTour(road,{
            version:FINALE_PAID_BUNCH_ONLY_VERSION});
          validateFinaleSeparatedGroupsFromTour(road,trace);
          const clock=recordFinalePaidBunchOnlyClock(road);
          validateFinalePaidBunchOnlyClock(road,clock);
          if(clock.line.bands[0]?.lastPossiblePlace!==
              road.committedInputs.teams.length*8||
            clock.canCommitAwards!==false)
            throw new Error('The paid bunch-only line lost locked riders.');
          paidBunchOnly={status:'replayed',
            paidSlices:trace.frames.filter(frame=>
              frame.bunchFrontWork!==null).length,
            lineBands:clock.line.bands.map(band=>band.kind)};
        }catch(candidateError){
          paidBunchOnly={status:'refused',reason:candidateError.message};
        }
      if(snapshot.roadGroups.length===0&&snapshot.droppedRiderIds.length)
        try{
          const trace=probeFinaleSeparatedGroupsFromTour(road,{
            version:FINALE_COAST_NO_FRONT_PAID_BUNCH_VERSION});
          validateFinaleSeparatedGroupsFromTour(road,trace);
          const clock=recordFinaleCoastNoFrontPaidBunchClock(road);
          validateFinaleCoastNoFrontPaidBunchClock(road,clock);
          if(clock.trace.version!==trace.version||
            clock.line.bands.at(-1)?.lastPossiblePlace!==
              road.committedInputs.teams.length*8||
            clock.canCommitAwards!==false)
            throw new Error('The candidate line lost its locked riders.');
          for(const frame of trace.frames)
            for(const worker of frame.bunchFrontWork?.workers??[]){
              const paid=frame.riders.find(row=>
                row.riderId===worker.riderId);
              if(paid?.role!=='pull'||
                Math.abs(paid.energySpent-worker.energySpent)>1e-8)
                throw new Error('A planned bunch-front worker was not paid.');
            }
          noFrontPaidTrace={status:'replayed',
            paidSlices:trace.frames.filter(frame=>
              frame.bunchFrontWork!==null).length,
            finalRiderEnergy:trace.finalRiderEnergy,
            lineBands:clock.line.bands.map(band=>band.kind)};
        }catch(candidateError){
          noFrontPaidTrace={status:'refused',reason:candidateError.message};
        }
      if(snapshot.roadGroups.length===0&&snapshot.droppedRiderIds.length&&
        noFrontPaidTrace?.status==='refused')
        try{
          const trace=probeFinaleSeparatedGroupsFromTour(road,{
            version:FINALE_DYNAMIC_NO_FRONT_PAID_BUNCH_VERSION});
          validateFinaleSeparatedGroupsFromTour(road,trace);
          const clock=recordFinaleDynamicNoFrontPaidBunchClock(road);
          validateFinaleDynamicNoFrontPaidBunchClock(road,clock);
          if(clock.line.bands.at(-1)?.lastPossiblePlace!==
              road.committedInputs.teams.length*8||
            clock.canCommitAwards!==false)
            throw new Error('The dynamic paid-bunch line lost its riders.');
          for(const frame of trace.frames)
            for(const worker of frame.bunchFrontWork?.workers??[]){
              const paid=frame.riders.find(row=>
                row.riderId===worker.riderId);
              if(paid?.role!=='pull'||
                Math.abs(paid.energySpent-worker.energySpent)>1e-8)
                throw new Error('A dynamic bunch-front worker was not paid.');
            }
          dynamicNoFrontPaidTrace={status:'replayed',
            newDropRiders:trace.frames.reduce((sum,frame)=>
              sum+frame.exhaustionDrops.length,0),
            lineBands:clock.line.bands.map(band=>band.kind)};
        }catch(candidateError){
          dynamicNoFrontPaidTrace={status:'refused',
            reason:candidateError.message};
        }
      if(snapshot.roadGroups.length===1)
        try{
          const trace=probeFinaleSeparatedGroupsFromTour(road,{
            version:FINALE_COAST_ONE_FRONT_PAID_BUNCH_VERSION});
          validateFinaleSeparatedGroupsFromTour(road,trace);
          const clock=recordFinaleCoastOneFrontPaidBunchClock(road);
          validateFinaleCoastOneFrontPaidBunchClock(road,clock);
          if(clock.trace.version!==trace.version||
            clock.line.bands.at(-1)?.lastPossiblePlace!==
              road.committedInputs.teams.length*8||
            clock.canCommitAwards!==false)
            throw new Error('The one-front line lost its locked riders.');
          for(const frame of trace.frames)
            for(const worker of frame.bunchFrontWork?.workers??[]){
              const paid=frame.riders.find(row=>
                row.riderId===worker.riderId);
              if(paid?.role!=='pull'||
                Math.abs(paid.energySpent-worker.energySpent)>1e-8)
                throw new Error('A one-front bunch worker was not paid.');
            }
          oneFrontPaidTrace={status:'replayed',
            paidSlices:trace.frames.filter(frame=>
              frame.bunchFrontWork!==null).length,
            finalGapSeconds:trace.frames.at(-1).roadGroups[0]?.gapSeconds,
            lineBands:clock.line.bands.map(band=>band.kind)};
        }catch(candidateError){
          oneFrontPaidTrace={status:'refused',reason:candidateError.message};
        }
      if(snapshot.roadGroups.length===1&&
        oneFrontPaidTrace?.status==='refused')
        try{
          const trace=probeFinaleSeparatedGroupsFromTour(road,{
            version:FINALE_COAST_UNAVAILABLE_FRONT_CATCH_VERSION});
          validateFinaleSeparatedGroupsFromTour(road,trace);
          const clock=recordFinaleCoastUnavailableFrontCatchClock(road);
          validateFinaleCoastUnavailableFrontCatchClock(road,clock);
          if(trace.frames.some(frame=>frame.bunchFrontWork!==null)||
            clock.line.bands[0]?.lastPossiblePlace!==
              road.committedInputs.teams.length*8||
            clock.canCommitAwards!==false)
            throw new Error('The unavailable-front catch lost its source.');
          unavailableFrontCatch={status:'replayed',
            contactDistanceM:clock.contact.atDistanceM,
            lineBands:clock.line.bands.map(band=>band.kind)};
        }catch(candidateError){
          unavailableFrontCatch={status:'refused',
            reason:candidateError.message};
        }
      if(snapshot.roadGroups.length===2)
        try{
          const trace=probeFinaleSeparatedGroupsFromTour(road,{
            version:FINALE_COAST_TWO_FRONT_PAID_BUNCH_VERSION});
          validateFinaleSeparatedGroupsFromTour(road,trace);
          const clock=recordFinaleCoastTwoFrontPaidBunchClock(road);
          validateFinaleCoastTwoFrontPaidBunchClock(road,clock);
          if(clock.trace.version!==trace.version||
            clock.line.bands.at(-1)?.lastPossiblePlace!==
              road.committedInputs.teams.length*8||
            clock.canCommitAwards!==false)
            throw new Error('The two-front line lost its locked riders.');
          for(const frame of trace.frames)
            for(const worker of frame.bunchFrontWork?.workers??[]){
              const paid=frame.riders.find(row=>
                row.riderId===worker.riderId);
              if(paid?.role!=='pull'||
                Math.abs(paid.energySpent-worker.energySpent)>1e-8)
                throw new Error('A two-front bunch worker was not paid.');
            }
          twoFrontPaidTrace={status:'replayed',
            paidSlices:trace.frames.filter(frame=>
              frame.bunchFrontWork!==null).length,
            finalGapsSeconds:trace.frames.at(-1).roadGroups.map(group=>
              group.gapSeconds),
            lineBands:clock.line.bands.map(band=>band.kind)};
        }catch(candidateError){
          twoFrontPaidTrace={status:'refused',reason:candidateError.message};
        }
      if(snapshot.roadGroups.length===3)
        try{
          const trace=probeFinaleSeparatedGroupsFromTour(road,{
            version:FINALE_COAST_THREE_FRONT_PAID_BUNCH_VERSION});
          validateFinaleSeparatedGroupsFromTour(road,trace);
          const clock=recordFinaleCoastThreeFrontPaidBunchClock(road);
          validateFinaleCoastThreeFrontPaidBunchClock(road,clock);
          if(clock.trace.version!==trace.version||
            clock.line.bands.at(-1)?.lastPossiblePlace!==
              road.committedInputs.teams.length*8||
            clock.canCommitAwards!==false)
            throw new Error('The three-front line lost its locked riders.');
          for(const frame of trace.frames)
            for(const worker of frame.bunchFrontWork?.workers??[]){
              const paid=frame.riders.find(row=>
                row.riderId===worker.riderId);
              if(paid?.role!=='pull'||
                Math.abs(paid.energySpent-worker.energySpent)>1e-8)
                throw new Error('A three-front bunch worker was not paid.');
            }
          threeFrontPaidTrace={status:'replayed',
            paidSlices:trace.frames.filter(frame=>
              frame.bunchFrontWork!==null).length,
            finalGapsSeconds:trace.frames.at(-1).roadGroups.map(group=>
              group.gapSeconds),
            lineBands:clock.line.bands.map(band=>band.kind)};
        }catch(candidateError){
          threeFrontPaidTrace={status:'refused',
            reason:candidateError.message};
        }
      if(snapshot.roadGroups.length===1)
        try{
          const trace=probeFinaleSeparatedGroupsFromTour(road,{
            version:FINALE_COAST_PAYABLE_FRONT_CATCH_VERSION});
          validateFinaleSeparatedGroupsFromTour(road,trace);
          const clock=recordFinaleCoastPayableFrontCatchClock(road);
          validateFinaleCoastPayableFrontCatchClock(road,clock);
          if(clock.line.bands[0]?.lastPossiblePlace!==
              road.committedInputs.teams.length*8||
            clock.canCommitAwards!==false)
            throw new Error('The payable-front catch lost locked riders.');
          payableFrontCatch={status:'replayed',
            contactDistanceM:clock.contact.atDistanceM,
            contactWorkerIds:trace.frames.find(frame=>frame.contact)
              ?.bunchFrontWork?.riderIds??[],
            paidSlices:trace.frames.filter(frame=>
              frame.bunchFrontWork!==null).length};
        }catch(candidateError){
          payableFrontCatch={status:'refused',
            reason:candidateError.message};
        }
      const eligibleHelpers=own.orders.helperIds.filter(id=>{
        const row=present.get(id);
        return row?.status==='peloton'&&
          row.energy>TUNING.chase.minHelperEnergy;
      });
      rows.push({seed,terrain,fatigue,status:'validated_refusal',
        reason:error.message,roadKm:road.frames.length,
        maxGapSeconds,kmAtLeastOneMinute,
        handoffKm:handoff?.km??null,
        handoffRoadGroups:handoff?.roadGroups.length??null,
        handoffFrontGroups:snapshot.roadGroups.map(group=>({
          id:group.id,gapSeconds:group.gapSeconds,
          riderCount:group.riderIds.length,teamIds:group.teamIds})),
        handoffActiveBreakResponseTeamIds:
          handoff?.activeBreakResponseTeamIds??[],
        handoffActiveGcResponseTeamIds:
          handoff?.activeGcResponseTeamIds??[],
        handoffEngagedChaseTeamIds:handoff?.engagedChaseTeamIds??[],
        handoffDroppedRiders:handoff?.riderGroups.filter(row=>
          row.group==='dropped').length??null,
        ownNamedFrontWorker:ownOrder.frontWorkRiderId??null,
        priorKmPaidFrontTeam:handoff?.paidBunchPace?.teamId??null,
        priorKmPaidFrontRiders:handoff?.paidBunchPace?.riderIds??[],
        priorKmPaidFrontAbility:handoff?.paidBunchPace?.ability??null,
        handoffFrontWorkerEnergy:(handoff?.paidBunchPace?.riderIds??[])
          .map(riderId=>({riderId,
            energy:present.get(riderId)?.energy??null})),
        firstSliceFrontWorkCandidate:frontWorkCandidate,
        noFrontPaidTrace,
        ordinaryFrontCatchTrace,
        lateChaseCatchTrace,
        dynamicNoFrontPaidTrace,
        oneFrontPaidTrace,
        twoFrontPaidTrace,
        threeFrontPaidTrace,
        unavailableFrontCatch,
        payableFrontCatch,
        paidBunchOnly,
        ownTeamAhead:snapshot.roadGroups.some(group=>
          group.teamIds.includes('you')),
        ownEligibleFrontHelpers:eligibleHelpers,
        ownNamedFrontWorkerAvailable:eligibleHelpers.length>=2&&
          eligibleHelpers.includes(ownOrder.frontWorkRiderId)});
    }
  }

const counts=Object.groupBy(rows,row=>row.status==='paid_finish'?
  row.status:row.reason);
console.log(JSON.stringify({version:'v93-guided-finish-coverage-audit-1',
  note:'Synthetic seeded 20-team, 260 km guided-random inputs. No official awards.',
  namedFrontWork,
  seedStart,
  frontEffort,
  cases:rows.length,counts:Object.fromEntries(Object.entries(counts).map(
    ([key,items])=>[key,items.length])),rows},null,2));
