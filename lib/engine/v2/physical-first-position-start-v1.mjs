// An opt-in start state for a future motor-owned position trace. Existing
// group-clock recordings have no wheels and cannot acquire these positions.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {planPhysicalFirstPelotonLeaderV1} from
  './physical-first-leader-plan-v1.mjs';
import {sportingSkills} from './physiology.mjs';

export const PHYSICAL_FIRST_POSITION_START_VERSION=
  'physical-first-position-start-1';

const seededOrder=(seed,id)=>parseInt(createHash('sha256')
  .update(`${seed}:position-start:${id}`).digest('hex').slice(0,13),16)/
  0x10000000000000;
const canonical=value=>Array.isArray(value)?value.map(canonical):
  value&&typeof value==='object'?
    Object.fromEntries(Object.keys(value).sort().map(key=>
      [key,canonical(value[key])])):value;

export function createPhysicalFirstPositionStartV1({input,grid}){
  const {start,kilometres,teams,stakes,raceSeed,
    emergencyFrontWorkers=[]}=input??{};
  const {laneCount,wheelSpacingM,laneStaggerM}=grid??{};
  const startIds=start?.roads?.length===1&&
    start.roads[0].roadId==='peloton'?
    start.roads[0].riderIds:null;
  const roster=teams?.flatMap(team=>team.riders?.map(rider=>({
    rider,teamId:team.id}))??[]);
  if(input?.positionModelVersion!==
      PHYSICAL_FIRST_POSITION_START_VERSION||
    start?.sourceKm!==0||
    !Array.isArray(startIds)||!startIds.length||
    start.roads[0].clockSeconds!==0||
    !Array.isArray(start?.riders)||
    start.riders.length!==startIds.length||
    !Array.isArray(roster)||roster.length!==startIds.length||
    new Set(startIds).size!==startIds.length||
    new Set(roster.map(row=>row.rider.id)).size!==roster.length||
    roster.some(row=>!startIds.includes(row.rider.id))||
    start.riders.some(row=>!startIds.includes(row.riderId)||
      !roster.some(source=>source.rider.id===row.riderId&&
        source.teamId===row.teamId)||
      row.distanceM!==0||row.clockSeconds!==0||
      row.roadId!=='peloton'||
      !Number.isFinite(row.reserve)||row.reserve<0||
      row.quietKm!==0)||
    !Array.isArray(kilometres)||kilometres[0]?.km!==1||
    !Array.isArray(stakes)||
    typeof raceSeed!=='string'||!raceSeed||
    Object.keys(grid??{}).sort().join(',')!==
      'laneCount,laneStaggerM,wheelSpacingM'||
    !Number.isInteger(laneCount)||laneCount<2||laneCount>8||
    !Number.isFinite(wheelSpacingM)||wheelSpacingM<1||
    !Number.isFinite(laneStaggerM)||laneStaggerM<0||
    laneStaggerM>=wheelSpacingM/laneCount)
    throw new Error('Position start needs a committed field and grid.');
  const leaderPlan=planPhysicalFirstPelotonLeaderV1({
    prior:start,segment:kilometres[0],teams,stakes,
    emergencyFrontWorkers});
  const byId=new Map(roster.map(row=>[row.rider.id,row]));
  const startStates=new Map(start.riders.map(row=>
    [row.riderId,row]));
  const ordered=startIds.map(riderId=>({riderId,
    teamId:byId.get(riderId).teamId,
    positioningAbility:sportingSkills(byId.get(riderId).rider)
      .positioning,
    seededTie:seededOrder(raceSeed,riderId)}))
    .sort((a,b)=>
      Number(b.riderId===leaderPlan.leaderRiderId)-
        Number(a.riderId===leaderPlan.leaderRiderId)||
      b.positioningAbility-a.positioningAbility||
      b.seededTie-a.seededTie||
      a.riderId.localeCompare(b.riderId));
  const positions=ordered.map((row,index)=>{
    const lane=index%laneCount,rowIndex=Math.floor(index/laneCount);
    return {riderId:row.riderId,teamId:row.teamId,
      roadId:'peloton',lane,row:rowIndex,
      distanceM:index===0?0:
        -rowIndex*wheelSpacingM-lane*laneStaggerM,
      paidDistanceM:0,
      energy:startStates.get(row.riderId).reserve,
      quietKm:startStates.get(row.riderId).quietKm,
      positioningAbility:row.positioningAbility,
      seededTie:row.seededTie};
  });
  const inputHash=createHash('sha256').update(JSON.stringify(canonical({
    start,kilometres,teams,stakes,raceSeed,emergencyFrontWorkers,
    positionModelVersion:input.positionModelVersion,grid}))).digest('hex');
  return {version:PHYSICAL_FIRST_POSITION_START_VERSION,
    inputHash,raceSeed,sourceKm:0,clockSeconds:0,
    startLineDistanceM:0,grid:{...grid},
    firstLeaderPlan:leaderPlan,positions,
    legacyGroupClockPositionsUsed:false,officialResults:false};
}

export function replayPhysicalFirstPositionStartV1(input,grid,recorded){
  if(!isDeepStrictEqual(recorded,
    createPhysicalFirstPositionStartV1({input,grid})))
    throw new Error('Position start differs from committed inputs.');
  return recorded;
}
