import {orderAt} from './orders.mjs';
import {validateRecordedTour} from './recording.mjs';
import {normalizeStageOverlayV3} from './stage-overlay-v3.mjs';

export const STAGE_RECORDED_ROAD_HANDOFF_VERSION=
  'v3-recorded-v2-road-handoff-1';

// Begin only after an entire v2 kilometre and its attack/defense energy have
// been recorded. No launch position inside that kilometre is invented.
export function prepareRecordedRoadHandoffV3({recording,frameIndex,overlay}){
  if(recording?.version!==2||overlay?.version!==3||
    overlay.distanceKm!==recording?.route?.distanceKm||
    !Number.isInteger(frameIndex)||frameIndex<0||
    frameIndex>=recording.frames?.length-1)
    throw new Error('A recorded non-final v2 kilometre and matching v3 stage are required.');
  normalizeStageOverlayV3(overlay);
  validateRecordedTour(recording);
  const frame=recording.frames[frameIndex];
  if(frame.km!==frameIndex+1||
    !frame.splitAttacks?.some(attack=>attack.status==='split'))
    throw new Error('The handoff requires a paid recorded road-group split.');
  const groups=frame.roadGroups;
  if(groups.length<3||groups.length>8||
    groups.some(group=>group.riderIds.length>5))
    throw new Error('The recorded split is outside the bounded mixed-band geometry.');
  const participants=new Map(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,orders:team.orders}])));
  const states=new Map(frame.riderGroups.map(row=>[row.id,row]));
  const bands=groups.map(group=>({id:group.id,
    members:group.riderIds.map(id=>{
      const participant=participants.get(id),state=states.get(id);
      if(!participant||!state||!Number.isFinite(state.energy)||
        state.energy<0||state.energy>100)
        throw new Error('Recorded road rider lacks paid energy or committed skills.');
      return {id,rider:structuredClone(participant.rider),
        effort:orderAt(participant.orders,frame.km).effort,
        energyBefore:state.energy};
    })}));
  const gapsSeconds=groups.slice(0,-1).map((group,index)=>
    +(group.gapSeconds-groups[index+1].gapSeconds).toFixed(6));
  if(gapsSeconds.some(gap=>gap<=0))
    throw new Error('Recorded road groups must retain positive separation.');
  return {version:STAGE_RECORDED_ROAD_HANDOFF_VERSION,
    source:{recordingVersion:recording.version,
      tuningVersion:recording.tuningVersion,raceSeed:recording.raceSeed,
      completedKm:frame.km,
      paidSplitRiderIds:frame.splitAttacks.filter(attack=>
        attack.status==='split').map(attack=>attack.riderId)},
    startKilometreIndex:frame.km,
    bands,gapsSeconds};
}
