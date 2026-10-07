// A distance grid for a future recorded finale. It schedules decisions without
// changing the current kilometre simulation or inventing sub-kilometre route
// geometry. Each slice points to the known kilometre profile until finer route
// data is versioned and available.
export function finaleDistanceGrid(route,{remainingKm=5}={}){
  const distanceKm=route?.distanceKm;
  if(route?.version!==2||!Number.isInteger(distanceKm)||distanceKm<5||
    ![1,4,5].includes(remainingKm)||
    !Array.isArray(route.kilometres)||route.kilometres.length!==distanceKm||
    route.kilometres.some((segment,index)=>segment?.km!==index+1))
    throw new Error('A complete v2 kilometre route is required for the finale grid.');
  const finishM=distanceKm*1000;
  const lengths=[1000,1000,1000,1000,250,250,100,100,100,100,100];
  let startM=finishM-remainingKm*1000;
  const gridLengths=remainingKm===1?lengths.slice(4):
    remainingKm===4?lengths.slice(1):lengths;
  return gridLengths.map((lengthM,index)=>{
    const endM=startM+lengthM;
    const slice={startDistanceM:startM,endDistanceM:endM,lengthM,
      remainingM:finishM-endM,sourceKm:Math.floor(startM/1000)+1,
      profileResolutionM:1000,
      phase:startM<finishM-1000?'finale':
        startM<finishM-500?'approach':'finish'};
    startM=endM;
    return slice;
  });
}
