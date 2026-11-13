// A small, literal narrative over recorded events. It must not infer a
// successful attack or a catch from a time gap alone.
import {raceViewerTimeline} from './playtest-viewer.mjs';

function gapLabel(seconds){
  if(seconds<60)return `${seconds.toFixed(1)} s`;
  const rounded=Math.round(seconds);
  return `${Math.floor(rounded/60)}m ${String(rounded%60).padStart(2,'0')}s`;
}

export function summarizePlaytestRaceStory(race){
  const frames=race?.kilometreFrames??[];
  const own=id=>id?.startsWith('you-');
  const first=(key)=>frames.flatMap(frame=>frame[key]
    .filter(own).map(riderId=>({km:frame.km,riderId})))[0];
  const attack=first('attackAttempts');
  const joined=first('joinedRiderIds');
  const caught=first('caughtRiderIds');
  const finisherId=race?.managerDecisions?.find(row=>
    row.teamId==='you')?.finisherId;
  const handoff=frames.at(-1);
  const finisher=handoff?.ownRiders.find(row=>row.riderId===finisherId);
  const front=handoff?.roadGroups.find(group=>
    group.riderIds.includes(finisherId));
  const dropped=handoff?.droppedRiders.find(row=>
    row.riderId===finisherId);
  const moments=[];
  // Keep the short story in road order even when different teammates own
  // the first attack, join and catch. The complete sequence lives below.
  const events=[
    attack&&{...attack,label:'attempted an attack',order:0},
    joined&&{...joined,label:'joined a front group',order:1},
    caught&&{...caught,label:'was caught',order:2}]
    .filter(Boolean).sort((a,b)=>a.km-b.km||a.order-b.order);
  moments.push(...events.map(row=>
    `Km ${row.km}: ${row.riderId} ${row.label}.`));
  if(!moments.length)moments.push('No attack, front-group join or catch was recorded for your riders.');
  const ownChaseKm=frames.filter(frame=>(frame.chasingTeamIds??
    frame.engagedChaseTeamIds??[]).includes('you')).length;
  const ownFrontWorkKm=frames.filter(frame=>
    frame.paidBunchPaceTeamId==='you'&&
    frame.paidBunchPaceRiderIds?.length===2).length;
  if(ownChaseKm||ownFrontWorkKm){
    const work=[];
    if(ownChaseKm)work.push(`chased for ${ownChaseKm} recorded ${
      ownChaseKm===1?'kilometre':'kilometres'}`);
    if(ownFrontWorkKm)work.push(`set bunch-front pace for ${
      ownFrontWorkKm} recorded ${ownFrontWorkKm===1?'kilometre':'kilometres'}`);
    moments.push(`Your team ${work.join(' and ')}.`);
  }
  const widest=frames.flatMap(frame=>(frame.roadGroups??[])
    .filter(group=>Number.isFinite(group.gapSeconds)&&
      group.gapSeconds>0&&group.riderIds?.length>0)
    .map(group=>({km:frame.km,group})))
    .sort((a,b)=>b.group.gapSeconds-a.group.gapSeconds||a.km-b.km)[0];
  if(widest)moments.push(`The leading group had its widest recorded gap at km ${
    widest.km}: ${gapLabel(widest.group.gapSeconds)} with ${
    widest.group.riderIds.length} ${widest.group.riderIds.length===1?
      'rider':'riders'}.`);
  else if(handoff)moments.push(
    'No front road group was recorded before the final kilometre.');
  if(widest){
    const minuteFrames=frames.filter(frame=>(frame.roadGroups??[])
      .some(group=>group.gapSeconds>=60&&group.riderIds?.length>0));
    moments.push(minuteFrames.length?
      `A leading group first reached one minute at km ${minuteFrames[0].km}; at least one group held that much for ${minuteFrames.length} recorded ${minuteFrames.length===1?'kilometre':'kilometres'}.`:
      'No leading road group reached one full minute over the bunch.');
  }
  const handoffLeader=(handoff?.roadGroups??[])
    .filter(group=>Number.isFinite(group.gapSeconds)&&group.gapSeconds>0&&
      group.riderIds?.length>0)
    .sort((a,b)=>b.gapSeconds-a.gapSeconds)[0];
  if(handoffLeader&&widest?.km!==handoff.km)
    moments.push(`With 1 km to go, the leading group still had ${
      gapLabel(handoffLeader.gapSeconds)} with ${
      handoffLeader.riderIds.length} ${handoffLeader.riderIds.length===1?
        'rider':'riders'}.`);
  if(handoff){
    const frontRiders=handoff.ownRiders.filter(row=>handoff.roadGroups
      .some(group=>group.riderIds.includes(row.riderId)))
      .map(row=>row.riderId);
    moments.push(frontRiders.length?
      `With 1 km to go, your team had ${frontRiders.join(', ')} in a front group.`:
      'With 1 km to go, your team had no rider in a front group.');
  }
  if(finisher){
    const position=front?
      `in ${front.id}, ${front.gapSeconds.toFixed(1)} s ahead of the bunch`:
      dropped?dropped.deficitSeconds<0?
        `${Math.abs(dropped.deficitSeconds).toFixed(1)} s ahead of the bunch, riding alone`:
        `${dropped.deficitSeconds.toFixed(1)} s behind the bunch, riding alone`:
        'in the bunch';
    moments.push(`With 1 km to go, ${finisherId} was ${position} with ${finisher.energy.toFixed(1)} of 100 energy remaining.`);
  }
  const paidContact=race?.frontCatch&&race?.lineTimes?.length?
    raceViewerTimeline(race).find(row=>row.finaleRoadIndex!==undefined):null;
  const caughtOwn=race?.frontCatch?.caughtRiderIds?.filter(own)??[];
  if(paidContact&&caughtOwn.length)
    moments.push(`At ${paidContact.km.toFixed(3)} km on the paid final road, ${caughtOwn.join(', ')} ${caughtOwn.length===1?'was':'were'} caught.`);
  return moments;
}
