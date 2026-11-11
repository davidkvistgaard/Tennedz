// Renderer-only fixture. Its extra riders and lane offsets are synthetic and
// must never be passed off as Motor Lab output.
export function rendererStressFeedV1(sourceFeed,count,{missingAsset=false}={}){
  if(![30,150].includes(count))throw new Error('Unsupported stress size.');
  const riders=Array.from({length:count},(_,index)=>({
    ...sourceFeed.riders[index%sourceFeed.riders.length],
    id:`stress-${index+1}`,name:`Synthetic rider ${index+1}`,
    number:index+1}));
  const frames=sourceFeed.frames.map(frame=>({
    time:frame.time,groupRoles:{peloton:'peloton'},
    positions:riders.map((rider,index)=>({riderId:rider.id,
      distance:frame.positions[0].distance-index*.6,
      lateral:(index%10-4.5)*.7,groupId:'peloton'}))}));
  return {...sourceFeed,
    raceId:`synthetic-renderer-stress-${sourceFeed.riderCategory}-${count}`,
    title:`Synthetic renderer stress fixture (${count})`,riders,frames,
    events:[{time:0,label:'Synthetic renderer stress fixture begins.'}],
    ...(missingAsset?{assets:[{id:'missing-asset',type:'gltf',
      url:'/viewer-acceptance/intentionally-missing.glb'}],
      landmarks:[{id:'missing-landmark',type:'tree',
        position:[0,0,20000],assetId:'missing-asset'}]}:{})};
}
