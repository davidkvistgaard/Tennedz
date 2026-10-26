import {evaluateTwoCooperativeGroupsKilometreV3} from
  './stage-two-cooperative-groups-v3.mjs';
import {TUNING} from './tuning.mjs';

// Internal fixed-roster group-clock replay. No formation, drafting, attacks,
// recovery, wheel order, group merge or official result is inferred.
export function replayTwoCooperativeGroupsStageV3({
  overlay,front,rear,gapSeconds,kilometreBaselines,effortOrders=[],
}){
  if(overlay?.version!==3||!Number.isInteger(overlay.distanceKm)||
    !Array.isArray(kilometreBaselines)||
    kilometreBaselines.length!==overlay.distanceKm)
    throw new Error('Complete integer-kilometre stage baselines are required.');
  if(kilometreBaselines.some(baseline=>
    !['flat','hill','climb','descent'].includes(baseline?.terrain)||
    !Number.isFinite(baseline.gradientPct)))
    throw new Error('Each kilometre needs explicit baseline terrain and gradient.');
  const groups=[front,rear];
  if(groups.some(group=>typeof group?.id!=='string'||!group.id||
      !Array.isArray(group.members)||group.members.length<2||
      group.members.length>5||
      group.members.some(member=>typeof member?.id!=='string'||!member.id||
        member.breakWork!=='cooperate'))||
    front.id===rear.id||
    new Set(groups.flatMap(group=>group.members.map(member=>
      member.id))).size!==groups.reduce((sum,group)=>
      sum+group.members.length,0))
    throw new Error('Two distinct fixed cooperative road groups are required.');
  if(!Number.isFinite(gapSeconds)||gapSeconds<=0)
    throw new Error('Cooperative road-group gap must be positive.');
  if(!Array.isArray(effortOrders))
    throw new Error('Group effort orders must be an array.');
  const ids=new Set(groups.map(group=>group.id)),seen=new Set();
  for(const order of effortOrders){
    if(!ids.has(order?.groupId)||!Number.isInteger(order.markerKm)||
      order.markerKm<5||order.markerKm>=overlay.distanceKm||
      order.markerKm%5!==0||
      !Object.hasOwn(TUNING.effortCost,order.effort))
      throw new Error('Only valid precommitted 5 km group effort orders are supported.');
    const key=order.groupId+':'+order.markerKm;
    if(seen.has(key))throw new Error('Duplicate group effort order at one marker.');
    seen.add(key);
  }
  const energy=new Map(groups.flatMap(group=>group.members.map(member=>[
    member.id,member.energyBefore])));
  const effort=new Map(groups.map(group=>[group.id,group.members[0].effort]));
  if(groups.some(group=>group.members.some(member=>
    member.effort!==effort.get(group.id))))
    throw new Error('Fixed group members need one shared effort.');
  let gap=gapSeconds;
  const kilometres=[];
  for(let kilometreIndex=0;kilometreIndex<overlay.distanceKm;kilometreIndex++){
    const ordersActivated=effortOrders.filter(order=>
      order.markerKm===kilometreIndex);
    for(const order of ordersActivated)effort.set(order.groupId,order.effort);
    const prepared=groups.map(group=>({...group,members:group.members.map(member=>({
      ...member,energyBefore:energy.get(member.id),
      effort:effort.get(group.id)}))}));
    const baseline=kilometreBaselines[kilometreIndex];
    const step=evaluateTwoCooperativeGroupsKilometreV3({
      overlay,kilometreIndex,front:prepared[0],rear:prepared[1],
      gapSeconds:gap,baseTerrain:baseline.terrain,
      baseGradientPct:baseline.gradientPct});
    kilometres.push({kilometreIndex,
      groupEfforts:groups.map(group=>({groupId:group.id,
        effort:effort.get(group.id)})),
      ordersActivated:ordersActivated.map(order=>({...order})),...step});
    for(const row of step.energies)energy.set(row.riderId,row.energy);
    gap=step.gapSeconds;
    if(step.status!=='separate')return {
      version:3,status:step.status,paidUntilKm:step.paidUntilKm,
      possibleContactSpan:step.possibleContactSpan,
      frontGroupId:front.id,rearGroupId:rear.id,
      gapSeconds:gap,energies:step.energies,kilometres};
  }
  return {version:3,status:'separate',paidUntilKm:overlay.distanceKm,
    frontGroupId:front.id,rearGroupId:rear.id,gapSeconds:gap,
    energies:groups.flatMap(group=>group.members.map(member=>({
      riderId:member.id,energy:energy.get(member.id)}))),
    kilometres};
}
