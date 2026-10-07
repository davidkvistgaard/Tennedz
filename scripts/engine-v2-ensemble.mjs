// Reproducible, offline balance matrix with fictional riders and routes.
// Every strategy in a paired comparison uses the same roster, route and seed.
import seedrandom from 'seedrandom';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {SPORTING_SKILLS} from '../lib/engine/v2/physiology.mjs';
import {hasResidualGapAfterSufficientChase} from '../lib/engine/v2/balance-audit.mjs';
import {TUNING,TUNING_VERSION,MOTOR_CANDIDATE_VERSION,MOTOR_PAID_PACE_VERSION,
  MOTOR_FINALE_VERSION,MOTOR_BRIDGE_FINALE_VERSION,MOTOR_EARNED_BRIDGE_VERSION,
  MOTOR_NEUTRAL_PACE_VERSION,MOTOR_EXPLICIT_FRONT_VERSION,
  MOTOR_DRAFT_SHELTER_VERSION,MOTOR_DISTANCE_LOAD_VERSION,
  MOTOR_RECOVERY_CEILING_VERSION,MOTOR_PHASE_ATTACK_VERSION,
  MOTOR_CANDIDATE} from
  '../lib/engine/v2/tuning.mjs';

const samples=process.argv[2]===undefined?10:Number(process.argv[2]);
const fieldTeams=process.argv[3]===undefined?4:Number(process.argv[3]);
const motorMode=process.argv[4]??'current';
const paceMode=process.argv[5]??'preset';
const plannedFinale=['planned-finale','planned-finale-open',
  'planned-finale-one-chaser','planned-finale-three-chasers',
  'planned-finale-selective-chaser','planned-finale-allied',
  'planned-finale-surge','planned-finale-allied-drive',
  'planned-finale-two-chasers-allied-drive',
  'planned-finale-three-chasers-allied-drive',
  'planned-finale-own-plans-allied-drive'].includes(paceMode);
const plannedChasers=['planned-finale-one-chaser','planned-finale-selective-chaser',
  'planned-finale-allied','planned-finale-surge','planned-finale-allied-drive']
  .includes(paceMode)?1:
  paceMode==='planned-finale-two-chasers-allied-drive'?2:
  ['planned-finale-three-chasers',
    'planned-finale-three-chasers-allied-drive'].includes(paceMode)?3:0;
const distanceKm=process.argv[6]===undefined?120:Number(process.argv[6]);
const chaserSkillCap=process.argv[7]===undefined?100:Number(process.argv[7]);
const motorVersion=motorMode==='phase-attack'?MOTOR_PHASE_ATTACK_VERSION:
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
  ![120,260].includes(distanceKm)||
  !Number.isInteger(chaserSkillCap)||chaserSkillCap<20||chaserSkillCap>100||
  process.argv[7]!==undefined&&plannedChasers===0||
  !['current','candidate','paid-pace','bounded-finale','bounded-bridge-finale',
    'earned-bridge-finale','neutral-pace','explicit-front','draft-shelter',
    'distance-load','recovery-ceiling','phase-attack']
    .includes(motorMode)||
  !['preset','paced-rival','steady-rival','rotate-rival','late-hard-rival',
    'rotate-plans','planned-finale','planned-finale-open',
    'planned-finale-one-chaser','planned-finale-three-chasers',
    'planned-finale-selective-chaser','planned-finale-allied',
    'planned-finale-surge','planned-finale-allied-drive',
    'planned-finale-two-chasers-allied-drive',
    'planned-finale-three-chasers-allied-drive',
    'planned-finale-own-plans-allied-drive'].includes(paceMode)||
  ['steady-rival','rotate-rival','late-hard-rival','rotate-plans','planned-finale',
    'planned-finale-open','planned-finale-one-chaser',
    'planned-finale-three-chasers','planned-finale-selective-chaser',
    'planned-finale-allied','planned-finale-surge',
    'planned-finale-allied-drive','planned-finale-three-chasers-allied-drive',
    'planned-finale-two-chasers-allied-drive',
    'planned-finale-own-plans-allied-drive']
    .includes(paceMode)&&
    !['explicit-front','draft-shelter','distance-load',
      'recovery-ceiling','phase-attack'].includes(motorMode))
  throw new Error('Usage: node scripts/engine-v2-ensemble.mjs [paired samples: 1-100] [teams: 2-20] [current|candidate|paid-pace|bounded-finale|bounded-bridge-finale|earned-bridge-finale|neutral-pace|explicit-front|draft-shelter|distance-load|recovery-ceiling|phase-attack] [preset|paced-rival|steady-rival|rotate-rival|late-hard-rival|rotate-plans|planned-finale|planned-finale-open|planned-finale-one-chaser|planned-finale-three-chasers|planned-finale-selective-chaser|planned-finale-allied|planned-finale-surge|planned-finale-allied-drive|planned-finale-two-chasers-allied-drive|planned-finale-three-chasers-allied-drive|planned-finale-own-plans-allied-drive (v86+ only)] [120|260 km] [first chaser skill cap: 20-100]');

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

