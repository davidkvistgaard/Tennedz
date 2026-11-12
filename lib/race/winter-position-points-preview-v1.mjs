// A read-only illustration from recorded V7 crossings. It never awards
// points, changes ratings, or asserts an official finish order.
export const WINTER_POSITION_POINTS_PREVIEW_VERSION=
  'winter-position-points-preview-v1';
const EPS=1e-6;
const TEAM_LIMIT=30;

export function winterPositionPointsPreviewV1(document){
  const riders=document?.feed?.riders;
  const teams=document?.feed?.teams;
  const evidence=document?.finishEvidence;
  const crossings=evidence?.entries;
  const observations=evidence?.unresolvedModelClockTies;
  if(document?.input?.officialResults!==false||
    document?.coverage?.officialResults!==false||
    evidence?.version!==
      'physical-first-position-finish-evidence-1'||
    !Array.isArray(riders)||riders.length<16||
    !Array.isArray(teams)||teams.length<2||
    !Array.isArray(crossings)||
    crossings.length!==riders.length||
    !Array.isArray(observations))
    throw new Error('The recorded finish cannot support a points preview.');
  const riderById=new Map(riders.map(row=>[row.id,row]));
  const teamById=new Map(teams.map(row=>[row.id,row]));
  if(riderById.size!==riders.length||
    teamById.size!==teams.length||
    riders.some(row=>!teamById.has(row.teamId))||
    new Set(crossings.map(row=>row.riderId)).size!==riders.length||
    crossings.some((row,index)=>
      !riderById.has(row.riderId)||
      !Number.isFinite(row.clockSeconds)||
      row.clockSeconds<=0||
      index>0&&row.clockSeconds<
        crossings[index-1].clockSeconds))
    throw new Error('The recorded crossing field is incomplete.');
  const groups=[];
  for(let index=0;index<crossings.length;){
    let end=index+1;
    while(end<crossings.length&&
      crossings[end].clockSeconds-
        crossings[index].clockSeconds<=EPS)end++;
    groups.push({rank:index+1,rows:crossings.slice(index,end)});
    index=end;
  }
  const observed=observations.map(row=>
    [...(row?.riderIds??[])].sort().join('|')).sort();
  const actual=groups.filter(group=>group.rows.length>1)
    .map(group=>group.rows.map(row=>row.riderId)
      .sort().join('|')).sort();
  if(JSON.stringify(observed)!==JSON.stringify(actual))
    throw new Error('The recorded finish ties changed.');
  const totals=new Map(teams.map(row=>[row.id,0]));
  const riderPoints=groups.flatMap(group=>group.rows.map(row=>{
    const rider=riderById.get(row.riderId);
    const points=riders.length-group.rank+1;
    if(group.rank<=TEAM_LIMIT)
      totals.set(rider.teamId,totals.get(rider.teamId)+points);
    return {riderId:rider.id,riderName:rider.name,
      teamId:rider.teamId,recordedRank:group.rank,
      tied:group.rows.length>1,points,
      clockSeconds:row.clockSeconds};
  }));
  const teamPoints=teams.map(row=>({teamId:row.id,
    teamName:row.name,points:totals.get(row.id)}))
    .sort((a,b)=>b.points-a.points||
      a.teamId.localeCompare(b.teamId));
  return {version:WINTER_POSITION_POINTS_PREVIEW_VERSION,
    official:false,awarded:false,starters:riders.length,
    teamScoringRankLimit:TEAM_LIMIT,
    unresolvedTieRiders:groups.filter(group=>group.rows.length>1)
      .reduce((count,group)=>count+group.rows.length,0),
    riders:riderPoints,teams:teamPoints};
}
