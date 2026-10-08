// Reproducible, offline balance matrix with fictional riders and routes.
// Every strategy in a paired comparison uses the same roster, route and seed.
import seedrandom from 'seedrandom';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {validateRoadGroupTransition} from '../lib/engine/v2/road-groups.mjs';
import {SPORTING_SKILLS} from '../lib/engine/v2/physiology.mjs';
import {capDiagnosticChaserSkills,CHASER_CAP_SCOPES} from
  '../lib/engine/v2/diagnostic-chaser-cap.mjs';
import {orderAt} from '../lib/engine/v2/orders.mjs';
import {assignPointDivisions} from '../lib/calendar/division-reveal.mjs';
import {buildV2OneDayResultContract,
  validateV2OneDayResultContract} from '../lib/race/v2-result-contract.mjs';
import {hasResidualGapAfterSufficientChase} from '../lib/engine/v2/balance-audit.mjs';
import {probeFinaleOrderedGroupToLineFromTour,
  validateFinaleOrderedGroupToLineFromTour} from
  '../lib/engine/v2/finale-ordered-run.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  validateFinaleSeparatedGroupsFromTour,
  FINALE_SEPARATED_TEAM_LIMIT_VERSION} from
  '../lib/engine/v2/finale-multi-run.mjs';
import {probeFinaleSeparatedFinishBoundsFromTour,
  validateFinaleSeparatedFinishBoundsFromTour,
  FINALE_SEPARATED_TEAM_LIMIT_BOUNDS_VERSION} from
  '../lib/engine/v2/finale-separated-finish-bounds.mjs';
import {recordFinaleRotationV91CandidateFromTour,
  validateFinaleRotationV91CandidateFromTour} from
  '../lib/engine/v2/finale-rotation-v91-candidate.mjs';
import {recordFinaleConcurrentNamedLaunchFromTour} from
  '../lib/engine/v2/finale-concurrent-named-launch.mjs';
import {recordFinaleLastKmNamedIntentsFromTour,
  FINALE_LAST_KM_ALL_INTENTS_VERSION} from
  '../lib/engine/v2/finale-last-km-named-intents.mjs';
import {recordFinaleConcurrentNamedRoadContactFromTour} from
  '../lib/engine/v2/finale-concurrent-named-road-contact.mjs';
import {recordFinaleConcurrentNamedRotationLaunchFromTour} from
  '../lib/engine/v2/finale-concurrent-named-rotation-launch.mjs';
import {recordFinaleConcurrentNamedChaseRotationFromTour,
  recordFinaleConcurrentNamedSelectiveRotationFromTour,
  recordFinaleConcurrentNamedMultiSelectiveRotationFromTour} from
  '../lib/engine/v2/finale-concurrent-named-chase-rotation-launch.mjs';
import {recordFinaleConcurrentNamedChaseRotationContactFromTour,
  recordFinaleConcurrentNamedSelectiveRotationContactFromTour} from
  '../lib/engine/v2/finale-concurrent-named-chase-rotation-contact.mjs';
import {recordFinaleConcurrentRelativeArrivalsFromTour,
  recordFinaleConcurrentSelectiveRelativeArrivalsFromTour,
  recordFinaleConcurrentMultiSelectiveRelativeArrivalsFromTour} from
  '../lib/engine/v2/finale-concurrent-relative-arrivals.mjs';
import {recordFinaleConcurrentNamedAllChaseFromTour} from
  '../lib/engine/v2/finale-concurrent-named-all-chase.mjs';
import {recordFinaleConcurrentNamedAllChaseContactFromTour} from
  '../lib/engine/v2/finale-concurrent-named-all-chase-contact.mjs';
import {recordFinaleConcurrentChasedFollowupFromTour} from
  '../lib/engine/v2/finale-concurrent-chased-followup.mjs';
import {recordFinaleConcurrentChasedCatchMergeFromTour} from
  '../lib/engine/v2/finale-concurrent-chased-catch-merge.mjs';
import {TUNING,TUNING_VERSION,MOTOR_CANDIDATE_VERSION,MOTOR_PAID_PACE_VERSION,
  MOTOR_FINALE_VERSION,MOTOR_BRIDGE_FINALE_VERSION,MOTOR_EARNED_BRIDGE_VERSION,
  MOTOR_NEUTRAL_PACE_VERSION,MOTOR_EXPLICIT_FRONT_VERSION,
  MOTOR_DRAFT_SHELTER_VERSION,MOTOR_DISTANCE_LOAD_VERSION,
  MOTOR_RECOVERY_CEILING_VERSION,MOTOR_PHASE_ATTACK_VERSION,MOTOR_ATTACK_TRACE_VERSION,
  MOTOR_CANDIDATE} from
  '../lib/engine/v2/tuning.mjs';

const samples=process.argv[2]===undefined?10:Number(process.argv[2]);
const fieldTeams=process.argv[3]===undefined?4:Number(process.argv[3]);
const motorMode=process.argv[4]??'current';
const paceMode=process.argv[5]??'preset';
const managerMixMatch=/^planned-finale-allied-manager-mix-([0-3])$/.exec(paceMode);
const managerMixHardChasers=managerMixMatch?Number(managerMixMatch[1]):null;
const plannedFinale=['planned-finale','planned-finale-open',
  'planned-finale-one-chaser','planned-finale-three-chasers',
  'planned-finale-selective-chaser','planned-finale-allied',
  'planned-finale-surge','planned-finale-allied-drive',
  'planned-finale-two-chasers-allied-drive',
  'planned-finale-two-selective-chasers-allied-drive',
  'planned-finale-three-chasers-allied-drive',
  'planned-finale-own-plans-allied-drive'].includes(paceMode)||
  managerMixHardChasers!==null;
const plannedChasers=managerMixHardChasers??(
  ['planned-finale-one-chaser','planned-finale-selective-chaser',
  'planned-finale-allied','planned-finale-surge','planned-finale-allied-drive']
  .includes(paceMode)?1:
  ['planned-finale-two-chasers-allied-drive',
    'planned-finale-two-selective-chasers-allied-drive'].includes(paceMode)?2:
  ['planned-finale-three-chasers',
    'planned-finale-three-chasers-allied-drive'].includes(paceMode)?3:0);
const distanceKm=process.argv[6]===undefined?120:Number(process.argv[6]);
const chaserSkillCap=process.argv[7]===undefined?100:Number(process.argv[7]);
const initialFatigueShift=process.argv[8]===undefined?0:Number(process.argv[8]);
const managerMixSelectiveChasers=process.argv[9]===undefined?3:Number(process.argv[9]);
const managerMixAttackKmToGo=process.argv[10]===undefined?5:Number(process.argv[10]);
const managerMixOpportunists=process.argv[11]===undefined?4:Number(process.argv[11]);
const managerMixHardChaseKmToGo=process.argv[12]===undefined?100:
  Number(process.argv[12]);
const managerMixLongChaseEffort=process.argv[13]??'hard';
const managerMixHardFinishKmToGo=process.argv[14]===undefined?0:
  Number(process.argv[14]);
const managerMixOpportunistAttackAtKm=process.argv[15]===undefined?0:
  Number(process.argv[15]);
const managerMixOpportunistStopKmToGo=process.argv[16]===undefined?0:
  Number(process.argv[16]);
const managerMixOpportunistStopTeams=process.argv[17]===undefined?
  managerMixOpportunists:Number(process.argv[17]);
const managerMixOpportunistStopOffset=process.argv[18]===undefined?0:
  Number(process.argv[18]);
const genderSkillMode=process.argv[19]??'mirrored';
// Reproduce a later paired seed without replaying every preceding field.
const sampleOffset=process.argv[20]===undefined?0:Number(process.argv[20]);
// Keep specialist team identities fixed when hard-chaser participation varies.
const managerMixRoleMode=process.argv[21]??'shifted';
const orderedFinaleCoverage=process.argv[22]??'off';
// Optional final argument: validate the read-only result and point contract.
const resultContractAudit=process.argv[23]??'off';
const chaserCapScope=process.argv[24]??'all';
const v91Coverage=process.env.PELOTONIA_V91_COVERAGE==='on';
const motorVersion=motorMode==='attack-trace'?MOTOR_ATTACK_TRACE_VERSION:
  motorMode==='phase-attack'?MOTOR_PHASE_ATTACK_VERSION:
  motorMode==='recovery-ceiling'?MOTOR_RECOVERY_CEILING_VERSION:
  motorMode==='distance-load'?MOTOR_DISTANCE_LOAD_VERSION:
  motorMode==='draft-shelter'?MOTOR_DRAFT_SHELTER_VERSION:
  motorMode==='explicit-front'?MOTOR_EXPLICIT_FRONT_VERSION:
  motorMode==='neutral-pace'?MOTOR_NEUTRAL_PACE_VERSION:
  motorMode==='earned-bridge-finale'?MOTOR_EARNED_BRIDGE_VERSION:
  motorMode==='bounded-bridge-finale'?MOTOR_BRIDGE_FINALE_VERSION:
  motorMode==='bounded-finale'?MOTOR_FINALE_VERSION:
  motorMode==='paid-pace'?MOTOR_PAID_PACE_VERSION:
  motorMode==='candidate'?MOTOR_CANDIDATE_VERSION:TUNING_VERSION;
const gapAuditOptions={recoverySecondsPerCapacity:motorMode!=='current'?
  MOTOR_CANDIDATE.chaseRecoverySecondsPerCapacity:
  TUNING.chase.recoverySecondsPerCapacity};
