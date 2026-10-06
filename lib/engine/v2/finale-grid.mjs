// A distance grid for a future recorded finale. It schedules decisions without
// changing the current kilometre simulation or inventing sub-kilometre route
// geometry. Each slice points to the known kilometre profile until finer route
// data is versioned and available.
export function finaleDistanceGrid(route){
  const distanceKm=route?.distanceKm;
  if(route?.version!==2||!Number.isInteger(distanceKm)||distanceKm<5||
    !Array.isArray(route.kilometres)||route.kilometres.length!==distanceKm||
    route.kilometres.some((segment,index)=>segment?.km!==index+1))
    throw new Error('A complete v2 kilometre route is required for the finale grid.');
  const finishM=distanceKm*1000;
  const lengths=[1000,1000,1000,1000,250,250,100,100,100,100,100];
  let startM=finishM-5000;
  return lengths.map((lengthM,index)=>{
    const endM=startM+lengthM;
    const slice={startDistanceM:startM,endDistanceM:endM,lengthM,
      remainingM:finishM-endM,sourceKm:Math.floor(startM/1000)+1,
      profileResolutionM:1000,
      phase:index<4?'finale':index<6?'approach':'finish'};
    startM=endM;
    return slice;
  });
}
