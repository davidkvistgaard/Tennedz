// Read-only 20-team stress audit of the isolated paid physical source.
// A refusal marks a missing branch, never an inferred wheel or finish.
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
import {completePhysicalPaceLossKmV1} from
  '../lib/engine/v2/physical-pace-loss-completion-v1.mjs';
import {contactPhysicalSimultaneousLossV1,
  validatePhysicalSimultaneousLossContactV1} from
  '../lib/engine/v2/physical-simultaneous-loss-contact-v1.mjs';
import {replayPhysicalSimultaneousRearGroupV1,
  validatePhysicalSimultaneousRearGroupV1} from
  '../lib/engine/v2/physical-simultaneous-rear-group-v1.mjs';

const fieldSize=20;
const ridersPerTeam=8;
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
  const teams=Array.from({length:fieldSize},(_,number)=>{
    const id=`team-${number}`;
    const riders=Array.from({length:ridersPerTeam},
      (_,riderNumber)=>({
        id:`${id}-${riderNumber}`,form:50,fatigue,
        ...Object.fromEntries(SPORTING_SKILLS.map(
          skill=>[skill,96]))}));
    return {id,riders,
      energy:Object.fromEntries(riders.map(row=>[
        row.id,100-fatigue*.4])),
      orders:{captainId:riders[0].id,
        helperIds:riders.slice(2).map(row=>row.id),
        baseline:{effort:'steady',attack:'none',
          chase:'ignore',frontWork:number===0?
            'rotate':'sit_in',
          ...(number===0?{
            frontWorkRiderId:`${id}-2`}:{})},
        phases:[]}};
  });
  if(variant==='one_weak_climber')
    teams[19].riders[7].mountain=30;
  if(variant==='many_weak_climbers'||
    variant==='unequal_weak_climbers')
    for(const team of teams)team.riders[7].mountain=30;
  if(variant==='unequal_weak_climbers')
    teams[19].riders[7].mountain=35;
  for(let marker=5;marker<distanceKm;marker+=5){
    const priorTeam=Math.floor((marker-1)/5)%fieldSize;
    const nextTeam=Math.floor(marker/5)%fieldSize;
    if(priorTeam!==nextTeam)
      teams[priorTeam].orders.phases.push({
        atKm:marker,frontWork:'sit_in'});
    teams[nextTeam].orders.phases.push({
      atKm:marker,frontWork:'rotate',
      frontWorkRiderId:`team-${nextTeam}-2`});
  }
  for(const team of teams)
    team.orders=normalizeOrders(team.orders,{
      riderIds:team.riders.map(row=>row.id),
      distanceKm,allowFrontWork:true,
      allowNamedFrontWorker:true});
  const commitment=commitTeamChaseStakesV1({teams,
    distanceKm,intentions:teams.map((team,index)=>({
      teamId:team.id,baseline:{goal:index===0?
        'sprint_finish':'none',
      captainId:team.riders[0].id},phases:[]}))});
  const startInput={teams,routeKilometres:route(distanceKm),
    commitment,raceSeed:'physical-20-team-scale-1'};
  return {startInput,start:startPhysicalBunchV1(startInput)};
}

