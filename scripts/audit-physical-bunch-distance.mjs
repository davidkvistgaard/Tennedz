// Read-only full-distance stress audit for the opt-in paid bunch source.
// A refusal is a missing physical branch, never a manufactured finish.
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../lib/engine/v2/skills.mjs';
import {normalizeOrders} from '../lib/engine/v2/orders.mjs';
import {commitTeamChaseStakesV1} from
  '../lib/engine/v2/team-chase-stake-v1.mjs';
import {startPhysicalBunchV1,runPhysicalBunchV1,
  runPhysicalBunchToPaceLossV1} from
  '../lib/engine/v2/physical-start-bunch-v1.mjs';
import {replayPhysicalSingleLossRaceV1,
  validatePhysicalSingleLossRaceV1} from
  '../lib/engine/v2/physical-single-loss-race-replay-v1.mjs';

const route=distanceKm=>Array.from({length:distanceKm},
  (_,index)=>{
    const terrain=['flat','hill','climb','descent'][
      Math.floor(index/10)%4];
    return {km:index+1,terrain,
      gradientPct:terrain==='hill'?3:
        terrain==='climb'?6:terrain==='descent'?-3:0,
      surface:'road',exposed:index%15<5,
      weather:{temperatureC:16,
        windKph:index%15<5?10:0,rainMm:0}};
  });

function source(distanceKm,fatigue,variant){
  const teams=['control','sprint','other'].map(id=>{
    const riders=Array.from({length:8},(_,number)=>({
      id:`${id}-${number}`,form:50,fatigue,
      ...Object.fromEntries(SPORTING_SKILLS.map(skill=>
        [skill,96]))}));
    return {id,riders,
      energy:Object.fromEntries(riders.map(row=>
        [row.id,100-fatigue*.4])),
      orders:{captainId:riders[0].id,
        helperIds:riders.slice(2).map(row=>row.id),
        baseline:{effort:'steady',attack:'none',
          chase:'ignore',
          frontWork:id==='control'?'rotate':'sit_in',
          ...(id==='control'?{
            frontWorkRiderId:'control-2'}:{})},
        phases:[]}};
  });
  if(variant.startsWith('weak_first_worker'))
    for(const skill of SPORTING_SKILLS)
      teams[0].riders[2][skill]=90;
  if(variant==='tired_first_worker')
    teams[0].riders[2].fatigue=40;
  if(variant.startsWith('weak_climber'))
    teams[2].riders[3].mountain=30;
  if(variant==='strong_second_worker')
    for(const skill of SPORTING_SKILLS)
      teams[1].riders[2][skill]=99;
  for(const team of teams)team.energy=Object.fromEntries(
    team.riders.map(row=>[row.id,100-row.fatigue*.4]));
  for(let marker=5;marker<distanceKm;marker+=5){
    const priorTeam=Math.floor((marker-1)/5)%3;
    const nextTeam=Math.floor(marker/5)%3;
    const helper=2+Math.floor(marker/15)%6;
    if(priorTeam!==nextTeam)
      teams[priorTeam].orders.phases.push({
        atKm:marker,frontWork:'sit_in'});
    teams[nextTeam].orders.phases.push({atKm:marker,
      frontWork:'rotate',
      frontWorkRiderId:`${teams[nextTeam].id}-${helper}`});
  }
  if(variant==='weak_first_worker_reserved')
    for(const phase of teams[0].orders.phases)
      if(phase.frontWorkRiderId==='control-2')
        phase.frontWorkRiderId='control-3';
  if(variant==='weak_climber_reserved')
    for(const phase of teams[2].orders.phases)
      if(phase.frontWorkRiderId==='other-3')
        phase.frontWorkRiderId='other-4';
  for(const team of teams)
    team.orders=normalizeOrders(team.orders,{
      riderIds:team.riders.map(row=>row.id),
      distanceKm,allowFrontWork:true,
      allowNamedFrontWorker:true});
  const commitment=commitTeamChaseStakesV1({teams,
    distanceKm,intentions:teams.map(team=>({
      teamId:team.id,baseline:{goal:team.id==='sprint'?
        'sprint_finish':'none',
      captainId:team.riders[0].id},phases:[]}))});
  const startInput={teams,routeKilometres:route(distanceKm),
    commitment,raceSeed:'same-distance-audit-seed'};
  return {startInput,start:startPhysicalBunchV1(startInput)};
}

