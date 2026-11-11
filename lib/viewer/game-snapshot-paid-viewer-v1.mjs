// Experimental bridge from a real game snapshot plus explicitly committed
// tactics and presentation identity. It does not enter the official cycle.
import {buildKilometreRoute} from '../engine/v2/route.mjs';
import {normalizeOrders} from '../engine/v2/orders.mjs';
import {replayRearEnergyCapV1} from
  '../engine/v2/rear-energy-cap-source-v1.mjs';
import {exportPaidMotorRaceToViewerV1} from
  './paid-motor-race-export-v1.mjs';
import {sealPhysicalFirstRaceDocumentV2} from
  './physical-first-race-document-v2.mjs';

export const GAME_SNAPSHOT_PAID_VIEWER_VERSION=
  'game-snapshot-paid-viewer-v1';
const GOALS=new Set(['sprint_finish','summit_attack',
  'break_stage','none']);
const SKILLS=['sprint','flat','hills','mountain','cobbles',
  'timetrial','endurance','strength','wind','leadership',
  'form','fatigue'];

export function prepareGameSnapshotPaidViewerInputV1(
  snapshot,manifest){
  const {event,stage,teams,weather,game_date:gameDate}=snapshot??{};
  const category=event?.gender==='M'?'men':
    event?.gender==='F'?'women':null;
  if(event?.kind!=='one_day'||!event.id||
    typeof event.seed!=='string'||!event.seed||
    !category||!stage||!Array.isArray(teams)||teams.length<2||
    typeof gameDate!=='string'||
    !/^\d{4}-\d{2}-\d{2}$/.test(gameDate)||
    manifest?.version!==GAME_SNAPSHOT_PAID_VIEWER_VERSION||
    Object.keys(manifest).sort().join(',')!==
      'entries,eventId,version'||
    manifest.eventId!==event.id||
    !Array.isArray(manifest.entries)||
    manifest.entries.length!==teams.length||
    new Set(manifest.entries.map(row=>row?.teamId)).size!==teams.length)
    throw new Error('Viewer needs a committed one-day game snapshot and tactics.');
  const raceWeather=weather??event.weather_locked;
  if(!raceWeather)
    throw new Error('Viewer needs locked race weather.');
  const kilometres=buildKilometreRoute(stage,
    {seed:event.seed,weather:raceWeather}).kilometres;
  const byTeam=new Map(manifest.entries.map(row=>[row.teamId,row]));
  const selected=new Set(),riderNumbers={},teamStyles=[],
    paidTeams=[],stakes=[];
  for(const team of teams){
    const explicit=byTeam.get(team?.id);
    const ids=team?.entry?.selected_riders;
    if(!explicit||!Array.isArray(ids)||ids.length!==8||
      Object.keys(explicit).sort().join(',')!==
        'orders,riderNumbers,stake,style,teamId'||
      new Set(ids).size!==8||!ids.includes(team.entry.captain_id)||
      !Array.isArray(team.riders)||
      !explicit.orders?.baseline||
      !['effort','attack','chase','frontWork'].every(key=>
        Object.hasOwn(explicit.orders.baseline,key))||
      !Array.isArray(explicit.orders.helperIds)||
      !explicit.orders.roadCaptainId||
      explicit.orders.captainId!==team.entry.captain_id||
      Object.keys(explicit.stake??{}).sort().join(',')!==
        'sportingCaptainId,sportingGoal'||
      !GOALS.has(explicit.stake?.sportingGoal)||
      !ids.includes(explicit.stake.sportingCaptainId)||
      explicit.style?.id!==team.id||
      !explicit.riderNumbers||
      Object.keys(explicit.riderNumbers).length!==8)
      throw new Error('Viewer needs eight committed riders, orders, stakes, style and bibs per team.');
    const roster=new Map(team.riders.map(rider=>[rider.id,rider]));
    const riders=ids.map(id=>{
      const row=roster.get(id);
      if(!row||selected.has(id)||
        row.gender!==event.gender||
        row.injury_until&&row.injury_until>gameDate||
        typeof (row.display_name??row.name)!=='string'||
        !(row.display_name??row.name).trim()||
        SKILLS.some(key=>typeof row[key]!=='number'||
          !Number.isFinite(row[key])||
          row[key]<0||row[key]>100)||
        !Number.isInteger(explicit.riderNumbers[id])||
        explicit.riderNumbers[id]<1)
        throw new Error('Viewer game snapshot has missing rider identity, ability or bib.');
      selected.add(id);
      riderNumbers[id]=explicit.riderNumbers[id];
      return {...row,name:row.display_name??row.name};
    });
    const orders=normalizeOrders(explicit.orders,
      {riderIds:ids,distanceKm:kilometres.length,
        keypoints:stage.keypoints??[],allowFrontWork:true,
        allowNamedFrontWorker:true});
    paidTeams.push({id:team.id,name:team.name,riders,orders});
    stakes.push({teamId:team.id,
      sportingGoal:explicit.stake.sportingGoal,
      sportingCaptainId:explicit.stake.sportingCaptainId});
    teamStyles.push(explicit.style);
  }
  if(Object.keys(riderNumbers).length!==teams.length*8||
    new Set(Object.values(riderNumbers)).size!==teams.length*8)
    throw new Error('Viewer game snapshot has duplicate race bibs.');
  const start={sourceKm:0,roads:[{roadId:'peloton',
    riderIds:[...selected],clockSeconds:0}],
  riders:paidTeams.flatMap(team=>team.riders.map(rider=>({
    riderId:rider.id,teamId:team.id,roadId:'peloton',
    distanceM:0,clockSeconds:0,
    reserve:replayRearEnergyCapV1({rider,kilometres,
      throughKm:0}).initialCap,quietKm:0})))};
  const input={start,kilometres,teams:paidTeams,stakes,
    raceSeed:event.seed};
  return {input,category,teamStyles,riderNumbers,
    eventId:event.id};
}

export function createGameSnapshotPaidViewerDocumentV1(
  snapshot,manifest){
  const {input,category,teamStyles,riderNumbers,eventId}=
    prepareGameSnapshotPaidViewerInputV1(snapshot,manifest);
  const exported=exportPaidMotorRaceToViewerV1({input,
    raceId:`${eventId}:physical-preview`,category,teamStyles,
    teamKitSource:'committed-game-manifest',
    riderNumbers,riderNumberSource:'committed-game-manifest'});
  return sealPhysicalFirstRaceDocumentV2(exported,
    {category,eventId,
      sourceVersion:GAME_SNAPSHOT_PAID_VIEWER_VERSION,
      officialResults:false});
}
