import {evaluateTwoDeclaredWorkGroupsKilometreV3} from
  './stage-two-declared-work-groups-v3.mjs';

export const STAGE_TWO_DECLARED_WORK_REPLAY_VERSION=
  'v3-two-declared-work-replay-1';

// Internal fixed-group replay. Work rosters are committed before the stage;
// their changes take effect in the kilometre after each 5 km marker.
export function replayTwoDeclaredWorkGroupsStageV3({
  overlay,front,rear,gapSeconds,kilometreBaselines,
  pullRiderIds,driveRiderIds=[],workOrders=[],
}){
  if(overlay?.version!==3||!Number.isInteger(overlay.distanceKm)||
    !Array.isArray(kilometreBaselines)||
    kilometreBaselines.length!==overlay.distanceKm||
    kilometreBaselines.some(baseline=>
      !['flat','hill','climb','descent'].includes(baseline?.terrain)||
      !Number.isFinite(baseline.gradientPct)))
    throw new Error('Complete integer-kilometre stage baselines are required.');
  if(!Array.isArray(workOrders))
    throw new Error('Precommitted group-work orders must be an array.');
  if(!Array.isArray(front?.members)||!Array.isArray(rear?.members))
    throw new Error('Two fixed road-group rosters are required.');
  const known=new Set([...(front?.members??[]),...(rear?.members??[])]
    .map(member=>member?.id));
  if(known.size!==(front?.members?.length??0)+(rear?.members?.length??0))
    throw new Error('Fixed group rider ids must be distinct.');
  const validRoster=(pulls,drives)=>Array.isArray(pulls)&&
    Array.isArray(drives)&&new Set(pulls).size===pulls.length&&
    new Set(drives).size===drives.length&&
    pulls.every(id=>known.has(id))&&
    drives.every(id=>pulls.includes(id));
  if(!validRoster(pullRiderIds,driveRiderIds))
    throw new Error('Initial group work needs a valid declared roster.');
  const seen=new Set();
  for(const order of workOrders){
    if(!Number.isInteger(order?.markerKm)||order.markerKm<5||
      order.markerKm>=overlay.distanceKm||order.markerKm%5!==0||
      seen.has(order.markerKm)||
      !validRoster(order.pullRiderIds,order.driveRiderIds??[]))
      throw new Error('Group work changes need unique valid 5 km markers and rosters.');
    seen.add(order.markerKm);
  }
  const groups=[front,rear];
  let energy=new Map(groups.flatMap(group=>group.members.map(member=>[
    member.id,member.energyBefore])));
  let gap=gapSeconds,activePulls=[...pullRiderIds],
    activeDrives=[...driveRiderIds];
  const kilometres=[];
  for(let kilometreIndex=0;kilometreIndex<overlay.distanceKm;
    kilometreIndex++){
    const activated=workOrders.find(order=>
      order.markerKm===kilometreIndex);
    if(activated){
      activePulls=[...activated.pullRiderIds];
      activeDrives=[...(activated.driveRiderIds??[])];
    }
    const prepared=groups.map(group=>({...group,
      members:group.members.map(member=>({...member,
        energyBefore:energy.get(member.id)}))}));
    const baseline=kilometreBaselines[kilometreIndex];
    const step=evaluateTwoDeclaredWorkGroupsKilometreV3({overlay,
      kilometreIndex,front:prepared[0],rear:prepared[1],
      gapSeconds:gap,baseTerrain:baseline.terrain,
      baseGradientPct:baseline.gradientPct,
      pullRiderIds:activePulls,driveRiderIds:activeDrives});
    kilometres.push({kilometreIndex,
      pullRiderIds:[...activePulls],driveRiderIds:[...activeDrives],
      workOrderActivated:activated?{markerKm:activated.markerKm,
        pullRiderIds:[...activePulls],driveRiderIds:[...activeDrives]}:null,
      ...step});
    for(const row of step.energies)energy.set(row.riderId,row.energy);
    gap=step.gapSeconds;
    if(step.status!=='separate')return {
      version:STAGE_TWO_DECLARED_WORK_REPLAY_VERSION,
      status:step.status,paidUntilKm:step.paidUntilKm,
      possibleContactSpan:step.possibleContactSpan,
      frontGroupId:front.id,rearGroupId:rear.id,
      gapSeconds:gap,energies:step.energies,kilometres};
  }
  return {version:STAGE_TWO_DECLARED_WORK_REPLAY_VERSION,
    status:'separate',paidUntilKm:overlay.distanceKm,
    frontGroupId:front.id,rearGroupId:rear.id,gapSeconds:gap,
    energies:groups.flatMap(group=>group.members.map(member=>({
      riderId:member.id,energy:energy.get(member.id)}))),kilometres};
}
