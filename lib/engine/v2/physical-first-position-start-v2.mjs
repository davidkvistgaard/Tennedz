// Opt-in start. The ordered front team's payable reserve worker is staged
// in the first row at the exposed edge before racing.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createPhysicalFirstPositionStartV1,
  PHYSICAL_FIRST_POSITION_START_VERSION} from
  './physical-first-position-start-v1.mjs';
import {planPhysicalFirstPelotonLeaderV1} from
  './physical-first-leader-plan-v1.mjs';
import {orderAt} from './orders.mjs';

export const PHYSICAL_FIRST_POSITION_START_V2_VERSION=
  'physical-first-position-start-2';

export function createPhysicalFirstPositionStartV2({input,grid}){
  if(input?.positionModelVersion!==
    PHYSICAL_FIRST_POSITION_START_V2_VERSION||
    !Number.isInteger(grid?.laneCount)||
    grid.laneCount<2||grid.laneCount>8)
    throw new Error('Position start v2 needs a committed road grid.');
  const occupiedLaneCount=grid.laneCount;
  const legacyInput={...input,
    positionModelVersion:PHYSICAL_FIRST_POSITION_START_VERSION};
  const seedStart=createPhysicalFirstPositionStartV1({
    input:legacyInput,grid});
  const firstLeader=seedStart.positions[0].riderId;
  const byId=new Map(seedStart.positions.map(row=>[
    row.riderId,row]));
  let backupRiderId=null;
  const backupPrior={...input.start,
    roads:input.start.roads.map(road=>({
      ...road,riderIds:road.riderIds.filter(id=>
        id!==firstLeader)}))};
  if(seedStart.positions.length>1){
    try{
      backupRiderId=planPhysicalFirstPelotonLeaderV1({
        prior:backupPrior,segment:input.kilometres[0],
        teams:input.teams,stakes:input.stakes,
        emergencyFrontWorkers:input.emergencyFrontWorkers??[]})
        .leaderRiderId;
    }catch(error){
      if(error.message!=='No ordered payable bunch leader.'&&
        error.message!=='Named front worker cannot pay the road.')
        throw error;
    }
  }
  const attackCandidates=input.teams.flatMap(team=>{
    const stake=input.stakes.find(row=>
      row.teamId===team.id);
    const firstAttack=[orderAt(team.orders,0),
      ...(team.orders.phases??[])
        .filter(phase=>phase.atKm<
          input.kilometres.length)
        .map(phase=>orderAt(team.orders,
          phase.atKm))]
      .find(order=>order.attack!=='none');
    if(!['break_stage','summit_attack'].includes(
      stake?.sportingGoal)||!firstAttack)return [];
    const candidate=firstAttack.attackRiderId??
      stake.sportingCaptainId;
    return candidate!==firstLeader&&byId.has(candidate)?
      [byId.get(candidate)]:[];
  }).sort((a,b)=>
    b.positioningAbility-a.positioningAbility||
    b.seededTie-a.seededTie||
    a.riderId.localeCompare(b.riderId));
  const stagedAttackRiderId=occupiedLaneCount>=3?
    attackCandidates[0]?.riderId??null:null;
  const ordered=seedStart.positions.slice();
  for(const stagedId of new Set([
    backupRiderId,stagedAttackRiderId].filter(Boolean))){
    const index=ordered.findIndex(row=>
      row.riderId===stagedId);
    if(index<1)throw new Error('Staged rider is not in the field.');
    ordered.splice(index,1);
  }
  if(stagedAttackRiderId)ordered.splice(
    occupiedLaneCount-2,0,
    byId.get(stagedAttackRiderId));
  if(backupRiderId&&
    backupRiderId!==stagedAttackRiderId)
    ordered.splice(occupiedLaneCount-1,0,
      byId.get(backupRiderId));
  const positions=ordered.map((row,index)=>{
    const lane=index%occupiedLaneCount;
    const rowIndex=Math.floor(index/occupiedLaneCount);
    return {...row,lane,row:rowIndex,
      distanceM:index===0?0:
        -rowIndex*grid.wheelSpacingM-
        lane*grid.laneStaggerM};
  });
  const inputHash=createHash('sha256')
    .update(JSON.stringify({version:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION,
    seedHash:seedStart.inputHash,
    grid:{laneCount:grid.laneCount,
      wheelSpacingM:grid.wheelSpacingM,
      laneStaggerM:grid.laneStaggerM}}))
    .digest('hex');
  return {version:PHYSICAL_FIRST_POSITION_START_V2_VERSION,
    sourceStartVersion:PHYSICAL_FIRST_POSITION_START_VERSION,
    inputHash,raceSeed:input.raceSeed,sourceKm:0,
    clockSeconds:0,startLineDistanceM:0,
    grid:{...grid},occupiedLaneCount,
    firstLeaderPlan:seedStart.firstLeaderPlan,
    stagedBackupRiderId:backupRiderId,
    stagedAttackRiderId,
    positions,legacyGroupClockPositionsUsed:false,
    officialResults:false};
}

export function replayPhysicalFirstPositionStartV2(input,grid,
  recorded){
  if(!isDeepStrictEqual(recorded,
    createPhysicalFirstPositionStartV2({input,grid})))
    throw new Error('Position start v2 differs from committed inputs.');
  return recorded;
}
