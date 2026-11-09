// Experimental viewer export from independently paid kilometre crossings.
// Longitudinal positions between crossings are interpolation, never source gaps.
export const PHYSICAL_FIRST_SPLIT_VIEWER_ADAPTER_VERSION=
  'physical-first-split-to-pelotonia.viewer.v1-1';
const EPS=.002;

function transitionEvents(step){
  const starts=[
    ...(step.attackSteps??[]).map(row=>row.launchEvent),
    ...(step.peloton?.startDropEvents??[]),
    ...(step.otherSteps??[]).flatMap(row=>row.startDropEvents??[])];
  const boundary=(step.boundaryContactEvents??[]).map(row=>({
    ...row,kind:'boundary_contact'}));
  const within=(step.withinKmContactEvents??[]).map(row=>
    row.event?{...row.event,kind:'bunch_contact',joined:row.joined}:
      {...row,kind:'solo_contact'});
  return [...boundary,...starts,...within].sort((a,b)=>
    a.atClockSeconds-b.atClockSeconds||
    (a.kind==='boundary_contact'?-1:0));
}

function advanceMembership(membership,roles,event){
  const contact=event.kind==='boundary_contact'||
    event.kind==='solo_contact';
  if(contact){
    if(!event.recordedPaidContact||
      !Array.isArray(event.riderIds??event.road?.riderIds))
      throw new Error('Viewer export refuses an unrecorded group contact.');
    const ids=event.riderIds??event.road.riderIds;
    const sources=event.fromRoadIds;
    if(ids.length<2||sources?.length<2||
      ids.some((id,index)=>membership.get(id)!==sources[index]))
      throw new Error('Viewer export contact differs from recorded roads.');
    const target=event.roadId??event.road.roadId;
    for(const id of ids)membership.set(id,target);
    roles.set(target,'dropped');
    return;
  }
  if(event.kind==='bunch_contact'){
    if(!event.recordedPaidContact)
      throw new Error('Viewer export refuses unpaid bunch contact.');
    if(!event.joined)return;
    if(membership.get(event.riderId)!==event.fromRoadId||
      event.toRoadId!=='peloton')
      throw new Error('Viewer export bunch join differs from recording.');
    membership.set(event.riderId,'peloton');
    return;
  }
  if(membership.get(event.riderId)!==event.fromRoadId||
    !event.toRoadId?.startsWith('solo:'))
    throw new Error('Viewer export departure differs from recorded road.');
  membership.set(event.riderId,event.toRoadId);
  roles.set(event.toRoadId,event.choice===
    'launch_from_measured_bunch_contact'?'leaders':'dropped');
}

function interpolatedDistance(anchors,time,totalDistance){
  if(time<=anchors[0].time)return anchors[0].distance;
  if(time>=anchors.at(-1).time)return totalDistance;
  let low=0,high=anchors.length-1;
  while(high-low>1){
    const middle=(low+high)>>1;
    if(anchors[middle].time<=time)low=middle;
    else high=middle;
  }
  const from=anchors[low],to=anchors[high];
  return from.distance+(to.distance-from.distance)*
    (time-from.time)/(to.time-from.time);
}

