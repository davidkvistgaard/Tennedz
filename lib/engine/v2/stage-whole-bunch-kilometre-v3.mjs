import {normalizeCompleteStageInputV3} from './stage-complete-input-v3.mjs';
import {stageOverlaySlicesForKilometreV3} from './stage-overlay-v3.mjs';
import {evaluateStageSliceRiderV3} from './stage-slice-evaluation-v3.mjs';
import {sameRunHandoffStateAtV3} from './tour.mjs';
import {updateRiderGroups} from './groups.mjs';
import {resolveTacticalKilometre} from './tactics.mjs';
import {projectStageRecoveryKilometreV3,
  settleStageRecoveryKilometreV3} from './stage-sliced-recovery-v3.mjs';
import {projectStageCapacityKilometreV3} from
  './stage-sliced-capacity-v3.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION,MOTOR_DRAFT_SHELTER,
  MOTOR_EXPLICIT_FRONT,TUNING} from './tuning.mjs';

export const STAGE_WHOLE_BUNCH_KILOMETRE_VERSION=
  'v3-issued-whole-bunch-quiet-kilometre-1';
export const STAGE_WHOLE_BUNCH_REPLAY_VERSION=
  'v3-issued-whole-bunch-quiet-replay-1';
export const STAGE_WHOLE_BUNCH_ORDER_REPLAY_VERSION=
  'v3-issued-whole-bunch-effort-replay-2';
export const STAGE_WHOLE_BUNCH_COMMITTED_REPLAY_VERSION=
  'v3-issued-whole-bunch-committed-effort-replay-3';
export const STAGE_WHOLE_BUNCH_RECOVERY_REPLAY_VERSION=
  'v3-issued-whole-bunch-committed-recovery-replay-4';
export const STAGE_WHOLE_BUNCH_CAPACITY_REPLAY_VERSION=
  'v3-issued-whole-bunch-committed-capacity-replay-5';
export const STAGE_WHOLE_BUNCH_FRONT_REPLAY_VERSION=
  'v3-issued-whole-bunch-committed-front-replay-6';

function prepareQuietSource({recording,frameIndex,stageInput},
  {allowFutureEffortPhases=false,allowConserve=false,
    allowLongDay=false,allowFrontWork=false}={}){
  const stage=normalizeCompleteStageInputV3(stageInput);
  const source=recording?.frames?.[frameIndex];
  const issued=sameRunHandoffStateAtV3({recording,frameIndex});
  const kilometreIndex=source.km;
  if(recording.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION||
    stage.overlay.distanceKm!==recording.route.distanceKm||
    kilometreIndex>=stage.overlay.distanceKm||
    (!allowLongDay&&kilometreIndex>=160)||
    kilometreIndex+1===stage.overlay.distanceKm||
    source.roadGroups.length||source.riderGroups.length!==issued.riders.length||
    issued.riders.some(row=>row.group!=='peloton'||row.deficitSeconds!==0||
      row.lowKilometres!==0||row.quietKm!==0||
      (!allowLongDay&&row.energyCap!==100)||
      row.attackLoad!==0)||
    recording.committedInputs.classification!==null||
    issued.teams.some(row=>row.breakResponseActive||row.gcResponseActive||
      row.gcTargetActive||row.troubleAt!==null))
    throw new Error('Quiet whole-bunch v3 transition requires a paid, attached field without pending decisions.');
  const teams=recording.committedInputs.teams;
  if(teams.some(team=>team.orders.preset!=='balanced'||
    team.orders.baseline?.effort!=='steady'||
    team.orders.baseline.attack!=='none'||
    team.orders.baseline.chase!=='ignore'||
    (!allowFrontWork&&team.orders.baseline.frontWork!==undefined)||
    (allowFrontWork&&team.orders.baseline.frontWork!==undefined&&
      !['rotate','sit_in'].includes(team.orders.baseline.frontWork))||
    team.orders.baseline.captainSupport!=='hold_position'||
    team.orders.contingency!=='hold_plan'||
    team.orders.gcObjective!=='stage_result'||
    (allowFutureEffortPhases?team.orders.phases.some(phase=>
      Object.keys(phase).some(key=>!['atKm','effort',
        ...(allowFrontWork?['frontWork']:[])].includes(key))||
      !('effort'in phase)&&!('frontWork'in phase)||
      !Number.isInteger(phase.atKm)||phase.atKm%5!==0||
      phase.atKm<source.km||
      ('effort'in phase&&!['steady','hard',
        ...(allowConserve?['conserve']:[])].includes(phase.effort))||
      ('frontWork'in phase&&!['rotate','sit_in'].includes(phase.frontWork))):
      team.orders.phases.length>0)))
    throw new Error('Quiet whole-bunch v3 transition cannot resolve dynamic team orders.');
  const sourceById=new Map(source.riderGroups.map(row=>[row.id,row]));
  const issuedById=new Map(issued.riders.map(row=>[row.riderId,row]));
  const riders=teams.flatMap(team=>team.riders.map(rider=>({rider,teamId:team.id})));
  if(sourceById.size!==riders.length||issuedById.size!==riders.length||
    riders.some(({rider,teamId})=>{
      const saved=sourceById.get(rider.id),hidden=issuedById.get(rider.id);
      return !saved||!hidden||saved.teamId!==teamId||hidden.teamId!==teamId||
        saved.group!=='peloton'||saved.energy!==hidden.energy;
    }))
    throw new Error('Every rider needs an authenticated paid bunch state.');
  return {stage,source,riders,teams,
    teamLeaders:new Map(issued.teams.map(row=>[row.teamId,row.activeLeaderId])),
    states:riders.map(({rider})=>({
    ...sourceById.get(rider.id),
    lowKilometres:issuedById.get(rider.id).lowKilometres,
    quietKm:issuedById.get(rider.id).quietKm,
    energyCap:issuedById.get(rider.id).energyCap}))};
}

