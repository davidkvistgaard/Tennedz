// Experimental display projection of a replayed positional motor record.
// The route is a schematic distance axis; no geography or result is made up.
import {validateFeed} from '@pelotonia/race-viewer/data';
import {replayPhysicalFirstPositionGeneralRaceV7,
  replayPhysicalFirstPositionGeneralRaceV8,
  PHYSICAL_FIRST_POSITION_GENERAL_RACE_V7_VERSION,
  PHYSICAL_FIRST_POSITION_GENERAL_RACE_V8_VERSION} from
  '../engine/v2/physical-first-position-general-race-v1.mjs';

export const PHYSICAL_FIRST_POSITION_VIEWER_ADAPTER_VERSION=
  'physical-first-position-to-pelotonia.viewer.v1-1';
export const PHYSICAL_FIRST_POSITION_VIEWER_ADAPTER_V2_VERSION=
  'physical-first-position-to-pelotonia.viewer.v1-2';
export const PHYSICAL_FIRST_POSITION_VIEWER_ADAPTER_V3_VERSION=
  'physical-first-position-to-pelotonia.viewer.v1-3';
const EPS=1e-6;
const V3_TARGET_FINALE_FRAMES=160;
export const PHYSICAL_FIRST_POSITION_VIEWER_V3_MAX_FEED_BYTES=
  3_500_000;
export const PHYSICAL_FIRST_POSITION_VIEWER_V3_SAMPLE_POLICY=
  'recorded-finish-milestones-uniform-v2';

const selectRecordedFrames=(rows,limit)=>{
  if(rows.length<=limit)return rows;
  return Array.from({length:limit},(_,index)=>
    rows[Math.round(index*(rows.length-1)/(limit-1))]);
};
const finishMilestoneFrames=(rows,finishCrossings)=>{
  if(!rows.length)throw new Error(
    'Position viewer export lacks recorded finale frames.');
  const mandatory=new Set([rows[0],rows.at(-1)]);
  for(const crossing of finishCrossings){
    let low=0,high=rows.length-1;
    while(low<high){
      const middle=Math.floor((low+high)/2);
      if(rows[middle].clockSeconds>=
        crossing.clockSeconds)high=middle;
      else low=middle+1;
    }
    if(rows[low].clockSeconds<crossing.clockSeconds)
      throw new Error(
        'Position viewer export lacks a finish milestone.');
    mandatory.add(rows[low]);
  }
  return mandatory;
};

const rolesFor=positions=>{
  const active=positions.filter(row=>
    row.roadId!=='finished');
  const byRoad=Object.groupBy(active,row=>
    row.roadId);
  const pelotonFront=Math.max(-Infinity,
    ...(byRoad.peloton??[]).map(row=>
      row.distanceM));
  const raceFront=Math.max(-Infinity,
    ...active.map(row=>row.distanceM));
  return Object.fromEntries(Object.entries(byRoad)
    .map(([roadId,riders])=>{
      if(roadId==='peloton')
        return [roadId,'peloton'];
      const front=Math.max(...riders.map(row=>
        row.distanceM));
      return [roadId,
        front>=raceFront-EPS?'leaders':
          front>pelotonFront+EPS?'chase':
            'dropped'];
    }));
};

const frameFrom=(time,rows)=>({time,
  groupRoles:rolesFor(rows),
  positions:rows.map(row=>({
    riderId:row.riderId,
    distance:row.distanceM,
    lateral:0,
    groupId:row.roadId})).sort((a,b)=>
    a.riderId.localeCompare(b.riderId))});

const eventFrom=(row,type,label,riderId)=>{
  const time=row.observedAtClockSeconds??
    row.atClockSeconds;
  if(!Number.isFinite(time))
    throw new Error(
      'Position viewer event lacks a recorded clock.');
  return {time,type,label,
    ...(riderId?{riderId}:{})};
};

