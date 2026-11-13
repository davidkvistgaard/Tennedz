const EPSILON=1e-8;

function plannedSegments(row,durationSeconds){
  const active=row.activeSeconds>EPSILON;
  const sheltered=row.shelteredSeconds>EPSILON;
  if(!active&&!sheltered)
    throw new Error(`A queued rider has no paid motion: ${row.riderId}.`);
  const segments=[];
  if(active){
    segments.push({startSeconds:0,
      endSeconds:sheltered?row.activeSeconds:durationSeconds,
      velocityMps:row.activeDistanceM/row.activeSeconds,
      workCostPerKm:row.activeWorkCostPerKm,phase:'active'});
  }
  if(sheltered){
    segments.push({startSeconds:active?row.activeSeconds:0,
      endSeconds:durationSeconds,
      velocityMps:row.shelteredDistanceM/row.shelteredSeconds,
      workCostPerKm:row.shelteredWorkCostPerKm,
      phase:'sheltered'});
  }
  if(segments.some(segment=>!Number.isFinite(segment.velocityMps)||
    segment.velocityMps<=0||!Number.isFinite(segment.workCostPerKm)||
    segment.workCostPerKm<0))
    throw new Error(`A queued rider has no finite paid pace: ${
      row.riderId}.`);
  return segments;
}

function motionAt(segments,seconds){
  const segment=segments.find(item=>seconds>=item.startSeconds-EPSILON&&
    seconds<item.endSeconds-EPSILON)??segments.at(-1);
  return segment?segment.startPositionM+
    (seconds-segment.startSeconds)*segment.velocityMps:null;
}