if(!Number.isInteger(samples)||samples<1||samples>100||
  !Number.isInteger(fieldTeams)||fieldTeams<2||fieldTeams>20||
  managerMixHardChasers!==null&&![15,20].includes(fieldTeams)||
  ![120,260].includes(distanceKm)||
  !Number.isInteger(chaserSkillCap)||chaserSkillCap<20||chaserSkillCap>100||
  !Number.isInteger(initialFatigueShift)||initialFatigueShift<0||
    initialFatigueShift>30||
  process.argv[8]!==undefined&&managerMixHardChasers===null||
  !Number.isInteger(managerMixSelectiveChasers)||
    managerMixSelectiveChasers<0||managerMixSelectiveChasers>3||
  process.argv[9]!==undefined&&managerMixHardChasers===null||
  ![5,10,20].includes(managerMixAttackKmToGo)||
  process.argv[10]!==undefined&&managerMixHardChasers===null||
  !Number.isInteger(managerMixOpportunists)||managerMixOpportunists<0||
    managerMixOpportunists>4||
  process.argv[11]!==undefined&&managerMixHardChasers===null||
  !Number.isInteger(managerMixHardChaseKmToGo)||
    managerMixHardChaseKmToGo<20||managerMixHardChaseKmToGo>=distanceKm||
  process.argv[12]!==undefined&&managerMixHardChasers===null||
  !['steady','hard'].includes(managerMixLongChaseEffort)||
  process.argv[13]!==undefined&&managerMixHardChasers===null||
  ![0,20,40,60].includes(managerMixHardFinishKmToGo)||
  managerMixHardFinishKmToGo>=managerMixHardChaseKmToGo||
  managerMixHardFinishKmToGo>0&&managerMixLongChaseEffort!=='steady'||
  process.argv[14]!==undefined&&managerMixHardChasers===null||
  ![0,40,80,120].includes(managerMixOpportunistAttackAtKm)||
  managerMixOpportunistAttackAtKm>=distanceKm-managerMixAttackKmToGo||
  process.argv[15]!==undefined&&managerMixHardChasers===null||
  ![0,5,10].includes(managerMixOpportunistStopKmToGo)||
  managerMixOpportunistStopKmToGo>0&&managerMixOpportunists===0||
  distanceKm-managerMixOpportunistStopKmToGo<=
    managerMixOpportunistAttackAtKm||
  process.argv[16]!==undefined&&managerMixHardChasers===null||
  !Number.isInteger(managerMixOpportunistStopTeams)||
  managerMixOpportunistStopTeams<0||
  managerMixOpportunistStopTeams>managerMixOpportunists||
  process.argv[17]!==undefined&&managerMixHardChasers===null||
  !Number.isInteger(managerMixOpportunistStopOffset)||
  managerMixOpportunistStopOffset<0||
  managerMixOpportunistStopOffset>=Math.max(1,managerMixOpportunists)||
  process.argv[18]!==undefined&&managerMixHardChasers===null||
  !['mirrored','independent'].includes(genderSkillMode)||
  !Number.isInteger(sampleOffset)||sampleOffset<0||sampleOffset>999||
  !['shifted','fixed'].includes(managerMixRoleMode)||
  managerMixHardChasers===null&&process.argv[21]!==undefined||
  !['off','ordered'].includes(orderedFinaleCoverage)||
  !['off','on'].includes(resultContractAudit)||
  !CHASER_CAP_SCOPES[chaserCapScope]||
  !['current','candidate','paid-pace','bounded-finale','bounded-bridge-finale',
    'earned-bridge-finale','neutral-pace','explicit-front','draft-shelter',
    'distance-load','recovery-ceiling','phase-attack','attack-trace']
    .includes(motorMode)||
  !managerMixMatch&&!['preset','paced-rival','steady-rival','rotate-rival','late-hard-rival',
    'rotate-plans','planned-finale','planned-finale-open',
    'planned-finale-one-chaser','planned-finale-three-chasers',
    'planned-finale-selective-chaser','planned-finale-allied',
    'planned-finale-surge','planned-finale-allied-drive',
    'planned-finale-two-chasers-allied-drive',
    'planned-finale-two-selective-chasers-allied-drive',
    'planned-finale-three-chasers-allied-drive',
    'planned-finale-own-plans-allied-drive'].includes(paceMode)||
  (managerMixHardChasers!==null||
  ['steady-rival','rotate-rival','late-hard-rival','rotate-plans','planned-finale',
    'planned-finale-open','planned-finale-one-chaser',
    'planned-finale-three-chasers','planned-finale-selective-chaser',
    'planned-finale-allied','planned-finale-surge',
    'planned-finale-allied-drive','planned-finale-three-chasers-allied-drive',
    'planned-finale-two-chasers-allied-drive',
    'planned-finale-two-selective-chasers-allied-drive',
    'planned-finale-own-plans-allied-drive']
    .includes(paceMode))&&
    !['explicit-front','draft-shelter','distance-load',
      'recovery-ceiling','phase-attack','attack-trace'].includes(motorMode))
  throw new Error('Usage: node scripts/engine-v2-ensemble.mjs [paired samples: 1-100] [teams: 2-20] [current|candidate|paid-pace|bounded-finale|bounded-bridge-finale|earned-bridge-finale|neutral-pace|explicit-front|draft-shelter|distance-load|recovery-ceiling|phase-attack|attack-trace] [preset|paced-rival|steady-rival|rotate-rival|late-hard-rival|rotate-plans|planned-finale|planned-finale-open|planned-finale-one-chaser|planned-finale-three-chasers|planned-finale-selective-chaser|planned-finale-allied|planned-finale-surge|planned-finale-allied-drive|planned-finale-two-chasers-allied-drive|planned-finale-three-chasers-allied-drive|planned-finale-own-plans-allied-drive|planned-finale-allied-manager-mix-[0-3] (v86+ only)] [120|260 km] [chaser skill cap: 20-100] [manager-mix initial fatigue shift: 0-30] [manager-mix selective chasers: 0-3] [manager-mix attack km to go: 5|10|20] [manager-mix opportunists: 0-4] [manager-mix chase km to go: 20..<distance] [manager-mix chase effort: steady|hard] [manager-mix hard finish km to go: 0|20|40|60, after steady only] [manager-mix opportunist attack at km: 0|40|80|120] [manager-mix opportunist stop km to go: 0|5|10] [manager-mix opportunist stop teams: 0..opportunists] [manager-mix stop-rank offset: 0..<opportunists] [mirrored|independent gender rosters] [sample offset: 0-999] [shifted|fixed manager roles] [off|ordered short-step coverage] [off|on read-only result contract audit]');

if(v91Coverage&&motorMode!=='attack-trace')
  throw new Error('V91 short-step coverage needs the attack-trace motor.');

const ROUTES={
  flat:{distance_km:120,profile_points:[[0,60],[40,60],[80,75],[120,60]],
    exposed_segments:[{from_km:30,to_km:70}]},
  rolling:{distance_km:120,profile_points:[[0,90],[20,240],[40,90],[60,300],[80,110],[100,230],[120,90]],
    surface_segments:[{from_km:38,to_km:43,surface:'cobbles'}]},
  mountain:{distance_km:120,profile_points:[[0,400],[30,700],[50,1500],[70,800],[95,1900],[120,450]],
    surface_segments:[{from_km:75,to_km:80,surface:'gravel'}]},
};
const LONG_ROUTES={
  flat:{distance_km:260,profile_points:[[0,60],[80,60],[160,75],[260,60]],
    exposed_segments:[{from_km:70,to_km:190}]},
  rolling:{distance_km:260,profile_points:[[0,90],[40,240],[80,90],[120,300],
    [160,110],[200,230],[230,80],[260,90]],
  surface_segments:[{from_km:160,to_km:168,surface:'cobbles'}]},
  mountain:{distance_km:260,profile_points:[[0,400],[40,700],[70,1500],
    [100,800],[145,1900],[180,600],[220,1800],[260,450]],
  surface_segments:[{from_km:180,to_km:188,surface:'gravel'}]},
};
const WEATHER={flat:{temp_c:18,wind_kph:22,precipitation_mm:.4},
  rolling:{temp_c:22,wind_kph:16,precipitation_mm:1},
  mountain:{temp_c:9,wind_kph:13,precipitation_mm:1.5}};
const STRATEGIES=['protect','aggressive','balanced'];
const ROLE_BONUSES=[
  {sprint:20,acceleration:16,positioning:12},
  {mountain:20,hills:13,endurance:12},
  {flat:17,timetrial:16,strength:11},
  {cobbles:17,handling:14,wind:12},
];
const clamp=value=>Math.max(15,Math.min(95,value));
const managerMixRank=(index,sample)=>index===0||index===2?null:
  ((index===1?0:index-2)+sample*7)%(fieldTeams-2);
function managerMixRole(rank){
  if(rank===null)return null;
  const selectiveStart=managerMixRoleMode==='fixed'?3:managerMixHardChasers;
  const opportunistStart=selectiveStart+3;
  const rotateStart=opportunistStart+4;
  if(rank<managerMixHardChasers)return 'hard';
  if(rank>=selectiveStart&&rank<selectiveStart+managerMixSelectiveChasers)
    return 'selective';
  if(rank>=opportunistStart&&rank<opportunistStart+managerMixOpportunists)
    return 'opportunist';
  if(rank>=rotateStart&&rank<rotateStart+4)return 'rotate';
  return 'passive';
}

function fictionalTeams(sample,gender){
  return Array.from({length:fieldTeams},(_,teamIndex)=>{
    const id=`team-${teamIndex}`;
    const managerRank=managerMixHardChasers===null?null:
      managerMixRank(teamIndex,sample);
    const cappedChaser=managerRank===null?
      teamIndex===1&&plannedChasers>0:managerRank<managerMixHardChasers;
    const riders=Array.from({length:8},(_,riderIndex)=>{
      const rosterSeed=genderSkillMode==='independent'?`${gender}:${sample}`:
        String(sample);
      const rng=seedrandom(`v2-ensemble-rider:${rosterSeed}:${teamIndex}:${riderIndex}`);
      const role=ROLE_BONUSES[riderIndex%ROLE_BONUSES.length];
      const skills=Object.fromEntries(SPORTING_SKILLS.map(skill=>
        [skill,clamp(Math.round(50+(role[skill]??0)+(rng()-.5)*26))]));
      const scopedSkills=cappedChaser?capDiagnosticChaserSkills(
        skills,chaserSkillCap,chaserCapScope):skills;
      return {id:`${id}-${riderIndex}`,gender,...scopedSkills,
        leadership:clamp(Math.round(35+rng()*50)),form:Math.round(40+rng()*45),
        fatigue:Math.round(rng()*25)+initialFatigueShift};
    });
    return {id,riders};
  });
}

function plannedOpponentOrders(index,team,course,sample){
  if(managerMixHardChasers!==null&&index!==2){
    // Rotate rival roles between seeds; each chase-count comparison retains
    // the same riders, weather, route and role order for that seed.
    const rank=managerMixRank(index,sample);
    const role=managerMixRole(rank);
    const baseline={effort:'conserve',attack:'none',chase:'ignore',
      frontWork:'sit_in'};
    if(role==='hard')return {baseline,
      phases:[{atKm:distanceKm-managerMixHardChaseKmToGo,
        effort:managerMixLongChaseEffort,chase:'all'},
      ...(managerMixHardFinishKmToGo>0?[{
        atKm:distanceKm-managerMixHardFinishKmToGo,
        effort:'hard',chase:'all'}]:[])]};
    if(role==='selective')return {baseline,
      phases:[{atKm:distanceKm-10,effort:'steady',chase:'selective'}]};
    if(role==='opportunist'){
      const opportunistRank=rank-(managerMixRoleMode==='fixed'?6:
        managerMixHardChasers+3);
      const stopThisTeam=managerMixOpportunistStopKmToGo>0&&
        (opportunistRank-managerMixOpportunistStopOffset+
          managerMixOpportunists)%managerMixOpportunists<
        managerMixOpportunistStopTeams;
      return {baseline:{...baseline,effort:'steady',
        attack:managerMixOpportunistAttackAtKm===0?'selective':'none',
        frontWork:'rotate'},
      ...((managerMixOpportunistAttackAtKm>0||
        stopThisTeam)?{phases:[
        ...(managerMixOpportunistAttackAtKm>0?[{
          atKm:managerMixOpportunistAttackAtKm,attack:'selective'}]:[]),
        ...(stopThisTeam?[{
          atKm:distanceKm-managerMixOpportunistStopKmToGo,
          attack:'none'}]:[])]}:{})};
    }
    if(role==='rotate')return {baseline:{...baseline,
      frontWork:'rotate'}};
    return {baseline};
  }
  if((['planned-finale-allied','planned-finale-allied-drive',
    'planned-finale-own-plans-allied-drive',
    'planned-finale-two-chasers-allied-drive',
    'planned-finale-two-selective-chasers-allied-drive',
    'planned-finale-three-chasers-allied-drive']
    .includes(paceMode)||managerMixHardChasers!==null)&&index===2)return {
    baseline:{effort:'conserve',attack:'none',chase:'ignore',frontWork:'sit_in'},
    phases:[{atKm:distanceKm-managerMixAttackKmToGo,attack:'selective',
      ...(paceMode.includes('allied-drive')||managerMixHardChasers!==null?{
        effort:'hard',breakWork:'drive'}:{}),
      attackRiderId:team.riders[course==='flat'?2:1].id}]};
  if(['planned-finale','planned-finale-own-plans-allied-drive']
    .includes(paceMode))return {baseline:{frontWork:index%2===0?
      'rotate':'sit_in'}};
  const chaser=index<=plannedChasers+
    Number(['planned-finale-two-chasers-allied-drive',
      'planned-finale-two-selective-chasers-allied-drive',
      'planned-finale-three-chasers-allied-drive'].includes(paceMode));
  return {baseline:{effort:'conserve',attack:'none',chase:'ignore',
    frontWork:chaser?'sit_in':index%2===0?'rotate':'sit_in'},
  ...(chaser?{phases:[{atKm:distanceKm-10,
    effort:['planned-finale-selective-chaser',
      'planned-finale-two-selective-chasers-allied-drive'].includes(paceMode)?
      'steady':'hard',
    chase:['planned-finale-selective-chaser',
      'planned-finale-two-selective-chasers-allied-drive'].includes(paceMode)?
      'selective':'all'}]}:{})};
}