function adaptPositionRace({
  request,race,raceId,category,teamStyles,
  riderNumbers,
  teamKitSource='committed-team-style',
  riderNumberSource='committed-race-bib'},
  {version,synthetic,title,fixtureKind=null,
    boundedFinale=false}){
  const input=request?.input;
  const route=input?.kilometres;
  const teams=input?.teams;
  const riderIds=teams?.flatMap(team=>
    team.riders.map(rider=>rider.id));
  const totalDistanceM=route?.length*1000;
  if(![PHYSICAL_FIRST_POSITION_GENERAL_RACE_V7_VERSION,
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V8_VERSION]
    .includes(race?.version)||
    race.completedThroughKm!==route?.length||
    !['men','women'].includes(category)||
    typeof raceId!=='string'||!raceId.trim()||
    !Array.isArray(riderIds)||!riderIds.length||
    new Set(riderIds).size!==riderIds.length||
    teamStyles?.length!==teams.length||
    teamStyles.some((style,index)=>
      style.id!==teams[index].id)||
    !riderNumbers||typeof riderNumbers!=='object'||
    Object.keys(riderNumbers).length!==riderIds.length||
    riderIds.some(id=>
      !Number.isInteger(riderNumbers[id])||
      riderNumbers[id]<1)||
    new Set(Object.values(riderNumbers)).size!==
      riderIds.length||
    teams.some(team=>team.riders.some(rider=>
      typeof rider.name!=='string'||
      !rider.name.trim()||
      rider.gender&&rider.gender!==
        (category==='men'?'M':'F')))||
    typeof teamKitSource!=='string'||
    !teamKitSource.trim()||
    typeof riderNumberSource!=='string'||
    !riderNumberSource.trim())
    throw new Error(
      'Position viewer export needs a committed, complete field.');
  (race.version===
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V8_VERSION?
    replayPhysicalFirstPositionGeneralRaceV8:
    replayPhysicalFirstPositionGeneralRaceV7)(request,race);
  const routeProfile=[[0,route[0].startM],
    ...route.map((segment,index)=>{
      if(segment.km!==index+1||
        !Number.isFinite(segment.startM)||
        !Number.isFinite(segment.endM))
        throw new Error(
          'Position viewer export lacks a recorded route profile.');
      return [(index+1)*1000,segment.endM];
    })];
  const boundaryFrames=[frameFrom(0,race.start.positions),
    ...race.steps.map(step=>frameFrom(
      step.sharedRoad.clockSeconds,
      step.sharedRoad.positions))];
  const recordedFinale=race.tail.positionFrames.slice(1);
  const mandatoryFinale=boundedFinale?
    finishMilestoneFrames(recordedFinale,
      race.finishCrossings):null;
  let optionalFinale=boundedFinale?
    selectRecordedFrames(recordedFinale,
      V3_TARGET_FINALE_FRAMES)
      .filter(row=>!mandatoryFinale.has(row)):[];
  const selectedRows=()=>boundedFinale?
    [...mandatoryFinale,...optionalFinale]
      .sort((a,b)=>a.clockSeconds-b.clockSeconds):
    recordedFinale;
  let selectedFinale=selectedRows();
  let frames=[...boundaryFrames,
    ...selectedFinale.map(row=>frameFrom(
      row.clockSeconds,row.positions))];
  const duration=race.tail.lastClockSeconds;
  if(frames.at(-1)?.time!==duration||
    frames.some((frame,index)=>
      frame.positions.length!==riderIds.length||
      index>0&&frame.time<=frames[index-1].time))
    throw new Error(
      'Position viewer export lacks a single recorded clock.');
  const firstSprintPass=new Map();
  for(const event of race.finaleSprintPassEvents)
    if(!firstSprintPass.has(event.riderId))
      firstSprintPass.set(event.riderId,event);
  const events=[{time:0,
    type:'race_start',
    label:'The recorded race begins.'},
    ...race.attackDepartureEvents.map(event=>
      eventFrom(event,'paid_attack_departure',
        'A rider makes a paid attack departure.',
        event.toRiderId)),
    ...race.frontPassEvents.map(event=>
      eventFrom(event,'paid_front_pass',
        'A rider pays to reach the front.',
        event.toRiderId)),
    ...race.soloCatchEvents.map(event=>
      eventFrom(event,'paid_solo_contact',
        'A rider meets the peloton on the paid road.',
        event.riderId)),
    ...[...firstSprintPass.values()].map(event=>
      eventFrom(event,'paid_sprint_pass',
        'A rider makes a paid sprint pass.',
        event.riderId)),
    {time:duration,type:'all_finished',
      label:'All recorded riders reach the finish.'}]
    .sort((a,b)=>a.time-b.time||
      a.type.localeCompare(b.type));
  if(events.some(event=>
    event.time<0||event.time>duration+EPS))
    throw new Error(
      'Position viewer event falls outside the paid race.');
  const feed={schemaVersion:'pelotonia.viewer.v1',
    raceId,title,synthetic,
    riderCategory:category,duration,
    route:{label:
      'Schematic distance axis — geography unavailable',
    points:[[0,0,0],[0,0,totalDistanceM]],
    distanceStations:[0,totalDistanceM],
    interpolation:'polyline',width:6,
    profile:{schemaVersion:
      'pelotonia.route-profile.v1',
    samples:routeProfile}},
    teams:teamStyles,
    riders:teams.flatMap(team=>
      team.riders.map(rider=>({
        id:rider.id,name:rider.name,
        number:riderNumbers[rider.id],
        teamId:team.id}))),
    frames,events};
  if(boundedFinale){
    while(Buffer.byteLength(JSON.stringify(feed))>
      PHYSICAL_FIRST_POSITION_VIEWER_V3_MAX_FEED_BYTES&&
      optionalFinale.length){
      optionalFinale=optionalFinale.filter((_,index)=>
        index%2===0).slice(0,
        Math.floor(optionalFinale.length/2));
      selectedFinale=selectedRows();
      frames=[...boundaryFrames,
        ...selectedFinale.map(row=>frameFrom(
          row.clockSeconds,row.positions))];
      feed.frames=frames;
    }
    if(Buffer.byteLength(JSON.stringify(feed))>
      PHYSICAL_FIRST_POSITION_VIEWER_V3_MAX_FEED_BYTES)
      throw new Error(
        'Position viewer feed exceeds the V3 transport budget.');
  }
  validateFeed(feed);
  return {version,
  feed,
  finishEvidence:{
    version:'physical-first-position-finish-evidence-1',
    publishedAt:duration,
    entries:race.finishCrossings,
    unresolvedModelClockTies:
      race.finaleFinishTieObservations},
  coverage:{riderCount:riderIds.length,
    paidRiderKilometres:race.decisionCount,
    recordedBoundaryFrames:race.steps.length+1,
    recordedFinaleFrames:
      race.tail.positionFrames.length,
    renderedFrames:frames.length,
    ...(boundedFinale?{
      renderedFinaleFrames:selectedFinale.length,
      finaleSamplePolicy:
        PHYSICAL_FIRST_POSITION_VIEWER_V3_SAMPLE_POLICY,
      viewerFeedBytes:Buffer.byteLength(
        JSON.stringify(feed))}:{}),
    exactFinalePositionSamples:
      selectedFinale.length===recordedFinale.length,
    exactBetweenKilometrePositions:false,
    metricLateralCoordinates:false,
    canonicalGeography:false,
    officialResults:false,
    teamKitSource,riderNumberSource,
    ...(fixtureKind?{fixtureKind}:{})},
  source:{version:race.version,
    raceSeed:race.raceSeed,
    inputHash:race.inputHash,
    replayed:true,
    ...(fixtureKind?{fixtureKind}:{})}};
}

