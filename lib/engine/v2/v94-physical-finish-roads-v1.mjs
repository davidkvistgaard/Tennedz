// The paid finish consists of road clocks and membership, not wheels,
// places, awards or a source group gap.
import {validateV94PhysicalWholeRaceV1} from
  './v94-physical-whole-race-validation-v1.mjs';

export const V94_PHYSICAL_FINISH_ROADS_VERSION=
  'v94-physical-finish-roads-1';
const EPS=.002;

export function deriveV94PhysicalFinishRoadsV1(recording,traces){
  const validation=validateV94PhysicalWholeRaceV1(
    recording,traces);
  const final=traces.at(-1);
  const frontClockSeconds=final.front?.frontClockSeconds??
    final.frontClockSeconds;
  if(!Number.isFinite(frontClockSeconds))
    throw new Error('Physical finish needs a paid front clock.');
  const byRoad=new Map();
  for(const finish of final.finishes){
    const row=byRoad.get(finish.physicalGroup);
    if(row){
      if(Math.abs(row.clockSeconds-finish.clockSeconds)>EPS)
        throw new Error(
          'Physical finish road has inconsistent rider clocks.');
      row.riderIds.push(finish.riderId);
    }else byRoad.set(finish.physicalGroup,{
      roadId:finish.physicalGroup,
      clockSeconds:finish.clockSeconds,
      riderIds:[finish.riderId]});
  }
  const rear=new Map((final.physicalRearGroups??[]).map(row=>
    [row.roadId,row]));
  const roads=[...byRoad.values()].map(row=>{
    row.riderIds.sort();
    if(row.roadId==='peloton'){
      if(Math.abs(row.clockSeconds-frontClockSeconds)>EPS)
        throw new Error('Physical bunch finish lacks front clock.');
    }else if(row.riderIds.length>1){
      const receipt=rear.get(row.roadId);
      if(!receipt||receipt.kind!=='rear_group'||
        receipt.riderDecisions.length!==row.riderIds.length||
        receipt.riderDecisions.some(decision=>
          !row.riderIds.includes(decision.riderId)))
        throw new Error(
          'Shared rear finish lacks a paid group road.');
    }
    return row;
  }).sort((a,b)=>a.clockSeconds-b.clockSeconds||
    a.roadId.localeCompare(b.roadId));
  if(!roads.length||!roads.some(row=>
    row.roadId==='peloton'))
    throw new Error('Physical finish lacks a paid bunch road.');
  const firstClockSeconds=roads[0].clockSeconds;
  return {version:V94_PHYSICAL_FINISH_ROADS_VERSION,
    sourceKm:validation.validatedKm,
    riderCount:validation.riderCount,
    totalRiderKm:validation.totalRiderKm,
    frontClockSeconds,firstClockSeconds,
    roads:roads.map(row=>({...row,
      behindFirstRoadSeconds:
        row.clockSeconds-firstClockSeconds})),
    officialResults:false,individualPlaces:false,
    sourceGapsUsed:false};
}
