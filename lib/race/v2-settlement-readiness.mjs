import {loadStoredV2SettlementPreflight}
  from './v2-settlement-preflight.mjs';

const RESULT_TABLES=[
  'recovery_race_commits','event_division_runs','event_divisions',
  'event_team_results','event_rider_results','event_runs','event_stages',
  'recovery_ranking_awards',
];

// An early, read-only rejection boundary for a future atomic v2 settlement.
// None of these separate HTTP reads is a lock. The write transaction must
// repeat every phase, candidate, result and award check under its own lock.
export async function loadV2SettlementReadiness(db,eventId,{now=Date.now()}={}){
  if(typeof eventId!=='string'||!eventId)
    throw new Error('The v2 settlement needs an event ID.');
  const savedLock=await db.from('recovery_v2_tactics_commits')
    .select('event_id,input_snapshot').eq('event_id',eventId).maybeSingle();
  if(savedLock.error||!savedLock.data||
    savedLock.data.event_id!==eventId||
    savedLock.data.input_snapshot?.event?.id!==eventId)
    throw new Error('Could not verify the saved v2 tactics lock.',
      {cause:savedLock.error??undefined});
  const lock=savedLock.data.input_snapshot;
  const preflight=await loadStoredV2SettlementPreflight(db,lock);
  const [eventRead,...conflicts]=await Promise.all([
    db.from('events').select('id,kind,status,gender,calendar_source,race_tier,registration_deadline,tactics_deadline,scheduled_at')
      .eq('id',eventId).maybeSingle(),
    ...RESULT_TABLES.map(table=>db.from(table).select('event_id')
      .eq('event_id',eventId).limit(1)),
  ]);
  if(eventRead.error||!eventRead.data||eventRead.data.id!==eventId)
    throw new Error('Could not verify the current v2 race state.',
      {cause:eventRead.error??undefined});
  if(conflicts.some(result=>result.error))
    throw new Error('Could not verify existing race results and points.');
  const event=eventRead.data;
  if(!Number.isFinite(now)||event.kind!=='one_day'||event.status!=='OPEN'||
    event.gender!==lock.event.gender||
    event.calendar_source!==lock.event.calendar_source||
    event.race_tier!==lock.event.race_tier||
    !Number.isFinite(Date.parse(event.registration_deadline))||
    !Number.isFinite(Date.parse(event.tactics_deadline))||
    !Number.isFinite(Date.parse(event.scheduled_at))||
    ['registration_deadline','tactics_deadline','scheduled_at'].some(field=>
      Date.parse(event[field])!==Date.parse(lock.event[field]))||
    [event.registration_deadline,event.tactics_deadline,event.scheduled_at]
      .some(deadline=>Date.parse(deadline)>now))
    throw new Error('The v2 race is not ready for settlement.');
  const occupied=RESULT_TABLES.find((table,index)=>
    !Array.isArray(conflicts[index].data)||conflicts[index].data.length>0);
  if(occupied)
    throw new Error(`Existing ${occupied} rows require manual review.`);
  return preflight;
}
