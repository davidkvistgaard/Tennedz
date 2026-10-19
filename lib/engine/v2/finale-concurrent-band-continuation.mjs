import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentTwoSplitRear400StepFromTour} from
  './finale-concurrent-two-split-rear-400-step.mjs';
import {recordFinaleConcurrentSelective500PlanFromTour} from
  './finale-concurrent-selective-500-plan.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleFrontRotationSlice} from './finale-front-rotation-slice.mjs';
import {selectiveFinaleChaseDecision} from './finale-multi-run.mjs';
import {finalePassiveBunchSpeed,finalePassiveFrontSpeed,
  finaleWorkerStep,FINALE_WORKER_PASSIVE_SLOPE_VERSION} from
  './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_BAND_CONTINUATION_VERSION=
  'v2-finale-concurrent-band-continuation-lab-1';
const EPSILON=1e-8;

export function concurrentBandNextEvent(bands){
  const active=bands.filter(band=>band.finishedAt===null);
  if(!active.length||active.some((band,index)=>
    !Number.isFinite(band.positionM)||
    !Number.isFinite(band.nextBoundaryM)||
    !Number.isFinite(band.speedMps)||band.speedMps<=0||
    band.nextBoundaryM<=band.positionM||
    index>0&&active[index-1].positionM<=band.positionM))
    throw new Error('The active road bands need ordered positive travel.');
  const candidates=active.map(band=>({kind:'boundary',band,
    seconds:(band.nextBoundaryM-band.positionM)/band.speedMps}));
  for(let offset=0;offset<active.length-1;offset++){
    const ahead=active[offset];
    const behind=active[offset+1];
    if(behind.speedMps>ahead.speedMps)
      candidates.push({kind:'contact',ahead,behind,
        seconds:(ahead.positionM-behind.positionM)/
          (behind.speedMps-ahead.speedMps)});
  }
  const seconds=Math.min(...candidates.map(row=>row.seconds));
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Band continuation has no positive next event.');
  const due=candidates.filter(row=>Math.abs(row.seconds-seconds)<1e-9);
  return {seconds,contact:due.find(row=>row.kind==='contact')??null,
    boundaries:due.filter(row=>row.kind==='boundary')};
}

