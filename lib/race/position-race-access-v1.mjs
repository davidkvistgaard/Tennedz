import {AuthError} from '../auth/policy.mjs';

export async function requirePositionRaceParticipantV1(
  db,eventId,teamId){
  const [{data:entry,error:entryError},
    {data:event,error:eventError}]=await Promise.all([
    db.from('event_teams').select('team_id')
      .eq('event_id',eventId).eq('team_id',teamId)
      .maybeSingle(),
    db.from('events').select('status,engine_version')
      .eq('id',eventId).maybeSingle()]);
  if(entryError||eventError)
    throw new AuthError('POSITION_RACE_UNAVAILABLE',
      'Could not check the saved race.',503);
  if(!entry)
    throw new AuthError('POSITION_RACE_FORBIDDEN',
      'Your team did not enter this race.',403);
  if(event?.status!=='FINISHED'||event.engine_version!==
      'physical-first-position-general-race-8')
    throw new AuthError('POSITION_RACE_PENDING',
      'This position race has not finished yet.',404);
  return event;
}
