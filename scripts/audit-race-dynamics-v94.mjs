// Read-only diagnostic for the opt-in candidate. --validate checks recording
// consistency; provisional crossings are never treated as official results.
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {replayRaceDynamicsRecording} from
  '../lib/engine/v2/replay-race-dynamics-v94.mjs';
import {MOTOR_RACE_DYNAMICS_VERSION} from '../lib/engine/v2/tuning.mjs';
import {observedFrontClosingSecondsPerKm} from '../lib/engine/v2/race-context-v1.mjs';
import {resolveRandomRivalTactics} from '../lib/engine/v2/playtest-rival-random.mjs';
import {prepareV94RivalIntent} from '../lib/engine/v2/playtest-rival-intent-v94.mjs';

const batchArg=process.argv.find(value=>value.startsWith('--seed-batch='));
const batchMatch=batchArg?.match(/^--seed-batch=([1-3])$/);
if(batchArg&&(!batchMatch||!process.argv.includes('--extended-seeds')))
  throw new Error('Use --seed-batch=1, 2 or 3 with --extended-seeds.');
const holdoutSeeds=Array.from({length:12},(_,index)=>
  `race-dynamics-holdout-${index+1}`);
const frontRotationVersion=process.argv.includes('--front-rotation-v3')?3:
  process.argv.includes('--front-rotation-v2')?2:1;
const collectiveControl=process.argv.includes('--collective-control');
const committedControlTempo=process.argv.includes('--committed-control-tempo');
const opportunisticSpecialist=process.argv.includes('--opportunistic-specialist');
if(committedControlTempo&&(!process.argv.includes('--planned-intent')||
  process.argv.includes('--all-control-tempo')))
  throw new Error('Committed control tempo requires planned intent only.');
const frontExhaustionVersion=process.argv.includes('--front-exhaustion-v3')?3:
  process.argv.includes('--front-exhaustion-v2')?2:1;