function audit(distanceKm,fatigue,variant='equal_field'){
  try{
    const input=source(distanceKm,fatigue,variant);
    let lower=0,upper=distanceKm+1;
    while(upper-lower>1){
      const km=Math.floor((lower+upper)/2);
      try{runPhysicalBunchV1({...input,throughKm:km});
        lower=km;}
      catch{upper=km;}
    }
    const last=lower?runPhysicalBunchV1({...input,
      throughKm:lower}):null;
    let firstRefusal=null;
    if(lower<distanceKm){
      try{runPhysicalBunchV1({...input,
        throughKm:lower+1});}
      catch(error){firstRefusal=error.message;}
    }
    let measuredSplit=null;
    let singleLossContinuation=null;
    if(firstRefusal===
      'Physical start follower cannot hold paid pace.'){
      const loss=runPhysicalBunchToPaceLossV1({...input,
        lossKm:lower+1});
      measuredSplit={sourceKm:lower+1,
        riderIds:loss.step.splits.map(row=>row.riderId),
        atDistanceM:loss.step.splits.map(row=>
          +row.atDistanceM.toFixed(1))};
      if(loss.step.splits.length===1){
        try{
          const replay=replayPhysicalSingleLossRaceV1({
            ...input,lossKm:lower+1,
            riderId:loss.step.splits[0].riderId,
            throughKm:distanceKm});
          validatePhysicalSingleLossRaceV1({
            ...input,lossKm:lower+1,
            riderId:loss.step.splits[0].riderId,
            throughKm:distanceKm},replay);
          singleLossContinuation={status:'finished',
            riderKilometres:replay.kilometres.reduce(
              (count,row)=>count+row.riderStates.length,0),
            finishRiders:Object.keys(
              replay.observedFinishSecondsByRider).length,
            soloFinishSeconds:+replay
              .observedFinishSecondsByRider[
                loss.step.splits[0].riderId].toFixed(1)};
        }catch(error){singleLossContinuation={
          status:'refused',reason:error.message};}
      }
    }
    return {distanceKm,fatigue,variant,completedKm:lower,
      status:lower===distanceKm?'finished':'refused',
      firstRefusal,measuredSplit,singleLossContinuation,
      ...(last?{elapsedSeconds:+last.elapsedSeconds.toFixed(1),
        survivingBunchRiders:last.physicalGroup.riderIds.length,
        minEnergy:+Math.min(...Object.values(
          last.energyByRider)).toFixed(2),
        namedLeaders:[...new Set(last.road.map(row=>
          row.leaderRiderId))].length}:{})};
  }catch(error){return {distanceKm,fatigue,variant,
    status:'invalid',
    reason:error.message};}
}

const results=[20,80,160,260].flatMap(distanceKm=>
  [10,20,40].map(fatigue=>audit(distanceKm,fatigue)));
for(const variant of ['weak_first_worker',
  'weak_first_worker_reserved','tired_first_worker',
  'weak_climber','weak_climber_reserved',
  'strong_second_worker'])
  results.push(audit(260,20,variant));
if(process.argv.includes('--assert')){
  assert.equal(results.length,18);
  for(const row of results.slice(0,12)){
    assert.equal(row.status,'finished');
    assert.equal(row.completedKm,row.distanceKm);
    assert.equal(row.survivingBunchRiders,24);
    assert.ok(row.minEnergy>=0);
    assert.ok(row.namedLeaders>=1);
  }
  for(const [variant,lossKm,riderId] of [
    ['weak_first_worker_reserved',6,'control-2'],
    ['weak_climber_reserved',21,'other-3']]){
    const row=results.find(item=>item.variant===variant);
    assert.equal(row.firstRefusal,
      'Physical start follower cannot hold paid pace.');
    assert.equal(row.measuredSplit.sourceKm,lossKm);
    assert.deepEqual(row.measuredSplit.riderIds,[riderId]);
    assert.equal(row.singleLossContinuation.status,'finished');
    assert.equal(row.singleLossContinuation.riderKilometres,6240);
    assert.equal(row.singleLossContinuation.finishRiders,24);
    assert.ok(Number.isFinite(
      row.singleLossContinuation.soloFinishSeconds));
  }
  for(const variant of ['weak_first_worker','weak_climber']){
    const row=results.find(item=>item.variant===variant);
    assert.equal(row.singleLossContinuation.status,'refused');
    assert.equal(row.singleLossContinuation.reason,
      'Ordered front worker is no longer in bunch.');
  }
}
process.stdout.write(JSON.stringify({version:1,
  raceSeed:'same-distance-audit-seed',results},null,2)+'\n');