function advanceQuietStep({stage,kilometreIndex,riders,states,teams=null,
  teamLeaders=null,effortsByTeam=null,enableRecovery=false,
  enableCapacity=false,enableFrontWork=false}){
  const sourceById=new Map(states.map(row=>[row.id,row]));
  const baseline=stage.kilometreBaselines[kilometreIndex];
  const slices=stageOverlaySlicesForKilometreV3(stage.overlay,kilometreIndex);
  let paidFrontWork=null;
  const frontCosts=new Map();
  if(enableFrontWork){
    const first=slices[0],topography=first.features.filter(feature=>
      feature.kind==='climb'||feature.kind==='descent');
    if(topography.length>1)throw new Error('Front selection needs resolved opening topography.');
    const feature=topography[0];
    const segment={km:kilometreIndex+1,
      terrain:feature?.kind??baseline.terrain,
      gradientPct:feature?.gradientPct??baseline.gradientPct,
      surface:first.conditions.surface,exposed:first.conditions.exposed,
      weather:first.conditions.weather};
    const raceTeams=teams.map(team=>({...team,
      energy:Object.fromEntries(team.riders.map(rider=>[
        rider.id,sourceById.get(rider.id).energy])),
      attackLoad:Object.fromEntries(team.riders.map(rider=>[
        rider.id,0])),activeLeaderId:teamLeaders.get(team.id)}));
    const decision=resolveTacticalKilometre({teams:raceTeams,
      km:kilometreIndex+1,segment,distanceKm:stage.overlay.distanceKm,
      resolutionVersion:MOTOR_EXHAUSTION_COAST_VERSION});
    if(decision.attackers.length||decision.chasers.length||
      decision.joinedBreakawayRiderIds.length||
      decision.energyCosts.some(row=>!decision.paidBunchPace?.riderIds
        .includes(row.riderId)))
      throw new Error('Quiet whole-bunch v3 cannot resolve a new attack or chase.');
    paidFrontWork=decision.paidBunchPace;
    for(const row of decision.energyCosts)frontCosts.set(row.riderId,row.cost);
  }
  const stepped=riders.map(({rider,teamId})=>{
    let energy=sourceById.get(rider.id).energy;
    let abilitySum=0,work=0,roadBaselineSeconds=0;
    const effort=effortsByTeam?.get(teamId)??'steady';
    const paidSlices=slices.map(slice=>{
      const result=evaluateStageSliceRiderV3({slice,rider,energyBefore:energy,
        effort,baseTerrain:baseline.terrain,
        baseGradientPct:baseline.gradientPct,
        extraWorkPerKm:frontCosts.get(rider.id)??0});
      energy=result.energyAfter;
      abilitySum+=result.ability*slice.distanceKm;
      work+=result.work;
      roadBaselineSeconds+=result.roadBaselineSeconds;
      return {fromKm:slice.fromKm,toKm:slice.toKm,
        featureIds:slice.features.map(feature=>feature.id),
        conditionSpanId:slice.conditionSpanId,
        energyBefore:+result.energyBefore.toFixed(6),
        work:+result.work.toFixed(6),
        energyAfter:+result.energyAfter.toFixed(6)};
    });
    const capacity=enableCapacity?projectStageCapacityKilometreV3({
      overlay:stage.overlay,kilometreIndex,rider,
      energyCapBefore:sourceById.get(rider.id).energyCap,
      baseTerrain:baseline.terrain,
      baseGradientPct:baseline.gradientPct}):null;
    const energyCap=capacity?.energyCapAfter??100;
    const workCapAdjustment=Math.max(0,energy-energyCap);
    energy=Math.min(energy,energyCap);
    const recovery=enableRecovery?settleStageRecoveryKilometreV3({
      projection:projectStageRecoveryKilometreV3({overlay:stage.overlay,
        kilometreIndex,rider,effort,group:'peloton',
        working:frontCosts.has(rider.id),
        quietKm:sourceById.get(rider.id).quietKm,
        baseTerrain:baseline.terrain,
        baseGradientPct:baseline.gradientPct}),
      energyAfterPaidWork:energy,energyCap}):null;
    if(recovery)energy=recovery.energyAfter;
    return {id:rider.id,teamId,energy:+energy.toFixed(3),
      ability:abilitySum/slices.reduce((sum,slice)=>sum+slice.distanceKm,0),
      work:+work.toFixed(6),roadBaselineSeconds:+roadBaselineSeconds.toFixed(6),
      slices:paidSlices,
      ...(recovery?{recoveryAward:recovery.recoveryApplied,
        capAdjustment:+(recovery.capAdjustment+workCapAdjustment).toFixed(6),
        quietKmAfter:recovery.quietKmAfter}:{}),
      ...(capacity?{energyCapAfter:capacity.energyCapAfter,
        capacityDecay:capacity.decayDemand}:{})};
  });
  const workedStates=stepped.map(row=>({...sourceById.get(row.id),
    energy:row.energy,ability:row.ability,
    ...(enableRecovery?{quietKm:row.quietKmAfter}:{}),
    ...(enableCapacity?{energyCap:row.energyCapAfter}:{})}));
  const workers=paidFrontWork?.riderIds??[];
  const workerAbilities=workers.map(id=>stepped.find(row=>row.id===id)?.ability);
  if(workerAbilities.some(ability=>!Number.isFinite(ability)))
    throw new Error('Paid front workers need complete rider slices.');
  const frontAdjustment=paidFrontWork?.effort==='conserve'?
    MOTOR_EXPLICIT_FRONT.conserveFrontAdjustmentPoints:
    TUNING.groups.frontPaceAdjustmentPoints[paidFrontWork?.effort]??0;
  const frontPaceAbility=workers.length===2?
    (workerAbilities[0]+workerAbilities[1])/2+frontAdjustment:null;
  const shelterBonus=paidFrontWork?slices.reduce((sum,slice)=>{
    const feature=slice.features.find(row=>row.kind==='climb'||
      row.kind==='descent');
    return sum+MOTOR_DRAFT_SHELTER[feature?.kind??baseline.terrain]*
      slice.distanceKm;
  },0)/slices.reduce((sum,slice)=>sum+slice.distanceKm,0):0;
  const updated=updateRiderGroups(workedStates,[],{unworkedFront:true,
    frontPaceAbility,shelteredToleranceBonus:shelterBonus,
    frontWorkerRiderIds:workers});
  if(updated.some(row=>row.group!=='peloton'||row.deficitSeconds!==0||
    row.lowKilometres!==0))
    throw new Error('Quiet whole-bunch v3 transition needs a paid drop or contact resolution.');
  return {version:STAGE_WHOLE_BUNCH_KILOMETRE_VERSION,
    sourceKm:kilometreIndex,km:kilometreIndex+1,
    stageInputVersion:stage.version,wholeFieldStepCovered:true,
    ...(enableFrontWork?{paidFrontWork:paidFrontWork?{
      teamId:paidFrontWork.teamId,riderIds:[...workers],
      effort:paidFrontWork.effort,
      frontPaceAbility:+frontPaceAbility.toFixed(6)}:null}:{}),
    ...(effortsByTeam?{activeEfforts:[...effortsByTeam].map(([teamId,effort])=>
      ({teamId,effort}))}:{}),
    riderStates:updated.map(row=>({id:row.id,teamId:row.teamId,
      group:row.group,energy:row.energy,deficitSeconds:row.deficitSeconds,
      lowKilometres:row.lowKilometres,
      ...(enableRecovery?{quietKm:row.quietKm}:{}),
      ...(enableCapacity?{energyCap:row.energyCap}:{})})),
    riderWork:stepped.map(({ability,...row})=>row),
    scope:'one quiet whole-bunch kilometre; no occupied-wheel order or result'};
}