const seeds=process.argv.includes('--extended-seeds')?
  batchMatch?holdoutSeeds.slice((Number(batchMatch[1])-1)*4,
    Number(batchMatch[1])*4):holdoutSeeds:
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
    frontRotationVersion,controlTempoVersion:committedControlTempo?2:1,
    opportunisticSpecialistVersion:opportunisticSpecialist?2:1,
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
  // Read-only counterfactual. The planner does not currently commit this
  // front-work order, so omit its intent manifest rather than misstate source.
  const allControlTempo=process.argv.includes('--all-control-tempo');
  const committedTeams=allControlTempo?teams.map(team=>
    teamRoles[team.id]==='control'&&team.id!=='you'?{...team,
      orders:{...team.orders,baseline:{...team.orders.baseline,
        frontWork:'rotate'}}}:team):teams;
  const baseRaceContext=planned?.raceContext??
    {format,...(format==='stage'?{stageNumber:8}:{}),teamRoles,
      ...(frontRotationVersion===1?{}:{frontRotationVersion})};
  const recording=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:committedTeams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    rivalIntent:allControlTempo?null:planned?.intent??null,
    raceContext:{...baseRaceContext,
      ...(collectiveControl?{controlPursuitVersion:2}:{}),
      ...(process.argv.includes('--control-withdrawal-v2')?
        {controlWithdrawalVersion:2}:{}),
      ...(frontExhaustionVersion>=2?{frontExhaustionVersion}:{}),
      ...(process.argv.includes('--road-group-pace-v2')?
        {roadGroupPaceVersion:2}:{}),
    }});
  if(process.argv.includes('--validate'))validateRecordedTour(recording);
  if(process.argv.includes('--replay'))replayRaceDynamicsRecording(recording);
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
  const teamById=new Map(recording.committedInputs.teams.map(team=>[team.id,team]));
  const captainIds=new Set([...teamById.values()].map(team=>
    team.orders.captainId));
  const captainRoleById=new Map([...teamById.values()].map(team=>
    [team.orders.captainId,teamRoles[team.id]]));
  const frontCaptainCount=frame=>frame.breakawayRiderIds.filter(id=>
    captainIds.has(id)).length;
  const breakAttempts=frames.flatMap(frame=>frame.attackers.map(riderId=>{
    const team=[...teamById.values()].find(row=>row.riders.some(rider=>rider.id===riderId));
    if(!team||teamRoles[team.id]!=='break')return null;
    return {riderId,isCaptain:riderId===team.orders.captainId,
      isHelper:team.orders.helperIds.includes(riderId)};
  }).filter(Boolean));
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
  const opportunisticCaptainIds=new Set([...teamById.values()]
    .filter(team=>teamRoles[team.id]==='opportunistic')
    .map(team=>team.orders.captainId));
  const opportunisticCaptainRows=atFinaleStart.riderGroups.filter(row=>
    opportunisticCaptainIds.has(row.id));
  const controlChase=frames.flatMap(frame=>frame.chaseContributions.filter(row=>
    teamRoles[row.teamId]==='control'));
  const controlChaseByTeam=new Map();
  for(const row of controlChase)controlChaseByTeam.set(row.teamId,
    (controlChaseByTeam.get(row.teamId)??0)+1);
  return {seed,terrain,fatigue,format,breakTeams:intendedBreakTeams,
    controlTeams:intendedControlTeams,
    attacks:frames.reduce((sum,frame)=>sum+frame.attackers.length,0),
    maxFrontRiders:Math.max(...frames.map(frame=>frame.breakawayRiderIds?.length??0)),
    frontCaptainKilometres:frames.reduce((sum,frame)=>
      sum+frontCaptainCount(frame),0),
    frontCaptainKilometresThrough100:frames.filter(frame=>frame.km<=100)
      .reduce((sum,frame)=>sum+frontCaptainCount(frame),0),
    frontOpportunisticCaptainKilometresThrough100:frames
      .filter(frame=>frame.km<=100).reduce((sum,frame)=>sum+
        frame.breakawayRiderIds.filter(id=>
          captainRoleById.get(id)==='opportunistic').length,0),
    initialFrontCaptains:initialFront?frontCaptainCount(initialFront):0,
    firstFrontCaptainKm:frames.find(frame=>frontCaptainCount(frame)>0)?.km??null,
    maxGapSeconds:Math.max(...gaps),
    multiRoadGroupKm:frames.filter(frame=>frame.roadGroups.length>1).length,
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
    disengagedControlTeamKilometres:frames.reduce((sum,frame)=>
      sum+(frame.disengagedControlTeamIds?.length??0),0),
    controlFrontWorkTeamKilometres:frames.filter(frame=>
      teamRoles[frame.paidBunchPace?.teamId]==='control').length,
    firstControlFrontWorkKm:frames.find(frame=>
      teamRoles[frame.paidBunchPace?.teamId]==='control')?.km??null,
    controlFrontWorkBeforeFirstFrontKm:frames.filter(frame=>
      teamRoles[frame.paidBunchPace?.teamId]==='control'&&
      (initialFront?.km===undefined||frame.km<initialFront.km)).length,
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
    controlChaseTeamKilometres:controlChase.length,
    controlChaseRiderKilometres:controlChase.reduce((sum,row)=>
      sum+row.riderIds.length,0),
    controlChaseDistinctRiders:new Set(controlChase.flatMap(row=>
      row.riderIds)).size,
    busiestControlChaseTeamKilometres:Math.max(0,...controlChaseByTeam.values()),
    protectHelperEnergyAtFinaleStart:roleHelperEnergyAtFinaleStart('protect'),
    opportunisticCaptainEnergyAtFinaleStart:
      opportunisticCaptainRows.length?
        average(opportunisticCaptainRows,'energy'):null,
    earlyControlChasedTeamKilometres:frames.filter(frame=>frame.km<=210)
      .reduce((sum,frame)=>sum+frame.chasers.filter(id=>
        teamRoles[id]==='control').length,0),
    controlChaseAgainstHelperOnlyFrontTeamKm:frames.reduce((sum,frame)=>
      sum+(frame.breakawayRiderIds.length>0&&frontCaptainCount(frame)===0?
        frame.chasers.filter(id=>teamRoles[id]==='control').length:0),0),
    controlChaseAgainstHelperOnlyFrontThrough100TeamKm:frames
      .filter(frame=>frame.km<=100).reduce((sum,frame)=>
        sum+(frame.breakawayRiderIds.length>0&&frontCaptainCount(frame)===0?
          frame.chasers.filter(id=>teamRoles[id]==='control').length:0),0),
    controlChaseAgainstCaptainFrontTeamKm:frames.reduce((sum,frame)=>
      sum+(frontCaptainCount(frame)>0?
        frame.chasers.filter(id=>teamRoles[id]==='control').length:0),0),
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
    frontCoastRiderKilometres:frames.reduce((sum,frame)=>
      sum+(frame.frontCoast?.length??0),0),
    firstFrontUnmetKm:frontUnmet[0]?.km??null,
    totalFrontUnmetEnergy:+frontUnmet.reduce((sum,row)=>
      sum+row.unmetEnergyDemand,0).toFixed(2),
    caughtRiders:frames.reduce((sum,frame)=>
      sum+frame.caughtBreakawayRiderIds.length,0),
    initialFrontFormedKm:initialFront?.km??null,
    initialFrontRiders:initialFrontIds.length,
    initialFrontCaughtRiders:initialFrontIds.filter(id=>caughtIds.has(id)).length,
    initialFrontAtLineRiders:initialFrontIds.filter(id=>frontIds.has(id)).length,
    breakRoleAttackAttempts:breakAttempts.length,
    breakRoleCaptainAttempts:breakAttempts.filter(row=>row.isCaptain).length,
    breakRoleHelperAttempts:breakAttempts.filter(row=>row.isHelper).length,
    breakRoleDistinctAttackers:new Set(breakAttempts.map(row=>row.riderId)).size,
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
    const average=field=>{
      const values=completed.map(row=>row[field]).filter(Number.isFinite);
      return values.length?
        +(values.reduce((sum,value)=>sum+value,0)/values.length).toFixed(2):null;
    };
    return {format,...group,cases:sample.length,
      meanBreakTeams:average('breakTeams'),
      meanControlTeams:average('controlTeams'),
      meanBreakRoleAttackAttempts:average('breakRoleAttackAttempts'),
      meanBreakRoleCaptainAttempts:average('breakRoleCaptainAttempts'),
      meanBreakRoleHelperAttempts:average('breakRoleHelperAttempts'),
      meanBreakRoleDistinctAttackers:average('breakRoleDistinctAttackers'),
      meanFrontCaptainKm:average('frontCaptainKilometres'),
      meanFrontCaptainKmThrough100:
        average('frontCaptainKilometresThrough100'),
      meanFrontOpportunisticCaptainKmThrough100:
        average('frontOpportunisticCaptainKilometresThrough100'),
      meanInitialFrontCaptains:average('initialFrontCaptains'),
      meanControlChaseAgainstHelperOnlyFrontTeamKm:
        average('controlChaseAgainstHelperOnlyFrontTeamKm'),
      meanControlChaseAgainstHelperOnlyFrontThrough100TeamKm:
        average('controlChaseAgainstHelperOnlyFrontThrough100TeamKm'),
      meanControlChaseAgainstCaptainFrontTeamKm:
        average('controlChaseAgainstCaptainFrontTeamKm'),
      meanBreakEnergyAtFinaleStart:average('breakEnergyAtFinaleStart'),
      meanOpportunisticCaptainEnergyAtFinaleStart:
        average('opportunisticCaptainEnergyAtFinaleStart'),
      meanControlEnergyAtFinaleStart:average('controlEnergyAtFinaleStart'),
      meanControlHelperEnergyAtFinaleStart:
        average('controlHelperEnergyAtFinaleStart'),
      meanControlChaseTeamKilometres:average('controlChaseTeamKilometres'),
      meanControlChaseRiderKilometres:average('controlChaseRiderKilometres'),
      meanControlChaseDistinctRiders:average('controlChaseDistinctRiders'),
      meanBusiestControlChaseTeamKilometres:
        average('busiestControlChaseTeamKilometres'),
      meanControlFrontWorkTeamKm:average('controlFrontWorkTeamKilometres'),
      meanDisengagedControlTeamKm:
        average('disengagedControlTeamKilometres'),
      meanFirstControlFrontWorkKm:average('firstControlFrontWorkKm'),
      meanControlFrontWorkBeforeFirstFrontKm:
        average('controlFrontWorkBeforeFirstFrontKm'),
      meanEarlyControlChasedTeamKm:average('earlyControlChasedTeamKilometres'),
      meanFrontUnmetRiderKm:average('frontUnmetRiderKilometres'),
      meanFrontCoastRiderKm:average('frontCoastRiderKilometres'),
      allInitialFrontCaught:completed.filter(row=>row.initialFrontRiders>0&&
        row.initialFrontAtLineRiders===0).length,
      meanMaxGapSeconds:average('maxGapSeconds'),
      maxGapSecondsRange:completed.length?[
        Math.min(...completed.map(row=>row.maxGapSeconds)),
        Math.max(...completed.map(row=>row.maxGapSeconds))]:null,
      meanMultiRoadGroupKm:average('multiRoadGroupKm'),
      meanSettledRestRiderKm:average('settledFrontRestRiderKilometres'),
      meanEarlyProtectChaseTeamKm:average('earlyProtectChasedTeamKilometres'),
      refusals:sample.filter(row=>row.refusal).length};
  })).filter(Boolean):null;
console.log(JSON.stringify({version:MOTOR_RACE_DYNAMICS_VERSION,
  frontRotationVersion,controlPursuitVersion:collectiveControl?2:1,
  controlWithdrawalVersion:process.argv.includes('--control-withdrawal-v2')?2:1,
  frontExhaustionVersion,
  roadGroupPaceVersion:process.argv.includes('--road-group-pace-v2')?2:1,
  note:'Internal opt-in role scenarios, not observed race calibration or official results.',
  allControlTempo:process.argv.includes('--all-control-tempo'),
  committedControlTempo,
  opportunisticSpecialist,
  ...(summary?{summary}:{rows})},null,2));
