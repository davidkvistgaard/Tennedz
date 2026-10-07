import {validateRecordedTour} from './recording.mjs';

export const FINALE_SNAPSHOT_VERSION='v2-finale-snapshot-1';
export const FINALE_POST_ATTACK_SNAPSHOT_VERSION='v2-finale-snapshot-2';

// Read-only five-kilometre handoff. A later motor must use these actual road
// groups and remaining energy; this snapshot does not move or rank riders.
export function finaleSnapshotFromTour(tour,{remainingKm=5}={}){
  validateRecordedTour(tour);
  if(![4,5].includes(remainingKm))
    throw new Error('A finale snapshot needs four or five remaining kilometres.');
  const sourceKm=tour.route.distanceKm-remainingKm;
  if(sourceKm<1)throw new Error('A finale snapshot needs five prior kilometres.');
  const frame=tour.frames[sourceKm-1];
  const roadGroupByRider=new Map(frame.roadGroups.flatMap(group=>
    group.riderIds.map(riderId=>[riderId,group.id])));
  const riders=frame.riderGroups.map(state=>{
    const roadGroupId=roadGroupByRider.get(state.id)??
      (state.group==='peloton'?'peloton':null);
    if(state.group==='breakaway'&&!roadGroupByRider.has(state.id)||
      state.group!=='breakaway'&&roadGroupByRider.has(state.id)||
      state.group==='dropped'&&roadGroupId!==null)
      throw new Error('The finale source has inconsistent rider road groups.');
    return {riderId:state.id,teamId:state.teamId,roadGroupId,
      status:state.group,energy:state.energy};
  });
  const pelotonIds=riders.filter(rider=>rider.status==='peloton')
    .map(rider=>rider.riderId);
  return {version:remainingKm===4?FINALE_POST_ATTACK_SNAPSHOT_VERSION:
    FINALE_SNAPSHOT_VERSION,
    sourceTuningVersion:tour.tuningVersion,sourceKm,
    startDistanceM:sourceKm*1000,remainingM:remainingKm*1000,
    roadGroups:frame.roadGroups.map(group=>({id:group.id,
      gapSeconds:group.gapSeconds,riderIds:[...group.riderIds],
      teamIds:[...group.teamIds]})),
    peloton:{id:'peloton',gapSeconds:0,riderIds:pelotonIds},
    droppedRiderIds:riders.filter(rider=>rider.status==='dropped')
      .map(rider=>rider.riderId),riders};
}
