// Reproducible, offline balance matrix with fictional riders and routes.
// Every strategy in a paired comparison uses the same roster, route and seed.
import seedrandom from 'seedrandom';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {validateRoadGroupTransition} from '../lib/engine/v2/road-groups.mjs';
import {SPORTING_SKILLS} from '../lib/engine/v2/physiology.mjs';
import {hasResidualGapAfterSufficientChase} from '../lib/engine/v2/balance-audit.mjs';
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
  throw new Error('Usage: node scripts/engine-v2-ensemble.mjs [paired samples: 1-100] [teams: 2-20] [current|candidate|paid-pace|bounded-finale|bounded-bridge-finale|earned-bridge-finale|neutral-pace|explicit-front|draft-shelter|distance-load|recovery-ceiling|phase-attack|attack-trace] [preset|paced-rival|steady-rival|rotate-rival|late-hard-rival|rotate-plans|planned-finale|planned-finale-open|planned-finale-one-chaser|planned-finale-three-chasers|planned-finale-selective-chaser|planned-finale-allied|planned-finale-surge|planned-finale-allied-drive|planned-finale-two-chasers-allied-drive|planned-finale-three-chasers-allied-drive|planned-finale-own-plans-allied-drive|planned-finale-allied-manager-mix-[0-3] (v86+ only)] [120|260 km] [chaser skill cap: 20-100] [manager-mix initial fatigue shift: 0-30] [manager-mix selective chasers: 0-3] [manager-mix attack km to go: 5|10|20] [manager-mix opportunists: 0-4] [manager-mix chase km to go: 20..<distance] [manager-mix chase effort: steady|hard] [manager-mix hard finish km to go: 0|20|40|60, after steady only] [manager-mix opportunist attack at km: 0|40|80|120] [manager-mix opportunist stop km to go: 0|5|10] [manager-mix opportunist stop teams: 0..opportunists] [manager-mix stop-rank offset: 0..<opportunists] [mirrored|independent gender rosters]');

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
        [skill,Math.min(cappedChaser?chaserSkillCap:100,
          clamp(Math.round(50+(role[skill]??0)+(rng()-.5)*26)))]));
      return {id:`${id}-${riderIndex}`,gender,...skills,
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
    const baseline={effort:'conserve',attack:'none',chase:'ignore',
      frontWork:'sit_in'};
    if(rank<managerMixHardChasers)return {baseline,
      phases:[{atKm:distanceKm-managerMixHardChaseKmToGo,
        effort:managerMixLongChaseEffort,chase:'all'},
      ...(managerMixHardFinishKmToGo>0?[{
        atKm:distanceKm-managerMixHardFinishKmToGo,
        effort:'hard',chase:'all'}]:[])]};
    if(rank<managerMixHardChasers+3)return rank<managerMixHardChasers+
      managerMixSelectiveChasers?{baseline,
        phases:[{atKm:distanceKm-10,effort:'steady',chase:'selective'}]}:
      {baseline};
    if(rank<managerMixHardChasers+7){
      const opportunistRank=rank-managerMixHardChasers-3;
      if(opportunistRank>=managerMixOpportunists)return {baseline};
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
    if(rank<managerMixHardChasers+11)return {baseline:{...baseline,
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
  distanceKm,genderSkillMode,
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
  initialFatigueShift,
  description:'fictional varied riders and routes; no live data',courses:{}};
for(const [course,stage] of Object.entries(distanceKm===260?LONG_ROUTES:ROUTES)){
  report.courses[course]={};
  for(const gender of ['M','F']){
    report.courses[course][gender]={};
    for(const strategy of STRATEGIES){
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
