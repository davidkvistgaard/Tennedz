import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {probeLastKmRotationSoloFromTour} from
  './finale-last-km-rotation-solo.mjs';
import {recordFinaleRotationSoloSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {FINALE_SPRINT_WORK_COST_PER_KM} from
  './finale-sprint-launch.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {finalePassiveBunchSpeed,finalePassiveFrontSpeed,
  finaleWorkerStep,FINALE_WORKER_PASSIVE_SLOPE_VERSION} from
  './finale-worker.mjs';
import {segmentBaseSeconds} from './finish.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_ONE_CLOCK_SOLO_VERSION=
  'v2-finale-one-clock-solo-1';
export const FINALE_ONE_CLOCK_SOLO_LEAD_OUT_VERSION=
  'v2-finale-one-clock-solo-lead-out-2';
const EPSILON=1e-8;
const secondsPerKm=(segment,ability,effort=0,draft=0)=>
  segmentBaseSeconds(segment)+(50-ability-effort-draft)*
    TUNING.breakaway.driftSecondsPerAbilityPoint;
const positionAt=(movement,seconds)=>movement.startM+
  movement.ownVelocityMps*Math.min(seconds,movement.switchSeconds)+
  movement.bunchVelocityMps*Math.max(0,
    seconds-movement.switchSeconds);

function timeToPosition(movement,targetM){
  const ownEnd=movement.startM+movement.ownVelocityMps*
    movement.switchSeconds;
  return targetM<=ownEnd+EPSILON?
    Math.max(0,(targetM-movement.startM)/movement.ownVelocityMps):
    movement.switchSeconds+(targetM-ownEnd)/
      movement.bunchVelocityMps;
}

function contactTime(solo,other,limitSeconds){
  if(other.startM>=solo.startM-EPSILON)
    throw new Error('A solo source has an unrecorded rider ahead.');
  const boundaries=[0,Math.min(limitSeconds,other.switchSeconds),
    limitSeconds].filter((value,index,values)=>index===0||
      value>values[index-1]+EPSILON);
  for(let index=1;index<boundaries.length;index++){
    const before=boundaries[index-1],after=boundaries[index];
    const beforeGap=positionAt(other,before)-positionAt(solo,before);
    const afterGap=positionAt(other,after)-positionAt(solo,after);
    if(beforeGap<0&&afterGap>=0)
      return Math.min(after,before+(after-before)*(-beforeGap)/
        (afterGap-beforeGap));
  }
  return null;
}

function plannedMovement({riderId,role,startM,ownVelocityMps,
  bunchVelocityMps,workCostPerKm,shelteredCostPerKm,
  bunchStartM,durationSeconds}){
  const gapM=Math.max(0,startM-bunchStartM);
  const switchSeconds=ownVelocityMps>=bunchVelocityMps?
    durationSeconds:gapM<=EPSILON?0:
      Math.min(durationSeconds,gapM/
        (bunchVelocityMps-ownVelocityMps));
  return {riderId,role,startM,ownVelocityMps,bunchVelocityMps,
    workCostPerKm,shelteredCostPerKm,switchSeconds};
}

function paidPosition(movement,seconds,energyAtDecision,finishM,
  elapsedAtStart){
  const lineSeconds=timeToPosition(movement,finishM);
  const activeSeconds=Math.min(seconds,lineSeconds);
  const ownSeconds=Math.min(activeSeconds,movement.switchSeconds);
  const shelteredSeconds=Math.max(0,activeSeconds-ownSeconds);
  const ownDistanceM=ownSeconds*movement.ownVelocityMps;
  const shelteredDistanceM=shelteredSeconds*movement.bunchVelocityMps;
  const energySpent=(ownDistanceM*movement.workCostPerKm+
    shelteredDistanceM*movement.shelteredCostPerKm)/1000;
  if(energySpent>energyAtDecision+EPSILON)
    throw new Error(`A finale rider cannot pay for travel: ${
      movement.riderId}.`);
  const crossed=lineSeconds<=seconds+EPSILON;
  return {riderId:movement.riderId,role:movement.role,
    positionBeforeM:movement.startM,
    positionM:crossed?finishM:positionAt(movement,seconds),
    distanceTravelledM:ownDistanceM+shelteredDistanceM,
    activeDistanceM:ownDistanceM,shelteredDistanceM,
    energyAtDecision,energySpent,
    energyAfter:Math.max(0,energyAtDecision-energySpent),
    elapsedToLineSeconds:crossed?elapsedAtStart+lineSeconds:null};
}

