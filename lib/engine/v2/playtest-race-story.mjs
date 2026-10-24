// A small, literal narrative over recorded events. It must not infer a
// successful attack or a catch from a time gap alone.
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
  return moments;
}