function fictionalTeams(sample,gender){
  return Array.from({length:fieldTeams},(_,teamIndex)=>{
    const id=`team-${teamIndex}`;
    const riders=Array.from({length:8},(_,riderIndex)=>{
      const rng=seedrandom(`v2-ensemble-rider:${sample}:${teamIndex}:${riderIndex}`);
      const role=ROLE_BONUSES[riderIndex%ROLE_BONUSES.length];
      const skills=Object.fromEntries(SPORTING_SKILLS.map(skill=>
        [skill,Math.min(teamIndex===1&&plannedChasers>0?chaserSkillCap:100,
          clamp(Math.round(50+(role[skill]??0)+(rng()-.5)*26)))]));
      return {id:`${id}-${riderIndex}`,gender,...skills,
        leadership:clamp(Math.round(35+rng()*50)),form:Math.round(40+rng()*45),
        fatigue:Math.round(rng()*25)};
    });
    return {id,riders};
  });
}

function plannedOpponentOrders(index,team,course){
  if(['planned-finale-allied','planned-finale-allied-drive',
    'planned-finale-own-plans-allied-drive',
    'planned-finale-two-chasers-allied-drive',
    'planned-finale-three-chasers-allied-drive']
    .includes(paceMode)&&index===2)return {
    baseline:{effort:'conserve',attack:'none',chase:'ignore',frontWork:'sit_in'},
    phases:[{atKm:distanceKm-5,attack:'selective',
      ...(paceMode.includes('allied-drive')?{
        effort:'hard',breakWork:'drive'}:{}),
      attackRiderId:team.riders[course==='flat'?2:1].id}]};
  if(['planned-finale','planned-finale-own-plans-allied-drive']
    .includes(paceMode))return {baseline:{frontWork:index%2===0?
      'rotate':'sit_in'}};
  const chaser=index<=plannedChasers+
    Number(['planned-finale-two-chasers-allied-drive',
      'planned-finale-three-chasers-allied-drive'].includes(paceMode));
  return {baseline:{effort:'conserve',attack:'none',chase:'ignore',
    frontWork:chaser?'sit_in':index%2===0?'rotate':'sit_in'},
  ...(chaser?{phases:[{atKm:distanceKm-10,
    effort:paceMode==='planned-finale-selective-chaser'?'steady':'hard',
    chase:paceMode==='planned-finale-selective-chaser'?'selective':'all'}]}:{})};
}