// Align the solo's earlier 500 m arrival with the bunch's clock. Continue
// its measured preceding 250 m pace for exactly the recorded time gap and
// pay the same measured work rate for that extra distance.
function alignSource(road,soloId){
  const source=road.at500M;
  const prior=road.frames.at(-1);
  const spent=prior.riderEnergy.find(row=>row.riderId===soloId)
    ?.energySpent;
  const sourceEnergy=source.riderEnergy.find(row=>row.riderId===soloId)
    ?.energy;
  const gapSeconds=source.roadGroups[0]?.gapSeconds;
  if(!Number.isFinite(spent)||spent<0||
    !Number.isFinite(sourceEnergy)||
    !Number.isFinite(prior.frontSpeedKph)||
    !Number.isFinite(gapSeconds)||gapSeconds<=0||
    prior.endDistanceM-prior.startDistanceM!==250)
    throw new Error('The solo has no paid common-clock handoff.');
  const advanceM=prior.frontSpeedKph/3.6*gapSeconds;
  const energySpent=spent*advanceM/250;
  if(advanceM>=100||energySpent>sourceEnergy+EPSILON)
    throw new Error('The solo cannot pay for its source lead.');
  return {version:'v2-finale-solo-source-alignment-1',
    bunchDistanceM:source.distanceM,
    soloPositionM:source.distanceM+advanceM,
    soloEnergyAt500M:sourceEnergy,
    soloEnergyAtBunch500M:Math.max(0,sourceEnergy-energySpent),
    gapSeconds,advanceM,energySpent,
    elapsedSecondsAtBunch500M:source.bunchElapsedSeconds};
}

// A complete 500 m attempt on one clock. The v1 scope has one solo, no
// lead-out and no rival attack. Every rider moves and pays until either an
// exact solo contact stops this version or all riders cross the line. The
// collapsed source bunch still has no wheel order or passing-lane evidence.
export function recordFinaleOneClockSoloFromTour(tour,input){
  return recordOneClockSolo(tour,input,{allowLeadOut:false,
    version:FINALE_ONE_CLOCK_SOLO_VERSION});
}

// The separate version pays a nominated bunch helper and their finisher on
// the same clock as the solo. Earlier no-lead-out recordings stay unchanged.
export function recordFinaleOneClockSoloWithLeadOutFromTour(tour,input){
  return recordOneClockSolo(tour,input,{allowLeadOut:true,
    version:FINALE_ONE_CLOCK_SOLO_LEAD_OUT_VERSION});
}

