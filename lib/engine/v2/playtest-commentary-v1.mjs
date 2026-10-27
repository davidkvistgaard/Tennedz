// Commentary is a deterministic rendering of paid, recorded events. It never
// turns an order, a changing group marker, or simultaneous chase into a cause.
const WORDING={
  start:[
    ()=>'The race is under way. The first road checkpoint is in.',
    ()=>'The riders are rolling. We have the first recorded road picture.',
    ()=>'The race begins, and the first checkpoint sets the scene.'
  ],
  order:[
    (team,order)=>`${team} calls for ${order} from this kilometre. Now we watch what the riders actually do.`,
    (team,order)=>`A new instruction from ${team}: ${order}. The road record will show whether it is carried out.`,
    (team,order)=>`${team} changes its plan to ${order}. That is the call from the car, not a result yet.`
  ],
  attack:[
    rider=>`${rider} launches an attack attempt. The next road checkpoint will tell us whether a gap opens.`,
    rider=>`${rider} tries to get away. There is no confirmed separation yet.`,
    rider=>`An attack from ${rider}! For now, it is a recorded attempt, not an established break.`
  ],
  contained:[
    rider=>`${rider}'s attack is contained in the recorded kilometre.`,
    rider=>`No escape for ${rider} here: the move is recorded as contained.`,
    rider=>`${rider} tries, but this attack is marked contained.`
  ],
  split:[
    rider=>`${rider} splits from the road group in a recorded break move.`,
    rider=>`A separation for ${rider}: the recorded move is a split.`,
    rider=>`${rider} has split away from the group at this checkpoint.`
  ],
  exhausted:[
    rider=>`${rider}'s break move is blocked by recorded energy exhaustion.`,
    rider=>`The attack cannot continue for ${rider}; the recorded limit is energy.`,
    rider=>`${rider} attempts the move, but the energy guard stops it.`
  ],
  join:[
    (rider,gap)=>`${rider} reaches a front group, recorded ${gap} ahead of the bunch.`,
    (rider,gap)=>`${rider} is now up the road with a front group at ${gap}.`,
    (rider,gap)=>`The road picture changes for ${rider}: front group, ${gap} ahead.`
  ],
  ahead:[
    (rider,gap)=>`${rider} remains in a front group, ${gap} ahead at this checkpoint.`,
    (rider,gap)=>`Still up the road: ${rider} is recorded ${gap} ahead.`,
    (rider,gap)=>`${rider}'s front group is holding a recorded ${gap} gap.`
  ],
  aheadSmall:[
    (rider,gap)=>`${rider}'s group is still dangling just ahead, ${gap} clear.`,
    (rider,gap)=>`Still out front, but only just: ${rider}'s group has ${gap}.`,
    (rider,gap)=>`${rider} remains up the road with a slender ${gap} advantage.`
  ],
  breakEstablished:[
    (riders,gap)=>`${riders} are still together up the road, ${gap} clear of the bunch.`,
    (riders,gap)=>`The move is holding: ${riders}, with ${gap} over the bunch.`,
    (riders,gap)=>`${riders} remain clear together. Their recorded advantage is ${gap}.`
  ],
  leadGrowing:[
    (group,change,gap)=>`${group} has added ${change} to its lead over the last five kilometres. The gap is now ${gap}.`,
    (group,change,gap)=>`The recorded lead grows by ${change} in five kilometres for ${group}; it stands at ${gap}.`,
    (group,change,gap)=>`${group} is further up the road: ${change} gained over five kilometres, ${gap} ahead now.`
  ],
  leadClosing:[
    (group,change,gap)=>`${group}'s advantage has narrowed by ${change} over five kilometres. It is now ${gap}.`,
    (group,change,gap)=>`The gap to ${group} is coming down: ${change} smaller in five kilometres, ${gap} remaining.`,
    (group,change,gap)=>`${group} has lost ${change} of its lead over five kilometres; the recorded gap is ${gap}.`
  ],
  chase:[
    team=>`${team} starts a recorded chase. The gap and any catch remain separate questions.`,
    team=>`${team} is chasing now. We will see what the next checkpoints show.`,
    team=>`The chase is on from ${team}; no catch is confirmed by that alone.`
  ],
  chaseStop:[
    team=>`${team} is no longer recorded chasing.`,
    team=>`The chase entry for ${team} ends here.`,
    team=>`${team} comes off the recorded chase.`
  ],
  catch:[
    rider=>`${rider} is caught, according to the recorded road event.`,
    rider=>`The road record confirms the catch of ${rider}.`,
    rider=>`${rider}'s move ends with a recorded catch.`
  ],
  frontWork:[
    (team,riders)=>`${team} puts ${riders} on the bunch front. Their work is recorded this kilometre.`,
    (team,riders)=>`Actual front work from ${team}: ${riders} take the pace.`,
    (team,riders)=>`${riders} do the bunch-front work for ${team}. This is recorded action on the road.`
  ],
  road:[
    (rider,road)=>`${rider} changes road band and is now ${road}.`,
    (rider,road)=>`A new road position for ${rider}: ${road}.`,
    (rider,road)=>`${rider} is recorded ${road} at this checkpoint.`
  ]
};