const report={pairedSamples:samples,sampleOffset,fieldTeams,motorMode,paceMode,
  distanceKm,genderSkillMode,managerMixRoleMode,
  resultContractAudit,
  managerMixRoleAssignments:managerMixHardChasers===null?null:
    Array.from({length:fieldTeams},(_,index)=>index===0||index===2?null:{
      teamId:`team-${index}`,
      role:managerMixRole(managerMixRank(index,sampleOffset)),
    }).filter(Boolean),
  managerMixHardChasers,
  managerMixSelectiveChasers:managerMixHardChasers===null?null:
    managerMixSelectiveChasers,
  managerMixAttackKmToGo:managerMixHardChasers===null?null:
    managerMixAttackKmToGo,
  managerMixOpportunists:managerMixHardChasers===null?null:
    managerMixOpportunists,
  managerMixHardChaseKmToGo:managerMixHardChasers===null?null:
    managerMixHardChaseKmToGo,
  managerMixLongChaseEffort:managerMixHardChasers===null?null:
    managerMixLongChaseEffort,
  managerMixHardFinishKmToGo:managerMixHardChasers===null?null:
    managerMixHardFinishKmToGo,
  managerMixOpportunistAttackAtKm:managerMixHardChasers===null?null:
    managerMixOpportunistAttackAtKm,
  managerMixOpportunistStopKmToGo:managerMixHardChasers===null?null:
    managerMixOpportunistStopKmToGo,
  managerMixOpportunistStopTeams:managerMixHardChasers===null?null:
    managerMixOpportunistStopTeams,
  managerMixOpportunistStopOffset:managerMixHardChasers===null?null:
    managerMixOpportunistStopOffset,
  chaserSkillCap:plannedChasers>0?chaserSkillCap:null,
  chaserCapScope:plannedChasers>0?chaserCapScope:null,
  initialFatigueShift,
  ...(orderedFinaleCoverage==='ordered'?{orderedFinaleCoverage}:{}),
  description:'fictional varied riders and routes; no live data',courses:{}};