function recordOneClockSolo(tour,input,{allowLeadOut,version}){
  const road=probeLastKmRotationSoloFromTour(tour,{
    teamId:input.attackTeamId});
  const plan=recordFinaleRotationSoloSprintPlanFromTour(tour,input);
  if(!allowLeadOut&&plan.decisions.some(row=>row.leadOutRiderId))
    throw new Error('One-clock solo v1 needs no pre-contact lead-out.');
  const teams=tour.committedInputs.teams;
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const teamByRiderId=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,team.id])));
  const soloId=road.at500M.roadGroups[0]?.riderIds[0];
  const soloGroupId=road.at500M.roadGroups[0]?.id;
  const bunchIds=road.at500M.pelotonRiderIds;
  const allIds=[soloId,...bunchIds];
  const finishM=tour.route.distanceKm*1000;
  if(!soloId||!soloGroupId||!teamByRiderId.has(soloId)||
    allIds.length!==ridersById.size||
    new Set(allIds).size!==allIds.length||
    road.at500M.distanceM!==finishM-500)
    throw new Error('One-clock solo needs one complete 500 m road.');
  const alignment=alignSource(road,soloId);
  const energyById=new Map(road.at500M.riderEnergy.map(row=>
    [row.riderId,row.energy]));
  const state=new Map(allIds.map(id=>[id,{
    positionM:id===soloId?alignment.soloPositionM:
      road.at500M.distanceM,
    energy:id===soloId?alignment.soloEnergyAtBunch500M:
      energyById.get(id),elapsedToLineSeconds:null}]));
  if([...state.values()].some(row=>!Number.isFinite(row.energy)||
    row.energy<0))throw new Error('One-clock solo lost source energy.');
  let elapsedSeconds=alignment.elapsedSecondsAtBunch500M;
  const frames=[];
  const grid=finaleDistanceGrid(tour.route,{remainingKm:1})
    .filter(slice=>slice.startDistanceM>=finishM-500);
  if(grid.length!==5||grid.some(slice=>slice.lengthM!==100))
    throw new Error('One-clock solo needs five finish slices.');
  for(const slice of grid){
    const frame=advanceSoloSlice({tour,slice,teams,ridersById,
      teamByRiderId,plan,soloId,soloGroupId,bunchIds,finishM,state,
      elapsedSeconds,allowLeadOut});
    frames.push(frame);
    for(const row of frame.riders)state.set(row.riderId,{
      positionM:row.positionM,energy:row.energyAfter,
      elapsedToLineSeconds:row.elapsedToLineSeconds??
        state.get(row.riderId).elapsedToLineSeconds});
    elapsedSeconds+=frame.durationSeconds;
    if(frame.contact)return {version,
      sourceRoadTraceVersion:road.version,
      sprintPlanVersion:plan.version,alignment,
      startDistanceM:finishM-500,lineDistanceM:finishM,
      frames,outcome:'contact_uncontinued',contact:frame.contact,
      finishers:null,resultStatus:'unclassified',
      pointsStatus:'withheld',canCommitAwards:false};
  }
  const finishers=allIds.map(riderId=>({riderId,
    teamId:teamByRiderId.get(riderId),
    elapsedSecondsFromLastKmStart:
      state.get(riderId).elapsedToLineSeconds,
    energyAtLine:state.get(riderId).energy}));
  if(finishers.some(row=>!Number.isFinite(
    row.elapsedSecondsFromLastKmStart)))
    throw new Error('One-clock solo lost an individual at the line.');
  return {version,
    sourceRoadTraceVersion:road.version,
    sprintPlanVersion:plan.version,alignment,
    startDistanceM:finishM-500,lineDistanceM:finishM,
    frames,outcome:'separated_line',contact:null,finishers,
    resultStatus:'provisional_conditional',
    pointsStatus:'withheld',canCommitAwards:false};
}

