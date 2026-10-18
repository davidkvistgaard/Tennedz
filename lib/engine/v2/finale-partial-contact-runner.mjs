import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {FINALE_ONE_CLOCK_SOLO_LEAD_OUT_VERSION,
  planFinaleMovement,payFinalePosition,
  validateFinaleOneClockSoloWithLeadOutFromTour} from
  './finale-one-clock-solo.mjs';
import {positionedRoadEvents} from './finale-paid-bunch-runner.mjs';
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

export const FINALE_PARTIAL_CONTACT_RUNNER_VERSION=
  'v2-finale-passive-partial-contact-runner-1';
export const FINALE_CHASED_PARTIAL_CONTACT_RUNNER_VERSION=
  'v2-finale-chased-partial-contact-runner-2';
export const FINALE_CHASED_PARTIAL_AFTER_LEAD_OUT_VERSION=
  'v2-finale-chased-partial-after-lead-out-runner-3';
const EPSILON=1e-8;
const secondsPerKm=(segment,ability,effort=0,draft=0)=>
  segmentBaseSeconds(segment)+(50-ability-effort-draft)*
    TUNING.breakaway.driftSecondsPerAbilityPoint;

export function isPassivePartialContactEligible(tour,input,oneClock){
  return partialContactEligible(tour,input,oneClock,false);
}

export function isChasedPartialContactEligible(tour,input,oneClock){
  return partialContactEligible(tour,input,oneClock,true);
}

export function isChasedPartialAfterLeadOutEligible(tour,input,oneClock){
  return partialContactEligible(tour,input,oneClock,true,true);
}

function partialContactEligible(tour,input,oneClock,allowChase,
  allowSpentLeadOut=false){
  const last=oneClock?.frames?.at(-1);
  const contact=oneClock?.contact;
  const riders=last?.riders??[];
  if(oneClock?.version!==FINALE_ONE_CLOCK_SOLO_LEAD_OUT_VERSION||
    oneClock.outcome!=='contact_uncontinued'||!last||!contact||
    contact.kind!=='solo_contact'||!contact.riderIds.length||
    contact.riderIds.length===riders.length-1||
    !Number.isFinite(last.bunchPositionM)||
    last.bunchPositionM>=contact.distanceM-EPSILON||
    (allowChase?last.chaseRiderId===null:
      last.chaseRiderId!==null)||last.rotation?.selected!==null||
    riders.some(row=>row.elapsedToLineSeconds!==null))return false;
  const plan=recordFinaleRotationSoloSprintPlanFromTour(tour,input);
  const orderedLeadOut=plan.decisions.some(row=>
    row.leadOutRiderId!==null);
  if(allowSpentLeadOut?(!orderedLeadOut||
    contact.distanceM<tour.route.distanceKm*1000-300-EPSILON||
    !Array.isArray(last.leadOutRiderIds)||
    last.leadOutRiderIds.length!==0||
    last.riders.some(row=>row.role.startsWith('lead_out'))||
    !oneClock.frames.some(frame=>
      frame.leadOutRiderIds?.length>0)):orderedLeadOut)return false;
  const soloId=oneClock.frames[0]?.roadGroups[0]?.riderIds[0];
  const soloTeam=tour.committedInputs.teams.find(team=>
    team.riders.some(rider=>rider.id===soloId))?.id;
  const firstKm=tour.route.distanceKm-1;
  return Boolean(soloTeam)&&tour.committedInputs.teams.every(team=>{
    if(team.id===soloTeam)return true;
    const order=orderAt(team.orders,firstKm);
    return order.attack==='none'&&
      (order.chase==='ignore'||allowChase&&order.chase==='all');
  });
}

// A measured solo/sprinter contact with a passive bunch behind it. The
// current work continues to the next grid boundary; later work is selected
// from the same orders and actual energy. No drafting, lane or classified
// within-bunch place is inferred from physical contact.
export function recordFinalePassivePartialContactFromTour(tour,input,
  oneClock){
  return recordPartialContact(tour,input,oneClock,false);
}

export function recordFinaleChasedPartialContactFromTour(tour,input,
  oneClock){
  return recordPartialContact(tour,input,oneClock,true);
}

// This version accepts a lead-out only when its paid pull ended before the
// measured contact and the final sprint has already begun.
export function recordFinaleChasedPartialAfterLeadOutFromTour(tour,input,
  oneClock){
  return recordPartialContact(tour,input,oneClock,true,true);
}

