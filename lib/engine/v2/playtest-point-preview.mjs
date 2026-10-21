import {isDeepStrictEqual} from 'node:util';
import {divisionMultiplier} from '../../calendar/division-reveal.mjs';
import {POINT_POLICY_VERSION,pointsForDivisionResult} from
  '../../calendar/points.mjs';
import {createV91ConditionalRaceFinal,
  createV91LegacyConditionalRaceFinal,
  V91_CONDITIONAL_RACE_FINAL_VERSION,
  V91_INACTIVE_INTENTS_RACE_FINAL_VERSION} from
  './playtest-race-final.mjs';
import {FINALE_MULTIBAND_INDIVIDUAL_LINE_VERSION} from
  './finale-multiband-individual-line.mjs';
import {FINALE_SEPARATED_INDIVIDUAL_LINE_VERSION,
  FINALE_SEPARATED_SINGLETON_INDIVIDUAL_LINE_VERSION,
  FINALE_SINGLE_GROUP_INDIVIDUAL_LINE_VERSION,
  validateFinaleSeparatedIndividualLine,
  validateFinaleSingleGroupIndividualLine} from
  './finale-separated-individual-line.mjs';
import {FINALE_SINGLETON_FRONT_INDIVIDUAL_LINE_VERSION,
  FINALE_SINGLETON_FRONT_SPRINT_LINE_VERSION} from
  './finale-singleton-front-individual-line.mjs';