// One quiet kilometre after a paid, same-run v2 checkpoint. All riders pay
// short-slice work before a single group update. Dynamic attacks, front work,
// shelter, recovery and any group departure require separate transitions.
export function advanceQuietWholeBunchKilometreV3(input){
  const {stage,source,riders,states}=prepareQuietSource(input);
  return advanceQuietStep({stage,kilometreIndex:source.km,riders,states});
}

// A bounded whole-field replay retains every fully paid kilometre and treats
// an unsupported kilometre atomically. It does not issue an official result.
function replayPreparedQuietWholeBunch({stage,source,riders,teams,teamLeaders,
  states:initialStates},
  {endKm,effortOrders,version,enableRecovery=false,
    enableCapacity=false,enableFrontWork=false}){
  if(!Number.isInteger(endKm)||endKm<=source.km||
    endKm>=stage.overlay.distanceKm||(!enableCapacity&&endKm>160))
    throw new Error('Quiet whole-bunch replay needs an interior future kilometre.');
  const teamIds=new Set(riders.map(row=>row.teamId));
  if(!Array.isArray(effortOrders)||effortOrders.some(order=>
    !teamIds.has(order?.teamId)||!Number.isInteger(order.atKm)||
    order.atKm%5!==0||order.atKm<source.km||order.atKm>=endKm||
    !['steady','hard',...(enableRecovery?['conserve']:[])].includes(
      order.effort))||
    new Set(effortOrders.map(order=>`${order.teamId}:${order.atKm}`)).size!==
      effortOrders.length)
    throw new Error('Declared effort changes need distinct future 5 km markers.');
  const frames=[];
  let states=initialStates;
  for(let kilometreIndex=source.km;kilometreIndex<endKm;kilometreIndex++){
    try{
      const effortsByTeam=effortOrders.length?new Map([...teamIds].map(teamId=>{
        const active=effortOrders.filter(order=>order.teamId===teamId&&
          order.atKm<=kilometreIndex).sort((a,b)=>b.atKm-a.atKm)[0];
        return [teamId,active?.effort??'steady'];
      })):null;
      const frame=advanceQuietStep({stage,kilometreIndex,riders,states,
        teams,teamLeaders,effortsByTeam,enableRecovery,enableCapacity,
        enableFrontWork});
      frames.push(frame);
      states=frame.riderStates;
    }catch(error){
      return {version,
        sourceKm:source.km,requestedEndKm:endKm,
        lastPaidKm:frames.at(-1)?.km??source.km,
        refusedAtKm:kilometreIndex+1,refusal:error.message,
        wholeRaceCovered:false,frames,
        scope:'quiet whole field only; no occupied-wheel order or result'};
    }
  }
  return {version,
    sourceKm:source.km,requestedEndKm:endKm,lastPaidKm:endKm,
    refusedAtKm:null,refusal:null,wholeRaceCovered:false,frames,
    scope:'quiet whole field only; no occupied-wheel order or result'};
}

