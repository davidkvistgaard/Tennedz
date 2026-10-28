// A read-only forecast from the current road and energy rules. It never moves
// riders, commits a chase, or awards a catch. Sporting intent is supplied by
// the caller as an explicit set of teams willing to consider pursuit.
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {chaseCapacity} from './tactics.mjs';
import {TUNING,MOTOR_CANDIDATE} from './tuning.mjs';

const round=value=>+value.toFixed(2);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function terrainLoad(segment){
  return 1+Math.max(0,Number(segment.gradientPct??0))*.035+
    (segment.surface==='road'?0:.15);
}

function median(values){
  const sorted=[...values].sort((a,b)=>a-b);
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}

export function forecastBreakThreat({teams,frontRiderIds,chaseTeamIds,
  unavailableRiderIds=[],
  remainingSegments,gapSeconds}){
  if(!Array.isArray(teams)||!teams.length||
    !Array.isArray(frontRiderIds)||!frontRiderIds.length||
    new Set(frontRiderIds).size!==frontRiderIds.length||
    !Array.isArray(unavailableRiderIds)||
    new Set(unavailableRiderIds).size!==unavailableRiderIds.length||
    !Array.isArray(chaseTeamIds)||new Set(chaseTeamIds).size!==chaseTeamIds.length||
    !Array.isArray(remainingSegments)||!remainingSegments.length||
    !Number.isFinite(gapSeconds)||gapSeconds<0)
    throw new Error('Invalid break threat inputs.');
  const teamByRider=new Map(teams.flatMap(team=>team.riders.map(rider=>[rider.id,team])));
  const teamById=new Map(teams.map(team=>[team.id,team]));
  const front=new Set(frontRiderIds),chasers=new Set(chaseTeamIds);
  const unavailable=new Set([...frontRiderIds,...unavailableRiderIds]);
  if(teamById.size!==teams.length||
    teamByRider.size!==teams.reduce((sum,team)=>sum+team.riders.length,0)||
    frontRiderIds.some(id=>!teamByRider.has(id))||
    unavailableRiderIds.some(id=>!teamByRider.has(id)||front.has(id))||
    chaseTeamIds.some(id=>!teamById.has(id)||
      teamById.get(id).riders.some(rider=>front.has(rider.id))))
    throw new Error('Invalid break threat roster.');
  const energy=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,Number(team.energy?.[rider.id]??100)])));
  if([...energy.values()].some(value=>!Number.isFinite(value)||value<0||value>100))
    throw new Error('Invalid break threat energy.');
  const firstKm=remainingSegments[0].km;
  const frontWorkReserveAtStart=frontRiderIds.reduce((sum,id)=>{
    const team=teamByRider.get(id);
    return sum+(orderAt(team.orders,firstKm-1).breakWork==='sit_on'?0:
      Math.max(0,energy.get(id)-TUNING.breakaway.minPullEnergy));
  },0);
  const chaseHelpersAtStart=[...chasers].flatMap(teamId=>{
    const team=teamById.get(teamId);
    return orderAt(team.orders,firstKm-1).chase==='ignore'?[]:
      team.riders.filter(rider=>team.orders.helperIds.includes(rider.id)&&
        !unavailable.has(rider.id)&&energy.get(rider.id)>TUNING.chase.minHelperEnergy);
  });
  const chaseWorkReserveAtStart=chaseHelpersAtStart.reduce((sum,rider)=>
    sum+energy.get(rider.id)-TUNING.chase.minHelperEnergy,0);
  const byTerrain={flat:0,hill:0,climb:0,descent:0};
  const frontTeams=new Set(frontRiderIds.map(id=>teamByRider.get(id).id));
  const availableChaseHelpers=new Set();
  let frontWorkerKm=0,chaseHelperKm=0,frontEnergySpent=0,chaseEnergySpent=0;
  let peakConcurrentChaseHelpers=0;
  let projectedGap=gapSeconds,netModeledClosingSeconds=0;
  let peakModeledClosingSeconds=0,caughtAtKm=null;
  const kilometres=[];
  for(const [index,segment] of remainingSegments.entries()){
    if(!Number.isInteger(segment.km)||segment.km<1||
      index>0&&segment.km!==remainingSegments[index-1].km+1||
      !Object.hasOwn(byTerrain,segment.terrain))
      throw new Error('Invalid break threat route.');
    byTerrain[segment.terrain]++;
    const frontWorkers=frontRiderIds.filter(id=>{
      const team=teamByRider.get(id);
      return energy.get(id)>TUNING.breakaway.minPullEnergy&&
        orderAt(team.orders,segment.km-1).breakWork!=='sit_on';
    });
    const frontAbilities=frontRiderIds.map(id=>{
      const team=teamByRider.get(id),rider=team.riders.find(row=>row.id===id);
      return riderKilometreEffect(rider,segment,{phase:'solo',
        energy:energy.get(id),exposed:segment.exposed}).ability;
    });
    const workerAbilities=frontWorkers.map(id=>{
      const team=teamByRider.get(id),rider=team.riders.find(row=>row.id===id);
      return riderKilometreEffect(rider,segment,{phase:'solo',
        energy:energy.get(id),exposed:segment.exposed}).ability+
        (orderAt(team.orders,segment.km-1).breakWork==='drive'?
          TUNING.breakaway.driveAbilityBonusPoints:0);
    });
    const cooperation=Math.min(Math.max(0,frontWorkers.length-1),
      TUNING.breakaway.maxCooperatingRiders)*TUNING.breakaway.cooperationPerExtraRider;
    const frontAbility=workerAbilities.length?
      workerAbilities.reduce((sum,value)=>sum+value,0)/workerAbilities.length+cooperation:
      frontAbilities.reduce((sum,value)=>sum+value,0)/frontAbilities.length-
        TUNING.breakaway.noWorkPenaltyPoints;
    const bunchAbilities=teams.flatMap(team=>team.riders.filter(rider=>
      !unavailable.has(rider.id))
      .map(rider=>riderKilometreEffect(rider,segment,{phase:'cruise',
        energy:energy.get(rider.id),exposed:segment.exposed}).ability));
    if(!bunchAbilities.length)throw new Error('Break threat needs a bunch.');
    const bunchAbility=median(bunchAbilities)+TUNING.breakaway.bunchDraftAdvantage;
    const passiveDelta=clamp((frontAbility-bunchAbility)*
      TUNING.breakaway.driftSecondsPerAbilityPoint,
    -TUNING.breakaway.maxPassiveGainSecondsPerKm,
    TUNING.breakaway.maxPassiveGainSecondsPerKm);
    let chasePower=0,chaseHelpersThisKm=0;
    const workingChaseRiders=new Set();
    for(const teamId of chasers){
      const team=teamById.get(teamId);
      const projectedTeam={...team,energy:Object.fromEntries(team.riders.map(rider=>
        [rider.id,energy.get(rider.id)]))};
      const {helpers,capacity}=chaseCapacity(projectedTeam,segment,unavailable);
      const order=orderAt(team.orders,segment.km-1);
      const commitment=order.chase==='all'?1:order.chase==='selective'?
        TUNING.chase.selectiveCommitment:0;
      if(!commitment)continue;
      chasePower+=capacity*commitment*TUNING.effortPressure[order.effort];
      for(const {rider} of helpers){
        availableChaseHelpers.add(rider.id);
        workingChaseRiders.add(rider.id);
        chaseHelperKm++;
        chaseHelpersThisKm++;
        const cost=(TUNING.effortCost[order.effort]*terrainLoad(segment)+
          (order.chase==='all'?TUNING.chase.allCost:TUNING.chase.selectiveCost))*
          riderKilometreEffect(rider,segment,{phase:'chase',
            energy:energy.get(rider.id),exposed:segment.exposed}).energyCostMultiplier;
        energy.set(rider.id,Math.max(0,energy.get(rider.id)-cost));
        chaseEnergySpent+=cost;
      }
    }
    const chaseRecovery=chasePower*MOTOR_CANDIDATE.chaseRecoverySecondsPerCapacity;
    peakConcurrentChaseHelpers=Math.max(peakConcurrentChaseHelpers,chaseHelpersThisKm);
    const netClosing=chaseRecovery-passiveDelta;
    netModeledClosingSeconds+=netClosing;
    peakModeledClosingSeconds=Math.max(peakModeledClosingSeconds,netModeledClosingSeconds);
    projectedGap=Math.max(0,gapSeconds-peakModeledClosingSeconds);
    if(caughtAtKm===null&&projectedGap===0)caughtAtKm=segment.km;
    const frontWorkerCount=frontWorkers.length;
    frontWorkerKm+=frontWorkerCount;
    for(const id of frontRiderIds){
      const team=teamByRider.get(id),rider=team.riders.find(row=>row.id===id);
      const order=orderAt(team.orders,segment.km-1);
      const worker=frontWorkers.includes(id);
      const rotationRelief=1+Math.min(Math.max(0,frontWorkerCount-1),
        TUNING.breakaway.maxCooperatingRiders)*
        TUNING.breakaway.rotationReliefPerExtraWorker;
      const cost=(TUNING.effortCost[order.effort]*terrainLoad(segment)+
        (worker?TUNING.breakaway.extraCostPerKm/rotationRelief+
          (order.breakWork==='drive'?TUNING.breakaway.driveExtraCostPerKm:0):
          TUNING.breakaway.sitOnExtraCostPerKm))*
        riderKilometreEffect(rider,segment,{phase:'solo',
          energy:energy.get(id),exposed:segment.exposed}).energyCostMultiplier;
      energy.set(id,Math.max(0,energy.get(id)-cost));
      frontEnergySpent+=cost;
    }
    for(const team of teams)for(const rider of team.riders){
      if(front.has(rider.id)||workingChaseRiders.has(rider.id))continue;
      const effort=orderAt(team.orders,segment.km-1).effort;
      const cost=TUNING.effortCost[effort]*terrainLoad(segment)*
        riderKilometreEffect(rider,segment,{phase:'cruise',
          energy:energy.get(rider.id),exposed:segment.exposed}).energyCostMultiplier;
      energy.set(rider.id,Math.max(0,energy.get(rider.id)-cost));
    }
    kilometres.push({km:segment.km,terrain:segment.terrain,
      frontWorkers:frontWorkerCount,chaseHelpers:chaseHelpersThisKm,
      frontAbility:round(frontAbility),bunchAbility:round(bunchAbility),
      chasePower:round(chasePower),
      passiveDeltaSeconds:round(passiveDelta),chaseRecoverySeconds:round(chaseRecovery),
      projectedGapSeconds:round(projectedGap)});
  }
  return {
    version:1,frontRiderCount:front.size,frontTeamCount:frontTeams.size,
    unavailableRiderCount:unavailableRiderIds.length,
    chaseTeamCount:chasers.size,
    potentialChaseHelperCountAtStart:chaseHelpersAtStart.length,
    frontWorkReserveAtStart:round(frontWorkReserveAtStart),
    chaseWorkReserveAtStart:round(chaseWorkReserveAtStart),
    participatingChaseHelperCount:availableChaseHelpers.size,
    peakConcurrentChaseHelpers,
    remainingKm:remainingSegments.length,terrainKilometres:byTerrain,
    initialGapSeconds:round(gapSeconds),
    frontWorkerKm,chaseHelperKm,
    frontEnergySpent:round(frontEnergySpent),chaseEnergySpent:round(chaseEnergySpent),
    netModeledClosingSeconds:round(netModeledClosingSeconds),
    allInCatchableGapSeconds:round(peakModeledClosingSeconds),
    allInGapHeadroomSeconds:round(peakModeledClosingSeconds-gapSeconds),
    projectedGapSeconds:round(projectedGap),
    allInCatchPossible:caughtAtKm!==null,caughtAtKm,
    kilometres,
  };
}
