import {NextResponse} from 'next/server';
import {protectedRoute,requireGameWrites} from
  '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {validateDefaultTacticsV1} from
  '../../../../lib/race/default-physical-entry-v1.mjs';

const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function gender(value){
  if(value!=='M'&&value!=='F')
    throw new AuthError('INVALID_CATEGORY',
      'Choose the men’s or women’s category.',400);
  return value;
}

export const GET=protectedRoute(async(req,context,auth)=>{
  const category=gender(new URL(req.url).searchParams.get('gender'));
  const [lineup,tactic]=await Promise.all([
    auth.db.from('recovery_default_lineups')
      .select('selected_riders,captain_id,updated_at')
      .eq('team_id',auth.team.id).eq('gender',category)
      .eq('event_format','ONE_DAY').maybeSingle(),
    auth.db.from('recovery_default_tactics_v1')
      .select('effort,chase,attack,front_work,sporting_goal,updated_at')
      .eq('team_id',auth.team.id).eq('gender',category)
      .eq('event_format','ONE_DAY').maybeSingle(),
  ]);
  if(lineup.error||tactic.error)
    throw new AuthError('DEFAULT_PLAN_UNAVAILABLE',
      'Could not load your default race plan.',503);
  return NextResponse.json({ok:true,lineup:lineup.data,
    tactics:tactic.data});
});

export const POST=protectedRoute(async(req,context,auth)=>{
  requireGameWrites();
  const body=await req.json().catch(()=>({}));
  const category=gender(body.gender);
  if(body.kind==='lineup'){
    const ids=body.selected_riders;
    if(!Array.isArray(ids)||ids.length!==8||
      new Set(ids).size!==8||
      ids.some(id=>typeof id!=='string'||!UUID.test(id))||
      !ids.includes(body.captain_id))
      throw new AuthError('INVALID_DEFAULT_LINEUP',
        'Choose eight different riders and their captain.',400);
    const [owned,riders]=await Promise.all([
      auth.db.from('team_riders').select('rider_id')
        .eq('team_id',auth.team.id).in('rider_id',ids),
      auth.db.from('riders').select('id,gender').in('id',ids),
    ]);
    if(owned.error||riders.error)
      throw new AuthError('DEFAULT_PLAN_UNAVAILABLE',
        'Could not verify your riders.',503);
    if(owned.data.length!==8||riders.data.length!==8||
      riders.data.some(rider=>rider.gender!==category))
      throw new AuthError('INVALID_DEFAULT_LINEUP',
        'The default team must contain eight of your riders in one category.',400);
    const {error}=await auth.db.from('recovery_default_lineups')
      .upsert({team_id:auth.team.id,gender:category,
        event_format:'ONE_DAY',selected_riders:ids,
        captain_id:body.captain_id,
        updated_at:new Date().toISOString()},
      {onConflict:'team_id,gender,event_format'});
    if(error)throw new AuthError('DEFAULT_PLAN_UNAVAILABLE',
      'Could not save your default team.',503);
    return NextResponse.json({ok:true,kind:'lineup'});
  }
  if(body.kind==='tactics'){
    let tactic;
    try{tactic=validateDefaultTacticsV1(body.tactics);}
    catch(error){throw new AuthError('INVALID_DEFAULT_TACTICS',
      error.message,400);}
    const {error}=await auth.db.from('recovery_default_tactics_v1')
      .upsert({team_id:auth.team.id,gender:category,
        event_format:'ONE_DAY',...tactic,
        updated_at:new Date().toISOString()},
      {onConflict:'team_id,gender,event_format'});
    if(error)throw new AuthError('DEFAULT_PLAN_UNAVAILABLE',
      'Could not save your default tactics.',503);
    return NextResponse.json({ok:true,kind:'tactics'});
  }
  throw new AuthError('INVALID_DEFAULT_PLAN',
    'Choose a default team or tactic.',400);
});