function recordPartialContact(tour,input,oneClock,allowChase,
  allowSpentLeadOut=false){
  validateFinaleOneClockSoloWithLeadOutFromTour(tour,input,oneClock);
  const plan=recordFinaleRotationSoloSprintPlanFromTour(tour,input);
  const last=oneClock.frames.at(-1);
  const contact=oneClock.contact;
  const teams=tour.committedInputs.teams;
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const teamById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,team.id])));
  const soloId=oneClock.frames[0].roadGroups[0]?.riderIds[0];
  const ids=last?.riders.map(row=>row.riderId)??[];
  const finishM=tour.route.distanceKm*1000;
  if(!partialContactEligible(tour,input,oneClock,allowChase,
    allowSpentLeadOut)||
    !soloId||
    ids.length!==ridersById.size||new Set(ids).size!==ids.length)
    throw new Error('The passive partial-contact road is not supported.');
  const slices=finaleDistanceGrid(tour.route,{remainingKm:1})
    .filter(slice=>slice.endDistanceM>last.bunchPositionM+EPSILON);
  if(!slices.length||slices.some(slice=>slice.lengthM!==100)||
    slices.at(-1).endDistanceM!==finishM)
    throw new Error('The partial-contact road has no finish grid.');
  const sourceRows=new Map(last.riders.map(row=>[row.riderId,row]));
  const state=new Map(last.riders.map(row=>[row.riderId,{
    positionM:row.positionM,energy:row.energyAfter,
    elapsedToLineSeconds:null}]));
  let bunchPositionM=last.bunchPositionM;
  let elapsedSeconds=contact.elapsedSeconds;
  const frames=[];
  for(const [index,slice] of slices.entries()){
    if(index>0&&Math.abs(bunchPositionM-slice.startDistanceM)>EPSILON)
      throw new Error('The partial-contact bunch missed its grid.');
    const segment=tour.route.kilometres[slice.sourceKm-1];
    const energies=new Map(ids.map(id=>[id,state.get(id).energy]));
    const bunchIds=ids.filter(id=>
      state.get(id).elapsedToLineSeconds===null&&
      state.get(id).positionM<=bunchPositionM+EPSILON);
    if(!bunchIds.length)
      throw new Error('The partial-contact road lost its bunch.');
    for(const team of teams){
      const order=orderAt(team.orders,slice.sourceKm-1);
      if(team.id!==teamById.get(soloId)&&
        (order.attack!=='none'||order.chase==='selective'||
          !allowChase&&order.chase!=='ignore'))
        throw new Error('The partial-contact road needs recorded rival work.');
    }
    const scheduledSprintIds=new Set(slice.startDistanceM<finishM-300?
      []:plan.decisions.map(row=>row.finisherId));
    const soloStillAhead=state.get(soloId).positionM>
      bunchPositionM+EPSILON&&
      state.get(soloId).elapsedToLineSeconds===null;
    const chasers=[];
    if(allowChase&&index>0&&soloStillAhead){
      for(const team of teams){
        if(team.id===teamById.get(soloId))continue;
        const order=orderAt(team.orders,slice.sourceKm-1);
        if(order.chase!=='all')continue;
        for(const riderId of team.orders.helperIds){
          if(!bunchIds.includes(riderId)||
            scheduledSprintIds.has(riderId))continue;
          const energy=energies.get(riderId);
          if(energy<TUNING.chase.minHelperEnergy)continue;
          const step=finaleWorkerStep({rider:ridersById.get(riderId),
            segment,order,energy,role:'chase',
            paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
          if(energyCostForFinaleSlice(slice,step.workCostPerKm)<=
            energy+EPSILON)chasers.push({teamId:team.id,riderId,step});
        }
      }
      chasers.sort((a,b)=>b.step.speedKph-a.step.speedKph||
        a.teamId.localeCompare(b.teamId)||
        a.riderId.localeCompare(b.riderId));
    }
    const chase=chasers[0]??null;
    const chaseRiderId=allowChase?(index===0?
      last.chaseRiderId:chase?.riderId??null):null;
    const busyTeamIds=allowChase?[...new Set([
      teamById.get(soloId),...(chase?[chase.teamId]:[]),
      ...plan.decisions.filter(row=>
        scheduledSprintIds.has(row.finisherId)&&
        teams.find(team=>team.id===row.teamId).orders.helperIds
          .includes(row.finisherId)).map(row=>row.teamId)])]:[];
    const rotation=allowChase&&index===0?last.rotation:
      recordFinaleFrontRotationSlice({slice,
      route:tour.route,teams,pelotonRiderIds:bunchIds,
      energies,busyTeamIds});
    if(rotation.selected&&!allowChase)
      throw new Error('The partial-contact road needs no front rotation.');
    const rotationWorkers=new Map(rotation.selected?.work.map(row=>
      [row.riderId,row])??[]);
    if(rotationWorkers.has(chaseRiderId))
      throw new Error('A partial-contact rider has two jobs.');
    const passiveIds=bunchIds.filter(id=>
      !scheduledSprintIds.has(id));
    const passiveSpeedKph=index===0?last.bunchSpeedKph:
      finalePassiveBunchSpeed({riderIds:passiveIds.length?
        passiveIds:bunchIds,ridersById,energies,segment});
    const bunchSpeedKph=index===0?last.bunchSpeedKph:
      Math.max(passiveSpeedKph,chase?.step.speedKph??0,
        rotation.selected?.speedKph??0);
    const bunchVelocityMps=bunchSpeedKph/3.6;
    const travelM=slice.endDistanceM-bunchPositionM;
    const durationSeconds=travelM/bunchVelocityMps;
    if(!Number.isFinite(durationSeconds)||durationSeconds<=0)
      throw new Error('The partial-contact bunch has no payable pace.');
    const rows=ids.map(riderId=>{
      const current=state.get(riderId);
      const energyAtDecision=current.energy;
      if(current.elapsedToLineSeconds!==null)return {
        riderId,role:'finished',positionBeforeM:finishM,
        positionM:finishM,distanceTravelledM:0,
        activeDistanceM:0,shelteredDistanceM:0,
        activeSeconds:0,shelteredSeconds:0,
        activeWorkCostPerKm:0,shelteredWorkCostPerKm:0,
        energyAtDecision,energySpent:0,
        energyAfter:energyAtDecision,
        elapsedToLineSeconds:current.elapsedToLineSeconds};
      const effect=riderKilometreEffect(ridersById.get(riderId),
        segment,{phase:'chase',energy:energyAtDecision,
          exposed:segment.exposed});
      const shelteredRate=TUNING.effortCost.conserve*
        effect.energyCostMultiplier;
      let role='sheltered',velocity=bunchVelocityMps;
      let workRate=shelteredRate;
      if(index===0){
        const prior=sourceRows.get(riderId);
        role=prior.role;
        if(current.positionM>bunchPositionM+EPSILON)
          velocity=prior.distanceTravelledM/last.durationSeconds;
        workRate=prior.energySpent*1000/prior.distanceTravelledM;
      }else{
        const order=plan.decisions.find(row=>
          row.finisherId===riderId);
        const sprintEffect=order?riderKilometreEffect(
          ridersById.get(riderId),segment,{phase:'finale',
            energy:energyAtDecision,
            exposed:segment.exposed}):null;
        const sprintCost=sprintEffect?
          FINALE_SPRINT_WORK_COST_PER_KM*
            sprintEffect.energyCostMultiplier:null;
        if(order&&slice.startDistanceM>=finishM-300&&
          sprintCost*slice.lengthM/1000<=energyAtDecision+EPSILON){
          velocity=1000/secondsPerKm(segment,sprintEffect.ability,
            TUNING.finish.finaleEffortAbilityPoints.hard);
          workRate=sprintCost;
          role='sprint';
        }else if(riderId===soloId&&
          current.positionM>bunchPositionM+EPSILON){
          const team=teams.find(row=>row.id===teamById.get(soloId));
          const soloOrder=orderAt(team.orders,slice.sourceKm-1);
          const proposal=soloOrder.breakWork==='sit_on'||
            energyAtDecision<TUNING.breakaway.minPullEnergy?null:
            finaleWorkerStep({rider:ridersById.get(soloId),
              segment,order:soloOrder,energy:energyAtDecision,
              role:'front',
              paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
          const front=proposal&&energyCostForFinaleSlice(slice,
            proposal.workCostPerKm)<=energyAtDecision+EPSILON?
            proposal:null;
          velocity=(front?.speedKph??finalePassiveFrontSpeed({
            riderIds:[soloId],ridersById,energies,segment}))/3.6;
          workRate=front?.workCostPerKm??shelteredRate;
          role=front?'solo_front':'solo_passive';
        }else if(current.positionM>bunchPositionM+EPSILON){
          velocity=1000/secondsPerKm(segment,effect.ability);
          workRate=(TUNING.effortCost.conserve+
            TUNING.breakaway.extraCostPerKm)*
              effect.energyCostMultiplier;
          role='exposed_coast';
        }else if(riderId===chaseRiderId){
          workRate=chase.step.workCostPerKm;
          role='chase';
        }else if(rotationWorkers.has(riderId)){
          // The selected slice records energy for its actual 100 m length.
          workRate=rotationWorkers.get(riderId).energySpent/
            (slice.lengthM/1000);
          role='front_rotation';
        }
      }
      if(!Number.isFinite(velocity)||velocity<=0||
        !Number.isFinite(workRate)||workRate<0)
        throw new Error('A partial-contact rider has no payable pace.');
      const movement=planFinaleMovement({riderId,role,
        startM:current.positionM,ownVelocityMps:velocity,
        bunchVelocityMps,workCostPerKm:workRate,
        shelteredCostPerKm:role==='sprint'||role==='chase'||
          role==='front_rotation'||
          allowChase&&index===0&&
            current.positionM<=bunchPositionM+EPSILON?
          workRate:shelteredRate,
        bunchStartM:bunchPositionM,durationSeconds});
      const paid=payFinalePosition(movement,durationSeconds,
        energyAtDecision,finishM,elapsedSeconds);
      return {...paid,activeSeconds:paid.activeDistanceM/velocity,
        shelteredSeconds:paid.shelteredDistanceM/bunchVelocityMps,
        activeWorkCostPerKm:workRate,
        shelteredWorkCostPerKm:movement.shelteredCostPerKm};
    });
    const roadEvents=positionedRoadEvents(rows,durationSeconds,
      elapsedSeconds,finishM);
    const bunchRecontacts=rows.filter(row=>
      row.positionBeforeM>bunchPositionM+EPSILON&&
      row.activeSeconds>EPSILON&&
      row.shelteredSeconds>EPSILON).map(row=>({
        riderId:row.riderId,
        elapsedSeconds:elapsedSeconds+row.activeSeconds,
        positionM:bunchPositionM+
          bunchVelocityMps*row.activeSeconds}));
    for(const row of rows)state.set(row.riderId,{
      positionM:row.positionM,energy:row.energyAfter,
      elapsedToLineSeconds:row.elapsedToLineSeconds??
        state.get(row.riderId).elapsedToLineSeconds});
    bunchPositionM=slice.endDistanceM;
    frames.push({startDistanceM:index===0?last.bunchPositionM:
      slice.startDistanceM,endDistanceM:slice.endDistanceM,
    elapsedSecondsAtStart:elapsedSeconds,durationSeconds,
    bunchPositionM,bunchSpeedKph,rotation,
    ...(allowChase?{chaseRiderId}:{}),
    roadGroups:rows.filter(row=>row.positionM>
      bunchPositionM+EPSILON&&row.elapsedToLineSeconds===null)
      .map(row=>({id:`partial:${row.riderId}`,
        riderIds:[row.riderId],positionM:row.positionM})),
    pelotonRiderIds:rows.filter(row=>row.positionM<=
      bunchPositionM+EPSILON&&row.elapsedToLineSeconds===null)
      .map(row=>row.riderId),bunchRecontacts,roadEvents,
    riders:rows});
    elapsedSeconds+=durationSeconds;
  }
  const finishers=ids.map(riderId=>({riderId,
    teamId:teamById.get(riderId),
    elapsedSecondsFromLastKmStart:
      state.get(riderId).elapsedToLineSeconds,
    energyAtLine:state.get(riderId).energy}));
  if(finishers.some(row=>!Number.isFinite(
    row.elapsedSecondsFromLastKmStart)))
    throw new Error('The partial-contact road has not reached every line.');
  return {version:allowSpentLeadOut?
    FINALE_CHASED_PARTIAL_AFTER_LEAD_OUT_VERSION:allowChase?
    FINALE_CHASED_PARTIAL_CONTACT_RUNNER_VERSION:
    FINALE_PARTIAL_CONTACT_RUNNER_VERSION,
    sourceContactVersion:oneClock.version,
    sourceRoadTraceVersion:oneClock.sourceRoadTraceVersion,
    sprintPlanVersion:plan.version,
    contact,startDistanceM:last.bunchPositionM,
    lineDistanceM:finishM,frames,finishers,
    resultStatus:'provisional_conditional',
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinalePassivePartialContactFromTour(tour,input,
  oneClock,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinalePassivePartialContactFromTour(tour,input,oneClock)))
    throw new Error('The passive partial-contact road does not replay.');
  return true;
}

export function validateFinaleChasedPartialContactFromTour(tour,input,
  oneClock,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleChasedPartialContactFromTour(tour,input,oneClock)))
    throw new Error('The chased partial-contact road does not replay.');
  return true;
}

export function validateFinaleChasedPartialAfterLeadOutFromTour(tour,input,
  oneClock,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleChasedPartialAfterLeadOutFromTour(tour,input,oneClock)))
    throw new Error('The chased post-lead-out road does not replay.');
  return true;
}
