import {evaluateSeparatedRoadBandsKilometreV3,
  evaluateSeparatedRoadBandsWithCapacityKilometreV3} from
  './stage-separated-road-bands-v3.mjs';
import {TUNING} from './tuning.mjs';

export const STAGE_SEPARATED_ROAD_REPLAY_VERSION=
  'v3-separated-declared-road-replay-1';
export const STAGE_SEPARATED_ROAD_CAPACITY_REPLAY_VERSION=
  'v3-separated-declared-road-capacity-replay-1';

// Internal stage replay for road bands already separated at the start.
// Group membership never changes; possible contact stops the whole replay.
export function replaySeparatedRoadBandsStageV3({
  overlay,bands,gapsSeconds,kilometreBaselines,
  pullRiderIds,driveRiderIds=[],workOrders=[],effortOrders=[],
  startKilometreIndex=0,capacityMode=false,
}){
  if(overlay?.version!==3||!Number.isInteger(overlay.distanceKm)||
    !Array.isArray(kilometreBaselines)||
    kilometreBaselines.length!==overlay.distanceKm||
    kilometreBaselines.some(baseline=>
      !['flat','hill','climb','descent'].includes(baseline?.terrain)||
      !Number.isFinite(baseline.gradientPct)))
    throw new Error('Complete integer-kilometre stage baselines are required.');
  if(!Array.isArray(bands)||bands.length<3||bands.length>8||
    !Array.isArray(workOrders)||!Array.isArray(effortOrders)||
    !Number.isInteger(startKilometreIndex)||startKilometreIndex<0||
    startKilometreIndex>=overlay.distanceKm)
    throw new Error('Fixed road bands and precommitted orders are required.');
  const all=bands.flatMap(band=>band.members??[]);
  const known=new Set(all.map(member=>member?.id));
  const bandIds=new Set(bands.map(band=>band?.id));
  if(known.size!==all.length||bandIds.size!==bands.length)
    throw new Error('Fixed road-band and rider ids must be distinct.');
  const validRoster=(pulls,drives)=>Array.isArray(pulls)&&
    Array.isArray(drives)&&new Set(pulls).size===pulls.length&&
    new Set(drives).size===drives.length&&
    pulls.every(id=>known.has(id))&&
    drives.every(id=>pulls.includes(id))&&
    bands.every(band=>band.members?.length!==1||
      pulls.includes(band.members[0].id));
  if(!validRoster(pullRiderIds,driveRiderIds))
    throw new Error('Initial work roster is invalid; every solo must pull.');
  const validMarker=markerKm=>Number.isInteger(markerKm)&&
    markerKm>=Math.max(5,startKilometreIndex)&&
    markerKm<overlay.distanceKm&&markerKm%5===0;
  const workMarkers=new Set();
  for(const order of workOrders){
    if(!validMarker(order?.markerKm)||workMarkers.has(order.markerKm)||
      !validRoster(order.pullRiderIds,order.driveRiderIds??[]))
      throw new Error('Work changes need unique valid 5 km markers and rosters.');
    workMarkers.add(order.markerKm);
  }
  const effortKeys=new Set();
  for(const order of effortOrders){
    const key=`${order?.markerKm}:${order?.bandId}`;
    if(!validMarker(order?.markerKm)||!bandIds.has(order.bandId)||
      !Object.hasOwn(TUNING.effortCost,order.effort)||
      effortKeys.has(key))
      throw new Error('Effort changes need a valid band, effort and 5 km marker.');
    effortKeys.add(key);
  }
  let energies=new Map(all.map(member=>[member.id,member.energyBefore]));
  let capacities=capacityMode?new Map(all.map(member=>[
    member.id,member.energyCapBefore])):null;
  const version=capacityMode?STAGE_SEPARATED_ROAD_CAPACITY_REPLAY_VERSION:
    STAGE_SEPARATED_ROAD_REPLAY_VERSION;
  const capacityRows=()=>capacityMode?{capacities:all.map(member=>({
    riderId:member.id,energyCap:capacities.get(member.id)}))}:{};
  let gaps=[...gapsSeconds];
  let activePulls=[...pullRiderIds],activeDrives=[...driveRiderIds];
  const efforts=new Map(all.map(member=>[member.id,member.effort]));
  const kilometres=[];
  for(let kilometreIndex=startKilometreIndex;
    kilometreIndex<overlay.distanceKm;
    kilometreIndex++){
    const workActivated=workOrders.find(order=>
      order.markerKm===kilometreIndex);
    if(workActivated){
      activePulls=[...workActivated.pullRiderIds];
      activeDrives=[...(workActivated.driveRiderIds??[])];
    }
    const effortsActivated=effortOrders.filter(order=>
      order.markerKm===kilometreIndex);
    for(const order of effortsActivated){
      const band=bands.find(candidate=>candidate.id===order.bandId);
      for(const member of band.members)efforts.set(member.id,order.effort);
    }
    const prepared=bands.map(band=>({...band,
      members:band.members.map(member=>({...member,
        energyBefore:energies.get(member.id),effort:efforts.get(member.id),
        ...(capacityMode?{energyCapBefore:capacities.get(member.id)}:{})}))}));
    const baseline=kilometreBaselines[kilometreIndex];
    const evaluator=capacityMode?
      evaluateSeparatedRoadBandsWithCapacityKilometreV3:
      evaluateSeparatedRoadBandsKilometreV3;
    const step=evaluator({overlay,
      kilometreIndex,bands:prepared,gapsSeconds:gaps,
      baseTerrain:baseline.terrain,
      baseGradientPct:baseline.gradientPct,
      pullRiderIds:activePulls,driveRiderIds:activeDrives});
    kilometres.push({kilometreIndex,
      pullRiderIds:[...activePulls],driveRiderIds:[...activeDrives],
      workOrderActivated:workActivated?{markerKm:workActivated.markerKm,
        pullRiderIds:[...activePulls],driveRiderIds:[...activeDrives]}:null,
      effortOrdersActivated:effortsActivated.map(order=>({...order})),
      activeEfforts:bands.map(band=>({bandId:band.id,
        members:band.members.map(member=>({riderId:member.id,
          effort:efforts.get(member.id)}))})),
      ...step});
    for(const row of step.energies)energies.set(row.riderId,row.energy);
    if(capacityMode)for(const row of step.capacities)
      capacities.set(row.riderId,row.energyCap);
    gaps=step.gapsSeconds;
    if(step.status!=='separate')return {
      version,
      status:step.status,startedAtKm:startKilometreIndex,
      paidUntilKm:step.paidUntilKm,
      possibleContactSpan:step.possibleContactSpan,
      possibleContactPairs:step.possibleContactPairs,
      possibleExhaustionSpan:step.possibleExhaustionSpan,
      exhaustedRiderId:step.exhaustedRiderId,
      gapsSeconds:gaps,energies:step.energies,
      ...capacityRows(),kilometres};
  }
  return {version,
    status:'separate',startedAtKm:startKilometreIndex,
    paidUntilKm:overlay.distanceKm,
    gapsSeconds:gaps,
    energies:all.map(member=>({riderId:member.id,
      energy:energies.get(member.id)})),...capacityRows(),kilometres};
}

// A new replay version pays each capacity change inside its exact stage slice.
export function replaySeparatedRoadBandsWithCapacityStageV3(args){
  return replaySeparatedRoadBandsStageV3({...args,capacityMode:true});
}
