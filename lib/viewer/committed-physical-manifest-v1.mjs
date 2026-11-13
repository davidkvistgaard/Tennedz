import {GAME_SNAPSHOT_PAID_VIEWER_VERSION} from
  './game-snapshot-paid-viewer-v1.mjs';

export const COMMITTED_PHYSICAL_MANIFEST_VERSION=
  'committed-physical-manifest-v1';

// Physical entry rows are private game records. This boundary only copies
// recorded inputs; it never supplies a default order, bib or team identity.
export function manifestFromCommittedPhysicalEntriesV1(snapshot,rows){
  const eventId=snapshot?.event?.id;
  const teams=snapshot?.teams;
  if(!eventId||!Array.isArray(teams)||teams.length<2||
    !Array.isArray(rows)||rows.length!==teams.length)
    throw new Error('Every participating team needs one physical entry.');
  const byTeam=new Map();
  for(const row of rows){
    if(row?.event_id!==eventId||!row.team_id||
      row.schema_version!=='physical-entry-input-v1'||
      byTeam.has(row.team_id))
      throw new Error('Physical entries do not match this race.');
    byTeam.set(row.team_id,row);
  }
  const entries=teams.map(team=>{
    const row=byTeam.get(team?.id);
    const selected=team?.entry?.selected_riders;
    if(!row||!Array.isArray(selected)||selected.length!==8||
      !Array.isArray(row.selected_riders)||
      selected.length!==row.selected_riders.length||
      selected.some((id,index)=>id!==row.selected_riders[index])||
      team.entry.captain_id!==row.captain_id)
      throw new Error('Physical entry lineup changed after commitment.');
    return {teamId:team.id,orders:row.orders,
      stake:row.stake,style:row.team_style,
      riderNumbers:row.rider_numbers};
  });
  return {version:GAME_SNAPSHOT_PAID_VIEWER_VERSION,
    eventId,entries};
}
