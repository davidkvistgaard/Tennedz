import {isDeepStrictEqual} from 'node:util';
import seedrandom from 'seedrandom';
import {sportingSkills} from './physiology.mjs';

export const FINALE_POSITIONED_SOURCE_VERSION=
  'v2-finale-positioned-source-lab-1';
export const FINALE_INDEPENDENT_SOURCE_VERSION=
  'v2-finale-independent-source-lab-2';
export const FINALE_INDEPENDENT_EARLY_SOURCE_VERSION=
  'v2-finale-independent-early-source-lab-3';

// Provisional road geometry for a complete bunch at the 500 m handoff. The
// existing source is a band with no wheel order. Its distance is treated as
// the front edge; all inferred slots lie behind it, so nobody gains road.
// Lane count, wheel spacing and staggering are laboratory assumptions that
// require sporting calibration before any official result can use them.
export const LANES=8;
export const WHEEL_SPACING_M=2.5;
export const LANE_STAGGER_M=.08;

export function resolvePositionedBunchSource(tour,road,plan){
  const source=road?.at500M;
  const ids=source?.pelotonRiderIds;
  const teams=tour?.committedInputs?.teams;
  if(!Array.isArray(ids)||!Array.isArray(teams)||
    !Number.isFinite(source.distanceM)||
    !Array.isArray(source.roadGroups)||
    source.roadGroups?.length>1||
    source.roadGroups?.some(group=>group.riderIds.length!==1)||
    !Array.isArray(plan?.decisions)||
    plan.decisionDistanceM!==source.distanceM||
    plan.sourceRoadTraceVersion!==road.version)
    throw new Error('Positioned source needs a locked 500 m road and plan.');
  const riders=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,{rider,teamId:team.id}])));
  const present=new Set(ids);
  if(present.size!==ids.length||!ids.length||
    ids.some(id=>!riders.has(id))||
    ids.length+source.roadGroups.reduce((count,group)=>
      count+group.riderIds.length,0)!==riders.size)
    throw new Error('Positioned source lost a locked rider.');
  const score=id=>sportingSkills(riders.get(id).rider).positioning;
  const worked=new Set([
    road.frames.at(-1)?.chaseRiderId,
    ...(road.frames.at(-1)?.rotation?.selected?.work??[])
      .map(row=>row.riderId),
    ...(road.frames.at(-1)?.afterCatchRotationPlan?.selected?.work??[])
      .map(row=>row.riderId)].filter(id=>present.has(id)));
  const used=new Set();
  const units=[];
  for(const decision of plan.decisions){
    const helper=decision.leadOutRiderId;
    const finisher=decision.finisherId;
    if(helper===null)continue;
    if(!present.has(helper)||!present.has(finisher)||
      helper===finisher||used.has(helper)||used.has(finisher))
      throw new Error('A positioned lead-out needs two distinct bunch riders.');
    units.push({ids:[helper,finisher],score:Math.min(score(helper),
      score(finisher)),worked:worked.has(helper)||worked.has(finisher)});
    used.add(helper);
    used.add(finisher);
  }
  for(const id of ids)if(!used.has(id))
    units.push({ids:[id],score:score(id),worked:worked.has(id)});
  for(const unit of units)
    unit.tie=seedrandom(`${tour.raceSeed}:finale-position:${
      unit.ids.join(':')}`)();
  units.sort((a,b)=>Number(b.worked)-Number(a.worked)||
    b.score-a.score||b.tie-a.tie||
    a.ids[0].localeCompare(b.ids[0]));
  const laneDepths=Array(LANES).fill(0);
  const slots=[];
  for(const unit of units){
    const lane=laneDepths.indexOf(Math.min(...laneDepths));
    for(const id of unit.ids){
      const row=laneDepths[lane]++;
      slots.push({riderId:id,teamId:riders.get(id).teamId,
        lane,row,positionM:source.distanceM-row*WHEEL_SPACING_M-
          lane*LANE_STAGGER_M,
        positioningScore:score(id),priorFrontWorker:worked.has(id)});
    }
  }
  if(slots.length!==ids.length||
    new Set(slots.map(row=>row.riderId)).size!==ids.length||
    slots.some(row=>row.positionM>source.distanceM))
    throw new Error('Positioned source did not place every bunch rider.');
  return {version:FINALE_POSITIONED_SOURCE_VERSION,
    sourceRoadTraceVersion:road.version,
    sprintPlanVersion:plan.version,
    distanceM:source.distanceM,
    status:'provisional_inferred_wheel_order',
    laneCount:LANES,wheelSpacingM:WHEEL_SPACING_M,
    laneStaggerM:LANE_STAGGER_M,slots};
}

export function validatePositionedBunchSource(tour,road,plan,recorded){
  if(!isDeepStrictEqual(recorded,
    resolvePositionedBunchSource(tour,road,plan)))
    throw new Error('The positioned bunch source does not replay.');
  return true;
}

// A later source version must not move riders when a manager changes only a
// finale helper. The earlier lab-1 projection remains available for replay.
export function resolveIndependentBunchSource(tour,road,plan){
  if(!Array.isArray(plan?.decisions))
    throw new Error('An independent source needs a locked sprint plan.');
  const neutralPlan={...plan,decisions:plan.decisions.map(decision=>({
    ...decision,leadOutRiderId:null}))};
  const projected=resolvePositionedBunchSource(tour,road,neutralPlan);
  return {...projected,version:FINALE_INDEPENDENT_SOURCE_VERSION,
    status:'provisional_inferred_independent_wheels'};
}

export function validateIndependentBunchSource(tour,road,plan,recorded){
  if(!isDeepStrictEqual(recorded,
    resolveIndependentBunchSource(tour,road,plan)))
    throw new Error('The independent bunch source does not replay.');
  return true;
}

// Use the same tactic-independent ordering only at the separately recorded
// one-kilometre bunch handoff. Its distinct version prevents a 500 m source
// from being mistaken for this earlier provisional road.
export function resolveIndependentEarlyBunchSource(tour,road,plan){
  const finishM=tour?.route?.distanceKm*1000;
  if(road?.at500M?.distanceM!==finishM-1000)
    throw new Error('An early positioned source needs the 1 km handoff.');
  const source=resolveIndependentBunchSource(tour,road,plan);
  return {...source,version:FINALE_INDEPENDENT_EARLY_SOURCE_VERSION};
}

export function validateIndependentEarlyBunchSource(tour,road,plan,recorded){
  if(!isDeepStrictEqual(recorded,
    resolveIndependentEarlyBunchSource(tour,road,plan)))
    throw new Error('The early positioned source does not replay.');
  return true;
}
