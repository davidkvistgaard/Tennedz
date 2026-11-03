// Read-only 20-team stress audit of the isolated paid physical source.
// A refusal marks a missing branch, never an inferred wheel or finish.
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../lib/engine/v2/skills.mjs';
import {normalizeOrders} from '../lib/engine/v2/orders.mjs';
import {commitTeamChaseStakesV1} from
  '../lib/engine/v2/team-chase-stake-v1.mjs';
import {commitRearSoloPlanV1} from
  '../lib/engine/v2/rear-solo-commitment-v1.mjs';
import {startPhysicalBunchV1,runPhysicalBunchV1,
  runPhysicalBunchToPaceLossV1,
  runPhysicalStaggeredBunchLossV1} from
  '../lib/engine/v2/physical-start-bunch-v1.mjs';
import {replayPhysicalSingleLossRaceV1,
  validatePhysicalSingleLossRaceV1} from
  '../lib/engine/v2/physical-single-loss-race-replay-v1.mjs';
import {completePhysicalPaceLossKmV1,
  partitionPhysicalStaggeredLossArrivalsV1,
  validatePhysicalStaggeredLossArrivalsV1} from
  '../lib/engine/v2/physical-pace-loss-completion-v1.mjs';
import {inspectPhysicalStaggeredLossKmContactsV1,
  validatePhysicalStaggeredLossKmContactsV1} from
  '../lib/engine/v2/physical-staggered-loss-km-contact-v1.mjs';
import {finishPhysicalLossKmContactV1,
  validatePhysicalLossKmContactV1,
  finishPhysicalSoloFieldContactKmV1,
  validatePhysicalSoloFieldContactKmV1} from
  '../lib/engine/v2/physical-loss-km-contact-road-v1.mjs';
import {runPhysicalLossKmRearPairV1,
  validatePhysicalLossKmRearPairV1,
  runPhysicalSoloFieldRearPairV1,
  validatePhysicalSoloFieldRearPairV1} from
  '../lib/engine/v2/physical-loss-km-rear-pair-v1.mjs';
import {probePhysicalStaggeredSoloFieldV1} from
  '../lib/engine/v2/physical-staggered-detached-solo-v1.mjs';
import {inspectFirstStaggeredSoloFieldContactV1} from
  '../lib/engine/v2/physical-staggered-solo-field-contact-v1.mjs';
import {inspectNextRearPairFieldContactV1} from
  '../lib/engine/v2/physical-rear-pair-field-contact-v1.mjs';
import {finishPhysicalSecondRearPairContactV1,
  runPhysicalSecondRearPairV1} from
  '../lib/engine/v2/physical-second-rear-pair-v1.mjs';
import {advancePhysicalThirdRearGroupV1} from
  '../lib/engine/v2/physical-third-rear-contact-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  '../lib/engine/v2/physical-rear-event-track-v1.mjs';
import {replayPhysicalCommittedStageReleaseFinishV1,
  validatePhysicalCommittedStageReleaseFinishV1} from
  '../lib/engine/v2/physical-committed-stage-release-km-v1.mjs';
import {replayPhysicalCommittedStageJoinRaceV1,
  validatePhysicalCommittedStageJoinRaceV1} from
  '../lib/engine/v2/physical-committed-stage-join-race-v1.mjs';
import {probePhysicalOrderedSoloBunchContactV1,
  validatePhysicalOrderedSoloBunchContactV1} from
  '../lib/engine/v2/physical-ordered-solo-bunch-contact-v1.mjs';
import {finishPhysicalOrderedSoloBunchJoinKmV1} from
  '../lib/engine/v2/physical-ordered-solo-bunch-join-v1.mjs';
import {replayPhysicalStaggeredRearEventsV1,
  validatePhysicalStaggeredRearEventsV1} from
  '../lib/engine/v2/physical-staggered-rear-event-replay-v1.mjs';
import {partitionPhysicalSimultaneousLossV1,
  validatePhysicalSimultaneousLossPartitionV1,
  contactPhysicalSimultaneousLossV1,
  validatePhysicalSimultaneousLossContactV1} from
  '../lib/engine/v2/physical-simultaneous-loss-contact-v1.mjs';
import {replayPhysicalSimultaneousRearGroupV1,
  validatePhysicalSimultaneousRearGroupV1,
  replayPhysicalMixedSimultaneousRearGroupV1,
  validatePhysicalMixedSimultaneousRearGroupV1} from
  '../lib/engine/v2/physical-simultaneous-rear-group-v1.mjs';
import {contactPhysicalMixedRearSoloV1,
  validatePhysicalMixedRearSoloContactV1} from
  '../lib/engine/v2/physical-mixed-rear-solo-contact-v1.mjs';
import {finishPhysicalMixedRearContactKmV1,
  validatePhysicalMixedRearContactKmV1} from
  '../lib/engine/v2/physical-mixed-rear-contact-road-v1.mjs';