// One event loop carries the already paid three-band 400 m state to an exact
// contact or all three band crossings. It keeps each band's existing work
// until that band reaches its next decision boundary. This is road accounting:
// a bunch crossing is not an individual finish, wheel or point classification.
export function recordFinaleConcurrentBandContinuationFromTour(tour){
  const source=recordFinaleConcurrentTwoSplitRear400StepFromTour(tour);
  const previousPlan=recordFinaleConcurrentSelective500PlanFromTour(tour);
  const finishM=tour.route.distanceKm*1000;
  if(source.event!=='bunch_at_400_boundary'||
    source.roadBands.length!==3||
    source.roadBands.map(row=>row.kind).join(',')!==
      'front,rear_attack,bunch'||
    Math.abs(source.bunchPositionM-(finishM-400))>EPSILON)
    throw new Error('Band continuation needs three paid bands at bunch 400 m.');
  const slices=new Map(finaleDistanceGrid(tour.route,{remainingKm:1})
    .map(slice=>[slice.startDistanceM,slice]));
  const teams=tour.committedInputs.teams;
  const ridersById=new Map(teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const teamByRider=new Map(teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team])));
  const sourceRows=new Map(source.riders.map(row=>[row.riderId,row]));
  const energies=new Map(source.riders.map(row=>
    [row.riderId,row.energyAtEvent]));
  const bands=source.roadBands.map(row=>{
    const first=sourceRows.get(row.riderIds[0]);
    if(!first||row.riderIds.some(id=>
      !sourceRows.has(id)||
      Math.abs(sourceRows.get(id).positionM-row.positionM)>EPSILON))
      throw new Error('Band continuation lost its paid source position.');
    return {kind:row.kind,riderIds:[...row.riderIds],
      positionM:row.positionM,
      speedMps:first.distanceM/source.elapsedSinceRear400Seconds,
      costByRider:new Map(row.riderIds.map(id=>{
        const rider=sourceRows.get(id);
        return [id,rider.energySpent*1000/rider.distanceM];
      })),roleByRider:new Map(row.riderIds.map(id=>
        [id,sourceRows.get(id).role])),
      nextBoundaryM:Math.min(finishM,
        Math.floor((row.positionM+EPSILON)/100)*100+100),
      finishedAt:null};
  });
  if(bands.some(band=>!Number.isFinite(band.speedMps)||
    band.speedMps<=0||band.nextBoundaryM<=band.positionM||
    [...band.costByRider.values()].some(cost=>
      !Number.isFinite(cost)||cost<0)))
    throw new Error('Band continuation has no positive paid source pace.');
  const [front,rear,bunch]=bands;
  const segment=tour.route.kilometres.at(-1);
  let priorAwareness=new Map(previousPlan.selectiveDecisions.map(row=>
    [row.teamId,row.aware]));
  let previousBunchSpeedKph=bunch.speedMps*3.6;
  const decisions=[];
  function chooseAttack(band){
    const riderId=band.riderIds[0];
    const rider=ridersById.get(riderId);
    const team=teamByRider.get(riderId);
    const slice=slices.get(band.positionM);
    if(!rider||!team||!slice||band.riderIds.length!==1)
      throw new Error('Attacker decision needs one scheduled rider.');
    const energy=energies.get(riderId);
    const order=orderAt(team.orders,slice.sourceKm-1);
    const proposed=order.breakWork==='sit_on'||
      energy<TUNING.breakaway.minPullEnergy?null:
      finaleWorkerStep({rider,segment,order,energy,role:'front',
        paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
    const worker=proposed&&energyCostForFinaleSlice(slice,
      proposed.workCostPerKm)<=energy+EPSILON?proposed:null;
    const speedKph=worker?.speedKph??finalePassiveFrontSpeed({
      riderIds:[riderId],ridersById,energies,segment});
    const costPerKm=worker?.workCostPerKm??
      TUNING.effortCost.conserve*riderKilometreEffect(rider,segment,{
        phase:'chase',energy,exposed:segment.exposed})
        .energyCostMultiplier;
    if(!Number.isFinite(speedKph)||speedKph<=0||
      energyCostForFinaleSlice(slice,costPerKm)>energy+EPSILON)
      throw new Error('Attacker cannot pay for the next road interval.');
    band.speedMps=speedKph/3.6;
    band.costByRider.set(riderId,costPerKm);
    band.roleByRider.set(riderId,worker?'front':'sheltered');
    band.nextBoundaryM=slice.endDistanceM;
    decisions.push({elapsedSinceLaunchSeconds:elapsed,
      boundaryM:band.positionM,kind:band.kind,riderId,
      decision:worker?'paid_pull':'passive',speedKph,costPerKm});
  }
  function chooseBunch(){
    const slice=slices.get(bunch.positionM);
    if(!slice)throw new Error('Bunch decision needs a scheduled boundary.');
    const rearGapSeconds=(rear.positionM-bunch.positionM)/
      (previousBunchSpeedKph/3.6);
    const frontGapSeconds=(front.positionM-bunch.positionM)/
      (previousBunchSpeedKph/3.6);
    if(!(rearGapSeconds>0&&frontGapSeconds>=rearGapSeconds))
      throw new Error('Bunch decision needs positive measured attack gaps.');
    const chaseDecisions=[];
    for(const [teamId,awareBefore] of priorAwareness){
      const team=teams.find(row=>row.id===teamId);
      const order=orderAt(team.orders,slice.sourceKm-1);
      if(order.chase!=='selective')
        throw new Error('Bunch continuation needs unchanged chase orders.');
      const awareness=selectiveFinaleChaseDecision({team,awareBefore,
        rearGapSeconds,leadingGapSeconds:frontGapSeconds,
        remainingKm:(finishM-bunch.positionM)/1000});
      const candidates=team.orders.helperIds.filter(id=>
        bunch.riderIds.includes(id)).map(riderId=>{
        const energy=energies.get(riderId);
        if(energy<TUNING.chase.minHelperEnergy)return null;
        const worker=finaleWorkerStep({rider:ridersById.get(riderId),
          segment,order,energy,role:'chase',
          paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
        return energyCostForFinaleSlice(slice,worker.workCostPerKm)<=
          energy+EPSILON?{teamId,riderId,
            speedKph:worker.speedKph,
            workCostPerKm:worker.workCostPerKm}:null;
      }).filter(Boolean).sort((a,b)=>b.speedKph-a.speedKph||
        a.riderId.localeCompare(b.riderId));
      chaseDecisions.push({teamId,aware:awareness.aware,
        policyDecision:awareness.decision,
        candidate:awareness.decision==='engaged'?candidates[0]??null:null});
    }
    priorAwareness=new Map(chaseDecisions.map(row=>
      [row.teamId,row.aware]));
    const selected=chaseDecisions.filter(row=>row.candidate)
      .sort((a,b)=>b.candidate.speedKph-a.candidate.speedKph||
        a.teamId.localeCompare(b.teamId))[0];
    const chase=selected?.candidate??null;
    const busyTeamIds=[...new Set([front,rear].map(band=>
      teamByRider.get(band.riderIds[0]).id).concat(
      chaseDecisions.map(row=>row.teamId)))];
    const rotation=recordFinaleFrontRotationSlice({slice,route:tour.route,
      teams,pelotonRiderIds:bunch.riderIds,energies,busyTeamIds});
    const passiveSpeedKph=finalePassiveBunchSpeed({
      riderIds:bunch.riderIds,ridersById,energies,segment});
    const speedKph=Math.max(passiveSpeedKph,chase?.speedKph??0,
      rotation.bunchSpeedKph);
    const rotationWork=new Map(rotation.selected?.work.map(row=>
      [row.riderId,row])??[]);
    for(const riderId of bunch.riderIds){
      const energy=energies.get(riderId);
      const costPerKm=riderId===chase?.riderId?
        chase.workCostPerKm:rotationWork.has(riderId)?
          rotationWork.get(riderId).energySpent*1000/slice.lengthM:
          TUNING.effortCost.conserve*riderKilometreEffect(
            ridersById.get(riderId),segment,{phase:'chase',energy,
              exposed:segment.exposed}).energyCostMultiplier;
      if(energyCostForFinaleSlice(slice,costPerKm)>energy+EPSILON)
        throw new Error(`Bunch rider cannot pay for travel: ${riderId}.`);
      bunch.costByRider.set(riderId,costPerKm);
      bunch.roleByRider.set(riderId,riderId===chase?.riderId?'chase':
        rotationWork.has(riderId)?'front_rotation':'sheltered');
    }
    bunch.speedMps=speedKph/3.6;
    bunch.nextBoundaryM=slice.endDistanceM;
    previousBunchSpeedKph=speedKph;
    decisions.push({elapsedSinceLaunchSeconds:elapsed,
      boundaryM:bunch.positionM,kind:'bunch',speedKph,
      chaseRiderId:chase?.riderId??null,
      rotationRiderIds:rotation.selected?.riderIds??[],
      selectiveDecisions:chaseDecisions.map(row=>({teamId:row.teamId,
        aware:row.aware,decision:row.policyDecision!=='engaged'?
          row.policyDecision:!row.candidate?'no_helper':
            row.teamId===selected?.teamId?'working':'waiting_turn'}))});
  }
  let elapsed=source.elapsedSinceLaunchSeconds;
  chooseBunch();
  const frames=[];
  let contact=null;
  for(let index=0;index<24;index++){
    const active=bands.filter(band=>band.finishedAt===null);
    if(!active.length)break;
    const next=concurrentBandNextEvent(bands);
    const {seconds}=next;
    const charged=[];
    for(const band of active){
      const distanceM=band.speedMps*seconds;
      for(const riderId of band.riderIds){
        const energyBefore=energies.get(riderId);
        const energySpent=band.costByRider.get(riderId)*distanceM/1000;
        if(!Number.isFinite(energySpent)||energySpent<0||
          energySpent>energyBefore+EPSILON)
          throw new Error('Band continuation exceeds earned rider energy.');
        energies.set(riderId,Math.max(0,energyBefore-energySpent));
        charged.push({riderId,role:band.roleByRider.get(riderId),
          distanceM,energyBefore,energySpent,
          energyAtEvent:energies.get(riderId)});
      }
      band.positionM+=distanceM;
      if(band.positionM>band.nextBoundaryM+EPSILON)
        throw new Error('Band continuation passed an unpaid boundary.');
    }
    elapsed+=seconds;
    contact=next.contact;
    frames.push({elapsedSinceLaunchSeconds:elapsed,
      elapsedSincePreviousSeconds:seconds,
      event:contact?'exact_contact':
        next.boundaries.map(row=>
          `${row.band.kind}_boundary`).join('+'),
      roadBands:bands.map(band=>({kind:band.kind,
        positionM:band.positionM,riderIds:[...band.riderIds]})),
      riders:charged});
    if(contact)break;
    for(const event of next.boundaries){
      const band=event.band;
      if(Math.abs(band.positionM-band.nextBoundaryM)>EPSILON)
        throw new Error('Band continuation missed its road boundary.');
      band.positionM=band.nextBoundaryM;
      if(Math.abs(band.positionM-finishM)<EPSILON){
        band.finishedAt=elapsed;
        continue;
      }
      if(band===bunch)chooseBunch();
      else chooseAttack(band);
    }
  }
  if(!contact&&bands.some(band=>band.finishedAt===null))
    throw new Error('Band continuation exceeded its finite event schedule.');
  const finalRiders=source.riders.map(row=>({riderId:row.riderId,
    energyAtSource:row.energyAtEvent,energyAtStop:energies.get(row.riderId),
    positionM:bands.find(band=>band.riderIds.includes(row.riderId))
      .positionM,
    distanceTravelledM:bands.find(band=>band.riderIds.includes(
      row.riderId)).positionM-row.positionM}));
  const sourceIds=source.riders.map(row=>row.riderId);
  if(finalRiders.length!==sourceIds.length||
    new Set(finalRiders.map(row=>row.riderId)).size!==sourceIds.length||
    finalRiders.some(row=>row.energyAtStop<0||
      row.energyAtStop>row.energyAtSource+EPSILON||
      row.distanceTravelledM<0))
    throw new Error('Band continuation lost its source rider energy.');
  return {version:FINALE_CONCURRENT_BAND_CONTINUATION_VERSION,
    sourceRoadVersion:source.version,sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,raceCategory:tour.raceCategory,
    startDistanceM:finishM-400,finishDistanceM:finishM,
    sourceElapsedSinceLaunchSeconds:source.elapsedSinceLaunchSeconds,
    stopElapsedSinceLaunchSeconds:elapsed,
    status:contact?'stopped_at_exact_contact':'band_crossings_only',
    contact:contact?{aheadKind:contact.ahead.kind,
      behindKind:contact.behind.kind,
      positionM:contact.ahead.positionM,
      elapsedSinceLaunchSeconds:elapsed}:null,
    decisions,frames,
    bandCrossings:bands.map(band=>({kind:band.kind,
      riderIds:[...band.riderIds],
      elapsedSinceLaunchSeconds:band.finishedAt})),
    finalRiders,roadRelationshipStatus:contact?'unresolved_contact':
      'separated_band_crossings',
    resultStatus:'unclassified',pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleConcurrentBandContinuationFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentBandContinuationFromTour(tour)))
    throw new Error('Concurrent band continuation does not replay.');
  return true;
}
