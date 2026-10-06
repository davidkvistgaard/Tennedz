import {NextResponse} from 'next/server';
import {protectedRoute,requireGameWrites} from '../../../../../lib/auth/server';
import {AuthError,assertTeamId} from '../../../../../lib/auth/policy.mjs';
import {rpc,uuid} from '../../../../../lib/race/server';
import {weatherForV2TacticsLock} from '../../../../../lib/race/v2-lock-weather.mjs';

// Entrants may trigger the idempotent private lock after tactics close.
// Do not return the full snapshot or opponents' orders from this endpoint.
export const POST=protectedRoute(async(req,context,auth)=>{
  if(process.env.RACE_LAB_ENABLED!=='true'||
    process.env.PELOTONIA_V2_TACTICS_LOCK_ENABLED!=='true')
    throw new AuthError('V2_LOCK_DISABLED','V2 tactics preparation is unavailable.',404);
  requireGameWrites();
  const body=await req.json().catch(()=>({}));
  if(!body||typeof body!=='object'||Array.isArray(body))
    throw new AuthError('INVALID_RACE','Choose a scheduled race.',400);
  assertTeamId(body.team_id,auth.team.id);
  const eventId=uuid(body.event_id);
  const [entry,reveal]=await Promise.all([
    auth.db.from('event_teams').select('team_id').eq('event_id',eventId)
      .eq('team_id',auth.team.id).maybeSingle(),
    auth.db.from('recovery_division_reveal_entries').select('division_index')
      .eq('event_id',eventId).eq('team_id',auth.team.id).maybeSingle(),
  ]);
  if(entry.error||reveal.error)
    throw new AuthError('V2_LOCK_UNAVAILABLE','Could not check the race entry.',503);
  if(!entry.data||!reveal.data)
    throw new AuthError('NOT_ENTERED','Your team is not in the revealed race.',403);
  const snapshot=await rpc(auth.db,'recovery_race_snapshot',{p_event:eventId});
  let weather;
  try{weather=weatherForV2TacticsLock(snapshot);}catch(error){
    throw new AuthError('V2_LOCK_UNAVAILABLE',error.message,409);
  }
  const locked=await rpc(auth.db,'recovery_commit_v2_tactics_lock',{
    p_event:eventId,p_weather:weather,
  });
  return NextResponse.json({ok:true,event_id:eventId,
    division_index:reveal.data.division_index,
    locked_at:locked.lockedAt,already_locked:locked.alreadyLocked});
});
