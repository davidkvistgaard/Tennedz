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
import {recordFinaleUnorderedDroppedIndividualLine,
  validateFinaleDepletedIndividualLine} from
  '../lib/engine/v2/finale-depleted-individual-line.mjs';
import {recordFinaleSingletonFrontIndividualLine,
  validateFinaleSingletonFrontIndividualLine} from
  '../lib/engine/v2/finale-singleton-front-individual-line.mjs';
import {recordFinaleNamedAttackDroppedRoadFromTour,
  validateFinaleNamedAttackDroppedRoadFromTour} from
  '../lib/engine/v2/finale-named-attack-dropped-road.mjs';
import {recordFinaleNamedDroppedIndividualLine,
  validateFinaleNamedDroppedIndividualLine} from
  '../lib/engine/v2/finale-named-dropped-individual-line.mjs';
import {recordFinaleNamedDroppedSurvivorLine,
  validateFinaleNamedDroppedSurvivorLine,
  FINALE_NAMED_DROPPED_SURVIVOR_LINE_VERSION} from
  '../lib/engine/v2/finale-named-dropped-survivor-line.mjs';
import {recordFinaleNamedDroppedLateCatchLine,
  validateFinaleNamedDroppedLateCatchLine,
  FINALE_NAMED_DROPPED_LATE_CATCH_LINE_VERSION} from
  '../lib/engine/v2/finale-named-dropped-late-catch-line.mjs';
import {projectV91ProvisionalPointPreview,
  projectV91ProvisionalMultibandPointPreview,
  projectV91ProvisionalNamedDroppedPointPreview,
  projectV91ProvisionalNamedDroppedSurvivorPointPreview,
  projectV91ProvisionalNamedDroppedLateCatchPointPreview} from
  '../lib/engine/v2/playtest-point-preview.mjs';

const REFUSALS=new Set([
  'The inactive-intents bunch has an unresolved road action.',
  'The cooperative group has an unresolved last-kilometre road action.',
  'The cooperative group has unpaid last-kilometre rider travel.',
  'Finisher and lead-out plans are not paid for a road group.',
  'Finisher and lead-out plans are not paid for road groups.',
  'Finisher and lead-out plans are not paid for depleted road bands.',
  'Finisher and lead-out plans are not paid for dropped road bands.',
  'The separated last-kilometre finale needs recorded response or front rotation.',
  'An early bunch plan needs one inactive-attack bunch.',
  'The nominated lead-out cannot work beside the finisher.',
  'The controlled finale trial needs one complete source bunch.',
]);

function expectedRefusal(message){
  return REFUSALS.has(message)||
    /^An early lead-out helper needs an adjacent lane: (?:you|rival-[1-9]\d*)\.$/
      .test(message);
}

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

function unsupportedRefusal(error,scenario,request,pointContext){
  const source=error.cause?.playtestSource??null;
  const snapshot=source?finaleSnapshotFromTour(source.recording,{
    remainingKm:1,includeAttackLoad:true}):null;
  return {version:request.attackTeamId!==undefined&&source?
    'v91-offline-test-drive-6':'v91-offline-test-drive-1',
    status:'unsupported',
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
  return {version:trial.roadStatus==='paid_conditional_line'?
    'v91-offline-test-drive-5':'v91-offline-test-drive-1',
    input:trial.settings,request,engineVersion:trial.version,
    roadStatus:trial.roadStatus,
    resultStatus:trial.classifiedResults===null?'unclassified':'classified',
    pointsStatus:trial.pointsStatus,canCommitAwards:trial.canCommitAwards,
    managerDecisions:decisions,
    ...(pointContext?{provisionalPointPreview:
      trial.roadStatus==='paid_conditional_line'&&
        paidFinale.positionSourceStatus===
          'provisional_inferred_independent_wheels'&&
        paidFinale.passingRule==='open-road-lab-1'&&
        Array.isArray(paidFinale.lineOrder)&&
        paidFinale.lineOrder.every(row=>row.position!==null)?
        projectV91ProvisionalPointPreview(trial,pointContext):
        {status:'unavailable',reason:trial.roadStatus===
          'paid_conditional_line'?'No unambiguous individual line.':
          'No complete individual line.'}}:{}),
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
      ...(trial.chaseAvailability?{
        chaseAvailability:trial.chaseAvailability}:{}),
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
      leadOutAttempts:paidFinale.frames.flatMap(frame=>
        (frame.assemblyAttempts??[]).map(attempt=>({
          endDistanceM:frame.endDistanceM,
          teamId:attempt.teamId,helperId:attempt.helperId,
          finisherId:attempt.finisherId,
          helperEnergySpent:attempt.helperEnergySpent,
          gapAtStartM:attempt.gapAtStartM,
          gapAtEndM:attempt.gapAtEndM,
          status:attempt.status}))),
    }};
}

