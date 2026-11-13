// A deliberately narrow export: one connected, paid road only. Group gaps
// never become invented simultaneous rider positions.
export const PHYSICAL_FIRST_VIEWER_ADAPTER_VERSION=
  'physical-first-to-pelotonia.viewer.v1-1';

export function adaptConnectedPhysicalFirstRaceV1({race,kilometres,
  teams,teamStyles,raceId,category}){
  const totalKm=kilometres?.length;
  const riderIds=teams?.flatMap(team=>team.riders.map(rider=>rider.id));
  if(!Number.isInteger(totalKm)||totalKm<1||
    race?.completedThroughKm!==totalKm||
    race?.states?.length!==totalKm+1||
    race?.steps?.length!==totalKm||
    !Array.isArray(riderIds)||!riderIds.length||
    !['men','women'].includes(category)||
    typeof raceId!=='string'||!raceId||
    !Array.isArray(teamStyles)||teamStyles.length!==teams.length)
    throw new Error('Viewer adapter needs a completed paid race and explicit display identity.');
  const sorted=[...riderIds].sort();
  if(new Set(sorted).size!==sorted.length||
    teamStyles.some((style,index)=>style.id!==teams[index].id||
      !/^#[0-9a-fA-F]{6}$/.test(style.color)||
      !/^#[0-9a-fA-F]{6}$/.test(style.accent)))
    throw new Error('Viewer adapter needs distinct riders and resolved team styles.');
  const frames=race.states.map((state,index)=>{
    const road=state.roads?.[0];
    const clock=road?.clockSeconds;
    if(state.sourceKm!==index||state.roads?.length!==1||
      road.roadId!=='peloton'||
      road.riderIds.length!==sorted.length||
      JSON.stringify([...road.riderIds].sort())!==JSON.stringify(sorted)||
      !Number.isFinite(clock)||
      (index===0?clock!==0:clock<=race.states[index-1]
        .roads[0].clockSeconds)||
      state.riders?.length!==sorted.length||
      state.riders.some(row=>row.roadId!=='peloton'||
        row.distanceM!==index*1000||
        Math.abs(row.clockSeconds-clock)>.002))
      throw new Error('Viewer adapter lacks common-time paid positions for a split road.');
    return {time:clock,groupRoles:{peloton:'peloton'},
      positions:sorted.map(riderId=>({riderId,
        distance:index*1000,lateral:0,groupId:'peloton'}))};
  });
  if(race.steps.some((step,index)=>{
    const road=step.peloton?.road;
    return step.attackSteps?.length||step.otherSteps?.length||
      step.withinKmContactEvents?.length||
      step.boundaryContactEvents?.length||
      step.peloton?.startDropEvents?.length||
      road?.riderIds?.length!==sorted.length||
      road.startDistanceM!==index*1000||
      road.endDistanceM!==(index+1)*1000||
      Math.abs(road.startClockSeconds-frames[index].time)>.002||
      Math.abs(road.finishClockSeconds-frames[index+1].time)>.002;
  }))throw new Error('Viewer adapter needs a continuous connected paid road.');
  const profile=[[0,kilometres[0].startM],
    ...kilometres.map((segment,index)=>{
      if(segment.km!==index+1||
        !Number.isFinite(segment.startM)||
        !Number.isFinite(segment.endM))
        throw new Error('Viewer adapter needs the recorded route profile.');
      return [(index+1)*1000,segment.endM];
    })];
  const duration=frames.at(-1).time;
  const feed={schemaVersion:'pelotonia.viewer.v1',
    raceId,title:'Motor Lab physical race preview',
    riderCategory:category,duration,
    route:{label:'Schematic distance axis — geography unavailable',
      points:[[0,0,0],[0,0,totalKm*1000]],
      distanceStations:[0,totalKm*1000],
      interpolation:'polyline',width:6,
      profile:{schemaVersion:'pelotonia.route-profile.v1',
        samples:profile}},
    teams:teamStyles,
    riders:teams.flatMap(team=>team.riders.map((rider,index)=>({
      id:rider.id,name:rider.name,number:index+1,
      teamId:team.id}))),
    frames,events:[{time:0,label:'The paid race begins.'},
      ...race.steps.map((step,index)=>({
        time:frames[index+1].time,
        label:`${step.peloton.road.leaderRiderId} leads kilometre ${index+1}.`,
        riderId:step.peloton.road.leaderRiderId})),
      {time:duration,label:'All recorded riders reach the finish.'}]};
  return {version:PHYSICAL_FIRST_VIEWER_ADAPTER_VERSION,
    feed,coverage:{riderCount:sorted.length,
      paidRiderKilometres:sorted.length*totalKm,
      boundaryFrames:frames.length,
      exactWithinKilometrePositions:false,
      lanePositions:false,canonicalGeography:false,
      officialResults:false,teamKitSource:'game-catalog-test-allocation'}};
}
