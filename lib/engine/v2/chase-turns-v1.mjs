// One exposed chase helper at a time across the committed chasing teams.
// Candidates must be paid and eligible before this plan moves a road gap.
export const CHASE_TURNS_VERSION='v2-chase-turns-1';

export function planChaseTurnsV1({km,candidates}){
  if(!Number.isInteger(km)||km<1||!Array.isArray(candidates)||
    new Set(candidates.map(row=>row?.riderId)).size!==candidates.length||
    candidates.some(row=>typeof row?.teamId!=='string'||!row.teamId||
      typeof row.riderId!=='string'||!row.riderId||
      !Number.isFinite(row.capacity)||row.capacity<=0||
      !Number.isFinite(row.costPerKm)||row.costPerKm<=0||
      !Number.isFinite(row.energy)||row.energy<0||row.energy>100))
    throw new Error('Invalid named chase-turn candidates.');
  if(!candidates.length)return {version:CHASE_TURNS_VERSION,
    status:'no_chase',turns:[],extraEnergyCosts:[],
    teamContributions:[],chasePower:0,candidates:[]};
  const sorted=[...candidates].sort((a,b)=>a.teamId.localeCompare(b.teamId)||
    a.riderId.localeCompare(b.riderId));
  const start=(km-1)%sorted.length;
  const rotated=[...sorted.slice(start),...sorted.slice(0,start)];
  let metre=0;
  const turns=rotated.map((worker,index)=>{
    const lengthM=Math.floor(1000/rotated.length)+
      (index<1000%rotated.length?1:0);
    const turn={teamId:worker.teamId,leaderRiderId:worker.riderId,
      startM:metre,endM:metre+lengthM,capacity:worker.capacity};
    metre+=lengthM;
    return turn;
  });
  const turnByRider=new Map(turns.map(turn=>[turn.leaderRiderId,turn]));
  const extraEnergyCosts=sorted.map(worker=>{
    const turn=turnByRider.get(worker.riderId);
    const leadingM=turn.endM-turn.startM;
    const extraCost=+(worker.costPerKm*leadingM/1000).toFixed(6);
    if(extraCost>worker.energy+1e-9)
      throw new Error('Named chase turn cannot be paid.');
    return {teamId:worker.teamId,riderId:worker.riderId,
      leadingM,extraCost};
  });
  const byTeam=new Map();
  for(const turn of turns)byTeam.set(turn.teamId,
    (byTeam.get(turn.teamId)??0)+
      turn.capacity*(turn.endM-turn.startM)/1000);
  const teamContributions=[...byTeam].map(([teamId,capacity])=>({
    teamId,capacity}));
  return {version:CHASE_TURNS_VERSION,status:'worked',turns,
    extraEnergyCosts,teamContributions,
    chasePower:teamContributions.reduce((sum,row)=>sum+row.capacity,0),
    candidates:sorted.map(row=>({...row}))};
}
