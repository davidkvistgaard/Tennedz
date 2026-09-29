// Validate a completed v2 laboratory recording before storage or playback.
// This module deliberately has no simulator imports: playback reads the
// recorded frames and result instead of recalculating with today's tuning.
const BLOCK_REASONS=new Set(['team_break_limit','no_available_rider','already_ahead',
  'dropped','exhausted','rider_unavailable']);
const DECISION_KINDS=new Set(['backup_leader','chase_break','resume_plan']);
export function validateRecordedTour(recording){
  if(recording?.version!==2||typeof recording.tuningVersion!=='string'||
    !['M','F'].includes(recording.raceCategory)||
    typeof recording.raceSeed!=='string'||!recording.raceSeed.length||recording.raceSeed.length>160||
    recording.route?.version!==2||
    !Number.isInteger(recording.route?.distanceKm)||
    !Number.isFinite(recording.route.lockedWeather?.temperatureC)||
    !Number.isFinite(recording.route.lockedWeather?.windKph)||
    recording.route.lockedWeather.windKph<0||
    !Number.isFinite(recording.route.lockedWeather?.rainMm)||
    recording.route.lockedWeather.rainMm<0||
    !Array.isArray(recording.route.kilometres)||recording.route.kilometres.length!==recording.route.distanceKm||
    !Array.isArray(recording.frames)||recording.frames.length!==recording.route.distanceKm||
    !Array.isArray(recording.provisionalResults)||recording.provisionalResults.length<16||
    recording.provisionalResults.length>160||recording.provisionalResults.length%8!==0)
    throw new Error('Incomplete race recording.');
  const resultIds=recording.provisionalResults.map(result=>result.riderId);
  const roster=new Set(resultIds);
  const teamByRider=new Map(recording.provisionalResults.map(result=>[result.riderId,result.teamId]));
  const teamIds=new Set(recording.provisionalResults.map(result=>result.teamId));
  if(roster.size!==resultIds.length)throw new Error('Duplicate rider in recorded results.');
  const teamCounts=new Map();
  for(const teamId of teamByRider.values())teamCounts.set(teamId,(teamCounts.get(teamId)??0)+1);
  if(teamIds.size<2||teamIds.size>20||[...teamCounts.values()].some(count=>count!==8))
    throw new Error('Invalid recorded team roster.');
  let previousAhead=new Set();
  let previousResponses=new Set();
  for(const [index,frame] of recording.frames.entries()){
    const segment=recording.route.kilometres[index];
    if(frame?.km!==index+1||!Number.isFinite(frame.gapSeconds)||frame.gapSeconds<0||
      !Number.isFinite(frame.attackPower)||frame.attackPower<0||
      !Number.isFinite(frame.chasePower)||frame.chasePower<0||
      !Number.isFinite(frame.passiveGapDelta)||
      !Array.isArray(frame.riderGroups)||frame.riderGroups.length!==roster.size||
      !Array.isArray(frame.breakawayRiderIds)||!Array.isArray(frame.breakawayTeamIds)||
      !Array.isArray(frame.caughtBreakawayRiderIds)||
      !Array.isArray(frame.attackers)||!Array.isArray(frame.joinedBreakawayRiderIds)||
      !Array.isArray(frame.chasers)||
      !Array.isArray(frame.engagedChaseTeamIds)||
      !Array.isArray(frame.activeBreakResponseTeamIds)||
      !Array.isArray(frame.blockedAttacks)||!Array.isArray(frame.decisions)||
      segment?.km!==frame.km||
      segment.terrain!==frame.terrain||segment.surface!==frame.surface||
      segment.exposed!==frame.exposed)throw new Error('Invalid recorded kilometre.');
    const ahead=new Set(frame.breakawayRiderIds),seen=new Set();
    if(ahead.size!==frame.breakawayRiderIds.length||
      [...ahead].some(id=>!roster.has(id))||
      (frame.gapSeconds===0)!==(ahead.size===0))throw new Error('Inconsistent recorded breakaway.');
    const joined=new Set(frame.joinedBreakawayRiderIds);
    const attackSucceeded=frame.gapSeconds>0&&frame.attackPower>frame.chasePower;
    if(joined.size!==frame.joinedBreakawayRiderIds.length||
      [...joined].some(id=>!frame.attackers.includes(id)||previousAhead.has(id))||
      (attackSucceeded?joined.size!==frame.attackers.length:joined.size!==0))
      throw new Error('Invalid recorded breakaway admission.');
    const expectedAhead=frame.gapSeconds>0?new Set([...previousAhead,...joined]):new Set();
    const expectedCaught=frame.gapSeconds===0?previousAhead:new Set();
    if(frame.caughtBreakawayRiderIds.length!==expectedCaught.size||
      new Set(frame.caughtBreakawayRiderIds).size!==expectedCaught.size||
      frame.caughtBreakawayRiderIds.some(id=>!expectedCaught.has(id)))
      throw new Error('Invalid recorded catch event.');
    const expectedTeams=new Set([...ahead].map(id=>teamByRider.get(id)));
    if(ahead.size!==expectedAhead.size||[...ahead].some(id=>!expectedAhead.has(id))||
      frame.breakawayTeamIds.length!==expectedTeams.size||
      new Set(frame.breakawayTeamIds).size!==expectedTeams.size||
      frame.breakawayTeamIds.some(id=>!expectedTeams.has(id)))
      throw new Error('Discontinuous recorded breakaway.');
    previousAhead=ahead;
    if(new Set(frame.attackers).size!==frame.attackers.length||
      frame.attackers.some(id=>!roster.has(id))||
      frame.blockedAttacks.some(item=>!item||!teamIds.has(item.teamId)||!BLOCK_REASONS.has(item.reason)||
        (item.riderId!==null&&!roster.has(item.riderId))||
        (item.riderId!==null&&teamByRider.get(item.riderId)!==item.teamId)||
        (item.riderId!==null&&frame.attackers.includes(item.riderId))))
      throw new Error('Invalid recorded attack event.');
    const chasers=new Set(frame.chasers);
    if(chasers.size!==frame.chasers.length||[...chasers].some(id=>!teamIds.has(id)||expectedTeams.has(id))||
      frame.engagedChaseTeamIds.length!==(frame.gapSeconds>0?chasers.size:0)||
      frame.engagedChaseTeamIds.some(id=>!chasers.has(id)))
      throw new Error('Invalid recorded chase event.');
    if(frame.decisions.some(decision=>!decision||!DECISION_KINDS.has(decision.kind)||
      !teamIds.has(decision.teamId)||teamByRider.get(decision.riderId)!==decision.teamId))
      throw new Error('Invalid recorded tactical decision.');
    const responses=new Set(previousResponses);
    for(const decision of frame.decisions){
      if(decision.kind==='chase_break'){
        if(responses.has(decision.teamId))throw new Error('Repeated recorded break response.');
        responses.add(decision.teamId);
      }else if(decision.kind==='resume_plan'){
        if(!responses.has(decision.teamId))throw new Error('Unmatched recorded break response.');
        responses.delete(decision.teamId);
      }
    }
    if(frame.activeBreakResponseTeamIds.length!==responses.size||
      new Set(frame.activeBreakResponseTeamIds).size!==responses.size||
      frame.activeBreakResponseTeamIds.some(id=>!responses.has(id)))
      throw new Error('Inconsistent recorded break response.');
    previousResponses=responses;
    for(const rider of frame.riderGroups){
      if(!roster.has(rider.id)||seen.has(rider.id)||rider.teamId!==teamByRider.get(rider.id)||
        !Number.isFinite(rider.energy)||rider.energy<0||rider.energy>100||
        !Number.isFinite(rider.deficitSeconds)||rider.deficitSeconds<0||
        !['peloton','breakaway','dropped'].includes(rider.group)||
        (rider.group==='breakaway')!==ahead.has(rider.id))
        throw new Error('Inconsistent recorded rider state.');
      seen.add(rider.id);
    }
  }
  const final=new Map(recording.frames.at(-1).riderGroups.map(rider=>[rider.id,rider]));
  const firstTime=recording.provisionalResults[0].timeSeconds;
  for(const [index,result] of recording.provisionalResults.entries()){
    const state=final.get(result.riderId);
    if(result.position!==index+1||!Number.isFinite(result.timeSeconds)||
      !Number.isFinite(result.gapSeconds)||result.gapSeconds<0||
      (index>0&&result.timeSeconds<recording.provisionalResults[index-1].timeSeconds)||
      Math.abs(result.timeSeconds-firstTime-result.gapSeconds)>.02||
      !state||result.group!==state.group||result.energy!==state.energy||
      result.teamId!==state.teamId)
      throw new Error('Recorded finish does not match the final kilometre.');
  }
  return true;
}

export function readRecordedKilometre(recording,index){
  if(!Number.isInteger(index)||index<0||index>=recording?.frames?.length)
    throw new Error('Recorded kilometre is out of range.');
  return structuredClone(recording.frames[index]);
}