export function replayQuietWholeBunchStageV3({endKm,effortOrders=[],...input}){
  return replayPreparedQuietWholeBunch(prepareQuietSource(input),
    {endKm,effortOrders,version:effortOrders.length?
      STAGE_WHOLE_BUNCH_ORDER_REPLAY_VERSION:
      STAGE_WHOLE_BUNCH_REPLAY_VERSION});
}

// Only this variant reads the manager's actual committed future effort phases
// from the same-run recording. No separate order can be supplied or amended.
export function replayCommittedQuietWholeBunchStageV3({endKm,...input}){
  const prepared=prepareQuietSource(input,{allowFutureEffortPhases:true});
  const effortOrders=input.recording.committedInputs.teams.flatMap(team=>
    team.orders.phases.filter(phase=>phase.atKm<endKm).map(phase=>({
      teamId:team.id,atKm:phase.atKm,effort:phase.effort})));
  return replayPreparedQuietWholeBunch(prepared,{endKm,effortOrders,
    version:STAGE_WHOLE_BUNCH_COMMITTED_REPLAY_VERSION});
}

// The next version pays quiet-bunch recovery once per whole kilometre after
// short-slice work. A short adverse span cancels that kilometre's recovery.
export function replayCommittedQuietBunchWithRecoveryV3({endKm,...input}){
  const prepared=prepareQuietSource(input,{allowFutureEffortPhases:true,
    allowConserve:true});
  const effortOrders=input.recording.committedInputs.teams.flatMap(team=>
    team.orders.phases.filter(phase=>phase.atKm<endKm).map(phase=>({
      teamId:team.id,atKm:phase.atKm,effort:phase.effort})));
  return replayPreparedQuietWholeBunch(prepared,{endKm,effortOrders,
    version:STAGE_WHOLE_BUNCH_RECOVERY_REPLAY_VERSION,
    enableRecovery:true});
}

