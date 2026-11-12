import {planDefaultPhysicalEntryV1} from
  './default-physical-entry-v1.mjs';
import {preparePhysicalEntryV1} from './physical-entry-v1.mjs';

function checked(result,label){
  if(result.error)throw new Error(`Could not load ${label}.`);
  return result.data??[];
}

// Called only by the targeted position-race preparation after its deadline.
// Existing manager entries are never rewritten. The database repeats the
// membership and eligibility checks under the race transaction lock.
export async function commitMissingDefaultPhysicalEntriesV1({
  db,rpc,snapshot}){
  const {event,stage,teams,game_date:gameDate}=snapshot;
  const existing=checked(await db.from('recovery_physical_entry_inputs')
    .select('team_id').eq('event_id',event.id),'race tactics');
  const saved=new Set(existing.map(row=>row.team_id));
  const missing=teams.filter(team=>!saved.has(team.id));
  if(!missing.length)return {default_entries_committed:0,
    total_entries:teams.length};
  const ids=missing.map(team=>team.id);
  const [lineupRows,tacticRows,kitRows]=await Promise.all([
    db.from('recovery_default_lineups')
      .select('team_id,selected_riders,captain_id')
      .in('team_id',ids).eq('gender',event.gender)
      .eq('event_format','ONE_DAY').lte('updated_at',event.deadline),
    db.from('recovery_default_tactics_v1')
      .select('team_id,effort,chase,attack,front_work,sporting_goal')
      .in('team_id',ids).eq('gender',event.gender)
      .eq('event_format','ONE_DAY').lte('updated_at',event.deadline),
    db.from('club_identities').select('team_id,palette,pattern')
      .in('team_id',ids),
  ]);
  const lineups=new Map(checked(lineupRows,'saved default lineups')
    .map(row=>[row.team_id,row]));
  const tactics=new Map(checked(tacticRows,'saved default tactics')
    .map(row=>[row.team_id,row]));
  const kits=new Map(checked(kitRows,'club kits')
    .map(row=>[row.team_id,{
      palette:row.palette,pattern:row.pattern}]));
  const defaults=missing.map(team=>{
    const savedTactics=tactics.get(team.id);
    const plan=planDefaultPhysicalEntryV1({team,event,stage,
      gameDate,savedLineup:lineups.get(team.id),
      savedTactics:savedTactics&&{
        effort:savedTactics.effort,chase:savedTactics.chase,
        attack:savedTactics.attack,
        front_work:savedTactics.front_work,
        sporting_goal:savedTactics.sporting_goal}});
    const prepared=preparePhysicalEntryV1({body:{
      version:'physical-entry-request-v1',
      selected_riders:plan.selectedRiders,
      captain_id:plan.captainId,
      orders:plan.orders,stake:plan.stake},stage,team,
    savedKit:kits.get(team.id)});
    return {teamId:team.id,policyVersion:plan.version,
      lineupSource:plan.lineupSource,
      tacticsSource:plan.tacticsSource,
      selectedRiders:plan.selectedRiders,captainId:plan.captainId,
      orders:prepared.orders,stake:prepared.stake,
      teamStyle:prepared.teamStyle};
  });
  return rpc(db,'recovery_commit_default_physical_entries_v1',{
    p_event:event.id,p_defaults:defaults});
}