function hash(value){
  let result=0;
  for(const char of String(value))result=(result*31+char.charCodeAt(0))>>>0;
  return result;
}

function teamLabel(teamId,names){
  return names?.teams?.[teamId]??(teamId==='you'?'Your team':
    `Team ${teamId.slice(6)}`);
}

function riderLabel(riderId,names){
  return names?.riders?.[riderId]??riderId;
}

function frontOf(frame,riderId){
  return frame?.roadGroups?.find(group=>group.riderIds?.includes(riderId));
}

function leadingGroup(frame){
  return frame?.roadGroups?.filter(group=>Number.isFinite(group.gapSeconds)&&
    group.gapSeconds>0&&Array.isArray(group.riderIds))
    .sort((a,b)=>b.gapSeconds-a.gapSeconds)[0]??null;
}

function sameGroupRiders(a,b){
  return a?.id===b?.id&&a.riderIds.length===b.riderIds.length&&
    a.riderIds.every(id=>b.riderIds.includes(id));
}

function gapLabel(seconds){
  const rounded=Math.round(seconds);
  return rounded<60?`${seconds.toFixed(1)} s`:
    `${Math.floor(rounded/60)}m ${String(rounded%60).padStart(2,'0')}s`;
}

function breakRidersLabel(group,names){
  const ids=[...group.riderIds].sort((a,b)=>
    Number(b.startsWith('you-'))-Number(a.startsWith('you-'))||
    a.localeCompare(b));
  const firstTwo=ids.slice(0,2).map(id=>riderLabel(id,names));
  return ids.length===2?firstTwo.join(' and '):
    `${firstTwo.join(', ')} and ${ids.length-2} other rider${
      ids.length===3?'':'s'}`;
}

function roadOf(frame,riderId){
  if(frontOf(frame,riderId))return 'in a front group';
  if(frame?.droppedRiders?.some(row=>row.riderId===riderId))
    return 'riding alone';
  return 'in the bunch';
}

function chaseTeams(frame){
  return frame?.chasingTeamIds??frame?.engagedChaseTeamIds??[];
}

function ordersAt(race,km){
  const orders=race?.settings?.managerTacticalOrdersV4??
    race?.settings?.managerTacticalOrdersV3??
    race?.settings?.managerTacticalOrdersV2??[];
  return orders.filter(order=>order.atKm===km-1);
}

function orderDescription(order){
  const parts=[];
  if(order.effort)parts.push(`${order.effort} team effort`);
  if(order.frontWork)parts.push(order.frontWork==='rotate'?
    'two helpers rotating on the bunch front':
    order.frontWork==='sit_in'?'riders sitting in':order.frontWork);
  return parts.join(' and ');
}

