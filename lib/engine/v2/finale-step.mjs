// Constant-speed, single-slice calculation for a future distance-based finale.
// Speeds must later come from committed orders, rider state and the recorded
// route. This unit does not choose those speeds or alter the current tour.
function validSlice(slice){
  return slice&&Number.isInteger(slice.startDistanceM)&&
    Number.isInteger(slice.endDistanceM)&&Number.isInteger(slice.lengthM)&&
    slice.startDistanceM>=0&&slice.lengthM>0&&slice.lengthM<=1000&&
    slice.endDistanceM-slice.startDistanceM===slice.lengthM;
}

export function advanceFinaleGap({slice,gapSeconds,frontSpeedKph,chaseSpeedKph}){
  if(!validSlice(slice)||!Number.isFinite(gapSeconds)||gapSeconds<=0||
    !Number.isFinite(frontSpeedKph)||frontSpeedKph<=0||
    !Number.isFinite(chaseSpeedKph)||chaseSpeedKph<=0)
    throw new Error('A finale gap step needs a valid slice, positive gap and speeds.');
  const frontSeconds=slice.lengthM*3.6/frontSpeedKph;
  const chaseSeconds=slice.lengthM*3.6/chaseSpeedKph;
  const newGap=gapSeconds+chaseSeconds-frontSeconds;
  const caught=newGap<=0;
  const catchDistanceM=caught?Math.min(slice.lengthM,
    Math.max(0,slice.lengthM*gapSeconds/(frontSeconds-chaseSeconds))):null;
  return {gapSeconds:caught?0:newGap,caught,
    catchDistanceM:caught?slice.startDistanceM+catchDistanceM:null,
    frontSeconds,chaseSeconds};
}

export function energyCostForFinaleSlice(slice,costPerKm){
  if(!validSlice(slice)||!Number.isFinite(costPerKm)||costPerKm<0)
    throw new Error('A finale energy cost needs a valid slice and non-negative rate.');
  return costPerKm*slice.lengthM/1000;
}
