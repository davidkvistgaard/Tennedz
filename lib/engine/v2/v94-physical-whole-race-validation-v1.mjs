// Validate a complete physical replay without assigning official results.
// The input traces remain experimental and retain their own source guards.
export const V94_PHYSICAL_WHOLE_RACE_VALIDATION_VERSION=
  'v94-physical-whole-race-validation-1';

const EPS=.002;
const fail=(km,riderId,reason)=>{
  throw new Error(`Physical whole-race km ${km}${
    riderId?` rider ${riderId}`:''}: ${reason}`);
};

export function validateV94PhysicalWholeRaceV1(recording,traces){
  const route=recording?.route?.kilometres;
  const frames=recording?.frames;
  const teams=recording?.committedInputs?.teams;
  if(!Array.isArray(route)||!route.length||
    !Array.isArray(frames)||frames.length!==route.length||
    !Array.isArray(teams)||!teams.length||
    !Array.isArray(traces)||traces.length!==route.length)
    throw new Error('Physical whole-race needs every source kilometre.');
  const riderIds=teams.flatMap(team=>team.riders.map(row=>row.id));
  const expected=new Set(riderIds);
  if(expected.size!==riderIds.length||!expected.size)
    throw new Error('Physical whole-race needs unique source riders.');
  let prior=null;
  for(let index=0;index<traces.length;index++){
    const km=index+1;
    const trace=traces[index];
    if(route[index]?.km!==km||
      trace?.sourceKm!==km||
      (km===1?
        trace.completeRiderKilometres!==expected.size:
        trace.fullFieldKilometre!==true)||
      trace.officialResults!==false||
      !Array.isArray(trace.finishes)||
      trace.finishes.length!==expected.size)
      fail(km,null,'missing complete, unofficial physical field');
    const seen=new Set();
    for(const finish of trace.finishes){
      const id=finish?.riderId;
      if(!expected.has(id)||seen.has(id))
        fail(km,id,'missing or duplicate source rider');
      seen.add(id);
      if(finish.sourceKm!==km||
        finish.endDistanceM!==km*1000||
        typeof finish.physicalGroup!=='string'||
        !finish.physicalGroup||
        !Number.isFinite(finish.clockSeconds)||
        !Number.isFinite(finish.energyBefore)||
        !Number.isFinite(finish.paidFromReserve)||
        !Number.isFinite(finish.recoveryAward)||
        !Number.isFinite(finish.capAdjustment)||
        !Number.isFinite(finish.energyAfter)||
        finish.paidFromReserve<0||
        finish.recoveryAward<0||
        finish.capAdjustment<0||
        Math.abs(finish.energyBefore-
          finish.paidFromReserve+finish.recoveryAward-
          finish.capAdjustment-finish.energyAfter)>EPS)
        fail(km,id,'invalid physical distance, clock or energy');
      if(prior){
        const old=prior.get(id);
        if(!old||finish.clockSeconds<=old.clockSeconds||
          Math.abs(finish.energyBefore-old.energyAfter)>EPS)
          fail(km,id,'physical clock or reserve is discontinuous');
      }
    }
    prior=new Map(trace.finishes.map(row=>[row.riderId,row]));
  }
  return {version:V94_PHYSICAL_WHOLE_RACE_VALIDATION_VERSION,
    validatedKm:route.length,riderCount:expected.size,
    totalRiderKm:route.length*expected.size,
    finishDistanceM:route.length*1000,
    officialResults:false};
}
