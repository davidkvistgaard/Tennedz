// Read-only structural audit: count the riders the current V94 clock pays
// together. A future rotation version must replace both speed and energy,
// rather than merely changing commentary about these source frames.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';

const rivalGoals=Array.from({length:19},(_,index)=>({
  teamId:`rival-${index+1}`,
  role:index<6?'break':index<8?'control':'protect',
}));
const {recording}=createV94RaceDynamicsPreview({format:'one_day',rivalGoals,
  settings:{distanceKm:260,terrain:'flat',teamCount:20,fatigue:0,
    attack:'none',chase:'ignore',seed:'chase-rotation-audit-1'}});
const before=JSON.stringify(recording.frames);
const active=recording.frames.filter(frame=>frame.chaseContributions.length);
const contributions=active.flatMap(frame=>frame.chaseContributions);
const workerCount=contributions.reduce((sum,row)=>sum+row.riderIds.length,0);
const additivePowerFrames=active.filter(frame=>
  Math.abs(frame.chasePower-frame.chaseContributions.reduce((sum,row)=>
    sum+row.capacity,0))<1e-6).length;
const paidWorkerCount=active.reduce((sum,frame)=>{
  const ledger=new Map(frame.energyLedger.map(row=>[row.riderId,row]));
  return sum+frame.chaseContributions.flatMap(row=>row.riderIds)
    .filter(id=>ledger.get(id)?.paidFromReserve>0).length;
},0);
if(before!==JSON.stringify(recording.frames))
  throw new Error('Rotation audit changed the paid source road.');
if(additivePowerFrames!==active.length||paidWorkerCount!==workerCount)
  throw new Error('Current chase power or worker payments differ from audit assumptions.');
console.log(JSON.stringify({chaseKilometres:active.length,
  teamKilometres:contributions.length,
  twoWorkerTeamKilometres:contributions.filter(row=>row.riderIds.length===2).length,
  oneWorkerTeamKilometres:contributions.filter(row=>row.riderIds.length===1).length,
  recordedWorkerKilometres:workerCount,
  workersWithPaidReserve:paidWorkerCount,
  additivePowerFrames,
  multiTeamChaseKilometres:active.filter(frame=>
    frame.chaseContributions.length>1).length},null,2));
