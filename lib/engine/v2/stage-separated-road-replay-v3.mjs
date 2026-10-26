import {evaluateSeparatedRoadBandsKilometreV3} from
  './stage-separated-road-bands-v3.mjs';
import {TUNING} from './tuning.mjs';

export const STAGE_SEPARATED_ROAD_REPLAY_VERSION=
  'v3-separated-declared-road-replay-1';

// Internal stage replay for road bands already separated at the start.
// Group membership never changes; possible contact stops the whole replay.
export function replaySeparatedRoadBandsStageV3({
  overlay,bands,gapsSeconds,kilometreBaselines,
  pullRiderIds,driveRiderIds=[],workOrders=[],effortOrders=[],
}){
  if(overlay?.version!==3||!Number.isInteger(overlay.distanceKm)||
    !Array.isArray(kilometreBaselines)||
    kilometreBaselines.length!==overlay.distanceKm||
    kilometreBaselines.some(baseline=>
      !['flat','hill','climb','descent'].includes(baseline?.terrain)||
      !Number.isFinite(baseline.gradientPct)))
    throw new Error('Complete integer-kilometre stage baselines are required.');
  if(!Array.isArray(bands)||bands.length<3||bands.length>8||
    !Array.isArray(workOrders)||!Array.isArray(effortOrders))
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
  const validMarker=markerKm=>Number.isInteger(markerKm)&&markerKm>=5&&
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
  let gaps=[...gapsSeconds];
  let activePulls=[...pullRiderIds],activeDrives=[...driveRiderIds];
  const efforts=new Map(all.map(member=>[member.id,member.effort]));
  const kilometres=[];
  for(let kilometreIndex=0;kilometreIndex<overlay.distanceKm;
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
        energyBefore:energies.get(member.id),effort:efforts.get(member.id)}))}));
    const baseline=kilometreBaselines[kilometreIndex];
    const step=evaluateSeparatedRoadBandsKilometreV3({overlay,
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
    gaps=step.gapsSeconds;
    if(step.status!=='separate')return {
      version:STAGE_SEPARATED_ROAD_REPLAY_VERSION,
      status:step.status,paidUntilKm:step.paidUntilKm,
      possibleContactSpan:step.possibleContactSpan,
      possibleContactPairs:step.possibleContactPairs,
      gapsSeconds:gaps,energies:step.energies,kilometres};
  }
  return {version:STAGE_SEPARATED_ROAD_REPLAY_VERSION,
    status:'separate',paidUntilKm:overlay.distanceKm,
    gapsSeconds:gaps,
    energies:all.map(member=>({riderId:member.id,
      energy:energies.get(member.id)})),kilometres};
}
