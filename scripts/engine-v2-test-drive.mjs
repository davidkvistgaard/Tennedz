// Offline v91 motor test drive. It reads fictional settings and never saves a
// result, awards points, or calls the production game/database path.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareV91Playtest} from
  '../lib/engine/v2/playtest.mjs';
import {validateRequestedFinalePlans} from
  '../lib/engine/v2/playtest-finale-trial.mjs';
import {finaleSnapshotFromTour} from
  '../lib/engine/v2/finale-snapshot.mjs';
import {createV91ConditionalRaceFinal,
  createV91GroupFallbackFromLockedRace,
  validateV91ConditionalRaceFinal} from
  '../lib/engine/v2/playtest-race-final.mjs';
import {recordFinaleMultibandIndividualLine,
  validateFinaleMultibandIndividualLine} from
  '../lib/engine/v2/finale-multiband-individual-line.mjs';
import {recordFinaleSeparatedIndividualLine,
  validateFinaleSeparatedIndividualLine} from
  '../lib/engine/v2/finale-separated-individual-line.mjs';
import {recordFinaleDepletedIndividualLine,
  validateFinaleDepletedIndividualLine} from
  '../lib/engine/v2/finale-depleted-individual-line.mjs';
import {projectV91ProvisionalPointPreview,
  projectV91ProvisionalMultibandPointPreview} from
  '../lib/engine/v2/playtest-point-preview.mjs';

const REFUSALS=new Set([
  'The inactive-intents bunch has an unresolved road action.',
  'The cooperative group has an unresolved last-kilometre road action.',
  'Finisher and lead-out plans are not paid for a road group.',
  'Finisher and lead-out plans are not paid for road groups.',
  'Finisher and lead-out plans are not paid for depleted road bands.',
  'Finisher and lead-out plans are not paid for dropped road bands.',
  'The separated last-kilometre finale needs recorded response or front rotation.',
  'An early bunch plan needs one inactive-attack bunch.',
]);

function requestFor(scenario){
  const settings=scenario?.settings;
  const {teams}=prepareV91Playtest(settings);
  const overrides=scenario?.finalePlans??[];
  if(!Array.isArray(overrides)||overrides.some(row=>!row||
    typeof row!=='object'||Array.isArray(row)||
    Object.keys(row).some(key=>
      !['teamId','finisherId','leadOutRiderId'].includes(key))||
    !teams.some(team=>team.id===row.teamId))||
    new Set(overrides.map(row=>row.teamId)).size!==overrides.length)
    throw new Error('Choose at most one finale override per known manager.');
  const request={};
  if(scenario?.attack!==undefined){
    if(!scenario.attack||typeof scenario.attack!=='object'||
      Array.isArray(scenario.attack)||
      Object.keys(scenario.attack).sort().join(',')!=='riderId,teamId')
      throw new Error('Choose one named team and rider attack.');
    request.attackTeamId=scenario.attack.teamId;
    request.attackRiderId=scenario.attack.riderId;
  }
  if(overrides.length){
    const byTeam=new Map(overrides.map(row=>[row.teamId,row]));
    request.plans=teams.map(team=>({teamId:team.id,
      finisherId:byTeam.get(team.id)?.finisherId??team.orders.captainId,
      leadOutRiderId:byTeam.get(team.id)?.leadOutRiderId??null}));
    validateRequestedFinalePlans(request.plans,teams);
  }
  return request;
}

