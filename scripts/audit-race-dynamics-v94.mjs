// Read-only diagnostic for the opt-in candidate. --validate checks recording
// consistency; provisional crossings are never treated as official results.
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {MOTOR_RACE_DYNAMICS_VERSION} from '../lib/engine/v2/tuning.mjs';
import {observedFrontClosingSecondsPerKm} from '../lib/engine/v2/race-context-v1.mjs';
import {resolveRandomRivalTactics} from '../lib/engine/v2/playtest-rival-random.mjs';
import {prepareV94RivalIntent} from '../lib/engine/v2/playtest-rival-intent-v94.mjs';

const seeds=process.argv.includes('--extended-seeds')?
  Array.from({length:12},(_,index)=>`race-dynamics-holdout-${index+1}`):
  ['sample-flat-finish','race-dynamics-1','race-dynamics-2'];
function seededRandom(label){
  let state=2166136261;
  for(const character of label)
    state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
}
function run({seed,terrain,fatigue,format,breakTeams,controlTeams}){
  const teamCount=20;
  const mixedDefaults=process.argv.includes('--mixed-defaults');
  const guidedRandom=process.argv.includes('--guided-random');
  const plannedIntent=process.argv.includes('--planned-intent');
  const managerTactics=guidedRandom?resolveRandomRivalTactics({teamCount,
    random:seededRandom(`${seed}:${terrain}:${fatigue}`)}):
    mixedDefaults||plannedIntent?[]:
    Array.from({length:teamCount-1},(_,index)=>{
    const number=index+1;
    return number<=breakTeams?
      {effort:'steady',attack:'repeated',chase:'ignore'}:
      number<=breakTeams+controlTeams?
        {effort:'steady',attack:'none',chase:'selective'}:
        {effort:'steady',attack:'none',chase:'selective'};
  });
  const prepared=prepareV91Playtest({distanceKm:260,terrain,teamCount,
    fatigue,attack:'none',chase:'ignore',seed,managerTactics});
  const planned=plannedIntent?prepareV94RivalIntent({prepared,format,
    ...(format==='stage'?{stageNumber:8}:{})}):null;
  const teams=planned?.teams??prepared.teams;
  const teamRoles=planned?.raceContext.teamRoles??Object.fromEntries(teams.map((team,index)=>[
    team.id,mixedDefaults||guidedRandom?
      team.orders.baseline.chase==='all'?'control':
        team.orders.baseline.attack!=='none'&&
        team.orders.baseline.chase==='ignore'?'break':
          team.orders.baseline.chase==='selective'?'protect':'opportunistic':
      index===0?'protect':index<=breakTeams?'break':
        index<=breakTeams+controlTeams?'control':'protect']));
  const intendedBreakTeams=mixedDefaults||guidedRandom||plannedIntent?
    Object.values(teamRoles).filter(role=>role==='break').length:breakTeams;
  const intendedControlTeams=mixedDefaults||guidedRandom||plannedIntent?
    Object.values(teamRoles).filter(role=>role==='control').length:controlTeams;
  const recording=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:planned?.raceContext??
      {format,...(format==='stage'?{stageNumber:8}:{}),teamRoles}});
  if(process.argv.includes('--validate'))validateRecordedTour(recording);
  const frames=recording.frames;
  const gaps=frames.map(frame=>frame.gapSeconds);
  const withFront=frames.filter(frame=>frame.breakawayRiderIds?.length>0);
  const frontUnmet=frames.flatMap(frame=>frame.energyLedger.filter(row=>
    frame.breakawayRiderIds.includes(row.riderId)&&row.unmetEnergyDemand>0)
    .map(row=>({km:frame.km,riderId:row.riderId,
      unmetEnergyDemand:row.unmetEnergyDemand})));
  const finale=frames.filter(frame=>frame.km>210);
  const measuredFinaleClosing=finale.map(frame=>{
    const prior=frames.slice(0,frame.km-1);
    const frontGroup=prior.at(-1)?.roadGroups[0];
    return frontGroup?observedFrontClosingSecondsPerKm({frames:prior,frontGroup}):null;
  }).filter(value=>value!==null);
  const atFinaleStart=frames[209];
  const finalFrame=frames.at(-1);
  const frontIds=new Set(finalFrame.breakawayRiderIds);
  const initialFront=frames.find(frame=>
    frame.breakawayRiderIds.length>=intendedBreakTeams);
  const initialFrontIds=initialFront?.breakawayRiderIds??[];
  const caughtIds=new Set(frames.flatMap(frame=>frame.caughtBreakawayRiderIds));
  const average=(rows,field)=>+(rows.reduce((sum,row)=>sum+row[field],0)/rows.length)
    .toFixed(2);
  const roleEnergyAtFinaleStart=role=>{
    const rows=atFinaleStart.teamEnergy.filter(row=>teamRoles[row.teamId]===role);
    return rows.length?average(rows,'mean'):null;
  };
  const roleHelperEnergyAtFinaleStart=role=>{
    const ids=new Set(recording.committedInputs.teams.filter(team=>
      teamRoles[team.id]===role).flatMap(team=>team.orders.helperIds));
    const rows=atFinaleStart.riderGroups.filter(row=>ids.has(row.id));
    return rows.length?average(rows,'energy'):null;
  };
  return {seed,terrain,fatigue,format,breakTeams:intendedBreakTeams,
    controlTeams:intendedControlTeams,
    attacks:frames.reduce((sum,frame)=>sum+frame.attackers.length,0),
    maxFrontRiders:Math.max(...frames.map(frame=>frame.breakawayRiderIds?.length??0)),
    maxGapSeconds:Math.max(...gaps),
    kilometresOverOneMinute:gaps.filter(gap=>gap>=60).length,
    kilometresOverFiveMinutes:gaps.filter(gap=>gap>=300).length,
    firstFiveMinuteKm:frames.find(frame=>frame.gapSeconds>=300)?.km??null,
    firstChaseKm:frames.find(frame=>frame.chasers.length>0)?.km??null,
    firstProtectPursuitKm:frames.find(frame=>frame.chaseReasons.some(row=>
      row.reason==='one_day_captain_pursuit'))?.km??null,
    gapAt205Seconds:frames[204].gapSeconds,
    gapAt210Seconds:frames[209].gapSeconds,
    gapAt220Seconds:frames[219].gapSeconds,
    chasedTeamKilometres:frames.reduce((sum,frame)=>sum+frame.chasers.length,0),
    settledFrontRestRiderKilometres:frames.reduce((sum,frame)=>
      sum+frame.settledFrontRestRiderIds.length,0),
    firstSettledFrontKm:frames.find(frame=>
      frame.settledFrontRestRiderIds.length>0)?.km??null,
    finaleMeanChasePower:average(finale,'chasePower'),
    finaleMeanPassiveGapDelta:average(finale,'passiveGapDelta'),
    finaleMeasuredClosingKilometres:measuredFinaleClosing.length,
    controlEnergyAtFinaleStart:roleEnergyAtFinaleStart('control'),
    protectEnergyAtFinaleStart:roleEnergyAtFinaleStart('protect'),
    breakEnergyAtFinaleStart:roleEnergyAtFinaleStart('break'),
    controlHelperEnergyAtFinaleStart:roleHelperEnergyAtFinaleStart('control'),
    protectHelperEnergyAtFinaleStart:roleHelperEnergyAtFinaleStart('protect'),
    earlyControlChasedTeamKilometres:frames.filter(frame=>frame.km<=210)
      .reduce((sum,frame)=>sum+frame.chasers.filter(id=>
        teamRoles[id]==='control').length,0),
    finaleProtectChasedTeamKilometres:finale.reduce((sum,frame)=>
      sum+frame.chasers.filter(id=>teamRoles[id]==='protect').length,0),
    earlyProtectChasedTeamKilometres:frames.filter(frame=>frame.km<=210)
      .reduce((sum,frame)=>sum+frame.chasers.filter(id=>
        teamRoles[id]==='protect').length,0),
    easedTeamKilometres:frames.reduce((sum,frame)=>sum+frame.bunchEaseTeamIds.length,0),
    finalGapSeconds:gaps.at(-1),
    finalFrontRiders:finalFrame.breakawayRiderIds.length,
    finalFrontMeanEnergy:frontIds.size?average(finalFrame.riderGroups.filter(row=>
      frontIds.has(row.id)),'energy'):null,
    finalBunchMeanEnergy:average(finalFrame.riderGroups.filter(row=>
      row.group==='peloton'),'energy'),
    frontUnmetRiderKilometres:frontUnmet.length,
    firstFrontUnmetKm:frontUnmet[0]?.km??null,
    totalFrontUnmetEnergy:+frontUnmet.reduce((sum,row)=>
      sum+row.unmetEnergyDemand,0).toFixed(2),
    caughtRiders:frames.reduce((sum,frame)=>
      sum+frame.caughtBreakawayRiderIds.length,0),
    initialFrontFormedKm:initialFront?.km??null,
    initialFrontRiders:initialFrontIds.length,
    initialFrontCaughtRiders:initialFrontIds.filter(id=>caughtIds.has(id)).length,
    initialFrontAtLineRiders:initialFrontIds.filter(id=>frontIds.has(id)).length,
    frontPresentKm:withFront.length};
}