for(const [course,stage] of Object.entries(distanceKm===260?LONG_ROUTES:ROUTES)){
  report.courses[course]={};
  for(const gender of ['M','F']){
    report.courses[course][gender]={};
    for(const strategy of STRATEGIES){
      const resultContracts={version:'v2-ensemble-result-contract-audit-1',
        validated:0,riderResults:0,awards:0};
      const v91Finale={version:'v2-ensemble-v91-finale-coverage-2',
        sourceRaces:0,noNamedAttackOrder:0,namedAttackSources:0,
        sourceWithRoadGroups:0,sourceWithDrops:0,
        sourceCompleteBunch:0,sourceWithRivalAttackOrders:0,
        sourceWithMultipleNamedAttackOrders:0,accepted:0,
        concurrent:{sources:0,completeBunchSources:0,
          completeBunchAllNamedEligible:0,
          completeBunchWithOtherPending:0,
          completeBunchWithSelectiveChase:0,
          completeBunchSelectiveChaseOrderCounts:{},
          completeBunchWithSelectiveRotationOverlap:0,
          completeBunchWithFrontRotation:0,
          completeBunchWithAllChase:0,
          completeBunchWithAttackerRotation:0,
          completeBunchWithMultipleAllChase:0,
          namedDecisions:{},otherPendingKinds:{},
          passiveLaunch:0,passiveContact:0,rotationLaunch:0,
          chaseRotationLaunch:0,chaseRotationContact:0,
          chaseRotationPaid:0,
          chaseRotationWithTwoSplit:0,
          relativeArrivals:0,minRelativeSeconds:null,
          maxRelativeSeconds:null,minEstimatedSeparationM:null,
          maxEstimatedSeparationM:null,
          selectiveRotationLaunch:0,selectiveRotationContact:0,
          selectiveRotationEngaged:0,selectiveRotationPaid:0,
          selectiveRotationWithTwoSplit:0,
          selectiveRelativeArrivals:0,
          minSelectiveRelativeSeconds:null,
          maxSelectiveRelativeSeconds:null,
          minSelectiveSeparationM:null,
          maxSelectiveSeparationM:null,
          multiSelectiveLaunch:0,multiSelectivePaid:0,
          multiSelectiveWithTwoSplit:0,
          multiSelectiveRelativeArrivals:0,
          minMultiSelectiveSeparationM:null,
          maxMultiSelectiveSeparationM:null,
          allChaseLaunch:0,allChaseContact:0,
          chasedFollowup:0,chasedCatchMerge:0,
          refusalReasons:{}},
        branches:{},refusalReasons:{},refusalExamples:[]};
      const orderedFinale={noRoadGroup:0,oneRoadGroup:0,
        multipleRoadGroups:0,noBunch:0,accepted:0,
        noRoadGroupWithPaidSourcePace:0,
        noRoadGroupWithRotateOrder:0,
        noRoadGroupWithChaseOrder:0,
        noRoadGroupWithAttackOrder:0,
        noRoadGroupWithNamedAttackOrder:0,
        noRoadGroupExamples:[],multipleRoadGroupExamples:[],
        multiSeparatedAccepted:0,multiSeparatedRejections:{},
        multiSeparatedRejectionExamples:[],
        fullFieldSeparated:{version:'v2-full-field-separated-coverage-1',
          travelVersion:FINALE_SEPARATED_TEAM_LIMIT_VERSION,
          boundsVersion:FINALE_SEPARATED_TEAM_LIMIT_BOUNDS_VERSION,
          intentVersion:FINALE_LAST_KM_ALL_INTENTS_VERSION,
          candidates:0,accepted:0,blockedTeamLimitDecisions:0,
          // This is the separate kilometre recording at 1 km to go, not
          // the still-unresolved 4 km short-step road state.
          lastKmSourceEligibleUnnamedAttacks:0,
          rejections:{}},
        oneRoadSeparatedAccepted:0,oneRoadSeparatedRejections:{},
        postAttackCandidates:0,postAttackAccepted:0,
        postAttackRejections:{},
        postAttackRefusalClasses:{version:'v2-post-attack-refusals-1',
          pendingPelotonAttack:0,invalidSeparatedSource:0,
          calculatedCatch:0,groupContact:0,other:0,otherExamples:[]},
        postAttackKilometreAttackAudit:{version:'v2-post-attack-audit-3',attempted:0,
          blocked:0,absent:0,sourceAlreadyExhausted:0,
          becameExhaustedAfterSource:0,blockedDespiteEnergy:0,
          blockedReasons:{},examples:[],lateBlockExamples:[]},
        survived:0,caught:0,exhaustionDroppedRiders:0,
        racesWithExhaustionDrop:0,readOnlyRejections:{},examples:[],
        rejectionExamples:[]};
      const totals={amberWins:0,amberPodiums:0,breakWins:0,positiveFinalGaps:0,
        photoFinishBreakWins:0,clearBreakWins:0,breakWinMargins:[],
        photoFinalGaps:[],photoFinaleAbilityDiffs:[],photoBunchDeficits:[],
        photoAllTeamsAhead:0,photoLateChaseKm:[],photoLateResidualKm:[],
        lateResidualAffectedRaces:0,residualAffectedBreakWinRaces:0,
        lateResidualAuditCandidateKm:0,lateResidualAuditAttackExcludedKm:0,
        multiGroupResidualAffectedRaces:0,
        finalAutoAttackRaces:0,
        finalAutoJoinedRaces:0,finalAutoWinnerRaces:0,
        finalPhaseCadenceWinnerRaces:0,finalBaselineCadenceWinnerRaces:0,
        preFinalBreakWinnerRaces:0,finalKmJoinWinnerRaces:0,
        breakWinnerGroupAgeKm:[],
        caughtBreaks:0,finishLineCatches:0,partialFinishCatches:0,
        finishLineCaughtRiders:0,droppedRiders:0,amberEnergy:0,
        fieldEnergy:0,winnerEnergy:0,lowEnergyRiders:0,paidPaceKm:0,
        plannedPhaseAttempt:0,plannedPhaseJoin:0,plannedPhaseFirstKm:0,
        plannedPhaseChasers:0,plannedPhaseAttackPower:0,plannedPhaseChasePower:0,
        longChaserEnergyAtAttack:0,longChaserEnergyAtFinish:0,
        longChaserEnergyObservations:0,
        plannedPhaseCaught:0,plannedPhaseBreakKm:0,
        plannedFinalAvailable:0,plannedFinalAttempt:0,plannedFinalJoin:0,
        plannedFinalSurvive:0,plannedFinalCaughtAtLine:0,
        plannedFinalWin:0,plannedFinalPlace:0,plannedFinalEnergy:0,
        alliedPhaseAttempt:0,alliedPhaseJoin:0,alliedPhaseCaught:0,
        alliedPhaseBreakKm:0,
        alliedFinalAttempt:0,alliedFinalJoin:0,alliedFinalSurvive:0,
        alliedFinalCaughtAtLine:0,alliedFinalWin:0,eitherAlliedWin:0,
        paidWorkerEnergy:0,paidWorkerRaces:0,paidWorkerCount:0,frontConcentration:0,
        penultimateGapSeconds:0,finalKmAttackPower:0,finalKmAttackers:0,
        finalKmBlockedAttacks:0,finalKmChasePower:0,finalKmPaidPaceAbility:0,
        finalKmPaidPaceRaces:0,finalKmJoinedRiders:0,finalKmCaughtRiders:0,
        finalGaps:[],finalKmJoinWinnerExamples:[],
        finalKmJoinWinnerAttackShares:[],finalKmJoinWinnerAttackRanks:[],
        maxGroups:0,multiGroupFinishes:0,chaseGroupAttackMoves:0,
        bridgesToGroupAhead:0,roadGroupLimitBlocks:0};
      for(let index=0;index<samples;index++){
        const sample=index+sampleOffset;
        const teams=fictionalTeams(sample,gender).map((team,index)=>({
          ...team,orders:{captainId:team.riders[0].id,roadCaptainId:team.riders[1].id,
            preset:index===0?strategy:
              plannedFinale&&plannedChasers&&index<=plannedChasers?'balanced':
                STRATEGIES[(index-1)%STRATEGIES.length],
            ...(['paced-rival','steady-rival','rotate-rival','late-hard-rival']
              .includes(paceMode)&&index===1?{
              baseline:{effort:paceMode==='paced-rival'?'hard':
                paceMode==='steady-rival'?'steady':'conserve',
                attack:'none',chase:'ignore',
                ...(['explicit-front','draft-shelter','distance-load',
                  'recovery-ceiling','phase-attack','attack-trace'].includes(motorMode)?
                  {frontWork:'rotate'}:{})},
              ...(paceMode==='late-hard-rival'?{
                phases:[{atKm:distanceKm-40,effort:'hard'}]}:{})}:{}),
            ...(paceMode==='rotate-plans'?{baseline:{frontWork:index%2===0?
              'rotate':'sit_in'}}:{}),
            ...(plannedFinale?index===0?{
              baseline:{attack:'none',chase:'ignore',frontWork:'sit_in'},
              phases:[{atKm:distanceKm-(managerMixHardChasers===null?5:
                managerMixAttackKmToGo),attack:'selective',
                ...(['planned-finale-surge','planned-finale-allied-drive',
                  'planned-finale-two-chasers-allied-drive',
                  'planned-finale-two-selective-chasers-allied-drive',
                  'planned-finale-three-chasers-allied-drive',
                  'planned-finale-own-plans-allied-drive']
                  .includes(paceMode)||managerMixHardChasers!==null?
                  {effort:'hard',breakWork:'drive'}:{}),
                attackRiderId:team.riders[course==='flat'?2:1].id}],
            }:plannedOpponentOrders(index,team,course,sample):{})},
        }));
        const rng=seedrandom(`v2-ensemble-weather:${course}:${sample}`);
        const base=WEATHER[course];
        const weather={temp_c:base.temp_c+(rng()-.5)*8,
          wind_kph:Math.max(0,base.wind_kph+(rng()-.5)*16),
          precipitation_mm:Math.max(0,base.precipitation_mm+(rng()-.5)*2)};
        const race=simulateTacticalTour({stage,teams,weather,seed:`v2-ensemble:${course}:${sample}`,motorVersion});
        try{validateRecordedTour(race);}catch(error){
          let previousRoadGroups=[];
          for(const frame of race.frames){
            try{validateRoadGroupTransition(previousRoadGroups,frame.roadGroups,{
              joinedRiderIds:frame.joinedBreakawayRiderIds,
              caughtRiderIds:frame.caughtBreakawayRiderIds,
              breakMoves:frame.splitAttacks.filter(attack=>
                ['split','joined_group_ahead'].includes(attack?.status)),
              formedChaseGroupId:frame.formedChaseGroupId,
              mergedGroupIds:frame.mergedRoadGroupIds,
              finaleCatchMoves:frame.finaleRoadGroupCatches,
              finishLineCatch:frame.finishLineCatch,
            });}catch(transitionError){
              throw new Error(`Invalid recording: ${course}/${gender}/${strategy}/sample-${sample}, km ${frame.km}, attack ${managerMixAttackKmToGo} km to go, formed ${frame.formedChaseGroupId}, joined ${frame.joinedBreakawayRiderIds.join(',')}, caught ${frame.caughtBreakawayRiderIds.join(',')}, old ${previousRoadGroups.map(group=>group.id).join(',')}, new ${frame.roadGroups.map(group=>group.id).join(',')}`,{cause:transitionError});
            }
            previousRoadGroups=frame.roadGroups;
          }
          throw new Error(`Invalid recording: ${course}/${gender}/${strategy}/sample-${sample}, ${paceMode}`,{cause:error});
        }
        if(v91Coverage){
          v91Finale.sourceRaces++;
          const handoff=race.frames[distanceKm-2];
          v91Finale.sourceWithRoadGroups+=Number(handoff.roadGroups.length>0);
          v91Finale.sourceWithDrops+=Number(handoff.riderGroups.some(row=>
            row.group==='dropped'));
          v91Finale.sourceCompleteBunch+=Number(
            !handoff.roadGroups.length&&handoff.riderGroups.every(row=>
              row.group==='peloton'));
          const namedTeams=race.committedInputs.teams.filter(team=>
            orderAt(team.orders,distanceKm-1).attackRiderId);
          if(namedTeams.length>1){
            const concurrent=v91Finale.concurrent;
            concurrent.sources++;
            if(!handoff.roadGroups.length&&handoff.riderGroups.every(row=>
              row.group==='peloton')){
              concurrent.completeBunchSources++;
              const intents=recordFinaleLastKmNamedIntentsFromTour(race);
              concurrent.completeBunchAllNamedEligible+=Number(
                intents.named.every(row=>row.canEnterRoadContest));
              concurrent.completeBunchWithOtherPending+=Number(
                intents.otherPendingActions.length>0);
              concurrent.completeBunchWithSelectiveChase+=Number(
                intents.unresolvedSelectiveChaseTeamIds.length>0);
              const activeOrders=race.committedInputs.teams.map(team=>
                orderAt(team.orders,distanceKm-1));
              const selectiveChaseOrders=activeOrders.filter(order=>
                order.chase==='selective').length;
              concurrent.completeBunchSelectiveChaseOrderCounts[
                selectiveChaseOrders]=(concurrent
                .completeBunchSelectiveChaseOrderCounts[
                  selectiveChaseOrders]??0)+1;
              concurrent.completeBunchWithSelectiveRotationOverlap+=Number(
                activeOrders.some(order=>order.chase==='selective'&&
                  order.frontWork==='rotate'));
              concurrent.completeBunchWithFrontRotation+=Number(
                activeOrders.some(order=>order.frontWork!=='sit_in'));
              concurrent.completeBunchWithAllChase+=Number(
                activeOrders.some(order=>order.chase==='all'));
              concurrent.completeBunchWithAttackerRotation+=Number(
                namedTeams.some(team=>
                  orderAt(team.orders,distanceKm-1)
                    .frontWork!=='sit_in'));
              concurrent.completeBunchWithMultipleAllChase+=Number(
                activeOrders.filter(order=>order.chase==='all').length>1);
              for(const row of intents.named)
                concurrent.namedDecisions[row.decision]=
                  (concurrent.namedDecisions[row.decision]??0)+1;
              for(const action of intents.otherPendingActions)
                concurrent.otherPendingKinds[action.kind]=
                  (concurrent.otherPendingKinds[action.kind]??0)+1;
              const attempt=(key,record)=>{
                try{
                  const result=record(race);
                  concurrent[key]++;
                  return result;
                }catch(error){
                  if(error instanceof TypeError||!(error instanceof Error))
                    throw error;
                  const reason=`${key}: ${error.message}`;
                  concurrent.refusalReasons[reason]=
                    (concurrent.refusalReasons[reason]??0)+1;
                  return null;
                }
              };
              if(attempt('passiveLaunch',
                recordFinaleConcurrentNamedLaunchFromTour))
                attempt('passiveContact',
                  recordFinaleConcurrentNamedRoadContactFromTour);
              attempt('rotationLaunch',
                recordFinaleConcurrentNamedRotationLaunchFromTour);
              const combined=attempt('chaseRotationLaunch',
                recordFinaleConcurrentNamedChaseRotationFromTour);
              if(combined){
                concurrent.chaseRotationPaid+=Number(
                  combined.rotationDecision==='paid');
                concurrent.chaseRotationWithTwoSplit+=Number(
                  combined.attacks.filter(row=>row.status==='split')
                    .length>1);
                attempt('chaseRotationContact',
                  recordFinaleConcurrentNamedChaseRotationContactFromTour);
                if(combined.attacks.filter(row=>
                  row.status==='split').length===2){
                  const relative=attempt('relativeArrivals',
                    recordFinaleConcurrentRelativeArrivalsFromTour);
                  if(relative){
                    concurrent.minRelativeSeconds=Math.min(
                      concurrent.minRelativeSeconds??Infinity,
                      relative.separationSeconds);
                    concurrent.maxRelativeSeconds=Math.max(
                      concurrent.maxRelativeSeconds??0,
                      relative.separationSeconds);
                    concurrent.minEstimatedSeparationM=Math.min(
                      concurrent.minEstimatedSeparationM??Infinity,
                      relative.estimatedSeparationM);
                    concurrent.maxEstimatedSeparationM=Math.max(
                      concurrent.maxEstimatedSeparationM??0,
                      relative.estimatedSeparationM);
                  }
                }
              }
              const selectiveCombined=attempt('selectiveRotationLaunch',
                recordFinaleConcurrentNamedSelectiveRotationFromTour);
              if(selectiveCombined){
                concurrent.selectiveRotationEngaged+=Number(
                  selectiveCombined.selectiveDecision.decision==='engage');
                concurrent.selectiveRotationPaid+=Number(
                  selectiveCombined.rotationDecision==='paid');
                const twoSplit=selectiveCombined.attacks.filter(row=>
                  row.status==='split').length===2;
                concurrent.selectiveRotationWithTwoSplit+=Number(twoSplit);
                if(!twoSplit)attempt('selectiveRotationContact',
                  recordFinaleConcurrentNamedSelectiveRotationContactFromTour);
                if(twoSplit){
                  const relative=attempt('selectiveRelativeArrivals',
                    recordFinaleConcurrentSelectiveRelativeArrivalsFromTour);
                  if(relative){
                    concurrent.minSelectiveRelativeSeconds=Math.min(
                      concurrent.minSelectiveRelativeSeconds??Infinity,
                      relative.separationSeconds);
                    concurrent.maxSelectiveRelativeSeconds=Math.max(
                      concurrent.maxSelectiveRelativeSeconds??0,
                      relative.separationSeconds);
                    concurrent.minSelectiveSeparationM=Math.min(
                      concurrent.minSelectiveSeparationM??Infinity,
                      relative.estimatedSeparationM);
                    concurrent.maxSelectiveSeparationM=Math.max(
                      concurrent.maxSelectiveSeparationM??0,
                      relative.estimatedSeparationM);
                  }
                }
              }
              const multiSelective=attempt('multiSelectiveLaunch',
                recordFinaleConcurrentNamedMultiSelectiveRotationFromTour);
              if(multiSelective){
                concurrent.multiSelectivePaid+=Number(
                  Boolean(multiSelective.chase)&&
                    multiSelective.rotationDecision==='paid');
                const twoSplit=multiSelective.attacks.length===2&&
                  multiSelective.attacks.every(row=>row.status==='split');
                concurrent.multiSelectiveWithTwoSplit+=Number(twoSplit);
                if(twoSplit){
                  const relative=attempt('multiSelectiveRelativeArrivals',
                    recordFinaleConcurrentMultiSelectiveRelativeArrivalsFromTour);
                  if(relative){
                    concurrent.minMultiSelectiveSeparationM=Math.min(
                      concurrent.minMultiSelectiveSeparationM??Infinity,
                      relative.estimatedSeparationM);
                    concurrent.maxMultiSelectiveSeparationM=Math.max(
                      concurrent.maxMultiSelectiveSeparationM??0,
                      relative.estimatedSeparationM);
                  }
                }
              }
              if(attempt('allChaseLaunch',
                recordFinaleConcurrentNamedAllChaseFromTour)&&
                attempt('allChaseContact',
                  recordFinaleConcurrentNamedAllChaseContactFromTour)){
                const followup=attempt('chasedFollowup',
                  recordFinaleConcurrentChasedFollowupFromTour);
                if(followup?.outcome==='caught_uncontinued')
                  attempt('chasedCatchMerge',
                    recordFinaleConcurrentChasedCatchMergeFromTour);
              }
            }
          }
          if(!namedTeams.length)v91Finale.noNamedAttackOrder++;
          else{
            v91Finale.namedAttackSources++;
            v91Finale.sourceWithMultipleNamedAttackOrders+=
              Number(namedTeams.length>1);
            v91Finale.sourceWithRivalAttackOrders+=Number(
              race.committedInputs.teams.some(team=>
                team.id!==namedTeams[0].id&&
                orderAt(team.orders,distanceKm-1).attack!=='none'));
            const input={attackTeamId:namedTeams[0].id,tier:3,
              divisionIndex:1,divisionCount:1,
              plans:race.committedInputs.teams.map(team=>({
                teamId:team.id,finisherId:team.orders.captainId,
                leadOutRiderId:null}))};
            let candidate=null;
            try{
              candidate=recordFinaleRotationV91CandidateFromTour(
                race,input);
            }catch(error){
              if(error instanceof TypeError||!(error instanceof Error))throw error;
              const reason=String(error.message);
              v91Finale.refusalReasons[reason]=
                (v91Finale.refusalReasons[reason]??0)+1;
              if(v91Finale.refusalExamples.length<3)
                v91Finale.refusalExamples.push({sample,reason,
                  namedAttackTeamIds:namedTeams.map(team=>team.id),
                  roadGroupCount:handoff.roadGroups.length,
                  droppedRiderCount:handoff.riderGroups.filter(row=>
                    row.group==='dropped').length});
            }
            if(candidate){
              validateFinaleRotationV91CandidateFromTour(race,input,
                candidate);
              if(candidate.line.lineRiderEnergy.length!==fieldTeams*8||
                candidate.pointBounds.riders.length!==fieldTeams*8||
                candidate.canCommitAwards)
                throw new Error('V91 coverage lost riders or committed awards.');
              v91Finale.accepted++;
              v91Finale.branches[candidate.branch]=
                (v91Finale.branches[candidate.branch]??0)+1;
            }
          }
        }
        if(resultContractAudit==='on'){
          const eventId=`v2-ensemble:${course}:${gender}:${sample}`;
          const reveal=assignPointDivisions({eventId,seasonYear:2026,
            gender,entrants:teams.map(team=>({teamId:team.id,earnedPoints:0}))});
          const candidate={eventId,divisionReveal:reveal,
            divisions:[{index:1,teamIds:reveal.assignments.map(row=>row.teamId),
              recording:race}]};
          const contract=buildV2OneDayResultContract(candidate,{tier:3});
          validateV2OneDayResultContract(contract);
          resultContracts.validated++;
          resultContracts.riderResults+=contract.divisions[0].riderResults.length;
          resultContracts.awards+=contract.divisions[0].awards.length;
        }
        if(orderedFinaleCoverage==='ordered'){
          const fullFieldSource=race.frames[distanceKm-5];
          const fullFieldAudit=orderedFinale.fullFieldSeparated;
          if(fullFieldSource.roadGroups.length>0&&
            fullFieldSource.riderGroups.some(row=>row.group==='peloton')&&
            fullFieldSource.riderGroups.some(row=>row.group==='dropped')){
            fullFieldAudit.candidates++;
            try{
              const intents=recordFinaleLastKmNamedIntentsFromTour(race,{
                version:FINALE_LAST_KM_ALL_INTENTS_VERSION});
              fullFieldAudit.lastKmSourceEligibleUnnamedAttacks+=
                intents.eligibleUnnamedRiderIds.length;
              const travel=probeFinaleSeparatedGroupsFromTour(race,{
                version:FINALE_SEPARATED_TEAM_LIMIT_VERSION});
              validateFinaleSeparatedGroupsFromTour(race,travel);
              const bounds=probeFinaleSeparatedFinishBoundsFromTour(race,{
                version:FINALE_SEPARATED_TEAM_LIMIT_BOUNDS_VERSION});
              validateFinaleSeparatedFinishBoundsFromTour(race,bounds);
              const riderCount=fieldTeams*8;
              if(travel.finalRiderEnergy.length!==riderCount||
                bounds.riders.length!==riderCount||
                bounds.resultStatus!=='unclassified'||
                bounds.pointsStatus!=='withheld')
                throw new Error('Complete-field finale audit lost riders or awarded points.');
              fullFieldAudit.accepted++;
              fullFieldAudit.blockedTeamLimitDecisions+=travel.frames
                .flatMap(frame=>frame.blockedNamedAttacks)
                .filter(row=>row.reason==='team_break_limit'&&
                  row.riderId===null).length;
            }catch(error){
              const reason=String(error.message);
              fullFieldAudit.rejections[reason]=
                (fullFieldAudit.rejections[reason]??0)+1;
            }
          }
          const handoff=race.frames[distanceKm-6];
          const groupCount=handoff.roadGroups.length;
          const tryPostAttack=()=>{
            if(!race.frames[distanceKm-5].attackReasons.some(row=>
              row.reason==='named_order'))return;
            orderedFinale.postAttackCandidates++;
            try{
              const probe=probeFinaleSeparatedGroupsFromTour(race,{
                version:'v2-finale-separated-post-attack-5'});
              validateFinaleSeparatedGroupsFromTour(race,probe);
              orderedFinale.postAttackAccepted++;
            }catch(error){
              const reason=String(error.message);
              orderedFinale.postAttackRejections[reason]=
                (orderedFinale.postAttackRejections[reason]??0)+1;
              const refusals=orderedFinale.postAttackRefusalClasses;
              const refusalClass=reason.startsWith(
                'The short-step finale needs a recorded peloton attack:')?
                'pendingPelotonAttack':reason.startsWith(
                  'A separated finale needs multiple road groups')?
                  'invalidSeparatedSource':reason.startsWith(
                    'The separated finale needs a recorded catch')?
                    'calculatedCatch':reason.startsWith(
                      'The separated finale needs a recorded group contact')?
                      'groupContact':'other';
              refusals[refusalClass]++;
              if(refusalClass==='other'&&refusals.otherExamples.length<3)
                refusals.otherExamples.push({sample,reason});
              // This is a comparison with the validated kilometre outcome,
              // never a substitute event in the counterfactual short steps.
              const pendingAttack=/^The short-step finale needs a recorded peloton attack: (.+) at km (\d+)\.$/
                .exec(reason);
              if(pendingAttack){
                const [,teamId,kmText]=pendingAttack;
                const frame=race.frames[Number(kmText)-1];
                const audit=orderedFinale.postAttackKilometreAttackAudit;
                const team=teams.find(row=>row.id===teamId);
                const riderIds=new Set(team?.riders.map(row=>row.id)??[]);
                const blocked=frame?.blockedAttacks?.find(row=>
                  row.teamId===teamId);
                const activity=frame?.attackReasons?.some(row=>
                  riderIds.has(row.riderId))?'attempted':
                  blocked?'blocked':'absent';
                audit[activity]++;
                const sourceEnergy=blocked?.riderId?
                  race.frames[race.route.distanceKm-5]?.riderGroups.find(row=>
                    row.id===blocked.riderId)?.energy:null;
                const sourceAlreadyExhausted=activity==='blocked'&&
                  sourceEnergy!==null&&sourceEnergy!==undefined&&
                  sourceEnergy<TUNING.attack.minEnergyFraction*100;
                audit.sourceAlreadyExhausted+=Number(sourceAlreadyExhausted);
                const preAttackEnergy=blocked?.riderId?
                  race.frames[Number(kmText)-2]?.riderGroups.find(row=>
                    row.id===blocked.riderId)?.energy:null;
                const becameExhaustedAfterSource=activity==='blocked'&&
                  blocked.reason==='exhausted'&&!sourceAlreadyExhausted&&
                  preAttackEnergy!==null&&preAttackEnergy!==undefined&&
                  preAttackEnergy<TUNING.attack.minEnergyFraction*100;
                const blockedDespiteEnergy=activity==='blocked'&&
                  blocked.reason==='exhausted'&&!sourceAlreadyExhausted&&
                  !becameExhaustedAfterSource;
                audit.becameExhaustedAfterSource+=Number(becameExhaustedAfterSource);
                audit.blockedDespiteEnergy+=Number(blockedDespiteEnergy);
                if(activity==='blocked')audit.blockedReasons[blocked.reason]=
                  (audit.blockedReasons[blocked.reason]??0)+1;
                if(audit.examples.length<3)audit.examples.push({sample,
                  teamId,km:Number(kmText),activity,
                  ...(activity==='blocked'?{blockedReason:blocked.reason,
                    sourceEnergy,preAttackEnergy,sourceAlreadyExhausted}:{})});
                if((becameExhaustedAfterSource||blockedDespiteEnergy)&&
                  audit.lateBlockExamples.length<5)
                  audit.lateBlockExamples.push({sample,teamId,
                    riderId:blocked.riderId,km:Number(kmText),
                    sourceEnergy,preAttackEnergy,blockedReason:blocked.reason,
                    becameExhaustedAfterSource});
              }
            }
          };
          if(groupCount===0){
            orderedFinale.noRoadGroup++;
            orderedFinale.noRoadGroupWithPaidSourcePace+=
              Number(Boolean(handoff.paidBunchPace));
            const orders=race.committedInputs.teams.map(team=>({
              teamId:team.id,
              order:orderAt(team.orders,distanceKm-5),
            }));
            orderedFinale.noRoadGroupWithRotateOrder+=Number(orders.some(
              row=>row.order.frontWork==='rotate'));
            orderedFinale.noRoadGroupWithChaseOrder+=Number(orders.some(
              row=>row.order.chase!=='ignore'));
            orderedFinale.noRoadGroupWithAttackOrder+=Number(orders.some(
              row=>row.order.attack!=='none'));
            orderedFinale.noRoadGroupWithNamedAttackOrder+=Number(orders.some(
              row=>row.order.attackRiderId));
            if(orderedFinale.noRoadGroupExamples.length<2)
              orderedFinale.noRoadGroupExamples.push({sample,
                paidSourcePace:handoff.paidBunchPace,
                rotateTeamIds:orders.filter(row=>
                  row.order.frontWork==='rotate').map(row=>row.teamId),
                chaseTeamIds:orders.filter(row=>
                  row.order.chase!=='ignore').map(row=>row.teamId),
                attackTeamIds:orders.filter(row=>
                  row.order.attack!=='none').map(row=>row.teamId),
                namedAttackTeamIds:orders.filter(row=>
                  row.order.attackRiderId).map(row=>row.teamId)});
          }else if(groupCount>1){
            orderedFinale.multipleRoadGroups++;
            if(orderedFinale.multipleRoadGroupExamples.length<2)
              orderedFinale.multipleRoadGroupExamples.push({sample,
                groups:handoff.roadGroups.map(group=>({id:group.id,
                  gapSeconds:group.gapSeconds,
                  riderIds:group.riderIds})),
                pelotonRiderCount:handoff.riderGroups.filter(row=>
                  row.group==='peloton').length});
            try{
              const probe=probeFinaleSeparatedGroupsFromTour(race);
              validateFinaleSeparatedGroupsFromTour(race,probe);
              orderedFinale.multiSeparatedAccepted++;
            }catch(error){
              const reason=String(error.message);
              orderedFinale.multiSeparatedRejections[reason]=
                (orderedFinale.multiSeparatedRejections[reason]??0)+1;
              tryPostAttack();
              if(orderedFinale.multiSeparatedRejectionExamples.length<3)
                orderedFinale.multiSeparatedRejectionExamples.push({sample,
                  reason,sourceGroups:handoff.roadGroups.map(group=>({
                    id:group.id,gapSeconds:group.gapSeconds}))});
            }
          }
          else if(!handoff.riderGroups.some(rider=>rider.group==='peloton'))
            orderedFinale.noBunch++;
          else{
            orderedFinale.oneRoadGroup++;
            try{
              const probe=probeFinaleOrderedGroupToLineFromTour(race);
              validateFinaleOrderedGroupToLineFromTour(race,probe);
              orderedFinale.accepted++;
              orderedFinale[probe.recording.outcome==='survived'?
                'survived':'caught']++;
              const drops=probe.recording.exhaustionDrops??[];
              orderedFinale.exhaustionDroppedRiders+=drops.length;
              if(drops.length)orderedFinale.racesWithExhaustionDrop++;
              if(orderedFinale.examples.length<2)orderedFinale.examples.push({
                sample,version:probe.version,
                initialGapSeconds:probe.input.snapshot.roadGroups[0].gapSeconds,
                outcome:probe.recording.outcome,
                finishGapSeconds:probe.recording.finishGapSeconds,
                catchDistanceM:probe.recording.catchDistanceM,
                exhaustionDroppedRiderIds:drops.map(drop=>drop.riderId),
              });
            }catch(error){
              const reason=String(error.message);
              orderedFinale.readOnlyRejections[reason]=
                (orderedFinale.readOnlyRejections[reason]??0)+1;
              tryPostAttack();
              try{
                const separated=probeFinaleSeparatedGroupsFromTour(race);
                validateFinaleSeparatedGroupsFromTour(race,separated);
                orderedFinale.oneRoadSeparatedAccepted++;
              }catch(separatedError){
                const separatedReason=String(separatedError.message);
                orderedFinale.oneRoadSeparatedRejections[separatedReason]=
                  (orderedFinale.oneRoadSeparatedRejections[
                    separatedReason]??0)+1;
              }
              if(orderedFinale.rejectionExamples.length<3)
                orderedFinale.rejectionExamples.push({sample,reason,
                  sourceRider:handoff.riderGroups.find(rider=>
                    reason.includes(`: ${rider.id} at `))??null,
                  sourceRoadGroups:handoff.roadGroups.map(group=>({
                    id:group.id,gapSeconds:group.gapSeconds,
                    riders:group.riderIds.map(id=>{
                      const rider=handoff.riderGroups.find(row=>row.id===id);
                      return {riderId:id,energy:rider?.energy};
                    })})),
                });
            }
          }
        }
        report.tuningVersion??=race.tuningVersion;
        const finalFrame=race.frames.at(-1);
        // The historical finalAuto report key also includes cadence from an
        // explicit attack phase; separate its source below for interpretation.
        const finalAutoIds=new Set(finalFrame.attackReasons.filter(attack=>
          ['preset_cadence','keypoint'].includes(attack.reason)).map(attack=>attack.riderId));
        const finalAutoJoined=new Set(finalFrame.joinedBreakawayRiderIds.filter(id=>
          finalAutoIds.has(id)));
        const winner=race.provisionalResults[0];
        if(plannedFinale){
          const plannedId=teams[0].riders[course==='flat'?2:1].id;
          const lateFrames=race.frames.slice(-(managerMixHardChasers===null?5:
            managerMixAttackKmToGo));
          const firstPlanned=lateFrames.find(frame=>frame.attackReasons.some(row=>
            row.riderId===plannedId&&row.reason==='named_order'));
          totals.plannedPhaseAttempt+=Number(Boolean(firstPlanned));
          totals.plannedPhaseFirstKm+=firstPlanned?.km??0;
          totals.plannedPhaseChasers+=firstPlanned?.chasers.length??0;
          totals.plannedPhaseAttackPower+=firstPlanned?.attackPower??0;
          totals.plannedPhaseChasePower+=firstPlanned?.chasePower??0;
          if(firstPlanned&&managerMixHardChasers>0){
            const chaserTeamIds=new Set(teams.filter((_,index)=>{
              const rank=managerMixRank(index,sample);
              return Number.isInteger(rank)&&rank<managerMixHardChasers;
            }).map(team=>team.id));
            const meanChaserEnergy=frame=>{
              const chasers=frame.riderGroups.filter(row=>
                chaserTeamIds.has(row.teamId));
              if(chasers.length!==managerMixHardChasers*8)
                throw new Error('Incomplete long-chaser energy sample.');
              return chasers.reduce((sum,row)=>sum+row.energy,0)/chasers.length;
            };
            totals.longChaserEnergyAtAttack+=meanChaserEnergy(firstPlanned);
            totals.longChaserEnergyAtFinish+=meanChaserEnergy(finalFrame);
            totals.longChaserEnergyObservations++;
          }
          totals.plannedPhaseJoin+=Number(lateFrames.some(frame=>
            frame.joinedBreakawayRiderIds.includes(plannedId)));
          totals.plannedPhaseCaught+=Number(lateFrames.some(frame=>
            frame.caughtBreakawayRiderIds.includes(plannedId)));
          totals.plannedPhaseBreakKm+=lateFrames.filter(frame=>
            frame.breakawayRiderIds.includes(plannedId)).length;
          totals.plannedFinalAvailable+=Number(race.frames.at(-2).riderGroups
            .find(row=>row.id===plannedId)?.group==='peloton');
          totals.plannedFinalAttempt+=Number(finalFrame.attackReasons.some(row=>
            row.riderId===plannedId&&row.reason==='named_order'));
          if(['planned-finale-allied','planned-finale-allied-drive',
            'planned-finale-two-chasers-allied-drive',
            'planned-finale-two-selective-chasers-allied-drive',
            'planned-finale-three-chasers-allied-drive',
            'planned-finale-own-plans-allied-drive']
            .includes(paceMode)||managerMixHardChasers!==null){
            const alliedId=teams[2].riders[course==='flat'?2:1].id;
            totals.alliedPhaseAttempt+=Number(lateFrames.some(frame=>
              frame.attackReasons.some(row=>row.riderId===alliedId&&
                row.reason==='named_order')));
            totals.alliedPhaseJoin+=Number(lateFrames.some(frame=>
              frame.joinedBreakawayRiderIds.includes(alliedId)));
            totals.alliedPhaseCaught+=Number(lateFrames.some(frame=>
              frame.caughtBreakawayRiderIds.includes(alliedId)));
            totals.alliedPhaseBreakKm+=lateFrames.filter(frame=>
              frame.breakawayRiderIds.includes(alliedId)).length;
            totals.alliedFinalAttempt+=Number(finalFrame.attackReasons.some(row=>
              row.riderId===alliedId&&row.reason==='named_order'));
            totals.alliedFinalJoin+=Number(finalFrame.joinedBreakawayRiderIds
              .includes(alliedId));
            totals.alliedFinalSurvive+=Number(finalFrame.breakawayRiderIds
              .includes(alliedId));
            totals.alliedFinalCaughtAtLine+=Number(finalFrame.finishLineCatch&&
              finalFrame.caughtBreakawayRiderIds.includes(alliedId));
            totals.alliedFinalWin+=Number(winner.riderId===alliedId);
            totals.eitherAlliedWin+=Number([plannedId,alliedId]
              .includes(winner.riderId));
          }
          totals.plannedFinalJoin+=Number(finalFrame.joinedBreakawayRiderIds
            .includes(plannedId));
          totals.plannedFinalSurvive+=Number(finalFrame.breakawayRiderIds
            .includes(plannedId));
          totals.plannedFinalCaughtAtLine+=Number(finalFrame.finishLineCatch&&
            finalFrame.caughtBreakawayRiderIds.includes(plannedId));
          totals.plannedFinalWin+=Number(winner.riderId===plannedId);
          const plannedResult=race.provisionalResults.find(row=>row.riderId===plannedId);
          totals.plannedFinalPlace+=plannedResult.position;
          totals.plannedFinalEnergy+=plannedResult.energy;
        }
        const breakWinner=winner.group==='breakaway';
        totals.finalAutoAttackRaces+=Number(finalAutoIds.size>0);
        totals.finalAutoJoinedRaces+=Number(finalAutoJoined.size>0);
        totals.finalAutoWinnerRaces+=Number(finalAutoJoined.has(winner.riderId)&&breakWinner);
        if(finalAutoJoined.has(winner.riderId)&&breakWinner){
          const winnerOrders=race.committedInputs.teams.find(team=>
            team.id===winner.teamId)?.orders;
          if(!winnerOrders)throw new Error('Final winner has no committed orders.');
          const finalAttackPhase=winnerOrders.phases.findLast(phase=>
            phase.atKm<=distanceKm-1&&'attack'in phase);
          if(finalAttackPhase)totals.finalPhaseCadenceWinnerRaces++;
          else totals.finalBaselineCadenceWinnerRaces++;
        }
        totals.preFinalBreakWinnerRaces+=Number(breakWinner&&
          race.frames.at(-2).breakawayRiderIds.includes(winner.riderId));
        totals.finalKmJoinWinnerRaces+=Number(breakWinner&&
          finalFrame.joinedBreakawayRiderIds.includes(winner.riderId));
        const lateResidualKm=race.frames.slice(-5).filter((_,index)=>
          hasResidualGapAfterSufficientChase(race.frames,race.frames.length-5+index,
            gapAuditOptions)).length;
        // The residual warning is deliberately scoped to continuing groups
        // without a fresh attack. Show how often a candidate late kilometre
        // falls outside that scope instead of interpreting zero as clearance.
        for(let index=race.frames.length-5;index<race.frames.length;index++){
          const frame=race.frames[index],prior=race.frames[index-1];
          const rear=frame.roadGroups.at(-1);
          if(!rear||rear.id!==prior.roadGroups.at(-1)?.id||
            !(frame.chasePower>0)||!(frame.passiveGapDelta>0)||
            !(rear.gapSeconds>0))continue;
          totals.lateResidualAuditCandidateKm++;
          totals.lateResidualAuditAttackExcludedKm+=Number(frame.attackPower>0);
        }
        totals.multiGroupResidualAffectedRaces+=Number(race.frames.some((frame,index)=>
          index>0&&frame.roadGroups.length>1&&
          hasResidualGapAfterSufficientChase(race.frames,index,gapAuditOptions)));
        totals.lateResidualAffectedRaces+=Number(lateResidualKm>0);
        totals.residualAffectedBreakWinRaces+=Number(lateResidualKm>0&&breakWinner);
        const amber=race.provisionalResults.filter(rider=>rider.teamId==='team-0');
        const best=Math.min(...amber.map(rider=>rider.position));
        totals.amberWins+=Number(best===1);
        totals.amberPodiums+=Number(best<=3);
        totals.breakWins+=Number(race.provisionalResults[0].group==='breakaway');
        if(race.provisionalResults[0].group==='breakaway'){
          const winnerGroupId=race.frames.at(-1).roadGroups.find(group=>
            group.riderIds.includes(race.provisionalResults[0].riderId))?.id;
          const firstGroupFrame=race.frames.find(frame=>frame.roadGroups.some(
            group=>group.id===winnerGroupId));
          totals.breakWinnerGroupAgeKm.push(stage.distance_km-firstGroupFrame.km);
          const firstBunch=race.provisionalResults.find(rider=>rider.group==='peloton');
          if(!firstBunch)throw new Error('A breakaway win has no bunch finisher to compare.');
          const margin=firstBunch.timeSeconds-race.provisionalResults[0].timeSeconds;
          totals.breakWinMargins.push(margin);
          if(finalFrame.joinedBreakawayRiderIds.includes(winner.riderId)&&
            finalFrame.attackContributions){
            const ordered=[...finalFrame.attackContributions].sort((a,b)=>
              b.pressure-a.pressure||a.riderId.localeCompare(b.riderId));
            const rank=ordered.findIndex(row=>row.riderId===winner.riderId);
            if(rank<0)throw new Error('A final join winner has no attack contribution.');
            totals.finalKmJoinWinnerAttackShares.push(
              ordered[rank].pressure/finalFrame.attackPower);
            totals.finalKmJoinWinnerAttackRanks.push(rank+1);
          }
          if(finalFrame.joinedBreakawayRiderIds.includes(winner.riderId)&&
            totals.finalKmJoinWinnerExamples.length<3){
            const winnerGroup=finalFrame.roadGroups.find(group=>
              group.riderIds.includes(winner.riderId));
            const winnerOrders=race.committedInputs.teams.find(team=>
              team.id===winner.teamId)?.orders;
            const activeAttackPhase=winnerOrders?.phases.findLast(phase=>
              phase.atKm<=distanceKm-1&&'attack'in phase);
            totals.finalKmJoinWinnerExamples.push({sample,riderId:winner.riderId,
              teamId:winner.teamId,attackReason:finalFrame.attackReasons.find(row=>
                row.riderId===winner.riderId)?.reason??null,
              attackPhaseAtKm:activeAttackPhase?.atKm??null,
              groupAgeKm:stage.distance_km-firstGroupFrame.km,
              groupGapSeconds:winnerGroup?.gapSeconds??null,
              marginToFirstBunchSeconds:+margin.toFixed(2),
              winnerFinaleAbility:winner.finaleAbility,
              firstBunchRiderId:firstBunch.riderId,
              firstBunchFinaleAbility:firstBunch.finaleAbility,
              winnerEnergy:winner.energy,
              finalKmAttackPower:finalFrame.attackPower,
              winnerAttackPressure:finalFrame.attackContributions?.find(row=>
                row.riderId===winner.riderId)?.pressure??null,
              winnerShareOfFinalAttackPower:finalFrame.attackPower>0?
                finalFrame.attackContributions?.find(row=>
                  row.riderId===winner.riderId)?.pressure/finalFrame.attackPower??null:null,
              finalKmChasePower:finalFrame.chasePower,
              finalKmJoinedRiders:finalFrame.joinedBreakawayRiderIds.length,
              finishLineCatch:finalFrame.finishLineCatch});
          }
          if(margin<1){
            totals.photoFinishBreakWins++;
            totals.photoFinalGaps.push(race.frames.at(-1).gapSeconds);
            totals.photoFinaleAbilityDiffs.push(
              race.provisionalResults[0].finaleAbility-firstBunch.finaleAbility);
            totals.photoBunchDeficits.push(race.frames.at(-1).riderGroups.find(
              rider=>rider.id===firstBunch.riderId).deficitSeconds);
            totals.photoAllTeamsAhead+=Number(race.frames.at(-6).breakawayTeamIds.length===fieldTeams);
            totals.photoLateChaseKm.push(race.frames.slice(-5).filter(frame=>
              frame.engagedChaseTeamIds.length>0).length);
            totals.photoLateResidualKm.push(lateResidualKm);
          }
          totals.clearBreakWins+=Number(margin>=5);
        }
        totals.positiveFinalGaps+=Number(race.frames.at(-1).gapSeconds>0);
        totals.finalGaps.push(race.frames.at(-1).gapSeconds);
        totals.caughtBreaks+=race.frames.filter(frame=>frame.caughtBreakawayRiderIds.length>0).length;
        totals.finishLineCatches+=Number(race.frames.at(-1).finishLineCatch);
        totals.penultimateGapSeconds+=race.frames.at(-2).gapSeconds;
        totals.finalKmAttackPower+=finalFrame.attackPower;
        totals.finalKmAttackers+=finalFrame.attackers.length;
        totals.finalKmBlockedAttacks+=finalFrame.blockedAttacks.length;
        totals.finalKmChasePower+=finalFrame.chasePower;
        totals.finalKmPaidPaceAbility+=finalFrame.paidBunchPace?.ability??0;
        totals.finalKmPaidPaceRaces+=Number(Boolean(finalFrame.paidBunchPace));
        totals.finalKmJoinedRiders+=finalFrame.joinedBreakawayRiderIds.length;
        totals.finalKmCaughtRiders+=finalFrame.caughtBreakawayRiderIds.length;
        totals.partialFinishCatches+=Number(race.frames.at(-1).finishLineCatch&&
          race.frames.at(-1).breakawayRiderIds.length>0);
        if(race.frames.at(-1).finishLineCatch)
          totals.finishLineCaughtRiders+=race.frames.at(-1).caughtBreakawayRiderIds.length;
        totals.droppedRiders+=race.provisionalResults.filter(rider=>rider.group==='dropped').length;
        totals.amberEnergy+=amber.reduce((sum,rider)=>sum+rider.energy,0)/amber.length;
        totals.fieldEnergy+=race.provisionalResults.reduce((sum,rider)=>
          sum+rider.energy,0)/race.provisionalResults.length;
        totals.winnerEnergy+=winner.energy;
        totals.lowEnergyRiders+=race.provisionalResults.filter(rider=>rider.energy<20).length;
        const paidFrames=race.frames.filter(frame=>frame.paidBunchPace);
        totals.paidPaceKm+=paidFrames.length;
        if(paidFrames.length){
          const workerIds=new Set(paidFrames.flatMap(frame=>frame.paidBunchPace.riderIds));
          const finishEnergy=new Map(race.provisionalResults.map(rider=>
            [rider.riderId,rider.energy]));
          totals.paidWorkerEnergy+=[...workerIds].reduce((sum,id)=>
            sum+finishEnergy.get(id),0)/workerIds.size;
          totals.paidWorkerCount+=workerIds.size;
          totals.paidWorkerRaces++;
          const teamKm=new Map();
          for(const frame of paidFrames){
            const id=frame.paidBunchPace.teamId;
            teamKm.set(id,(teamKm.get(id)??0)+1);
          }
          totals.frontConcentration+=Math.max(...teamKm.values())/paidFrames.length;
        }
        totals.maxGroups+=Math.max(...race.frames.map(frame=>frame.roadGroups.length));
        totals.multiGroupFinishes+=Number(race.frames.at(-1).roadGroups.length>1);
        for(const [index,frame] of race.frames.entries()){
          for(const attack of frame.splitAttacks){
            if(attack.status==='joined_group_ahead')totals.bridgesToGroupAhead++;
            if(['split','joined_group_ahead'].includes(attack.status)&&
              race.frames[index-1]?.roadGroups.findIndex(group=>
                group.riderIds.includes(attack.riderId))>0)
              totals.chaseGroupAttackMoves++;
          }
          totals.roadGroupLimitBlocks+=frame.blockedBreakAttacks.filter(event=>
            event.reason==='road_group_limit').length;
        }
      }
      const refusalCounts=orderedFinale.postAttackRefusalClasses;
      const classifiedRefusals=refusalCounts.pendingPelotonAttack+
        refusalCounts.invalidSeparatedSource+refusalCounts.calculatedCatch+
        refusalCounts.groupContact+refusalCounts.other;
      if(orderedFinale.postAttackCandidates!==
        orderedFinale.postAttackAccepted+classifiedRefusals)
        throw new Error('Post-attack audit lost a candidate.');
      if(resultContractAudit==='on'&&(
        resultContracts.validated!==samples||
        resultContracts.riderResults!==samples*fieldTeams*8||
        resultContracts.awards!==samples*20))
        throw new Error('Result contract audit lost riders or awards.');
      if(v91Coverage&&(v91Finale.sourceRaces!==samples||
        v91Finale.namedAttackSources+v91Finale.noNamedAttackOrder!==samples||
        v91Finale.accepted+Object.values(v91Finale.refusalReasons)
          .reduce((sum,count)=>sum+count,0)!==
          v91Finale.namedAttackSources||
        v91Finale.concurrent.completeBunchSources>
          v91Finale.concurrent.sources||
        v91Finale.concurrent.completeBunchAllNamedEligible>
          v91Finale.concurrent.completeBunchSources||
        Object.values(v91Finale.concurrent
          .completeBunchSelectiveChaseOrderCounts).reduce((sum,count)=>
          sum+count,0)!==v91Finale.concurrent.completeBunchSources||
        v91Finale.concurrent.passiveContact>
          v91Finale.concurrent.passiveLaunch||
        v91Finale.concurrent.rotationLaunch>
          v91Finale.concurrent.completeBunchSources||
        v91Finale.concurrent.chaseRotationLaunch>
          v91Finale.concurrent.completeBunchSources||
        v91Finale.concurrent.chaseRotationPaid>
          v91Finale.concurrent.chaseRotationLaunch||
        v91Finale.concurrent.chaseRotationContact>
          v91Finale.concurrent.chaseRotationLaunch||
        v91Finale.concurrent.chaseRotationWithTwoSplit>
          v91Finale.concurrent.chaseRotationLaunch||
        v91Finale.concurrent.relativeArrivals>
          v91Finale.concurrent.chaseRotationWithTwoSplit||
        v91Finale.concurrent.selectiveRotationContact>
          v91Finale.concurrent.selectiveRotationLaunch||
        v91Finale.concurrent.selectiveRotationEngaged>
          v91Finale.concurrent.selectiveRotationLaunch||
        v91Finale.concurrent.selectiveRotationPaid>
          v91Finale.concurrent.selectiveRotationLaunch||
        v91Finale.concurrent.selectiveRotationWithTwoSplit>
          v91Finale.concurrent.selectiveRotationLaunch||
        v91Finale.concurrent.selectiveRelativeArrivals>
          v91Finale.concurrent.selectiveRotationWithTwoSplit||
        v91Finale.concurrent.multiSelectivePaid>
          v91Finale.concurrent.multiSelectiveLaunch||
        v91Finale.concurrent.multiSelectiveWithTwoSplit>
          v91Finale.concurrent.multiSelectiveLaunch||
        v91Finale.concurrent.multiSelectiveRelativeArrivals>
          v91Finale.concurrent.multiSelectiveWithTwoSplit||
        v91Finale.concurrent.allChaseContact>
          v91Finale.concurrent.allChaseLaunch||
        v91Finale.concurrent.chasedFollowup>
          v91Finale.concurrent.allChaseContact||
        v91Finale.concurrent.chasedCatchMerge>
          v91Finale.concurrent.chasedFollowup))
        throw new Error('V91 coverage lost source races or decisions.');
      const sortedGaps=[...totals.finalGaps].sort((a,b)=>a-b);
      const sortedWinMargins=[...totals.breakWinMargins].sort((a,b)=>a-b);
      const sortedJoinWinnerShares=[...totals.finalKmJoinWinnerAttackShares]
        .sort((a,b)=>a-b);
      const sortedPhotoGaps=[...totals.photoFinalGaps].sort((a,b)=>a-b);
      const sortedPhotoFinaleDiffs=[...totals.photoFinaleAbilityDiffs].sort((a,b)=>a-b);
      const sortedPhotoBunchDeficits=[...totals.photoBunchDeficits].sort((a,b)=>a-b);
      const sortedPhotoLateChaseKm=[...totals.photoLateChaseKm].sort((a,b)=>a-b);
      const sortedPhotoLateResidualKm=[...totals.photoLateResidualKm].sort((a,b)=>a-b);
      const sortedBreakGroupAges=[...totals.breakWinnerGroupAgeKm].sort((a,b)=>a-b);
      report.courses[course][gender][strategy]={
        ...(resultContractAudit==='on'?{resultContracts}:{}),
        ...(v91Coverage?{v91Finale}:{}),
        ...(orderedFinaleCoverage==='ordered'?{orderedFinale}:{}),
        amberWinRate:totals.amberWins/samples,
        amberPodiumRate:totals.amberPodiums/samples,
        breakWinRate:totals.breakWins/samples,
        photoFinishBreakWinRate:totals.photoFinishBreakWins/samples,
        photoBreakWinnerLowerFinaleAbilityRate:totals.photoFinishBreakWins?
          totals.photoFinaleAbilityDiffs.filter(value=>value<0).length/
            totals.photoFinishBreakWins:null,
        medianPhotoFinalGapSeconds:sortedPhotoGaps.length?
          sortedPhotoGaps[Math.floor((sortedPhotoGaps.length-1)/2)]:null,
        medianPhotoFinaleAbilityDiff:sortedPhotoFinaleDiffs.length?
          sortedPhotoFinaleDiffs[Math.floor((sortedPhotoFinaleDiffs.length-1)/2)]:null,
        medianPhotoBunchDeficitSeconds:sortedPhotoBunchDeficits.length?
          sortedPhotoBunchDeficits[Math.floor((sortedPhotoBunchDeficits.length-1)/2)]:null,
        photoAllTeamsAheadRate:totals.photoFinishBreakWins?
          totals.photoAllTeamsAhead/totals.photoFinishBreakWins:null,
        medianPhotoLateChaseKm:sortedPhotoLateChaseKm.length?
          sortedPhotoLateChaseKm[Math.floor((sortedPhotoLateChaseKm.length-1)/2)]:null,
        medianPhotoLateResidualKm:sortedPhotoLateResidualKm.length?
          sortedPhotoLateResidualKm[Math.floor((sortedPhotoLateResidualKm.length-1)/2)]:null,
        lateResidualAffectedRaceRate:totals.lateResidualAffectedRaces/samples,
        meanLateResidualAuditCandidateKm:totals.lateResidualAuditCandidateKm/samples,
        meanLateResidualAuditAttackExcludedKm:
          totals.lateResidualAuditAttackExcludedKm/samples,
        lateResidualAuditAttackExcludedShare:totals.lateResidualAuditCandidateKm?
          totals.lateResidualAuditAttackExcludedKm/
            totals.lateResidualAuditCandidateKm:null,
        multiGroupResidualAffectedRaceRate:totals.multiGroupResidualAffectedRaces/samples,
        residualAffectedBreakWinRaceRate:totals.residualAffectedBreakWinRaces/samples,
        finalAutoAttackRaceRate:totals.finalAutoAttackRaces/samples,
        finalAutoJoinedRaceRate:totals.finalAutoJoinedRaces/samples,
        finalAutoWinnerRaceRate:totals.finalAutoWinnerRaces/samples,
        finalPhaseCadenceWinnerRaceRate:
          totals.finalPhaseCadenceWinnerRaces/samples,
        finalBaselineCadenceWinnerRaceRate:
          totals.finalBaselineCadenceWinnerRaces/samples,
        preFinalBreakWinnerRaceRate:totals.preFinalBreakWinnerRaces/samples,
        finalKmJoinWinnerRaceRate:totals.finalKmJoinWinnerRaces/samples,
        medianFinalKmJoinWinnerAttackShare:sortedJoinWinnerShares.length?
          sortedJoinWinnerShares[Math.floor((sortedJoinWinnerShares.length-1)/2)]:null,
        finalKmJoinWinnerTopPressureRate:totals.finalKmJoinWinnerAttackRanks.length?
          totals.finalKmJoinWinnerAttackRanks.filter(rank=>rank===1).length/
            totals.finalKmJoinWinnerAttackRanks.length:null,
        clearBreakWinRate:totals.clearBreakWins/samples,
        medianBreakWinnerMarginSeconds:sortedWinMargins.length?
          sortedWinMargins[Math.floor((sortedWinMargins.length-1)/2)]:null,
        medianBreakWinnerGroupAgeKm:sortedBreakGroupAges.length?
          sortedBreakGroupAges[Math.floor((sortedBreakGroupAges.length-1)/2)]:null,
        finalGapRate:totals.positiveFinalGaps/samples,
        medianFinalGapSeconds:sortedGaps[Math.floor((samples-1)/2)],
        p90FinalGapSeconds:sortedGaps[Math.ceil(samples*.9)-1],
        meanCatches:+(totals.caughtBreaks/samples).toFixed(2),
        finishLineCatchRate:totals.finishLineCatches/samples,
        partialFinishCatchRate:totals.partialFinishCatches/samples,
        meanFinishLineCaughtRiders:+(totals.finishLineCaughtRiders/samples).toFixed(2),
        meanPenultimateGapSeconds:+(totals.penultimateGapSeconds/samples).toFixed(2),
        meanFinalKmAttackPower:+(totals.finalKmAttackPower/samples).toFixed(2),
        meanFinalKmAttackers:+(totals.finalKmAttackers/samples).toFixed(2),
        meanFinalKmBlockedAttacks:+(totals.finalKmBlockedAttacks/samples).toFixed(2),
        meanFinalKmChasePower:+(totals.finalKmChasePower/samples).toFixed(2),
        finalKmPaidPaceRate:totals.finalKmPaidPaceRaces/samples,
        meanFinalKmPaidPaceAbility:totals.finalKmPaidPaceRaces?
          +(totals.finalKmPaidPaceAbility/totals.finalKmPaidPaceRaces).toFixed(2):null,
        meanFinalKmJoinedRiders:+(totals.finalKmJoinedRiders/samples).toFixed(2),
        meanFinalKmCaughtRiders:+(totals.finalKmCaughtRiders/samples).toFixed(2),
        finalKmJoinWinnerExamples:totals.finalKmJoinWinnerExamples,
        meanDroppedRiders:+(totals.droppedRiders/samples).toFixed(2),
        amberMeanEnergy:+(totals.amberEnergy/samples).toFixed(2),
        meanFieldEnergy:+(totals.fieldEnergy/samples).toFixed(2),
        meanWinnerEnergy:+(totals.winnerEnergy/samples).toFixed(2),
        meanRidersUnder20Energy:+(totals.lowEnergyRiders/samples).toFixed(2),
        plannedFinalAvailableRate:plannedFinale?
          totals.plannedFinalAvailable/samples:null,
        plannedPhaseAttemptRate:plannedFinale?
          totals.plannedPhaseAttempt/samples:null,
        plannedPhaseJoinRate:plannedFinale?
          totals.plannedPhaseJoin/samples:null,
        plannedPhaseCatchRate:plannedFinale?
          totals.plannedPhaseCaught/samples:null,
        meanPlannedPhaseBreakKm:plannedFinale?
          +(totals.plannedPhaseBreakKm/samples).toFixed(2):null,
        meanPlannedPhaseFirstAttackKm:plannedFinale&&totals.plannedPhaseAttempt?
          +(totals.plannedPhaseFirstKm/totals.plannedPhaseAttempt).toFixed(2):null,
        meanPhaseChasersAtFirstAttack:plannedFinale&&totals.plannedPhaseAttempt?
          +(totals.plannedPhaseChasers/totals.plannedPhaseAttempt).toFixed(2):null,
        meanPhaseAttackPower:plannedFinale&&totals.plannedPhaseAttempt?
          +(totals.plannedPhaseAttackPower/totals.plannedPhaseAttempt).toFixed(2):null,
        meanPhaseChasePower:plannedFinale&&totals.plannedPhaseAttempt?
          +(totals.plannedPhaseChasePower/totals.plannedPhaseAttempt).toFixed(2):null,
        meanLongChaserEnergyAtAttack:totals.longChaserEnergyObservations?
          +(totals.longChaserEnergyAtAttack/
            totals.longChaserEnergyObservations).toFixed(2):null,
        meanLongChaserEnergyAtFinish:totals.longChaserEnergyObservations?
          +(totals.longChaserEnergyAtFinish/
            totals.longChaserEnergyObservations).toFixed(2):null,
        plannedFinalAttemptRate:plannedFinale?
          totals.plannedFinalAttempt/samples:null,
        plannedFinalJoinRate:plannedFinale?
          totals.plannedFinalJoin/samples:null,
        plannedFinalSurvivalRate:plannedFinale?
          totals.plannedFinalSurvive/samples:null,
        plannedFinalFinishLineCatchRate:plannedFinale?
          totals.plannedFinalCaughtAtLine/samples:null,
        plannedFinalWinRate:plannedFinale?
          totals.plannedFinalWin/samples:null,
        meanPlannedFinalPlace:plannedFinale?
          +(totals.plannedFinalPlace/samples).toFixed(2):null,
        meanPlannedFinalEnergy:plannedFinale?
          +(totals.plannedFinalEnergy/samples).toFixed(2):null,
        alliedFinalAttemptRate:paceMode.includes('allied')?
          totals.alliedFinalAttempt/samples:null,
        alliedPhaseAttemptRate:paceMode.includes('allied')?
          totals.alliedPhaseAttempt/samples:null,
        alliedPhaseJoinRate:paceMode.includes('allied')?
          totals.alliedPhaseJoin/samples:null,
        alliedPhaseCatchRate:paceMode.includes('allied')?
          totals.alliedPhaseCaught/samples:null,
        meanAlliedPhaseBreakKm:paceMode.includes('allied')?
          +(totals.alliedPhaseBreakKm/samples).toFixed(2):null,
        alliedFinalJoinRate:paceMode.includes('allied')?
          totals.alliedFinalJoin/samples:null,
        alliedFinalSurvivalRate:paceMode.includes('allied')?
          totals.alliedFinalSurvive/samples:null,
        alliedFinalFinishLineCatchRate:paceMode.includes('allied')?
          totals.alliedFinalCaughtAtLine/samples:null,
        alliedFinalWinRate:paceMode.includes('allied')?
          totals.alliedFinalWin/samples:null,
        eitherAlliedWinRate:paceMode.includes('allied')?
          totals.eitherAlliedWin/samples:null,
        meanPaidPaceKm:+(totals.paidPaceKm/samples).toFixed(2),
        meanPaidWorkerFinalEnergy:totals.paidWorkerRaces?
          +(totals.paidWorkerEnergy/totals.paidWorkerRaces).toFixed(2):null,
        meanDistinctPaidWorkers:totals.paidWorkerRaces?
          +(totals.paidWorkerCount/totals.paidWorkerRaces).toFixed(2):null,
        meanLargestFrontTeamShare:totals.paidWorkerRaces?
          +(totals.frontConcentration/totals.paidWorkerRaces).toFixed(3):null,
        meanMaxRoadGroups:+(totals.maxGroups/samples).toFixed(2),
        multiGroupFinishRate:totals.multiGroupFinishes/samples,
        meanChaseGroupAttackMoves:+(totals.chaseGroupAttackMoves/samples).toFixed(2),
        meanBridgesToGroupAhead:+(totals.bridgesToGroupAhead/samples).toFixed(2),
        meanRoadGroupLimitBlocks:+(totals.roadGroupLimitBlocks/samples).toFixed(2),
      };
    }
  }
}
console.log(JSON.stringify(report,null,2));
