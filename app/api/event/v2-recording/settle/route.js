import {NextResponse} from 'next/server';
import {protectedRoute,requireGameWrites,databaseClient}
  from '../../../../../lib/auth/server';
import {AuthError,assertTeamId} from '../../../../../lib/auth/policy.mjs';
import {rpc,uuid} from '../../../../../lib/race/server';
import {loadStoredV2SettlementPreflight}
  from '../../../../../lib/race/v2-settlement-preflight.mjs';

// Preview-only. The caller must be in this race; the server independently
// re-simulates the saved result, and SQL repeats all mutable checks atomically.
export const POST=protectedRoute(async(req,context,auth)=>{
  if(process.env.RACE_LAB_ENABLED!=='true'||
    process.env.PELOTONIA_V2_RECORDING_ENABLED!=='true'||
    process.env.PELOTONIA_V2_SETTLEMENT_ENABLED!=='true')
    throw new AuthError('V2_SETTLEMENT_DISABLED','V2 settlement is unavailable.',404);
  requireGameWrites();
  const body=await req.json().catch(()=>({}));
  if(!body||typeof body!=='object'||Array.isArray(body))
    throw new AuthError('INVALID_RACE','Choose a scheduled race.',400);
  assertTeamId(body.team_id,auth.team.id);
  const eventId=uuid(body.event_id);
  const [entry,reveal]=await Promise.all([
    auth.db.from('event_teams').select('team_id').eq('event_id',eventId)
      .eq('team_id',auth.team.id).maybeSingle(),
    auth.db.from('recovery_division_reveal_entries')
      .select('division_index').eq('event_id',eventId)
      .eq('team_id',auth.team.id).maybeSingle(),
  ]);
  if(entry.error||reveal.error)
    throw new AuthError('V2_SETTLEMENT_UNAVAILABLE',
      'Could not check your race entry.',503);
  if(!entry.data||!reveal.data)
    throw new AuthError('NOT_ENTERED','Your team is not in the revealed race.',403);
  const db=databaseClient({timeoutMs:60000});
  const locked=await db.from('recovery_v2_tactics_commits')
    .select('input_snapshot').eq('event_id',eventId).maybeSingle();
  if(locked.error)
    throw new AuthError('V2_SETTLEMENT_UNAVAILABLE',
      'Could not load the locked race.',503);
  if(!locked.data)
    throw new AuthError('V2_SETTLEMENT_UNAVAILABLE',
      'The v2 tactics input is not locked.',409);
  let preflight;
  try{
    preflight=await loadStoredV2SettlementPreflight(db,
      locked.data.input_snapshot);
  }catch{
    throw new AuthError('V2_SETTLEMENT_INVALID',
      'The saved v2 race needs review before it can finish.',409);
  }
  const settled=await rpc(db,'recovery_settle_v2_one_day',{
    p_event:eventId,p_contract:preflight.contract,
    p_ledger:preflight.ledgerRows,
  });
  return NextResponse.json({ok:true,event_id:eventId,
    division_index:reveal.data.division_index,
    settled_at:settled.settledAt,award_count:settled.awardCount,
    already_settled:settled.alreadySettled});
});
