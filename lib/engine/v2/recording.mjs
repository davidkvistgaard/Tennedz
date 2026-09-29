// Validate a completed v2 laboratory recording before storage or playback.
// This module deliberately has no simulator imports: playback reads the
// recorded frames and result instead of recalculating with today's tuning.
const BLOCK_REASONS=new Set(['team_break_limit','no_available_rider','already_ahead',
  'dropped','exhausted','rider_unavailable']);
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
  for(const [index,frame] of recording.frames.entries()){
    const segment=recording.route.kilometres[index];
    if(frame?.km!==index+1||!Number.isFinite(frame.gapSeconds)||frame.gapSeconds<0||
      !Array.isArray(frame.riderGroups)||frame.riderGroups.length!==roster.size||
      !Array.isArray(frame.breakawayRiderIds)||!Array.isArray(frame.attackers)||
      !Array.isArray(frame.blockedAttacks)||segment?.km!==frame.km||
      segment.terrain!==frame.terrain||segment.surface!==frame.surface||
      segment.exposed!==frame.exposed)throw new Error('Invalid recorded kilometre.');
    const ahead=new Set(frame.breakawayRiderIds),seen=new Set();
    if(ahead.size!==frame.breakawayRiderIds.length||
      [...ahead].some(id=>!roster.has(id))||
      (frame.gapSeconds===0)!==(ahead.size===0))throw new Error('Inconsistent recorded breakaway.');
    if(new Set(frame.attackers).size!==frame.attackers.length||
      frame.attackers.some(id=>!roster.has(id))||
      frame.blockedAttacks.some(item=>!item||!teamIds.has(item.teamId)||!BLOCK_REASONS.has(item.reason)||
        (item.riderId!==null&&!roster.has(item.riderId))||
        (item.riderId!==null&&teamByRider.get(item.riderId)!==item.teamId)||
        (item.riderId!==null&&frame.attackers.includes(item.riderId))))
      throw new Error('Invalid recorded attack event.');
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