function advanceSoloSlice({tour,slice,teams,ridersById,teamByRiderId,
  plan,soloId,soloGroupId,bunchIds,finishM,state,elapsedSeconds,
  allowLeadOut}){
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const energies=new Map([...state].map(([id,row])=>[id,row.energy]));
  const bunchAtStart=bunchIds.filter(id=>
    state.get(id).elapsedToLineSeconds===null&&
    state.get(id).positionM<=slice.startDistanceM+EPSILON);
  if(!bunchAtStart.length)
    throw new Error('One-clock solo has no bunch at the next boundary.');
  const sprinting=new Set(slice.startDistanceM<finishM-300?[]:
    plan.decisions.map(row=>row.finisherId).filter(id=>{
      const current=state.get(id);
      if(current.elapsedToLineSeconds!==null)return false;
      const effect=riderKilometreEffect(ridersById.get(id),segment,{
        phase:'finale',energy:current.energy,exposed:segment.exposed});
      return FINALE_SPRINT_WORK_COST_PER_KM*
        effect.energyCostMultiplier*.1<=current.energy+EPSILON;
    }));
  const leadOuts=new Map();
  if(allowLeadOut&&slice.startDistanceM<finishM-300){
    for(const decision of plan.decisions){
      const helperId=decision.leadOutRiderId;
      const helper=state.get(helperId);
      const finisher=state.get(decision.finisherId);
      if(!helperId||!helper||!finisher||
        helper.elapsedToLineSeconds!==null||
        finisher.elapsedToLineSeconds!==null||
        helper.positionM<slice.startDistanceM-EPSILON||
        Math.abs(helper.positionM-finisher.positionM)>EPSILON)
        continue;
      const helperEnergy=energies.get(helperId);
      if(decision.leadOutWorkCostPerKm*.1>helperEnergy+EPSILON)
        continue;
      leadOuts.set(helperId,{...decision,role:'lead_out'});
      leadOuts.set(decision.finisherId,{...decision,
        role:'lead_out_finisher'});
    }
  }
  const chasers=[];
  for(const team of teams){
    if(team.id===teamByRiderId.get(soloId))continue;
    const order=orderAt(team.orders,slice.sourceKm-1);
    if(order.attack!=='none'||order.chase==='selective')
      throw new Error('One-clock solo needs rival attacks and conditional chase recorded.');
    if(order.chase!=='all')continue;
    for(const riderId of team.orders.helperIds){
      if(!bunchAtStart.includes(riderId)||sprinting.has(riderId)||
        leadOuts.has(riderId))continue;
      const energy=energies.get(riderId);
      if(energy<TUNING.chase.minHelperEnergy)continue;
      const step=finaleWorkerStep({rider:ridersById.get(riderId),
        segment,order,energy,role:'chase',
        paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
      if(energyCostForFinaleSlice(slice,step.workCostPerKm)<=
        energy+EPSILON)
        chasers.push({teamId:team.id,riderId,step});
    }
  }
  chasers.sort((a,b)=>b.step.speedKph-a.step.speedKph||
    a.teamId.localeCompare(b.teamId)||
    a.riderId.localeCompare(b.riderId));
  const chase=chasers[0]??null;
  const busyTeamIds=new Set([teamByRiderId.get(soloId)]);
  if(chase)busyTeamIds.add(chase.teamId);
  for(const decision of leadOuts.values())
    busyTeamIds.add(decision.teamId);
  for(const decision of plan.decisions)
    if(sprinting.has(decision.finisherId)&&
      teams.find(team=>team.id===decision.teamId).orders.helperIds
        .includes(decision.finisherId))
      busyTeamIds.add(decision.teamId);
  const rotation=recordFinaleFrontRotationSlice({slice,
    route:tour.route,teams,pelotonRiderIds:bunchAtStart,
    energies,busyTeamIds:[...busyTeamIds]});
  const rotationWorkers=new Map(rotation.selected?.work.map(row=>
    [row.riderId,row])??[]);
  if(rotationWorkers.has(chase?.riderId)||
    [...rotationWorkers.keys()].some(id=>sprinting.has(id)||
      leadOuts.has(id)))
    throw new Error('One-clock solo assigned two jobs to a rider.');
  const passiveIds=bunchAtStart.filter(id=>!sprinting.has(id));
  if(!passiveIds.length)
    throw new Error('One-clock solo has no passive bunch pace.');
  const passiveSpeedKph=finalePassiveBunchSpeed({riderIds:passiveIds,
    ridersById,energies,segment});
  const bunchSpeedKph=Math.max(passiveSpeedKph,
    chase?.step.speedKph??0,rotation.selected?.speedKph??0);
  const bunchVelocityMps=bunchSpeedKph/3.6;
  const fullDurationSeconds=100/bunchVelocityMps;
  const soloState=state.get(soloId);
  let soloMovement=null,frontRiderId=null;
  if(soloState.elapsedToLineSeconds===null){
    const energy=soloState.energy;
    const soloRider=ridersById.get(soloId);
    const effect=riderKilometreEffect(soloRider,segment,{
      phase:sprinting.has(soloId)?'finale':'solo',energy,
      exposed:segment.exposed});
    let speedKph,workCostPerKm,role;
    if(sprinting.has(soloId)){
      speedKph=3600/secondsPerKm(segment,effect.ability,
        TUNING.finish.finaleEffortAbilityPoints.hard);
      workCostPerKm=FINALE_SPRINT_WORK_COST_PER_KM*
        effect.energyCostMultiplier;
      role='solo_sprint';
    }else{
      const team=teams.find(row=>row.id===
        teamByRiderId.get(soloId));
      const order=orderAt(team.orders,slice.sourceKm-1);
      const proposal=order.breakWork==='sit_on'||
        energy<TUNING.breakaway.minPullEnergy?null:
        finaleWorkerStep({rider:soloRider,segment,order,energy,
          role:'front',
          paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
      const front=proposal&&energyCostForFinaleSlice(slice,
        proposal.workCostPerKm)<=energy+EPSILON?proposal:null;
      speedKph=front?.speedKph??finalePassiveFrontSpeed({
        riderIds:[soloId],ridersById,energies,segment});
      workCostPerKm=front?.workCostPerKm??
        TUNING.effortCost.conserve*
          riderKilometreEffect(soloRider,segment,{phase:'chase',
            energy,exposed:segment.exposed}).energyCostMultiplier;
      role=front?'solo_front':'solo_passive';
      frontRiderId=front?soloId:null;
    }
    const velocity=speedKph/3.6;
    soloMovement={riderId:soloId,role,startM:soloState.positionM,
      ownVelocityMps:velocity,bunchVelocityMps:velocity,
      switchSeconds:fullDurationSeconds,
      workCostPerKm,shelteredCostPerKm:workCostPerKm};
  }
  const movements=new Map();
  if(soloMovement)movements.set(soloId,soloMovement);
  for(const riderId of bunchIds){
    const current=state.get(riderId);
    if(current.elapsedToLineSeconds!==null)continue;
    const energy=current.energy;
    const effect=riderKilometreEffect(ridersById.get(riderId),
      segment,{phase:sprinting.has(riderId)?'finale':'chase',
        energy,exposed:segment.exposed});
    const shelteredRate=TUNING.effortCost.conserve*
      effect.energyCostMultiplier;
    let role='sheltered',velocity=bunchVelocityMps;
    let workRate=shelteredRate;
    const leadOut=leadOuts.get(riderId);
    if(leadOut){
      const helperId=leadOut.leadOutRiderId;
      const helperEnergy=energies.get(helperId);
      const helperEffect=riderKilometreEffect(
        ridersById.get(helperId),segment,{phase:'chase',
          energy:helperEnergy,exposed:segment.exposed});
      const effort=TUNING.finish.finaleEffortAbilityPoints.hard*
        Math.min(1,helperEnergy/TUNING.finish.fullEffortEnergy);
      velocity=1000/secondsPerKm(segment,helperEffect.ability,
        effort,TUNING.breakaway.bunchDraftAdvantage);
      role=leadOut.role;
      if(role==='lead_out')workRate=leadOut.leadOutWorkCostPerKm;
    }else if(sprinting.has(riderId)){
      velocity=1000/secondsPerKm(segment,effect.ability,
        TUNING.finish.finaleEffortAbilityPoints.hard);
      workRate=FINALE_SPRINT_WORK_COST_PER_KM*
        effect.energyCostMultiplier;
      role='sprint';
    }else if(current.positionM>slice.startDistanceM+EPSILON){
      velocity=1000/secondsPerKm(segment,effect.ability);
      workRate=(TUNING.effortCost.conserve+
        TUNING.breakaway.extraCostPerKm)*
          effect.energyCostMultiplier;
      role='exposed_coast';
    }else if(riderId===chase?.riderId){
      workRate=chase.step.workCostPerKm;
      role='chase';
    }else if(rotationWorkers.has(riderId)){
      workRate=rotationWorkers.get(riderId).energySpent*10;
      role='front_rotation';
    }
    movements.set(riderId,plannedMovement({riderId,role,
      startM:current.positionM,ownVelocityMps:velocity,
      bunchVelocityMps,workCostPerKm:workRate,
      shelteredCostPerKm:sprinting.has(riderId)&&
        current.positionM<=slice.startDistanceM+EPSILON?
        workRate:leadOut?.role==='lead_out'?workRate:
          shelteredRate,
      bunchStartM:slice.startDistanceM,
      durationSeconds:fullDurationSeconds}));
  }
  let durationSeconds=fullDurationSeconds,contact=null;
  if(soloMovement){
    const soloLineSeconds=timeToPosition(soloMovement,finishM);
    const limit=Math.min(fullDurationSeconds,soloLineSeconds);
    const candidates=[...movements.values()].filter(row=>
      row.riderId!==soloId).map(row=>({riderId:row.riderId,
        seconds:contactTime(soloMovement,row,limit)}))
      .filter(row=>row.seconds!==null)
      .sort((a,b)=>a.seconds-b.seconds||
        a.riderId.localeCompare(b.riderId));
    if(candidates.length){
      durationSeconds=Math.max(0,candidates[0].seconds);
      contact={kind:'solo_contact',
        riderIds:candidates.filter(row=>Math.abs(
          row.seconds-durationSeconds)<=EPSILON)
          .map(row=>row.riderId),
        distanceM:positionAt(soloMovement,durationSeconds),
        elapsedSeconds:elapsedSeconds+durationSeconds};
    }
  }
  const riders=[soloId,...bunchIds].map(riderId=>{
    const current=state.get(riderId);
    if(current.elapsedToLineSeconds!==null)return {riderId,
      role:'finished',positionBeforeM:finishM,positionM:finishM,
      distanceTravelledM:0,activeDistanceM:0,
      shelteredDistanceM:0,energyAtDecision:current.energy,
      energySpent:0,energyAfter:current.energy,
      elapsedToLineSeconds:current.elapsedToLineSeconds};
    return paidPosition(movements.get(riderId),durationSeconds,
      current.energy,finishM,elapsedSeconds);
  });
  const bunchRecontacts=[...movements.values()].filter(row=>
    row.riderId!==soloId&&
    row.startM>slice.startDistanceM+EPSILON&&
    row.switchSeconds>EPSILON&&
    row.switchSeconds<=durationSeconds+EPSILON&&
    timeToPosition(row,finishM)>=row.switchSeconds-EPSILON&&
    state.get(row.riderId).elapsedToLineSeconds===null)
    .map(row=>({riderId:row.riderId,
      elapsedSeconds:elapsedSeconds+row.switchSeconds,
      positionM:slice.startDistanceM+
        bunchVelocityMps*row.switchSeconds}));
  const bunchPositionM=slice.startDistanceM+
    bunchVelocityMps*durationSeconds;
  const aheadIds=riders.filter(row=>row.riderId!==soloId&&
    row.elapsedToLineSeconds===null&&
    row.positionM>bunchPositionM+EPSILON).map(row=>row.riderId);
  const aheadGroups=[];
  const grouped=new Set();
  for(const id of aheadIds){
    if(grouped.has(id))continue;
    const lead=leadOuts.get(id);
    const pairId=lead?.role==='lead_out'?
      lead.finisherId:lead?.leadOutRiderId;
    const positionM=riders.find(row=>row.riderId===id).positionM;
    if(allowLeadOut&&pairId&&aheadIds.includes(pairId)&&
      Math.abs(riders.find(row=>row.riderId===pairId).positionM-
        positionM)<=EPSILON){
      aheadGroups.push({id:`lead-out:${lead.teamId}`,
        riderIds:[lead.leadOutRiderId,lead.finisherId],
        positionM});
      grouped.add(id);
      grouped.add(pairId);
    }else{
      aheadGroups.push({id:`move:${id}`,riderIds:[id],positionM});
      grouped.add(id);
    }
  }
  const pelotonRiderIds=riders.filter(row=>row.riderId!==soloId&&
    row.elapsedToLineSeconds===null&&
    row.positionM<=bunchPositionM+EPSILON).map(row=>row.riderId);
  return {startDistanceM:slice.startDistanceM,
    endDistanceM:contact?.distanceM??slice.endDistanceM,
    elapsedSecondsAtStart:elapsedSeconds,durationSeconds,
    bunchPositionM,bunchSpeedKph,passiveSpeedKph,
    chaseRiderId:chase?.riderId??null,frontRiderId,
    rotation,sprintingRiderIds:[...sprinting],
    ...(allowLeadOut?{leadOutRiderIds:[...leadOuts.keys()]
      .filter(id=>leadOuts.get(id).role==='lead_out')}:{}),
    roadGroups:[...(soloMovement?[{id:soloGroupId,
      riderIds:[soloId],positionM:riders[0].positionM}]:[]),
    ...aheadGroups],
    pelotonRiderIds,bunchRecontacts,contact,riders};
}

export function validateFinaleOneClockSoloFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleOneClockSoloFromTour(tour,input)))
    throw new Error('The one-clock solo finale does not replay.');
  return true;
}

export function validateFinaleOneClockSoloWithLeadOutFromTour(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleOneClockSoloWithLeadOutFromTour(tour,input)))
    throw new Error('The one-clock lead-out finale does not replay.');
  return true;
}