export function adaptSplitPhysicalFirstRaceV1({race,kilometres,
  teams,teamStyles,raceId,category}){
  const count=kilometres?.length;
  const riderIds=teams?.flatMap(team=>team.riders.map(row=>row.id));
  if(!Number.isInteger(count)||count<1||
    race?.completedThroughKm!==count||
    race.states?.length!==count+1||race.steps?.length!==count||
    !Array.isArray(riderIds)||!riderIds.length||
    new Set(riderIds).size!==riderIds.length||
    !['men','women'].includes(category)||!raceId||
    teamStyles?.length!==teams.length||
    teamStyles.some((style,index)=>style.id!==teams[index].id))
    throw new Error('Split viewer export needs a complete paid race.');
  const sorted=[...riderIds].sort();
  const totalDistance=count*1000;
  const anchors=new Map(sorted.map(id=>[id,[]]));
  for(const [km,state] of race.states.entries()){
    if(state.sourceKm!==km||state.riders?.length!==sorted.length||
      new Set(state.riders.map(row=>row.riderId)).size!==sorted.length)
      throw new Error('Split viewer export lacks every rider crossing.');
    for(const row of state.riders){
      const track=anchors.get(row.riderId);
      if(!track||row.distanceM!==km*1000||
        !Number.isFinite(row.clockSeconds)||
        (km===0?row.clockSeconds!==0:
          row.clockSeconds<=track.at(-1).time))
        throw new Error('Split viewer export lacks paid crossing time.');
      track.push({time:row.clockSeconds,distance:row.distanceM});
    }
  }
  const checked=new Map(sorted.map(id=>[id,'peloton']));
  const checkedRoles=new Map([['peloton','peloton']]);
  for(const [index,step] of race.steps.entries()){
    for(const event of transitionEvents(step))
      advanceMembership(checked,checkedRoles,event);
    for(const row of race.states[index+1].riders)
      if(checked.get(row.riderId)!==row.roadId)
        throw new Error('Split viewer export lacks a recorded road transition.');
  }
  const transitions=race.steps.flatMap(transitionEvents).sort((a,b)=>
    a.atClockSeconds-b.atClockSeconds||
    (a.kind==='boundary_contact'?-1:0));
  for(const event of transitions){
    if(!Number.isFinite(event.atClockSeconds)||
      !Number.isFinite(event.atDistanceM)||
      event.atClockSeconds<0||event.atDistanceM<0||
      event.atDistanceM>totalDistance)
      throw new Error('Split viewer export lacks event time or distance.');
    if(event.kind==='solo_contact')
      for(const id of event.road.riderIds)
        anchors.get(id)?.push({time:event.atClockSeconds,
          distance:event.atDistanceM});
    if(event.kind==='bunch_contact'&&event.joined)
      anchors.get(event.riderId)?.push({time:event.atClockSeconds,
        distance:event.atDistanceM});
  }
  for(const track of anchors.values()){
    track.sort((a,b)=>a.time-b.time);
    if(track.some((row,index)=>index&&
      (row.time<=track[index-1].time||
        row.distance+EPS<track[index-1].distance)))
      throw new Error('Split viewer export has crossing or contact reversal.');
  }
  const membership=new Map(sorted.map(id=>[id,'peloton']));
  const roles=new Map([['peloton','peloton']]);
  const times=new Set([0,...race.states.map(state=>
    state.roads.find(road=>road.roadId==='peloton')?.clockSeconds),
    ...transitions.map(row=>row.atClockSeconds),
    ...race.states.at(-1).riders.map(row=>row.clockSeconds)]);
  if(times.has(undefined))
    throw new Error('Split viewer export lacks peloton clock.');
  const orderedTimes=[...times].sort((a,b)=>a-b);
  const frames=[];
  let nextTransition=0;
  for(const time of orderedTimes){
    while(nextTransition<transitions.length&&
      transitions[nextTransition].atClockSeconds<=time+EPS){
      advanceMembership(membership,roles,transitions[nextTransition]);
      nextTransition++;
    }
    frames.push({time,groupRoles:Object.fromEntries(roles),
      positions:sorted.map(riderId=>({riderId,
        distance:interpolatedDistance(anchors.get(riderId),
          time,totalDistance),lateral:0,
        groupId:membership.get(riderId)}))});
  }
  for(const row of race.states.at(-1).riders)
    if(membership.get(row.riderId)!==row.roadId)
      throw new Error('Split viewer export has unrecorded final membership.');
  const profile=[[0,kilometres[0].startM],
    ...kilometres.map((segment,index)=>{
      if(segment.km!==index+1||
        !Number.isFinite(segment.startM)||
        !Number.isFinite(segment.endM))
        throw new Error('Split viewer export lacks route profile.');
      return [(index+1)*1000,segment.endM];
    })];
  const duration=orderedTimes.at(-1);
  // Crossing clocks are paid motor evidence. Equal clocks stay tied; this
  // record does not assign official places, points or awards.
  const finishEvidence={version:'motor-lab-paid-finish-v1',
    publishedAt:duration,
    entries:race.states.at(-1).riders.map(row=>({
      riderId:row.riderId,clockSeconds:row.clockSeconds,
      roadId:row.roadId})).sort((a,b)=>
      a.clockSeconds-b.clockSeconds||a.riderId.localeCompare(b.riderId))};
  if(finishEvidence.entries.length!==sorted.length||
    finishEvidence.entries.some(row=>
      !Number.isFinite(row.clockSeconds)||row.clockSeconds<=0||
      row.clockSeconds>duration||!row.roadId)||
    new Set(finishEvidence.entries.map(row=>row.riderId)).size!==
      sorted.length)
    throw new Error('Split viewer export lacks paid finish evidence.');
  const events=[{time:0,label:'The paid race begins.'},
    ...transitions.map(event=>({time:event.atClockSeconds,
      label:event.kind==='boundary_contact'||
        event.kind==='solo_contact'?
        `${event.riderIds?.length??event.road.riderIds.length} riders make recorded paid contact.`:
        event.kind==='bunch_contact'?
          event.joined?'A rider joins the paid peloton.':
            'A rider reaches the peloton but cannot hold shelter.':
          event.choice==='launch_from_measured_bunch_contact'?
            'A rider launches a paid attack.':
            'A rider loses shelter and rides alone.',
      ...(event.riderId?{riderId:event.riderId}:{})})),
    ...race.steps.map(step=>({
      time:step.peloton.road.finishClockSeconds,
      label:`${step.peloton.road.leaderRiderId} leads kilometre ${step.sourceKm}.`,
      riderId:step.peloton.road.leaderRiderId})),
    {time:duration,label:'All recorded riders reach the finish.'}]
    .sort((a,b)=>a.time-b.time);
  const feed={schemaVersion:'pelotonia.viewer.v1',raceId,
    title:'Motor Lab split road preview',riderCategory:category,
    duration,route:{label:'Schematic distance axis — geography unavailable',
      points:[[0,0,0],[0,0,totalDistance]],
      distanceStations:[0,totalDistance],
      interpolation:'polyline',width:6,
      profile:{schemaVersion:'pelotonia.route-profile.v1',
        samples:profile}},
    teams:teamStyles,
    riders:teams.flatMap(team=>team.riders.map((rider,index)=>({
      id:rider.id,name:rider.name,number:index+1,teamId:team.id}))),
    frames,events};
  return {version:PHYSICAL_FIRST_SPLIT_VIEWER_ADAPTER_VERSION,
    feed,finishEvidence,coverage:{riderCount:sorted.length,
      paidRiderKilometres:sorted.length*count,
      boundaryFrames:frames.length,
      recordedContactEvents:transitions.filter(row=>
        row.recordedPaidContact).length,
      exactWithinKilometrePositions:false,
      longitudinalInterpolation:'paid-crossing-and-contact-anchors',
      lanePositions:false,canonicalGeography:false,
      officialResults:false,teamKitSource:'game-catalog-test-allocation'}};
}