export function adaptPhysicalFirstPositionRaceV1(args){
  return adaptPositionRace(args,{
    version:PHYSICAL_FIRST_POSITION_VIEWER_ADAPTER_VERSION,
    synthetic:true,
    title:'Synthetic Motor Lab position preview'});
}

export function adaptPhysicalFirstPositionRaceV2(args){
  const fixtureKind=args?.fixtureKind;
  if(!['synthetic_motor_lab',
    'committed_game_snapshot'].includes(fixtureKind))
    throw new Error('Position viewer needs declared source kind.');
  return adaptPositionRace(args,{
    version:PHYSICAL_FIRST_POSITION_VIEWER_ADAPTER_V2_VERSION,
    fixtureKind,
    synthetic:fixtureKind==='synthetic_motor_lab',
    title:fixtureKind==='synthetic_motor_lab'?
      'Synthetic Motor Lab position preview':
      'Experimental game race position preview'});
}

export function adaptPhysicalFirstPositionRaceV3(args){
  const fixtureKind=args?.fixtureKind;
  if(!['synthetic_motor_lab',
    'committed_game_snapshot'].includes(fixtureKind))
    throw new Error('Position viewer needs declared source kind.');
  return adaptPositionRace(args,{
    version:PHYSICAL_FIRST_POSITION_VIEWER_ADAPTER_V3_VERSION,
    fixtureKind,boundedFinale:true,
    synthetic:fixtureKind==='synthetic_motor_lab',
    title:fixtureKind==='synthetic_motor_lab'?
      'Synthetic Motor Lab position preview':
      'Experimental game race position preview'});
}