const report={pairedSamples:samples,fieldTeams,motorMode,paceMode,distanceKm,
  chaserSkillCap:plannedChasers>0?chaserSkillCap:null,
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
        multiGroupResidualAffectedRaces:0,
        finalAutoAttackRaces:0,
        finalAutoJoinedRaces:0,finalAutoWinnerRaces:0,
        preFinalBreakWinnerRaces:0,finalKmJoinWinnerRaces:0,
        breakWinnerGroupAgeKm:[],
        caughtBreaks:0,finishLineCatches:0,partialFinishCatches:0,
        finishLineCaughtRiders:0,droppedRiders:0,amberEnergy:0,
        fieldEnergy:0,winnerEnergy:0,lowEnergyRiders:0,paidPaceKm:0,
        plannedPhaseAttempt:0,plannedPhaseJoin:0,plannedPhaseFirstKm:0,
        plannedPhaseChasers:0,plannedPhaseAttackPower:0,plannedPhaseChasePower:0,
        plannedPhaseCaught:0,plannedPhaseBreakKm:0,
        plannedFinalAvailable:0,plannedFinalAttempt:0,plannedFinalJoin:0,
        plannedFinalSurvive:0,plannedFinalCaughtAtLine:0,
        plannedFinalWin:0,plannedFinalPlace:0,plannedFinalEnergy:0,
        alliedPhaseAttempt:0,alliedPhaseJoin:0,alliedPhaseCaught:0,
        alliedPhaseBreakKm:0,
        alliedFinalAttempt:0,alliedFinalJoin:0,alliedFinalSurvive:0,
        alliedFinalCaughtAtLine:0,alliedFinalWin:0,eitherAlliedWin:0,
        paidWorkerEnergy:0,paidWorkerRaces:0,paidWorkerCount:0,frontConcentration:0,
        finalGaps:[],
        maxGroups:0,multiGroupFinishes:0,chaseGroupAttackMoves:0,
        bridgesToGroupAhead:0,roadGroupLimitBlocks:0};
      for(let sample=0;sample<samples;sample++){
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
                  'recovery-ceiling','phase-attack'].includes(motorMode)?
                  {frontWork:'rotate'}:{})},
              ...(paceMode==='late-hard-rival'?{
                phases:[{atKm:distanceKm-40,effort:'hard'}]}:{})}:{}),
            ...(paceMode==='rotate-plans'?{baseline:{frontWork:index%2===0?
              'rotate':'sit_in'}}:{}),
            ...(plannedFinale?index===0?{
              baseline:{attack:'none',chase:'ignore',frontWork:'sit_in'},
              phases:[{atKm:distanceKm-5,attack:'selective',
                ...(['planned-finale-surge','planned-finale-allied-drive',
                  'planned-finale-two-chasers-allied-drive',
                  'planned-finale-three-chasers-allied-drive',
                  'planned-finale-own-plans-allied-drive']
                  .includes(paceMode)?{effort:'hard',breakWork:'drive'}:{}),
                attackRiderId:team.riders[course==='flat'?2:1].id}],
            }:plannedOpponentOrders(index,team,course):{})},
        }));
        const rng=seedrandom(`v2-ensemble-weather:${course}:${sample}`);
        const base=WEATHER[course];
        const weather={temp_c:base.temp_c+(rng()-.5)*8,
          wind_kph:Math.max(0,base.wind_kph+(rng()-.5)*16),
          precipitation_mm:Math.max(0,base.precipitation_mm+(rng()-.5)*2)};
        const race=simulateTacticalTour({stage,teams,weather,seed:`v2-ensemble:${course}:${sample}`,motorVersion});
        validateRecordedTour(race);
        report.tuningVersion??=race.tuningVersion;
        const finalFrame=race.frames.at(-1);
        const finalAutoIds=new Set(finalFrame.attackReasons.filter(attack=>
          ['preset_cadence','keypoint'].includes(attack.reason)).map(attack=>attack.riderId));
        const finalAutoJoined=new Set(finalFrame.joinedBreakawayRiderIds.filter(id=>
          finalAutoIds.has(id)));
        const winner=race.provisionalResults[0];
        if(plannedFinale){
          const plannedId=teams[0].riders[course==='flat'?2:1].id;
          const lateFrames=race.frames.slice(-5);
          const firstPlanned=lateFrames.find(frame=>frame.attackReasons.some(row=>
            row.riderId===plannedId&&row.reason==='named_order'));
          totals.plannedPhaseAttempt+=Number(Boolean(firstPlanned));
          totals.plannedPhaseFirstKm+=firstPlanned?.km??0;
          totals.plannedPhaseChasers+=firstPlanned?.chasers.length??0;
          totals.plannedPhaseAttackPower+=firstPlanned?.attackPower??0;
          totals.plannedPhaseChasePower+=firstPlanned?.chasePower??0;
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
            'planned-finale-three-chasers-allied-drive',
            'planned-finale-own-plans-allied-drive']
            .includes(paceMode)){
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
        totals.preFinalBreakWinnerRaces+=Number(breakWinner&&
          race.frames.at(-2).breakawayRiderIds.includes(winner.riderId));
        totals.finalKmJoinWinnerRaces+=Number(breakWinner&&
          finalFrame.joinedBreakawayRiderIds.includes(winner.riderId));
        const lateResidualKm=race.frames.slice(-5).filter((_,index)=>
          hasResidualGapAfterSufficientChase(race.frames,race.frames.length-5+index,
            gapAuditOptions)).length;
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
        multiGroupResidualAffectedRaceRate:totals.multiGroupResidualAffectedRaces/samples,
        residualAffectedBreakWinRaceRate:totals.residualAffectedBreakWinRaces/samples,
        finalAutoAttackRaceRate:totals.finalAutoAttackRaces/samples,
        finalAutoJoinedRaceRate:totals.finalAutoJoinedRaces/samples,
        finalAutoWinnerRaceRate:totals.finalAutoWinnerRaces/samples,
        preFinalBreakWinnerRaceRate:totals.preFinalBreakWinnerRaces/samples,
        finalKmJoinWinnerRaceRate:totals.finalKmJoinWinnerRaces/samples,
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
