// Reproducible, offline balance matrix with fictional riders and routes.
// Every strategy in a paired comparison uses the same roster, route and seed.
import seedrandom from 'seedrandom';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {SPORTING_SKILLS} from '../lib/engine/v2/physiology.mjs';
import {TUNING} from '../lib/engine/v2/tuning.mjs';

const samples=process.argv[2]===undefined?10:Number(process.argv[2]);
if(!Number.isInteger(samples)||samples<1||samples>100)
  throw new Error('Usage: node scripts/engine-v2-ensemble.mjs [paired samples: 1–100]');

const ROUTES={
  flat:{distance_km:120,profile_points:[[0,60],[40,60],[80,75],[120,60]],
    exposed_segments:[{from_km:30,to_km:70}]},
  rolling:{distance_km:120,profile_points:[[0,90],[20,240],[40,90],[60,300],[80,110],[100,230],[120,90]],
    surface_segments:[{from_km:38,to_km:43,surface:'cobbles'}]},
  mountain:{distance_km:120,profile_points:[[0,400],[30,700],[50,1500],[70,800],[95,1900],[120,450]],
    surface_segments:[{from_km:75,to_km:80,surface:'gravel'}]},
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
  return Array.from({length:4},(_,teamIndex)=>{
    const id=`team-${teamIndex}`;
    const riders=Array.from({length:8},(_,riderIndex)=>{
      const rng=seedrandom(`v2-ensemble-rider:${sample}:${teamIndex}:${riderIndex}`);
      const role=ROLE_BONUSES[riderIndex%ROLE_BONUSES.length];
      const skills=Object.fromEntries(SPORTING_SKILLS.map(skill=>
        [skill,clamp(Math.round(50+(role[skill]??0)+(rng()-.5)*26))]));
      return {id:`${id}-${riderIndex}`,gender,...skills,
        leadership:clamp(Math.round(35+rng()*50)),form:Math.round(40+rng()*45),
        fatigue:Math.round(rng()*25)};
    });
    return {id,riders};
  });
}

const report={pairedSamples:samples,description:'fictional varied riders and routes; no live data',courses:{}};
for(const [course,stage] of Object.entries(ROUTES)){
  report.courses[course]={};
  for(const gender of ['M','F']){
    report.courses[course][gender]={};
    for(const strategy of STRATEGIES){
      const totals={amberWins:0,amberPodiums:0,breakWins:0,positiveFinalGaps:0,
        photoFinishBreakWins:0,clearBreakWins:0,breakWinMargins:[],
        photoFinalGaps:[],photoFinaleAbilityDiffs:[],photoBunchDeficits:[],
        photoAllTeamsAhead:0,photoLateChaseKm:[],photoLateResidualKm:[],
        lateResidualAffectedRaces:0,finalAutoAttackRaces:0,
        finalAutoJoinedRaces:0,finalAutoWinnerRaces:0,
        breakWinnerGroupAgeKm:[],
        caughtBreaks:0,finishLineCatches:0,partialFinishCatches:0,
        finishLineCaughtRiders:0,droppedRiders:0,amberEnergy:0,finalGaps:[],
        maxGroups:0,multiGroupFinishes:0,chaseGroupAttackMoves:0,
        bridgesToGroupAhead:0,roadGroupLimitBlocks:0};
      for(let sample=0;sample<samples;sample++){
        const teams=fictionalTeams(sample,gender).map((team,index)=>({
          ...team,orders:{captainId:team.riders[0].id,roadCaptainId:team.riders[1].id,
            preset:index===0?strategy:STRATEGIES[index-1]},
        }));
        const rng=seedrandom(`v2-ensemble-weather:${course}:${sample}`);
        const base=WEATHER[course];
        const weather={temp_c:base.temp_c+(rng()-.5)*8,
          wind_kph:Math.max(0,base.wind_kph+(rng()-.5)*16),
          precipitation_mm:Math.max(0,base.precipitation_mm+(rng()-.5)*2)};
        const race=simulateTacticalTour({stage,teams,weather,seed:`v2-ensemble:${course}:${sample}`});
        validateRecordedTour(race);
        report.tuningVersion??=race.tuningVersion;
        const finalFrame=race.frames.at(-1);
        const finalAutoIds=new Set(finalFrame.attackReasons.filter(attack=>
          ['preset_cadence','keypoint'].includes(attack.reason)).map(attack=>attack.riderId));
        const finalAutoJoined=new Set(finalFrame.joinedBreakawayRiderIds.filter(id=>
          finalAutoIds.has(id)));
        totals.finalAutoAttackRaces+=Number(finalAutoIds.size>0);
        totals.finalAutoJoinedRaces+=Number(finalAutoJoined.size>0);
        totals.finalAutoWinnerRaces+=Number(finalAutoJoined.has(race.provisionalResults[0].riderId)&&
          race.provisionalResults[0].group==='breakaway');
        const lateResidualKm=race.frames.slice(-5).filter((frame,index)=>{
          const prior=race.frames.at(-6+index).roadGroups.at(-1)?.gapSeconds??0;
          return frame.roadGroups.length===1&&frame.attackPower===0&&
            frame.passiveGapDelta>0&&frame.chasePower>0&&
            frame.chasePower*TUNING.chase.recoverySecondsPerCapacity>=
              prior+frame.passiveGapDelta&&frame.pelotonGapSeconds>0;
        }).length;
        totals.lateResidualAffectedRaces+=Number(lateResidualKm>0);
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
            totals.photoAllTeamsAhead+=Number(race.frames.at(-6).breakawayTeamIds.length===4);
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
        finalAutoAttackRaceRate:totals.finalAutoAttackRaces/samples,
        finalAutoJoinedRaceRate:totals.finalAutoJoinedRaces/samples,
        finalAutoWinnerRaceRate:totals.finalAutoWinnerRaces/samples,
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