function audit(distanceKm,fatigue,variant){
  const input=source(distanceKm,fatigue,variant);
  let run;
  try{run=runPhysicalBunchV1({...input,throughKm:distanceKm});}
  catch(error){
    let lower=0;
    let upper=distanceKm;
    while(upper-lower>1){
      const km=Math.floor((lower+upper)/2);
      try{runPhysicalBunchV1({...input,throughKm:km});
        lower=km;}
      catch{upper=km;}
    }
    const lossKm=upper;
    if(error.message!==
      'Physical start follower cannot hold paid pace.')
      return {distanceKm,fatigue,variant,
        status:'refused',sourceKm:lossKm,
        reason:error.message};
    const loss=runPhysicalBunchToPaceLossV1({
      ...input,lossKm});
    const splitIds=loss.step.splits.map(row=>row.riderId);
    const completions=splitIds.map(riderId=>
      completePhysicalPaceLossKmV1({
        ...input,lossKm,loss,riderId}));
    const soloClockSpread=Math.max(...completions.map(
      row=>row.elapsedSeconds))-Math.min(
      ...completions.map(row=>row.elapsedSeconds));
    let continuation=null;
    let paidRearContact=null;
    if(splitIds.length>1){
      const contactInput={...input,lossKm};
      let contact;
      try{
        contact=contactPhysicalSimultaneousLossV1(
          contactInput);
        assert.equal(validatePhysicalSimultaneousLossContactV1(
          contactInput,contact),true);
        paidRearContact={atDistanceM:contact.contact
          .atDistanceM,clockSeconds:contact.contact
          .clockSeconds,
        riderIds:contact.contact.riderIds.length,
        behindBunchSeconds:contact.contact
          .behindBunchSeconds};
      }catch(contactError){continuation={
        status:'refused',reason:contactError.message};}
      if(contact){
        try{
        const groupInput={...input,lossKm,
          throughKm:distanceKm};
        const group=replayPhysicalSimultaneousRearGroupV1(
          groupInput);
        assert.equal(validatePhysicalSimultaneousRearGroupV1(
          groupInput,group),true);
        const firstRearKm=group.sources.later[0];
        assert.equal(firstRearKm.rearRows.filter(row=>
          row.role==='leader').length,1);
        assert.equal(firstRearKm.rearRows.filter(row=>
          row.role==='sheltered').length,19);
        assert.ok(firstRearKm.rearRows.every(row=>
          row.energySpent>0));
        assert.ok(firstRearKm.rearRows.find(row=>
          row.role==='leader').energySpent>
          Math.max(...firstRearKm.rearRows.filter(row=>
            row.role==='sheltered').map(row=>
              row.energySpent)));
        assert.ok(group.sources.later.every(row=>
          row.gapSecondsToBunch>0));
        if(distanceKm===120&&fatigue===10){
          const forged=structuredClone(group);
          forged.kilometres.at(-1).riderStates.find(row=>
            row.riderId===splitIds[0]).energyAfter+=1;
          assert.throws(()=>
            validatePhysicalSimultaneousRearGroupV1(
              groupInput,forged),
          /differs from source/);
        }
        continuation={status:'paid_finish',
          riderKilometres:group.kilometres.reduce(
            (sum,row)=>sum+row.riderStates.length,0),
          finishRiders:Object.keys(group
            .observedFinishSecondsByRider).length,
          namedRearLeaders:new Set(group.sources.later
            .map(row=>row.leaderRiderId)).size,
          minimumEnergy:Math.min(...group.kilometres
            .flatMap(row=>row.riderStates.map(rider=>
              rider.energyAfter)))};
        }catch(groupError){continuation={
          status:'refused',reason:groupError.message,
          sourceKm:groupError.sourceKm};}
      }
    }
    if(splitIds.length===1){
      try{
        const replayInput={...input,lossKm,
          riderId:splitIds[0],throughKm:distanceKm};
        const replay=replayPhysicalSingleLossRaceV1(
          replayInput);
        assert.equal(validatePhysicalSingleLossRaceV1(
          replayInput,replay),true);
        continuation={status:'paid_finish',
          riderKilometres:replay.kilometres.reduce(
            (sum,row)=>sum+row.riderStates.length,0),
          finishRiders:Object.keys(replay
            .observedFinishSecondsByRider).length};
      }catch(nextError){continuation={
        status:'refused',reason:nextError.message};}
    }
    return {distanceKm,fatigue,variant,
      status:'paid_split',sourceKm:lossKm,
      splitRiders:splitIds,
      soloClockSpread,
      paidRearContact,
      bunchAtKmEnd:loss.step.physicalGroup.riderIds.length,
      continuation};
  }
  const decisions=run.road.reduce((sum,row)=>
    sum+row.riderDecisions.length,0);
  const namedLeaders=new Set(run.road.map(row=>
    row.leaderRiderId)).size;
  return {distanceKm,fatigue,variant,
    status:'paid_bunch_finish',
    riderKilometres:decisions,
    finishRiders:run.physicalGroup.riderIds.length,
    namedLeaders,
    minimumEnergy:Math.min(...Object.values(
      run.energyByRider))};
}

const results=[120,260].flatMap(distanceKm=>
  [10,30].flatMap(fatigue=>
    ['equal_field','one_weak_climber',
      'many_weak_climbers',
      'unequal_weak_climbers'].map(variant=>
      audit(distanceKm,fatigue,variant))));
if(process.argv.includes('--assert')){
  assert.equal(results.length,16);
  for(const row of results.filter(item=>
    item.variant==='equal_field')){
    assert.equal(row.status,'paid_bunch_finish');
    assert.equal(row.riderKilometres,
      row.distanceKm*fieldSize*ridersPerTeam);
    assert.equal(row.finishRiders,160);
    assert.ok(row.namedLeaders>=12);
    assert.ok(row.minimumEnergy>=0);
  }
  for(const row of results.filter(item=>
    item.variant!=='equal_field')){
    assert.equal(row.status,'paid_split');
    assert.equal(row.sourceKm,21);
    if(row.variant==='one_weak_climber'){
      assert.deepEqual(row.splitRiders,[
        'team-19-7']);
      assert.equal(row.continuation?.status,
        'paid_finish');
      assert.equal(row.continuation.riderKilometres,
        row.distanceKm*fieldSize*ridersPerTeam);
      assert.equal(row.continuation.finishRiders,160);
    }else if(row.variant==='many_weak_climbers'){
      assert.equal(row.splitRiders.length,20);
      assert.equal(row.paidRearContact.riderIds,20);
      assert.equal(row.paidRearContact.atDistanceM,
        row.sourceKm*1000);
      assert.ok(row.paidRearContact
        .behindBunchSeconds>0);
      assert.equal(row.continuation?.status,
        'paid_finish');
      assert.equal(row.continuation.riderKilometres,
        row.distanceKm*fieldSize*ridersPerTeam);
      assert.equal(row.continuation.finishRiders,160);
      assert.equal(row.continuation.namedRearLeaders,20);
      assert.ok(row.continuation.minimumEnergy>=0);
    }else{
      assert.equal(row.splitRiders.length,20);
      assert.ok(row.soloClockSpread>0);
      assert.equal(row.paidRearContact,null);
      assert.equal(row.continuation?.status,'refused');
      assert.match(row.continuation.reason,
        /no recorded meeting/);
    }
  }
}
process.stdout.write(JSON.stringify({
  version:'physical-field-scale-audit-1',
  fieldSize:fieldSize*ridersPerTeam,results},null,2)+'\n');
