// Renderer-only spacing for riders who share one recorded group position.
// The source feed remains authoritative for clocks, groups and results.
export const ILLUSTRATIVE_GROUP_LAYOUT_VERSION=
  'illustrative-group-layout-3';
const LANES=8;
const ROW_SPACING_M=2.2;
const LANE_SPACING_M=.78;

const displayOrder=id=>{
  let hash=2166136261;
  for(const character of id){
    hash^=character.charCodeAt(0);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0;
};

export function illustrativeGroupLayoutFrameV3(frame,
  totalDistanceM){
  if(!Array.isArray(frame?.positions)||
    !Number.isFinite(totalDistanceM)||totalDistanceM<=0)
    throw new Error('Illustrative layout needs a recorded frame and route.');
  const buckets=new Map();
  const groupAnchors=new Map();
  for(const row of frame.positions){
    if(!Number.isFinite(row.distance)||
      !Number.isFinite(row.lateral)||
      typeof row.groupId!=='string'||
      typeof row.riderId!=='string')
      throw new Error('Illustrative layout lacks a rider anchor.');
    const key=`${row.groupId}\u0000${row.distance}\u0000${row.lateral}`;
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(row);
    groupAnchors.set(row.groupId,Math.max(
      groupAnchors.get(row.groupId)??0,row.distance));
  }
  const laidOut=new Map();
  const followingAnchors=new Map();
  let lastDistance=0,lastLower=0;
  for(const [groupId,distance] of [...groupAnchors]
    .sort((a,b)=>a[1]-b[1])){
    if(distance>lastDistance){lastLower=lastDistance;lastDistance=distance;}
    followingAnchors.set(groupId,lastLower);
  }
  for(const rows of buckets.values()){
    if(rows.length<2)continue;
    const ordered=[...rows].sort((a,b)=>
      displayOrder(a.riderId)-displayOrder(b.riderId)||
      a.riderId.localeCompare(b.riderId));
    const laneCount=Math.min(LANES,ordered.length);
    const rowCount=Math.ceil(ordered.length/laneCount);
    const anchor=rows[0].distance;
    // Crossing the finish is a recorded fact; never draw a finisher behind it.
    if(anchor<=0||anchor>=totalDistanceM)continue;
    const followingAnchor=followingAnchors.get(rows[0].groupId)??0;
    const spanM=Math.min((rowCount-1)*ROW_SPACING_M,
      totalDistanceM,anchor,
      followingAnchor?Math.max(0,(anchor-followingAnchor)*.9):anchor);
    const rowSpacingM=spanM/Math.max(1,rowCount-1);
    const baseM=Math.max(0,Math.min(
      totalDistanceM-spanM,anchor-spanM));
    for(const [index,row] of ordered.entries()){
      const lane=index%laneCount;
      const rank=Math.floor(index/laneCount);
      laidOut.set(row.riderId,{
        ...row,
        distance:baseM+(rowCount-1-rank)*rowSpacingM,
        lateral:row.lateral+
          (lane-(laneCount-1)/2)*LANE_SPACING_M});
    }
  }
  if(!laidOut.size)return frame;
  return {...frame,positions:frame.positions.map(row=>
    laidOut.get(row.riderId)??row)};
}

export function illustrativeGroupLayoutFeedV3(feed){
  const totalDistanceM=feed?.route?.profile?.samples?.at(-1)?.[0];
  if(!Number.isFinite(totalDistanceM)||totalDistanceM<=0||
    !Array.isArray(feed?.frames)||!Array.isArray(feed?.riders))
    throw new Error('Illustrative layout needs a recorded race feed.');
  return {...feed,frames:feed.frames.map(frame=>
    illustrativeGroupLayoutFrameV3(frame,totalDistanceM))};
}
