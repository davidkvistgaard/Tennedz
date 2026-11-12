import {NextResponse} from 'next/server';
import {protectedRoute,requireGameWrites} from
  '../../../../lib/auth/server';
import {AuthError,assertTeamId} from
  '../../../../lib/auth/policy.mjs';
import {uuid,rpc} from '../../../../lib/race/server';
import {positionRaceTargetV1} from
  '../../../../lib/race/position-race-target-v1.mjs';
import {planDefaultPhysicalEntryV1} from
  '../../../../lib/race/default-physical-entry-v1.mjs';
import {preparePhysicalEntryV1} from
  '../../../../lib/race/physical-entry-v1.mjs';

function checked(result,label){
  if(result.error)throw new AuthError('DEFAULT_ENTRY_UNAVAILABLE',
    `Could not load ${label}.`,503);
  return result.data;
}

export const POST=protectedRoute(async(req,context,auth)=>{
  requireGameWrites();
  const body=await req.json().catch(()=>({}));
  assertTeamId(body.team_id,auth.team.id);
  const eventId=uuid(body.event_id);
  if(!positionRaceTargetV1(eventId,process.env))
    throw new AuthError('DEFAULT_ENTRY_DISABLED',
      'Default physical entry is not enabled for this race.',404);
  const event=checked(await auth.db.from('events')
    .select('id,kind,gender,status,deadline,stage_profile_id')
    .eq('id',eventId).maybeSingle(),'the event');
  if(!event||event.kind!=='one_day'||event.status!=='OPEN'||
    Date.parse(event.deadline)<=Date.now())
    throw new AuthError('DEFAULT_ENTRY_CLOSED',
      'This race is closed for entries.',409);
  const [stageResult,entryResult,rosterResult,
    gameResult,lineupResult,tacticResult,kitResult]=
    await Promise.all([
      auth.db.from('stage_profiles')
        .select('distance_km,keypoints,tags,profile_points')
        .eq('id',event.stage_profile_id).maybeSingle(),
      auth.db.from('event_teams')
        .select('selected_riders,captain_id')
        .eq('event_id',eventId).eq('team_id',auth.team.id)
        .maybeSingle(),
      auth.db.from('team_riders').select('rider_id')
        .eq('team_id',auth.team.id),
      auth.db.from('game_state').select('game_date')
        .eq('id',1).maybeSingle(),
      auth.db.from('recovery_default_lineups')
        .select('selected_riders,captain_id')
        .eq('team_id',auth.team.id).eq('gender',event.gender)
        .eq('event_format','ONE_DAY')
        .lte('updated_at',event.deadline).maybeSingle(),
      auth.db.from('recovery_default_tactics_v1')
        .select('effort,chase,attack,front_work,sporting_goal')
        .eq('team_id',auth.team.id).eq('gender',event.gender)
        .eq('event_format','ONE_DAY')
        .lte('updated_at',event.deadline).maybeSingle(),
      auth.db.from('club_identities').select('palette,pattern')
        .eq('team_id',auth.team.id).maybeSingle(),
    ]);
  const stage=checked(stageResult,'the route');
  const entry=checked(entryResult,'your entered lineup');
  const roster=checked(rosterResult,'your riders');
  const game=checked(gameResult,'the game date');
  const savedLineup=checked(lineupResult,'your default team');
  const savedTactics=checked(tacticResult,'your default tactics');
  const kit=checked(kitResult,'your club kit');
  if(!stage||!game||!Array.isArray(roster))
    throw new AuthError('DEFAULT_ENTRY_UNAVAILABLE',
      'The race or roster is incomplete.',503);
  const ids=roster.map(row=>row.rider_id);
  const riders=ids.length?checked(await auth.db.from('riders')
    .select('id,gender,injury_until,flat,sprint,hills,mountain,cobbles,timetrial,endurance,strength,leadership,form,fatigue')
    .in('id',ids),'your rider ratings'):[];
  let plan,prepared;
  try{
    plan=planDefaultPhysicalEntryV1({
      team:{id:auth.team.id,name:auth.team.name,
        entry:entry??{},riders},event,stage,
      gameDate:game.game_date,savedLineup,
      savedTactics:savedTactics&&{
        effort:savedTactics.effort,chase:savedTactics.chase,
        attack:savedTactics.attack,
        front_work:savedTactics.front_work,
        sporting_goal:savedTactics.sporting_goal}});
    prepared=preparePhysicalEntryV1({body:{
      version:'physical-entry-request-v1',
      selected_riders:plan.selectedRiders,
      captain_id:plan.captainId,
      orders:plan.orders,stake:plan.stake},
    stage,team:auth.team,savedKit:kit});
  }catch(error){throw new AuthError('INVALID_DEFAULT_ENTRY',
    error.message,409);}
  const receipt=await rpc(auth.db,
    'recovery_join_default_event_physical_v1',{
      p_user:auth.user.id,p_event:eventId,
      p_riders:plan.selectedRiders,p_captain:plan.captainId,
      p_orders:prepared.orders,p_stake:prepared.stake,
      p_team_style:prepared.teamStyle,
      p_lineup_source:plan.lineupSource,
      p_tactics_source:plan.tacticsSource});
  return NextResponse.json({ok:true,receipt,entry:{
    selected_riders:plan.selectedRiders,
    captain_id:plan.captainId,orders:prepared.orders,
    stake:prepared.stake},lineup_source:plan.lineupSource,
    tactics_source:plan.tacticsSource});
});
