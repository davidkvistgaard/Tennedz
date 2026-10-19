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
import {FINALE_SEPARATED_INDIVIDUAL_LINE_VERSION} from
  './finale-separated-individual-line.mjs';
import {FINALE_SINGLETON_FRONT_INDIVIDUAL_LINE_VERSION,
  FINALE_SINGLETON_FRONT_SPRINT_LINE_VERSION} from
  './finale-singleton-front-individual-line.mjs';
import {FINALE_AUDITED_DROPPED_INDIVIDUAL_LINE_VERSION,
  FINALE_UNORDERED_DROPPED_INDIVIDUAL_LINE_VERSION} from
  './finale-depleted-individual-line.mjs';
import {FINALE_NAMED_DROPPED_INDIVIDUAL_LINE_VERSION,
  validateFinaleNamedDroppedIndividualLine} from
  './finale-named-dropped-individual-line.mjs';
import {FINALE_NAMED_DROPPED_SURVIVOR_LINE_VERSION,
  validateFinaleNamedDroppedSurvivorLine} from
  './finale-named-dropped-survivor-line.mjs';

export const V91_PROVISIONAL_POINT_PREVIEW_VERSION=
  'v91-provisional-point-preview-1';
const EPSILON=1e-8;
export const V91_MULTIBAND_POINT_PREVIEW_VERSION=
  'v91-provisional-multiband-point-preview-1';
export const V91_NAMED_DROPPED_POINT_PREVIEW_VERSION=
  'v91-provisional-named-dropped-point-preview-1';
export const V91_NAMED_DROPPED_SURVIVOR_POINT_PREVIEW_VERSION=
  'v91-provisional-named-dropped-point-preview-2';

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

// The same policy can inspect a surviving solo only after its independent
// paid path, nominated bunch path and isolated path remain separated.
export function projectV91ProvisionalNamedDroppedSurvivorPointPreview(
  tour,road,line,context){
  return projectNamedDroppedPoints(tour,road,line,context,{
    lineVersion:FINALE_NAMED_DROPPED_SURVIVOR_LINE_VERSION,
    previewVersion:V91_NAMED_DROPPED_SURVIVOR_POINT_PREVIEW_VERSION,
    validate:validateFinaleNamedDroppedSurvivorLine});
}

function projectNamedDroppedPoints(tour,road,line,context,{
  lineVersion,previewVersion,validate}){
  const {tier,divisionIndex,divisionCount}=context??{};
  if(!Number.isInteger(tier)||tier<1||tier>6)
    throw new Error('Preview points need a valid race tier.');
  const multiplier=divisionMultiplier(divisionIndex,divisionCount);
  if(line?.version!==lineVersion||
    line.sourceRoadTraceVersion!==road?.version||
    line.positionedSource?.status!==
      'provisional_inferred_independent_wheels'||
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
  const {tier,divisionIndex,divisionCount}=context??{};
  if(!Number.isInteger(tier)||tier<1||tier>6)
    throw new Error('Preview points need a valid race tier.');
  const multiplier=divisionMultiplier(divisionIndex,divisionCount);
  if(![FINALE_MULTIBAND_INDIVIDUAL_LINE_VERSION,
    FINALE_SEPARATED_INDIVIDUAL_LINE_VERSION,
    FINALE_SINGLETON_FRONT_INDIVIDUAL_LINE_VERSION,
    FINALE_SINGLETON_FRONT_SPRINT_LINE_VERSION,
    FINALE_AUDITED_DROPPED_INDIVIDUAL_LINE_VERSION,
    FINALE_UNORDERED_DROPPED_INDIVIDUAL_LINE_VERSION]
    .includes(line?.version)||
    line.pre500Audit?.status!==
      'separated_through_conditional_lines'||
    line.pre500Audit.firstPotentialOverlap!==null||
    line.overlapAudit?.status!==
      'separated_through_conditional_lines'||
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
  return {version:V91_MULTIBAND_POINT_PREVIEW_VERSION,
    sourceLineVersion:line.version,
    positionSourceStatus:line.positionedSource.status,
    pointsPolicyVersion:POINT_POLICY_VERSION,
    tier,divisionIndex,divisionCount,multiplier,
    classificationStatus:'provisional_separated_inferred_wheels',
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