// Keep the vocabulary English for now. Optional real names may be supplied by
// a future roster; absent names remain honest rider/team identifiers.
export function raceViewerCommentaryV1(race,{names}={}){
  const frames=race?.kilometreFrames??[];
  const counts=new Map();
  const seed=race?.settings?.seed??'';
  const moments=[];
  const frameByKm=new Map(frames.map(frame=>[frame.km,frame]));
  const reportedBreaks=new Set();
  let stableFrontFrames=0;
  const add=(frame,index,kind,args,evidence)=>{
    const options=WORDING[kind];
    const occurrence=counts.get(kind)??0;
    counts.set(kind,occurrence+1);
    const text=options[(hash(`${seed}:${kind}`)+occurrence)%options.length](...args);
    moments.push({km:frame.km,index,kind,text,evidence});
  };
  for(const [index,frame] of frames.entries()){
    const previous=frames[index-1];
    const front=leadingGroup(frame);
    const priorFront=leadingGroup(previous);
    stableFrontFrames=front&&priorFront&&previous?.km===frame.km-1&&
      sameGroupRiders(front,priorFront)?stableFrontFrames+1:
      front?1:0;
    if(index===0)add(frame,index,'start',[],{type:'checkpoint'});
    for(const order of ordersAt(race,frame.km)){
      const description=orderDescription(order);
      if(description)add(frame,index,'order',[
        teamLabel(order.teamId??'you',names),description],
      {type:'committed_order',atKm:order.atKm});
    }
    for(const riderId of frame.attackAttempts??[])
      add(frame,index,'attack',[riderLabel(riderId,names)],
        {type:'attack_attempt',riderId});
    for(const move of frame.frontAttacks??[]){
      if(['contained','split','exhausted'].includes(move.status))
        add(frame,index,move.status,[riderLabel(move.riderId,names)],
          {type:'front_attack_outcome',riderId:move.riderId,
            status:move.status});
    }
    for(const riderId of frame.joinedRiderIds??[]){
      const group=frontOf(frame,riderId);
      if(group&&Number.isFinite(group.gapSeconds))
        add(frame,index,'join',[riderLabel(riderId,names),
          `${group.gapSeconds.toFixed(1)} s`],
        {type:'front_join',riderId,roadGroupId:group.id});
    }
    if(front?.riderIds.length>=2&&front.gapSeconds>=30&&
      stableFrontFrames>=3){
      const key=`${frame.km-stableFrontFrames+1}:${front.id}:`+
        [...front.riderIds].sort().join('|');
      if(!reportedBreaks.has(key)){
        reportedBreaks.add(key);
        add(frame,index,'breakEstablished',[
          breakRidersLabel(front,names),gapLabel(front.gapSeconds)],
        {type:'stable_front_group',roadGroupId:front.id,
          riderIds:[...front.riderIds],observedFromKm:frame.km-2,
          gapSeconds:front.gapSeconds});
      }
    }
    const groupAtMarker=frame.km%5===0?leadingGroup(frame):null;
    const priorAtMarker=groupAtMarker?
      leadingGroup(frameByKm.get(frame.km-5)):null;
    const leadChange=groupAtMarker&&priorAtMarker&&
      sameGroupRiders(groupAtMarker,priorAtMarker)?
      +(groupAtMarker.gapSeconds-priorAtMarker.gapSeconds).toFixed(2):0;
    const significantTrend=Math.abs(leadChange)>=10;
    // Report an established lead again only after it has survived multiple
    // whole-kilometre frames. A significant trend already tells that story.
    if(previous&&index>=2&&frame.km%5===0&&!significantTrend){
      const ownRider=frame.ownRiders?.find(row=>
        frontOf(frame,row.riderId)&&frontOf(previous,row.riderId)&&
        !frame.joinedRiderIds?.includes(row.riderId));
      const group=ownRider&&frontOf(frame,ownRider.riderId);
      if(group&&Number.isFinite(group.gapSeconds))
        add(frame,index,group.gapSeconds<10?'aheadSmall':'ahead',[
          riderLabel(ownRider.riderId,names),
          `${group.gapSeconds.toFixed(1)} s`],
        {type:'front_checkpoint',riderId:ownRider.riderId,
          roadGroupId:group.id});
    }
    if(significantTrend){
      const own=groupAtMarker.riderIds.find(id=>id.startsWith('you-'));
      const label=own?`${riderLabel(own,names)}'s group`:'the leading group';
      add(frame,index,leadChange>0?'leadGrowing':'leadClosing',
        [label,gapLabel(Math.abs(leadChange)),gapLabel(groupAtMarker.gapSeconds)],
        {type:'front_gap_trend',roadGroupId:groupAtMarker.id,
          riderIds:[...groupAtMarker.riderIds],priorKm:frame.km-5,
          priorGapSeconds:priorAtMarker.gapSeconds,
          gapSeconds:groupAtMarker.gapSeconds});
    }
    const before=new Set(chaseTeams(previous));
    const after=new Set(chaseTeams(frame));
    for(const teamId of after)
      if(!before.has(teamId))add(frame,index,'chase',
        [teamLabel(teamId,names)],{type:'chase_start',teamId});
    for(const teamId of before)
      if(!after.has(teamId))add(frame,index,'chaseStop',
        [teamLabel(teamId,names)],{type:'chase_end',teamId});
    const workers=frame.paidBunchPaceRiderIds??[];
    const priorWorkers=previous?.paidBunchPaceRiderIds??[];
    if(workers.length&&frame.paidBunchPaceTeamId&&
      (frame.paidBunchPaceTeamId!==previous?.paidBunchPaceTeamId||
        workers.join('|')!==priorWorkers.join('|')))
      add(frame,index,'frontWork',[
        teamLabel(frame.paidBunchPaceTeamId,names),
        workers.map(id=>riderLabel(id,names)).join(' and ')],
      {type:'paid_front_work',teamId:frame.paidBunchPaceTeamId,
        riderIds:[...workers]});
    for(const riderId of frame.caughtRiderIds??[])
      add(frame,index,'catch',[riderLabel(riderId,names)],
        {type:'recorded_catch',riderId});
    if(previous)for(const rider of frame.ownRiders??[]){
      const riderId=rider.riderId;
      if(!previous.ownRiders?.some(row=>row.riderId===riderId))continue;
      if(roadOf(previous,riderId)!==roadOf(frame,riderId)&&
        !frame.joinedRiderIds?.includes(riderId)&&
        !frame.caughtRiderIds?.includes(riderId))
        add(frame,index,'road',[riderLabel(riderId,names),
          roadOf(frame,riderId)],{type:'road_transition',riderId});
    }
  }
  return moments;
}