import {FINALE_AUDITED_DROPPED_INDIVIDUAL_LINE_VERSION,
  FINALE_UNORDERED_DROPPED_INDIVIDUAL_LINE_VERSION,
  FINALE_COASTED_INDIVIDUAL_LINE_VERSION,
  FINALE_COAST_ISOLATED_PASS_INDIVIDUAL_LINE_VERSION,
  FINALE_COAST_NO_FRONT_INDIVIDUAL_LINE_VERSION,
  validateFinaleDepletedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from './tuning.mjs';
import {FINALE_BUNCH_ONLY_INDIVIDUAL_LINE_VERSION,
  validateFinaleBunchOnlyIndividualLine} from
  './finale-bunch-only-individual-line.mjs';
import {FINALE_NAMED_DROPPED_INDIVIDUAL_LINE_VERSION,
  FINALE_NAMED_MULTIPLE_DROPPED_INDIVIDUAL_LINE_VERSION,
  validateFinaleNamedDroppedIndividualLine,
  validateFinaleNamedMultipleDroppedIndividualLine} from
  './finale-named-dropped-individual-line.mjs';
import {FINALE_NAMED_DROPPED_SURVIVOR_LINE_VERSION,
  FINALE_NAMED_MULTIPLE_DROPPED_SURVIVOR_LINE_VERSION,
  FINALE_NAMED_MULTIPLE_DROPPED_SPRINT_SURVIVOR_LINE_VERSION,
  validateFinaleNamedDroppedSurvivorLine,
  validateFinaleNamedMultipleDroppedSurvivorLine,
  validateFinaleNamedMultipleDroppedSprintSurvivorLine} from
  './finale-named-dropped-survivor-line.mjs';
import {FINALE_NAMED_DROPPED_LATE_CATCH_LINE_VERSION,
  FINALE_NAMED_MULTIPLE_DROPPED_LATE_CATCH_LINE_VERSION,
  FINALE_NAMED_MULTIPLE_DROPPED_SPRINT_LATE_CATCH_LINE_VERSION,
  validateFinaleNamedDroppedLateCatchLine,
  validateFinaleNamedMultipleDroppedLateCatchLine,
  validateFinaleNamedMultipleDroppedSprintLateCatchLine} from
  './finale-named-dropped-late-catch-line.mjs';

export const V91_PROVISIONAL_POINT_PREVIEW_VERSION=
  'v91-provisional-point-preview-1';
const EPSILON=1e-8;
export const V91_MULTIBAND_POINT_PREVIEW_VERSION=
  'v91-provisional-multiband-point-preview-1';
export const V93_COASTED_POINT_PREVIEW_VERSION=
  'v93-provisional-coasted-point-preview-1';
export const V93_ISOLATED_PASS_POINT_PREVIEW_VERSION=
  'v93-provisional-isolated-pass-point-preview-1';
export const V93_SEPARATED_POINT_PREVIEW_VERSION=
  'v93-provisional-separated-point-preview-1';
export const V93_SINGLE_GROUP_POINT_PREVIEW_VERSION=
  'v93-provisional-single-group-point-preview-1';
export const V93_BUNCH_ONLY_POINT_PREVIEW_VERSION=
  'v93-provisional-bunch-only-point-preview-1';
export const V93_COAST_NO_FRONT_POINT_PREVIEW_VERSION=
  'v93-provisional-coast-no-front-point-preview-1';
export const V91_NAMED_DROPPED_POINT_PREVIEW_VERSION=
  'v91-provisional-named-dropped-point-preview-1';
export const V91_NAMED_DROPPED_SURVIVOR_POINT_PREVIEW_VERSION=
  'v91-provisional-named-dropped-point-preview-2';
export const V91_NAMED_DROPPED_LATE_CATCH_POINT_PREVIEW_VERSION=
  'v91-provisional-named-dropped-point-preview-3';
export const V91_NAMED_MULTIPLE_DROPPED_POINT_PREVIEW_VERSION=
  'v91-provisional-named-dropped-point-preview-4';
export const V91_NAMED_MULTIPLE_DROPPED_SURVIVOR_POINT_PREVIEW_VERSION=
  'v91-provisional-named-dropped-point-preview-5';
export const V91_NAMED_MULTIPLE_DROPPED_LATE_CATCH_POINT_PREVIEW_VERSION=
  'v91-provisional-named-dropped-point-preview-6';
export const V91_NAMED_MULTIPLE_DROPPED_SPRINT_SURVIVOR_POINT_PREVIEW_VERSION=
  'v91-provisional-named-dropped-point-preview-7';
export const V91_NAMED_MULTIPLE_DROPPED_SPRINT_LATE_CATCH_POINT_PREVIEW_VERSION=
  'v91-provisional-named-dropped-point-preview-8';

// The full paid pre-500 m attack/catch and isolated rider replay before this
// read-only policy illustration. Neither inferred bunch wheels nor the
// projected places become an official classification or award.
export function projectV91ProvisionalNamedDroppedPointPreview(tour,road,
  line,context){
  return projectNamedDroppedPoints(tour,road,line,context,{
    lineVersion:FINALE_NAMED_DROPPED_INDIVIDUAL_LINE_VERSION,
    previewVersion:V91_NAMED_DROPPED_POINT_PREVIEW_VERSION,
    validate:validateFinaleNamedDroppedIndividualLine});
}

export function projectV91ProvisionalNamedMultipleDroppedPointPreview(
  tour,road,line,context){
  return projectNamedDroppedPoints(tour,road,line,context,{
    lineVersion:FINALE_NAMED_MULTIPLE_DROPPED_INDIVIDUAL_LINE_VERSION,
    previewVersion:V91_NAMED_MULTIPLE_DROPPED_POINT_PREVIEW_VERSION,
    validate:validateFinaleNamedMultipleDroppedIndividualLine});
}

// The same policy can inspect a surviving solo only after its independent
// paid path, nominated bunch path and isolated path remain separated.
export function projectV91ProvisionalNamedDroppedSurvivorPointPreview(
  tour,road,line,context){
  return projectNamedDroppedPoints(tour,road,line,context,{
    lineVersion:FINALE_NAMED_DROPPED_SURVIVOR_LINE_VERSION,
    previewVersion:V91_NAMED_DROPPED_SURVIVOR_POINT_PREVIEW_VERSION,
    validate:validateFinaleNamedDroppedSurvivorLine});
}

export function projectV91ProvisionalNamedMultipleDroppedSurvivorPointPreview(
  tour,road,line,context){
  return projectNamedDroppedPoints(tour,road,line,context,{
    lineVersion:FINALE_NAMED_MULTIPLE_DROPPED_SURVIVOR_LINE_VERSION,
    previewVersion:V91_NAMED_MULTIPLE_DROPPED_SURVIVOR_POINT_PREVIEW_VERSION,
    validate:validateFinaleNamedMultipleDroppedSurvivorLine});
}

export function projectV91ProvisionalNamedMultipleDroppedSprintSurvivorPointPreview(
  tour,road,line,context){
  return projectNamedDroppedPoints(tour,road,line,context,{
    lineVersion:FINALE_NAMED_MULTIPLE_DROPPED_SPRINT_SURVIVOR_LINE_VERSION,
    previewVersion:
      V91_NAMED_MULTIPLE_DROPPED_SPRINT_SURVIVOR_POINT_PREVIEW_VERSION,
    validate:validateFinaleNamedMultipleDroppedSprintSurvivorLine});
}

export function projectV91ProvisionalNamedDroppedLateCatchPointPreview(
  tour,road,line,context){
  return projectNamedDroppedPoints(tour,road,line,context,{
    lineVersion:FINALE_NAMED_DROPPED_LATE_CATCH_LINE_VERSION,
    previewVersion:V91_NAMED_DROPPED_LATE_CATCH_POINT_PREVIEW_VERSION,
    positionStatus:'provisional_inferred_post_contact_wheels',
    validate:validateFinaleNamedDroppedLateCatchLine});
}

export function projectV91ProvisionalNamedMultipleDroppedLateCatchPointPreview(
  tour,road,line,context){
  return projectNamedDroppedPoints(tour,road,line,context,{
    lineVersion:FINALE_NAMED_MULTIPLE_DROPPED_LATE_CATCH_LINE_VERSION,
    previewVersion:V91_NAMED_MULTIPLE_DROPPED_LATE_CATCH_POINT_PREVIEW_VERSION,
    positionStatus:'provisional_inferred_post_contact_wheels',
    validate:validateFinaleNamedMultipleDroppedLateCatchLine});
}

export function projectV91ProvisionalNamedMultipleDroppedSprintLateCatchPointPreview(
  tour,road,line,context){
  return projectNamedDroppedPoints(tour,road,line,context,{
    lineVersion:FINALE_NAMED_MULTIPLE_DROPPED_SPRINT_LATE_CATCH_LINE_VERSION,
    previewVersion:
      V91_NAMED_MULTIPLE_DROPPED_SPRINT_LATE_CATCH_POINT_PREVIEW_VERSION,
    positionStatus:'provisional_inferred_post_contact_wheels',
    validate:validateFinaleNamedMultipleDroppedSprintLateCatchLine});
}

function projectNamedDroppedPoints(tour,road,line,context,{
  lineVersion,previewVersion,validate,
  positionStatus='provisional_inferred_independent_wheels'}){
  const {tier,divisionIndex,divisionCount}=context??{};
  if(!Number.isInteger(tier)||tier<1||tier>6)
    throw new Error('Preview points need a valid race tier.');
  const multiplier=divisionMultiplier(divisionIndex,divisionCount);
  if(line?.version!==lineVersion||
    line.sourceRoadTraceVersion!==road?.version||
    line.positionedSource?.status!==positionStatus||
    line.bandRunners?.find(band=>band.roadBandId==='peloton')
      ?.runner.passingRule!=='open-road-lab-1'||
    line.overlapAudit?.status!==
      'separated_through_conditional_lines'||
    line.overlapAudit.firstPotentialOverlap!==null||
    line.classifiedResults!==null||line.pointsStatus!=='withheld'||
    line.canCommitAwards!==false||
    !Array.isArray(line.provisionalLineOrder)||
    !Array.isArray(line.conditionalCrossings))
    throw new Error('Preview points need separate paid named and dropped lines.');
  validate(tour,road,
    {plans:line.sprintPlan.decisions.map(row=>({
      teamId:row.teamId,finisherId:row.finisherId,
      leadOutRiderId:row.leadOutRiderId}))},line);
  const roster=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  const ordered=[...line.conditionalCrossings].sort((a,b)=>
    a.elapsedSecondsFromLastKmStart-b.elapsedSecondsFromLastKmStart||
    a.riderId.localeCompare(b.riderId));
  if(!roster.size||ordered.length!==roster.size||
    line.provisionalLineOrder.length!==roster.size||
    new Set(ordered.map(row=>row.riderId)).size!==roster.size||
    ordered.some((row,index)=>{
      const place=line.provisionalLineOrder[index];
      return !Number.isFinite(row.elapsedSecondsFromLastKmStart)||
        !Number.isFinite(row.energyAtLine)||row.energyAtLine<0||
        roster.get(row.riderId)!==row.teamId||
        index>0&&row.elapsedSecondsFromLastKmStart-
          ordered[index-1].elapsedSecondsFromLastKmStart<=EPSILON||
        place?.riderId!==row.riderId||
        place.teamId!==row.teamId||place.position!==index+1||
        place.firstPossiblePlace!==index+1||
        place.lastPossiblePlace!==index+1||
        place.elapsedSecondsFromLastKmStart!==
          row.elapsedSecondsFromLastKmStart||
        place.energyAtLine!==row.energyAtLine;
    }))
    throw new Error('Preview points need an unambiguous named dropped order.');
  return {version:previewVersion,
    sourceRoadVersion:road.version,sourceLineVersion:line.version,
    positionSourceStatus:line.positionedSource.status,
    pointsPolicyVersion:POINT_POLICY_VERSION,
    tier,divisionIndex,divisionCount,multiplier,
    classificationStatus:'provisional_separated_inferred_wheels',
    pointsStatus:'experimental_preview_only',canCommitAwards:false,
    awardRows:[],riders:ordered.map((row,index)=>({
      riderId:row.riderId,teamId:row.teamId,
      provisionalPlace:index+1,
      elapsedSecondsFromLastKmStart:
        row.elapsedSecondsFromLastKmStart,
      energyAtLine:row.energyAtLine,
      previewPoints:pointsForDivisionResult({tier,
        resultType:'ONE_DAY',placing:index+1,multiplier})}))};
}

// Read-only policy projection only where the paid band trajectories stay
// longitudinally separate through every crossing. Inferred wheels remain
// experimental; this is never an award row or official classification.
export function projectV91ProvisionalMultibandPointPreview(tour,line,context){
  return projectMultibandPointPreview(tour,line,context,
    V91_MULTIBAND_POINT_PREVIEW_VERSION);
}

export function projectV93ProvisionalCoastedPointPreview(tour,clock,line,
  context){
  if(tour?.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION||
    line?.version!==FINALE_COASTED_INDIVIDUAL_LINE_VERSION)
    throw new Error('V93 point preview needs a coasted individual line.');
  validateFinaleDepletedIndividualLine(tour,clock,{
    plans:line.sprintPlan.decisions.map(row=>({
      teamId:row.teamId,finisherId:row.finisherId,
      leadOutRiderId:row.leadOutRiderId}))},line);
  return projectMultibandPointPreview(tour,line,context,
    V93_COASTED_POINT_PREVIEW_VERSION);
}

export function projectV93ProvisionalIsolatedPassPointPreview(tour,clock,
  line,context){
  if(tour?.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION||
    line?.version!==FINALE_COAST_ISOLATED_PASS_INDIVIDUAL_LINE_VERSION||
    !line.pre500Audit.passes.length)
    throw new Error('V93 point preview needs paid isolated passes.');
  validateFinaleDepletedIndividualLine(tour,clock,{
    plans:line.sprintPlan.decisions.map(row=>({
      teamId:row.teamId,finisherId:row.finisherId,
      leadOutRiderId:row.leadOutRiderId}))},line);
  return projectMultibandPointPreview(tour,line,context,
    V93_ISOLATED_PASS_POINT_PREVIEW_VERSION);
}

export function projectV93ProvisionalCoastNoFrontPointPreview(tour,clock,
  line,context){
  if(tour?.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION||
    line?.version!==FINALE_COAST_NO_FRONT_INDIVIDUAL_LINE_VERSION)
    throw new Error('V93 point preview needs a coasted no-front line.');
  validateFinaleDepletedIndividualLine(tour,clock,{
    plans:line.sprintPlan.decisions.map(row=>({
      teamId:row.teamId,finisherId:row.finisherId,
      leadOutRiderId:row.leadOutRiderId}))},line);
  return projectMultibandPointPreview(tour,line,context,
    V93_COAST_NO_FRONT_POINT_PREVIEW_VERSION);
}

export function projectV93ProvisionalSeparatedPointPreview(tour,clock,line,
  context){
  if(tour?.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION||
    ![FINALE_SEPARATED_INDIVIDUAL_LINE_VERSION,
      FINALE_SEPARATED_SINGLETON_INDIVIDUAL_LINE_VERSION]
      .includes(line?.version))
    throw new Error('V93 point preview needs a separated individual line.');
  validateFinaleSeparatedIndividualLine(tour,clock,{
    plans:line.sprintPlan.decisions.map(row=>({
      teamId:row.teamId,finisherId:row.finisherId,
      leadOutRiderId:row.leadOutRiderId}))},line);
  return projectMultibandPointPreview(tour,line,context,
    V93_SEPARATED_POINT_PREVIEW_VERSION);
}

export function projectV93ProvisionalSingleGroupPointPreview(tour,clock,line,
  context){
  if(tour?.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION||
    line?.version!==FINALE_SINGLE_GROUP_INDIVIDUAL_LINE_VERSION)
    throw new Error('V93 point preview needs a single-group individual line.');
  validateFinaleSingleGroupIndividualLine(tour,clock,{
    plans:line.sprintPlan.decisions.map(row=>({
      teamId:row.teamId,finisherId:row.finisherId,
      leadOutRiderId:row.leadOutRiderId}))},line);
  return projectMultibandPointPreview(tour,line,context,
    V93_SINGLE_GROUP_POINT_PREVIEW_VERSION);
}

export function projectV93ProvisionalBunchOnlyPointPreview(tour,clock,line,
  context){
  if(tour?.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION||
    line?.version!==FINALE_BUNCH_ONLY_INDIVIDUAL_LINE_VERSION)
    throw new Error('V93 point preview needs a bunch-only individual line.');
  validateFinaleBunchOnlyIndividualLine(tour,clock,{
    plans:line.sprintPlan.decisions.map(row=>({
      teamId:row.teamId,finisherId:row.finisherId,
      leadOutRiderId:row.leadOutRiderId}))},line);
  return projectMultibandPointPreview(tour,line,context,
    V93_BUNCH_ONLY_POINT_PREVIEW_VERSION);
}

function projectMultibandPointPreview(tour,line,context,previewVersion){
  const {tier,divisionIndex,divisionCount}=context??{};
  if(!Number.isInteger(tier)||tier<1||tier>6)
    throw new Error('Preview points need a valid race tier.');
  const multiplier=divisionMultiplier(divisionIndex,divisionCount);
  const bunchOnly=previewVersion===V93_BUNCH_ONLY_POINT_PREVIEW_VERSION;
  if(![FINALE_MULTIBAND_INDIVIDUAL_LINE_VERSION,
    FINALE_SEPARATED_INDIVIDUAL_LINE_VERSION,
    FINALE_SEPARATED_SINGLETON_INDIVIDUAL_LINE_VERSION,
    FINALE_SINGLE_GROUP_INDIVIDUAL_LINE_VERSION,
    FINALE_BUNCH_ONLY_INDIVIDUAL_LINE_VERSION,
    ...(previewVersion===V93_COAST_NO_FRONT_POINT_PREVIEW_VERSION?
      [FINALE_COAST_NO_FRONT_INDIVIDUAL_LINE_VERSION]:[]),
    FINALE_SINGLETON_FRONT_INDIVIDUAL_LINE_VERSION,
    FINALE_SINGLETON_FRONT_SPRINT_LINE_VERSION,
    FINALE_AUDITED_DROPPED_INDIVIDUAL_LINE_VERSION,
    FINALE_UNORDERED_DROPPED_INDIVIDUAL_LINE_VERSION,
    ...(previewVersion===V93_COASTED_POINT_PREVIEW_VERSION?
      [FINALE_COASTED_INDIVIDUAL_LINE_VERSION]:[]),
    ...(previewVersion===V93_ISOLATED_PASS_POINT_PREVIEW_VERSION?
      [FINALE_COAST_ISOLATED_PASS_INDIVIDUAL_LINE_VERSION]:[])]
    .includes(line?.version)||
    line.pre500Audit?.status!==(bunchOnly?'single_road_band':
      previewVersion===V93_ISOLATED_PASS_POINT_PREVIEW_VERSION?
        'resolved_isolated_lane_passes':
        'separated_through_conditional_lines')||
    line.pre500Audit.firstPotentialOverlap!==null||
    line.overlapAudit?.status!==(bunchOnly?'single_road_band':
      'separated_through_conditional_lines')||
    line.overlapAudit.firstPotentialOverlap!==null||
    line.classifiedResults!==null||line.pointsStatus!=='withheld'||
    line.canCommitAwards!==false||
    !Array.isArray(line.provisionalLineOrder)||
    !Array.isArray(line.conditionalCrossings))
    throw new Error('Preview points need separate paid individual bands.');
  const roster=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  const ordered=[...line.conditionalCrossings].sort((a,b)=>
    a.elapsedSecondsFromLastKmStart-b.elapsedSecondsFromLastKmStart||
    a.riderId.localeCompare(b.riderId));
  if(!roster.size||ordered.length!==roster.size||
    line.provisionalLineOrder.length!==roster.size||
    new Set(ordered.map(row=>row.riderId)).size!==roster.size||
    ordered.some((row,index)=>{
      const place=line.provisionalLineOrder[index];
      return !Number.isFinite(row.elapsedSecondsFromLastKmStart)||
        !Number.isFinite(row.energyAtLine)||row.energyAtLine<0||
        roster.get(row.riderId)!==row.teamId||
        index>0&&row.elapsedSecondsFromLastKmStart-
          ordered[index-1].elapsedSecondsFromLastKmStart<=EPSILON||
        place?.riderId!==row.riderId||
        place.teamId!==row.teamId||place.position!==index+1||
        place.firstPossiblePlace!==index+1||
        place.lastPossiblePlace!==index+1||
        place.elapsedSecondsFromLastKmStart!==
          row.elapsedSecondsFromLastKmStart||
        place.energyAtLine!==row.energyAtLine;
    }))
    throw new Error('Preview points need an unambiguous multiband order.');
  return {version:previewVersion,
    sourceLineVersion:line.version,
    positionSourceStatus:line.positionedSource.status,
    pointsPolicyVersion:POINT_POLICY_VERSION,
    tier,divisionIndex,divisionCount,multiplier,
    classificationStatus:bunchOnly?'provisional_bunch_inferred_wheels':
      'provisional_separated_inferred_wheels',
    pointsStatus:'experimental_preview_only',
    canCommitAwards:false,awardRows:[],
    riders:ordered.map((row,index)=>({
      riderId:row.riderId,teamId:row.teamId,
      provisionalPlace:index+1,
      elapsedSecondsFromLastKmStart:
        row.elapsedSecondsFromLastKmStart,
      energyAtLine:row.energyAtLine,
      previewPoints:pointsForDivisionResult({tier,
        resultType:'ONE_DAY',placing:index+1,multiplier})}))};
}

// A read-only policy illustration for one complete, uniquely ordered paid
// bunch line. The source wheels and passing rule remain experimental, so this
// is never a classification, award row, or production settlement candidate.
export function projectV91ProvisionalPointPreview(trial,context){
  const {tier,divisionIndex,divisionCount}=context??{};
  if(!Number.isInteger(tier)||tier<1||tier>6)
    throw new Error('Preview points need a valid race tier.');
  const multiplier=divisionMultiplier(divisionIndex,divisionCount);
  const finale=trial?.paidFinale;
  if(trial?.roadStatus!=='paid_conditional_line'||
    trial.classifiedResults!==null||trial.pointsStatus!=='withheld'||
    trial.canCommitAwards!==false||
    finale?.positionSourceStatus!==
      'provisional_inferred_independent_wheels'||
    finale.passingRule!=='open-road-lab-1'||
    !Array.isArray(finale.lineOrder)||
    !Array.isArray(finale.finishers))
    throw new Error('Preview points need one complete provisional bunch line.');
  const roster=new Map(trial.recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  const ordered=[...finale.finishers].sort((a,b)=>
    a.elapsedSecondsFromLastKmStart-b.elapsedSecondsFromLastKmStart);
  if(!roster.size||ordered.length!==roster.size||
    finale.lineOrder.length!==roster.size||
    new Set(ordered.map(row=>row.riderId)).size!==roster.size||
    ordered.some((row,index)=>{
      const line=finale.lineOrder[index];
      return !Number.isFinite(row.elapsedSecondsFromLastKmStart)||
        !Number.isFinite(row.energyAtLine)||row.energyAtLine<0||
        roster.get(row.riderId)!==row.teamId||
        index>0&&row.elapsedSecondsFromLastKmStart-
          ordered[index-1].elapsedSecondsFromLastKmStart<=EPSILON||
        line?.riderId!==row.riderId||line.teamId!==row.teamId||
        line.position!==index+1||
        line.firstPossiblePlace!==index+1||
        line.lastPossiblePlace!==index+1||
        line.elapsedSecondsFromLastKmStart!==
          row.elapsedSecondsFromLastKmStart||
        line.energyAtLine!==row.energyAtLine;
    }))
    throw new Error('Preview points need an unambiguous replayed line order.');
  return {version:V91_PROVISIONAL_POINT_PREVIEW_VERSION,
    sourceRaceFinalVersion:trial.version,
    sourceFinaleVersion:finale.version,
    positionSourceStatus:finale.positionSourceStatus,
    passingRule:finale.passingRule,
    pointsPolicyVersion:POINT_POLICY_VERSION,
    tier,divisionIndex,divisionCount,multiplier,
    classificationStatus:'provisional_inferred_wheels',
    pointsStatus:'experimental_preview_only',
    canCommitAwards:false,awardRows:[],
    riders:ordered.map((row,index)=>({
      riderId:row.riderId,teamId:row.teamId,
      provisionalPlace:index+1,
      elapsedSecondsFromLastKmStart:
        row.elapsedSecondsFromLastKmStart,
      energyAtLine:row.energyAtLine,
      previewPoints:pointsForDivisionResult({tier,
        resultType:'ONE_DAY',placing:index+1,multiplier})}))};
}

export function validateV91ProvisionalPointPreview(settings,request,
  context,recorded){
  const legacy=[V91_CONDITIONAL_RACE_FINAL_VERSION,
    V91_INACTIVE_INTENTS_RACE_FINAL_VERSION].includes(
    recorded?.sourceRaceFinalVersion)&&!request?.attackTeamId;
  const trial=(legacy?createV91LegacyConditionalRaceFinal:
    createV91ConditionalRaceFinal)(settings,request);
  if(!isDeepStrictEqual(recorded,
    projectV91ProvisionalPointPreview(trial,context)))
    throw new Error('Provisional preview points do not replay.');
  return true;
}