const rows=[];
const roleMixes=process.argv.includes('--mixed-defaults')||
  process.argv.includes('--guided-random')||
  process.argv.includes('--planned-intent')?[[0,0]]:
  process.argv.includes('--stress')?
  [[5,0],[5,1],[5,8]]:[[3,2],[5,2],[5,4],[5,6]];
for(const terrain of ['flat','mountain'])for(const fatigue of [0,30])
  for(const format of ['one_day','stage'])for(const seed of seeds)
    for(const [breakTeams,controlTeams] of roleMixes){
      if(process.argv.includes('--focus-six-control')&&
        !(format==='one_day'&&breakTeams===5&&controlTeams===6))continue;
      if(process.argv.includes('--focus-five-break')&&
        !(format==='one_day'&&breakTeams===5))continue;
      const input={seed,terrain,fatigue,format,breakTeams,controlTeams};
      try{rows.push(run(input));}
      catch(error){
        if(!String(error.message).startsWith('Unresolved front exhaustion'))
          throw new Error(`Audit case ${JSON.stringify(input)}: ${error.message}`,
            {cause:error});
        rows.push({...input,refusal:String(error.message)});
      }
    }
const summary=process.argv.includes('--summary')?
  ['one_day','stage'].flatMap(format=>(process.argv.includes('--stress')?
    roleMixes.map(([,controlTeams])=>({controlTeams})):
    [0,30].map(fatigue=>({fatigue}))).map(group=>{
    const sample=rows.filter(row=>row.format===format&&
      Object.entries(group).every(([key,value])=>row[key]===value));
    if(sample.length===0)return null;
    const completed=sample.filter(row=>!row.refusal);
    const average=field=>completed.length?
      +(completed.reduce((sum,row)=>sum+row[field],0)/completed.length)
      .toFixed(2)
      :null;
    return {format,...group,cases:sample.length,
      meanBreakTeams:average('breakTeams'),
      meanControlTeams:average('controlTeams'),
      allInitialFrontCaught:completed.filter(row=>row.initialFrontRiders>0&&
        row.initialFrontAtLineRiders===0).length,
      meanMaxGapSeconds:average('maxGapSeconds'),
      meanSettledRestRiderKm:average('settledFrontRestRiderKilometres'),
      meanEarlyProtectChaseTeamKm:average('earlyProtectChasedTeamKilometres'),
      refusals:sample.filter(row=>row.refusal).length};
  })).filter(Boolean):null;
console.log(JSON.stringify({version:MOTOR_RACE_DYNAMICS_VERSION,
  note:'Internal opt-in role scenarios, not observed race calibration or official results.',
  ...(summary?{summary}:{rows})},null,2));
