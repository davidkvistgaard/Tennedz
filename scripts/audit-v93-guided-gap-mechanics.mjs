// Read-only diagnosis of the current guided rival draw on the paid v93 road.
// No gap, team plan, or recorded race is altered by this audit.
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {resolveRandomRivalTactics} from
  '../lib/engine/v2/playtest-rival-random.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from '../lib/engine/v2/tuning.mjs';

function seededRandom(label){
  let state=2166136261;
  for(const character of label)
    state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
}

function audit(seed,terrain,fatigue){
  const managerTactics=resolveRandomRivalTactics({teamCount:20,
    random:seededRandom(`${seed}:${terrain}:${fatigue}`)});
  const prepared=prepareV91Playtest({distanceKm:260,terrain,teamCount:20,
    fatigue,attack:'none',seed,managerTactics});
  const recording=simulateTacticalTour({...prepared,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  validateRecordedTour(recording);
  // This paired limit removes every chase order, including the player's.
  // It is a diagnostic bound, not an opponent plan proposed for the game.
  const noChase=prepareV91Playtest({distanceKm:260,terrain,teamCount:20,
    fatigue,attack:'none',chase:'ignore',seed,
    managerTactics:managerTactics.map(row=>({...row,chase:'ignore'}))});
  const noChaseRecording=simulateTacticalTour({...noChase,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  validateRecordedTour(noChaseRecording);
  const frames=recording.frames;
  const front=frames.filter(frame=>frame.roadGroups.length);
  const captains=new Set(prepared.teams.map(team=>team.orders.captainId));
  const frontCaptainFrames=front.filter(frame=>
    frame.roadGroups.some(group=>group.riderIds.some(id=>captains.has(id))));
  const frontHelperOnlyFrames=front.filter(frame=>
    !frame.roadGroups.some(group=>group.riderIds.some(id=>captains.has(id))));
  const chaseOrderByTeam=new Map(prepared.teams.map(team=>[
    team.id,team.orders.baseline.chase]));
  const paidChaseKmByOrder=Object.fromEntries(['all','selective','ignore'].map(
    chase=>[chase,front.reduce((sum,frame)=>sum+frame.chasers.filter(
      teamId=>chaseOrderByTeam.get(teamId)===chase).length,0)]));
  const paidSelectiveChaseKmByReason=Object.fromEntries(
    ['fresh_attack','gap_over_limit','road_captain_response','gc_defense',
      'gc_counter','fading_teammate','ordered_all'].map(reason=>[reason,
      front.reduce((sum,frame)=>sum+frame.chaseReasons.filter(row=>
        chaseOrderByTeam.get(row.teamId)==='selective'&&
        row.reason===reason).length,0)]));
  if(Object.values(paidChaseKmByOrder).reduce((sum,value)=>sum+value,0)!==
    front.reduce((sum,frame)=>sum+frame.chasers.length,0))
    throw new Error('Unclassified paid chase order in guided audit.');
  if(Object.values(paidSelectiveChaseKmByReason).reduce((sum,value)=>
    sum+value,0)!==paidChaseKmByOrder.selective)
    throw new Error('Unclassified selective chase reason in guided audit.');
  const rows=front.map(frame=>({
    passiveGapDelta:frame.passiveGapDelta,
    chasePower:frame.chasePower,
    chasers:frame.chasers.length,
    pullers:frame.pullRiderIds.length}));
  const mean=values=>values.length?
    +(values.reduce((sum,value)=>sum+value,0)/values.length).toFixed(2):0;
  const frontRuns=[];
  for(const frame of frames){
    if(!frame.roadGroups.length)continue;
    const last=frontRuns.at(-1);
    if(last&&last.toKm===frame.km-1){last.toKm=frame.km;
      last.maxGapSeconds=Math.max(last.maxGapSeconds,frame.gapSeconds);}
    else frontRuns.push({fromKm:frame.km,toKm:frame.km,
      maxGapSeconds:frame.gapSeconds});
  }
  return {seed,terrain,fatigue,
    breakRoleTeams:managerTactics.filter(row=>row.attack!=='none').length,
    allChaseTeams:managerTactics.filter(row=>row.chase==='all').length,
    attackAttempts:frames.reduce((sum,frame)=>sum+frame.attackers.length,0),
    joinedRiders:frames.reduce((sum,frame)=>sum+
      frame.joinedBreakawayRiderIds.length,0),
    frontKm:front.length,frontRuns:frontRuns.length,
    frontCaptainKm:frontCaptainFrames.length,
    chaseTeamKmAgainstHelperOnlyFront:frontHelperOnlyFrames.reduce(
      (sum,frame)=>sum+frame.chasers.length,0),
    shortFrontRuns:frontRuns.filter(row=>row.toKm-row.fromKm<5).length,
    longestFrontKm:Math.max(0,...frontRuns.map(row=>
      row.toKm-row.fromKm+1)),
    maxGapSeconds:Math.max(...frames.map(frame=>frame.gapSeconds)),
    kmOver60:frames.filter(frame=>frame.gapSeconds>=60).length,
    noChaseMaxGapSeconds:Math.max(...noChaseRecording.frames.map(frame=>
      frame.gapSeconds)),
    noChaseKmOver60:noChaseRecording.frames.filter(frame=>
      frame.gapSeconds>=60).length,
    chaseTeamKm:frames.reduce((sum,frame)=>sum+frame.chasers.length,0),
    paidChaseKmByOrder,
    paidSelectiveChaseKmByReason,
    frontPullRiderKm:frames.reduce((sum,frame)=>sum+
      frame.pullRiderIds.length,0),
    meanFrontPassiveDelta:mean(rows.map(row=>row.passiveGapDelta)),
    meanFrontChasePower:mean(rows.map(row=>row.chasePower)),
    meanFrontChasers:mean(rows.map(row=>row.chasers)),
    meanFrontPullers:mean(rows.map(row=>row.pullers)),
    firstFrontRuns:frontRuns.slice(0,3)};
}

const rows=[];
for(const terrain of ['flat','mountain'])for(const fatigue of [0,30])
  for(const seed of ['sample-flat-finish','race-dynamics-1',
    'race-dynamics-2'])rows.push(audit(seed,terrain,fatigue));
console.log(JSON.stringify({version:'v93-guided-gap-mechanics-audit-1',
  note:'Synthetic seeded rival draw on the current paid v93 road. No empirical calibration or official result.',rows},null,2));
