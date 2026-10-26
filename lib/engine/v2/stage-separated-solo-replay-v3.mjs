import {evaluateSeparatedSoloBandsKilometreV3} from
  './stage-separated-solo-bands-v3.mjs';
import {TUNING} from './tuning.mjs';

// A bounded replay of pre-separated solo lanes. It never chooses a break,
// handles a bunch, resolves occupied-wheel contact or classifies the line.
export function replaySeparatedSoloBandsStageV3({
  overlay,bands,gapsSeconds,kilometreBaselines,effortOrders=[],
}){
  if(overlay?.version!==3||!Number.isInteger(overlay.distanceKm)||
    !Array.isArray(kilometreBaselines)||
    kilometreBaselines.length!==overlay.distanceKm)
    throw new Error('Complete integer-kilometre stage baselines are required.');
  if(kilometreBaselines.some(baseline=>
    !['flat','hill','climb','descent'].includes(baseline?.terrain)||
    !Number.isFinite(baseline.gradientPct)))
    throw new Error('Each kilometre needs explicit baseline terrain and gradient.');
  if(!Array.isArray(bands)||bands.length<3||bands.length>8||
    bands.some(band=>typeof band?.id!=='string'||!band.id||
      band.breakWork!=='cooperate')||
    new Set(bands.map(band=>band.id)).size!==bands.length)
    throw new Error('Three to eight distinct cooperating solo bands are required.');
  if(!Array.isArray(gapsSeconds)||gapsSeconds.length!==bands.length-1||
    gapsSeconds.some(gap=>!Number.isFinite(gap)||gap<=0))
    throw new Error('Every neighboring solo gap must be positive.');
  if(!Array.isArray(effortOrders))throw new Error('Effort orders must be an array.');
  const ids=new Set(bands.map(band=>band.id));
  const seen=new Set();
  for(const order of effortOrders){
    if(!ids.has(order?.riderId)||!Number.isInteger(order.markerKm)||
      order.markerKm<5||order.markerKm>=overlay.distanceKm||
      order.markerKm%5!==0||
      !Object.hasOwn(TUNING.effortCost,order.effort))
      throw new Error('Only valid precommitted 5 km solo effort orders are supported.');
    const key=order.riderId+':'+order.markerKm;
    if(seen.has(key))throw new Error('Duplicate rider effort order at one marker.');
    seen.add(key);
  }
  const state=new Map(bands.map(band=>[band.id,
    {energy:band.energyBefore,effort:band.effort}]));
  let gaps=[...gapsSeconds];
  const kilometres=[];
  for(let kilometreIndex=0;kilometreIndex<overlay.distanceKm;kilometreIndex++){
    const ordersActivated=effortOrders.filter(order=>
      order.markerKm===kilometreIndex);
    for(const order of ordersActivated)
      state.get(order.riderId).effort=order.effort;
    const baseline=kilometreBaselines[kilometreIndex];
    const step=evaluateSeparatedSoloBandsKilometreV3({
      overlay,kilometreIndex,bands:bands.map(band=>({...band,
        energyBefore:state.get(band.id).energy,
        effort:state.get(band.id).effort})),
      gapsSeconds:gaps,baseTerrain:baseline.terrain,
      baseGradientPct:baseline.gradientPct});
    kilometres.push({kilometreIndex,
      ordersActivated:ordersActivated.map(order=>({...order})),...step});
    for(const row of step.energies)state.get(row.riderId).energy=row.energy;
    gaps=step.gapsSeconds;
    if(step.status!=='separate')return {version:3,status:step.status,
      paidUntilKm:step.paidUntilKm,possibleContactSpan:step.possibleContactSpan,
      possibleContactPairs:step.possibleContactPairs,
      energies:step.energies,gapsSeconds:gaps,kilometres};
  }
  return {version:3,status:'separate',paidUntilKm:overlay.distanceKm,
    energies:bands.map(band=>({riderId:band.id,
      energy:state.get(band.id).energy})),gapsSeconds:gaps,kilometres};
}
