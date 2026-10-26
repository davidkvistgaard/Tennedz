import {normalizeCompleteStageInputV3} from './stage-complete-input-v3.mjs';
import {stageOverlaySlicesForKilometreV3} from './stage-overlay-v3.mjs';
import {evaluateStageSliceRiderV3} from './stage-slice-evaluation-v3.mjs';
import {sameRunHandoffStateAtV3} from './tour.mjs';
import {updateRiderGroups} from './groups.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from './tuning.mjs';

export const STAGE_WHOLE_BUNCH_KILOMETRE_VERSION=
  'v3-issued-whole-bunch-quiet-kilometre-1';
export const STAGE_WHOLE_BUNCH_REPLAY_VERSION=
  'v3-issued-whole-bunch-quiet-replay-1';

function prepareQuietSource({recording,frameIndex,stageInput}){
  const stage=normalizeCompleteStageInputV3(stageInput);
  const source=recording?.frames?.[frameIndex];
  const issued=sameRunHandoffStateAtV3({recording,frameIndex});
  const kilometreIndex=source.km;
  if(recording.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION||
    stage.overlay.distanceKm!==recording.route.distanceKm||
    kilometreIndex>=stage.overlay.distanceKm||kilometreIndex>=160||
    kilometreIndex+1===stage.overlay.distanceKm||
    source.roadGroups.length||source.riderGroups.length!==issued.riders.length||
    issued.riders.some(row=>row.group!=='peloton'||row.deficitSeconds!==0||
      row.lowKilometres!==0||row.quietKm!==0||row.energyCap!==100||
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
    team.orders.baseline.captainSupport!=='hold_position'||
    team.orders.contingency!=='hold_plan'||
    team.orders.gcObjective!=='stage_result'||
    team.orders.phases.length))
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
  return {stage,source,riders,states:riders.map(({rider})=>({
    ...sourceById.get(rider.id),
    lowKilometres:issuedById.get(rider.id).lowKilometres}))};
}

function advanceQuietStep({stage,kilometreIndex,riders,states}){
  const sourceById=new Map(states.map(row=>[row.id,row]));
  const baseline=stage.kilometreBaselines[kilometreIndex];
  const slices=stageOverlaySlicesForKilometreV3(stage.overlay,kilometreIndex);
  const stepped=riders.map(({rider,teamId})=>{
    let energy=sourceById.get(rider.id).energy;
    let abilitySum=0,work=0,roadBaselineSeconds=0;
    const paidSlices=slices.map(slice=>{
      const result=evaluateStageSliceRiderV3({slice,rider,energyBefore:energy,
        effort:'steady',baseTerrain:baseline.terrain,
        baseGradientPct:baseline.gradientPct});
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
    return {id:rider.id,teamId,energy:+energy.toFixed(3),
      ability:abilitySum/slices.reduce((sum,slice)=>sum+slice.distanceKm,0),
      work:+work.toFixed(6),roadBaselineSeconds:+roadBaselineSeconds.toFixed(6),
      slices:paidSlices};
  });
  const workedStates=stepped.map(row=>({...sourceById.get(row.id),
    energy:row.energy,ability:row.ability}));
  const updated=updateRiderGroups(workedStates,[],{unworkedFront:true});
  if(updated.some(row=>row.group!=='peloton'||row.deficitSeconds!==0||
    row.lowKilometres!==0))
    throw new Error('Quiet whole-bunch v3 transition needs a paid drop or contact resolution.');
  return {version:STAGE_WHOLE_BUNCH_KILOMETRE_VERSION,
    sourceKm:kilometreIndex,km:kilometreIndex+1,
    stageInputVersion:stage.version,wholeFieldStepCovered:true,
    riderStates:updated.map(row=>({id:row.id,teamId:row.teamId,
      group:row.group,energy:row.energy,deficitSeconds:row.deficitSeconds,
      lowKilometres:row.lowKilometres})),
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
export function replayQuietWholeBunchStageV3({endKm,...input}){
  const {stage,source,riders,states:initialStates}=prepareQuietSource(input);
  if(!Number.isInteger(endKm)||endKm<=source.km||
    endKm>=stage.overlay.distanceKm||endKm>160)
    throw new Error('Quiet whole-bunch replay needs an interior future kilometre.');
  const frames=[];
  let states=initialStates;
  for(let kilometreIndex=source.km;kilometreIndex<endKm;kilometreIndex++){
    try{
      const frame=advanceQuietStep({stage,kilometreIndex,riders,states});
      frames.push(frame);
      states=frame.riderStates;
    }catch(error){
      return {version:STAGE_WHOLE_BUNCH_REPLAY_VERSION,
        sourceKm:source.km,requestedEndKm:endKm,
        lastPaidKm:frames.at(-1)?.km??source.km,
        refusedAtKm:kilometreIndex+1,refusal:error.message,
        wholeRaceCovered:false,frames,
        scope:'quiet whole field only; no occupied-wheel order or result'};
    }
  }
  return {version:STAGE_WHOLE_BUNCH_REPLAY_VERSION,
    sourceKm:source.km,requestedEndKm:endKm,lastPaidKm:endKm,
    refusedAtKm:null,refusal:null,wholeRaceCovered:false,frames,
    scope:'quiet whole field only; no occupied-wheel order or result'};
}