// A test-only longitudinal queue. A rider keeps their paid chosen effort,
// but cannot move through the next wheel in the same fixed source lane.
// Other lanes and the provisional source geometry remain separate questions.
export function queuePaidBunchFrame(rows,slots,{durationSeconds,
  elapsedSeconds,finishM,wheelSpacingM,wheelToleranceM=EPSILON}){
  if(!Array.isArray(rows)||!Array.isArray(slots)||
    !Number.isFinite(durationSeconds)||durationSeconds<=0||
    !Number.isFinite(elapsedSeconds)||!Number.isFinite(finishM)||
    !Number.isFinite(wheelSpacingM)||wheelSpacingM<=0||
    !Number.isFinite(wheelToleranceM)||wheelToleranceM<EPSILON||
    wheelToleranceM>1e-6||
    rows.length!==slots.length)
    throw new Error('A lane queue needs one paid row and source lane per rider.');
  const byId=new Map(rows.map(row=>[row.riderId,row]));
  const result=new Map();
  if(byId.size!==rows.length||new Set(slots.map(row=>row.riderId))
    .size!==rows.length||slots.some(slot=>!byId.has(slot.riderId)||
      !Number.isInteger(slot.lane)||!Number.isInteger(slot.row)))
    throw new Error('A lane queue lost its locked roster or lane.');
  const ordered=[...slots].sort((a,b)=>a.lane-b.lane||
    a.row-b.row);
  const leaderByLane=new Map();
  for(const slot of ordered){
    const row=byId.get(slot.riderId);
    const leader=leaderByLane.get(slot.lane)??null;
    if(row.role==='finished'){
      result.set(row.riderId,{...row,motionSegments:[],
        laneBlocks:[]});
      leaderByLane.set(slot.lane,result.get(row.riderId));
      continue;
    }
    const planned=plannedSegments(row,durationSeconds);
    const leaderLine=leader?.elapsedToLineSeconds===null?Infinity:
      (leader?.elapsedToLineSeconds??-Infinity)-elapsedSeconds;
    if(leader&&leaderLine>EPSILON&&
      leader.positionBeforeM-row.positionBeforeM<
        wheelSpacingM-wheelToleranceM)
      throw new Error('A source lane begins with overlapping wheels.');
    const boundaries=[0,durationSeconds,
      ...planned.map(item=>item.endSeconds),
      ...(leader?.motionSegments??[]).map(item=>item.endSeconds),
      leaderLine].filter(value=>value>=0&&
        value<=durationSeconds).sort((a,b)=>a-b);
    let positionM=row.positionBeforeM,spent=0,lineSeconds=null;
    const motionSegments=[],laneBlocks=[];
    const advance=(from,to,velocityMps,plan,blocked)=>{
      if(to-from<=EPSILON||lineSeconds!==null)return;
      const toLine=(finishM-positionM)/velocityMps;
      const actualTo=Math.min(to,from+toLine);
      const before=positionM;
      const distanceM=velocityMps*(actualTo-from);
      positionM=Math.min(finishM,positionM+distanceM);
      spent+=distanceM*plan.workCostPerKm/1000;
      motionSegments.push({startSeconds:from,endSeconds:actualTo,
        startPositionM:before,endPositionM:positionM,
        velocityMps,plannedVelocityMps:plan.velocityMps,
        workCostPerKm:plan.workCostPerKm,phase:plan.phase,
        blockedById:blocked?leader.riderId:null});
      if(blocked)laneBlocks.push({leaderId:leader.riderId,
        startSeconds:from,endSeconds:actualTo,
        startPositionM:before,endPositionM:positionM});
      if(positionM>=finishM-EPSILON)
        lineSeconds=elapsedSeconds+actualTo;
    };
    for(let index=1;index<boundaries.length;index++){
      const from=boundaries[index-1],to=boundaries[index];
      if(to-from<=EPSILON||lineSeconds!==null)continue;
      const plan=planned.find(item=>from>=item.startSeconds-
        EPSILON&&from<item.endSeconds-EPSILON)??planned.at(-1);
      const activeLeader=leader&&from<leaderLine-EPSILON;
      if(!activeLeader){
        advance(from,to,plan.velocityMps,plan,false);
        continue;
      }
      const leadSegment=leader.motionSegments.find(item=>
        from>=item.startSeconds-EPSILON&&
        from<item.endSeconds-EPSILON);
      if(!leadSegment)
        throw new Error('A queued leader lost its paid trajectory.');
      const leadPosition=motionAt(leader.motionSegments,from);
      const gapM=leadPosition-positionM;
      if(gapM<wheelSpacingM-wheelToleranceM)
        throw new Error('A queued rider has passed through a source wheel.',
          {cause:{riderId:row.riderId,leaderId:leader.riderId,
            lane:slot.lane,elapsedSeconds:elapsedSeconds+from,gapM}});
      if(plan.velocityMps<=leadSegment.velocityMps+EPSILON){
        advance(from,to,plan.velocityMps,plan,false);
        continue;
      }
      const catchSeconds=(gapM-wheelSpacingM)/
        (plan.velocityMps-leadSegment.velocityMps);
      if(catchSeconds>=to-from-EPSILON){
        advance(from,to,plan.velocityMps,plan,false);
        continue;
      }
      const contact=Math.max(from,from+catchSeconds);
      advance(from,contact,plan.velocityMps,plan,false);
      advance(contact,to,leadSegment.velocityMps,plan,true);
    }
    if(spent>row.energyAtDecision+EPSILON)
      throw new Error(`A queued rider cannot pay for travel: ${row.riderId}.`);
    const activeSegments=motionSegments.filter(item=>
      item.phase==='active');
    const shelteredSegments=motionSegments.filter(item=>
      item.phase==='sheltered');
    const sum=(segments,field)=>segments.reduce((total,item)=>
      total+item[field],0);
    const distance=segments=>segments.reduce((total,item)=>
      total+item.endPositionM-item.startPositionM,0);
    const actual={...row,positionM,
      distanceTravelledM:positionM-row.positionBeforeM,
      activeDistanceM:distance(activeSegments),
      shelteredDistanceM:distance(shelteredSegments),
      activeSeconds:sum(activeSegments,'endSeconds')-
        sum(activeSegments,'startSeconds'),
      shelteredSeconds:sum(shelteredSegments,'endSeconds')-
        sum(shelteredSegments,'startSeconds'),
      ...(row.reabsorbedAt!==undefined?{
        reabsorbedAt:laneBlocks.length?null:row.reabsorbedAt}:{}),
      energySpent:spent,
      energyAfter:Math.max(0,row.energyAtDecision-spent),
      elapsedToLineSeconds:lineSeconds,
      motionSegments,laneBlocks};
    result.set(row.riderId,actual);
    leaderByLane.set(slot.lane,actual);
  }
  return rows.map(row=>result.get(row.riderId));
}
