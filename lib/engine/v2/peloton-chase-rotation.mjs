// Isolated chase candidate. Only one rider occupies the wind at a time.
// Multiple willing helpers share a kilometre's leading duty; their powers
// never add together as if they were riding abreast. This does not change the
// paid V93/V94 road or grant a team permission to join the chase.
const round=value=>+value.toFixed(6);

export function planPelotonChaseRotation({contributions,
  leadExtraCostPerKm,draftCostPerKm=0}){
  if(!Array.isArray(contributions)||
    !Number.isFinite(leadExtraCostPerKm)||leadExtraCostPerKm<0||
    !Number.isFinite(draftCostPerKm)||draftCostPerKm<0)
    throw new Error('Invalid peloton rotation inputs.');
  const teamIds=new Set();
  const riderIds=new Set();
  const workers=[];
  for(const contribution of contributions){
    if(typeof contribution?.teamId!=='string'||!contribution.teamId||
      teamIds.has(contribution.teamId)||
      !Array.isArray(contribution.workers)||
      contribution.workers.length<1||contribution.workers.length>2)
      throw new Error('Invalid peloton rotation team.');
    teamIds.add(contribution.teamId);
    for(const worker of contribution.workers){
      if(typeof worker?.riderId!=='string'||!worker.riderId||
        riderIds.has(worker.riderId)||
        !Number.isFinite(worker.capacity)||worker.capacity<0)
        throw new Error('Invalid peloton rotation worker.');
      riderIds.add(worker.riderId);
      workers.push({teamId:contribution.teamId,riderId:worker.riderId,
        capacity:worker.capacity});
    }
  }
  if(!workers.length)return {version:1,activeTeamIds:[],
    rotation:[],effectiveCapacity:0,workerCount:0};
  const share=1/workers.length;
  return {version:1,activeTeamIds:[...teamIds],workerCount:workers.length,
    // Entries are successive fractions of one km, never simultaneous pulls.
    rotation:workers.map(worker=>({teamId:worker.teamId,
      riderId:worker.riderId,leadShare:share,
      leadExtraCost:round(leadExtraCostPerKm*share),
      draftCost:round(draftCostPerKm*(1-share))})),
    effectiveCapacity:round(workers.reduce((sum,worker)=>
      sum+worker.capacity*share,0))};
}

// Only a paid rotation may generate these lines. A plan or an expected ally
// is not evidence that another team has actually sent a worker forward.
export function paidRotationMoments(previous,current,teamNames={}){
  if(!current||current.version!==1||!Array.isArray(current.rotation)||
    previous&&previous.version!==1)
    throw new Error('Invalid paid rotation commentary.');
  const ridersByTeam=plan=>{
    const teams=new Map();
    for(const pull of plan?.rotation??[]){
      if(!teams.has(pull.teamId))teams.set(pull.teamId,[]);
      teams.get(pull.teamId).push(pull.riderId);
    }
    return teams;
  };
  const before=ridersByTeam(previous);
  const after=ridersByTeam(current);
  const moments=[];
  for(const [teamId,riderIds] of after){
    const prior=before.get(teamId)??[];
    const added=riderIds.filter(id=>!prior.includes(id));
    if(!added.length)continue;
    const team=teamNames[teamId]??teamId;
    const text=prior.length?
      `${team} adds ${added.length} rider${added.length===1?'':'s'} to the paid chase rotation.`:
      `${team} sends ${added.length} rider${added.length===1?'':'s'} into the paid chase rotation.`;
    moments.push({kind:prior.length?'chase_reinforced':'chase_started',
      teamId,riderIds:added,text});
  }
  for(const [teamId] of before)
    if(!after.has(teamId))moments.push({kind:'chase_ended',teamId,
      riderIds:[],text:`${teamNames[teamId]??teamId} ends its paid chase rotation.`});
  return moments;
}