import {replayPhysicalMixedJoinedRearRaceV1,
  validatePhysicalMixedJoinedRearRaceV1} from
  '../lib/engine/v2/physical-mixed-joined-rear-race-v1.mjs';

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
    variant==='unequal_weak_climbers'||
    variant==='nearly_equal_weak_climbers'||
    variant==='unequal_descent_catch')
    for(const team of teams)team.riders[7].mountain=30;
  if(variant==='unequal_weak_climbers')
    teams[19].riders[7].mountain=35;
  if(variant==='nearly_equal_weak_climbers')
    teams[19].riders[7].mountain=31;
  if(variant==='unequal_descent_catch'){
    teams[19].riders[7].mountain=31;
    teams[19].riders[7].descending=0;
  }
  if(variant==='varied_field'||
    variant==='varied_captain')
    for(let teamIndex=0;teamIndex<teams.length;
      teamIndex++){
      const team=teams[teamIndex];
      for(let riderIndex=0;riderIndex<team.riders.length;
        riderIndex++){
        const rider=team.riders[riderIndex];
        const marker=teamIndex*8+riderIndex;
        rider.flat=92+(marker*3)%7;
        rider.hills=92+(marker*5)%7;
        rider.mountain=92+(marker*11)%7;
        rider.endurance=92+(marker*13)%7;
        rider.timetrial=92+(marker*17)%7;
        rider.strength=92+(marker*19)%7;
        rider.form=46+marker%9;
        rider.fatigue=fatigue+marker%5;
        team.energy[rider.id]=100-rider.fatigue*.4;
      }
    }
  if(variant==='varied_captain'){
    teams[4].orders.captainId='team-4-3';
    teams[4].orders.helperIds=teams[4].orders
      .helperIds.filter(id=>id!=='team-4-3');
  }
  const workerChoices=(variant==='varied_field'||
    variant==='varied_captain')?
    teams.map(team=>team.riders.slice(2)
      .filter(row=>team.orders.helperIds.includes(
        row.id)).sort((a,b)=>{
      const score=rider=>rider.flat+rider.hills+
        rider.mountain+rider.endurance+
        rider.form-rider.fatigue;
      return score(b)-score(a)||
        a.id.localeCompare(b.id);
    }).slice(0,2).map(row=>row.id)):null;
  if(workerChoices)
    teams[0].orders.baseline.frontWorkRiderId=
      workerChoices[0][0];
  for(let marker=5;marker<distanceKm;marker+=5){
    const priorTeam=Math.floor((marker-1)/5)%fieldSize;
    const nextTeam=Math.floor(marker/5)%fieldSize;
    if(priorTeam!==nextTeam)
      teams[priorTeam].orders.phases.push({
        atKm:marker,frontWork:'sit_in'});
    teams[nextTeam].orders.phases.push({
      atKm:marker,frontWork:'rotate',
      frontWorkRiderId:workerChoices?
        workerChoices[nextTeam][0]:
        `team-${nextTeam}-2`});
  }
  for(const team of teams)
    team.orders=normalizeOrders(team.orders,{
      riderIds:team.riders.map(row=>row.id),
      distanceKm,allowFrontWork:true,
      allowNamedFrontWorker:true});
  const commitment=commitTeamChaseStakesV1({teams,
    distanceKm,intentions:teams.map((team,index)=>({
      teamId:team.id,baseline:{goal:index===0||
        variant==='varied_captain'&&index===4?
        'sprint_finish':'none',
      captainId:team.orders.captainId},phases:[]}))});
  const startInput={teams,routeKilometres:route(distanceKm),
    commitment,raceSeed:'physical-20-team-scale-1',
    ...(['varied_field','varied_captain'].includes(
      variant)?{
      physicalDraftVersion:2,
      emergencyFrontWorkers:workerChoices.map(
        (choices,index)=>({version:1,
          teamId:teams[index].id,
          unavailableRiderId:choices[0],
          replacementRiderId:choices[1]}))}:{})};
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
    let staggeredScale=null;
    if(variant==='varied_field'){
      try{
        const staggered=runPhysicalStaggeredBunchLossV1({
          ...input,throughKm:distanceKm});
        const arrivalsInput={...input,staggered};
        const arrivals=partitionPhysicalStaggeredLossArrivalsV1(
          arrivalsInput);
        validatePhysicalStaggeredLossArrivalsV1(
          arrivalsInput,arrivals);
        const soloFieldInput={...arrivalsInput,
          throughKm:distanceKm};
        const soloField=probePhysicalStaggeredSoloFieldV1(
          soloFieldInput);
        const fieldContactInput={...arrivalsInput,
          soloField};
        const fieldContact=
          inspectFirstStaggeredSoloFieldContactV1(
            fieldContactInput);
        let laterFieldContactRoad=null;
        if(fieldContact.firstContact&&
          fieldContact.firstContact.sourceKm>
            Math.max(...staggered.losses.filter(row=>
              fieldContact.firstContact.riderIds.includes(
                row.riderId)).map(row=>row.sourceKm))){
          const fieldRoadInput={...fieldContactInput,
            fieldContact};
          laterFieldContactRoad=
            finishPhysicalSoloFieldContactKmV1(
              fieldRoadInput);
          validatePhysicalSoloFieldContactKmV1(
            fieldRoadInput,laterFieldContactRoad);
        }
        let laterPairContinuation=null;
        let paidPairSource=null;
        if(laterFieldContactRoad){
          const pairInput={...fieldContactInput,
            fieldContact,
            contactRoad:laterFieldContactRoad,
            throughKm:distanceKm};
          const pair=runPhysicalSoloFieldRearPairV1(
            pairInput);
          validatePhysicalSoloFieldRearPairV1(
            pairInput,pair);
          paidPairSource=pair;
          laterPairContinuation={status:'paid_pair_road',
            version:pair.version,
            steps:pair.steps.length,
            leaders:new Set(pair.steps.map(step=>
              step.leaderRiderId)).size,
            oneLeaderEveryKm:pair.steps.every(step=>
              step.riders.filter(rider=>
                rider.role==='leader').length===1),
            paidShelterEveryKm:pair.steps.every(step=>
              step.riders.filter(rider=>
                rider.role==='sheltered').length===1&&
              step.riders.every(rider=>
                rider.energySpent>0&&
                rider.recoveryAward===0)),
            endClock:pair.elapsedSeconds};
        }
        const lossContacts=
          inspectPhysicalStaggeredLossKmContactsV1(
            arrivalsInput);
        validatePhysicalStaggeredLossKmContactsV1(
          arrivalsInput,lossContacts);
        const paidContactRemainders=
          lossContacts.contacts.map(contact=>{
            const contactInput={...arrivalsInput,contact};
            const road=finishPhysicalLossKmContactV1(
              contactInput);
            validatePhysicalLossKmContactV1(
              contactInput,road);
            return road;
          });
        let rearPairContinuation=null;
        if(paidContactRemainders.length===1)
          try{
            const pairInput={...arrivalsInput,
              contact:lossContacts.contacts[0],
              contactRoad:paidContactRemainders[0],
              throughKm:distanceKm};
            const pair=runPhysicalLossKmRearPairV1(
              pairInput);
            validatePhysicalLossKmRearPairV1(
              pairInput,pair);
            paidPairSource=pair;
            rearPairContinuation={status:'paid_pair_road',
              version:pair.version,
              sourceKm:pair.sourceKm,
              steps:pair.steps.length,
              alternatingLeaders:new Set(pair.steps.map(
                step=>step.leaderRiderId)).size,
              oneLeaderEveryKm:pair.steps.every(step=>
                step.riders.filter(rider=>
                  rider.role==='leader').length===1),
              paidShelterEveryKm:pair.steps.every(step=>
                step.riders.filter(rider=>
                  rider.role==='sheltered').length===1&&
                step.riders.every(rider=>
                  rider.energySpent>0&&
                  rider.recoveryAward===0)),
              endClock:pair.elapsedSeconds};
          }catch(pairError){rearPairContinuation={
            status:'refused',reason:pairError.message,
            sourceKm:pairError.sourceKm??null};}
        const nextContact=paidPairSource?
          inspectNextRearPairFieldContactV1({
            ...fieldContactInput,firstFieldContact:
              fieldContact,
            contactRoad:laterFieldContactRoad??
              paidContactRemainders[0],
            pair:paidPairSource}):null;
        let secondRearPair=null;
        let thirdContact=null;
        let thirdRearGroup=null;
        if(nextContact?.nextContacts.length===1&&
          nextContact.nextContacts[0].kind===
            'two_other_solos_meet'){
          const secondInput={...fieldContactInput,
            firstFieldContact:fieldContact,
            contactRoad:laterFieldContactRoad??
              paidContactRemainders[0],
            pair:paidPairSource,
            secondContact:nextContact.nextContacts[0]};
          const road=finishPhysicalSecondRearPairContactV1(
            secondInput);
          const pair=runPhysicalSecondRearPairV1({
            ...secondInput,secondContactRoad:road,
            throughKm:distanceKm});
          const third=advancePhysicalThirdRearGroupV1({
            ...secondInput,secondContactRoad:road,
            secondPair:pair,throughKm:distanceKm});
          thirdContact={nextContacts:[third.thirdContact]};
          const thirdRoad=third.thirdContactRoad;
          const thirdGroup=third.group;
          const thirdEvent=third.thirdContact;
          const thirdTrack=pricePhysicalRearEventTrackV1({
            startInput,
            riderIds:thirdEvent.riders.map(row=>
              row.riderId),
            energyByRider:Object.fromEntries(
              thirdEvent.riders.map(row=>[
                row.riderId,row.energyAtContact])),
            km:thirdEvent.sourceKm,
            startM:thirdEvent.atDistanceM-
              (thirdEvent.sourceKm-1)*1000,
            startClock:thirdEvent.clockSeconds,
            contactLeaderRiderId:
              thirdRoad.leaderRiderId,
            groupId:thirdRoad.physicalGroup.id});
          const nextThirdTrack=pricePhysicalRearEventTrackV1({
            startInput,
            riderIds:thirdRoad.physicalGroup.riderIds,
            energyByRider:Object.fromEntries(
              thirdRoad.riders.map(row=>[
                row.riderId,row.energyAfter])),
            km:thirdEvent.sourceKm+1,startM:0,
            startClock:thirdRoad.elapsedSeconds,
            rotationIndex:0,
            groupId:thirdRoad.physicalGroup.id});
          thirdRearGroup={sourceKm:thirdRoad.sourceKm,
              contactMetres:thirdRoad.startDistanceM,
              riderCount:thirdRoad.riders.length,
              leaderRiderId:thirdRoad.leaderRiderId,
              roadRoles:thirdRoad.riders.map(rider=>({
                riderId:rider.riderId,role:rider.role,
                energySpent:rider.energySpent})),
              steps:thirdGroup.steps.length,
              leaders:[...new Set(thirdGroup.steps.map(step=>
                step.leaderRiderId))],
              oneLeaderEveryKm:thirdGroup.steps.every(step=>
                step.riders.filter(rider=>
                  rider.role==='leader').length===1),
              paidShelterEveryKm:thirdGroup.steps.every(step=>
                step.riders.filter(rider=>
                  rider.role==='sheltered').length===
                    thirdRoad.riders.length-1&&
                step.riders.every(rider=>
                  rider.energySpent>0&&
                  rider.recoveryAward===0)),
              endClock:thirdGroup.elapsedSeconds,
              genericTrackMatchesRoad:
                Math.abs(thirdTrack.endClock-
                  thirdRoad.elapsedSeconds)<1e-7&&
                thirdTrack.leaderRiderId===
                  thirdRoad.leaderRiderId&&
                thirdTrack.rows.every(row=>
                  Math.abs(row.energyAfter-
                    thirdRoad.riders.find(item=>
                      item.riderId===row.riderId)
                      .energyAfter)<1e-7),
              genericNextTrackMatches:
                Math.abs(nextThirdTrack.endClock-
                  thirdGroup.steps[0]
                    .elapsedSeconds)<1e-7&&
                nextThirdTrack.leaderRiderId===
                  thirdGroup.steps[0]
                    .leaderRiderId,
              otherRidersUnsettled:
                thirdGroup.otherRidersUnsettled};
          secondRearPair={sourceKm:road.sourceKm,
            contactMetres:road.startDistanceM,
            leaderRiderId:road.leaderRiderId,
            roadRoles:road.riders.map(rider=>({
              riderId:rider.riderId,role:rider.role,
              energySpent:rider.energySpent})),
            steps:pair.steps.length,
            leaders:[...new Set(pair.steps.map(step=>
              step.leaderRiderId))],
            oneLeaderEveryKm:pair.steps.every(step=>
              step.riders.filter(rider=>
                rider.role==='leader').length===1),
            paidShelterEveryKm:pair.steps.every(step=>
              step.riders.filter(rider=>
                rider.role==='sheltered').length===1&&
              step.riders.every(rider=>
                rider.energySpent>0&&
                rider.recoveryAward===0)),
            endClock:pair.elapsedSeconds,
            otherRidersUnsettled:pair.otherRidersUnsettled};
        }
        staggeredScale={status:'paid_bunch_finish',
          sourceVersion:staggered.version,
          detachedRiders:staggered.detachedRiderIds.length,
          paidLossCompletions:arrivals.completions.length,
          soloCandidates:soloField.candidates.length,
          soloRefusals:soloField.refusals,
          firstSoloFieldContact:
            fieldContact.firstContact,
          laterFieldContactRoad,
          laterPairContinuation,
          nearCoincidentArrivals:
            arrivals.nearCoincidentArrivals.length,
          nearCoincidentArrivalRows:
            arrivals.nearCoincidentArrivals,
          withinLossKmContactPairs:
            lossContacts.contacts.length,
          firstWithinLossKmContacts:
            lossContacts.contacts.slice(0,5),
          paidContactRemainders,
          rearPairContinuation,
          nextContact:nextContact?.nextContacts??[],
          secondRearPair,
          thirdContact:thirdContact?.nextContacts??[],
          thirdRearGroup,
          separateArrivalSolos:
            arrivals.separateSoloRiderIds.length,
          lossKilometres:[...new Set(staggered.losses
            .map(row=>row.sourceKm))],
          paidPaceMatches:staggered.road.reduce((sum,row)=>
            sum+row.riders.filter(rider=>
              rider.role==='pace_match').length,0),
          emergencyTurns:staggered.road.filter(row=>
            row.emergencyFrontWorker).length,
          singleLeaderEveryKm:staggered.road.every(row=>
            row.riders.filter(rider=>
              rider.role==='leader').length===1),
          validPaceMatches:staggered.road.every(row=>
            row.riders.filter(rider=>
              rider.role==='pace_match').every(rider=>
              rider.energySpent>0&&
              rider.recoveryAward===0&&
              row.riderDecisions.find(decision=>
                decision.riderId===rider.riderId)
                ?.choice==='hold_pace')),
          everyBunchRiderDecided:staggered.road.every(row=>
            row.riders.length===
              row.riderDecisions.length),
          namedLeaders:new Set(staggered.road.map(row=>
            row.leaderRiderId)).size,
          bunchFinishRiders:staggered.physicalGroup
            .riderIds.length};
      }catch(nextError){staggeredScale={
        status:'refused',reason:nextError.message};}
    }
    const completions=splitIds.map(riderId=>
      completePhysicalPaceLossKmV1({
        ...input,lossKm,loss,riderId}));
    const soloClockSpread=Math.max(...completions.map(
      row=>row.elapsedSeconds))-Math.min(
      ...completions.map(row=>row.elapsedSeconds));
    let continuation=null;
    let mixedContinuation=null;
    let laterMixedContact=null;
    let laterMixedRoad=null;
    let joinedContinuation=null;
    let paidRearContact=null;
    let paidArrivalPartitions=null;
    if(splitIds.length>1){
      const contactInput={...input,lossKm};
      const partition=partitionPhysicalSimultaneousLossV1(
        contactInput);
      assert.equal(validatePhysicalSimultaneousLossPartitionV1(
        contactInput,partition),true);
      if(variant==='unequal_weak_climbers'&&
        distanceKm===120&&fatigue===10){
        const forged=structuredClone(partition);
        forged.contacts[0].riderIds.push('team-19-7');
        assert.throws(()=>
          validatePhysicalSimultaneousLossPartitionV1(
            contactInput,forged),/differs from source/);
      }
      paidArrivalPartitions={contactSizes:partition.contacts
        .map(row=>row.riderIds.length),
      separateSoloRiderIds:partition.separateSoloRiderIds};
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
      if(variant==='unequal_weak_climbers'||
        variant==='nearly_equal_weak_climbers'||
        variant==='unequal_descent_catch'){
        const mixedInput={...input,lossKm,
          throughKm:distanceKm};
        try{
          const mixed=replayPhysicalMixedSimultaneousRearGroupV1(
            mixedInput);
          assert.equal(validatePhysicalMixedSimultaneousRearGroupV1(
            mixedInput,mixed),true);
          assert.ok(mixed.sources.later.every(row=>
            row.rearRows.filter(rider=>
              rider.role==='leader').length===1&&
            row.rearRows.filter(rider=>
              rider.role==='sheltered').length===18));
          assert.ok(mixed.sources.later[0].rearRows.find(row=>
            row.role==='leader').energySpent>
            Math.max(...mixed.sources.later[0]
              .rearRows.filter(row=>row.role==='sheltered')
              .map(row=>row.energySpent)));
          if(distanceKm===120&&fatigue===10){
            const forged=structuredClone(mixed);
            forged.observedFinishSecondsByRider[
              'team-19-7']+=1;
            assert.throws(()=>
              validatePhysicalMixedSimultaneousRearGroupV1(
                mixedInput,forged),/differs from paid source/);
          }
          mixedContinuation={status:'paid_finish',
            riderKilometres:mixed.kilometres.reduce(
              (sum,row)=>sum+row.riderStates.length,0),
            finishRiders:Object.keys(mixed
              .observedFinishSecondsByRider).length,
            namedRearLeaders:new Set(mixed.sources.later
              .map(row=>row.leaderRiderId)).size,
            minimumEnergy:Math.min(...mixed.kilometres
              .flatMap(row=>row.riderStates.map(rider=>
                rider.energyAfter)))};
        }catch(mixedError){mixedContinuation={
          status:'refused',reason:mixedError.message,
          sourceKm:mixedError.sourceKm};}
        if(variant==='unequal_descent_catch'&&
          mixedContinuation.sourceKm){
          const laterInput={...input,lossKm,
            contactKm:mixedContinuation.sourceKm};
          const later=contactPhysicalMixedRearSoloV1(
            laterInput);
          assert.equal(validatePhysicalMixedRearSoloContactV1(
            laterInput,later),true);
          assert.equal(later.sources.prior.kilometres.length,
            later.sourceKm-1);
          assert.equal(later.riders.filter(row=>
            row.role==='leader').length,1);
          assert.equal(later.riders.filter(row=>
            row.role==='sheltered').length,18);
          assert.equal(later.riders.filter(row=>
            row.role==='solo').length,1);
          assert.ok(later.riders.find(row=>
            row.role==='leader').energySpent>
            Math.max(...later.riders.filter(row=>
              row.role==='sheltered').map(row=>
                row.energySpent)));
          const forged=structuredClone(later);
          forged.riders.at(-1).energyAfter+=1;
          assert.throws(()=>
            validatePhysicalMixedRearSoloContactV1(
              laterInput,forged),/differs from paid source/);
          laterMixedContact={sourceKm:later.sourceKm,
            atDistanceM:later.atDistanceM,
            behindBunchSeconds:later.behindBunchSeconds,
            riderCount:later.riders.length,
            leaderRiderId:later.leaderRiderId,
            minimumEnergy:Math.min(...later.riders
              .map(row=>row.energyAfter))};
          const roadInput={...laterInput,contact:later};
          const road=finishPhysicalMixedRearContactKmV1(
            roadInput);
          assert.equal(validatePhysicalMixedRearContactKmV1(
            roadInput,road),true);
          assert.equal(road.riders.filter(row=>
            row.role==='leader').length,1);
          assert.equal(road.riders.filter(row=>
            row.role==='sheltered').length,19);
          assert.ok(road.riders.find(row=>
            row.role==='leader').energySpent>
            Math.max(...road.riders.filter(row=>
              row.role==='sheltered').map(row=>
                row.energySpent)));
          laterMixedRoad={sourceKm:road.sourceKm,
            endDistanceM:road.endDistanceM,
            riderCount:road.riders.length,
            gapSecondsToBunch:road.gapSecondsToBunch,
            minimumEnergy:Math.min(...road.riders.map(
              row=>row.energyAfter))};
          try{
            const joinedInput={...input,lossKm,
              contactKm:later.sourceKm,
              throughKm:distanceKm};
            const joined=replayPhysicalMixedJoinedRearRaceV1(
              joinedInput);
            assert.equal(validatePhysicalMixedJoinedRearRaceV1(
              joinedInput,joined),true);
            const contactStates=joined.kilometres[
              later.sourceKm-1].riderStates;
            assert.equal(contactStates.filter(row=>
              row.physicalGroupId!=='peloton'&&
              row.decisions.length===2).length,20);
            assert.equal(contactStates.filter(row=>
              row.physicalGroupId==='peloton'&&
              row.decisions.length===1).length,140);
            const forgedJoined=structuredClone(joined);
            forgedJoined.observedFinishSecondsByRider[
              'team-19-7']+=1;
            assert.throws(()=>
              validatePhysicalMixedJoinedRearRaceV1(
                joinedInput,forgedJoined),
            /differs from source/);
            joinedContinuation={status:'paid_finish',
              riderKilometres:joined.kilometres.reduce(
                (sum,row)=>sum+row.riderStates.length,0),
              finishRiders:Object.keys(joined
                .observedFinishSecondsByRider).length,
              namedRearLeaders:new Set(joined.sources.later
                .map(row=>row.leaderRiderId)).size,
              minimumEnergy:Math.min(...joined.kilometres
                .flatMap(row=>row.riderStates.map(rider=>
                  rider.energyAfter)))};
          }catch(joinedError){joinedContinuation={
            status:'refused',reason:joinedError.message,
            sourceKm:joinedError.sourceKm};}
        }
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
      staggeredScale,
      soloClockSpread,
      paidArrivalPartitions,
      paidRearContact,
      bunchAtKmEnd:loss.step.physicalGroup.riderIds.length,
      continuation,mixedContinuation,
      laterMixedContact,laterMixedRoad,
      joinedContinuation};
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

if(process.argv.includes('--probe-stage-join')){
  const results=[];
  for(const distanceKm of [120,260])
    for(const fatigue of [10,30]){
      const base=source(distanceKm,fatigue,
        'equal_field');
      const riderId='team-19-7';
      const keypoints=[{km:6}];
      const frontTeam=base.startInput.teams[1];
      frontTeam.orders.phases.push({
        atKm:6,effort:'conserve'});
      frontTeam.orders.phases=frontTeam.orders.phases
        .map(phase=>phase.atKm===10?{
          ...phase,effort:'steady'}:phase)
        .sort((a,b)=>a.atKm-b.atKm);
      for(const team of base.startInput.teams)
        team.orders=normalizeOrders(team.orders,{
          riderIds:team.riders.map(row=>row.id),
          distanceKm,keypoints,
          allowFrontWork:true,
          allowNamedFrontWorker:true});
      base.startInput.commitment=
        commitTeamChaseStakesV1({
          teams:base.startInput.teams,
          distanceKm,keypoints,
          intentions:base.startInput.teams.map(
            (team,index)=>({teamId:team.id,
              baseline:{goal:index===0?
                'sprint_finish':'none',
              captainId:team.orders.captainId},
              phases:[]}))});
      base.startInput.teams[19].riders[7]
        .mountain=100;
      const plan=commitRearSoloPlanV1({
        riderId,distanceKm,stageNumber:1,
        stageCount:2,baseline:{goal:'finish_safely',
          effort:'steady'},phases:[{atKm:5,
          goal:'save_for_stage',effort:'conserve',
          committedStagePlan:{riderId,
            currentStageNumber:1,
            targetStageNumber:2,
            currentGoal:'finish_safely',
            futureGoal:'target_stage',
            reserveEnergy:20}}]});
      const startInput={...base.startInput,
        physicalDraftVersion:4,
        soloCommitments:[plan]};
      const input={startInput,
        start:startPhysicalBunchV1(startInput),
        riderId,releaseKm:6,
        throughKm:distanceKm};
      const race=replayPhysicalCommittedStageJoinRaceV1(
        input);
      assert.equal(validatePhysicalCommittedStageJoinRaceV1(
        input,race),true);
      assert.equal(race.kilometres.length,distanceKm);
      assert.ok(race.kilometres.every(km=>
        km.riderStates.length===160&&
        km.riderStates.every(row=>
          row.decisions.length>0&&
          Number.isFinite(row.energyAfter))));
      assert.equal(Object.keys(race
        .observedFinishSecondsByRider).length,160);
      assert.equal(race.sources.join.sourceKm,7);
      assert.ok(race.sources.join
        .contactAtDistanceM>6000&&
        race.sources.join.contactAtDistanceM<7000&&
        race.sources.join.shelteredEnergySpent<
          race.sources.join
            .exposedAlternativeEnergyDemand);
      assert.ok(race.sources.later.every(step=>
        step.riders.filter(row=>
          row.role==='leader').length===1&&
        step.riders.find(row=>row.riderId===
          riderId)?.role==='sheltered'&&
        step.riderDecisions.find(row=>
          row.riderId===riderId)?.effort===
            'conserve'&&
        step.riderDecisions.find(row=>
          row.riderId===riderId)
          ?.teamOrderEffort==='steady'));
      results.push({distanceKm,fatigue,
        contactKm:race.sources.join.sourceKm,
        contactMetre:race.sources.join
          .contactAtDistanceM,
        soloMetres:race.sources.join
          .soloDistanceM,
        shelterMetres:race.sources.join
          .shelteredDistanceM,
        finishEnergy:race.kilometres.at(-1)
          .riderStates.find(row=>
            row.riderId===riderId).energyAfter,
        finishRiders:160});
    }
  process.stdout.write(JSON.stringify({results},
    null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-stage-release')){
  const results=[];
  for(const distanceKm of [120,260])
    for(const fatigue of [10,30]){
      const base=source(distanceKm,fatigue,
        'equal_field');
      const riderId='team-19-7';
      const plan=commitRearSoloPlanV1({
        riderId,distanceKm,stageNumber:1,
        stageCount:2,baseline:{goal:'finish_safely',
          effort:'steady'},phases:[{atKm:5,
          goal:'save_for_stage',effort:'conserve',
          committedStagePlan:{riderId,
            currentStageNumber:1,
            targetStageNumber:2,
            currentGoal:'finish_safely',
            futureGoal:'target_stage',
            reserveEnergy:20}}]});
      const startInput={...base.startInput,
        physicalDraftVersion:4,
        soloCommitments:[plan]};
      const input={startInput,
        start:startPhysicalBunchV1(startInput),
        riderId,releaseKm:6};
      const race=replayPhysicalCommittedStageReleaseFinishV1(
        input);
      assert.equal(validatePhysicalCommittedStageReleaseFinishV1(
        input,race),true);
      assert.equal(race.kilometres.length,distanceKm);
      assert.ok(race.kilometres.every(km=>
        km.riderStates.length===160&&
        km.riderStates.every(row=>
          row.decisions.length>0&&
          Number.isFinite(row.energyAfter))));
      assert.ok(race.sources.later.every(step=>
        step.gapSecondsToBunch>0&&
        step.bunch.riders.filter(row=>
          row.role==='leader').length===1&&
        step.solo.energyAfter>=20));
      assert.equal(Object.keys(race
        .observedFinishSecondsByRider).length,160);
      results.push({distanceKm,fatigue,
        releaseGapSeconds:race.sources.first
          .sources.release.gapSecondsToBunch,
        finishGapSeconds:race.sources.later
          .at(-1).gapSecondsToBunch,
        soloFinishEnergy:race.kilometres.at(-1)
          .riderStates.find(row=>
            row.riderId===riderId).energyAfter,
        finishRiders:160});
    }
  process.stdout.write(JSON.stringify({results},
    null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-single-leader-weak')){
  const draftVersion=process.argv.includes(
    '--classified')?4:3;
  const results=[120,260].map(distanceKm=>{
    const base=source(distanceKm,30,
      'one_weak_climber');
    const startInput={...base.startInput,
      physicalDraftVersion:draftVersion};
    const start=startPhysicalBunchV1(startInput);
    const staggered=runPhysicalStaggeredBunchLossV1({
      startInput,start,throughKm:distanceKm});
    const soloField=probePhysicalStaggeredSoloFieldV1({
      startInput,start,staggered,
      throughKm:distanceKm});
    const input={startInput,start,staggered,
      soloField,throughKm:distanceKm};
    const race=replayPhysicalStaggeredRearEventsV1(input);
    assert.equal(validatePhysicalStaggeredRearEventsV1(
      input,race),true);
    assert.ok(staggered.road.every(step=>
      step.riders.filter(row=>row.role===
        'leader').length===1&&
      step.physicalGroup.riderIds.every(id=>
        ['leader','sheltered'].includes(
          step.riders.find(row=>row.riderId===
            id)?.role))));
    assert.ok(race.kilometres.every(row=>
      row.riderStates.length===160&&
      row.riderStates.every(state=>
        state.decisions.length>0)));
    assert.equal(Object.keys(race
      .observedFinishSecondsByRider).length,160);
    const loss=staggered.losses[0];
    const lossDecision=staggered.road[
      loss.sourceKm-1].riderDecisions.find(row=>
      row.riderId===loss.riderId);
    if(draftVersion===4)
      assert.equal(lossDecision.reason,
        'cannot_hold_even_at_hard_effort');
    return {distanceKm,fatigue:30,
      draftVersion,lossReason:lossDecision.reason,
      losses:staggered.losses.length,
      contacts:race.contactCount,
      finishRiders:Object.keys(race
        .observedFinishSecondsByRider).length};
  });
  assert.ok(results.every(row=>
    row.losses===1&&row.contacts===0&&
    row.finishRiders===160));
  process.stdout.write(JSON.stringify({results},
    null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-single-leader')){
  const distanceKm=process.argv.includes(
    '--long')?260:120;
  const fatigue=process.argv.includes(
    '--fatigued')?30:10;
  const draftVersion=process.argv.includes(
    '--classified')?4:3;
  const baseline=source(distanceKm,fatigue,
    'varied_field');
  const baselineRoad=runPhysicalStaggeredBunchLossV1({
    ...baseline,throughKm:distanceKm});
  const baselineSolo=probePhysicalStaggeredSoloFieldV1({
    ...baseline,staggered:baselineRoad,
    throughKm:distanceKm});
  const startInput={...baseline.startInput,
    physicalDraftVersion:draftVersion};
  const start=startPhysicalBunchV1(startInput);
  const staggered=runPhysicalStaggeredBunchLossV1({
    startInput,start,throughKm:distanceKm});
  const soloField=probePhysicalStaggeredSoloFieldV1({
    startInput,start,staggered,throughKm:distanceKm});
  const input={startInput,start,staggered,
    soloField,throughKm:distanceKm};
  const splitCauses=staggered.road.flatMap(step=>
    step.splits.map(split=>step.riderDecisions
      .find(row=>row.riderId===split.riderId)
      ?.reason));
  const splitCauseCounts=Object.fromEntries(
    [...new Set(splitCauses)].map(reason=>[
      reason,splitCauses.filter(row=>row===reason)
        .length]));
  if(draftVersion===4){
    assert.equal(splitCauses.length,
      staggered.losses.length);
    assert.ok(splitCauses.every(reason=>
      ['team_effort_ceiling',
        'cannot_hold_even_at_hard_effort']
        .includes(reason)));
  }
  const countRole=(road,role)=>road.road.reduce(
    (sum,step)=>sum+step.riders.filter(row=>
      row.role===role).length,0);
  const baselinePaceMatches=countRole(
    baselineRoad,'pace_match');
  assert.ok(baselinePaceMatches>0);
  const firstLegacyMatch=baselineRoad.road.flatMap(step=>
    step.riders.filter(row=>row.role===
      'pace_match').map(row=>({
        km:step.sourceKm,row}))).at(0);
  const shelteredMatch=staggered.road[
    firstLegacyMatch.km-1].riders.find(row=>
    row.riderId===firstLegacyMatch.row.riderId);
  assert.equal(shelteredMatch.role,'sheltered');
  assert.ok(shelteredMatch.energySpent<
    firstLegacyMatch.row.energySpent);
  assert.equal(countRole(staggered,'pace_match'),0);
  assert.ok(staggered.road.every(step=>
    step.riders.filter(row=>row.role===
      'leader').length===1&&
    step.physicalGroup.riderIds.every(id=>
      ['leader','sheltered'].includes(
        step.riders.find(row=>row.riderId===
          id)?.role))));
  if(fatigue===30){
    assert.throws(()=>
      replayPhysicalStaggeredRearEventsV1(input),
    /distinct paid split ordering/);
    process.stdout.write(JSON.stringify({
      distanceKm,fatigue,draftVersion,
      baselinePaceMatches,
      candidatePaceMatches:countRole(staggered,
        'pace_match'),
      status:'refused_ambiguous_equal_split',
      losses:staggered.losses.length,
      splitCauseCounts},
    null,2)+'\n');
    process.exit(0);
  }
  const baselineRace=replayPhysicalStaggeredRearEventsV1({
    ...baseline,staggered:baselineRoad,
    soloField:baselineSolo,throughKm:distanceKm});
  const race=replayPhysicalStaggeredRearEventsV1(input);
  assert.equal(validatePhysicalStaggeredRearEventsV1(
    input,race),true);
  assert.ok(race.kilometres.every(row=>
    row.riderStates.length===160&&
    row.riderStates.every(state=>
      state.decisions.length>0)));
  assert.equal(Object.keys(race
    .observedFinishSecondsByRider).length,160);
  const baselineFinishEnergy=Object.fromEntries(
    baselineRace.kilometres.at(-1).riderStates.map(
      row=>[row.riderId,row.energyAfter]));
  const finishEnergyDeltas=race.kilometres.at(-1)
    .riderStates.map(row=>row.energyAfter-
      baselineFinishEnergy[row.riderId]);
  assert.ok(finishEnergyDeltas.every(
    Number.isFinite));
  assert.ok(finishEnergyDeltas.some(value=>
    value>1e-6));
  process.stdout.write(JSON.stringify({
    distanceKm,fatigue,draftVersion,
    baselinePaceMatches,
    firstShelteredMatch:{km:firstLegacyMatch.km,
      riderId:firstLegacyMatch.row.riderId,
      oldEnergySpent:firstLegacyMatch.row.energySpent,
      shelteredEnergySpent:
        shelteredMatch.energySpent},
    candidatePaceMatches:countRole(staggered,
      'pace_match'),
    splitCauseCounts,
    baselineContacts:baselineRace.contactCount,
    losses:staggered.losses.length,
    contacts:race.contactCount,
    baselineFinishSecondsRange:[
      Math.min(...Object.values(baselineRace
        .observedFinishSecondsByRider)),
      Math.max(...Object.values(baselineRace
        .observedFinishSecondsByRider))],
    candidateFinishSecondsRange:[
      Math.min(...Object.values(race
        .observedFinishSecondsByRider)),
      Math.max(...Object.values(race
        .observedFinishSecondsByRider))],
    baselineMinimumFinishEnergy:Math.min(...baselineRace
      .kilometres.at(-1).riderStates.map(row=>
        row.energyAfter)),
    candidateMinimumFinishEnergy:Math.min(...race
      .kilometres.at(-1).riderStates.map(row=>
        row.energyAfter)),
    finishEnergyIncreasedRiders:
      finishEnergyDeltas.filter(value=>
        value>1e-6).length,
    finishEnergyDecreasedRiders:
      finishEnergyDeltas.filter(value=>
        value< -1e-6).length,
    maximumFinishEnergyGain:
      Math.max(...finishEnergyDeltas),
    finishRiders:Object.keys(race
      .observedFinishSecondsByRider).length},
  null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-rear-captain')){
  const distanceKm=120;
  const baseline=source(distanceKm,10,
    'varied_field');
  const baselineStaggered=
    runPhysicalStaggeredBunchLossV1({
      ...baseline,throughKm:distanceKm});
  const baselineSolo=
    probePhysicalStaggeredSoloFieldV1({
      ...baseline,staggered:baselineStaggered,
      throughKm:distanceKm});
  const baselineRace=replayPhysicalStaggeredRearEventsV1({
    ...baseline,staggered:baselineStaggered,
    soloField:baselineSolo,throughKm:distanceKm});
  const input=source(distanceKm,10,
    'varied_captain');
  const staggered=runPhysicalStaggeredBunchLossV1({
    ...input,throughKm:distanceKm});
  const soloField=probePhysicalStaggeredSoloFieldV1({
    ...input,staggered,throughKm:distanceKm});
  const replayInput={...input,staggered,soloField,
    throughKm:distanceKm};
  const race=replayPhysicalStaggeredRearEventsV1(
    replayInput);
  assert.equal(validatePhysicalStaggeredRearEventsV1(
    replayInput,race),true);
  assert.ok(race.kilometres.every(row=>
    row.riderStates.length===160&&
    row.riderStates.every(state=>
      state.decisions.length>0)));
  const baselineFirst=baselineRace.contacts[0];
  const captainFirst=race.contacts[0];
  assert.equal(baselineFirst.outcome,'join');
  assert.equal(captainFirst.outcome,
    'pass_through');
  assert.deepEqual(captainFirst.riders,
    baselineFirst.riders);
  assert.equal(captainFirst.atDistanceM,
    baselineFirst.atDistanceM);
  assert.equal(captainFirst.clockSeconds,
    baselineFirst.clockSeconds);
  assert.equal(captainFirst.contactDecisions.find(
    row=>row.riderId==='team-4-3')?.choice,
  'pass_through');
  assert.ok(race.contacts.filter(row=>
    row.outcome==='pass_through').length>=3);
  assert.equal(race.kilometres[
    captainFirst.sourceKm-1]
    .riderStates.find(row=>row.riderId===
      'team-4-3').physicalGroupId,
  'solo-team-4-3');
  process.stdout.write(JSON.stringify({
    distanceKm,baselineFirstContact:
      baselineFirst.outcome,
    captainFirstContact:captainFirst.outcome,
    firstContactKm:captainFirst.sourceKm,
    firstContactAtDistanceM:
      captainFirst.atDistanceM,
    passThroughContacts:race.contacts.filter(row=>
      row.outcome==='pass_through').length,
    contactCount:race.contactCount,
    captainFinishGroupId:race.kilometres.at(-1)
      .riderStates.find(row=>row.riderId===
        'team-4-3').physicalGroupId,
    finishRiders:Object.keys(race
      .observedFinishSecondsByRider).length},
  null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-rear-ordered')){
  const results=[120,260].flatMap(distanceKm=>
    [10,30].map(fatigue=>{
      const base=source(distanceKm,fatigue,
        'varied_field');
      const startInput={...base.startInput,
        physicalDraftVersion:4,
        physicalRearIntentVersion:2};
      const start=startPhysicalBunchV1(startInput);
      try{
        const staggered=
          runPhysicalStaggeredBunchLossV1({
            startInput,start,throughKm:distanceKm});
        const soloField=
          probePhysicalStaggeredSoloFieldV1({
            startInput,start,staggered,
            throughKm:distanceKm});
        if(soloField.refusals.length){
          const riderId=soloField.refusals[0]
            .riderId;
          const contactInput={startInput,start,
            staggered,riderId,
            throughKm:distanceKm};
          const probe=
            probePhysicalOrderedSoloBunchContactV1(
              contactInput);
          assert.equal(
            validatePhysicalOrderedSoloBunchContactV1(
              contactInput,probe),true);
          assert.throws(()=>
            finishPhysicalOrderedSoloBunchJoinKmV1(
              contactInput),
          /isolated paid contact/);
          return {distanceKm,fatigue,
            status:'solo_source_refusal',
            reason:soloField.refusals[0],
            refusalCount:soloField.refusals.length,
            firstCandidateBunchCrossing:
              probe.contact?{
                riderId,
                sourceKm:probe.contact.sourceKm,
                atDistanceM:probe.contact.atDistanceM,
                clockSeconds:probe.contact.clockSeconds,
                soloEnergyAtContact:
                  probe.contact.soloEnergyAtContact,
                candidateOnly:probe.contact
                  .candidateOnly,
                otherRearRoadsUnsettled:
                  probe.contact
                    .otherRearRoadsUnsettled}:null};
        }
        const race=replayPhysicalStaggeredRearEventsV1({
          startInput,start,staggered,soloField,
          throughKm:distanceKm});
        return {distanceKm,fatigue,
          status:'full_replay',
          contacts:race.contactCount,
          riderKilometres:race.kilometres.reduce(
            (sum,row)=>sum+row.riderStates.length,0),
          finishRiders:Object.keys(race
            .observedFinishSecondsByRider).length};
      }catch(error){return {distanceKm,fatigue,
        status:'refusal',reason:error.message};}
    }));
  assert.ok(results.every(row=>
    row.status==='solo_source_refusal'&&
    row.reason.reason===
      'Staggered solo needs separate bunch contact.'&&
    row.refusalCount>0&&
    row.firstCandidateBunchCrossing
      ?.candidateOnly===true&&
    row.firstCandidateBunchCrossing
      ?.otherRearRoadsUnsettled===true));
  process.stdout.write(JSON.stringify({results},null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-rear-extreme')||
  process.argv.includes('--probe-rear-extreme-260')){
  const distanceKm=process.argv.includes(
    '--probe-rear-extreme-260')?260:120;
  const results=['one_weak_climber',
    'unequal_descent_catch'].flatMap(variant=>
    [10,30].map(fatigue=>{
      const input=source(distanceKm,fatigue,variant);
      let firstLossReplay=null;
      if(variant==='unequal_descent_catch'){
        const firstLossKm=21;
        const firstStaggered=
          runPhysicalStaggeredBunchLossV1({
            ...input,throughKm:firstLossKm});
        const firstSolo=probePhysicalStaggeredSoloFieldV1({
          ...input,staggered:firstStaggered,
          throughKm:firstLossKm});
        try{
          const firstRace=replayPhysicalStaggeredRearEventsV1({
            ...input,staggered:firstStaggered,
            soloField:firstSolo,
            throughKm:firstLossKm});
          firstLossReplay={status:'full_replay',
            contacts:firstRace.contactCount};
        }catch(error){firstLossReplay={status:'refusal',
          reason:error.message};}
      }
      let staggered;
      try{staggered=runPhysicalStaggeredBunchLossV1({
        ...input,throughKm:distanceKm});}
      catch(error){return {variant,fatigue,
        status:'bunch_source_refusal',
        reason:error.message};}
      const soloField=probePhysicalStaggeredSoloFieldV1({
        ...input,staggered,throughKm:distanceKm});
      if(soloField.refusals.length)
        return {variant,fatigue,status:'solo_refusal',
          detachedRiders:staggered.losses.length,
          lossKilometres:[...new Set(staggered.losses
            .map(row=>row.sourceKm))],
          refusals:soloField.refusals.slice(0,5)};
      try{
        const replayInput={...input,staggered,
          soloField,throughKm:distanceKm};
        const race=replayPhysicalStaggeredRearEventsV1(
          replayInput);
        assert.equal(validatePhysicalStaggeredRearEventsV1(
          replayInput,race),true);
        assert.ok(race.kilometres.every(row=>
          row.riderStates.length===160&&
          row.riderStates.every(state=>
            state.decisions.length>0&&
            Number.isFinite(state.elapsedSeconds)&&
            Number.isFinite(state.energyAfter)&&
            state.energyAfter>=0)));
        assert.ok(race.kilometres.flatMap(row=>
          row.segments).filter(row=>
          row.kind==='group').every(row=>
          row.riders.filter(rider=>
            rider.role==='leader').length===1&&
          row.riders.filter(rider=>
            rider.role==='sheltered').length===
            row.riders.length-1));
        const finishes=race.kilometres.at(-1)
          .riderStates;
        return {variant,fatigue,status:'full_replay',
          distanceKm,
          detachedRiders:staggered.losses.length,
          lossKilometres:[...new Set(staggered.losses
            .map(row=>row.sourceKm))],
          contacts:race.contactCount,
          sharedSplitContacts:race.contacts.filter(row=>
            row.source==='paid_simultaneous_split')
            .length,
          largestRearGroup:Math.max(0,...race.contacts
            .filter(row=>row.outcome==='join')
            .map(row=>row.physicalGroup.riderIds
              .length)),
          ...(firstLossReplay?{firstLossReplay}:{}),
          riderKilometres:race.kilometres.reduce(
            (sum,row)=>sum+row.riderStates.length,0),
          minimumFinishEnergy:Math.min(...finishes
            .map(row=>row.energyAfter)),
          earliestFinishSeconds:Math.min(...finishes
            .map(row=>row.elapsedSeconds)),
          latestFinishSeconds:Math.max(...finishes
            .map(row=>row.elapsedSeconds)),
          finishRiders:Object.keys(race
            .observedFinishSecondsByRider).length};
      }catch(error){
        return {variant,fatigue,status:'rear_refusal',
          detachedRiders:staggered.losses.length,
          lossKilometres:[...new Set(staggered.losses
            .map(row=>row.sourceKm))],
          firstLossReplay,
          reason:error.message};
      }
    }));
  assert.deepEqual(results.map(row=>[
    row.variant,row.fatigue,row.status,
    row.detachedRiders,row.lossKilometres]),[
    ['one_weak_climber',10,'full_replay',1,[21]],
    ['one_weak_climber',30,'full_replay',1,[21]],
    ['unequal_descent_catch',10,
      'full_replay',20,[21]],
    ['unequal_descent_catch',30,
      'full_replay',20,[21]]]);
  assert.ok(results.slice(0,2).every(row=>
    row.contacts===0&&row.finishRiders===160&&
    row.riderKilometres===160*distanceKm));
  assert.ok(results.slice(2).every(row=>
    row.contacts===19&&
    row.sharedSplitContacts===18&&
    row.largestRearGroup===20&&
    row.firstLossReplay?.status==='full_replay'&&
    row.finishRiders===160&&
    row.riderKilometres===160*distanceKm));
  for(const first of [0,2]){
    assert.ok(results[first+1]
      .earliestFinishSeconds>results[first]
        .earliestFinishSeconds);
    assert.ok(results[first+1]
      .minimumFinishEnergy<results[first]
        .minimumFinishEnergy);
  }
  assert.ok(results[2].latestFinishSeconds>
    results[0].latestFinishSeconds&&
    results[3].latestFinishSeconds>
      results[1].latestFinishSeconds);
  process.stdout.write(JSON.stringify({results},null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-rear-stage-plan')){
  const results=[120,260].map(distanceKm=>{
    const fatigue=10;
    const reserveEnergy=distanceKm===120?70:50;
    const base=source(distanceKm,fatigue,
      'varied_field');
    const riderId='team-4-3';
    const startInput={...base.startInput,
      soloCommitments:[commitRearSoloPlanV1({
        riderId,distanceKm,stageNumber:1,
        stageCount:2,baseline:{
          goal:'save_for_stage',
          effort:'conserve',
          committedStagePlan:{riderId,
            currentStageNumber:1,
            targetStageNumber:2,
            currentGoal:'finish_safely',
            futureGoal:'target_stage',
            reserveEnergy}}})]};
    const start=startPhysicalBunchV1(startInput);
    const staggered=runPhysicalStaggeredBunchLossV1({
      startInput,start,throughKm:distanceKm});
    const soloField=probePhysicalStaggeredSoloFieldV1({
      startInput,start,staggered,throughKm:distanceKm});
    assert.equal(soloField.refusals.length,0,
      JSON.stringify(soloField.refusals.slice(0,3)));
    const input={startInput,start,staggered,
      soloField,throughKm:distanceKm};
    const race=replayPhysicalStaggeredRearEventsV1(input);
    assert.equal(validatePhysicalStaggeredRearEventsV1(
      input,race),true);
    assert.ok(race.kilometres.every(row=>
      row.riderStates.length===160&&
      row.riderStates.every(state=>
        state.decisions.length>0)));
    assert.equal(Object.keys(race
      .observedFinishSecondsByRider).length,160);
    const saver=race.kilometres.at(-1)
      .riderStates.find(row=>row.riderId===riderId);
    assert.ok(saver.energyAfter>=reserveEnergy);
    if(distanceKm===260){
      const tiredBase=source(distanceKm,30,
        'varied_field');
      const impossibleInput={...tiredBase.startInput,
        soloCommitments:[commitRearSoloPlanV1({
          riderId,distanceKm,stageNumber:1,
          stageCount:2,baseline:{
            goal:'save_for_stage',
            effort:'conserve',
            committedStagePlan:{riderId,
              currentStageNumber:1,
              targetStageNumber:2,
              currentGoal:'finish_safely',
              futureGoal:'target_stage',
              reserveEnergy:70}}})]};
      const impossibleStart=startPhysicalBunchV1(
        impossibleInput);
      const impossibleStaggered=
        runPhysicalStaggeredBunchLossV1({
          startInput:impossibleInput,
          start:impossibleStart,throughKm:distanceKm});
      const impossibleSolo=
        probePhysicalStaggeredSoloFieldV1({
          startInput:impossibleInput,
          start:impossibleStart,
          staggered:impossibleStaggered,
          throughKm:distanceKm});
      assert.deepEqual(impossibleSolo.refusals,[{
        riderId,reason:
          'Staggered solo breaks future-stage reserve.'}]);
    }
    assert.ok(race.kilometres.flatMap(row=>
      row.segments).filter(segment=>
      segment.kind==='group'&&
      segment.riders.some(row=>
        row.riderId===riderId)).every(segment=>
      segment.riders.find(row=>
        row.riderId===riderId).role==='sheltered'));
    return {distanceKm,fatigue,riderId,reserveEnergy,
      contactCount:race.contactCount,
      bunchPaceMatches:race.kilometres.reduce(
        (sum,row)=>sum+row.riderStates
          .filter(state=>state.decisions.some(
            decision=>decision.choice===
              'hold_pace')).length,0),
      saverFinishEnergy:saver.energyAfter,
      saverFinishSeconds:saver.elapsedSeconds,
      saverGroupKilometres:race.kilometres
        .filter(row=>row.riderStates.find(state=>
          state.riderId===riderId)
          .physicalGroupId.startsWith(
            'rear-event-')).length,
      finishRiders:Object.keys(race
        .observedFinishSecondsByRider).length};
  });
  process.stdout.write(JSON.stringify({results},null,2)+'\n');
  process.exit(0);
}

if(process.argv.includes('--probe-rear-events-120')||
  process.argv.includes('--probe-rear-events')){
  const distances=process.argv.includes(
    '--probe-rear-events-120')?[120]:[120,260];
  const results=distances.flatMap(distanceKm=>
    [10,30].map(fatigue=>{
    const input=source(distanceKm,fatigue,
      'varied_field');
    const staggered=runPhysicalStaggeredBunchLossV1({
      ...input,throughKm:distanceKm});
    const soloField=probePhysicalStaggeredSoloFieldV1({
      ...input,staggered,throughKm:distanceKm});
    const race=replayPhysicalStaggeredRearEventsV1({
      ...input,staggered,soloField,throughKm:
        distanceKm});
    assert.equal(validatePhysicalStaggeredRearEventsV1({
      ...input,staggered,soloField,
      throughKm:distanceKm},race),true);
    assert.equal(race.kilometres.length,distanceKm);
    assert.ok(race.kilometres.every(row=>
      row.riderStates.length===160));
    assert.equal(Object.keys(race
      .observedFinishSecondsByRider).length,160);
    assert.equal(race.contacts[0].sourceKm,
      fatigue===30?26:31);
    if(fatigue===30){
      const first=race.contacts[0];
      const split=staggered.road[first.sourceKm-1]
        .splits.filter(row=>first.riders.some(
          rider=>rider.riderId===row.riderId));
      assert.equal(first.source,
        'paid_simultaneous_split');
      assert.equal(first.catchingRoadId,null);
      assert.equal(split.length,2);
      assert.ok(split.every(row=>
        Math.abs(row.atDistanceM-
          first.atDistanceM)<1e-5));
      assert.equal(first.contactDecisions.filter(row=>
        row.choice==='pull').length,1);
      assert.ok(race.kilometres[
        first.sourceKm-1].segments.some(segment=>
        segment.kind==='group'&&
        segment.roadId===first.physicalGroup.id&&
        segment.riders.filter(row=>
          row.role==='leader').length===1&&
        segment.riders.filter(row=>
          row.role==='sheltered').length===1));
    }
    assert.deepEqual(race.contacts[0].riders.map(row=>
      row.riderId),['team-3-3','team-4-3']);
    assert.equal(race.contacts[1].sourceKm,31);
    assert.deepEqual(race.contacts[1].riders.map(row=>
      row.riderId),['team-8-6','team-19-1']);
    assert.equal(race.contacts[2].sourceKm,31);
    assert.equal(race.contacts[2].riders.length,
      fatigue===30?4:3);
    assert.ok(race.contacts.every(contact=>
      contact.riders.every(row=>
        row.energyAtContact>=0)&&
      contact.contactDecisions.length===
        contact.riders.length&&
      contact.contactDecisions.filter(row=>
        row.choice==='pull').length===1));
    assert.ok(race.kilometres.every(row=>
      row.riderStates.every(state=>
        state.decisions.length>0&&
        state.decisions.every(decision=>
          decision?.riderId===state.riderId))));
    return {distanceKm,fatigue,
      status:'full_replay',
      contactCount:race.contactCount,
      bunchPaceMatches:race.kilometres.reduce(
        (sum,row)=>sum+row.riderStates
          .filter(state=>state.decisions.some(
            decision=>decision.choice===
              'hold_pace')).length,0),
      firstContacts:race.contacts.slice(0,5).map(row=>({
        km:row.sourceKm,atDistanceM:row.atDistanceM,
        riderIds:row.riders.map(rider=>
          rider.riderId),
        leaderRiderId:row.leaderRiderId})),
      finishRiders:Object.keys(
        race.observedFinishSecondsByRider).length,
      riderKilometres:race.kilometres.reduce((sum,row)=>
        sum+row.riderStates.length,0),
      minimumFinishEnergy:Math.min(...race
        .kilometres.at(-1).riderStates.map(row=>
          row.energyAfter)),
      earliestFinishSeconds:Math.min(...Object.values(
        race.observedFinishSecondsByRider)),
      latestFinishSeconds:Math.max(...Object.values(
        race.observedFinishSecondsByRider))};
  }));
  process.stdout.write(JSON.stringify({results},null,2)+'\n');
  process.exit(0);
}

const results=process.argv.includes('--probe-varied-120')?
  [10,30].map(fatigue=>
    audit(120,fatigue,'varied_field')):
  process.argv.includes('--probe-varied')?
  [120,260].flatMap(distanceKm=>
    [10,30].map(fatigue=>
      audit(distanceKm,fatigue,'varied_field'))):
  process.argv.includes('--probe-descent')?
  [audit(120,10,'unequal_descent_catch')]:
  [120,260].flatMap(distanceKm=>
  [10,30].flatMap(fatigue=>
    ['equal_field','one_weak_climber',
      'many_weak_climbers',
      'unequal_weak_climbers',
      'nearly_equal_weak_climbers',
      'unequal_descent_catch'].map(variant=>
      audit(distanceKm,fatigue,variant))));
if(process.argv.includes('--assert')){
  assert.equal(results.length,24);
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
      assert.deepEqual(row.paidArrivalPartitions.contactSizes,[20]);
      assert.deepEqual(row.paidArrivalPartitions
        .separateSoloRiderIds,[]);
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
      assert.deepEqual(row.paidArrivalPartitions.contactSizes,[19]);
      assert.deepEqual(row.paidArrivalPartitions
        .separateSoloRiderIds,['team-19-7']);
      assert.equal(row.continuation?.status,'refused');
      assert.match(row.continuation.reason,
        /no recorded meeting/);
      if(row.variant==='unequal_descent_catch'){
        assert.equal(row.mixedContinuation?.status,'refused');
        assert.equal(row.mixedContinuation.sourceKm,36);
        assert.match(row.mixedContinuation.reason,
          /need paid contact road/);
        assert.equal(row.laterMixedContact?.sourceKm,36);
        assert.ok(row.laterMixedContact.atDistanceM>35000&&
          row.laterMixedContact.atDistanceM<36000);
        assert.equal(row.laterMixedContact.riderCount,20);
        assert.ok(row.laterMixedContact.behindBunchSeconds>0);
        assert.ok(row.laterMixedContact.minimumEnergy>=0);
        assert.equal(row.laterMixedRoad?.sourceKm,36);
        assert.equal(row.laterMixedRoad.endDistanceM,36000);
        assert.equal(row.laterMixedRoad.riderCount,20);
        assert.ok(row.laterMixedRoad.gapSecondsToBunch>0);
        assert.ok(row.laterMixedRoad.minimumEnergy>=0);
        assert.equal(row.joinedContinuation?.status,
          'paid_finish');
        assert.equal(row.joinedContinuation.riderKilometres,
          row.distanceKm*fieldSize*ridersPerTeam);
        assert.equal(row.joinedContinuation.finishRiders,160);
        assert.equal(row.joinedContinuation.namedRearLeaders,20);
        assert.ok(row.joinedContinuation.minimumEnergy>=0);
      }else{
        assert.equal(row.mixedContinuation?.status,'paid_finish');
        assert.equal(row.mixedContinuation.riderKilometres,
          row.distanceKm*fieldSize*ridersPerTeam);
        assert.equal(row.mixedContinuation.finishRiders,160);
        assert.equal(row.mixedContinuation.namedRearLeaders,19);
        assert.ok(row.mixedContinuation.minimumEnergy>=0);
      }
    }
  }
}
if(process.argv.includes('--assert-varied')){
  assert.equal(results.length,4);
  for(const row of results){
    assert.equal(row.variant,'varied_field');
    assert.equal(row.status,'paid_split');
    assert.equal(row.sourceKm,21);
    assert.equal(row.staggeredScale?.status,
      'paid_bunch_finish');
    assert.equal(row.staggeredScale.sourceVersion,
      'v2-physical-staggered-bunch-loss-2');
    assert.equal(row.staggeredScale
      .singleLeaderEveryKm,true);
    assert.equal(row.staggeredScale
      .validPaceMatches,true);
    assert.equal(row.staggeredScale
      .everyBunchRiderDecided,true);
    assert.ok(row.staggeredScale.paidPaceMatches>300);
    assert.ok(row.staggeredScale.detachedRiders>=35);
    assert.equal(row.staggeredScale.paidLossCompletions,
      row.staggeredScale.detachedRiders);
    assert.equal(row.staggeredScale.soloCandidates,
      row.staggeredScale.detachedRiders);
    assert.equal(row.staggeredScale.soloRefusals.length,0);
    const firstFieldContact=row.staggeredScale
      .firstSoloFieldContact;
    assert.equal(firstFieldContact.sourceKm,
      row.fatigue===30?26:31);
    assert.deepEqual(firstFieldContact.riderIds,
      ['team-3-3','team-4-3']);
    if(row.fatigue===10)
      assert.equal(firstFieldContact.catchingRiderId,
        'team-4-3');
    assert.ok(firstFieldContact.atDistanceM>
      (firstFieldContact.sourceKm-1)*1000&&
      firstFieldContact.atDistanceM<
        firstFieldContact.sourceKm*1000&&
      firstFieldContact.riders.every(rider=>
        rider.energyAtContact>=0));
    const next=row.staggeredScale.nextContact;
    assert.equal(next.length,1);
    assert.equal(next[0].kind,
      'two_other_solos_meet');
    assert.equal(next[0].sourceKm,31);
    assert.deepEqual(next[0].riderIds,
      ['team-8-6','team-19-1']);
    assert.ok(next[0].atDistanceM>30000&&
      next[0].atDistanceM<31000&&
      next[0].riders.every(rider=>
        rider.energyAtContact>=0));
    assert.ok(next[0].riderIds.includes(
      next[0].catchingRiderId));
    const second=row.staggeredScale.secondRearPair;
    assert.equal(second.sourceKm,31);
    assert.equal(second.steps,row.distanceKm-31);
    assert.equal(second.leaderRiderId,
      next[0].catchingRiderId);
    assert.equal(second.roadRoles.filter(rider=>
      rider.role==='leader').length,1);
    assert.equal(second.roadRoles.filter(rider=>
      rider.role==='sheltered').length,1);
    assert.ok(second.roadRoles.every(rider=>
      rider.energySpent>0));
    assert.equal(second.oneLeaderEveryKm,true);
    assert.equal(second.paidShelterEveryKm,true);
    assert.equal(second.leaders.length,2);
    assert.equal(second.otherRidersUnsettled,true);
    const third=row.staggeredScale.thirdContact;
    assert.equal(third.length,1);
    assert.equal(third[0].sourceKm,31);
    assert.ok(third[0].atDistanceM>30000&&
      third[0].atDistanceM<31000);
    assert.ok(third[0].riders.every(rider=>
      rider.energyAtContact>=0));
    if(row.fatigue===10){
      assert.equal(third[0].kind,
        'rear_pair_meets_solo');
      assert.equal(third[0].roadIds[1],
        'team-14-6');
    }else
      assert.equal(third[0].kind,
        'rear_pair_meets_rear_pair');
    const merged=row.staggeredScale.thirdRearGroup;
    assert.equal(merged.sourceKm,31);
    assert.equal(merged.riderCount,
      row.fatigue===10?3:4);
    assert.equal(merged.steps,row.distanceKm-31);
    assert.equal(merged.roadRoles.filter(rider=>
      rider.role==='leader').length,1);
    assert.equal(merged.roadRoles.filter(rider=>
      rider.role==='sheltered').length,
    merged.riderCount-1);
    assert.equal(merged.oneLeaderEveryKm,true);
    assert.equal(merged.paidShelterEveryKm,true);
    assert.equal(merged.otherRidersUnsettled,true);
    assert.equal(merged.genericTrackMatchesRoad,true);
    assert.equal(merged.genericNextTrackMatches,true);
    if(row.fatigue===10){
      const road=row.staggeredScale
        .laterFieldContactRoad;
      assert.equal(road.sourceKm,31);
      assert.equal(road.riders.length,2);
      assert.equal(road.riders.filter(rider=>
        rider.role==='leader').length,1);
      assert.ok(road.riders.every(rider=>
        rider.energySpent>0&&
        rider.recoveryAward===0));
      const pair=row.staggeredScale
        .laterPairContinuation;
      assert.equal(pair.status,'paid_pair_road');
      assert.equal(pair.steps,row.distanceKm-31);
      assert.equal(pair.leaders,2);
      assert.equal(pair.oneLeaderEveryKm,true);
      assert.equal(pair.paidShelterEveryKm,true);
    }else
      assert.equal(row.staggeredScale
        .laterFieldContactRoad,null);
    assert.equal(row.staggeredScale
      .nearCoincidentArrivals,
    row.fatigue===30?1:0);
    assert.equal(row.staggeredScale.separateArrivalSolos+
      row.staggeredScale.nearCoincidentArrivalRows.reduce((sum,
        contact)=>sum+contact.riderIds.length,0),
    row.staggeredScale.detachedRiders);
    assert.ok(row.staggeredScale.nearCoincidentArrivalRows.every(
      contact=>contact.riderIds.length>=2&&
      contact.atDistanceM===contact.sourceKm*1000));
    assert.equal(row.staggeredScale.withinLossKmContactPairs,
      row.fatigue===30?1:0);
    assert.ok(row.staggeredScale.firstWithinLossKmContacts
      .every(contact=>contact.sourceKm===26&&
        contact.atDistanceM>25000&&
        contact.atDistanceM<26000&&
        contact.riders.every(rider=>
          rider.energyAtContact>=0&&
          rider.energySpentToContact>0&&
          rider.energyAtContact<
            rider.energyBeforeAtKm)));
    assert.equal(row.staggeredScale
      .paidContactRemainders.length,
    row.staggeredScale.withinLossKmContactPairs);
    assert.ok(row.staggeredScale
      .paidContactRemainders.every(road=>
        road.riders.length===2&&
        road.riders.filter(rider=>
          rider.role==='leader').length===1&&
        road.riders.filter(rider=>
          rider.role==='sheltered').length===1&&
        road.riders.find(rider=>
          rider.role==='sheltered').energySpent<
          road.riders.find(rider=>
            rider.role==='leader').energySpent&&
        road.riders.every(rider=>
          rider.energySpent>0&&
          rider.energyAfter>=0&&
          rider.recoveryAward===0)));
    if(row.fatigue===30){
      const pair=row.staggeredScale
        .rearPairContinuation;
      assert.equal(pair.status,'paid_pair_road');
      assert.equal(pair.sourceKm,row.distanceKm);
      assert.equal(pair.steps,row.distanceKm-26);
      assert.equal(pair.alternatingLeaders,2);
      assert.equal(pair.oneLeaderEveryKm,true);
      assert.equal(pair.paidShelterEveryKm,true);
      assert.ok(pair.endClock>0);
    }else
      assert.equal(row.staggeredScale
        .rearPairContinuation,null);
    assert.ok(row.staggeredScale.namedLeaders>=12);
    assert.equal(row.staggeredScale.emergencyTurns,0);
    assert.equal(row.staggeredScale.bunchFinishRiders,
      160-row.staggeredScale.detachedRiders);
  }
}
process.stdout.write(JSON.stringify({
  version:'physical-field-scale-audit-1',
  fieldSize:fieldSize*ridersPerTeam,results},null,2)+'\n');
