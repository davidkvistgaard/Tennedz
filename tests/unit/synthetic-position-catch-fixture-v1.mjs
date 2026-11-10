// Deliberately synthetic mechanics fixture. It is not canonical race data.
import {replayRearEnergyCapV1} from
  '../../lib/engine/v2/rear-energy-cap-source-v1.mjs';
import {PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../../lib/engine/v2/physical-first-position-start-v2.mjs';

export const SYNTHETIC_POSITION_CATCH_GRID_V1={
  laneCount:4,wheelSpacingM:2.5,
  laneStaggerM:.08};

const rider=id=>({id,flat:65,hills:65,
  mountain:65,sprint:65,
  endurance:65,form:50,fatigue:0});

export function prepareSyntheticPositionCatchV1({
  teamCount=2,kmCount=4,
  profile='hill',oneTimeAttack=false,
  weakBunchCount=0,
  secondAttackAtKm=null,
  secondAttackRiderIndex=1,
  frontWorkerAtKm=null,
  raceSeed='position-seed-a'}={}){
  if(!Number.isInteger(teamCount)||
    teamCount<2||teamCount>20||
    !Number.isInteger(kmCount)||
    kmCount<4||kmCount>120||
    !['hill','alternating',
      'hill_then_mountain'].includes(profile)||
    typeof oneTimeAttack!=='boolean'||
    !Number.isInteger(weakBunchCount)||
    weakBunchCount<0||weakBunchCount>2||
    secondAttackAtKm!==null&&
      (!Number.isInteger(secondAttackAtKm)||
        secondAttackAtKm<4||
        secondAttackAtKm>=kmCount-1)||
    !Number.isInteger(secondAttackRiderIndex)||
    ![1,2,3,4,5,6,8]
      .includes(secondAttackRiderIndex)||
    secondAttackAtKm===null&&
      secondAttackRiderIndex!==1||
    frontWorkerAtKm!==null&&
      (!Number.isInteger(frontWorkerAtKm)||
        frontWorkerAtKm<2||
        frontWorkerAtKm>=kmCount))
    throw new Error('Synthetic catch fixture has invalid options.');
  const teams=Array.from({length:teamCount},
    (_,teamIndex)=>{
      const id=`team-${teamIndex}`;
      const riders=Array.from({length:8},
        (_,index)=>rider(`${id}-${index+1}`));
      return {id,riders,
        orders:{captainId:riders[6].id,
          helperIds:riders.filter((_,index)=>
            index!==6).map(row=>row.id),
          baseline:{effort:'steady',
            chase:'selective',
            ...(weakBunchCount||
              secondAttackAtKm!==null?{
              breakWork:'cooperate'}:{}),
            attack:teamIndex===0?
              'selective':'none',
            ...(teamIndex===0?{
              attackRiderId:'team-0-7'}:{}),
            frontWork:teamIndex===0?
              'rotate':'sit_in',
            frontWorkRiderId:teamIndex===0?
              riders[1].id:null},
          phases:[]}};
    });
  Object.assign(teams[0].riders[6],{
    flat:85,hills:0,sprint:85,
    acceleration:100,positioning:100});
  const weakTeam=teams[Math.min(2,teamCount-1)];
  for(let index=0;index<weakBunchCount;index++)
    weakTeam.riders[3+index].hills=0;
  if(oneTimeAttack)
    teams[0].orders.phases.push({
      atKm:1,attack:'none'});
  if(secondAttackAtKm!==null){
    const secondAttackerId=
      `team-0-${secondAttackRiderIndex}`;
    Object.assign(teams[0].riders[
      secondAttackRiderIndex-1],{
      hills:100,mountain:0,
      acceleration:100});
    teams[0].orders.phases.push({
      atKm:secondAttackAtKm-1,
      attack:'selective',
      attackRiderId:secondAttackerId});
    teams[0].orders.phases.push({
      atKm:secondAttackAtKm,
      attack:'none'});
  }
  if(frontWorkerAtKm!==null){
    teams[0].orders.phases.push({
      atKm:frontWorkerAtKm,
      frontWork:'sit_in',
      frontWorkRiderId:null});
    teams[1].orders.phases.push({
      atKm:frontWorkerAtKm,
      frontWork:'rotate',
      frontWorkRiderId:'team-1-2'});
    Object.assign(teams[1].riders[1],{
      hills:90,acceleration:100,
      positioning:100});
  }
  const kilometres=Array.from({length:kmCount},
    (_,index)=>{
      const km=index+1;
      const mountain=profile===
        'hill_then_mountain'&&km>5;
      const hill=km>1&&!mountain&&(
        profile==='hill'||km<=8||
        Math.floor(km/10)%2===1);
      return {km,
        terrain:mountain?'climb':
          hill?'hill':'flat',
        gradientPct:mountain?6.5:
          hill?3.75:0,
        surface:'road',exposed:false,
        weather:{temperatureC:16,windKph:0,
          rainMm:0}};
    });
  const startRiders=teams.flatMap(team=>
    team.riders.map(source=>({
      riderId:source.id,teamId:team.id,
      roadId:'peloton',distanceM:0,
      clockSeconds:0,
      reserve:replayRearEnergyCapV1({
        rider:source,kilometres,
        throughKm:0}).initialCap,
      quietKm:0})));
  const input={raceSeed,
    positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION,
    start:{sourceKm:0,
      roads:[{roadId:'peloton',
        riderIds:startRiders.map(row=>
          row.riderId),clockSeconds:0}],
      riders:startRiders},
    kilometres,teams,
    stakes:teams.map(team=>({
      teamId:team.id,
      sportingGoal:'break_stage',
      sportingCaptainId:
        team.orders.captainId}))};
  return {input,
    grid:{...SYNTHETIC_POSITION_CATCH_GRID_V1}};
}