// This bounded successor adds the authenticated rider capacity and pays its
// post-160 km loss across precise stage slices before once-per-km recovery.
export function replayCommittedQuietBunchWithCapacityV3({endKm,...input}){
  const prepared=prepareQuietSource(input,{allowFutureEffortPhases:true,
    allowConserve:true,allowLongDay:true});
  const effortOrders=input.recording.committedInputs.teams.flatMap(team=>
    team.orders.phases.filter(phase=>phase.atKm<endKm).map(phase=>({
      teamId:team.id,atKm:phase.atKm,effort:phase.effort})));
  return replayPreparedQuietWholeBunch(prepared,{endKm,effortOrders,
    version:STAGE_WHOLE_BUNCH_CAPACITY_REPLAY_VERSION,
    enableRecovery:true,enableCapacity:true});
}

// This version selects a committed rotate/sit-in front once at each whole-km
// boundary and charges the chosen workers over each precise stage slice.
export function replayCommittedQuietBunchWithFrontWorkV3({endKm,...input}){
  const prepared=prepareQuietSource(input,{allowFutureEffortPhases:true,
    allowConserve:true,allowLongDay:true,allowFrontWork:true});
  const effortOrders=input.recording.committedInputs.teams.flatMap(team=>
    team.orders.phases.filter(phase=>phase.atKm<endKm&&
      phase.effort!==undefined).map(phase=>({
      teamId:team.id,atKm:phase.atKm,effort:phase.effort})));
  return replayPreparedQuietWholeBunch(prepared,{endKm,effortOrders,
    version:STAGE_WHOLE_BUNCH_FRONT_REPLAY_VERSION,
    enableRecovery:true,enableCapacity:true,enableFrontWork:true});
}