function summaryFor(trial,request,pointContext){
  const {recording,paidFinale}=trial;
  const lastKm=recording.frames[recording.route.distanceKm-2];
  const allTeams=recording.committedInputs.teams;
  const decisions=allTeams.map(team=>({teamId:team.id,
    baseline:team.orders.baseline,
    finisherId:trial.finalePlans?.find(row=>row.teamId===team.id)
      ?.finisherId??null,
    leadOutRiderId:trial.finalePlans?.find(row=>row.teamId===team.id)
      ?.leadOutRiderId??null}));
  return {version:'v91-offline-test-drive-1',
    input:trial.settings,request,engineVersion:trial.version,
    roadStatus:trial.roadStatus,
    resultStatus:trial.classifiedResults===null?'unclassified':'classified',
    pointsStatus:trial.pointsStatus,canCommitAwards:trial.canCommitAwards,
    managerDecisions:decisions,
    ...(pointContext?{provisionalPointPreview:
      trial.roadStatus==='paid_conditional_line'?
        projectV91ProvisionalPointPreview(trial,pointContext):
        {status:'unavailable',reason:'No complete individual line.'}}:{}),
    lastKmSource:{roadGroups:lastKm.roadGroups.map(group=>({
      id:group.id,gapSeconds:group.gapSeconds,
      riderIds:group.riderIds})),
    droppedRiderIds:lastKm.riderGroups.filter(row=>
      row.group==='dropped').map(row=>row.id),
    chaserTeamIds:lastKm.chasers},
    finale:trial.roadStatus==='paid_group_bands'?{
      outcome:paidFinale.line.outcome,
      roadFrames:paidFinale.roadFrames.map(frame=>({
        elapsedSecondsFromBunchMarker:frame.elapsedSecondsFromBunchMarker,
        bunchPositionM:frame.bunchPositionM,
        frontPositionM:frame.frontPositionM,contact:frame.contact})),
      finalRiderEnergy:paidFinale.line.finalRiderEnergy,
      roadPlaceBounds:trial.roadPlaceBounds,
      individualFinishStatus:'unresolved_within_road_bands'}:
      trial.roadStatus==='paid_separated_bands'||
      trial.roadStatus==='recorded_depleted_bands'||
      trial.roadStatus==='recorded_dropped_bands'?{
        outcome:paidFinale.line.outcome,
        passageFrames:paidFinale.passageFrames,
        bands:paidFinale.line.bands,
        finalRiderEnergy:paidFinale.line.finalRiderEnergy,
        ...(['recorded_depleted_bands','recorded_dropped_bands']
          .includes(trial.roadStatus)?{
          reserveStatus:paidFinale.passageFrames
            .flatMap(frame=>frame.droppedPassages)
            .some(row=>row.unmetEnergyDemand>0)?
              'energy_demand_saturated_at_zero':'energy_demand_paid',
          totalUnmetEnergyDemand:paidFinale.passageFrames
            .flatMap(frame=>frame.droppedPassages)
            .reduce((sum,row)=>sum+row.unmetEnergyDemand,0)}:{}),
        individualFinishStatus:'unresolved_within_road_bands'}:{
      individualFinishStatus:'conditional_inferred_wheels',
      lineTimes:paidFinale.finishers,
      provisionalLineOrder:paidFinale.lineOrder??null,
      positionSourceStatus:paidFinale.positionSourceStatus,
      passingRule:paidFinale.passingRule??null,
      roadEvents:paidFinale.frames.flatMap(frame=>
        frame.roadEvents??[]),
      leadOutWork:paidFinale.frames.flatMap(frame=>frame.riders.filter(
        row=>row.role?.startsWith('lead_out')).map(row=>({
          riderId:row.riderId,role:row.role,
          energySpent:row.energySpent,
          distanceTravelledM:row.distanceTravelledM}))),
    }};
}