function summaryForIndividualGroupLine(trial,request,pointContext,line){
  const base=summaryFor(trial,request,pointContext);
  const decisions=new Map(line.sprintPlan.decisions.map(row=>
    [row.teamId,row]));
  return {...base,version:line.pre500Audit?
    'v91-offline-test-drive-4':line.pre500ContactStatus?
      'v91-offline-test-drive-3':'v91-offline-test-drive-2',
    roadStatus:line.pre500ContactStatus?
      'conditional_depleted_line':'conditional_multiband_line',
    individualLineVersion:line.version,
    ...(pointContext?{provisionalPointPreview:
      line.provisionalLineOrder?.every(row=>row.position!==null)?
        projectV91ProvisionalMultibandPointPreview(
          trial.recording,line,pointContext):
        {status:'unavailable',reason:
          line.pre500Audit?.firstPotentialOverlap?
            'Road bands may meet before 500 m.':
          line.overlapAudit.firstPotentialOverlap?
            'Cross-band contact remains unresolved.':
          line.pre500ContactStatus?
            'Dropped-rider contact before 500 m remains unresolved.':
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
        line.pre500ContactStatus==='provisional_separated'?
          'conditional_separated_inferred_wheels':
        line.pre500ContactStatus?
          'conditional_dropped_pre500_contact_unresolved':
          'conditional_band_local_cross_band_contact_unresolved',
      ...(line.pre500ContactStatus?{
        pre500ContactStatus:line.pre500ContactStatus}:{}),
      ...(line.pre500Audit?{pre500Audit:line.pre500Audit}:{}),
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

function summaryForNamedDroppedRoad(source,request,pointContext,road,
  individualLine=null){
  const recording=source.recording;
  const lastKm=recording.frames[recording.route.distanceKm-2];
  const lateCatch=individualLine?.version===
    FINALE_NAMED_DROPPED_LATE_CATCH_LINE_VERSION;
  const preview=pointContext?individualLine?.provisionalLineOrder
    ?.every(row=>row.position!==null)?
      (lateCatch?
        projectV91ProvisionalNamedDroppedLateCatchPointPreview:
        individualLine.version===
        FINALE_NAMED_DROPPED_SURVIVOR_LINE_VERSION?
        projectV91ProvisionalNamedDroppedSurvivorPointPreview:
        projectV91ProvisionalNamedDroppedPointPreview)(
        recording,road,individualLine,pointContext):
      {status:'unavailable',reason:individualLine?
          'Cross-band contact or an ambiguous place remains unresolved.':
          'No complete individual line.'}:null;
  return {version:lateCatch?'v91-offline-test-drive-9':
    individualLine?'v91-offline-test-drive-8':
    'v91-offline-test-drive-7',
    status:individualLine?'conditional_line':'road_only',
    roadStatus:individualLine?.roadStatus??
      'paid_named_attack_dropped_bands',
    input:source.settings,request,engineVersion:road.version,
    ...(individualLine?{individualLineVersion:individualLine.version}:{}),
    resultStatus:'unclassified',pointsStatus:'withheld',
    canCommitAwards:false,
    managerDecisions:recording.committedInputs.teams.map(team=>({
      teamId:team.id,baseline:team.orders.baseline,
      finisherId:request.plans?.find(row=>row.teamId===team.id)
        ?.finisherId??team.orders.captainId,
      leadOutRiderId:request.plans?.find(row=>row.teamId===team.id)
        ?.leadOutRiderId??null})),
    lastKmSource:{roadGroups:lastKm.roadGroups.map(group=>({
      id:group.id,gapSeconds:group.gapSeconds,
      riderIds:group.riderIds})),
    droppedRiderIds:lastKm.riderGroups.filter(row=>
      row.group==='dropped').map(row=>row.id),
    chaserTeamIds:lastKm.chasers},
    ...(pointContext?{provisionalPointPreview:preview}:{}),
    finale:{individualFinishStatus:individualLine?.overlapAudit
      .firstPotentialOverlap?
      'conditional_crossings_contact_unresolved':
      individualLine?'conditional_individual_crossings':
      'unresolved_within_road_bands',
      finalePlanStatus:lateCatch?'paid_after_late_contact':
        individualLine?'paid_at_500m':'unapplied',
      attackIntent:road.attackIntent,
      roadFrames:road.frames.filter(frame=>!individualLine||
        frame.distanceM<=individualLine.startDistanceM).map(frame=>({
        distanceM:frame.distanceM,
        bunchElapsedSecondsFromMarker:frame.bunchElapsedSecondsFromMarker,
        roadGroups:frame.active.roadGroups,
        catchDistanceM:frame.active.catchDistanceM??null,
        attackWork:frame.active.riderEnergy.filter(row=>
          row.riderId===road.attackIntent.riderId),
        droppedTravel:frame.droppedTravel.riders})),
      ...(individualLine?{[lateCatch?'bandsAtContactBoundary':
        'bandsAt500M']:[
        ...road.frames.find(frame=>frame.distanceM===
          individualLine.startDistanceM).active.roadGroups.map(group=>({
          id:group.id,riderIds:group.riderIds})),{
        id:'peloton',riderIds:road.frames.find(frame=>
          frame.distanceM===individualLine.startDistanceM)
          .active.pelotonRiderIds},{id:'dropped',
          riderIds:road.frames.find(frame=>
            frame.distanceM===individualLine.startDistanceM)
            .droppedTravel.riders.map(row=>row.riderId)}]}:
        {bands:road.line.bands}),
      finalRiderEnergy:individualLine?
        individualLine.conditionalCrossings.map(row=>({
          riderId:row.riderId,energy:row.energyAtLine})):
        road.line.finalRiderEnergy,
      ...(individualLine?{
        lineTimes:individualLine.conditionalCrossings,
        provisionalLineOrder:individualLine.provisionalLineOrder,
        overlapAudit:individualLine.overlapAudit,
        positionSourceStatus:individualLine.positionedSource.status,
        passingRule:individualLine.bandRunners.find(band=>
          band.roadBandId==='peloton').runner.passingRule,
        roadEvents:individualLine.bandRunners.flatMap(band=>
          band.runner.frames.flatMap(frame=>frame.roadEvents??[])),
        sprintWork:individualLine.bandRunners.flatMap(band=>
          band.runner.frames.flatMap(
          frame=>frame.riders.filter(row=>row.role==='sprint'||
            row.role==='solo_sprint').map(row=>({
            riderId:row.riderId,energySpent:row.energySpent,
            distanceTravelledM:row.distanceTravelledM})))),
        separateBandTravel:individualLine.bandRunners.filter(band=>
          band.roadBandId!=='peloton').flatMap(band=>
          band.runner.frames.map(frame=>({
            roadBandId:band.roadBandId,
            startDistanceM:frame.startDistanceM,
            endDistanceM:frame.endDistanceM,
            elapsedSecondsAtStart:frame.elapsedSecondsAtStart,
            durationSeconds:frame.durationSeconds,
            riderId:frame.riders[0].riderId,
            energySpent:frame.riders[0].energySpent}))),
        leadOutWork:individualLine.bandRunners.flatMap(band=>
          band.runner.frames.flatMap(frame=>frame.riders.filter(row=>
            row.role?.startsWith('lead_out')).map(row=>({
            roadBandId:band.roadBandId,riderId:row.riderId,
            role:row.role,energySpent:row.energySpent,
            distanceTravelledM:row.distanceTravelledM}))))}: {})}};
}

export function runV91TestDrive(scenario,{full=false}={}){
  if(!scenario||typeof scenario!=='object'||Array.isArray(scenario)||
    Object.keys(scenario).some(key=>
      !['settings','attack','finalePlans','pointContext',
        'individualGroupLine','namedDroppedRoad','lateCatchLine']
        .includes(key))||
    scenario.individualGroupLine!==undefined&&
      typeof scenario.individualGroupLine!=='boolean'||
    scenario.namedDroppedRoad!==undefined&&
      typeof scenario.namedDroppedRoad!=='boolean'||
    scenario.lateCatchLine!==undefined&&
      (typeof scenario.lateCatchLine!=='boolean'||
        scenario.lateCatchLine&&!scenario.namedDroppedRoad))
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
  if(scenario.namedDroppedRoad===true&&request.attackTeamId===undefined)
    throw new Error('Choose one named attack for the dropped-road trial.');
  let trial;
  let recoveredGroupPlan=false;
  try{trial=createV91ConditionalRaceFinal(scenario.settings,request);}
  catch(error){
    if(!expectedRefusal(error.message))throw error;
    const source=error.cause?.playtestSource??null;
    const namedSource=source&&scenario.namedDroppedRoad===true&&
      request.attackTeamId!==undefined?finaleSnapshotFromTour(
        source.recording,{remainingKm:1,includeAttackLoad:true}):null;
    if(scenario.individualGroupLine===true&&source&&
      request.attackTeamId===undefined&&
      ['Finisher and lead-out plans are not paid for a road group.',
        'Finisher and lead-out plans are not paid for road groups.',
        'Finisher and lead-out plans are not paid for depleted road bands.',
        'Finisher and lead-out plans are not paid for dropped road bands.']
        .includes(error.message)){
      try{trial=createV91GroupFallbackFromLockedRace(source);}
      catch(fallbackError){
        if(!expectedRefusal(fallbackError.message))throw fallbackError;
        return unsupportedRefusal(fallbackError,scenario,request,pointContext);
      }
      recoveredGroupPlan=true;
    }else if(namedSource&&namedSource.roadGroups.length===0&&
      namedSource.droppedRiderIds.length===1&&error.message===
        'The controlled finale trial needs one complete source bunch.'){
      let paidRoad;
      try{
        paidRoad=recordFinaleNamedAttackDroppedRoadFromTour(
          source.recording,{teamId:request.attackTeamId});
      }catch(roadError){
        if(![
          'The named dropped-road attack needs a bunch and one dropped rider.',
          'The named dropped-road attack needs one payable intent.'
        ].includes(roadError.message)&&
          !/^A (?:finale|dropped finale|sheltered) rider cannot pay/.test(
            roadError.message)&&
          !/^A dropped finale rider needs recorded bunch contact:/.test(
            roadError.message))throw roadError;
        return unsupportedRefusal(new Error(roadError.message,{
          cause:{playtestSource:source}}),scenario,request,pointContext);
      }
      validateFinaleNamedAttackDroppedRoadFromTour(source.recording,
        {teamId:request.attackTeamId},paidRoad);
      const finishM=source.recording.route.distanceKm*1000;
      const at500=paidRoad.frames.find(frame=>
        frame.distanceM===finishM-500);
      const caughtBefore500=paidRoad.frames.some(frame=>
        frame.distanceM<=finishM-500&&frame.active.catchDistanceM);
      const isolatedId=at500?.droppedTravel.riders[0]?.riderId;
      const paidLineRequested=at500?.active.roadGroups.length===0&&
        caughtBefore500||at500?.active.roadGroups.length===1&&
        (paidRoad.frames.at(-1).active.roadGroups.length===1||
          scenario.lateCatchLine===true);
      const nominations=request.plans??source.recording.committedInputs.teams
        .map(team=>({teamId:team.id,
          finisherId:team.orders.captainId,leadOutRiderId:null}));
      if(paidLineRequested&&nominations.some(plan=>
        plan.finisherId===isolatedId))
        return unsupportedRefusal(new Error(
          'An isolated rider cannot be a paid finisher.',{
            cause:{playtestSource:source}}),scenario,request,pointContext);
      let individualLine=null;
      if(at500?.active.roadGroups.length===0&&
        caughtBefore500){
        try{
          individualLine=recordFinaleNamedDroppedIndividualLine(
            source.recording,paidRoad,{plans:request.plans??null});
          validateFinaleNamedDroppedIndividualLine(source.recording,
            paidRoad,{plans:request.plans??null},individualLine);
        }catch(lineError){
          if(![
            'The nominated lead-out cannot work beside the finisher.'
          ].includes(lineError.message))throw lineError;
          return unsupportedRefusal(new Error(lineError.message,{
            cause:{playtestSource:source}}),scenario,request,pointContext);
        }
      }else if(at500?.active.roadGroups.length===1&&
        paidRoad.frames.at(-1).active.roadGroups.length===1){
        try{
          individualLine=recordFinaleNamedDroppedSurvivorLine(
            source.recording,paidRoad,{plans:request.plans??null});
          validateFinaleNamedDroppedSurvivorLine(source.recording,
            paidRoad,{plans:request.plans??null},individualLine);
        }catch(lineError){
          if(![
            'The nominated lead-out cannot work beside the finisher.',
            'A nominated solo sprint needs separate paid work.'
          ].includes(lineError.message))throw lineError;
          return unsupportedRefusal(new Error(lineError.message,{
            cause:{playtestSource:source}}),scenario,request,pointContext);
        }
      }else if(scenario.lateCatchLine===true&&
        at500?.active.roadGroups.length===1&&
        paidRoad.frames.at(-1).active.roadGroups.length===0){
        try{
          individualLine=recordFinaleNamedDroppedLateCatchLine(
            source.recording,paidRoad,{plans:request.plans??null});
          validateFinaleNamedDroppedLateCatchLine(source.recording,
            paidRoad,{plans:request.plans??null},individualLine);
        }catch(lineError){
          if(![
            'A pre-contact lead-out needs separate paid road work.',
            'The named late catch needs one paid merged boundary and dropped rider.'
          ].includes(lineError.message)&&
            !/^A dropped finale rider (?:cannot pay for travel|needs recorded bunch contact):/.test(lineError.message)&&
            !/^A rider cannot pay for actual finale travel:/.test(
              lineError.message))throw lineError;
          return unsupportedRefusal(new Error(lineError.message,{
            cause:{playtestSource:source}}),scenario,request,pointContext);
        }
      }
      const summary=summaryForNamedDroppedRoad(source,request,
        pointContext,paidRoad,individualLine);
      return full?{summary,recording:source,paidRoad,
        ...(individualLine?{individualLine}:{})}:summary;
    }else{
      return unsupportedRefusal(error,scenario,request,pointContext);
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
    const singleton=trial.roadStatus==='paid_group_bands'&&
      trial.paidFinale.line.approachFrames.find(frame=>
        frame.endDistanceM===trial.recording.route.distanceKm*1000-500)
        ?.roadGroups[0]?.riderIds.length===1;
    if(depleted&&trial.paidFinale.passageFrames.some(frame=>
      frame.droppedPassages.some(row=>row.unmetEnergyDemand>0))){
      const base=summaryFor(trial,request,pointContext);
      const summary=request.plans?{...base,status:'unsupported',
        individualLineStatus:'unpaid_dropped_travel',
        reason:'The nominated finale cannot run with unmet dropped-rider energy demand.'}:base;
      return full?{summary,recording:trial}:summary;
    }
    const droppedIds=new Set(depleted?
      trial.paidFinale.trace.sourceDroppedRiderIds:[]);
    const nominations=request.plans??trial.recording.committedInputs.teams
      .map(team=>({teamId:team.id,
        finisherId:team.orders.captainId,leadOutRiderId:null}));
    if(nominations.some(plan=>droppedIds.has(plan.finisherId))){
      const base=summaryFor(trial,request,pointContext);
      const summary={...base,status:'unsupported',
        individualLineStatus:'unsupported_plan',
        reason:'An isolated rider cannot be a paid finisher.'};
      return full?{summary,recording:trial}:summary;
    }
    const record=singleton?recordFinaleSingletonFrontIndividualLine:
      depleted?recordFinaleUnorderedDroppedIndividualLine:
      separated?recordFinaleSeparatedIndividualLine:
        recordFinaleMultibandIndividualLine;
    const validate=singleton?validateFinaleSingletonFrontIndividualLine:
      depleted?validateFinaleDepletedIndividualLine:
      separated?validateFinaleSeparatedIndividualLine:
        validateFinaleMultibandIndividualLine;
    let individualLine;
    try{
      individualLine=record(trial.recording,trial.paidFinale,
        {plans:request.plans??null});
    }catch(error){
      if(!['The nominated lead-out cannot work beside the finisher.',
        'The singleton cannot pay for the nominated sprint.']
        .includes(error.message))
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