function summaryForIndividualGroupLine(trial,request,pointContext,line){
  const base=summaryFor(trial,request,pointContext);
  const decisions=new Map(line.sprintPlan.decisions.map(row=>
    [row.teamId,row]));
  return {...base,version:line.pre500ContactStatus?
    'v91-offline-test-drive-3':'v91-offline-test-drive-2',
    roadStatus:line.pre500ContactStatus?
      'conditional_depleted_line':'conditional_multiband_line',
    individualLineVersion:line.version,
    ...(pointContext?{provisionalPointPreview:
      line.provisionalLineOrder?.every(row=>row.position!==null)?
        projectV91ProvisionalMultibandPointPreview(
          trial.recording,line,pointContext):
        {status:'unavailable',reason:line.pre500ContactStatus?
          'Dropped-rider contact before 500 m remains unresolved.':
          line.overlapAudit.firstPotentialOverlap?
            'Cross-band contact remains unresolved.':
            'The provisional line contains an unresolved place.'}}:{}),
    managerDecisions:base.managerDecisions.map(row=>({
      ...row,finisherId:decisions.get(row.teamId).finisherId,
      leadOutRiderId:decisions.get(row.teamId).leadOutRiderId})),
    finale:{
      paidPassagesTo500:trial.roadStatus==='paid_group_bands'?
        trial.paidFinale.line.approachFrames.filter(
          frame=>frame.endDistanceM<=line.lineDistanceM-500)
          .map(frame=>({endDistanceM:frame.endDistanceM,
            frontElapsedSeconds:frame.frontElapsedSeconds,
            pelotonElapsedSeconds:frame.pelotonElapsedSeconds,
            frontWorkerRiderIds:frame.frontWorkerRiderIds??[],
            chasePullRiderId:frame.chasePullRiderId})):
        trial.paidFinale.passageFrames.filter(frame=>
          frame.distanceM<=line.lineDistanceM-500)
          .map(frame=>({endDistanceM:frame.distanceM,
            bunchPassageSecondsFromBunchMarker:
              frame.bunchPassageSecondsFromBunchMarker,
            groups:frame.groups,
            ...(frame.droppedPassages?{
              droppedPassages:frame.droppedPassages}:{})})),
      individualFinishStatus:
        line.pre500ContactStatus?
          'conditional_dropped_pre500_contact_unresolved':
          'conditional_band_local_cross_band_contact_unresolved',
      ...(line.pre500ContactStatus?{
        pre500ContactStatus:line.pre500ContactStatus}:{}),
      overlapAudit:line.overlapAudit,
      lineTimes:line.conditionalCrossings,
      provisionalLineOrder:line.provisionalLineOrder,
      positionSourceStatus:line.positionedSource.status,
      roadEvents:line.bandRunners.flatMap(band=>
        band.runner.frames.flatMap(frame=>frame.roadEvents??[])),
      leadOutWork:line.bandRunners.flatMap(band=>
        band.runner.frames.flatMap(frame=>frame.riders.filter(row=>
          row.role?.startsWith('lead_out')).map(row=>({
            roadBandId:band.roadBandId,riderId:row.riderId,
            role:row.role,energySpent:row.energySpent,
            distanceTravelledM:row.distanceTravelledM})))),
      finalRiderEnergy:line.conditionalCrossings.map(row=>({
        riderId:row.riderId,energy:row.energyAtLine}))}};
}

export function runV91TestDrive(scenario,{full=false}={}){
  if(!scenario||typeof scenario!=='object'||Array.isArray(scenario)||
    Object.keys(scenario).some(key=>
      !['settings','attack','finalePlans','pointContext',
        'individualGroupLine'].includes(key))||
    scenario.individualGroupLine!==undefined&&
      typeof scenario.individualGroupLine!=='boolean')
    throw new Error('Choose settings, an optional attack and finale plans.');
  const pointContext=scenario.pointContext??null;
  if(pointContext!==null&&(!pointContext||
    typeof pointContext!=='object'||Array.isArray(pointContext)||
    Object.keys(pointContext).sort().join(',')!==
      'divisionCount,divisionIndex,tier'||
    !Number.isInteger(pointContext.tier)||pointContext.tier<1||
    pointContext.tier>6||
    !Number.isInteger(pointContext.divisionCount)||
    pointContext.divisionCount<1||
    !Number.isInteger(pointContext.divisionIndex)||
    pointContext.divisionIndex<1||
    pointContext.divisionIndex>pointContext.divisionCount))
    throw new Error('Choose a valid optional preview point context.');
  const request=requestFor(scenario);
  let trial;
  let recoveredGroupPlan=false;
  try{trial=createV91ConditionalRaceFinal(scenario.settings,request);}
  catch(error){
    if(!REFUSALS.has(error.message))throw error;
    const source=request.attackTeamId===undefined?
      error.cause?.playtestSource??null:null;
    if(scenario.individualGroupLine===true&&source&&
      ['Finisher and lead-out plans are not paid for a road group.',
        'Finisher and lead-out plans are not paid for road groups.',
        'Finisher and lead-out plans are not paid for depleted road bands.',
        'Finisher and lead-out plans are not paid for dropped road bands.']
        .includes(error.message)){
      trial=createV91GroupFallbackFromLockedRace(source);
      recoveredGroupPlan=true;
    }else{
      const snapshot=source?finaleSnapshotFromTour(source.recording,{
        remainingKm:1,includeAttackLoad:true}):null;
      return {version:'v91-offline-test-drive-1',status:'unsupported',
        input:prepareV91Playtest(scenario.settings).settings,
        request,reason:error.message,
        ...(snapshot?{lastKmSource:{
          roadGroups:snapshot.roadGroups.map(group=>({
            id:group.id,gapSeconds:group.gapSeconds,
            riderIds:group.riderIds})),
          droppedRiderIds:snapshot.droppedRiderIds,
          chaserTeamIds:source.recording.frames[snapshot.sourceKm-1].chasers
        }}:{}),pointsStatus:'withheld',
        ...(pointContext?{provisionalPointPreview:{status:'unavailable',
          reason:'No complete individual line.'}}:{}),
        canCommitAwards:false};
    }
  }
  validateV91ConditionalRaceFinal(scenario.settings,recoveredGroupPlan?
    {...request,plans:null}:request,trial);
  if(scenario.individualGroupLine===true&&
    ['paid_group_bands','paid_separated_bands',
      'recorded_depleted_bands','recorded_dropped_bands']
      .includes(trial.roadStatus)){
    const separated=trial.roadStatus==='paid_separated_bands';
    const depleted=['recorded_depleted_bands','recorded_dropped_bands']
      .includes(trial.roadStatus);
    if(depleted&&trial.paidFinale.passageFrames.some(frame=>
      frame.droppedPassages.some(row=>row.unmetEnergyDemand>0))){
      const base=summaryFor(trial,request,pointContext);
      const summary=request.plans?{...base,status:'unsupported',
        individualLineStatus:'unpaid_dropped_travel',
        reason:'The nominated finale cannot run with unmet dropped-rider energy demand.'}:base;
      return full?{summary,recording:trial}:summary;
    }
    const record=depleted?recordFinaleDepletedIndividualLine:
      separated?recordFinaleSeparatedIndividualLine:
        recordFinaleMultibandIndividualLine;
    const validate=depleted?validateFinaleDepletedIndividualLine:
      separated?validateFinaleSeparatedIndividualLine:
        validateFinaleMultibandIndividualLine;
    let individualLine;
    try{
      individualLine=record(trial.recording,trial.paidFinale,
        {plans:request.plans??null});
    }catch(error){
      if(error.message!==
        'The nominated lead-out cannot work beside the finisher.')
        throw error;
      const base=summaryFor(trial,request,pointContext);
      const summary={...base,status:'unsupported',
        individualLineStatus:'unsupported_plan',reason:error.message};
      return full?{summary,recording:trial}:summary;
    }
    validate(trial.recording,trial.paidFinale,
      {plans:request.plans??null},individualLine);
    const summary=summaryForIndividualGroupLine(trial,request,
      pointContext,individualLine);
    return full?{summary,recording:trial,individualLine}:summary;
  }
  if(!['paid_conditional_line','paid_group_bands','paid_separated_bands',
    'recorded_depleted_bands','recorded_dropped_bands']
    .includes(trial.roadStatus)){
    const summary={version:'v91-offline-test-drive-1',
      status:'unsupported',input:trial.settings,request,
      engineVersion:trial.version,reason:trial.roadStatus,
      ...(pointContext?{provisionalPointPreview:{status:'unavailable',
        reason:'No complete individual line.'}}:{}),
      pointsStatus:'withheld',canCommitAwards:false};
    return full?{summary,recording:trial}:summary;
  }
  const summary=summaryFor(trial,request,pointContext);
  return full?{summary,recording:trial}:summary;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(
  resolve(process.argv[1])).href){
  const [path,flag]=process.argv.slice(2);
  if(!path||flag!==undefined&&flag!=='--full')
    throw new Error('Usage: node scripts/engine-v2-test-drive.mjs input.json [--full]');
  const raw=readFileSync(path==='-'?0:path,'utf8').replace(/^\uFEFF/,'');
  const result=runV91TestDrive(JSON.parse(raw),{full:flag==='--full'});
  console.log(JSON.stringify(result,null,2));
}
